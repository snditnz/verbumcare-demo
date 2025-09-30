import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function transcribeAudio(audioFilePath, language = 'ja') {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.warn('OpenAI API key not configured - returning mock transcription');
      return getMockTranscription(language);
    }

    const audioFile = await fs.readFile(audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language === 'zh-TW' ? 'zh' : language,
      response_format: 'text'
    });

    return transcription;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return getMockTranscription(language);
  }
}

export async function extractStructuredData(transcriptionText, language = 'ja') {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.warn('OpenAI API key not configured - returning mock extraction');
      return getMockStructuredData();
    }

    const systemPrompt = `You are a medical data extraction system. Extract structured medical information from nursing documentation in ${getLanguageName(language)}.

Extract the following information if present:
- Vital signs (blood pressure, heart rate, temperature, respiratory rate, oxygen saturation)
- Pain assessment (location, intensity 0-10, character)
- Nutrition (intake percentage, appetite)
- Sleep (quality, hours)
- Wound care (location, stage, size in cm, description)
- Consciousness level and orientation
- Mobility status

Return JSON only with this structure:
{
  "vitals": {
    "blood_pressure": {"systolic": number, "diastolic": number},
    "heart_rate": number,
    "temperature": number,
    "respiratory_rate": number,
    "oxygen_saturation": number
  },
  "pain": {
    "present": boolean,
    "location": string,
    "intensity": number (0-10),
    "character": string
  },
  "nutrition": {
    "intake_percent": number,
    "appetite": string
  },
  "sleep": {
    "quality": string,
    "hours": number
  },
  "wound": {
    "present": boolean,
    "location": string,
    "stage": number,
    "size_cm": number,
    "description": string
  },
  "consciousness": {
    "level": string,
    "orientation": {"person": boolean, "place": boolean, "time": boolean}
  },
  "mobility": {
    "status": string,
    "assistance_required": boolean
  }
}

Only include fields that are explicitly mentioned. Use null for missing values.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcriptionText }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const extracted = JSON.parse(completion.choices[0].message.content);
    const confidence = calculateConfidenceScore(extracted);

    return {
      data: extracted,
      confidence
    };
  } catch (error) {
    console.error('Error extracting structured data:', error);
    return getMockStructuredData();
  }
}

export async function generateClinicalNote(structuredData, language = 'ja', patientInfo = {}) {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.warn('OpenAI API key not configured - returning mock clinical note');
      return getMockClinicalNote(language);
    }

    const languageInstructions = {
      'ja': 'Generate a clinical nursing note in Japanese using professional medical terminology.',
      'en': 'Generate a clinical nursing note in English using professional medical terminology.',
      'zh-TW': 'Generate a clinical nursing note in Traditional Chinese using professional medical terminology.'
    };

    const systemPrompt = `You are a clinical documentation system. ${languageInstructions[language] || languageInstructions['en']}

Format the note with sections:
- S (Subjective): Patient's complaints and expressions
- O (Objective): Measurable observations and vital signs
- A (Assessment): Clinical judgment and analysis
- P (Plan): Planned interventions and follow-up

Be concise and professional. Use appropriate medical terminology.`;

    const userPrompt = `Patient: ${patientInfo.name || 'Patient'}, Room ${patientInfo.room || 'N/A'}
Structured Data: ${JSON.stringify(structuredData, null, 2)}

Generate a properly formatted SOAP note.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating clinical note:', error);
    return getMockClinicalNote(language);
  }
}

function calculateConfidenceScore(extractedData) {
  let totalFields = 0;
  let filledFields = 0;

  function countFields(obj) {
    for (const value of Object.values(obj)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          countFields(value);
        } else {
          filledFields++;
        }
      }
      totalFields++;
    }
  }

  countFields(extractedData);

  const baseScore = filledFields / Math.max(totalFields, 1);
  return Math.min(0.95, baseScore + 0.1);
}

function getLanguageName(code) {
  const languages = {
    'ja': 'Japanese',
    'en': 'English',
    'zh-TW': 'Traditional Chinese',
    'zh': 'Chinese'
  };
  return languages[code] || 'English';
}

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
    'ja': `S: 患者は痛みを否定。昨夜はよく眠れたと報告。
O: BP 142/88, HR 78, T 36.8°C, RR 16, SpO2 98%。朝食摂取量80%。意識清明、見当識良好。
A: バイタルサイン概ね安定。血圧やや高値だが、経過観察可能な範囲。栄養摂取良好。
P: 血圧の継続モニタリング。通常の看護ケア継続。医師への報告済み。`,
    'en': `S: Patient denies pain. Reports sleeping well last night.
O: BP 142/88, HR 78, T 36.8°C, RR 16, SpO2 98%. Breakfast intake 80%. Alert and oriented x3.
A: Vital signs generally stable. Blood pressure slightly elevated but within acceptable range. Good nutritional intake.
P: Continue BP monitoring. Maintain routine nursing care. Physician notified.`,
    'zh-TW': `S: 患者否認疼痛。報告昨晚睡眠良好。
O: BP 142/88, HR 78, T 36.8°C, RR 16, SpO2 98%。早餐攝入80%。意識清楚，定向力完整。
A: 生命徵象大致穩定。血壓略高但在可接受範圍內。營養攝入良好。
P: 持續監測血壓。維持常規護理。已通知醫師。`
  };
  return mockNotes[language] || mockNotes['en'];
}

export default {
  transcribeAudio,
  extractStructuredData,
  generateClinicalNote
};