/**
 * Healthcare Assessment Utilities
 * Clinical guideline-based assessment functions for Japanese healthcare
 *
 * Guidelines Implemented:
 * - Blood Glucose: Japanese Diabetes Society standards
 * - BMI: JASSO 2022 (Japan Society for the Study of Obesity)
 * - Pain: NRS (Numeric Rating Scale) 0-10
 * - Consciousness: JCS (Japan Coma Scale)
 * - Fall Risk: Multi-factorial assessment
 * - Kihon Checklist: MHLW (Ministry of Health, Labour and Welfare) standards
 */

export interface AssessmentResult {
  value: number | string;
  status: 'green' | 'yellow' | 'red' | 'blue' | 'orange';
  statusLabel: string;
  statusLabelJa: string;
  emoji: string;
  clinicalNote?: string;
  clinicalNoteJa?: string;
}

// ============================================================================
// BLOOD GLUCOSE ASSESSMENT
// ============================================================================

export type GlucoseTestType = 'fasting' | 'random' | 'postprandial' | 'bedtime';

export interface GlucoseAssessmentResult extends AssessmentResult {
  valueInMgDl: number;
  valueInMmolL: number;
}

/**
 * Assess blood glucose level according to Japanese Diabetes Society standards
 * @param value - Glucose value
 * @param unit - mg/dL or mmol/L
 * @param testType - When the test was performed
 */
export function assessBloodGlucose(
  value: number,
  unit: 'mg/dL' | 'mmol/L' = 'mg/dL',
  testType: GlucoseTestType = 'random'
): GlucoseAssessmentResult {
  // Convert to mg/dL for assessment
  const mgdl = unit === 'mmol/L' ? value * 18.018 : value;
  const mmoll = unit === 'mg/dL' ? value / 18.018 : value;

  let status: 'green' | 'yellow' | 'red';
  let statusLabel: string;
  let statusLabelJa: string;
  let emoji: string;
  let clinicalNote: string | undefined;
  let clinicalNoteJa: string | undefined;

  if (testType === 'fasting') {
    // Fasting glucose assessment
    if (mgdl < 70) {
      status = 'red';
      statusLabel = 'Hypoglycemia';
      statusLabelJa = '低血糖';
      emoji = '🔴';
      clinicalNote = 'Critical - Treat immediately';
      clinicalNoteJa = '直ちに対処必要';
    } else if (mgdl >= 70 && mgdl <= 99) {
      status = 'green';
      statusLabel = 'Normal';
      statusLabelJa = '正常';
      emoji = '🟢';
    } else if (mgdl >= 100 && mgdl <= 125) {
      status = 'yellow';
      statusLabel = 'Prediabetic';
      statusLabelJa = '糖尿病予備軍';
      emoji = '🟡';
      clinicalNote = 'Lifestyle intervention recommended';
      clinicalNoteJa = '生活習慣改善推奨';
    } else {
      status = 'red';
      statusLabel = 'Diabetic Range';
      statusLabelJa = '糖尿病域';
      emoji = '🔴';
      clinicalNote = 'Medical evaluation required';
      clinicalNoteJa = '医療機関への受診推奨';
    }
  } else {
    // Random/Postprandial/Bedtime glucose assessment
    if (mgdl < 60) {
      status = 'red';
      statusLabel = 'Severe Hypoglycemia';
      statusLabelJa = '重度低血糖';
      emoji = '🔴';
      clinicalNote = 'Critical - Immediate intervention required';
      clinicalNoteJa = '緊急対応必要';
    } else if (mgdl >= 60 && mgdl < 70) {
      status = 'yellow';
      statusLabel = 'Mild Hypoglycemia';
      statusLabelJa = '軽度低血糖';
      emoji = '🟡';
      clinicalNote = 'Monitor closely';
      clinicalNoteJa = '経過観察';
    } else if (mgdl >= 70 && mgdl <= 140) {
      status = 'green';
      statusLabel = 'Normal';
      statusLabelJa = '正常範囲';
      emoji = '🟢';
    } else if (mgdl > 140 && mgdl <= 180) {
      status = 'yellow';
      statusLabel = 'Borderline High';
      statusLabelJa = '境界域';
      emoji = '🟡';
      clinicalNote = 'Monitor closely';
      clinicalNoteJa = '経過観察必要';
    } else if (mgdl > 180 && mgdl < 400) {
      status = 'red';
      statusLabel = 'Hyperglycemia';
      statusLabelJa = '高血糖';
      emoji = '🔴';
      clinicalNote = 'Immediate intervention required';
      clinicalNoteJa = '直ちに介入必要';
    } else {
      status = 'red';
      statusLabel = 'Critical Hyperglycemia';
      statusLabelJa = '重度高血糖';
      emoji = '🔴';
      clinicalNote = 'Emergency - Verify reading and treat immediately';
      clinicalNoteJa = '緊急 - 測定値確認と即時対応';
    }
  }

  return {
    value: mgdl,
    valueInMgDl: mgdl,
    valueInMmolL: mmoll,
    status,
    statusLabel,
    statusLabelJa,
    emoji,
    clinicalNote,
    clinicalNoteJa,
  };
}

// ============================================================================
// WEIGHT & BMI ASSESSMENT
// ============================================================================

export interface WeightAssessmentResult {
  weight: number; // in kg
  bmi?: number;
  bmiStatus?: 'green' | 'yellow' | 'red' | 'blue';
  bmiLabel?: string;
  bmiLabelJa?: string;
  weightChange?: {
    previous: number;
    percentage: number;
    status: 'green' | 'yellow' | 'red';
    label: string;
    labelJa: string;
  };
}

/**
 * Assess weight and BMI according to JASSO 2022 standards
 * @param weightKg - Current weight in kg
 * @param heightCm - Height in cm
 * @param previousWeightKg - Previous weight for change tracking
 */
export function assessWeight(
  weightKg: number,
  heightCm?: number,
  previousWeightKg?: number
): WeightAssessmentResult {
  const result: WeightAssessmentResult = {
    weight: weightKg,
  };

  // Calculate BMI if height is available
  if (heightCm) {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    result.bmi = Math.round(bmi * 10) / 10;

    // JASSO 2022 BMI Classification for Japanese adults
    if (bmi < 18.5) {
      result.bmiStatus = 'blue';
      result.bmiLabel = 'Underweight';
      result.bmiLabelJa = '低体重';
    } else if (bmi >= 18.5 && bmi < 23.0) {
      result.bmiStatus = 'green';
      result.bmiLabel = 'Normal';
      result.bmiLabelJa = '標準';
    } else if (bmi >= 23.0 && bmi < 25.0) {
      result.bmiStatus = 'yellow';
      result.bmiLabel = 'Overweight';
      result.bmiLabelJa = '過体重';
    } else if (bmi >= 25.0 && bmi < 30.0) {
      result.bmiStatus = 'yellow';
      result.bmiLabel = 'Obese Class I';
      result.bmiLabelJa = '肥満1度';
    } else if (bmi >= 30.0 && bmi < 35.0) {
      result.bmiStatus = 'red';
      result.bmiLabel = 'Obese Class II';
      result.bmiLabelJa = '肥満2度';
    } else {
      result.bmiStatus = 'red';
      result.bmiLabel = 'High-Degree Obesity';
      result.bmiLabelJa = '高度肥満';
    }
  }

  // Calculate weight change if previous weight available
  if (previousWeightKg) {
    const change = weightKg - previousWeightKg;
    const percentage = (change / previousWeightKg) * 100;

    let status: 'green' | 'yellow' | 'red';
    let label: string;
    let labelJa: string;

    if (percentage <= -5) {
      status = 'red';
      label = 'Critical Weight Loss';
      labelJa = '重大な体重減少';
    } else if (percentage <= -3) {
      status = 'yellow';
      label = 'Significant Weight Loss';
      labelJa = '有意な体重減少';
    } else if (percentage >= 3) {
      status = 'yellow';
      label = 'Significant Weight Gain';
      labelJa = '有意な体重増加';
    } else {
      status = 'green';
      label = 'Stable';
      labelJa = '安定';
    }

    result.weightChange = {
      previous: previousWeightKg,
      percentage: Math.round(percentage * 10) / 10,
      status,
      label,
      labelJa,
    };
  }

  return result;
}

// ============================================================================
// PAIN ASSESSMENT (NRS 0-10)
// ============================================================================

export interface PainAssessmentResult extends AssessmentResult {
  score: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}

/**
 * Assess pain using Numeric Rating Scale (NRS 0-10)
 * @param score - Pain score from 0 (no pain) to 10 (worst pain)
 */
export function assessPain(score: number): PainAssessmentResult {
  let status: 'green' | 'yellow' | 'red';
  let severity: 'none' | 'mild' | 'moderate' | 'severe';
  let statusLabel: string;
  let statusLabelJa: string;
  let emoji: string;
  let clinicalNote: string | undefined;
  let clinicalNoteJa: string | undefined;

  if (score === 0) {
    status = 'green';
    severity = 'none';
    statusLabel = 'No Pain';
    statusLabelJa = '痛みなし';
    emoji = '🟢';
  } else if (score >= 1 && score <= 3) {
    status = 'green';
    severity = 'mild';
    statusLabel = 'Mild Pain';
    statusLabelJa = '軽度の痛み';
    emoji = '🟢';
  } else if (score >= 4 && score <= 6) {
    status = 'yellow';
    severity = 'moderate';
    statusLabel = 'Moderate Pain';
    statusLabelJa = '中等度の痛み';
    emoji = '🟡';
    clinicalNote = 'Intervention required';
    clinicalNoteJa = '介入必要';
  } else {
    status = 'red';
    severity = 'severe';
    statusLabel = 'Severe Pain';
    statusLabelJa = '重度の痛み';
    emoji = '🔴';
    clinicalNote = 'Immediate intervention required';
    clinicalNoteJa = '直ちに介入必要';
  }

  return {
    value: score,
    score,
    severity,
    status,
    statusLabel,
    statusLabelJa,
    emoji,
    clinicalNote,
    clinicalNoteJa,
  };
}

// ============================================================================
// CONSCIOUSNESS ASSESSMENT (JCS - Japan Coma Scale)
// ============================================================================

export type JCSLevel = 0 | 1 | 2 | 3 | 10 | 20 | 30 | 100 | 200 | 300;
export type JCSCategory = 'alert' | 'awake' | 'arousable' | 'coma';

export interface ConsciousnessAssessmentResult extends AssessmentResult {
  jcsLevel: JCSLevel;
  jcsCategory: JCSCategory;
}

/**
 * Assess consciousness using Japan Coma Scale (JCS)
 * @param jcsLevel - JCS level (0, 1-3, 10-30, 100-300)
 */
export function assessConsciousness(jcsLevel: JCSLevel): ConsciousnessAssessmentResult {
  let status: 'green' | 'yellow' | 'red' | 'orange';
  let jcsCategory: JCSCategory;
  let statusLabel: string;
  let statusLabelJa: string;
  let emoji: string;
  let clinicalNote: string | undefined;
  let clinicalNoteJa: string | undefined;

  if (jcsLevel === 0) {
    status = 'green';
    jcsCategory = 'alert';
    statusLabel = 'Alert';
    statusLabelJa = '清明';
    emoji = '🟢';
  } else if (jcsLevel >= 1 && jcsLevel <= 3) {
    status = 'yellow';
    jcsCategory = 'awake';
    statusLabel = 'Awake but not lucid';
    statusLabelJa = '刺激なしで覚醒';
    emoji = '🟡';
    clinicalNote = 'Monitor closely';
    clinicalNoteJa = '経過観察';
  } else if (jcsLevel >= 10 && jcsLevel <= 30) {
    status = 'orange';
    jcsCategory = 'arousable';
    statusLabel = 'Arousable with stimulation';
    statusLabelJa = '刺激で覚醒';
    emoji = '🟠';
    clinicalNote = 'Urgent evaluation required';
    clinicalNoteJa = '緊急評価必要';
  } else {
    status = 'red';
    jcsCategory = 'coma';
    statusLabel = 'Coma';
    statusLabelJa = '昏睡';
    emoji = '🔴';
    clinicalNote = 'CRITICAL - Immediate medical intervention';
    clinicalNoteJa = '緊急 - 直ちに医師へ連絡';
  }

  return {
    value: jcsLevel,
    jcsLevel,
    jcsCategory,
    status,
    statusLabel,
    statusLabelJa,
    emoji,
    clinicalNote,
    clinicalNoteJa,
  };
}

// ============================================================================
// FALL RISK ASSESSMENT
// ============================================================================

export interface FallRiskFactors {
  historyOfFalls: boolean;
  usesAssistiveDevice: boolean;
  unsteadyGait: boolean;
  cognitiveImpairment: boolean;
  highRiskMedications: boolean;
  visionProblems?: boolean;
  environmentalHazards?: boolean;
  urinaryIncontinence?: boolean;
}

export interface FallRiskAssessmentResult {
  score: number;
  riskLevel: 'low' | 'moderate' | 'high';
  status: 'green' | 'yellow' | 'red';
  statusLabel: string;
  statusLabelJa: string;
  emoji: string;
  interventions: string[];
  interventionsJa: string[];
}

/**
 * Assess fall risk using multi-factorial assessment
 * @param factors - Risk factor checklist
 */
export function assessFallRisk(factors: FallRiskFactors): FallRiskAssessmentResult {
  // Calculate score (1 point per factor)
  let score = 0;
  if (factors.historyOfFalls) score++;
  if (factors.usesAssistiveDevice) score++;
  if (factors.unsteadyGait) score++;
  if (factors.cognitiveImpairment) score++;
  if (factors.highRiskMedications) score++;
  if (factors.visionProblems) score++;
  if (factors.environmentalHazards) score++;
  if (factors.urinaryIncontinence) score++;

  let riskLevel: 'low' | 'moderate' | 'high';
  let status: 'green' | 'yellow' | 'red';
  let statusLabel: string;
  let statusLabelJa: string;
  let emoji: string;
  let interventions: string[];
  let interventionsJa: string[];

  if (score <= 1) {
    riskLevel = 'low';
    status = 'green';
    statusLabel = 'Low Risk';
    statusLabelJa = '低リスク';
    emoji = '🟢';
    interventions = ['Standard fall precautions', 'Annual reassessment'];
    interventionsJa = ['標準的な転倒予防対策', '年1回の再評価'];
  } else if (score >= 2 && score <= 3) {
    riskLevel = 'moderate';
    status = 'yellow';
    statusLabel = 'Moderate Risk';
    statusLabelJa = '中等度リスク';
    emoji = '🟡';
    interventions = [
      'Environmental modifications',
      'Assistive devices as needed',
      'Exercise/balance training',
      'Quarterly reassessment',
    ];
    interventionsJa = [
      '環境改善',
      '必要に応じて補助具使用',
      '運動・バランス訓練',
      '3ヶ月ごとの再評価',
    ];
  } else {
    riskLevel = 'high';
    status = 'red';
    statusLabel = 'High Risk';
    statusLabelJa = '高リスク';
    emoji = '🔴';
    interventions = [
      'Comprehensive fall prevention program',
      'Close monitoring/supervision',
      'Medication review with physician',
      'Physical therapy consultation',
      'Consider bed/chair alarms',
      'Monthly reassessment',
    ];
    interventionsJa = [
      '包括的転倒予防プログラム',
      '継続的監視・見守り',
      '服薬内容の見直し',
      '理学療法士への相談',
      'ベッド・椅子センサーの検討',
      '月1回の再評価',
    ];
  }

  return {
    score,
    riskLevel,
    status,
    statusLabel,
    statusLabelJa,
    emoji,
    interventions,
    interventionsJa,
  };
}

// ============================================================================
// KIHON CHECKLIST ASSESSMENT
// ============================================================================

export interface KihonChecklistScores {
  iadl: number; // 0-5
  physical: number; // 0-5
  nutrition: number; // 0-2
  oral: number; // 0-3
  housebound: number; // 0-2
  cognitive: number; // 0-3
  depressive: number; // 0-5
}

export interface KihonChecklistResult {
  totalScore: number; // 0-25
  domainScores: KihonChecklistScores;
  frailtyStatus: 'robust' | 'prefrail' | 'frail';
  frailtyLabel: string;
  frailtyLabelJa: string;
  status: 'green' | 'yellow' | 'red';
  emoji: string;
  riskFlags: {
    iadl: boolean; // >=3
    physical: boolean; // >=3
    nutrition: boolean; // >=2
    oral: boolean; // >=2
    housebound: boolean; // >=1
    cognitive: boolean; // >=1
    depressive: boolean; // >=2
  };
  recommendations: string[];
  recommendationsJa: string[];
  ltciEligible: boolean; // Long-Term Care Insurance eligibility
}

/**
 * Assess frailty using Kihon Checklist (MHLW 25-item questionnaire)
 * @param scores - Domain scores
 */
export function assessKihonChecklist(scores: KihonChecklistScores): KihonChecklistResult {
  const totalScore =
    scores.iadl +
    scores.physical +
    scores.nutrition +
    scores.oral +
    scores.housebound +
    scores.cognitive +
    scores.depressive;

  // Determine frailty status (MHLW criteria)
  let frailtyStatus: 'robust' | 'prefrail' | 'frail';
  let frailtyLabel: string;
  let frailtyLabelJa: string;
  let status: 'green' | 'yellow' | 'red';
  let emoji: string;

  if (totalScore <= 3) {
    frailtyStatus = 'robust';
    frailtyLabel = 'Robust (Healthy)';
    frailtyLabelJa = '健常';
    status = 'green';
    emoji = '🟢';
  } else if (totalScore >= 4 && totalScore <= 7) {
    frailtyStatus = 'prefrail';
    frailtyLabel = 'Pre-frail';
    frailtyLabelJa = 'プレフレイル';
    status = 'yellow';
    emoji = '🟡';
  } else {
    frailtyStatus = 'frail';
    frailtyLabel = 'Frail';
    frailtyLabelJa = 'フレイル';
    status = 'red';
    emoji = '🔴';
  }

  // Check risk flags for each domain
  const riskFlags = {
    iadl: scores.iadl >= 3,
    physical: scores.physical >= 3,
    nutrition: scores.nutrition >= 2,
    oral: scores.oral >= 2,
    housebound: scores.housebound >= 1,
    cognitive: scores.cognitive >= 1,
    depressive: scores.depressive >= 2,
  };

  // Generate recommendations based on risk flags
  const recommendations: string[] = [];
  const recommendationsJa: string[] = [];

  if (riskFlags.iadl) {
    recommendations.push('IADL support services recommended');
    recommendationsJa.push('IADL支援サービス推奨');
  }
  if (riskFlags.physical) {
    recommendations.push('Physical rehabilitation program');
    recommendationsJa.push('運動器リハビリテーション');
  }
  if (riskFlags.nutrition) {
    recommendations.push('Nutritional intervention required');
    recommendationsJa.push('栄養改善プログラム必要');
  }
  if (riskFlags.oral) {
    recommendations.push('Oral care and dental consultation');
    recommendationsJa.push('口腔ケアと歯科受診');
  }
  if (riskFlags.housebound) {
    recommendations.push('Social engagement programs');
    recommendationsJa.push('社会参加プログラム');
  }
  if (riskFlags.cognitive) {
    recommendations.push('Cognitive assessment recommended');
    recommendationsJa.push('認知機能精密検査推奨');
  }
  if (riskFlags.depressive) {
    recommendations.push('Mental health support services');
    recommendationsJa.push('精神的支援サービス');
  }

  // LTCI (Long-Term Care Insurance) eligibility
  // Frail status or multiple domain risks indicate potential eligibility
  const ltciEligible = frailtyStatus === 'frail' || totalScore >= 8;

  if (ltciEligible) {
    recommendations.push('Eligible for Long-Term Care Insurance certification');
    recommendationsJa.push('介護保険申請対象');
  }

  return {
    totalScore,
    domainScores: scores,
    frailtyStatus,
    frailtyLabel,
    frailtyLabelJa,
    status,
    emoji,
    riskFlags,
    recommendations,
    recommendationsJa,
    ltciEligible,
  };
}

/**
 * Convert unit for blood glucose
 */
export function convertGlucoseUnit(value: number, from: 'mg/dL' | 'mmol/L'): number {
  if (from === 'mg/dL') {
    return value / 18.018; // to mmol/L
  } else {
    return value * 18.018; // to mg/dL
  }
}

/**
 * Convert weight unit
 */
export function convertWeightUnit(value: number, from: 'kg' | 'lb'): number {
  if (from === 'kg') {
    return value * 2.20462; // to lb
  } else {
    return value / 2.20462; // to kg
  }
}
