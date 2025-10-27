import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG, FACILITY_ID, DEMO_STAFF_ID } from '@constants/config';
import { APIResponse, APIVitalSigns, VoiceUploadResponse } from '@models/api';
import { Patient, VitalSigns, BarthelIndex, IncidentReport, PatientUpdateDraft, MedicationAdmin, CarePlan, CarePlanItem, CarePlanWithPatient, ProblemTemplate, MonitoringRecord, TodaySchedule } from '@models';
import { cacheService } from './cacheService';
import { useAuthStore } from '@stores/authStore';

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

  // ========== Care Plan APIs ==========

  /**
   * Get problem templates for care plan creation
   * @returns Array of problem templates
   */
  async getProblemTemplates(): Promise<ProblemTemplate[]> {
    const response = await this.client.get<{ templates: ProblemTemplate[]; language: string }>(
      '/care-plans/problem-templates'
    );
    return response.data.templates;
  }

  /**
   * Get all care plans for a patient
   * @param patientId - Patient ID
   * @returns Array of care plans (usually just one active plan)
   */
  async getCarePlans(patientId: string): Promise<CarePlan[]> {
    const response = await this.client.get<APIResponse<CarePlan[]>>(
      '/care-plans',
      {
        params: { patient_id: patientId }
      }
    );
    return response.data.data;
  }

  /**
   * Get a specific care plan by ID
   * @param carePlanId - Care plan ID
   * @returns Care plan with all items and details
   */
  async getCarePlan(carePlanId: string): Promise<CarePlan> {
    const response = await this.client.get<APIResponse<CarePlan>>(
      `/care-plans/${carePlanId}`
    );
    return response.data.data;
  }

  /**
   * Get ALL care plans across all patients (for "All Care Plans" page)
   * @returns Array of care plans with patient info and stats
   */
  async getAllCarePlans(): Promise<CarePlanWithPatient[]> {
    const response = await this.client.get<APIResponse<CarePlanWithPatient[]>>(
      '/care-plans/all'
    );
    return response.data.data;
  }

  /**
   * Create a new care plan
   * @param carePlan - Care plan data
   * @returns Created care plan with ID
   */
  async createCarePlan(carePlan: Omit<CarePlan, 'id' | 'auditLog'>): Promise<CarePlan> {
    // TODO: Map authenticated user to actual staff UUID in database
    // For now, use DEMO_STAFF_ID (valid UUID) since temp auth users don't have DB records
    const currentUser = useAuthStore.getState().currentUser;
    const createdBy = DEMO_STAFF_ID; // Always use valid UUID for now

    const requestBody = {
      patientId: carePlan.patientId,
      careLevel: carePlan.careLevel,
      status: carePlan.status,
      version: carePlan.version,
      patientIntent: carePlan.patientIntent,
      familyIntent: carePlan.familyIntent,
      comprehensivePolicy: carePlan.comprehensivePolicy,
      careManagerId: carePlan.careManagerId,
      teamMembers: carePlan.teamMembers,
      nextReviewDate: carePlan.nextReviewDate,
      nextMonitoringDate: carePlan.nextMonitoringDate,
      createdBy,
    };

    console.log('📤 Sending care plan to backend:', {
      ...requestBody,
      createdByUser: currentUser?.fullName || 'Unknown',
      createdByUUID: createdBy,
    });

    const response = await this.client.post<APIResponse<CarePlan>>(
      '/care-plans',
      requestBody
    );
    return response.data.data;
  }

  /**
   * Update an existing care plan
   * @param carePlanId - Care plan ID
   * @param updates - Partial care plan updates
   * @returns Updated care plan
   */
  async updateCarePlan(
    carePlanId: string,
    updates: Partial<CarePlan>
  ): Promise<CarePlan> {
    const response = await this.client.put<APIResponse<CarePlan>>(
      `/care-plans/${carePlanId}`,
      {
        ...updates,
        updated_by: DEMO_STAFF_ID,
      }
    );
    return response.data.data;
  }

  /**
   * Add a care plan item (problem, goals, interventions)
   * @param carePlanId - Care plan ID
   * @param item - Care plan item data
   * @returns Created care plan item with ID
   */
  async addCarePlanItem(
    carePlanId: string,
    item: Omit<CarePlanItem, 'id'>
  ): Promise<CarePlanItem> {
    const response = await this.client.post<APIResponse<CarePlanItem>>(
      `/care-plans/${carePlanId}/items`,
      {
        problem: item.problem,
        longTermGoal: item.longTermGoal,
        shortTermGoal: item.shortTermGoal,
        interventions: item.interventions,
        linkedAssessments: item.linkedAssessments,
        updatedBy: DEMO_STAFF_ID,
      }
    );
    return response.data.data;
  }

  /**
   * Update a care plan item
   * @param carePlanId - Care plan ID
   * @param itemId - Care plan item ID
   * @param updates - Partial item updates
   * @returns Updated care plan item
   */
  async updateCarePlanItem(
    carePlanId: string,
    itemId: string,
    updates: Partial<CarePlanItem>
  ): Promise<CarePlanItem> {
    const response = await this.client.put<APIResponse<CarePlanItem>>(
      `/care-plans/${carePlanId}/items/${itemId}`,
      {
        ...updates,
        updated_by: DEMO_STAFF_ID,
      }
    );
    return response.data.data;
  }

  /**
   * Delete a care plan item
   * @param carePlanId - Care plan ID
   * @param itemId - Care plan item ID
   */
  async deleteCarePlanItem(carePlanId: string, itemId: string): Promise<void> {
    await this.client.delete(`/care-plans/${carePlanId}/items/${itemId}`);
  }

  /**
   * Add a progress note to a care plan item
   * @param carePlanId - Care plan ID
   * @param itemId - Care plan item ID
   * @param note - Progress note text
   * @returns Updated care plan item
   */
  async addProgressNote(
    carePlanId: string,
    itemId: string,
    note: string
  ): Promise<CarePlanItem> {
    const response = await this.client.post<APIResponse<CarePlanItem>>(
      `/care-plans/${carePlanId}/items/${itemId}/notes`,
      {
        note,
        author: DEMO_STAFF_ID,
        author_name: 'Demo Staff', // TODO: Get from user context
      }
    );
    return response.data.data;
  }

  /**
   * Create a monitoring record for a care plan
   * @param carePlanId - Care plan ID
   * @param record - Monitoring record data
   * @returns Created monitoring record with ID
   */
  async createMonitoringRecord(
    carePlanId: string,
    record: Omit<MonitoringRecord, 'id' | 'createdAt'>
  ): Promise<MonitoringRecord> {
    const response = await this.client.post<APIResponse<MonitoringRecord>>(
      `/care-plans/${carePlanId}/monitoring`,
      {
        monitoringDate: record.monitoringDate.toISOString(),
        monitoringType: record.monitoringType,
        conductedBy: record.conductedBy,
        conductedByName: record.conductedByName,
        itemReviews: record.itemReviews,
        overallStatus: record.overallStatus,
        patientFeedback: record.patientFeedback,
        familyFeedback: record.familyFeedback,
        staffObservations: record.staffObservations,
        proposedChanges: record.proposedChanges,
        nextMonitoringDate: record.nextMonitoringDate.toISOString(),
        actionItems: record.actionItems,
      }
    );
    return response.data.data;
  }

  async getTodaySchedule(patientId: string): Promise<TodaySchedule> {
    const response = await this.client.get<APIResponse<TodaySchedule>>(
      `/dashboard/today-schedule/${patientId}`
    );
    return response.data.data;
  }

  async getAllTodaySchedule(staffId?: string): Promise<any> {
    const response = await this.client.get<APIResponse<any>>(
      '/dashboard/today-schedule-all',
      {
        params: { staff_id: staffId || DEMO_STAFF_ID }
      }
    );
    return response.data.data;
  }
}

export const apiService = new APIService();
export default apiService;
