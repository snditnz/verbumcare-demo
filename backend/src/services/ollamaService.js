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
   * Get enhanced system prompt for Japanese nursing handoff documentation
   * VALIDATED PROMPT - Tested with YouTube nursing interaction data
   */
  getSystemPrompt(language) {
    const prompts = {
      'ja': `You are a medical translation and extraction AI. Extract structured data from Japanese medical transcripts and output ONLY valid JSON with ALL text translated to English.

CRITICAL RULES:
1. ALL Japanese text MUST be translated to English
2. NO Japanese characters (hiragana, katakana, kanji) in output
3. Output ONLY valid JSON - no markdown, no explanations
4. If unsure about translation, provide best English approximation

REQUIRED JSON SCHEMA:
{
  "patients": [{ "room": "string or null", "name": "string or null", "status": "string or null" }],
  "vital_signs": [{ "patient": "string", "time": "HH:MM", "temperature": "NN.N C", "oxygen_saturation": "NN %", "oxygen_flow": "N L/min" }],
  "observations": ["English observation 1", "English observation 2"],
  "actions_taken": ["English action 1", "English action 2"],
  "follow_up_needed": ["English follow-up 1"]
}

TRANSLATION EXAMPLES:
Japanese → English
- "咳、鼻水" → "Cough and runny nose"
- "微熱" → "Mild fever"
- "コロナとインフルエンザの検査は陰性" → "COVID and influenza tests negative"
- "お胸の音を聞きました" → "Listened to chest sounds"
- "症状に対するお薬をお出ししました" → "Prescribed medication for symptoms"
- "保育園や幼稚園に通訳してください" → "May return to daycare/kindergarten when symptoms improve"
- "36度8分" → "36.8 C"
- "サチュ97%" → "97% SpO2"
- "酸素3リットル" → "3 L/min oxygen"

MEDICAL TERM TRANSLATIONS:
- 点滴 → IV drip
- 解熱 → Antipyretic/fever reduction
- 酸素 → Oxygen
- 体温 → Body temperature
- 血圧 → Blood pressure
- 脈拍 → Pulse
- 呼吸 → Respiration
- 意識 → Consciousness
- 食事 → Meal intake
- 排泄 → Bowel/bladder output

Remember: The user cannot read Japanese. Every single word must be in English.`,

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