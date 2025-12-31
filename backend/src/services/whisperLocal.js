import axios from 'axios';
import fs from 'fs/promises';
import FormData from 'form-data';

/**
 * Local Whisper Service Integration
 * Supports whisper.cpp server or faster-whisper HTTP API
 * Optimized for Japanese medical terminology transcription
 */

const WHISPER_URL = process.env.WHISPER_URL || 'http://localhost:8080';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'large-v3';
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'ja';

class WhisperLocalService {
  constructor() {
    this.isInitialized = false;
    this.isLoaded = false;
  }

  /**
   * Initialize Whisper service connection
   */
  async initialize() {
    try {
      const response = await axios.get(`${WHISPER_URL}/health`, { timeout: 5000 });
      this.isInitialized = response.status === 200;
      console.log('✅ Whisper service connected:', WHISPER_URL);
      return this.isInitialized;
    } catch (error) {
      console.warn('⚠️  Whisper service not available:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Pre-warm the Whisper model (loads into memory for faster first request)
   */
  async prewarm() {
    try {
      console.log(`🔥 Pre-warming Whisper ${WHISPER_MODEL}...`);
      await axios.post(`${WHISPER_URL}/load`, {
        model: WHISPER_MODEL
      }, { timeout: 30000 });

      this.isLoaded = true;
      console.log('✅ Whisper model pre-warmed and ready');
      return true;
    } catch (error) {
      console.warn('⚠️  Whisper pre-warm failed:', error.message);
      return false;
    }
  }

  /**
   * Transcribe audio file using local Whisper
   * @param {string} audioFilePath - Path to audio file
   * @param {string} language - Language code (ja, en, zh)
   * @returns {Promise<string>} Transcribed text
   */
  async transcribe(audioFilePath, language = 'ja') {
    try {
      // Check if file exists
      await fs.access(audioFilePath);

      // Read audio file
      const audioBuffer = await fs.readFile(audioFilePath);

      // Create form data
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      formData.append('language', this.mapLanguageCode(language));
      formData.append('model', WHISPER_MODEL);

      // Enhanced parameters for Japanese medical terminology
      if (language === 'ja') {
        formData.append('initial_prompt', '医療記録、バイタルサイン、看護評価');
        formData.append('temperature', '0.0'); // More deterministic for medical terms
      }

      console.log(`🎤 Transcribing audio (${language}) with ${WHISPER_MODEL}...`);
      const startTime = Date.now();

      const response = await axios.post(`${WHISPER_URL}/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 600000, // 10 minutes max for longer recordings
        maxContentLength: 100 * 1024 * 1024, // 100MB max file size for 10-min recordings
        maxBodyLength: 100 * 1024 * 1024
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Transcription completed in ${duration}s`);

      // Debug: Log the actual response
      console.log('🔍 Whisper response:', JSON.stringify(response.data, null, 2));

      // Check for error response first
      if (response.data && response.data.status === 'error') {
        console.error('❌ Whisper service error:', response.data.error);
        throw new Error(`Whisper service error: ${response.data.error}`);
      }

      // Handle different successful response formats
      if (typeof response.data === 'string') {
        const result = response.data.trim();
        console.log(`📝 Transcription result (string): "${result}"`);
        return result;
      } else if (response.data.full_text) {
        // faster-whisper format
        const result = response.data.full_text.trim();
        console.log(`📝 Transcription result (full_text): "${result}"`);
        return result;
      } else if (response.data.text) {
        const result = response.data.text.trim();
        console.log(`📝 Transcription result (text): "${result}"`);
        return result;
      } else if (response.data.transcription) {
        const result = response.data.transcription.trim();
        console.log(`📝 Transcription result (transcription): "${result}"`);
        return result;
      }

      console.error('Unknown Whisper response format:', JSON.stringify(response.data));
      throw new Error('Invalid response format from Whisper service');

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Whisper service not running at', WHISPER_URL);
        throw new Error(`Whisper service unavailable. Please start whisper server at ${WHISPER_URL}`);
      }

      console.error('❌ Whisper transcription error:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe with streaming support (for real-time feedback)
   * Returns transcription with confidence scores per segment
   * 
   * @param {string} audioFilePath - Path to audio file
   * @param {string} language - Language code (ja, en, zh)
   * @param {Function} onProgress - Callback for progress updates
   * @returns {Promise<{text: string, segments: Array, confidence: number}>}
   */
  async transcribeStream(audioFilePath, language = 'ja', onProgress) {
    try {
      // Check if file exists
      await fs.access(audioFilePath);

      // Read audio file
      const audioBuffer = await fs.readFile(audioFilePath);

      // Create form data
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      formData.append('language', this.mapLanguageCode(language));
      formData.append('model', WHISPER_MODEL);
      formData.append('response_format', 'verbose_json'); // Request detailed output

      // Enhanced parameters for Japanese medical terminology
      if (language === 'ja') {
        formData.append('initial_prompt', '医療記録、バイタルサイン、看護評価');
        formData.append('temperature', '0.0');
      }

      console.log(`🎤 Streaming transcription (${language}) with ${WHISPER_MODEL}...`);
      console.log(`🎤 Audio file size: ${audioBuffer.length} bytes`);
      const startTime = Date.now();

      const response = await axios.post(`${WHISPER_URL}/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000, // 60 seconds for streaming chunks (shorter for real-time)
        maxContentLength: 20 * 1024 * 1024, // 20MB max for streaming chunks
        maxBodyLength: 20 * 1024 * 1024
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Streaming transcription completed in ${duration}s`);

      // Parse response and extract segments with confidence
      const result = this.parseTranscriptionResponse(response.data);
      
      // Call progress callback with final result
      if (onProgress) {
        onProgress({
          text: result.text,
          confidence: result.confidence,
          isFinal: true,
          segments: result.segments
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Streaming transcription error:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio buffer directly (for streaming chunks)
   * 
   * @param {Buffer} audioBuffer - Audio data buffer
   * @param {string} language - Language code
   * @returns {Promise<{text: string, segments: Array, confidence: number}>}
   */
  async transcribeBuffer(audioBuffer, language = 'ja') {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      formData.append('language', this.mapLanguageCode(language));
      formData.append('model', WHISPER_MODEL);
      formData.append('response_format', 'verbose_json');

      // Enhanced parameters for Japanese medical terminology
      if (language === 'ja') {
        formData.append('initial_prompt', '医療記録、バイタルサイン、看護評価');
        formData.append('temperature', '0.0');
      }

      const startTime = Date.now();

      const response = await axios.post(`${WHISPER_URL}/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000, // Shorter timeout for chunks
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Buffer transcription completed in ${duration}s`);

      return this.parseTranscriptionResponse(response.data);

    } catch (error) {
      console.error('❌ Buffer transcription error:', error.message);
      throw error;
    }
  }

  /**
   * Parse transcription response and extract segments with confidence
   * 
   * @param {Object} responseData - Response from Whisper API
   * @returns {{text: string, segments: Array, confidence: number}}
   */
  parseTranscriptionResponse(responseData) {
    // Check for error response
    if (responseData && responseData.status === 'error') {
      throw new Error(`Whisper service error: ${responseData.error}`);
    }

    let text = '';
    let segments = [];
    let confidence = 0.85; // Default confidence

    // Handle different response formats
    if (typeof responseData === 'string') {
      text = responseData.trim();
      segments = [{
        id: 0,
        text: text,
        start: 0,
        end: 0,
        confidence: 0.85
      }];
    } else if (responseData.segments && Array.isArray(responseData.segments)) {
      // Verbose JSON format with segments
      segments = responseData.segments.map((seg, idx) => ({
        id: idx,
        text: seg.text?.trim() || '',
        start: seg.start || 0,
        end: seg.end || 0,
        confidence: this.calculateSegmentConfidence(seg)
      }));
      text = segments.map(s => s.text).join(' ').trim();
      
      // Calculate overall confidence from segments
      if (segments.length > 0) {
        confidence = segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length;
      }
    } else if (responseData.full_text) {
      text = responseData.full_text.trim();
      segments = [{
        id: 0,
        text: text,
        start: 0,
        end: 0,
        confidence: 0.85
      }];
    } else if (responseData.text) {
      text = responseData.text.trim();
      segments = [{
        id: 0,
        text: text,
        start: 0,
        end: 0,
        confidence: 0.85
      }];
    } else if (responseData.transcription) {
      text = responseData.transcription.trim();
      segments = [{
        id: 0,
        text: text,
        start: 0,
        end: 0,
        confidence: 0.85
      }];
    } else {
      throw new Error('Invalid response format from Whisper service');
    }

    return {
      text,
      segments,
      confidence: Math.round(confidence * 100) / 100
    };
  }

  /**
   * Calculate confidence score for a segment
   * Based on Whisper's internal metrics when available
   * 
   * @param {Object} segment - Whisper segment object
   * @returns {number} Confidence score 0-1
   */
  calculateSegmentConfidence(segment) {
    // Whisper provides various metrics we can use
    if (segment.avg_logprob !== undefined) {
      // Convert log probability to confidence (higher is better)
      // avg_logprob typically ranges from -1 to 0
      const logprob = segment.avg_logprob;
      return Math.max(0, Math.min(1, 1 + logprob));
    }
    
    if (segment.no_speech_prob !== undefined) {
      // Lower no_speech_prob means higher confidence
      return Math.max(0, Math.min(1, 1 - segment.no_speech_prob));
    }

    if (segment.confidence !== undefined) {
      return segment.confidence;
    }

    // Default confidence based on text length
    const textLength = (segment.text || '').trim().length;
    if (textLength === 0) return 0.3;
    if (textLength < 5) return 0.6;
    if (textLength < 20) return 0.75;
    return 0.85;
  }

  /**
   * Unload Whisper model from memory
   */
  async cleanup() {
    try {
      if (this.isLoaded) {
        console.log('🧹 Unloading Whisper model...');
        await axios.post(`${WHISPER_URL}/unload`, {}, { timeout: 10000 });
        this.isLoaded = false;

        // Suggest garbage collection (Node.js will decide)
        if (global.gc) {
          global.gc();
        }

        console.log('✅ Whisper model unloaded');
      }
      return true;
    } catch (error) {
      console.warn('⚠️  Whisper cleanup warning:', error.message);
      return false;
    }
  }

  /**
   * Map language codes to Whisper format
   */
  mapLanguageCode(code) {
    const languageMap = {
      'ja': 'ja',
      'en': 'en',
      'zh-TW': 'zh',
      'zh': 'zh'
    };
    return languageMap[code] || 'ja';
  }

  /**
   * Get service health status
   */
  async getHealth() {
    try {
      const response = await axios.get(`${WHISPER_URL}/health`, { timeout: 3000 });
      return {
        available: true,
        model: WHISPER_MODEL,
        url: WHISPER_URL,
        loaded: this.isLoaded,
        response: response.data
      };
    } catch (error) {
      return {
        available: false,
        model: WHISPER_MODEL,
        url: WHISPER_URL,
        loaded: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
const whisperService = new WhisperLocalService();

// Export both the class and singleton
export { WhisperLocalService };
export default whisperService;