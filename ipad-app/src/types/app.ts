export type WorkflowStep =
  | 'patient-list'
  | 'patient-scan'
  | 'vitals-capture'
  | 'adl-voice'
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

  // Vital signs history
  latest_vitals_date?: string;
}

export interface VitalSigns {
  temperature_celsius?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  oxygen_saturation?: number;
  measured_at: Date;
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

export type Language = 'ja' | 'en';
