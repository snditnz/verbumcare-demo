export type WorkflowStep =
  | 'patient-list'
  | 'patient-scan'
  | 'vitals-capture'
  | 'adl-voice'
  | 'pain-assessment'
  | 'fall-risk-assessment'
  | 'kihon-checklist'
  | 'incident-report'
  | 'review-confirm';

export interface AssessmentSession {
  currentPatient: Patient | null;
  currentStep: WorkflowStep;
  vitals: VitalSigns | null;
  adlRecordingId: string | null;
  adlProcessedData: any | null;
  incidentPhotos: IncidentPhoto[];
  barthelIndex: BarthelIndex | null;
  startedAt: Date | null;
}

export interface Patient {
  patient_id: string;
  mrn: string;
  family_name: string;
  given_name: string;
  family_name_en?: string; // Romanized/English family name
  given_name_en?: string; // Romanized/English given name
  room?: string;
  bed?: string;
  age?: number;
  gender: 'male' | 'female' | 'other';
  status?: 'green' | 'yellow' | 'red';
  risk_factors?: string[];

  // Physical measurements
  height?: number; // cm
  weight?: number; // kg

  // Medical information
  allergies?: string;
  medications?: string;
  key_notes?: string;

  // Latest assessments
  latest_barthel_index?: number; // 0-100
  latest_barthel_date?: string;
  latest_pain_score?: number; // 0-10 NRS
  latest_pain_date?: string;

  // Vital signs history
  latest_vitals_date?: string;
}

export interface VitalSigns {
  temperature_celsius?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  oxygen_saturation?: number;
  respiratory_rate?: number;
  blood_glucose?: BloodGlucoseReading;
  weight?: WeightMeasurement;
  consciousness?: ConsciousnessAssessment;
  measured_at: Date;
}

export interface BloodGlucoseReading {
  value: number; // mg/dL (primary unit in Japan)
  unit: 'mg/dL' | 'mmol/L';
  test_type: 'fasting' | 'random' | 'postprandial' | 'bedtime';
}

export interface WeightMeasurement {
  weight_kg: number;
  previous_weight_kg?: number;
  percentage_change?: number;
  bmi?: number; // Auto-calculated if height available
}

export interface ConsciousnessAssessment {
  jcs_level: 0 | 1 | 2 | 3 | 10 | 20 | 30 | 100 | 200 | 300; // Japan Coma Scale
  jcs_category: 'alert' | 'awake' | 'arousable' | 'coma';
  notes?: string;
}

export interface IncidentPhoto {
  id: string;
  uri: string;
  annotations: PhotoAnnotation[];
}

export interface PhotoAnnotation {
  id: string;
  type: 'circle' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
}

// Session-based data types for hub model
export interface MedicationAdmin {
  medicationId: string;
  medicationName: string;
  dosage: string;
  route: string;
  time: string;
  notes?: string;
  lot?: string;
  administeredBy?: string;
  timestamp: string;
}

export interface PatientUpdateDraft {
  height?: number;
  weight?: number;
  allergies?: string;
  medications?: string;
  keyNotes?: string;
  confirmed?: boolean;
  updatedAt?: string;
}

export interface IncidentReport {
  id: string;
  type: 'fall' | 'medication-error' | 'behavioral' | 'injury' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  datetime: string;
  description: string;
  voiceRecordingId?: string;
  photos?: string[];
  reportedBy?: string;
  timestamp: string;
}

export interface BarthelIndex {
  total_score: number; // 0-100
  scores: Record<string, number>; // Individual category scores
  additional_notes?: string;
  recorded_at: Date;
}

// Pain Assessment - "6th Vital Sign"
export interface PainAssessment {
  pain_score: number; // 0-10 NRS scale
  location?: string; // Body location
  pain_type?: 'rest' | 'movement' | 'both';
  notes?: string;
  previous_score?: number; // For trend comparison
  recorded_at: Date;
}

// Kihon Checklist - MHLW 25-item frailty assessment
export interface KihonChecklist {
  // 7 Domain scores
  iadl_score: number; // Instrumental ADL (0-5)
  physical_score: number; // Physical strength (0-5)
  nutrition_score: number; // Nutrition (0-2)
  oral_score: number; // Oral function (0-3)
  housebound_score: number; // Social isolation (0-2)
  cognitive_score: number; // Cognition (0-3)
  depressive_score: number; // Mood (0-5)

  // Individual question responses (25 questions, true = at risk)
  questions: Record<string, boolean>;

  // Calculated totals
  total_score: number; // 0-25
  frailty_status: 'robust' | 'prefrail' | 'frail'; // <4, 4-7, >=8

  // Risk flags per domain
  iadl_risk: boolean; // >=3
  physical_risk: boolean; // >=3
  nutrition_risk: boolean; // >=2
  oral_risk: boolean; // >=2
  housebound_risk: boolean; // >=1
  cognitive_risk: boolean; // >=1
  depressive_risk: boolean; // >=2

  notes?: string;
  recorded_at: Date;
}

// Fall Risk Assessment
export interface FallRiskAssessment {
  // Risk factors (1 point each)
  history_of_falls: boolean;
  uses_assistive_device: boolean;
  unsteady_gait: boolean;
  cognitive_impairment: boolean;
  high_risk_medications: boolean;

  // Optional additional factors
  vision_problems?: boolean;
  environmental_hazards?: boolean;
  urinary_incontinence?: boolean;

  // Calculated
  risk_score: number; // 0-5+
  risk_level: 'low' | 'moderate' | 'high'; // 0-1, 2-3, 4-5

  interventions_recommended: string[];
  notes?: string;
  recorded_at: Date;
}

export type Language = 'ja' | 'en';
