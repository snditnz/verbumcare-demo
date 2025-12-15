import axios from 'axios';
import ollamaService from './ollamaService.js';

/**
 * Voice Categorization Service
 * Detects data categories from transcriptions and extracts structured data
 * Supports: vitals, medication, clinical_note, adl, incident, care_plan, pain
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_NUM_CTX = parseInt(process.env.OLLAMA_NUM_CTX || '2048');
const OLLAMA_NUM_THREAD = parseInt(process.env.OLLAMA_NUM_THREAD || '8');
const OLLAMA_TEMPERATURE = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.1');

/**
 * Detect language from transcript
 * @param {string} transcript - Transcribed text
 * @returns {string} Detected language code (ja, en, zh-TW)
 */
export function detectLanguage(transcript) {
  if (!transcript || transcript.trim() === '') {
    return 'ja'; // Default to Japanese
  }

  // Count characters from each language
  const japaneseChars = (transcript.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length;
  const chineseChars = (transcript.match(/[\u4E00-\u9FFF]/g) || []).length;
  const englishChars = (transcript.match(/[a-zA-Z]/g) || []).length;

  const total = japaneseChars + chineseChars + englishChars;
  if (total === 0) {
    return 'ja'; // Default
  }

  // Calculate percentages
  const japanesePercent = japaneseChars / total;
  const chinesePercent = chineseChars / total;
  const englishPercent = englishChars / total;

  // Determine primary language
  if (japanesePercent > 0.3) {
    return 'ja';
  } else if (chinesePercent > 0.3 && japanesePercent < 0.2) {
    return 'zh-TW';
  } else if (englishPercent > 0.5) {
    return 'en';
  }

  // Default to Japanese for mixed content
  return 'ja';
}

/**
 * Detect categories present in a transcription
 * @param {string} transcript - Transcribed text
 * @param {string} language - Language code (ja, en, zh-TW) - if not provided, will be auto-detected
 * @returns {Promise<object>} Detected categories with confidence scores and detected language
 */
export async function detectCategories(transcript, language = null) {
  // Auto-detect language if not provided
  if (!language) {
    language = detectLanguage(transcript);
    console.log(`🌐 Auto-detected language: ${language}`);
  }
  try {
    console.log(`🔍 Detecting categories in ${language} transcript...`);
    console.log(`📝 Transcript content: "${transcript}" (length: ${transcript ? transcript.length : 'null'})`);
    const startTime = Date.now();

    const prompt = getCategoryDetectionPrompt(transcript, language);

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: OLLAMA_TEMPERATURE,
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
    let result;
    try {
      const responseText = response.data.response || response.data.text || '';
      console.log(`🔍 Ollama raw response: "${responseText}"`);
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('⚠️  JSON parse failed, attempting cleanup...');
      const jsonMatch = response.data.response?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to extract valid JSON from category detection response');
      }
    }

    // Validate and normalize result
    const categories = result.categories || [];
    const confidence = result.confidence || 0.7;

    console.log(`✅ Category detection completed in ${duration}s`);
    console.log(`   Detected: ${categories.join(', ')}`);
    console.log(`   Language: ${language}`);

    return {
      categories: categories,
      overallConfidence: confidence,
      processingTime: parseFloat(duration),
      detectedLanguage: language
    };

  } catch (error) {
    console.error('❌ Category detection error:', error.message);
    throw error;
  }
}

/**
 * Extract structured data for a specific category
 * @param {string} transcript - Transcribed text
 * @param {string} category - Category type (vitals, medication, etc.)
 * @param {string} language - Language code - if not provided, will be auto-detected
 * @returns {Promise<object>} Extracted data with field-level confidence scores
 */
export async function extractDataForCategory(transcript, category, language = null) {
  // Auto-detect language if not provided
  if (!language) {
    language = detectLanguage(transcript);
    console.log(`🌐 Auto-detected language: ${language}`);
  }
  try {
    console.log(`📊 Extracting ${category} data from ${language} transcript...`);
    const startTime = Date.now();

    const prompt = getCategoryExtractionPrompt(transcript, category, language);

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: OLLAMA_TEMPERATURE,
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
    let result;
    try {
      const responseText = response.data.response || response.data.text || '';
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('⚠️  JSON parse failed, attempting cleanup...');
      const jsonMatch = response.data.response?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to extract valid JSON from ${category} extraction response`);
      }
    }

    // Calculate per-field confidence scores
    const fieldConfidences = calculateFieldConfidences(result.data || result, transcript);

    console.log(`✅ ${category} extraction completed in ${duration}s`);
    console.log(`   Language: ${language}`);

    return {
      data: result.data || result,
      fieldConfidences: fieldConfidences,
      confidence: result.confidence || calculateOverallConfidence(fieldConfidences),
      processingTime: parseFloat(duration),
      language: language
    };

  } catch (error) {
    console.error(`❌ ${category} extraction error:`, error.message);
    throw error;
  }
}

/**
 * Get category detection prompt
 */
function getCategoryDetectionPrompt(transcript, language) {
  const languageInstructions = {
    'ja': 'Japanese medical transcription',
    'en': 'English medical transcription',
    'zh-TW': 'Traditional Chinese medical transcription'
  };

  return `You are a medical data categorization AI. Analyze the following ${languageInstructions[language] || 'medical transcription'} and identify ALL data categories present.

AVAILABLE CATEGORIES:
- vitals: Vital signs (blood pressure, heart rate, temperature, SpO2, respiratory rate, weight, height)
- medication: Medication administration (drug name, dose, route, time, response)
- clinical_note: Clinical observations and notes (SOAP format: subjective, objective, assessment, plan)
- adl: Activities of Daily Living assessments (eating, bathing, dressing, toileting, mobility scores)
- incident: Incident reports (type, severity, description, actions taken)
- care_plan: Care plan updates (problem, goal, interventions, evaluation)
- pain: Pain assessments (location, intensity 0-10, character, duration)

RULES:
1. Output ONLY valid JSON
2. Identify ALL categories present (can be multiple)
3. Provide overall confidence score (0.0-1.0)
4. If no clear categories, return empty array

Transcription:
${transcript}

Output JSON format:
{
  "categories": ["category1", "category2", ...],
  "confidence": 0.0-1.0
}`;
}

/**
 * Get category-specific extraction prompt
 */
function getCategoryExtractionPrompt(transcript, category, language) {
  const schemas = {
    vitals: {
      description: 'Extract vital signs measurements',
      schema: {
        blood_pressure: { systolic: 'number', diastolic: 'number' },
        heart_rate: 'number (bpm)',
        temperature: 'number (°C)',
        respiratory_rate: 'number (breaths/min)',
        oxygen_saturation: 'number (%)',
        weight_kg: 'number',
        height_cm: 'number'
      }
    },
    medication: {
      description: 'Extract medication administration details',
      schema: {
        medication_name: 'string',
        dose: 'string',
        route: 'string (oral, IV, IM, SC, topical, etc.)',
        time: 'string (HH:MM)',
        response: 'string (optional)'
      }
    },
    clinical_note: {
      description: 'Extract clinical observations in SOAP format',
      schema: {
        subjective: 'string (patient complaints, symptoms)',
        objective: 'string (observations, measurements)',
        assessment: 'string (clinical judgment)',
        plan: 'string (treatment plan)',
        category: 'string (optional: progress note, admission note, etc.)'
      }
    },
    adl: {
      description: 'Extract ADL assessment data',
      schema: {
        activity: 'string (eating, bathing, dressing, toileting, mobility)',
        score: 'number (0-10 or specific scale)',
        assistance_required: 'boolean',
        notes: 'string (optional)'
      }
    },
    incident: {
      description: 'Extract incident report details',
      schema: {
        type: 'string (fall, medication error, behavioral, etc.)',
        severity: 'string (low, medium, high, critical)',
        description: 'string',
        actions_taken: 'string (optional)',
        follow_up_required: 'boolean'
      }
    },
    care_plan: {
      description: 'Extract care plan information',
      schema: {
        problem: 'string',
        goal: 'string',
        interventions: 'array of strings',
        evaluation: 'string (optional)'
      }
    },
    pain: {
      description: 'Extract pain assessment data',
      schema: {
        location: 'string',
        intensity: 'number (0-10)',
        character: 'string (sharp, dull, burning, etc.)',
        duration: 'string',
        aggravating_factors: 'string (optional)',
        relieving_factors: 'string (optional)'
      }
    }
  };

  const categoryInfo = schemas[category] || { description: 'Extract data', schema: {} };

  const languageInstructions = {
    'ja': 'Keep all text fields in Japanese (日本語)',
    'en': 'Keep all text fields in English',
    'zh-TW': 'Keep all text fields in Traditional Chinese (繁體中文)'
  };

  return `You are a medical data extraction AI. ${categoryInfo.description} from the transcription.

CRITICAL RULES:
1. Output ONLY valid JSON
2. Extract data matching the schema exactly
3. Use null for missing fields (not empty strings)
4. PRESERVE ORIGINAL LANGUAGE: ${languageInstructions[language] || 'Keep text in original language'}
5. Do NOT translate text fields - keep them in the same language as the transcription
6. Normalize numeric values to standard units
7. Include confidence score (0.0-1.0)

Language: ${language}

Schema:
${JSON.stringify(categoryInfo.schema, null, 2)}

Transcription:
${transcript}

Output JSON format:
{
  "data": { ...extracted data matching schema... },
  "confidence": 0.0-1.0
}`;
}

/**
 * Calculate per-field confidence scores
 */
function calculateFieldConfidences(data, transcript) {
  const confidences = {};
  const transcriptLower = transcript.toLowerCase();

  function analyzeField(key, value, path = '') {
    const fullPath = path ? `${path}.${key}` : key;

    if (value === null || value === undefined) {
      confidences[fullPath] = 0.0;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        analyzeField(nestedKey, nestedValue, fullPath);
      }
    } else if (Array.isArray(value)) {
      // Arrays get confidence based on length
      confidences[fullPath] = value.length > 0 ? 0.85 : 0.5;
    } else if (typeof value === 'number') {
      // Numbers get high confidence if they're in reasonable ranges
      confidences[fullPath] = 0.9;
    } else if (typeof value === 'string') {
      // Strings get confidence based on length and presence in transcript
      const valueWords = value.toLowerCase().split(/\s+/);
      const matchCount = valueWords.filter(word => 
        word.length > 2 && transcriptLower.includes(word)
      ).length;
      const matchRatio = matchCount / Math.max(valueWords.length, 1);
      confidences[fullPath] = Math.min(0.95, 0.6 + (matchRatio * 0.35));
    } else if (typeof value === 'boolean') {
      confidences[fullPath] = 0.8;
    } else {
      confidences[fullPath] = 0.7;
    }
  }

  for (const [key, value] of Object.entries(data)) {
    analyzeField(key, value);
  }

  return confidences;
}

/**
 * Calculate overall confidence from field confidences
 */
function calculateOverallConfidence(fieldConfidences) {
  const values = Object.values(fieldConfidences);
  if (values.length === 0) return 0.5;

  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.min(0.95, sum / values.length);
}

/**
 * Validate vital signs data
 * @param {object} vitalsData - Vital signs data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validateVitalSigns(vitalsData) {
  const errors = [];
  const warnings = [];

  if (!vitalsData) {
    return { valid: true, errors, warnings };
  }

  // Blood pressure validation
  if (vitalsData.blood_pressure) {
    const { systolic, diastolic } = vitalsData.blood_pressure;

    if (systolic !== null && systolic !== undefined) {
      if (systolic < 70 || systolic > 250) {
        errors.push('Blood pressure systolic out of valid range (70-250 mmHg)');
      } else if (systolic > 140) {
        warnings.push('Elevated blood pressure detected (systolic > 140 mmHg)');
      } else if (systolic < 90) {
        warnings.push('Low blood pressure detected (systolic < 90 mmHg)');
      }
    }

    if (diastolic !== null && diastolic !== undefined) {
      if (diastolic < 40 || diastolic > 150) {
        errors.push('Blood pressure diastolic out of valid range (40-150 mmHg)');
      }
    }

    if (systolic && diastolic && systolic <= diastolic) {
      errors.push('Systolic pressure must be greater than diastolic');
    }
  }

  // Heart rate validation
  if (vitalsData.heart_rate !== null && vitalsData.heart_rate !== undefined) {
    if (vitalsData.heart_rate < 30 || vitalsData.heart_rate > 250) {
      errors.push('Heart rate out of valid range (30-250 bpm)');
    } else if (vitalsData.heart_rate > 100) {
      warnings.push('Tachycardia detected (HR > 100 bpm)');
    } else if (vitalsData.heart_rate < 60) {
      warnings.push('Bradycardia detected (HR < 60 bpm)');
    }
  }

  // Temperature validation
  if (vitalsData.temperature !== null && vitalsData.temperature !== undefined) {
    if (vitalsData.temperature < 34 || vitalsData.temperature > 42) {
      errors.push('Temperature out of valid range (34-42°C)');
    } else if (vitalsData.temperature >= 38) {
      warnings.push('Fever detected (Temp ≥ 38°C)');
    } else if (vitalsData.temperature < 36) {
      warnings.push('Hypothermia risk (Temp < 36°C)');
    }
  }

  // Respiratory rate validation
  if (vitalsData.respiratory_rate !== null && vitalsData.respiratory_rate !== undefined) {
    if (vitalsData.respiratory_rate < 8 || vitalsData.respiratory_rate > 40) {
      errors.push('Respiratory rate out of valid range (8-40/min)');
    } else if (vitalsData.respiratory_rate > 20) {
      warnings.push('Tachypnea detected (RR > 20/min)');
    } else if (vitalsData.respiratory_rate < 12) {
      warnings.push('Bradypnea detected (RR < 12/min)');
    }
  }

  // Oxygen saturation validation
  if (vitalsData.oxygen_saturation !== null && vitalsData.oxygen_saturation !== undefined) {
    if (vitalsData.oxygen_saturation < 50 || vitalsData.oxygen_saturation > 100) {
      errors.push('Oxygen saturation out of valid range (50-100%)');
    } else if (vitalsData.oxygen_saturation < 88) {
      errors.push('Critical hypoxemia (SpO2 < 88%)');
    } else if (vitalsData.oxygen_saturation < 92) {
      warnings.push('Low oxygen saturation detected (SpO2 < 92%)');
    }
  }

  // Weight validation
  if (vitalsData.weight_kg !== null && vitalsData.weight_kg !== undefined) {
    if (vitalsData.weight_kg < 20 || vitalsData.weight_kg > 300) {
      errors.push('Weight out of valid range (20-300 kg)');
    }
  }

  // Height validation
  if (vitalsData.height_cm !== null && vitalsData.height_cm !== undefined) {
    if (vitalsData.height_cm < 100 || vitalsData.height_cm > 250) {
      errors.push('Height out of valid range (100-250 cm)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate medication data
 * @param {object} medicationData - Medication data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validateMedication(medicationData) {
  const errors = [];
  const warnings = [];

  if (!medicationData) {
    return { valid: true, errors, warnings };
  }

  // Helper function to check if string is empty or whitespace-only
  const isEmptyOrWhitespace = (str) => {
    return !str || typeof str !== 'string' || str.trim() === '';
  };

  // Required fields
  if (isEmptyOrWhitespace(medicationData.medication_name)) {
    errors.push('Medication name is required');
  }

  if (isEmptyOrWhitespace(medicationData.dose)) {
    errors.push('Medication dose is required');
  }

  if (isEmptyOrWhitespace(medicationData.route)) {
    errors.push('Medication route is required');
  }

  if (isEmptyOrWhitespace(medicationData.time)) {
    errors.push('Medication administration time is required');
  }

  // Validate route
  const validRoutes = ['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'rectal', 'sublingual', 'transdermal'];
  if (medicationData.route) {
    const routeLower = medicationData.route.toLowerCase();
    if (!validRoutes.some(r => routeLower.includes(r))) {
      warnings.push(`Unusual medication route: ${medicationData.route}`);
    }
  }

  // Validate time format (HH:MM)
  if (medicationData.time) {
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(medicationData.time)) {
      warnings.push('Time format should be HH:MM (24-hour)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate incident data
 * @param {object} incidentData - Incident data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validateIncident(incidentData) {
  const errors = [];
  const warnings = [];

  if (!incidentData) {
    return { valid: true, errors, warnings };
  }

  // Required fields
  if (!incidentData.type || incidentData.type.trim() === '') {
    errors.push('Incident type is required');
  }

  if (!incidentData.severity || incidentData.severity.trim() === '') {
    errors.push('Incident severity is required');
  }

  if (!incidentData.description || incidentData.description.trim() === '') {
    errors.push('Incident description is required');
  }

  // Validate severity
  const validSeverities = ['low', 'medium', 'high', 'critical'];
  if (incidentData.severity) {
    const severityLower = incidentData.severity.toLowerCase();
    if (!validSeverities.includes(severityLower)) {
      errors.push(`Invalid severity level. Must be one of: ${validSeverities.join(', ')}`);
    }
  }

  // Validate follow_up_required is boolean
  if (incidentData.follow_up_required !== undefined && 
      typeof incidentData.follow_up_required !== 'boolean') {
    errors.push('follow_up_required must be a boolean value');
  }

  // Warning for high severity without follow-up
  if (incidentData.severity && 
      ['high', 'critical'].includes(incidentData.severity.toLowerCase()) &&
      incidentData.follow_up_required === false) {
    warnings.push('High/critical severity incidents typically require follow-up');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate pain assessment data
 * @param {object} painData - Pain data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validatePain(painData) {
  const errors = [];
  const warnings = [];

  if (!painData) {
    return { valid: true, errors, warnings };
  }

  // Validate pain intensity (0-10 scale)
  if (painData.intensity !== null && painData.intensity !== undefined) {
    if (typeof painData.intensity !== 'number') {
      errors.push('Pain intensity must be a number');
    } else if (painData.intensity < 0 || painData.intensity > 10) {
      errors.push('Pain intensity must be between 0-10');
    } else if (painData.intensity >= 7) {
      warnings.push('Severe pain reported (≥7/10)');
    }
  }

  // Location should be specified if pain is present
  if (painData.intensity > 0 && (!painData.location || painData.location.trim() === '')) {
    warnings.push('Pain location should be specified when pain is present');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate ADL assessment data
 * @param {object} adlData - ADL data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validateADL(adlData) {
  const errors = [];
  const warnings = [];

  if (!adlData) {
    return { valid: true, errors, warnings };
  }

  // Required fields
  if (!adlData.activity || adlData.activity.trim() === '') {
    errors.push('ADL activity type is required');
  }

  // Validate score
  if (adlData.score !== null && adlData.score !== undefined) {
    if (typeof adlData.score !== 'number') {
      errors.push('ADL score must be a number');
    } else if (adlData.score < 0 || adlData.score > 10) {
      errors.push('ADL score must be between 0-10');
    }
  }

  // Validate assistance_required is boolean
  if (adlData.assistance_required !== undefined && 
      typeof adlData.assistance_required !== 'boolean') {
    errors.push('assistance_required must be a boolean value');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate care plan data
 * @param {object} carePlanData - Care plan data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validateCarePlan(carePlanData) {
  const errors = [];
  const warnings = [];

  if (!carePlanData) {
    return { valid: true, errors, warnings };
  }

  // Required fields
  if (!carePlanData.problem || carePlanData.problem.trim() === '') {
    errors.push('Care plan problem is required');
  }

  if (!carePlanData.goal || carePlanData.goal.trim() === '') {
    errors.push('Care plan goal is required');
  }

  if (!carePlanData.interventions || !Array.isArray(carePlanData.interventions)) {
    errors.push('Care plan interventions must be an array');
  } else if (carePlanData.interventions.length === 0) {
    warnings.push('Care plan should include at least one intervention');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate clinical note data
 * @param {object} clinicalNoteData - Clinical note data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validateClinicalNote(clinicalNoteData) {
  const errors = [];
  const warnings = [];

  if (!clinicalNoteData) {
    return { valid: true, errors, warnings };
  }

  // At least one SOAP section should be present
  const hasSoapContent = 
    (clinicalNoteData.subjective && clinicalNoteData.subjective.trim() !== '') ||
    (clinicalNoteData.objective && clinicalNoteData.objective.trim() !== '') ||
    (clinicalNoteData.assessment && clinicalNoteData.assessment.trim() !== '') ||
    (clinicalNoteData.plan && clinicalNoteData.plan.trim() !== '');

  if (!hasSoapContent) {
    warnings.push('Clinical note should contain at least one SOAP section');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export default {
  detectLanguage,
  detectCategories,
  extractDataForCategory,
  validateVitalSigns,
  validateMedication,
  validateIncident,
  validatePain,
  validateADL,
  validateCarePlan,
  validateClinicalNote
};
