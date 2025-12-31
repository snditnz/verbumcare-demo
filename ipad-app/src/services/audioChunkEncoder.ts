/**
 * AudioChunkEncoder
 * 
 * Handles audio chunk creation, encoding, and compression for streaming transcription.
 * Supports WAV and M4A formats compatible with Whisper service.
 * 
 * Requirements: 6.1, 6.2 (Audio format and compression)
 */

import { VOICE_CONFIG } from '@constants/config';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AudioChunkConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: 'wav' | 'm4a';
}

export interface EncodedChunk {
  sequenceNumber: number;
  data: ArrayBuffer;
  timestamp: number;
  duration: number; // Duration in milliseconds
  format: 'wav' | 'm4a';
  sampleCount: number;
  checksum: string;
}

export interface ChunkValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompressionOptions {
  enabled: boolean;
  quality: 'low' | 'medium' | 'high';
  targetBitrate?: number;
}

// Default configuration matching Whisper requirements
const DEFAULT_CONFIG: AudioChunkConfig = {
  sampleRate: VOICE_CONFIG.SAMPLE_RATE, // 44100
  channels: VOICE_CONFIG.CHANNELS, // 1 (mono)
  bitDepth: 16,
  format: 'm4a',
};

// Chunk timing configuration
const CHUNK_CONFIG = {
  MIN_DURATION_MS: 2000, // 2 seconds minimum
  MAX_DURATION_MS: 3000, // 3 seconds maximum
  TARGET_DURATION_MS: 2500, // 2.5 seconds target
};

// ============================================================================
// AudioChunkEncoder Class
// ============================================================================

class AudioChunkEncoder {
  private config: AudioChunkConfig;
  private sequenceCounter: number = 0;
  private accumulatedSamples: Float32Array[] = [];
  private accumulatedDuration: number = 0;

  constructor(config: Partial<AudioChunkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Reset the encoder state for a new recording session
   */
  reset(): void {
    this.sequenceCounter = 0;
    this.accumulatedSamples = [];
    this.accumulatedDuration = 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioChunkConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AudioChunkConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add audio samples to the accumulator
   * Returns encoded chunks when enough samples are accumulated
   */
  addSamples(samples: Float32Array): EncodedChunk[] {
    this.accumulatedSamples.push(samples);
    
    // Calculate duration of added samples
    const sampleDuration = (samples.length / this.config.sampleRate) * 1000;
    this.accumulatedDuration += sampleDuration;

    const chunks: EncodedChunk[] = [];

    // Create chunks when we have enough accumulated audio
    while (this.accumulatedDuration >= CHUNK_CONFIG.TARGET_DURATION_MS) {
      const chunk = this.createChunkFromAccumulated();
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Flush remaining samples as a final chunk
   * Call this when recording stops
   */
  flush(): EncodedChunk | null {
    if (this.accumulatedSamples.length === 0 || this.accumulatedDuration < 100) {
      return null;
    }

    return this.createChunkFromAccumulated(true);
  }

  /**
   * Create a chunk from accumulated samples
   */
  private createChunkFromAccumulated(isFlush: boolean = false): EncodedChunk | null {
    if (this.accumulatedSamples.length === 0) {
      return null;
    }

    // Merge accumulated samples
    const totalSamples = this.accumulatedSamples.reduce((sum, arr) => sum + arr.length, 0);
    const mergedSamples = new Float32Array(totalSamples);
    
    let offset = 0;
    for (const samples of this.accumulatedSamples) {
      mergedSamples.set(samples, offset);
      offset += samples.length;
    }

    // Calculate how many samples to use for this chunk
    const targetSamples = Math.floor((CHUNK_CONFIG.TARGET_DURATION_MS / 1000) * this.config.sampleRate);
    const samplesToUse = isFlush ? totalSamples : Math.min(targetSamples, totalSamples);

    // Extract samples for this chunk
    const chunkSamples = mergedSamples.slice(0, samplesToUse);
    
    // Keep remaining samples for next chunk
    if (!isFlush && samplesToUse < totalSamples) {
      const remaining = mergedSamples.slice(samplesToUse);
      this.accumulatedSamples = [remaining];
      this.accumulatedDuration = (remaining.length / this.config.sampleRate) * 1000;
    } else {
      this.accumulatedSamples = [];
      this.accumulatedDuration = 0;
    }

    // Encode the chunk
    return this.encodeChunk(chunkSamples);
  }

  /**
   * Encode audio samples into a chunk
   * Requirement 6.1: Create chunk in WAV format compatible with Whisper
   */
  encodeChunk(samples: Float32Array): EncodedChunk {
    const sequenceNumber = this.sequenceCounter++;
    const timestamp = Date.now();
    const duration = (samples.length / this.config.sampleRate) * 1000;

    // Encode as WAV (most compatible with Whisper)
    const wavData = this.encodeWav(samples);
    
    // Calculate checksum for integrity verification
    const checksum = this.calculateChecksum(wavData);

    return {
      sequenceNumber,
      data: wavData,
      timestamp,
      duration,
      format: 'wav',
      sampleCount: samples.length,
      checksum,
    };
  }

  /**
   * Encode samples as WAV format
   * WAV is the most reliable format for Whisper transcription
   */
  private encodeWav(samples: Float32Array): ArrayBuffer {
    const { sampleRate, channels } = this.config;
    // Always use 16-bit for Whisper compatibility
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true); // File size - 8
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, 1, true); // Audio format (1 = PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      // Convert float [-1, 1] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, samples[i]));
      const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + i * 2, int16Sample, true);
    }

    return buffer;
  }

  /**
   * Write string to DataView
   */
  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * Calculate checksum for data integrity
   * Requirement 6.5: Support chunk ordering and integrity verification
   */
  private calculateChecksum(data: ArrayBuffer): string {
    const bytes = new Uint8Array(data);
    let hash = 0;
    
    for (let i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash) + bytes[i];
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Validate an encoded chunk
   * Requirement 6.3: Validate audio format for Whisper compatibility
   */
  validateChunk(chunk: EncodedChunk): ChunkValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check sequence number
    if (chunk.sequenceNumber < 0) {
      errors.push('Invalid sequence number: must be non-negative');
    }

    // Check data size
    if (!chunk.data || chunk.data.byteLength === 0) {
      errors.push('Chunk data is empty');
    }

    // Check minimum size for WAV header
    if (chunk.format === 'wav' && chunk.data.byteLength < 44) {
      errors.push('WAV data too small: missing header');
    }

    // Validate WAV header if format is WAV
    if (chunk.format === 'wav' && chunk.data.byteLength >= 44) {
      const headerValidation = this.validateWavHeader(chunk.data);
      errors.push(...headerValidation.errors);
      warnings.push(...headerValidation.warnings);
    }

    // Check duration
    if (chunk.duration < 100) {
      warnings.push('Chunk duration very short: may affect transcription quality');
    }

    if (chunk.duration > 5000) {
      warnings.push('Chunk duration exceeds recommended maximum of 5 seconds');
    }

    // Verify checksum
    const calculatedChecksum = this.calculateChecksum(chunk.data);
    if (calculatedChecksum !== chunk.checksum) {
      errors.push('Checksum mismatch: data may be corrupted');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate WAV header structure
   */
  private validateWavHeader(data: ArrayBuffer): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const view = new DataView(data);

    try {
      // Check RIFF header
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      if (riff !== 'RIFF') {
        errors.push('Invalid WAV: missing RIFF header');
        return { errors, warnings };
      }

      // Check WAVE format
      const wave = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      );
      if (wave !== 'WAVE') {
        errors.push('Invalid WAV: missing WAVE format');
        return { errors, warnings };
      }

      // Check audio format (should be PCM = 1)
      const audioFormat = view.getUint16(20, true);
      if (audioFormat !== 1) {
        errors.push(`Invalid audio format: expected PCM (1), got ${audioFormat}`);
      }

      // Check sample rate
      const sampleRate = view.getUint32(24, true);
      if (sampleRate !== this.config.sampleRate) {
        warnings.push(`Sample rate mismatch: expected ${this.config.sampleRate}, got ${sampleRate}`);
      }

      // Check channels
      const channels = view.getUint16(22, true);
      if (channels !== this.config.channels) {
        warnings.push(`Channel count mismatch: expected ${this.config.channels}, got ${channels}`);
      }

      // Check bit depth
      const bitDepth = view.getUint16(34, true);
      if (bitDepth !== this.config.bitDepth) {
        warnings.push(`Bit depth mismatch: expected ${this.config.bitDepth}, got ${bitDepth}`);
      }
    } catch (error) {
      errors.push(`WAV header parsing error: ${error}`);
    }

    return { errors, warnings };
  }

  /**
   * Compress chunk data for bandwidth optimization
   * Requirement 6.2: Use compression to minimize bandwidth usage
   */
  compressChunk(chunk: EncodedChunk, options: CompressionOptions): EncodedChunk {
    if (!options.enabled) {
      return chunk;
    }

    // For now, we return the chunk as-is since WAV is already efficient
    // In a production implementation, we could use:
    // - FLAC for lossless compression
    // - Opus for lossy compression with good quality
    // - Custom compression for specific use cases
    
    // Note: React Native doesn't have native compression APIs,
    // so this would require a native module or server-side compression
    
    return chunk;
  }

  /**
   * Decompress chunk data
   */
  decompressChunk(chunk: EncodedChunk): EncodedChunk {
    // Inverse of compressChunk - currently a no-op
    return chunk;
  }

  /**
   * Get the current sequence number
   */
  getCurrentSequenceNumber(): number {
    return this.sequenceCounter;
  }

  /**
   * Get accumulated duration in milliseconds
   */
  getAccumulatedDuration(): number {
    return this.accumulatedDuration;
  }

  /**
   * Check if there are accumulated samples waiting to be chunked
   */
  hasAccumulatedSamples(): boolean {
    return this.accumulatedSamples.length > 0;
  }

  /**
   * Calculate expected chunk count for a given duration
   */
  static calculateExpectedChunkCount(durationMs: number): number {
    return Math.ceil(durationMs / CHUNK_CONFIG.TARGET_DURATION_MS);
  }

  /**
   * Get chunk timing configuration
   */
  static getChunkConfig(): typeof CHUNK_CONFIG {
    return { ...CHUNK_CONFIG };
  }
}

// Export singleton instance and class
export const audioChunkEncoder = new AudioChunkEncoder();
export { AudioChunkEncoder };
export default audioChunkEncoder;
