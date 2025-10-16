/**
 * Vital Signs Assessment Module
 *
 * Implements vital signs color-coding based on:
 * - JSH 2019 (Japanese Society of Hypertension) for Blood Pressure
 * - JASSO 2022 (Japan Society for the Study of Obesity) for BMI
 * - International standards for other vitals
 *
 * Age, gender, and condition-aware assessments for Japanese clinical context
 */

export interface PatientDemographics {
  age: number;
  gender: 'male' | 'female';
  isAthlete?: boolean;
  hasCOPD?: boolean;
  personalBaselineTemp?: number; // in Celsius
}

export interface VitalSigns {
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  temperature?: number; // in Celsius
  spO2?: number;
  respiratoryRate?: number;
  weight?: number; // in kg
  height?: number; // in cm
}

export type VitalStatus = 'green' | 'yellow' | 'red' | 'blue' | 'orange';

export interface VitalSignResult {
  value: number;
  status: VitalStatus;
  statusLabel: string;
  statusLabelJa: string;
  emoji: string;
  clinicalNote?: string;
  clinicalNoteJa?: string;
  guideline?: string;
}

export type VitalSignsAssessment = Partial<Record<
  'bloodPressure' | 'heartRate' | 'temperature' | 'spO2' | 'respiratoryRate' | 'bmi',
  VitalSignResult
>>;

/**
 * Assess blood pressure based on JSH 2019 guidelines
 * Age-dependent ranges for Japanese populations
 */
function assessBloodPressure(
  systolic: number,
  demographics: PatientDemographics
): VitalSignResult {
  const { age } = demographics;

  // Pediatric check
  if (age < 18) {
    return {
      value: systolic,
      status: 'yellow',
      statusLabel: 'Pediatric - Use Age-Specific Charts',
      statusLabelJa: '小児 - 年齢別チャートを使用',
      emoji: '⚠️',
      clinicalNote: 'Pediatric vital signs require age-specific percentile charts. Contact your pediatrician.',
      clinicalNoteJa: '小児のバイタルサインは年齢別パーセンタイルチャートが必要です。小児科医にご相談ください。',
      guideline: 'Pediatric Guidelines',
    };
  }

  // Adults 18-74 years (JSH 2019)
  if (age >= 18 && age < 75) {
    if (systolic < 90) {
      return {
        value: systolic,
        status: 'red',
        statusLabel: 'Hypotension',
        statusLabelJa: '低血圧',
        emoji: '🔴',
        clinicalNote: 'Blood pressure below normal range. May indicate shock, dehydration, or other serious conditions.',
        clinicalNoteJa: '血圧が正常範囲を下回っています。ショック、脱水症、その他の重篤な状態を示す可能性があります。',
        guideline: 'JSH 2019',
      };
    }
    if (systolic < 120) {
      return {
        value: systolic,
        status: 'green',
        statusLabel: 'Optimal Blood Pressure',
        statusLabelJa: '至適血圧',
        emoji: '🟢',
        clinicalNote: 'Blood pressure within optimal range per JSH 2019.',
        clinicalNoteJa: 'JSH 2019基準で至適血圧範囲内です。',
        guideline: 'JSH 2019',
      };
    }
    if (systolic < 140) {
      return {
        value: systolic,
        status: 'yellow',
        statusLabel: 'Elevated Blood Pressure',
        statusLabelJa: '高値血圧',
        emoji: '🟡',
        clinicalNote: 'High-Normal BP per JSH 2019. Recommend lifestyle intervention and monitoring.',
        clinicalNoteJa: 'JSH 2019基準で高値血圧です。生活習慣の改善と経過観察をお勧めします。',
        guideline: 'JSH 2019',
      };
    }
    return {
      value: systolic,
      status: 'red',
      statusLabel: 'Hypertension',
      statusLabelJa: '高血圧',
      emoji: '🔴',
      clinicalNote: 'Blood pressure ≥140 mmHg indicates hypertension per JSH 2019. Medical evaluation recommended.',
      clinicalNoteJa: '収縮期血圧≥140 mmHgはJSH 2019基準で高血圧です。医療評価が推奨されます。',
      guideline: 'JSH 2019',
    };
  }

  // Adults ≥75 years (JSH 2019)
  if (systolic < 90) {
    return {
      value: systolic,
      status: 'red',
      statusLabel: 'Hypotension',
      statusLabelJa: '低血圧',
      emoji: '🔴',
      clinicalNote: 'Blood pressure below safe range for elderly patients. Risk of falls and organ hypoperfusion.',
      clinicalNoteJa: '高齢者の安全範囲を下回る血圧です。転倒および臓器低灌流のリスクがあります。',
      guideline: 'JSH 2019',
    };
  }
  if (systolic < 140) {
    return {
      value: systolic,
      status: 'green',
      statusLabel: 'Optimal BP (Elderly)',
      statusLabelJa: '至適血圧（高齢者）',
      emoji: '🟢',
      clinicalNote: 'Blood pressure within target range for elderly patients per JSH 2019.',
      clinicalNoteJa: 'JSH 2019基準で高齢者の目標血圧範囲内です。',
      guideline: 'JSH 2019',
    };
  }
  if (systolic < 160) {
    return {
      value: systolic,
      status: 'yellow',
      statusLabel: 'Elevated BP (Elderly)',
      statusLabelJa: '高値血圧（高齢者）',
      emoji: '🟡',
      clinicalNote: 'Blood pressure elevated for elderly patients. Consider treatment if other risk factors present.',
      clinicalNoteJa: '高齢者の血圧が高めです。他のリスク因子がある場合は治療を検討してください。',
      guideline: 'JSH 2019',
    };
  }
  return {
    value: systolic,
    status: 'red',
    statusLabel: 'Hypertension (Elderly)',
    statusLabelJa: '高血圧（高齢者）',
    emoji: '🔴',
    clinicalNote: 'Blood pressure ≥160 mmHg in elderly patient. Treatment recommended per JSH 2019.',
    clinicalNoteJa: '高齢者の収縮期血圧≥160 mmHgです。JSH 2019基準で治療が推奨されます。',
    guideline: 'JSH 2019',
  };
}

/**
 * Assess heart rate with gender-specific ranges
 * Accounts for athlete status
 */
function assessHeartRate(
  heartRate: number,
  demographics: PatientDemographics
): VitalSignResult {
  const { age, gender, isAthlete } = demographics;

  // Pediatric check
  if (age < 18) {
    return {
      value: heartRate,
      status: 'yellow',
      statusLabel: 'Pediatric - Use Age-Specific Range',
      statusLabelJa: '小児 - 年齢別範囲を使用',
      emoji: '⚠️',
      clinicalNote: 'Pediatric heart rates vary significantly by age. Consult age-specific ranges.',
      clinicalNoteJa: '小児の心拍数は年齢により大きく異なります。年齢別範囲をご確認ください。',
      guideline: 'Pediatric Guidelines',
    };
  }

  // Gender-specific ranges for adults
  const ranges = gender === 'female'
    ? { greenLow: 65, greenHigh: 95, yellowLow: 50, yellowHigh: 110 }
    : { greenLow: 60, greenHigh: 90, yellowLow: 45, yellowHigh: 105 };

  // Adjust for athletes
  if (isAthlete) {
    ranges.greenLow = 40;
    ranges.yellowLow = 35;
  }

  // Critical low
  if (heartRate < ranges.yellowLow) {
    return {
      value: heartRate,
      status: 'red',
      statusLabel: 'Severe Bradycardia',
      statusLabelJa: '重度の徐脈',
      emoji: '🔴',
      clinicalNote: `Heart rate critically low for ${gender}. Immediate medical evaluation required.`,
      clinicalNoteJa: `${gender === 'female' ? '女性' : '男性'}として心拍数が著しく低いです。至急医療評価が必要です。`,
      guideline: 'International Standard',
    };
  }

  // Yellow low
  if (heartRate < ranges.greenLow) {
    const athleteNote = isAthlete
      ? ' Bradycardia is normal for trained athletes.'
      : ' Consider cardiac evaluation if symptomatic.';
    const athleteNoteJa = isAthlete
      ? ' 訓練されたアスリートには徐脈は正常です。'
      : ' 症状がある場合は心臓評価を検討してください。';

    return {
      value: heartRate,
      status: 'yellow',
      statusLabel: isAthlete ? 'Athlete Bradycardia' : 'Bradycardia',
      statusLabelJa: isAthlete ? 'アスリート性徐脈' : '徐脈',
      emoji: '🟡',
      clinicalNote: `Heart rate below normal range for ${gender}.${athleteNote}`,
      clinicalNoteJa: `${gender === 'female' ? '女性' : '男性'}として心拍数が正常範囲を下回っています。${athleteNoteJa}`,
      guideline: 'International Standard',
    };
  }

  // Green range
  if (heartRate <= ranges.greenHigh) {
    return {
      value: heartRate,
      status: 'green',
      statusLabel: 'Normal Heart Rate',
      statusLabelJa: '正常心拍数',
      emoji: '🟢',
      clinicalNote: `Heart rate within normal range for adult ${gender}.`,
      clinicalNoteJa: `成人${gender === 'female' ? '女性' : '男性'}として正常範囲内の心拍数です。`,
      guideline: 'International Standard',
    };
  }

  // Yellow high
  if (heartRate <= ranges.yellowHigh) {
    return {
      value: heartRate,
      status: 'yellow',
      statusLabel: 'Tachycardia',
      statusLabelJa: '頻脈',
      emoji: '🟡',
      clinicalNote: `Heart rate elevated for ${gender}. May indicate stress, dehydration, or underlying condition.`,
      clinicalNoteJa: `${gender === 'female' ? '女性' : '男性'}として心拍数が高めです。ストレス、脱水、または基礎疾患を示す可能性があります。`,
      guideline: 'International Standard',
    };
  }

  // Critical high
  return {
    value: heartRate,
    status: 'red',
    statusLabel: 'Severe Tachycardia',
    statusLabelJa: '重度の頻脈',
    emoji: '🔴',
    clinicalNote: `Heart rate critically elevated for ${gender}. Immediate medical evaluation required.`,
    clinicalNoteJa: `${gender === 'female' ? '女性' : '男性'}として心拍数が著しく高いです。至急医療評価が必要です。`,
    guideline: 'International Standard',
  };
}

/**
 * Assess body temperature with age awareness
 * Considers personal baseline for elderly patients
 */
function assessTemperature(
  temperature: number,
  demographics: PatientDemographics
): VitalSignResult {
  const { age, personalBaselineTemp } = demographics;

  // Check for physiologically impossible values
  if (temperature > 45 || temperature < 25) {
    return {
      value: temperature,
      status: 'red',
      statusLabel: 'Data Entry Error',
      statusLabelJa: 'データ入力エラー',
      emoji: '❌',
      clinicalNote: 'Temperature value is physiologically impossible. Please verify measurement.',
      clinicalNoteJa: '体温の値が生理学的に不可能です。測定を確認してください。',
      guideline: 'Validation Check',
    };
  }

  // Elderly with baseline temperature
  if (age >= 65 && personalBaselineTemp) {
    const delta = temperature - personalBaselineTemp;

    if (delta >= 1.5) {
      return {
        value: temperature,
        status: 'red',
        statusLabel: 'Significant Fever (Elderly)',
        statusLabelJa: '重大な発熱（高齢者）',
        emoji: '🔴',
        clinicalNote: `Temperature ≥1.5°C above personal baseline (${personalBaselineTemp}°C). Elderly patients may not mount typical fever responses. Investigate for infection.`,
        clinicalNoteJa: `個人基準値（${personalBaselineTemp}°C）より≥1.5°C高い体温です。高齢者は典型的な発熱反応を示さない可能性があります。感染を調査してください。`,
        guideline: 'Geriatric Medicine',
      };
    }

    if (delta >= 1.0) {
      return {
        value: temperature,
        status: 'yellow',
        statusLabel: 'Elevated from Baseline (Elderly)',
        statusLabelJa: '基準値より上昇（高齢者）',
        emoji: '🟡',
        clinicalNote: `Temperature ≥1.0°C above personal baseline (${personalBaselineTemp}°C). Any elevation from baseline should be investigated in elderly patients.`,
        clinicalNoteJa: `個人基準値（${personalBaselineTemp}°C）より≥1.0°C高い体温です。高齢者では基準値からの上昇はすべて調査すべきです。`,
        guideline: 'Geriatric Medicine',
      };
    }
  }

  // Standard temperature assessment
  if (temperature < 35.0) {
    return {
      value: temperature,
      status: 'red',
      statusLabel: 'Hypothermia',
      statusLabelJa: '低体温症',
      emoji: '🔴',
      clinicalNote: 'Body temperature below 35.0°C indicates hypothermia. Immediate warming and medical evaluation required.',
      clinicalNoteJa: '体温35.0°C未満は低体温症を示します。至急の加温と医療評価が必要です。',
      guideline: 'International Standard',
    };
  }

  if (temperature < 36.0) {
    return {
      value: temperature,
      status: 'yellow',
      statusLabel: 'Below Normal',
      statusLabelJa: '正常より低い',
      emoji: '🟡',
      clinicalNote: 'Body temperature below normal range. Monitor for hypothermia or measurement error.',
      clinicalNoteJa: '体温が正常範囲を下回っています。低体温症または測定誤差を監視してください。',
      guideline: 'International Standard',
    };
  }

  if (temperature <= 37.5) {
    return {
      value: temperature,
      status: 'green',
      statusLabel: 'Normal Temperature',
      statusLabelJa: '正常体温',
      emoji: '🟢',
      clinicalNote: age >= 65
        ? 'Temperature within normal range. Continue monitoring elderly patients for subtle changes.'
        : 'Body temperature within normal range.',
      clinicalNoteJa: age >= 65
        ? '体温が正常範囲内です。高齢者の微妙な変化を引き続き監視してください。'
        : '体温が正常範囲内です。',
      guideline: 'International Standard',
    };
  }

  if (temperature < 38.5) {
    return {
      value: temperature,
      status: 'yellow',
      statusLabel: 'Low-Grade Fever',
      statusLabelJa: '微熱',
      emoji: '🟡',
      clinicalNote: 'Low-grade fever detected. Monitor for infection or other causes.',
      clinicalNoteJa: '微熱が検出されました。感染またはその他の原因を監視してください。',
      guideline: 'International Standard',
    };
  }

  return {
    value: temperature,
    status: 'red',
    statusLabel: 'High Fever',
    statusLabelJa: '高熱',
    emoji: '🔴',
    clinicalNote: 'Temperature ≥38.5°C indicates significant fever. Investigate cause and consider antipyretic treatment.',
    clinicalNoteJa: '体温≥38.5°Cは重大な発熱を示します。原因を調査し、解熱治療を検討してください。',
    guideline: 'International Standard',
  };
}

/**
 * Assess oxygen saturation
 * Adjusts for COPD patients
 */
function assessSpO2(
  spO2: number,
  demographics: PatientDemographics
): VitalSignResult {
  const { hasCOPD } = demographics;

  // COPD patients have different acceptable ranges
  if (hasCOPD) {
    if (spO2 < 85) {
      return {
        value: spO2,
        status: 'red',
        statusLabel: 'Critical Hypoxemia (COPD)',
        statusLabelJa: '重度低酸素血症（COPD）',
        emoji: '🔴',
        clinicalNote: 'SpO2 <85% even for COPD patient indicates critical hypoxemia. Immediate intervention required.',
        clinicalNoteJa: 'COPD患者でもSpO2 <85%は重度の低酸素血症を示します。至急の介入が必要です。',
        guideline: 'COPD Guidelines',
      };
    }
    if (spO2 < 88) {
      return {
        value: spO2,
        status: 'yellow',
        statusLabel: 'Below Target (COPD)',
        statusLabelJa: '目標値未満（COPD）',
        emoji: '🟡',
        clinicalNote: 'SpO2 below typical COPD target. Assess against patient baseline and adjust oxygen therapy.',
        clinicalNoteJa: 'SpO2が典型的なCOPD目標値を下回っています。患者基準値を評価し、酸素療法を調整してください。',
        guideline: 'COPD Guidelines',
      };
    }
    return {
      value: spO2,
      status: 'green',
      statusLabel: 'Acceptable for COPD',
      statusLabelJa: 'COPD患者として許容範囲',
      emoji: '🟢',
      clinicalNote: 'COPD patient: baseline 88-92% may be normal. Assess against patient baseline.',
      clinicalNoteJa: 'COPD患者：基準値88-92%は正常の可能性があります。患者基準値を評価してください。',
      guideline: 'COPD Guidelines',
    };
  }

  // Standard SpO2 assessment
  if (spO2 < 90) {
    return {
      value: spO2,
      status: 'red',
      statusLabel: 'Severe Hypoxemia',
      statusLabelJa: '重度低酸素血症',
      emoji: '🔴',
      clinicalNote: 'SpO2 <90% indicates severe hypoxemia. Immediate oxygen therapy and medical evaluation required.',
      clinicalNoteJa: 'SpO2 <90%は重度の低酸素血症を示します。至急の酸素療法と医療評価が必要です。',
      guideline: 'International Standard',
    };
  }

  if (spO2 < 95) {
    return {
      value: spO2,
      status: 'yellow',
      statusLabel: 'Mild Hypoxemia',
      statusLabelJa: '軽度低酸素血症',
      emoji: '🟡',
      clinicalNote: 'SpO2 90-94% indicates mild hypoxemia. Consider supplemental oxygen and investigate cause.',
      clinicalNoteJa: 'SpO2 90-94%は軽度の低酸素血症を示します。補助酸素を検討し、原因を調査してください。',
      guideline: 'International Standard',
    };
  }

  return {
    value: spO2,
    status: 'green',
    statusLabel: 'Normal Oxygen Saturation',
    statusLabelJa: '正常酸素飽和度',
    emoji: '🟢',
    clinicalNote: 'Oxygen saturation within normal range.',
    clinicalNoteJa: '酸素飽和度が正常範囲内です。',
    guideline: 'International Standard',
  };
}

/**
 * Assess respiratory rate
 * Universal for all adult ages
 */
function assessRespiratoryRate(
  respiratoryRate: number,
  _demographics: PatientDemographics
): VitalSignResult {
  if (respiratoryRate < 10) {
    return {
      value: respiratoryRate,
      status: 'red',
      statusLabel: 'Severe Bradypnea',
      statusLabelJa: '重度徐呼吸',
      emoji: '🔴',
      clinicalNote: 'Respiratory rate <10/min indicates severe bradypnea. Risk of respiratory failure.',
      clinicalNoteJa: '呼吸数<10/分は重度の徐呼吸を示します。呼吸不全のリスクがあります。',
      guideline: 'International Standard',
    };
  }

  if (respiratoryRate < 12) {
    return {
      value: respiratoryRate,
      status: 'yellow',
      statusLabel: 'Bradypnea',
      statusLabelJa: '徐呼吸',
      emoji: '🟡',
      clinicalNote: 'Respiratory rate 10-11/min is below normal. Monitor for respiratory depression.',
      clinicalNoteJa: '呼吸数10-11/分は正常より低いです。呼吸抑制を監視してください。',
      guideline: 'International Standard',
    };
  }

  if (respiratoryRate <= 20) {
    return {
      value: respiratoryRate,
      status: 'green',
      statusLabel: 'Normal Respiratory Rate',
      statusLabelJa: '正常呼吸数',
      emoji: '🟢',
      clinicalNote: 'Respiratory rate within normal range.',
      clinicalNoteJa: '呼吸数が正常範囲内です。',
      guideline: 'International Standard',
    };
  }

  if (respiratoryRate < 25) {
    return {
      value: respiratoryRate,
      status: 'yellow',
      statusLabel: 'Tachypnea - Early Warning',
      statusLabelJa: '頻呼吸 - 早期警告',
      emoji: '🟡',
      clinicalNote: 'Respiratory rate 21-24/min. Early warning sign of respiratory distress or metabolic derangement.',
      clinicalNoteJa: '呼吸数21-24/分。呼吸困難または代謝障害の早期警告兆候です。',
      guideline: 'International Standard',
    };
  }

  return {
    value: respiratoryRate,
    status: 'red',
    statusLabel: 'Severe Tachypnea',
    statusLabelJa: '重度頻呼吸',
    emoji: '🔴',
    clinicalNote: 'Respiratory rate ≥25/min indicates impending crisis. Immediate medical evaluation required.',
    clinicalNoteJa: '呼吸数≥25/分は危機的状態を示します。至急の医療評価が必要です。',
    guideline: 'International Standard',
  };
}

/**
 * Assess BMI using Japanese JASSO 2022 standards
 * Lower obesity threshold than Western standards
 */
function assessBMI(
  weight: number,
  height: number,
  _demographics: PatientDemographics
): VitalSignResult {
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);

  if (bmi < 18.5) {
    return {
      value: parseFloat(bmi.toFixed(1)),
      status: 'blue',
      statusLabel: 'Underweight',
      statusLabelJa: '低体重',
      emoji: '🔵',
      clinicalNote: 'BMI <18.5 indicates underweight. Assess for malnutrition, eating disorders, or chronic disease.',
      clinicalNoteJa: 'BMI <18.5は低体重を示します。栄養失調、摂食障害、または慢性疾患を評価してください。',
      guideline: 'JASSO 2022',
    };
  }

  if (bmi < 23.0) {
    return {
      value: parseFloat(bmi.toFixed(1)),
      status: 'green',
      statusLabel: 'Normal Weight (Japanese Standard)',
      statusLabelJa: '標準体重（日本基準）',
      emoji: '🟢',
      clinicalNote: 'BMI 18.5-22.9 is optimal for Japanese populations per JASSO 2022.',
      clinicalNoteJa: 'BMI 18.5-22.9はJASSO 2022基準で日本人に最適です。',
      guideline: 'JASSO 2022',
    };
  }

  if (bmi < 25.0) {
    return {
      value: parseFloat(bmi.toFixed(1)),
      status: 'yellow',
      statusLabel: 'Overweight (Japanese Standard)',
      statusLabelJa: '肥満（1度前）日本基準',
      emoji: '🟡',
      clinicalNote: 'BMI 23.0-24.9 shows increased metabolic risk in Japanese populations. Western classification: Normal weight.',
      clinicalNoteJa: 'BMI 23.0-24.9は日本人で代謝リスクの増加を示します。欧米分類：標準体重。',
      guideline: 'JASSO 2022',
    };
  }

  if (bmi < 30.0) {
    return {
      value: parseFloat(bmi.toFixed(1)),
      status: 'orange',
      statusLabel: 'Obese Class I (Japanese)',
      statusLabelJa: '肥満（1度）',
      emoji: '🟠',
      clinicalNote: 'BMI 25.0-29.9 indicates obesity per JASSO 2022. Japanese individuals develop obesity-related disorders at lower BMI than Western populations. Western classification: Overweight.',
      clinicalNoteJa: 'BMI 25.0-29.9はJASSO 2022基準で肥満（1度）です。日本人は欧米人より低いBMIで肥満関連疾患を発症します。欧米分類：過体重。',
      guideline: 'JASSO 2022',
    };
  }

  if (bmi < 35.0) {
    return {
      value: parseFloat(bmi.toFixed(1)),
      status: 'red',
      statusLabel: 'Obese Class II (Japanese)',
      statusLabelJa: '肥満（2度）',
      emoji: '🔴',
      clinicalNote: 'BMI 30.0-34.9 indicates Class II obesity per JASSO 2022. Significant health risks. Medical intervention recommended.',
      clinicalNoteJa: 'BMI 30.0-34.9はJASSO 2022基準で肥満（2度）です。重大な健康リスク。医療介入が推奨されます。',
      guideline: 'JASSO 2022',
    };
  }

  return {
    value: parseFloat(bmi.toFixed(1)),
    status: 'red',
    statusLabel: 'High-Degree Obesity (Japanese)',
    statusLabelJa: '高度肥満',
    emoji: '🔴',
    clinicalNote: 'BMI ≥35.0 indicates high-degree obesity per JASSO 2022. Severe health risks. Comprehensive medical management required.',
    clinicalNoteJa: 'BMI ≥35.0はJASSO 2022基準で高度肥満です。重度の健康リスク。包括的な医療管理が必要です。',
    guideline: 'JASSO 2022',
  };
}

/**
 * Main assessment function
 * Evaluates all provided vital signs and returns structured results
 */
export function assessVitalSigns(
  patient: PatientDemographics,
  vitals: VitalSigns
): VitalSignsAssessment {
  const results: VitalSignsAssessment = {};

  if (vitals.systolicBP !== undefined) {
    results.bloodPressure = assessBloodPressure(vitals.systolicBP, patient);
  }

  if (vitals.heartRate !== undefined) {
    results.heartRate = assessHeartRate(vitals.heartRate, patient);
  }

  if (vitals.temperature !== undefined) {
    results.temperature = assessTemperature(vitals.temperature, patient);
  }

  if (vitals.spO2 !== undefined) {
    results.spO2 = assessSpO2(vitals.spO2, patient);
  }

  if (vitals.respiratoryRate !== undefined) {
    results.respiratoryRate = assessRespiratoryRate(vitals.respiratoryRate, patient);
  }

  if (vitals.weight !== undefined && vitals.height !== undefined) {
    results.bmi = assessBMI(vitals.weight, vitals.height, patient);
  }

  return results;
}

/**
 * Get color for status (for UI rendering)
 */
export function getColorForStatus(status: VitalStatus): string {
  const colorMap: Record<VitalStatus, string> = {
    green: '#5B8558',
    yellow: '#FFA726',
    red: '#EF5350',
    blue: '#42A5F5',
    orange: '#FF7043',
  };
  return colorMap[status];
}
