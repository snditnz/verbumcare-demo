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
        timeout: 120000, // 2 minutes max
        maxContentLength: 50 * 1024 * 1024, // 50MB max file size
        maxBodyLength: 50 * 1024 * 1024
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Transcription completed in ${duration}s`);

      // Handle different response formats
      if (typeof response.data === 'string') {
        return response.data.trim();
      } else if (response.data.full_text) {
        // faster-whisper format
        return response.data.full_text.trim();
      } else if (response.data.text) {
        return response.data.text.trim();
      } else if (response.data.transcription) {
        return response.data.transcription.trim();
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
   */
  async transcribeStream(audioFilePath, language = 'ja', onProgress) {
    // For future implementation with streaming support
    // Currently returns full transcription
    return this.transcribe(audioFilePath, language);
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