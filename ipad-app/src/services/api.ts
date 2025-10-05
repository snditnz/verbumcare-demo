import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG, FACILITY_ID } from '@constants/config';
import { APIResponse, Patient, VitalSigns, VoiceUploadResponse } from '@types/api';

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

  async getPatients(): Promise<Patient[]> {
    const response = await this.client.get<APIResponse<Patient[]>>('/patients', {
      params: { facility_id: FACILITY_ID },
    });
    return response.data.data;
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

  async recordVitals(vitals: Partial<VitalSigns>): Promise<VitalSigns> {
    const response = await this.client.post<APIResponse<VitalSigns>>('/vitals', vitals);
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
}

export const apiService = new APIService();
export default apiService;
