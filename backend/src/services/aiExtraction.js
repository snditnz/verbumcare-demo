import voiceProcessing from './voiceProcessing.js';

export async function processVoiceToStructured(audioFilePath, language = 'ja', patientInfo = {}) {
  try {
    console.log('Starting voice processing for language:', language);

    const transcription = await voiceProcessing.transcribeAudio(audioFilePath, language);
    console.log('Transcription completed:', transcription.substring(0, 100) + '...');

    const structuredData = await voiceProcessing.extractStructuredData(transcription, language);
    console.log('Structured extraction completed, confidence:', structuredData.confidence);

    const clinicalNote = await voiceProcessing.generateClinicalNote(
      structuredData.data,
      language,
      patientInfo
    );
    console.log('Clinical note generated');

    return {
      transcription,
      structuredData: structuredData.data,
      confidence: structuredData.confidence,
      clinicalNote,
      language,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in voice processing pipeline:', error);
    throw error;
  }
}

export function validateStructuredData(data) {
  const errors = [];
  const warnings = [];

  if (data.vitals) {
    if (data.vitals.blood_pressure) {
      const { systolic, diastolic } = data.vitals.blood_pressure;
      if (systolic && diastolic) {
        if (systolic < 70 || systolic > 250) {
          errors.push('Blood pressure systolic out of valid range (70-250)');
        }
        if (diastolic < 40 || diastolic > 150) {
          errors.push('Blood pressure diastolic out of valid range (40-150)');
        }
        if (systolic <= diastolic) {
          errors.push('Systolic pressure must be greater than diastolic');
        }
      }
    }

    if (data.vitals.heart_rate) {
      if (data.vitals.heart_rate < 30 || data.vitals.heart_rate > 250) {
        errors.push('Heart rate out of valid range (30-250)');
      }
    }

    if (data.vitals.temperature) {
      if (data.vitals.temperature < 34 || data.vitals.temperature > 42) {
        errors.push('Temperature out of valid range (34-42°C)');
      }
    }

    if (data.vitals.oxygen_saturation) {
      if (data.vitals.oxygen_saturation < 50 || data.vitals.oxygen_saturation > 100) {
        errors.push('Oxygen saturation out of valid range (50-100%)');
      }
      if (data.vitals.oxygen_saturation < 92) {
        warnings.push('Low oxygen saturation detected');
      }
    }
  }

  if (data.pain && data.pain.intensity !== undefined) {
    if (data.pain.intensity < 0 || data.pain.intensity > 10) {
      errors.push('Pain score must be between 0-10');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

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

export default {
  processVoiceToStructured,
  validateStructuredData,
  mergeWithManualInput,
  calculateCompleteness
};