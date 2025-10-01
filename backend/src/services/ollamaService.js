import axios from 'axios';

/**
 * Ollama Service Integration
 * Provides local LLM inference for medical data extraction
 * Optimized for Japanese medical terminology with reduced context
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3:8b-q4_K_M';

// Reduced context window for medical extraction (saves memory)
const OLLAMA_NUM_CTX = parseInt(process.env.OLLAMA_NUM_CTX || '2048');
const OLLAMA_NUM_THREAD = parseInt(process.env.OLLAMA_NUM_THREAD || '8');
const OLLAMA_TEMPERATURE = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.1');

class OllamaService {
  constructor() {
    this.isInitialized = false;
    this.isLoaded = false;
    this.modelName = OLLAMA_MODEL;
  }

  /**
   * Initialize Ollama service connection
   */
  async initialize() {
    try {
      const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
      this.isInitialized = response.status === 200;

      // Check if our model is available
      const models = response.data.models || [];
      const modelAvailable = models.some(m => m.name.includes('llama3'));

      if (!modelAvailable) {
        console.warn(`⚠️  Model ${OLLAMA_MODEL} not found. Available:`, models.map(m => m.name));
      }

      console.log('✅ Ollama service connected:', OLLAMA_URL);
      return this.isInitialized;
    } catch (error) {
      console.warn('⚠️  Ollama service not available:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Pre-warm the model (loads into memory)
   */
  async prewarm() {
    try {
      console.log(`🔥 Pre-warming Ollama ${OLLAMA_MODEL}...`);

      // Send a minimal request to load model into memory
      await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: OLLAMA_MODEL,
        prompt: 'Hello',
        stream: false,
        options: {
          num_ctx: OLLAMA_NUM_CTX,
          num_thread: OLLAMA_NUM_THREAD
        }
      }, { timeout: 60000 });

      this.isLoaded = true;
      console.log('✅ Ollama model pre-warmed and ready');
      return true;
    } catch (error) {
      console.warn('⚠️  Ollama pre-warm failed:', error.message);
      return false;
    }
  }

  /**
   * Load model explicitly into memory
   */
  async loadModel(modelName = OLLAMA_MODEL) {
    try {
      console.log(`📥 Loading model: ${modelName}...`);

      const response = await axios.post(`${OLLAMA_URL}/api/pull`, {
        name: modelName,
        stream: false
      }, { timeout: 300000 }); // 5 min timeout for download if needed

      this.modelName = modelName;
      this.isLoaded = true;
      console.log(`✅ Model ${modelName} loaded`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to load model ${modelName}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract structured medical data from transcription text
   * @param {string} transcriptionText - Free-text transcription from Whisper
   * @param {string} language - Language code (ja, en, zh-TW)
   * @returns {Promise<object>} Structured medical data with confidence score
   */
  async extractStructuredData(transcriptionText, language = 'ja') {
    try {
      const systemPrompt = this.getSystemPrompt(language);
      const fullPrompt = `${systemPrompt}\n\nTranscription:\n${transcriptionText}\n\nExtracted Data (JSON only):`;

      console.log(`🤖 Extracting structured data (${language})...`);
      const startTime = Date.now();

      const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: this.modelName,
        prompt: fullPrompt,
        stream: false,
        format: 'json', // Request JSON output
        options: {
          temperature: OLLAMA_TEMPERATURE,
          num_ctx: OLLAMA_NUM_CTX,
          num_thread: OLLAMA_NUM_THREAD,
          num_gpu: 1, // Use Metal GPU on Mac
          top_p: 0.9,
          top_k: 40
        }
      }, {
        timeout: 120000, // 2 minutes max
        maxContentLength: 10 * 1024 * 1024 // 10MB max
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Extraction completed in ${duration}s`);

      // Parse response
      let extractedData;
      try {
        const responseText = response.data.response || response.data.text || '';
        extractedData = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('⚠️  JSON parse failed, attempting cleanup...');
        // Try to extract JSON from response
        const jsonMatch = response.data.response?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to extract valid JSON from LLM response');
        }
      }

      // Calculate confidence score
      const confidence = this.calculateConfidence(extractedData, transcriptionText);

      return {
        data: extractedData,
        confidence,
        processingTime: parseFloat(duration),
        model: this.modelName
      };

    } catch (error) {
      console.error('❌ Ollama extraction error:', error.message);
      throw error;
    }
  }

  /**
   * Generate chat completion (for future use)
   */
  async chat(messages, options = {}) {
    try {
      const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
        model: this.modelName,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || OLLAMA_TEMPERATURE,
          num_ctx: options.num_ctx || OLLAMA_NUM_CTX,
          num_thread: OLLAMA_NUM_THREAD,
          num_gpu: 1
        }
      }, { timeout: 120000 });

      return response.data.message?.content || response.data.response;
    } catch (error) {
      console.error('❌ Ollama chat error:', error.message);
      throw error;
    }
  }

  /**
   * Unload model from memory
   */
  async unloadModel() {
    try {
      if (this.isLoaded) {
        console.log('🧹 Unloading Ollama model...');

        // Ollama doesn't have explicit unload, but we can clear context
        // The OS will swap out memory if needed
        this.isLoaded = false;

        // Suggest garbage collection
        if (global.gc) {
          global.gc();
        }

        console.log('✅ Ollama model marked for unload');
      }
      return true;
    } catch (error) {
      console.warn('⚠️  Ollama unload warning:', error.message);
      return false;
    }
  }

  /**
   * Get enhanced system prompt for Japanese medical extraction
   */
  getSystemPrompt(language) {
    const prompts = {
      'ja': `あなたは日本の医療現場に特化したデータ抽出システムです。
看護記録から正確な医療情報をJSON形式で抽出してください。

日本の医療用語と単位系:
- 血圧: mmHg (収縮期/拡張期) 例: 120/80
- 脈拍: bpm 例: 72
- 体温: ℃ (摂氏) 例: 36.5
- 呼吸数: 回/分 例: 16
- SpO2: % 例: 98
- 疼痛スケール: 0-10 (NRS)

曖昧な表現の解釈:
- "少し高め" → 正常範囲の上限付近
- "普通" → 正常範囲の中央値
- "やや低い" → 正常範囲の下限付近

必須JSON構造:
{
  "vitals": {
    "blood_pressure": {"systolic": number, "diastolic": number},
    "heart_rate": number,
    "temperature": number,
    "respiratory_rate": number,
    "oxygen_saturation": number
  },
  "pain": {"present": boolean, "location": string, "intensity": number, "character": string},
  "nutrition": {"intake_percent": number, "appetite": string},
  "sleep": {"quality": string, "hours": number},
  "wound": {"present": boolean, "location": string, "stage": number, "size_cm": number, "description": string},
  "consciousness": {"level": string, "orientation": {"person": boolean, "place": boolean, "time": boolean}},
  "mobility": {"status": string, "assistance_required": boolean}
}

明示的に言及されていない項目はnullを使用してください。`,

      'en': `You are a medical data extraction system specialized for nursing documentation.
Extract accurate medical information in JSON format.

Medical terminology and units:
- Blood pressure: mmHg (systolic/diastolic) e.g., 120/80
- Heart rate: bpm e.g., 72
- Temperature: °C e.g., 36.5
- Respiratory rate: breaths/min e.g., 16
- SpO2: % e.g., 98
- Pain scale: 0-10 (NRS)

Required JSON structure:
{
  "vitals": {"blood_pressure": {"systolic": number, "diastolic": number}, "heart_rate": number, "temperature": number, "respiratory_rate": number, "oxygen_saturation": number},
  "pain": {"present": boolean, "location": string, "intensity": number, "character": string},
  "nutrition": {"intake_percent": number, "appetite": string},
  "sleep": {"quality": string, "hours": number},
  "wound": {"present": boolean, "location": string, "stage": number, "size_cm": number, "description": string},
  "consciousness": {"level": string, "orientation": {"person": boolean, "place": boolean, "time": boolean}},
  "mobility": {"status": string, "assistance_required": boolean}
}

Use null for fields not explicitly mentioned.`,

      'zh-TW': `您是專門用於護理記錄的醫療數據提取系統。
以JSON格式提取準確的醫療信息。

醫療術語和單位:
- 血壓: mmHg (收縮壓/舒張壓) 例: 120/80
- 心率: bpm 例: 72
- 體溫: ℃ 例: 36.5
- 呼吸率: 次/分 例: 16
- SpO2: % 例: 98
- 疼痛量表: 0-10 (NRS)

必需的JSON結構:
{
  "vitals": {"blood_pressure": {"systolic": number, "diastolic": number}, "heart_rate": number, "temperature": number, "respiratory_rate": number, "oxygen_saturation": number},
  "pain": {"present": boolean, "location": string, "intensity": number, "character": string},
  "nutrition": {"intake_percent": number, "appetite": string},
  "sleep": {"quality": string, "hours": number},
  "wound": {"present": boolean, "location": string, "stage": number, "size_cm": number, "description": string},
  "consciousness": {"level": string, "orientation": {"person": boolean, "place": boolean, "time": boolean}},
  "mobility": {"status": string, "assistance_required": boolean}
}

未明確提及的字段請使用null。`
    };

    return prompts[language] || prompts['en'];
  }

  /**
   * Calculate confidence score based on data completeness and validity
   */
  calculateConfidence(extractedData, originalText) {
    let score = 0.5; // Base score

    // Check data completeness
    let filledFields = 0;
    let totalFields = 0;

    const countFields = (obj) => {
      for (const value of Object.values(obj)) {
        totalFields++;
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            countFields(value);
          } else {
            filledFields++;
          }
        }
      }
    };

    if (extractedData) {
      countFields(extractedData);
      score = filledFields / Math.max(totalFields, 1);
    }

    // Boost confidence if text length suggests detailed documentation
    if (originalText && originalText.length > 100) {
      score = Math.min(0.95, score + 0.1);
    }

    // Cap confidence at 92% for local model
    return Math.min(0.92, Math.max(0.6, score));
  }

  /**
   * Get service health status
   */
  async getHealth() {
    try {
      const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
      const models = response.data.models || [];

      return {
        available: true,
        model: this.modelName,
        url: OLLAMA_URL,
        loaded: this.isLoaded,
        availableModels: models.map(m => m.name),
        config: {
          num_ctx: OLLAMA_NUM_CTX,
          num_thread: OLLAMA_NUM_THREAD,
          temperature: OLLAMA_TEMPERATURE
        }
      };
    } catch (error) {
      return {
        available: false,
        model: this.modelName,
        url: OLLAMA_URL,
        loaded: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
const ollamaService = new OllamaService();

// Export both the class and singleton
export { OllamaService };
export default ollamaService;