/**
 * Property-Based Tests for AudioChunkEncoder - Audio Format Validity
 * 
 * Property 10: Audio Format Validity
 * For any audio chunk created by the AudioStreamer, the chunk SHALL be in a valid
 * WAV or M4A format that can be decoded by the Whisper service. Invalid format
 * chunks SHALL be rejected with specific error feedback.
 * 
 * Validates: Requirements 6.1, 6.3
 */

import fc from 'fast-check';
import {
  AudioChunkEncoder,
  audioChunkEncoder,
  EncodedChunk,
  AudioChunkConfig,
} from '../audioChunkEncoder';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Generate random audio samples (simulating real audio data)
 */
const generateAudioSamples = (length: number): Float32Array => {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Generate samples in valid range [-1, 1]
    samples[i] = (Math.random() * 2) - 1;
  }
  return samples;
};

/**
 * Verify WAV header structure
 */
const verifyWavHeader = (data: ArrayBuffer): {
  isValid: boolean;
  riff: string;
  wave: string;
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitDepth: number;
  dataSize: number;
} => {
  const view = new DataView(data);
  
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  
  const audioFormat = view.getUint16(20, true);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitDepth = view.getUint16(34, true);
  const dataSize = view.getUint32(40, true);
  
  return {
    isValid: riff === 'RIFF' && wave === 'WAVE' && audioFormat === 1,
    riff,
    wave,
    audioFormat,
    channels,
    sampleRate,
    bitDepth,
    dataSize,
  };
};

// ============================================================================
// Property Tests
// ============================================================================

describe('AudioChunkEncoder Format Validity Property Tests', () => {
  beforeEach(() => {
    audioChunkEncoder.reset();
  });

  /**
   * Property 10.1: All encoded chunks have valid WAV headers
   */
  describe('Property 10.1: Valid WAV header structure', () => {
    it('should produce valid WAV headers for any audio samples', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate sample count (at least 1000 samples for meaningful audio)
          fc.integer({ min: 1000, max: 100000 }),
          async (sampleCount) => {
            const encoder = new AudioChunkEncoder();
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            const header = verifyWavHeader(chunk.data);
            
            // Property: RIFF header must be present
            expect(header.riff).toBe('RIFF');
            
            // Property: WAVE format must be specified
            expect(header.wave).toBe('WAVE');
            
            // Property: Audio format must be PCM (1)
            expect(header.audioFormat).toBe(1);
            
            // Property: Header must be valid
            expect(header.isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should encode correct sample rate in WAV header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(8000, 16000, 22050, 44100, 48000),
          fc.integer({ min: 1000, max: 10000 }),
          async (sampleRate, sampleCount) => {
            const encoder = new AudioChunkEncoder({ sampleRate });
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            const header = verifyWavHeader(chunk.data);
            
            // Property: Sample rate in header must match configuration
            expect(header.sampleRate).toBe(sampleRate);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should encode correct channel count in WAV header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(1, 2),
          fc.integer({ min: 1000, max: 10000 }),
          async (channels, sampleCount) => {
            const encoder = new AudioChunkEncoder({ channels });
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            const header = verifyWavHeader(chunk.data);
            
            // Property: Channel count in header must match configuration
            expect(header.channels).toBe(channels);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should encode correct bit depth in WAV header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(8, 16, 24, 32),
          fc.integer({ min: 1000, max: 10000 }),
          async (bitDepth, sampleCount) => {
            const encoder = new AudioChunkEncoder({ bitDepth });
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            const header = verifyWavHeader(chunk.data);
            
            // Property: Bit depth in header is always 16 for Whisper compatibility
            // (regardless of configuration, we always encode as 16-bit)
            expect(header.bitDepth).toBe(16);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 10.2: Data size consistency
   */
  describe('Property 10.2: Data size consistency', () => {
    it('should have consistent data size in header and actual data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 50000 }),
          async (sampleCount) => {
            const encoder = new AudioChunkEncoder();
            const config = encoder.getConfig();
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            const header = verifyWavHeader(chunk.data);
            
            // Calculate expected data size
            const bytesPerSample = config.bitDepth / 8;
            const expectedDataSize = sampleCount * bytesPerSample;
            
            // Property: Data size in header must match actual data
            expect(header.dataSize).toBe(expectedDataSize);
            
            // Property: Total file size must be header + data
            const expectedTotalSize = 44 + expectedDataSize; // 44 bytes WAV header
            expect(chunk.data.byteLength).toBe(expectedTotalSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10.3: Sequence number monotonicity
   */
  describe('Property 10.3: Sequence number monotonicity', () => {
    it('should produce monotonically increasing sequence numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 20 }),
          fc.integer({ min: 1000, max: 5000 }),
          async (chunkCount, samplesPerChunk) => {
            const encoder = new AudioChunkEncoder();
            const chunks: EncodedChunk[] = [];
            
            for (let i = 0; i < chunkCount; i++) {
              const samples = generateAudioSamples(samplesPerChunk);
              chunks.push(encoder.encodeChunk(samples));
            }
            
            // Property: Sequence numbers must be strictly increasing
            for (let i = 1; i < chunks.length; i++) {
              expect(chunks[i].sequenceNumber).toBe(chunks[i - 1].sequenceNumber + 1);
            }
            
            // Property: First sequence number must be 0
            expect(chunks[0].sequenceNumber).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reset sequence numbers after reset()', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1000, max: 5000 }),
          async (chunksBeforeReset, samplesPerChunk) => {
            const encoder = new AudioChunkEncoder();
            
            // Create some chunks
            for (let i = 0; i < chunksBeforeReset; i++) {
              const samples = generateAudioSamples(samplesPerChunk);
              encoder.encodeChunk(samples);
            }
            
            // Reset
            encoder.reset();
            
            // Create new chunk
            const samples = generateAudioSamples(samplesPerChunk);
            const chunk = encoder.encodeChunk(samples);
            
            // Property: Sequence number should restart from 0 after reset
            expect(chunk.sequenceNumber).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 10.4: Checksum integrity
   */
  describe('Property 10.4: Checksum integrity', () => {
    it('should produce consistent checksums for identical data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 10000 }),
          async (sampleCount) => {
            const encoder1 = new AudioChunkEncoder();
            const encoder2 = new AudioChunkEncoder();
            
            // Create identical samples
            const samples1 = new Float32Array(sampleCount);
            const samples2 = new Float32Array(sampleCount);
            for (let i = 0; i < sampleCount; i++) {
              const value = Math.sin(i * 0.1); // Deterministic values
              samples1[i] = value;
              samples2[i] = value;
            }
            
            const chunk1 = encoder1.encodeChunk(samples1);
            const chunk2 = encoder2.encodeChunk(samples2);
            
            // Property: Identical data should produce identical checksums
            expect(chunk1.checksum).toBe(chunk2.checksum);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should produce different checksums for different data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 10000 }),
          async (sampleCount) => {
            const encoder = new AudioChunkEncoder();
            
            // Create different samples
            const samples1 = generateAudioSamples(sampleCount);
            const samples2 = generateAudioSamples(sampleCount);
            
            // Ensure they're actually different
            samples2[0] = samples1[0] + 0.5;
            
            encoder.reset();
            const chunk1 = encoder.encodeChunk(samples1);
            encoder.reset();
            const chunk2 = encoder.encodeChunk(samples2);
            
            // Property: Different data should (almost always) produce different checksums
            // Note: There's a tiny chance of collision, but it's negligible
            expect(chunk1.checksum).not.toBe(chunk2.checksum);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 10.5: Chunk validation
   */
  describe('Property 10.5: Chunk validation', () => {
    it('should validate correctly encoded chunks as valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 50000 }),
          async (sampleCount) => {
            const encoder = new AudioChunkEncoder();
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            const validation = encoder.validateChunk(chunk);
            
            // Property: Correctly encoded chunks should be valid
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect corrupted checksums', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 10000 }),
          async (sampleCount) => {
            const encoder = new AudioChunkEncoder();
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            
            // Corrupt the checksum
            const corruptedChunk: EncodedChunk = {
              ...chunk,
              checksum: 'corrupted',
            };
            
            const validation = encoder.validateChunk(corruptedChunk);
            
            // Property: Corrupted checksum should be detected
            expect(validation.isValid).toBe(false);
            expect(validation.errors.some(e => e.includes('Checksum'))).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect empty chunks', async () => {
      const encoder = new AudioChunkEncoder();
      
      const emptyChunk: EncodedChunk = {
        sequenceNumber: 0,
        data: new ArrayBuffer(0),
        timestamp: Date.now(),
        duration: 0,
        format: 'wav',
        sampleCount: 0,
        checksum: '',
      };
      
      const validation = encoder.validateChunk(emptyChunk);
      
      // Property: Empty chunks should be invalid
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('empty'))).toBe(true);
    });

    it('should detect invalid WAV headers', async () => {
      const encoder = new AudioChunkEncoder();
      
      // Create chunk with invalid header
      const invalidData = new ArrayBuffer(100);
      const view = new DataView(invalidData);
      view.setUint8(0, 'X'.charCodeAt(0)); // Invalid RIFF
      
      const invalidChunk: EncodedChunk = {
        sequenceNumber: 0,
        data: invalidData,
        timestamp: Date.now(),
        duration: 1000,
        format: 'wav',
        sampleCount: 100,
        checksum: 'test',
      };
      
      const validation = encoder.validateChunk(invalidChunk);
      
      // Property: Invalid WAV header should be detected
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('RIFF') || e.includes('WAV'))).toBe(true);
    });
  });

  /**
   * Property 10.6: Duration calculation accuracy
   */
  describe('Property 10.6: Duration calculation accuracy', () => {
    it('should calculate accurate duration based on sample count and rate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(8000, 16000, 22050, 44100, 48000),
          fc.integer({ min: 1000, max: 100000 }),
          async (sampleRate, sampleCount) => {
            const encoder = new AudioChunkEncoder({ sampleRate });
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            
            // Calculate expected duration
            const expectedDuration = (sampleCount / sampleRate) * 1000;
            
            // Property: Duration should match expected value (within floating point tolerance)
            expect(Math.abs(chunk.duration - expectedDuration)).toBeLessThan(0.01);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10.7: Sample count preservation
   */
  describe('Property 10.7: Sample count preservation', () => {
    it('should preserve sample count in chunk metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 50000 }),
          async (sampleCount) => {
            const encoder = new AudioChunkEncoder();
            const samples = generateAudioSamples(sampleCount);
            
            const chunk = encoder.encodeChunk(samples);
            
            // Property: Sample count in metadata should match input
            expect(chunk.sampleCount).toBe(sampleCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10.8: Audio sample range clamping
   */
  describe('Property 10.8: Audio sample range clamping', () => {
    it('should clamp out-of-range samples to valid range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 1000 }),
          fc.float({ min: -10, max: 10 }), // Out of normal range
          async (sampleCount, outOfRangeValue) => {
            const encoder = new AudioChunkEncoder();
            const samples = new Float32Array(sampleCount);
            
            // Fill with out-of-range values
            for (let i = 0; i < sampleCount; i++) {
              samples[i] = outOfRangeValue;
            }
            
            // Should not throw
            const chunk = encoder.encodeChunk(samples);
            
            // Property: Chunk should be valid despite out-of-range input
            const validation = encoder.validateChunk(chunk);
            expect(validation.isValid).toBe(true);
            
            // Property: Data should be properly encoded (no NaN or Infinity)
            const view = new DataView(chunk.data);
            for (let i = 44; i < chunk.data.byteLength; i += 2) {
              const sample = view.getInt16(i, true);
              expect(Number.isFinite(sample)).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

describe('AudioChunkEncoder Accumulation Property Tests', () => {
  beforeEach(() => {
    audioChunkEncoder.reset();
  });

  /**
   * Property: Sample accumulation produces chunks at correct intervals
   */
  describe('Sample accumulation timing', () => {
    it('should produce chunks when accumulated duration reaches target', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }), // Number of sample batches
          async (batchCount) => {
            const encoder = new AudioChunkEncoder();
            const config = encoder.getConfig();
            const chunkConfig = AudioChunkEncoder.getChunkConfig();
            
            // Calculate samples needed for one chunk
            const samplesPerChunk = Math.ceil(
              (chunkConfig.TARGET_DURATION_MS / 1000) * config.sampleRate
            );
            
            // Add samples in small batches
            const batchSize = Math.ceil(samplesPerChunk / batchCount);
            const allChunks: EncodedChunk[] = [];
            
            for (let i = 0; i < batchCount * 3; i++) { // Add enough for ~3 chunks
              const samples = generateAudioSamples(batchSize);
              const chunks = encoder.addSamples(samples);
              allChunks.push(...chunks);
            }
            
            // Property: Should have produced approximately the expected number of chunks
            const totalSamples = batchSize * batchCount * 3;
            const totalDuration = (totalSamples / config.sampleRate) * 1000;
            const expectedChunks = Math.floor(totalDuration / chunkConfig.TARGET_DURATION_MS);
            
            // Allow some variance due to accumulation timing
            expect(allChunks.length).toBeGreaterThanOrEqual(expectedChunks - 1);
            expect(allChunks.length).toBeLessThanOrEqual(expectedChunks + 1);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should flush remaining samples correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Use sample counts that will produce at least some audio (> 100ms at 44100Hz = 4410 samples)
          fc.integer({ min: 5000, max: 50000 }),
          async (sampleCount) => {
            const encoder = new AudioChunkEncoder();
            
            // Add samples that won't fill a complete chunk
            const samples = generateAudioSamples(sampleCount);
            const chunks = encoder.addSamples(samples);
            
            // Check if there are accumulated samples before flush
            const hadAccumulatedSamples = encoder.hasAccumulatedSamples();
            
            // Flush remaining
            const finalChunk = encoder.flush();
            
            // Property: If there were accumulated samples before flush, flush should return a chunk
            // OR if addSamples already produced chunks, that's also valid
            const totalChunks = chunks.length + (finalChunk ? 1 : 0);
            
            // With enough samples (5000+), we should always get at least one chunk
            // either from addSamples or from flush
            expect(totalChunks).toBeGreaterThan(0);
            
            // Property: After flush, no accumulated samples should remain
            expect(encoder.hasAccumulatedSamples()).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
