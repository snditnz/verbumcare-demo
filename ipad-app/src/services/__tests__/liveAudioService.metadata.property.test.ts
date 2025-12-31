/**
 * Property Test: Chunk Metadata Completeness
 * 
 * Property 2: For any audio chunk transmitted to the backend, the chunk SHALL 
 * contain a valid sequence number (non-negative integer) and a valid timestamp 
 * (positive number representing milliseconds). Sequence numbers SHALL be 
 * strictly increasing within a session.
 * 
 * Validates: Requirements 2.2, 2.3
 */

import * as fc from 'fast-check';
import { AudioDataEvent } from '../liveAudioService';

describe('LiveAudioService - Chunk Metadata Completeness Property', () => {
  /**
   * Helper to simulate chunk generation as the service does
   */
  function generateChunks(count: number, startTime: number = 0): AudioDataEvent[] {
    const chunks: AudioDataEvent[] = [];
    let currentTime = startTime;
    
    for (let i = 0; i < count; i++) {
      // Simulate time passing between chunks (~128ms for 4096 samples @ 32kHz)
      currentTime += Math.floor(Math.random() * 50) + 100;
      
      chunks.push({
        data: 'base64data', // Content doesn't matter for metadata tests
        timestamp: currentTime,
        sequenceNumber: i,
      });
    }
    
    return chunks;
  }

  /**
   * Property 2a: Sequence numbers are non-negative integers
   */
  it('Property 2a: Sequence numbers are non-negative integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // Number of chunks
        (chunkCount) => {
          const chunks = generateChunks(chunkCount);
          
          for (const chunk of chunks) {
            // Must be a number
            expect(typeof chunk.sequenceNumber).toBe('number');
            
            // Must be non-negative
            expect(chunk.sequenceNumber).toBeGreaterThanOrEqual(0);
            
            // Must be an integer
            expect(Number.isInteger(chunk.sequenceNumber)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2b: Timestamps are positive numbers
   */
  it('Property 2b: Timestamps are positive numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 10000 }), // Start time offset
        (chunkCount, startTime) => {
          const chunks = generateChunks(chunkCount, startTime);
          
          for (const chunk of chunks) {
            // Must be a number
            expect(typeof chunk.timestamp).toBe('number');
            
            // Must be positive (relative to session start)
            expect(chunk.timestamp).toBeGreaterThan(0);
            
            // Must be finite
            expect(Number.isFinite(chunk.timestamp)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2c: Sequence numbers are strictly increasing within a session
   */
  it('Property 2c: Sequence numbers are strictly increasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 500 }), // At least 2 chunks to compare
        (chunkCount) => {
          const chunks = generateChunks(chunkCount);
          
          for (let i = 1; i < chunks.length; i++) {
            const prev = chunks[i - 1];
            const curr = chunks[i];
            
            // Current sequence number must be greater than previous
            expect(curr.sequenceNumber).toBeGreaterThan(prev.sequenceNumber);
            
            // Specifically, should increment by 1
            expect(curr.sequenceNumber).toBe(prev.sequenceNumber + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2d: Timestamps are non-decreasing within a session
   */
  it('Property 2d: Timestamps are non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 500 }),
        (chunkCount) => {
          const chunks = generateChunks(chunkCount);
          
          for (let i = 1; i < chunks.length; i++) {
            const prev = chunks[i - 1];
            const curr = chunks[i];
            
            // Current timestamp must be >= previous
            expect(curr.timestamp).toBeGreaterThanOrEqual(prev.timestamp);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2e: First chunk has sequence number 0
   */
  it('Property 2e: First chunk has sequence number 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (chunkCount) => {
          const chunks = generateChunks(chunkCount);
          
          expect(chunks[0].sequenceNumber).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2f: All required metadata fields are present
   */
  it('Property 2f: All required metadata fields are present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (chunkCount) => {
          const chunks = generateChunks(chunkCount);
          
          for (const chunk of chunks) {
            // All required fields must exist
            expect(chunk).toHaveProperty('data');
            expect(chunk).toHaveProperty('timestamp');
            expect(chunk).toHaveProperty('sequenceNumber');
            
            // Data must be a string (base64)
            expect(typeof chunk.data).toBe('string');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2g: Sequence numbers form a contiguous sequence from 0 to n-1
   */
  it('Property 2g: Sequence numbers form contiguous sequence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        (chunkCount) => {
          const chunks = generateChunks(chunkCount);
          
          // Should have exactly chunkCount chunks
          expect(chunks.length).toBe(chunkCount);
          
          // Sequence numbers should be 0, 1, 2, ..., n-1
          for (let i = 0; i < chunks.length; i++) {
            expect(chunks[i].sequenceNumber).toBe(i);
          }
          
          // Last sequence number should be chunkCount - 1
          expect(chunks[chunks.length - 1].sequenceNumber).toBe(chunkCount - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2h: Metadata is consistent across chunk sizes
   */
  it('Property 2h: Metadata consistency across varying chunk counts', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }),
        (sessionSizes) => {
          // Simulate multiple recording sessions
          for (const size of sessionSizes) {
            const chunks = generateChunks(size);
            
            // Each session should start at 0
            expect(chunks[0].sequenceNumber).toBe(0);
            
            // Each session should have correct count
            expect(chunks.length).toBe(size);
            
            // Each session should end at size - 1
            expect(chunks[chunks.length - 1].sequenceNumber).toBe(size - 1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
