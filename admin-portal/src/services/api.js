import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class APIService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    });

    this.client.interceptors.request.use((config) => {
      const language = localStorage.getItem('language') || 'en';
      config.headers['Accept-Language'] = language;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Patient methods
  async getPatients(facilityId = '550e8400-e29b-41d4-a716-446655440001') {
    const response = await this.client.get('/patients', {
      params: { facility_id: facilityId }
    });
    return response.data;
  }

  async getPatient(patientId) {
    const response = await this.client.get(`/patients/${patientId}`);
    return response.data;
  }

  async createPatient(patientData) {
    const response = await this.client.post('/patients', patientData);
    return response.data;
  }

  async updatePatient(patientId, updates) {
    const response = await this.client.put(`/patients/${patientId}`, updates);
    return response.data;
  }

  // Staff methods
  async getStaff(facilityId = '550e8400-e29b-41d4-a716-446655440001') {
    const response = await this.client.get('/staff', {
      params: { facility_id: facilityId }
    });
    return response.data;
  }

  async createStaff(staffData) {
    const response = await this.client.post('/staff', staffData);
    return response.data;
  }

  async updateStaff(staffId, updates) {
    const response = await this.client.put(`/staff/${staffId}`, updates);
    return response.data;
  }

  // Medication methods
  async getMedicationOrders(facilityId = '550e8400-e29b-41d4-a716-446655440001', status = null) {
    const response = await this.client.get('/medications/orders', {
      params: { facility_id: facilityId, ...(status && { status }) }
    });
    return response.data;
  }

  async createMedicationOrder(orderData) {
    const response = await this.client.post('/medications/orders', orderData);
    return response.data;
  }

  async updateMedicationOrder(orderId, updates) {
    const response = await this.client.put(`/medications/orders/${orderId}`, updates);
    return response.data;
  }

  async getPatientMedications(patientId) {
    const response = await this.client.get(`/medications/patient/${patientId}`);
    return response.data;
  }

  // Vital signs methods
  async getPatientVitals(patientId, limit = 50) {
    const response = await this.client.get(`/vitals/patient/${patientId}`, {
      params: { limit }
    });
    return response.data;
  }

  // Assessment methods
  async getPatientAssessments(patientId, limit = 20) {
    const response = await this.client.get(`/assessments/patient/${patientId}`, {
      params: { limit }
    });
    return response.data;
  }

  // Dashboard methods
  async getDashboardMetrics(facilityId = '550e8400-e29b-41d4-a716-446655440001', date = null) {
    const response = await this.client.get('/dashboard/metrics', {
      params: { facility_id: facilityId, ...(date && { date }) }
    });
    return response.data;
  }

  async getPatientStatus(facilityId = '550e8400-e29b-41d4-a716-446655440001') {
    const response = await this.client.get('/dashboard/patients/status', {
      params: { facility_id: facilityId }
    });
    return response.data;
  }

  async getRecentActivity(facilityId = '550e8400-e29b-41d4-a716-446655440001', limit = 20) {
    const response = await this.client.get('/dashboard/activity/recent', {
      params: { facility_id: facilityId, limit }
    });
    return response.data;
  }

  async getAlerts(facilityId = '550e8400-e29b-41d4-a716-446655440001') {
    const response = await this.client.get('/dashboard/alerts', {
      params: { facility_id: facilityId }
    });
    return response.data;
  }

  // Export methods
  async exportHL7(facilityId = '550e8400-e29b-41d4-a716-446655440001', type = 'all', date = null) {
    const response = await this.client.get('/dashboard/export/hl7', {
      params: { facility_id: facilityId, type, ...(date && { date }) }
    });
    return response.data;
  }

  async exportSSMix2(facilityId = '550e8400-e29b-41d4-a716-446655440001') {
    const response = await this.client.get('/dashboard/export/ss-mix2', {
      params: { facility_id: facilityId }
    });
    return response.data;
  }

  async verifyChainIntegrity(facilityId = '550e8400-e29b-41d4-a716-446655440001', limit = 100) {
    const response = await this.client.get('/dashboard/chain/verify', {
      params: { facility_id: facilityId, limit }
    });
    return response.data;
  }
}

export default new APIService();