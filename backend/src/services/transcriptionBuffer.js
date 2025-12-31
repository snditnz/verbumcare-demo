/**
 * TranscriptionBuffer
 * 
 * Manages audio chunk buffering and ordering for streaming transcription.
 * Handles out-of-order chunk arrival and partial transcription assembly.
 * 
 * Requirements: 1.3, 6.5 (Chunk ordering and incremental processing)
 */

/**
 * Chunk entry in the buffer
 * @typedef {Object} BufferEntry
 * @property {number} sequenceNumber
 * @property {Buffer} data
 * @property {Date} receivedAt
 * @property {boolean} processed
 * @property {string|null} transcription
 * @property {number|null} confidence
 */

/**
 * Buffer statistics
 * @typedef {Object} BufferStats
 * @property {number} totalChunks
 * @property {number} processedChunks
 * @property {number} pendingChunks
 * @property {number} outOfOrderCount
 * @property {number} totalBytes
 */

class TranscriptionBuffer {
  constructor() {
    /** @type {Map<string, BufferEntry[]>} Session ID -> chunks */
    this.buffers = new Map();
    
    /** @type {Map<string, number>} Session ID -> expected next sequence */
    this.expectedSequence = new Map();
    
    /** @type {Map<string, number>} Session ID -> out of order count */
    this.outOfOrderCounts = new Map();
  }

  /**
   * Initialize buffer for a new session
   * @param {string} sessionId
   */
  initSession(sessionId) {
    this.buffers.set(sessionId, []);
    this.expectedSequence.set(sessionId, 0);
    this.outOfOrderCounts.set(sessionId, 0);
  }

  /**
   * Add a chunk to the buffer
   * Requirement 6.5: Reorder chunks using sequence numbers
   * 
   * @param {string} sessionId
   * @param {Object} chunk
   * @param {number} chunk.sequenceNumber
   * @param {Buffer|ArrayBuffer} chunk.data
   * @returns {{added: boolean, outOfOrder: boolean, gap: number}}
   */
  addChunk(sessionId, chunk) {
    let buffer = this.buffers.get(sessionId);
    if (!buffer) {
      this.initSession(sessionId);
      buffer = this.buffers.get(sessionId);
    }

    const expectedSeq = this.expectedSequence.get(sessionId) || 0;
    const isOutOfOrder = chunk.sequenceNumber !== expectedSeq;
    const gap = chunk.sequenceNumber - expectedSeq;

    // Track out-of-order arrivals
    if (isOutOfOrder && chunk.sequenceNumber > expectedSeq) {
      const currentCount = this.outOfOrderCounts.get(sessionId) || 0;
      this.outOfOrderCounts.set(sessionId, currentCount + 1);
    }

    // Create buffer entry
    const entry = {
      sequenceNumber: chunk.sequenceNumber,
      data: Buffer.from(chunk.data),
      receivedAt: new Date(),
      processed: false,
      transcription: null,
      confidence: null,
    };

    // Insert in sorted order by sequence number
    const insertIndex = this.findInsertIndex(buffer, chunk.sequenceNumber);
    buffer.splice(insertIndex, 0, entry);

    // Update expected sequence if this was the expected chunk
    if (chunk.sequenceNumber === expectedSeq) {
      // Find the next gap in sequence
      let nextExpected = expectedSeq + 1;
      for (const entry of buffer) {
        if (entry.sequenceNumber === nextExpected) {
          nextExpected++;
        } else if (entry.sequenceNumber > nextExpected) {
          break;
        }
      }
      this.expectedSequence.set(sessionId, nextExpected);
    }

    return {
      added: true,
      outOfOrder: isOutOfOrder,
      gap: Math.max(0, gap),
    };
  }

  /**
   * Find the correct insertion index for sorted order
   * @param {BufferEntry[]} buffer
   * @param {number} sequenceNumber
   * @returns {number}
   */
  findInsertIndex(buffer, sequenceNumber) {
    let low = 0;
    let high = buffer.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (buffer[mid].sequenceNumber < sequenceNumber) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /**
   * Get chunks ready for processing (in order, no gaps)
   * @param {string} sessionId
   * @param {number} [maxChunks=5] - Maximum chunks to return
   * @returns {BufferEntry[]}
   */
  getReadyChunks(sessionId, maxChunks = 5) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer || buffer.length === 0) return [];

    const readyChunks = [];
    let expectedSeq = 0;

    // Find first unprocessed chunk
    for (const entry of buffer) {
      if (!entry.processed) {
        expectedSeq = entry.sequenceNumber;
        break;
      }
    }

    // Collect consecutive unprocessed chunks
    for (const entry of buffer) {
      if (entry.processed) continue;
      
      if (entry.sequenceNumber === expectedSeq) {
        readyChunks.push(entry);
        expectedSeq++;
        
        if (readyChunks.length >= maxChunks) break;
      } else if (entry.sequenceNumber > expectedSeq) {
        // Gap detected, stop here
        break;
      }
    }

    return readyChunks;
  }

  /**
   * Get all unprocessed chunks (may have gaps)
   * @param {string} sessionId
   * @returns {BufferEntry[]}
   */
  getAllUnprocessedChunks(sessionId) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer) return [];

    return buffer.filter(entry => !entry.processed);
  }

  /**
   * Mark chunks as processed and store transcription
   * @param {string} sessionId
   * @param {number[]} sequenceNumbers
   * @param {string} transcription
   * @param {number} confidence
   */
  markProcessed(sessionId, sequenceNumbers, transcription, confidence) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer) return;

    // Distribute transcription across chunks (simplified)
    const textPerChunk = transcription.length / sequenceNumbers.length;

    for (const entry of buffer) {
      if (sequenceNumbers.includes(entry.sequenceNumber)) {
        entry.processed = true;
        entry.confidence = confidence;
        
        // Store portion of transcription (for debugging/recovery)
        const index = sequenceNumbers.indexOf(entry.sequenceNumber);
        const start = Math.floor(index * textPerChunk);
        const end = Math.floor((index + 1) * textPerChunk);
        entry.transcription = transcription.substring(start, end);
      }
    }
  }

  /**
   * Get assembled transcription from all processed chunks
   * @param {string} sessionId
   * @returns {string}
   */
  getAssembledTranscription(sessionId) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer) return '';

    // Sort by sequence number and concatenate transcriptions
    const sortedProcessed = buffer
      .filter(entry => entry.processed && entry.transcription)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    return sortedProcessed.map(entry => entry.transcription).join('');
  }

  /**
   * Get combined audio data from chunks
   * @param {string} sessionId
   * @param {number[]} [sequenceNumbers] - Specific sequences, or all if not provided
   * @returns {Buffer}
   */
  getCombinedAudio(sessionId, sequenceNumbers = null) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer) return Buffer.alloc(0);

    let chunks = buffer;
    if (sequenceNumbers) {
      chunks = buffer.filter(entry => sequenceNumbers.includes(entry.sequenceNumber));
    }

    // Sort by sequence number
    chunks = [...chunks].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Calculate total size
    const totalSize = chunks.reduce((sum, entry) => sum + entry.data.length, 0);
    
    // Combine buffers
    const combined = Buffer.alloc(totalSize);
    let offset = 0;
    
    for (const entry of chunks) {
      entry.data.copy(combined, offset);
      offset += entry.data.length;
    }

    return combined;
  }

  /**
   * Check if there are gaps in the sequence
   * @param {string} sessionId
   * @returns {{hasGaps: boolean, missingSequences: number[]}}
   */
  checkForGaps(sessionId) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer || buffer.length === 0) {
      return { hasGaps: false, missingSequences: [] };
    }

    const sequences = buffer.map(entry => entry.sequenceNumber).sort((a, b) => a - b);
    const missingSequences = [];

    for (let i = 0; i < sequences.length - 1; i++) {
      const current = sequences[i];
      const next = sequences[i + 1];
      
      for (let missing = current + 1; missing < next; missing++) {
        missingSequences.push(missing);
      }
    }

    return {
      hasGaps: missingSequences.length > 0,
      missingSequences,
    };
  }

  /**
   * Get buffer statistics
   * @param {string} sessionId
   * @returns {BufferStats}
   */
  getStats(sessionId) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer) {
      return {
        totalChunks: 0,
        processedChunks: 0,
        pendingChunks: 0,
        outOfOrderCount: 0,
        totalBytes: 0,
      };
    }

    const processedChunks = buffer.filter(entry => entry.processed).length;
    const totalBytes = buffer.reduce((sum, entry) => sum + entry.data.length, 0);

    return {
      totalChunks: buffer.length,
      processedChunks,
      pendingChunks: buffer.length - processedChunks,
      outOfOrderCount: this.outOfOrderCounts.get(sessionId) || 0,
      totalBytes,
    };
  }

  /**
   * Clear buffer for a session
   * @param {string} sessionId
   * @returns {BufferStats} Final stats before clearing
   */
  clearSession(sessionId) {
    const stats = this.getStats(sessionId);
    
    this.buffers.delete(sessionId);
    this.expectedSequence.delete(sessionId);
    this.outOfOrderCounts.delete(sessionId);

    return stats;
  }

  /**
   * Get all active session IDs
   * @returns {string[]}
   */
  getActiveSessions() {
    return Array.from(this.buffers.keys());
  }

  /**
   * Cleanup old entries from buffer (memory management)
   * @param {string} sessionId
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {number} Number of entries removed
   */
  cleanupOldEntries(sessionId, maxAge = 300000) {
    const buffer = this.buffers.get(sessionId);
    if (!buffer) return 0;

    const now = Date.now();
    const initialLength = buffer.length;

    // Remove old processed entries
    const filtered = buffer.filter(entry => {
      if (!entry.processed) return true;
      const age = now - entry.receivedAt.getTime();
      return age < maxAge;
    });

    this.buffers.set(sessionId, filtered);
    return initialLength - filtered.length;
  }
}

// Singleton instance
const transcriptionBuffer = new TranscriptionBuffer();

export { TranscriptionBuffer };
export default transcriptionBuffer;
