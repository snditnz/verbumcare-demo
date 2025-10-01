import voiceProcessing from './voiceProcessing.js';

/**
 * AI Extraction Service - Complete Voice-to-Structured Data Pipeline
 * Uses local Whisper + Ollama with sequential loading
 * Completely offline operation
 */

/**
 * Process voice recording to structured medical data
 * This is the main entry point used by API routes
 * @param {string} audioFilePath - Path to uploaded audio file
 * @param {string} language - Language code (ja, en, zh-TW)
 * @param {object} patientInfo - Patient information
 * @returns {Promise<object>} Complete processing results
 */
export async function processVoiceToStructured(audioFilePath, language = 'ja', patientInfo = {}) {
  try {
    console.log('🎬 Starting AI extraction pipeline...');
    console.log('Language:', language);
    console.log('Patient:', patientInfo.name || 'Unknown');

    // Use the complete voice processing pipeline with sequential loading
    const results = await voiceProcessing.processVoiceComplete(audioFilePath, language, patientInfo);

    console.log('✅ AI extraction pipeline complete');
    console.log('Confidence:', results.confidence);
    console.log('Total time:', (results.timings.total / 1000).toFixed(2) + 's');

    return results;

  } catch (error) {
    console.error('❌ AI extraction pipeline error:', error);
    throw error;
  }
}

/**
 * Validate structured medical data
 * @param {object} data - Structured data to validate
 * @returns {object} Validation result with errors and warnings
 */
export function validateStructuredData(data) {
  const errors = [];
  const warnings = [];

  // Vital signs validation
  if (data.vitals) {
    // Blood pressure
    if (data.vitals.blood_pressure) {
      const { systolic, diastolic } = data.vitals.blood_pressure;

      if (systolic) {
        if (systolic < 70 || systolic > 250) {
          errors.push('Blood pressure systolic out of valid range (70-250 mmHg)');
        } else if (systolic > 140) {
          warnings.push('Elevated blood pressure detected (systolic > 140 mmHg)');
        } else if (systolic < 90) {
          warnings.push('Low blood pressure detected (systolic < 90 mmHg)');
        }
      }

      if (diastolic) {
        if (diastolic < 40 || diastolic > 150) {
          errors.push('Blood pressure diastolic out of valid range (40-150 mmHg)');
        }
      }

      if (systolic && diastolic && systolic <= diastolic) {
        errors.push('Systolic pressure must be greater than diastolic');
      }
    }

    // Heart rate
    if (data.vitals.heart_rate) {
      if (data.vitals.heart_rate < 30 || data.vitals.heart_rate > 250) {
        errors.push('Heart rate out of valid range (30-250 bpm)');
      } else if (data.vitals.heart_rate > 100) {
        warnings.push('Tachycardia detected (HR > 100 bpm)');
      } else if (data.vitals.heart_rate < 60) {
        warnings.push('Bradycardia detected (HR < 60 bpm)');
      }
    }

    // Temperature
    if (data.vitals.temperature) {
      if (data.vitals.temperature < 34 || data.vitals.temperature > 42) {
        errors.push('Temperature out of valid range (34-42°C)');
      } else if (data.vitals.temperature >= 38) {
        warnings.push('Fever detected (Temp ≥ 38°C)');
      } else if (data.vitals.temperature < 36) {
        warnings.push('Hypothermia risk (Temp < 36°C)');
      }
    }

    // Respiratory rate
    if (data.vitals.respiratory_rate) {
      if (data.vitals.respiratory_rate < 8 || data.vitals.respiratory_rate > 40) {
        errors.push('Respiratory rate out of valid range (8-40/min)');
      } else if (data.vitals.respiratory_rate > 20) {
        warnings.push('Tachypnea detected (RR > 20/min)');
      } else if (data.vitals.respiratory_rate < 12) {
        warnings.push('Bradypnea detected (RR < 12/min)');
      }
    }

    // Oxygen saturation
    if (data.vitals.oxygen_saturation) {
      if (data.vitals.oxygen_saturation < 50 || data.vitals.oxygen_saturation > 100) {
        errors.push('Oxygen saturation out of valid range (50-100%)');
      } else if (data.vitals.oxygen_saturation < 92) {
        warnings.push('Low oxygen saturation detected (SpO2 < 92%)');
      } else if (data.vitals.oxygen_saturation < 88) {
        errors.push('Critical hypoxemia (SpO2 < 88%)');
      }
    }
  }

  // Pain validation
  if (data.pain && data.pain.intensity !== undefined && data.pain.intensity !== null) {
    if (data.pain.intensity < 0 || data.pain.intensity > 10) {
      errors.push('Pain score must be between 0-10');
    } else if (data.pain.intensity >= 7) {
      warnings.push('Severe pain reported (≥7/10)');
    }
  }

  // Nutrition validation
  if (data.nutrition && data.nutrition.intake_percent !== undefined && data.nutrition.intake_percent !== null) {
    if (data.nutrition.intake_percent < 0 || data.nutrition.intake_percent > 100) {
      errors.push('Nutrition intake must be between 0-100%');
    } else if (data.nutrition.intake_percent < 50) {
      warnings.push('Poor nutritional intake (<50%)');
    }
  }

  // Wound staging validation
  if (data.wound && data.wound.present && data.wound.stage) {
    if (data.wound.stage < 1 || data.wound.stage > 4) {
      errors.push('Wound stage must be between 1-4');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Merge AI-extracted data with manual corrections
 * @param {object} aiData - Data extracted by AI
 * @param {object} manualData - Manual corrections/additions
 * @returns {object} Merged data
 */
export function mergeWithManualInput(aiData, manualData) {
  const merged = JSON.parse(JSON.stringify(aiData));

  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] !== null && source[key] !== undefined) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  deepMerge(merged, manualData);

  return merged;
}

/**
 * Calculate data completeness percentage
 * @param {object} data - Structured data to analyze
 * @returns {object} Completeness statistics
 */
export function calculateCompleteness(data) {
  const sections = {
    vitals: ['blood_pressure', 'heart_rate', 'temperature', 'respiratory_rate', 'oxygen_saturation'],
    pain: ['present', 'location', 'intensity', 'character'],
    nutrition: ['intake_percent', 'appetite'],
    sleep: ['quality', 'hours'],
    consciousness: ['level', 'orientation'],
    mobility: ['status', 'assistance_required']
  };

  let totalFields = 0;
  let completedFields = 0;

  for (const [section, fields] of Object.entries(sections)) {
    if (data[section]) {
      for (const field of fields) {
        totalFields++;
        if (field === 'blood_pressure') {
          if (data[section][field]?.systolic && data[section][field]?.diastolic) {
            completedFields++;
          }
        } else if (field === 'orientation') {
          if (data[section][field]?.person !== undefined) {
            completedFields++;
          }
        } else if (field === 'present') {
          // Present is always filled (boolean)
          completedFields++;
        } else if (data[section][field] !== null && data[section][field] !== undefined) {
          completedFields++;
        }
      }
    } else {
      totalFields += fields.length;
    }
  }

  return {
    percentage: Math.round((completedFields / totalFields) * 100),
    completed: completedFields,
    total: totalFields
  };
}

/**
 * Get AI service health status
 * @returns {Promise<object>} Health status of all AI services
 */
export async function getAIHealth() {
  try {
    const modelManager = (await import('./modelManager.js')).default;
    const health = await modelManager.getHealth();

    return {
      status: 'operational',
      services: health,
      offline: true, // Always offline mode
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error.message,
      offline: true,
      timestamp: new Date().toISOString()
    };
  }
}

export default {
  processVoiceToStructured,
  validateStructuredData,
  mergeWithManualInput,
  calculateCompleteness,
  getAIHealth
};