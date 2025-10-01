/**
 * SOAP Note Template Generator
 * Creates professional clinical nursing notes from structured data
 * No LLM required - instant generation (<1 second)
 * Supports Japanese, English, and Traditional Chinese
 */

/**
 * Generate SOAP note from structured assessment data
 * @param {object} structuredData - Extracted medical data
 * @param {string} language - Language code (ja, en, zh-TW)
 * @param {object} patientInfo - Patient information
 * @returns {string} Formatted SOAP note
 */
export function generateSOAPNote(structuredData, language = 'ja', patientInfo = {}) {
  const templates = {
    'ja': generateJapaneseSO AP,
    'en': generateEnglishSOAP,
    'zh-TW': generateChineseSOAP
  };

  const generator = templates[language] || templates['en'];
  return generator(structuredData, patientInfo);
}

/**
 * Generate Japanese SOAP note
 */
function generateJapaneseSOAP(data, patientInfo) {
  const sections = [];

  // S (Subjective)
  const subjective = [];
  if (data.pain?.present) {
    const location = data.pain.location || '部位不明';
    const intensity = data.pain.intensity !== null ? `${data.pain.intensity}/10` : '程度不明';
    const character = data.pain.character || '';
    subjective.push(`${location}の疼痛あり（${intensity}${character ? '、' + character : ''}）`);
  } else {
    subjective.push('疼痛の訴えなし');
  }

  if (data.sleep?.quality) {
    const sleepDesc = getSleepDescription(data.sleep.quality, data.sleep.hours, 'ja');
    subjective.push(sleepDesc);
  }

  if (data.nutrition?.appetite) {
    const appetiteDesc = getAppetiteDescription(data.nutrition.appetite, 'ja');
    subjective.push(appetiteDesc);
  }

  sections.push('S: ' + subjective.join('。'));

  // O (Objective)
  const objective = [];

  // Vital signs
  if (data.vitals) {
    const vitalParts = [];

    if (data.vitals.blood_pressure) {
      const { systolic, diastolic } = data.vitals.blood_pressure;
      if (systolic && diastolic) {
        vitalParts.push(`BP ${systolic}/${diastolic}`);
      }
    }
    if (data.vitals.heart_rate) {
      vitalParts.push(`HR ${data.vitals.heart_rate}`);
    }
    if (data.vitals.temperature) {
      vitalParts.push(`T ${data.vitals.temperature}°C`);
    }
    if (data.vitals.respiratory_rate) {
      vitalParts.push(`RR ${data.vitals.respiratory_rate}`);
    }
    if (data.vitals.oxygen_saturation) {
      vitalParts.push(`SpO2 ${data.vitals.oxygen_saturation}%`);
    }

    if (vitalParts.length > 0) {
      objective.push(vitalParts.join(', '));
    }
  }

  // Nutrition
  if (data.nutrition?.intake_percent !== null) {
    objective.push(`食事摂取量${data.nutrition.intake_percent}%`);
  }

  // Consciousness
  if (data.consciousness) {
    const { level, orientation } = data.consciousness;
    const levelDesc = getConsciousnessDescription(level, 'ja');
    let orientDesc = levelDesc;

    if (orientation) {
      const { person, place, time } = orientation;
      if (person && place && time) {
        orientDesc += '、見当識良好';
      } else if (person || place || time) {
        const oriented = [];
        if (person) oriented.push('人');
        if (place) oriented.push('場所');
        if (time) oriented.push('時間');
        orientDesc += `、${oriented.join('・')}の見当識あり`;
      }
    }
    objective.push(orientDesc);
  }

  // Mobility
  if (data.mobility?.status) {
    const mobilityDesc = getMobilityDescription(
      data.mobility.status,
      data.mobility.assistance_required,
      'ja'
    );
    objective.push(mobilityDesc);
  }

  // Wound
  if (data.wound?.present) {
    const woundDesc = getWoundDescription(data.wound, 'ja');
    objective.push(woundDesc);
  }

  sections.push('O: ' + objective.join('。'));

  // A (Assessment)
  const assessment = generateAssessment(data, 'ja');
  sections.push('A: ' + assessment);

  // P (Plan)
  const plan = generatePlan(data, 'ja');
  sections.push('P: ' + plan);

  return sections.join('\n');
}

/**
 * Generate English SOAP note
 */
function generateEnglishSOAP(data, patientInfo) {
  const sections = [];

  // S (Subjective)
  const subjective = [];
  if (data.pain?.present) {
    const location = data.pain.location || 'unspecified location';
    const intensity = data.pain.intensity !== null ? `${data.pain.intensity}/10` : 'unspecified intensity';
    const character = data.pain.character ? `, ${data.pain.character}` : '';
    subjective.push(`Reports pain at ${location} (${intensity}${character})`);
  } else {
    subjective.push('Denies pain');
  }

  if (data.sleep?.quality) {
    const sleepDesc = getSleepDescription(data.sleep.quality, data.sleep.hours, 'en');
    subjective.push(sleepDesc);
  }

  if (data.nutrition?.appetite) {
    const appetiteDesc = getAppetiteDescription(data.nutrition.appetite, 'en');
    subjective.push(appetiteDesc);
  }

  sections.push('S: ' + subjective.join('. ') + '.');

  // O (Objective)
  const objective = [];

  // Vital signs
  if (data.vitals) {
    const vitalParts = [];

    if (data.vitals.blood_pressure) {
      const { systolic, diastolic } = data.vitals.blood_pressure;
      if (systolic && diastolic) {
        vitalParts.push(`BP ${systolic}/${diastolic}`);
      }
    }
    if (data.vitals.heart_rate) vitalParts.push(`HR ${data.vitals.heart_rate}`);
    if (data.vitals.temperature) vitalParts.push(`T ${data.vitals.temperature}°C`);
    if (data.vitals.respiratory_rate) vitalParts.push(`RR ${data.vitals.respiratory_rate}`);
    if (data.vitals.oxygen_saturation) vitalParts.push(`SpO2 ${data.vitals.oxygen_saturation}%`);

    if (vitalParts.length > 0) {
      objective.push(vitalParts.join(', '));
    }
  }

  // Nutrition
  if (data.nutrition?.intake_percent !== null) {
    objective.push(`Nutritional intake ${data.nutrition.intake_percent}%`);
  }

  // Consciousness
  if (data.consciousness) {
    const consciousDesc = getConsciousnessDescription(data.consciousness.level, 'en');
    let fullDesc = consciousDesc;

    if (data.consciousness.orientation) {
      const { person, place, time } = data.consciousness.orientation;
      const orientCount = [person, place, time].filter(Boolean).length;
      fullDesc += `, oriented x${orientCount}`;
    }
    objective.push(fullDesc);
  }

  // Mobility
  if (data.mobility?.status) {
    const mobilityDesc = getMobilityDescription(
      data.mobility.status,
      data.mobility.assistance_required,
      'en'
    );
    objective.push(mobilityDesc);
  }

  // Wound
  if (data.wound?.present) {
    const woundDesc = getWoundDescription(data.wound, 'en');
    objective.push(woundDesc);
  }

  sections.push('O: ' + objective.join('. ') + '.');

  // A (Assessment)
  const assessment = generateAssessment(data, 'en');
  sections.push('A: ' + assessment);

  // P (Plan)
  const plan = generatePlan(data, 'en');
  sections.push('P: ' + plan);

  return sections.join('\n');
}

/**
 * Generate Traditional Chinese SOAP note
 */
function generateChineseSOAP(data, patientInfo) {
  const sections = [];

  // S (Subjective)
  const subjective = [];
  if (data.pain?.present) {
    const location = data.pain.location || '部位不明';
    const intensity = data.pain.intensity !== null ? `${data.pain.intensity}/10` : '程度不明';
    const character = data.pain.character || '';
    subjective.push(`${location}疼痛（${intensity}${character ? '，' + character : ''}）`);
  } else {
    subjective.push('否認疼痛');
  }

  if (data.sleep?.quality) {
    const sleepDesc = getSleepDescription(data.sleep.quality, data.sleep.hours, 'zh-TW');
    subjective.push(sleepDesc);
  }

  if (data.nutrition?.appetite) {
    const appetiteDesc = getAppetiteDescription(data.nutrition.appetite, 'zh-TW');
    subjective.push(appetiteDesc);
  }

  sections.push('S: ' + subjective.join('。'));

  // O (Objective)
  const objective = [];

  // Vital signs
  if (data.vitals) {
    const vitalParts = [];

    if (data.vitals.blood_pressure) {
      const { systolic, diastolic } = data.vitals.blood_pressure;
      if (systolic && diastolic) {
        vitalParts.push(`BP ${systolic}/${diastolic}`);
      }
    }
    if (data.vitals.heart_rate) vitalParts.push(`HR ${data.vitals.heart_rate}`);
    if (data.vitals.temperature) vitalParts.push(`T ${data.vitals.temperature}°C`);
    if (data.vitals.respiratory_rate) vitalParts.push(`RR ${data.vitals.respiratory_rate}`);
    if (data.vitals.oxygen_saturation) vitalParts.push(`SpO2 ${data.vitals.oxygen_saturation}%`);

    if (vitalParts.length > 0) {
      objective.push(vitalParts.join(', '));
    }
  }

  // Nutrition
  if (data.nutrition?.intake_percent !== null) {
    objective.push(`營養攝入${data.nutrition.intake_percent}%`);
  }

  // Consciousness
  if (data.consciousness) {
    const consciousDesc = getConsciousnessDescription(data.consciousness.level, 'zh-TW');
    let fullDesc = consciousDesc;

    if (data.consciousness.orientation) {
      const { person, place, time } = data.consciousness.orientation;
      if (person && place && time) {
        fullDesc += '，定向力完整';
      }
    }
    objective.push(fullDesc);
  }

  // Mobility
  if (data.mobility?.status) {
    const mobilityDesc = getMobilityDescription(
      data.mobility.status,
      data.mobility.assistance_required,
      'zh-TW'
    );
    objective.push(mobilityDesc);
  }

  // Wound
  if (data.wound?.present) {
    const woundDesc = getWoundDescription(data.wound, 'zh-TW');
    objective.push(woundDesc);
  }

  sections.push('O: ' + objective.join('。'));

  // A (Assessment)
  const assessment = generateAssessment(data, 'zh-TW');
  sections.push('A: ' + assessment);

  // P (Plan)
  const plan = generatePlan(data, 'zh-TW');
  sections.push('P: ' + plan);

  return sections.join('\n');
}

// Helper functions

function getSleepDescription(quality, hours, lang) {
  const templates = {
    'ja': {
      'good': `昨夜はよく眠れた${hours ? `（${hours}時間）` : ''}`,
      'fair': `睡眠は普通${hours ? `（${hours}時間）` : ''}`,
      'poor': `睡眠不良${hours ? `（${hours}時間）` : ''}`
    },
    'en': {
      'good': `Slept well last night${hours ? ` (${hours} hours)` : ''}`,
      'fair': `Sleep was fair${hours ? ` (${hours} hours)` : ''}`,
      'poor': `Poor sleep quality${hours ? ` (${hours} hours)` : ''}`
    },
    'zh-TW': {
      'good': `昨晚睡眠良好${hours ? `（${hours}小時）` : ''}`,
      'fair': `睡眠尚可${hours ? `（${hours}小時）` : ''}`,
      'poor': `睡眠不佳${hours ? `（${hours}小時）` : ''}`
    }
  };

  return templates[lang]?.[quality] || templates[lang]?.['fair'] || '';
}

function getAppetiteDescription(appetite, lang) {
  const templates = {
    'ja': {
      'good': '食欲良好',
      'fair': '食欲普通',
      'poor': '食欲不振'
    },
    'en': {
      'good': 'Good appetite',
      'fair': 'Fair appetite',
      'poor': 'Poor appetite'
    },
    'zh-TW': {
      'good': '食慾良好',
      'fair': '食慾普通',
      'poor': '食慾不振'
    }
  };

  return templates[lang]?.[appetite] || '';
}

function getConsciousnessDescription(level, lang) {
  const templates = {
    'ja': {
      'alert': '意識清明',
      'drowsy': '傾眠傾向',
      'lethargic': '嗜眠状態',
      'confused': '混乱状態'
    },
    'en': {
      'alert': 'Alert and oriented',
      'drowsy': 'Drowsy',
      'lethargic': 'Lethargic',
      'confused': 'Confused'
    },
    'zh-TW': {
      'alert': '意識清楚',
      'drowsy': '嗜睡',
      'lethargic': '昏睡',
      'confused': '意識混亂'
    }
  };

  return templates[lang]?.[level] || templates[lang]?.['alert'] || '';
}

function getMobilityDescription(status, assistanceRequired, lang) {
  const templates = {
    'ja': {
      'independent': '自立歩行可能',
      'assisted': '介助歩行',
      'wheelchair': '車椅子使用',
      'bedbound': '臥床'
    },
    'en': {
      'independent': 'Ambulates independently',
      'assisted': 'Ambulates with assistance',
      'wheelchair': 'Wheelchair mobility',
      'bedbound': 'Bedbound'
    },
    'zh-TW': {
      'independent': '可獨立行走',
      'assisted': '需協助行走',
      'wheelchair': '使用輪椅',
      'bedbound': '臥床'
    }
  };

  return templates[lang]?.[status] || '';
}

function getWoundDescription(wound, lang) {
  const { location, stage, size_cm, description } = wound;

  const templates = {
    'ja': `創傷あり：${location || '部位不明'}${stage ? `、ステージ${stage}` : ''}${size_cm ? `、${size_cm}cm` : ''}${description ? `、${description}` : ''}`,
    'en': `Wound present: ${location || 'unspecified location'}${stage ? `, stage ${stage}` : ''}${size_cm ? `, ${size_cm}cm` : ''}${description ? `, ${description}` : ''}`,
    'zh-TW': `傷口：${location || '部位不明'}${stage ? `，分期${stage}` : ''}${size_cm ? `，${size_cm}cm` : ''}${description ? `，${description}` : ''}`
  };

  return templates[lang] || '';
}

function generateAssessment(data, lang) {
  const templates = {
    'ja': () => {
      const parts = [];

      // Vital signs assessment
      if (data.vitals?.blood_pressure) {
        const { systolic } = data.vitals.blood_pressure;
        if (systolic > 140) {
          parts.push('血圧やや高値');
        } else if (systolic < 90) {
          parts.push('血圧やや低値');
        } else {
          parts.push('バイタルサイン安定');
        }
      } else {
        parts.push('バイタルサイン概ね安定');
      }

      // Pain assessment
      if (data.pain?.present && data.pain.intensity > 5) {
        parts.push('疼痛コントロール要');
      }

      // Nutrition assessment
      if (data.nutrition?.intake_percent < 50) {
        parts.push('栄養摂取不良');
      } else if (data.nutrition?.intake_percent >= 80) {
        parts.push('栄養摂取良好');
      }

      return parts.join('。') + '。';
    },
    'en': () => {
      const parts = [];

      if (data.vitals?.blood_pressure) {
        const { systolic } = data.vitals.blood_pressure;
        if (systolic > 140) {
          parts.push('Blood pressure slightly elevated');
        } else if (systolic < 90) {
          parts.push('Blood pressure low');
        } else {
          parts.push('Vital signs stable');
        }
      } else {
        parts.push('Vital signs generally stable');
      }

      if (data.pain?.present && data.pain.intensity > 5) {
        parts.push('Pain management needed');
      }

      if (data.nutrition?.intake_percent < 50) {
        parts.push('Poor nutritional intake');
      } else if (data.nutrition?.intake_percent >= 80) {
        parts.push('Good nutritional intake');
      }

      return parts.join('. ') + '.';
    },
    'zh-TW': () => {
      const parts = [];

      if (data.vitals?.blood_pressure) {
        const { systolic } = data.vitals.blood_pressure;
        if (systolic > 140) {
          parts.push('血壓略高');
        } else if (systolic < 90) {
          parts.push('血壓偏低');
        } else {
          parts.push('生命徵象穩定');
        }
      } else {
        parts.push('生命徵象大致穩定');
      }

      if (data.pain?.present && data.pain.intensity > 5) {
        parts.push('需要疼痛控制');
      }

      if (data.nutrition?.intake_percent < 50) {
        parts.push('營養攝入不良');
      } else if (data.nutrition?.intake_percent >= 80) {
        parts.push('營養攝入良好');
      }

      return parts.join('。') + '。';
    }
  };

  const generator = templates[lang] || templates['en'];
  return generator();
}

function generatePlan(data, lang) {
  const templates = {
    'ja': () => {
      const parts = ['通常の看護ケア継続'];

      if (data.vitals?.blood_pressure?.systolic > 140) {
        parts.push('血圧の継続モニタリング');
      }

      if (data.pain?.present && data.pain.intensity > 5) {
        parts.push('疼痛管理の強化');
      }

      if (data.nutrition?.intake_percent < 50) {
        parts.push('栄養摂取の促進');
      }

      parts.push('医師への報告済み');

      return parts.join('。') + '。';
    },
    'en': () => {
      const parts = ['Continue routine nursing care'];

      if (data.vitals?.blood_pressure?.systolic > 140) {
        parts.push('Monitor blood pressure closely');
      }

      if (data.pain?.present && data.pain.intensity > 5) {
        parts.push('Enhance pain management');
      }

      if (data.nutrition?.intake_percent < 50) {
        parts.push('Encourage nutritional intake');
      }

      parts.push('Physician notified');

      return parts.join('. ') + '.';
    },
    'zh-TW': () => {
      const parts = ['持續常規護理'];

      if (data.vitals?.blood_pressure?.systolic > 140) {
        parts.push('持續監測血壓');
      }

      if (data.pain?.present && data.pain.intensity > 5) {
        parts.push('加強疼痛管理');
      }

      if (data.nutrition?.intake_percent < 50) {
        parts.push('促進營養攝入');
      }

      parts.push('已通知醫師');

      return parts.join('。') + '。';
    }
  };

  const generator = templates[lang] || templates['en'];
  return generator();
}

export default {
  generateSOAPNote
};