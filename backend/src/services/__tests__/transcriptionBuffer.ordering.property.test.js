/**
 * Property-Based Tests for TranscriptionBuffer - Chunk Ordering
 * Tests Property 2: Chunk Ordering Preservation
 * 
 * Validates: Requirements 1.3, 6.5
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fc from 'fast-check';
import { TranscriptionBuffer } from '../transcriptionBuffer.js';
import { v4 as uuidv4 } from 'uuid';

describe('TranscriptionBuffer - Property 2: Chunk Ordering Preservation', () => {
  
  jest.setTimeout(30000);
  
  let buffer;
  
  beforeEach(() => {
    buffer = new TranscriptionBuffer();
  });

  /**
   * Property 2: Chunk Ordering Preservation
   * 
   * For any sequence of audio chunks received by the server, regardless of
   * network delays or out-of-order arrival, the transcription buffer SHALL
   * contain chunks ordered by their sequence numbers, and the final
   * transcription SHALL reflect the correct temporal order of speech.
   */
  describe('Property 2: Chunk Ordering Preservation', () => {
    
    // Arbitrary for generating audio chunk data
    const audioChunkArb = fc.record({
      sequenceNumber: fc.nat({ max: 1000 }),
      data: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
    });
    
    // Arbitrary for generating a sequence of chunks
    const chunkSequenceArb = fc.array(
      fc.nat({ max: 100 }),
      { minLength: 5, maxLength: 50 }
    ).map(nums => {
      // Create unique sequence numbers
      const uniqueNums = [...new Set(nums)].sort((a, b) => a - b);
      return uniqueNums.map(seq => ({
        sequenceNumber: seq,
        data: Buffer.alloc(100 + seq, seq % 256), // Deterministic data based on seq
      }));
    });

    it('Property 2.1: Chunks should be stored in sequence order regardless of arrival order', async () => {
      await fc.assert(
        fc.asyncProperty(chunkSequenceArb, async (chunks) => {
          const sessionId = uuidv4();
          buffer.initSession(sessionId);
          
          // Shuffle chunks to simulate out-of-order arrival
          const shuffledChunks = [...chunks].sort(() => Math.random() - 0.5);
          
          // Add chunks in shuffled order
          for (const chunk of shuffledChunks) {
            buffer.addChunk(sessionId, chunk);
          }
          
          // Get all chunks from buffer
          const storedChunks = buffer.getAllUnprocessedChunks(sessionId);
          
          // Verify chunks are in sequence order
          for (let i = 1; i < storedChunks.length; i++) {
            expect(storedChunks[i].sequenceNumber).toBeGreaterThan(
              storedChunks[i - 1].sequenceNumber
            );
          }
          
          // Clean up
          buffer.clearSession(sessionId);
        }),
        { numRuns: 20 }
      );
    });

    it('Property 2.2: Combined audio should preserve temporal order', async () => {
      const sessionId = uuidv4();
      buffer.initSession(sessionId);
      
      // Create chunks with identifiable data
      const chunks = [];
      for (let i = 0; i < 10; i++) {
        chunks.push({
          sequenceNumber: i,
          data: Buffer.alloc(10, i), // Each chunk filled with its sequence number
        });
      }
      
      // Add in reverse order
      for (let i = chunks.length - 1; i >= 0; i--) {
        buffer.addChunk(sessionId, chunks[i]);
      }
      
      // Get combined audio
      const combined = buffer.getCombinedAudio(sessionId);
      
      // Verify order: each 10-byte segment should contain its sequence number
      for (let i = 0; i < 10; i++) {
        const segment = combined.slice(i * 10, (i + 1) * 10);
        expect(segment[0]).toBe(i);
      }
      
      buffer.clearSession(sessionId);
    });

    it('Property 2.3: Out-of-order detection should be accurate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.nat({ max: 20 }), { minLength: 5, maxLength: 15 }),
          async (sequenceNumbers) => {
            const sessionId = uuidv4();
            buffer.initSession(sessionId);
            
            let expectedOutOfOrder = 0;
            let expectedSeq = 0;
            
            for (const seq of sequenceNumbers) {
              const chunk = {
                sequenceNumber: seq,
                data: Buffer.alloc(10),
              };
              
              const result = buffer.addChunk(sessionId, chunk);
              
              // Track expected out-of-order count
              if (seq !== expectedSeq && seq > expectedSeq) {
                expectedOutOfOrder++;
              }
              
              if (seq === expectedSeq) {
                expectedSeq++;
              }
              
              expect(result.added).toBe(true);
            }
            
            const stats = buffer.getStats(sessionId);
            expect(stats.outOfOrderCount).toBe(expectedOutOfOrder);
            
            buffer.clearSession(sessionId);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('Property 2.4: Gap detection should identify missing sequences', async () => {
      const sessionId = uuidv4();
      buffer.initSession(sessionId);
      
      // Add chunks with gaps: 0, 1, 3, 5, 6 (missing 2, 4)
      const sequences = [0, 1, 3, 5, 6];
      for (const seq of sequences) {
        buffer.addChunk(sessionId, {
          sequenceNumber: seq,
          data: Buffer.alloc(10),
        });
      }
      
      const gapInfo = buffer.checkForGaps(sessionId);
      
      expect(gapInfo.hasGaps).toBe(true);
      expect(gapInfo.missingSequences).toContain(2);
      expect(gapInfo.missingSequences).toContain(4);
      expect(gapInfo.missingSequences.length).toBe(2);
      
      buffer.clearSession(sessionId);
    });

    it('Property 2.5: Ready chunks should only include consecutive sequences', async () => {
      const sessionId = uuidv4();
      buffer.initSession(sessionId);
      
      // Add chunks: 0, 1, 2, 5, 6 (gap at 3, 4)
      const sequences = [0, 1, 2, 5, 6];
      for (const seq of sequences) {
        buffer.addChunk(sessionId, {
          sequenceNumber: seq,
          data: Buffer.alloc(10),
        });
      }
      
      // Get ready chunks - should only return 0, 1, 2 (before the gap)
      const readyChunks = buffer.getReadyChunks(sessionId, 10);
      
      expect(readyChunks.length).toBe(3);
      expect(readyChunks[0].sequenceNumber).toBe(0);
      expect(readyChunks[1].sequenceNumber).toBe(1);
      expect(readyChunks[2].sequenceNumber).toBe(2);
      
      buffer.clearSession(sessionId);
    });

    it('Property 2.6: Marking chunks processed should not affect ordering', async () => {
      const sessionId = uuidv4();
      buffer.initSession(sessionId);
      
      // Add chunks in order
      for (let i = 0; i < 10; i++) {
        buffer.addChunk(sessionId, {
          sequenceNumber: i,
          data: Buffer.alloc(10, i),
        });
      }
      
      // Mark some as processed
      buffer.markProcessed(sessionId, [0, 1, 2], 'test transcription', 0.9);
      
      // Get remaining unprocessed
      const unprocessed = buffer.getAllUnprocessedChunks(sessionId);
      
      // Should still be in order
      for (let i = 1; i < unprocessed.length; i++) {
        expect(unprocessed[i].sequenceNumber).toBeGreaterThan(
          unprocessed[i - 1].sequenceNumber
        );
      }
      
      // First unprocessed should be 3
      expect(unprocessed[0].sequenceNumber).toBe(3);
      
      buffer.clearSession(sessionId);
    });

    it('Property 2.7: Assembled transcription should follow sequence order', async () => {
      const sessionId = uuidv4();
      buffer.initSession(sessionId);
      
      // Add chunks
      for (let i = 0; i < 5; i++) {
        buffer.addChunk(sessionId, {
          sequenceNumber: i,
          data: Buffer.alloc(10),
        });
      }
      
      // Mark processed with transcriptions in order
      buffer.markProcessed(sessionId, [0], 'First ', 0.9);
      buffer.markProcessed(sessionId, [1], 'Second ', 0.9);
      buffer.markProcessed(sessionId, [2], 'Third ', 0.9);
      
      const assembled = buffer.getAssembledTranscription(sessionId);
      
      // Transcription should be in sequence order
      expect(assembled).toBe('First Second Third ');
      
      buffer.clearSession(sessionId);
    });

    it('Property 2.8: Binary search insertion should maintain order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.nat({ max: 1000 }), { minLength: 10, maxLength: 100 }),
          async (randomSequences) => {
            const sessionId = uuidv4();
            buffer.initSession(sessionId);
            
            // Add chunks in random order
            for (const seq of randomSequences) {
              buffer.addChunk(sessionId, {
                sequenceNumber: seq,
                data: Buffer.alloc(10),
              });
            }
            
            // Get all chunks
            const allChunks = buffer.getAllUnprocessedChunks(sessionId);
            
            // Verify strict ordering
            for (let i = 1; i < allChunks.length; i++) {
              expect(allChunks[i].sequenceNumber).toBeGreaterThanOrEqual(
                allChunks[i - 1].sequenceNumber
              );
            }
            
            buffer.clearSession(sessionId);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('Property 2.9: Stats should accurately reflect buffer state', async () => {
      const sessionId = uuidv4();
      buffer.initSession(sessionId);
      
      // Add 10 chunks
      for (let i = 0; i < 10; i++) {
        buffer.addChunk(sessionId, {
          sequenceNumber: i,
          data: Buffer.alloc(100),
        });
      }
      
      // Mark 3 as processed
      buffer.markProcessed(sessionId, [0, 1, 2], 'test', 0.9);
      
      const stats = buffer.getStats(sessionId);
      
      expect(stats.totalChunks).toBe(10);
      expect(stats.processedChunks).toBe(3);
      expect(stats.pendingChunks).toBe(7);
      expect(stats.totalBytes).toBe(1000); // 10 chunks * 100 bytes
      
      buffer.clearSession(sessionId);
    });

    it('Property 2.10: Clearing session should return final stats', async () => {
      const sessionId = uuidv4();
      buffer.initSession(sessionId);
      
      // Add chunks
      for (let i = 0; i < 5; i++) {
        buffer.addChunk(sessionId, {
          sequenceNumber: i,
          data: Buffer.alloc(50),
        });
      }
      
      const finalStats = buffer.clearSession(sessionId);
      
      expect(finalStats.totalChunks).toBe(5);
      expect(finalStats.totalBytes).toBe(250);
      
      // Session should be gone
      const emptyStats = buffer.getStats(sessionId);
      expect(emptyStats.totalChunks).toBe(0);
    });
  });
});
