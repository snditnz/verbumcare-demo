import axios from 'axios';

/**
 * Ollama Service Integration
 * Provides local LLM inference for medical data extraction
 * Optimized for Japanese medical terminology with reduced context
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

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
   * Translate Japanese structured data to English
   * @param {object} japaneseData - Structured data in Japanese
   * @returns {Promise<object>} Same structure with English translations
   */
  async translateToEnglish(japaneseData) {
    try {
      console.log('🌐 Translating structured data to English...');
      const startTime = Date.now();

      const translationPrompt = `You are a medical translator. Translate the following Japanese medical data to English.

CRITICAL RULES:
1. Preserve the exact JSON structure
2. Translate all Japanese text to English
3. Keep all field names in English (do not translate keys)
4. Medical terminology should be accurate
5. Output ONLY valid JSON

Input JSON:
${JSON.stringify(japaneseData, null, 2)}

Output the same JSON structure with all Japanese text translated to English:`;

      const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: this.modelName,
        prompt: translationPrompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.7,  // Higher temperature for better translation quality
          num_ctx: OLLAMA_NUM_CTX,
          num_thread: OLLAMA_NUM_THREAD,
          num_gpu: 1,
          top_p: 0.9,
          top_k: 40
        }
      }, {
        timeout: 120000,
        maxContentLength: 10 * 1024 * 1024
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Parse response
      let translatedData;
      try {
        const responseText = response.data.response || response.data.text || '';
        translatedData = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('⚠️  JSON parse failed, attempting cleanup...');
        const jsonMatch = response.data.response?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          translatedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to extract valid JSON from translation response');
        }
      }

      console.log(`✅ Translation completed in ${duration}s`);

      return {
        data: translatedData,
        processingTime: parseFloat(duration)
      };

    } catch (error) {
      console.error('❌ Ollama translation error:', error.message);
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
   * Get enhanced system prompt for Japanese nursing handoff documentation
   * VALIDATED PROMPT - Tested with YouTube nursing interaction data
   */
  getSystemPrompt(language) {
    const prompts = {
      'ja': `SYSTEM ROLE:
You are a clinical documentation AI. You must ALWAYS output valid JSON and nothing else.

TASK:
Convert Japanese nursing handoff transcripts into structured JSON.
- Translate all content into ENGLISH (names, statuses, observations, actions, follow-ups).
- Obey the schema exactly.
- Fill all required keys; if unknown, use null (not "").
- Do not invent information not present.

SCHEMA (must match exactly):
{
  "patients": [{ "room": "", "name": "", "status": "" }],
  "vital_signs": [{ "patient": "", "time": "", "temperature": "", "oxygen_saturation": "", "oxygen_flow": "" }],
  "observations": [""],
  "actions_taken": [""],
  "follow_up_needed": [""]
}

NORMALIZATION RULES:
- Names: romanize to English (e.g., 鞘木さん → "Sayaki-san", 竹林さん → "Takebayashi-san").
- Rooms: keep numeric strings like "502".
- Times: convert Japanese times to "HH:MM" 24h, best effort.
  • "夜中の2時20分8分" → "02:28"
  • If only hour (e.g., "15時") → "15:00"
  • If no numeric digits → null
- Temperature: "NN.N C".
  • "36度8分" → "36.8 C"
  • "7度5分" = "37.5 C"
  • Out-of-range (<30 or >42) → null
- SpO2: "NN %" or "NN–NN %".
  • "サチュ97%" → "97 %"
  • "査定症97%から6%" → "96–97 %"
- Oxygen flow: "N L/min" or "N–N L/min".
  • "酸素3リットルか2リットル" → "2–3 L/min"
- Common ASR fixes:
  • 天敵 → 点滴 (IV)
  • 気熱対応 → 解熱対応 (antipyretic care)
  • メギルート → メインルート (main IV route)
  • 査定症 → サチュ (SpO₂)
  • 送り (handoff) → shift handoff

GUARDRAILS:
- Never output Japanese characters. Translate everything to English.
- Always return JSON that can be parsed with standard JSON parsers.
- Arrays must exist even if empty.
- Deduplicate repeated or near-identical observations/actions.`,

      'en': `SYSTEM ROLE:
You are a clinical documentation AI. You must ALWAYS output valid JSON and nothing else.

TASK:
Extract structured data from nursing documentation transcripts.
- Fill all required keys; if unknown, use null (not "").
- Do not invent information not present.

SCHEMA (must match exactly):
{
  "patients": [{ "room": "", "name": "", "status": "" }],
  "vital_signs": [{ "patient": "", "time": "", "temperature": "", "oxygen_saturation": "", "oxygen_flow": "" }],
  "observations": [""],
  "actions_taken": [""],
  "follow_up_needed": [""]
}

NORMALIZATION RULES:
- Rooms: keep as strings (e.g., "502", "ICU-3")
- Times: "HH:MM" 24h format
- Temperature: "NN.N C" (valid range 30-42)
- SpO2: "NN %" or "NN–NN %"
- Oxygen flow: "N L/min" or "N–N L/min"

GUARDRAILS:
- Always return valid JSON that can be parsed.
- Arrays must exist even if empty.
- Deduplicate repeated or similar items.`,

      'zh-TW': `SYSTEM ROLE:
你是臨床文件AI。你必須始終輸出有效的JSON，不能有其他內容。

任務:
從護理交接班記錄中提取結構化數據。
- 將所有內容翻譯成英文。
- 嚴格遵守schema。
- 填寫所有必填字段；如果未知，使用null（不是""）。
- 不要編造信息。

SCHEMA (必須完全匹配):
{
  "patients": [{ "room": "", "name": "", "status": "" }],
  "vital_signs": [{ "patient": "", "time": "", "temperature": "", "oxygen_saturation": "", "oxygen_flow": "" }],
  "observations": [""],
  "actions_taken": [""],
  "follow_up_needed": [""]
}

規範化規則:
- 房間: 保持數字字符串如"502"
- 時間: "HH:MM" 24小時制
- 體溫: "NN.N C" (有效範圍30-42)
- SpO2: "NN %" 或 "NN–NN %"
- 氧氣流量: "N L/min" 或 "N–N L/min"

保護措施:
- 始終返回可解析的有效JSON。
- 數組必須存在，即使為空。
- 去重複或相似項目。`
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