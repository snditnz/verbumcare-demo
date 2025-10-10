import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG, FACILITY_ID, DEMO_STAFF_ID } from '@constants/config';
import { APIResponse, APIVitalSigns, VoiceUploadResponse } from '@models/api';
import { Patient, VitalSigns, BarthelIndex, IncidentReport, PatientUpdateDraft, MedicationAdmin } from '@models';
import { cacheService } from './cacheService';

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ja',
      },
      httpsAgent: {
        rejectUnauthorized: false, // For self-signed cert
      } as any,
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Fallback to IP if mDNS fails
        if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          const fallbackURL = API_CONFIG.BASE_URL.replace(
            'verbumcare-lab.local',
            API_CONFIG.FALLBACK_IP
          );
          this.client.defaults.baseURL = fallbackURL;
          return this.client.request(error.config);
        }
        throw error;
      }
    );
  }

  async getPatients(useCache: boolean = true): Promise<Patient[]> {
    // Try cache first if enabled
    if (useCache) {
      const cached = await cacheService.getCachedPatients();
      if (cached) {
        console.log('Using cached patients data');
        return cached;
      }
    }

    // Fetch from API
    const response = await this.client.get<APIResponse<Patient[]>>('/patients', {
      params: { facility_id: FACILITY_ID },
    });
    const patients = response.data.data;

    // Cache the result
    await cacheService.cachePatients(patients);
    await cacheService.setLastSyncTime();

    return patients;
  }

  async getPatient(id: string): Promise<Patient> {
    const response = await this.client.get<APIResponse<Patient>>(`/patients/${id}`);
    return response.data.data;
  }

  async verifyBarcode(barcode: string): Promise<Patient> {
    const response = await this.client.get<APIResponse<Patient>>(
      `/patients/barcode/${barcode}`
    );
    return response.data.data;
  }

  async recordVitals(vitals: Partial<APIVitalSigns>): Promise<APIVitalSigns> {
    const response = await this.client.post<APIResponse<APIVitalSigns>>('/vitals', vitals);
    return response.data.data;
  }

  async uploadVoiceRecording(
    audioUri: string,
    patientId: string,
    recordedBy: string
  ): Promise<VoiceUploadResponse> {
    const formData = new FormData();
    
    formData.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
    
    formData.append('patient_id', patientId);
    formData.append('recorded_by', recordedBy);

    const response = await this.client.post<APIResponse<VoiceUploadResponse>>(
      '/voice/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data.data;
  }

  async processVoiceRecording(recordingId: string): Promise<void> {
    await this.client.post('/voice/process', {
      recording_id: recordingId,
      async: true,
    });
  }

  async getVoiceStatus(recordingId: string): Promise<any> {
    const response = await this.client.get<APIResponse<any>>(
      `/voice/status/${recordingId}`
    );
    return response.data.data;
  }

  // ========== Barthel Index APIs ==========

  async getLatestBarthelIndex(patientId: string): Promise<BarthelIndex | null> {
    try {
      const response = await this.client.get<APIResponse<BarthelIndex>>(
        `/patients/${patientId}/barthel/latest`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // No Barthel assessment found
      }
      throw error;
    }
  }

  async submitBarthelIndex(
    patientId: string,
    barthel: BarthelIndex
  ): Promise<void> {
    await this.client.post(`/patients/${patientId}/barthel`, {
      total_score: barthel.total_score,
      category_scores: barthel.scores,
      additional_notes: barthel.additional_notes,
      assessed_by: DEMO_STAFF_ID,
      input_method: 'form',
    });
  }

  // ========== Incident APIs ==========

  async getPatientIncidents(patientId: string): Promise<IncidentReport[]> {
    const response = await this.client.get<APIResponse<IncidentReport[]>>(
      `/patients/${patientId}/incidents`
    );
    return response.data.data;
  }

  async submitIncident(
    patientId: string,
    incident: Omit<IncidentReport, 'id' | 'timestamp'>
  ): Promise<void> {
    await this.client.post(`/patients/${patientId}/incidents`, {
      incident_type: incident.type,
      severity: incident.severity,
      occurred_at: incident.datetime,
      description: incident.description,
      voice_recording_id: incident.voiceRecordingId,
      photo_paths: incident.photos || [],
      reported_by: DEMO_STAFF_ID,
    });
  }

  // ========== Patient Update APIs ==========

  async updatePatientInfo(
    patientId: string,
    updates: PatientUpdateDraft
  ): Promise<void> {
    const payload: any = {};

    if (updates.height !== undefined) payload.height_cm = updates.height;
    if (updates.weight !== undefined) payload.weight_kg = updates.weight;
    if (updates.allergies !== undefined) payload.allergies = updates.allergies;
    if (updates.medications !== undefined) payload.medications_summary = updates.medications;
    if (updates.keyNotes !== undefined) payload.key_notes = updates.keyNotes;

    await this.client.put(`/patients/${patientId}`, payload);
  }

  // ========== Session Data APIs ==========

  async saveSessionData(
    patientId: string,
    sessionData: {
      vitals?: VitalSigns;
      barthel_index?: BarthelIndex;
      medications?: MedicationAdmin[];
      patient_updates?: PatientUpdateDraft;
      incidents?: IncidentReport[];
    }
  ): Promise<{ session_id: string }> {
    const response = await this.client.post<APIResponse<{ session_id: string }>>(
      `/patients/${patientId}/session`,
      {
        staff_id: DEMO_STAFF_ID,
        session_device_id: 'ipad-demo',
        ...sessionData,
      }
    );
    return response.data.data;
  }

  async submitSession(
    patientId: string,
    sessionId: string
  ): Promise<{
    vitals?: any;
    barthel?: any;
    patient_updates?: any;
    incidents?: any[];
  }> {
    const response = await this.client.post<APIResponse<any>>(
      `/patients/${patientId}/session/submit`,
      {
        session_id: sessionId,
        staff_id: DEMO_STAFF_ID,
      }
    );
    return response.data.data;
  }

  // ========== Batch Session Submission ==========

  /**
   * Submit all session data at once (vitals, barthel, incidents, patient updates)
   * This is the main method called from ReviewConfirmScreen
   */
  async submitAllSessionData(
    patientId: string,
    sessionData: {
      vitals?: VitalSigns;
      barthelIndex?: BarthelIndex;
      medications?: MedicationAdmin[];
      patientUpdates?: PatientUpdateDraft;
      incidents?: IncidentReport[];
    }
  ): Promise<void> {
    try {
      // Save session data to backend
      const { session_id } = await this.saveSessionData(patientId, {
        vitals: sessionData.vitals,
        barthel_index: sessionData.barthelIndex,
        medications: sessionData.medications,
        patient_updates: sessionData.patientUpdates,
        incidents: sessionData.incidents,
      });

      // Then submit it to persist to permanent tables
      await this.submitSession(patientId, session_id);

      // Invalidate cache to force refresh
      await cacheService.clearCache();
    } catch (error) {
      console.error('Error submitting session data:', error);
      throw error;
    }
  }
}

export const apiService = new APIService();
export default apiService;
