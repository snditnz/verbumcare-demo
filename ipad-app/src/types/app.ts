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
  startedAt: Date | null;
}

export interface Patient {
  patient_id: string;
  mrn: string;
  family_name: string;
  given_name: string;
  room?: string;
  bed?: string;
  age?: number;
  gender: 'male' | 'female' | 'other';
  status?: 'green' | 'yellow' | 'red';
  risk_factors?: string[];
}

export interface VitalSigns {
  temperature_celsius?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
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

export type Language = 'ja' | 'en';
