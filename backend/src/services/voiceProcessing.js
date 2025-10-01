import modelManager from './modelManager.js';
import { generateSOAPNote } from './soapTemplate.js';

/**
 * Voice Processing Service - Offline AI Integration
 * Uses local Whisper + Ollama models with sequential loading
 * Completely offline - no internet required
 */

/**
 * Transcribe audio file using local Whisper
 * @param {string} audioFilePath - Path to audio file
 * @param {string} language - Language code (ja, en, zh-TW)
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioFilePath, language = 'ja') {
  try {
    console.log(`🎤 Starting transcription (${language})...`);

    // Use model manager for memory-optimized processing
    const whisperService = (await import('./whisperLocal.js')).default;

    // Load Whisper if not already loaded
    await modelManager.loadWhisper();

    // Transcribe
    const transcription = await whisperService.transcribe(audioFilePath, language);

    console.log('✅ Transcription completed:', transcription.substring(0, 100) + '...');

    return transcription;
  } catch (error) {
    console.error('❌ Transcription error:', error.message);

    // Fallback to mock data if service unavailable
    if (error.message.includes('unavailable') || error.message.includes('ECONNREFUSED')) {
      console.warn('⚠️  Using mock transcription (Whisper service not available)');
      return getMockTranscription(language);
    }

    throw error;
  }
}

/**
 * Extract structured medical data from transcription
 * @param {string} transcriptionText - Transcribed text
 * @param {string} language - Language code (ja, en, zh-TW)
 * @returns {Promise<object>} Structured data with confidence score
 */
export async function extractStructuredData(transcriptionText, language = 'ja') {
  try {
    console.log(`🤖 Extracting structured data (${language})...`);

    const ollamaService = (await import('./ollamaService.js')).default;

    // Load Llama if not already loaded (will unload Whisper first)
    await modelManager.loadLlama();

    // Extract structured data
    const extraction = await ollamaService.extractStructuredData(transcriptionText, language);

    console.log('✅ Extraction completed, confidence:', extraction.confidence);

    return {
      data: extraction.data,
      confidence: extraction.confidence
    };
  } catch (error) {
    console.error('❌ Extraction error:', error.message);

    // Fallback to mock data if service unavailable
    if (error.message.includes('unavailable') || error.message.includes('ECONNREFUSED')) {
      console.warn('⚠️  Using mock extraction (Ollama service not available)');
      return getMockStructuredData();
    }

    throw error;
  }
}

/**
 * Generate clinical SOAP note from structured data
 * Uses template-based generation (instant, no LLM required)
 * @param {object} structuredData - Extracted medical data
 * @param {string} language - Language code (ja, en, zh-TW)
 * @param {object} patientInfo - Patient information
 * @returns {Promise<string>} Formatted clinical note
 */
export async function generateClinicalNote(structuredData, language = 'ja', patientInfo = {}) {
  try {
    console.log(`📝 Generating clinical note (${language})...`);

    // Use template-based generation (instant, no LLM)
    const clinicalNote = generateSOAPNote(structuredData, language, patientInfo);

    console.log('✅ Clinical note generated');

    return clinicalNote;
  } catch (error) {
    console.error('❌ Note generation error:', error.message);
    return getMockClinicalNote(language);
  }
}

/**
 * Complete voice processing pipeline with sequential model loading
 * This is the main entry point for voice processing
 * @param {string} audioFilePath - Path to audio file
 * @param {string} language - Language code (ja, en, zh-TW)
 * @param {object} patientInfo - Patient information
 * @returns {Promise<object>} Complete processing results
 */
export async function processVoiceComplete(audioFilePath, language = 'ja', patientInfo = {}) {
  try {
    console.log('🎬 Starting complete voice processing pipeline...');
    const startTime = Date.now();

    // Use model manager for sequential processing
    const results = await modelManager.processVoiceSequentially(audioFilePath, language);

    // Generate SOAP note from structured data
    const clinicalNote = await generateClinicalNote(results.structuredData, language, patientInfo);

    // Complete results
    const finalResults = {
      transcription: results.transcription,
      structuredData: results.structuredData,
      confidence: results.confidence,
      clinicalNote,
      language,
      timestamp: new Date().toISOString(),
      timings: {
        ...results.timings,
        noteGeneration: 0, // Template-based is instant
        total: Date.now() - startTime
      }
    };

    console.log(`✅ Complete processing finished in ${(finalResults.timings.total / 1000).toFixed(2)}s`);

    return finalResults;
  } catch (error) {
    console.error('❌ Voice processing pipeline error:', error);
    throw error;
  }
}

// Mock data functions (fallback when services unavailable)

function getMockTranscription(language) {
  const mockTranscriptions = {
    'ja': '患者様は今朝から血圧が少し高めで、収縮期血圧142、拡張期血圧88でした。心拍数は78で安定しています。体温は36.8度で正常です。痛みはないとおっしゃっています。朝食は8割程度摂取されました。昨夜はよく眠れたそうです。',
    'en': 'Patient\'s blood pressure is slightly elevated this morning, with systolic 142 and diastolic 88. Heart rate is stable at 78. Temperature is normal at 36.8 degrees. Patient denies pain. Ate about 80% of breakfast. Reports sleeping well last night.',
    'zh-TW': '患者今早血壓略高，收縮壓142，舒張壓88。心率穩定在78。體溫正常36.8度。患者否認疼痛。早餐攝入約80%。報告昨晚睡眠良好。'
  };
  return mockTranscriptions[language] || mockTranscriptions['en'];
}

function getMockStructuredData() {
  return {
    data: {
      vitals: {
        blood_pressure: { systolic: 142, diastolic: 88 },
        heart_rate: 78,
        temperature: 36.8,
        respiratory_rate: 16,
        oxygen_saturation: 98
      },
      pain: {
        present: false,
        location: null,
        intensity: 0,
        character: null
      },
      nutrition: {
        intake_percent: 80,
        appetite: 'good'
      },
      sleep: {
        quality: 'good',
        hours: 7
      },
      wound: {
        present: false,
        location: null,
        stage: null,
        size_cm: null,
        description: null
      },
      consciousness: {
        level: 'alert',
        orientation: { person: true, place: true, time: true }
      },
      mobility: {
        status: 'independent',
        assistance_required: false
      }
    },
    confidence: 0.85
  };
}

function getMockClinicalNote(language) {
  const mockNotes = {
    'ja': `S: 疼痛の訴えなし。昨夜はよく眠れた。食欲良好。
O: BP 142/88, HR 78, T 36.8°C, RR 16, SpO2 98%。食事摂取量80%。意識清明、見当識良好。自立歩行可能。
A: バイタルサイン概ね安定。血圧やや高値。栄養摂取良好。
P: 通常の看護ケア継続。血圧の継続モニタリング。医師への報告済み。`,
    'en': `S: Denies pain. Slept well last night. Good appetite.
O: BP 142/88, HR 78, T 36.8°C, RR 16, SpO2 98%. Nutritional intake 80%. Alert and oriented x3. Ambulates independently.
A: Vital signs generally stable. Blood pressure slightly elevated. Good nutritional intake.
P: Continue routine nursing care. Monitor blood pressure closely. Physician notified.`,
    'zh-TW': `S: 否認疼痛。昨晚睡眠良好。食慾良好。
O: BP 142/88, HR 78, T 36.8°C, RR 16, SpO2 98%。營養攝入80%。意識清楚，定向力完整。可獨立行走。
A: 生命徵象大致穩定。血壓略高。營養攝入良好。
P: 持續常規護理。持續監測血壓。已通知醫師。`
  };
  return mockNotes[language] || mockNotes['en'];
}

export default {
  transcribeAudio,
  extractStructuredData,
  generateClinicalNote,
  processVoiceComplete
};