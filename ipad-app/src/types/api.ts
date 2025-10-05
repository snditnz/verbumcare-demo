// API Response types matching backend
export interface APIResponse<T> {
  success: boolean;
  data: T;
  language: 'ja' | 'en' | 'zh-TW';
  message?: string;
  error?: string;
}

export interface Patient {
  patient_id: string;
  facility_id: string;
  mrn: string;
  family_name: string;
  given_name: string;
  family_name_kana?: string;
  given_name_kana?: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  room?: string;
  bed?: string;
  blood_type?: string;
  admission_date?: string;
  age?: number;
  status?: 'green' | 'yellow' | 'red';
  pending_medications?: number;
  active_medications?: number;
  barcode?: string;
}

export interface VitalSigns {
  vital_sign_id?: string;
  patient_id: string;
  measured_at: string;
  temperature_celsius?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  pain_score?: number;
  input_method: 'manual' | 'iot_sensor' | 'voice';
  device_id?: string;
  recorded_by: string;
}

export interface VoiceUploadResponse {
  recording_id: string;
  file_path: string;
  patient_id: string;
  recorded_at: string;
}

export interface BilingualData<T> {
  ja: T;
  en: T;
}

export interface StructuredADLData {
  vitals?: {
    blood_pressure?: string;
    temperature?: number;
    pulse?: number;
  };
  observations?: string[];
  activities?: string[];
  mobility?: string;
  nutrition?: string;
  hygiene?: string;
  cognition?: string;
  mood?: string;
  pain?: string;
  follow_up_needed?: string[];
}

export interface VoiceProcessingProgress {
  recording_id: string;
  status: 'processing' | 'completed' | 'failed';
  phase: 'transcription' | 'extraction' | 'translation' | 'saving' | 'done';
  message: string;
  progress?: number;
  error?: string;
  data?: {
    recording: any;
    transcription: string;
    structured_data: BilingualData<StructuredADLData>;
    clinical_note: BilingualData<string>;
    confidence: number;
    validation: {
      valid: boolean;
      errors: string[];
      warnings: string[];
    };
    language: string;
  };
}

export interface ServerConfig {
  apiUrl: string;
  wsUrl: string;
  mdnsUrl: string;
  hostname: string;
  version: string;
  offline: boolean;
}
