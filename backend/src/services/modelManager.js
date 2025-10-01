import whisperService from './whisperLocal.js';
import ollamaService from './ollamaService.js';

/**
 * Model Manager - Sequential Loading for Memory Optimization
 *
 * Manages Whisper and Ollama models to prevent simultaneous loading
 * Optimizes memory usage on 8GB M2 Mac by:
 * 1. Load Whisper → Process → Unload
 * 2. Load Ollama → Process → Unload
 * 3. Never both in memory at same time
 *
 * Peak memory: ~7GB (comfortable on 8GB system)
 */

class ModelManager {
  constructor() {
    this.whisperLoaded = false;
    this.llamaLoaded = false;
    this.isProcessing = false;
    this.stats = {
      totalProcessed: 0,
      whisperTime: 0,
      llamaTime: 0,
      switchTime: 0
    };
  }

  /**
   * Initialize all AI services (check connectivity)
   */
  async initialize() {
    console.log('🚀 Initializing AI services...');

    const whisperStatus = await whisperService.initialize();
    const ollamaStatus = await ollamaService.initialize();

    const status = {
      whisper: whisperStatus,
      ollama: ollamaStatus,
      ready: whisperStatus && ollamaStatus
    };

    if (status.ready) {
      console.log('✅ All AI services initialized and ready');
    } else {
      console.warn('⚠️  Some AI services unavailable:', {
        whisper: whisperStatus ? 'OK' : 'UNAVAILABLE',
        ollama: ollamaStatus ? 'OK' : 'UNAVAILABLE'
      });
    }

    return status;
  }

  /**
   * Pre-warm models on application startup
   * Loads models into memory cache for faster first request
   */
  async prewarmModels() {
    console.log('🔥 Pre-warming AI models...');

    try {
      // Pre-warm both models (they won't stay fully loaded)
      await Promise.all([
        whisperService.prewarm(),
        ollamaService.prewarm()
      ]);

      console.log('✅ Models pre-warmed successfully');
      return true;
    } catch (error) {
      console.warn('⚠️  Model pre-warming failed:', error.message);
      return false;
    }
  }

  /**
   * Load Whisper model into memory
   */
  async loadWhisper() {
    if (this.whisperLoaded) {
      return true; // Already loaded
    }

    console.log('📥 Loading Whisper model...');
    const startTime = Date.now();

    try {
      // Ensure Llama is unloaded first
      if (this.llamaLoaded) {
        await this.unloadLlama();
      }

      await whisperService.prewarm();
      this.whisperLoaded = true;

      const loadTime = Date.now() - startTime;
      console.log(`✅ Whisper loaded in ${loadTime}ms`);

      return true;
    } catch (error) {
      console.error('❌ Failed to load Whisper:', error.message);
      this.whisperLoaded = false;
      throw error;
    }
  }

  /**
   * Unload Whisper model from memory
   */
  async unloadWhisper() {
    if (!this.whisperLoaded) {
      return true;
    }

    console.log('🧹 Unloading Whisper model...');
    const startTime = Date.now();

    try {
      await whisperService.cleanup();
      this.whisperLoaded = false;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const unloadTime = Date.now() - startTime;
      this.stats.switchTime += unloadTime;
      console.log(`✅ Whisper unloaded in ${unloadTime}ms (~2GB freed)`);

      return true;
    } catch (error) {
      console.warn('⚠️  Whisper unload warning:', error.message);
      this.whisperLoaded = false;
      return false;
    }
  }

  /**
   * Load Ollama/Llama model into memory
   */
  async loadLlama() {
    if (this.llamaLoaded) {
      return true; // Already loaded
    }

    console.log('📥 Loading Llama model...');
    const startTime = Date.now();

    try {
      // Ensure Whisper is unloaded first
      if (this.whisperLoaded) {
        await this.unloadWhisper();
      }

      await ollamaService.prewarm();
      this.llamaLoaded = true;

      const loadTime = Date.now() - startTime;
      console.log(`✅ Llama loaded in ${loadTime}ms`);

      return true;
    } catch (error) {
      console.error('❌ Failed to load Llama:', error.message);
      this.llamaLoaded = false;
      throw error;
    }
  }

  /**
   * Unload Ollama/Llama model from memory
   */
  async unloadLlama() {
    if (!this.llamaLoaded) {
      return true;
    }

    console.log('🧹 Unloading Llama model...');
    const startTime = Date.now();

    try {
      await ollamaService.unloadModel();
      this.llamaLoaded = false;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const unloadTime = Date.now() - startTime;
      this.stats.switchTime += unloadTime;
      console.log(`✅ Llama unloaded in ${unloadTime}ms (~3.5GB freed)`);

      return true;
    } catch (error) {
      console.warn('⚠️  Llama unload warning:', error.message);
      this.llamaLoaded = false;
      return false;
    }
  }

  /**
   * Process voice recording with sequential model loading
   * @param {string} audioFilePath - Path to audio file
   * @param {string} language - Language code (ja, en, zh-TW)
   * @returns {Promise<object>} Processing results
   */
  async processVoiceSequentially(audioFilePath, language = 'ja') {
    if (this.isProcessing) {
      throw new Error('Another processing request is already in progress');
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const results = {
      transcription: null,
      structuredData: null,
      confidence: null,
      timings: {}
    };

    try {
      console.log('🎬 Starting sequential voice processing...');

      // Phase 1: Whisper Transcription
      console.log('📍 Phase 1: Transcription');
      const transcribeStart = Date.now();

      await this.loadWhisper();
      results.transcription = await whisperService.transcribe(audioFilePath, language);
      await this.unloadWhisper();

      results.timings.transcription = Date.now() - transcribeStart;
      this.stats.whisperTime += results.timings.transcription;
      console.log(`✅ Phase 1 complete: ${(results.timings.transcription / 1000).toFixed(2)}s`);

      // Phase 2: Llama Structured Extraction
      console.log('📍 Phase 2: Structured Extraction');
      const extractStart = Date.now();

      await this.loadLlama();
      const extraction = await ollamaService.extractStructuredData(results.transcription, language);
      results.structuredData = extraction.data;
      results.confidence = extraction.confidence;
      await this.unloadLlama();

      results.timings.extraction = Date.now() - extractStart;
      this.stats.llamaTime += results.timings.extraction;
      console.log(`✅ Phase 2 complete: ${(results.timings.extraction / 1000).toFixed(2)}s`);

      // Total processing time
      results.timings.total = Date.now() - startTime;
      this.stats.totalProcessed++;

      console.log(`✅ Voice processing complete: ${(results.timings.total / 1000).toFixed(2)}s total`);

      return results;

    } catch (error) {
      console.error('❌ Voice processing error:', error);

      // Cleanup on error
      await this.unloadWhisper();
      await this.unloadLlama();

      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current memory and processing statistics
   */
  getStats() {
    return {
      status: {
        whisperLoaded: this.whisperLoaded,
        llamaLoaded: this.llamaLoaded,
        isProcessing: this.isProcessing
      },
      performance: {
        totalProcessed: this.stats.totalProcessed,
        avgWhisperTime: this.stats.totalProcessed > 0
          ? (this.stats.whisperTime / this.stats.totalProcessed / 1000).toFixed(2) + 's'
          : '0s',
        avgLlamaTime: this.stats.totalProcessed > 0
          ? (this.stats.llamaTime / this.stats.totalProcessed / 1000).toFixed(2) + 's'
          : '0s',
        totalSwitchTime: (this.stats.switchTime / 1000).toFixed(2) + 's'
      },
      memory: {
        estimatedPeak: this.whisperLoaded ? '~5GB (Whisper)' :
                       this.llamaLoaded ? '~7GB (Llama)' :
                       '~3.5GB (idle)',
        description: 'Sequential loading prevents simultaneous model memory usage'
      }
    };
  }

  /**
   * Get health status of all AI services
   */
  async getHealth() {
    const [whisperHealth, ollamaHealth] = await Promise.all([
      whisperService.getHealth(),
      ollamaService.getHealth()
    ]);

    return {
      whisper: whisperHealth,
      ollama: ollamaHealth,
      manager: {
        whisperLoaded: this.whisperLoaded,
        llamaLoaded: this.llamaLoaded,
        isProcessing: this.isProcessing,
        stats: this.stats
      }
    };
  }

  /**
   * Cleanup all models (for shutdown)
   */
  async cleanup() {
    console.log('🧹 Cleaning up all AI models...');

    await Promise.all([
      this.unloadWhisper(),
      this.unloadLlama()
    ]);

    console.log('✅ All models cleaned up');
  }
}

// Singleton instance
const modelManager = new ModelManager();

// Export both the class and singleton
export { ModelManager };
export default modelManager;