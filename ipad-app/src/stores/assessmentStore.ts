import { create } from 'zustand';
import {
  AssessmentSession,
  Patient,
  VitalSigns,
  IncidentPhoto,
  WorkflowStep,
  Language,
  MedicationAdmin,
  PatientUpdateDraft,
  IncidentReport,
  BarthelIndex
} from '@models';

// Per-patient session data
interface PatientSessionData {
  vitals: VitalSigns | null;
  medications: MedicationAdmin[];
  patientUpdates: PatientUpdateDraft | null;
  incidents: IncidentReport[];
  barthelIndex: BarthelIndex | null;
}

interface AssessmentStore extends AssessmentSession {
  language: Language;

  // Session-based data (hub model) - scoped by patient ID
  patientSessions: Record<string, PatientSessionData>;

  // Computed properties for current patient's session data (updated automatically)
  sessionVitals: VitalSigns | null;
  sessionMedications: MedicationAdmin[];
  sessionPatientUpdates: PatientUpdateDraft | null;
  sessionIncidents: IncidentReport[];
  sessionBarthelIndex: BarthelIndex | null;

  // Actions
  setLanguage: (language: Language) => void;
  setCurrentPatient: (patient: Patient | null) => void;
  setCurrentStep: (step: WorkflowStep) => void;
  setVitals: (vitals: VitalSigns | null) => void;
  setADLRecordingId: (id: string | null) => void;
  setADLProcessedData: (data: any) => void;
  addIncidentPhoto: (photo: IncidentPhoto) => void;
  removeIncidentPhoto: (photoId: string) => void;

  // Session actions (automatically scoped to current patient)
  addMedication: (med: MedicationAdmin) => void;
  setPatientUpdates: (updates: PatientUpdateDraft) => void;
  addIncident: (incident: IncidentReport) => void;
  setBarthelIndex: (barthel: BarthelIndex) => void;

  nextStep: () => void;
  previousStep: () => void;
  resetAssessment: () => void;
  clearPatientSession: (patientId: string) => void;

  // Internal helper to recompute session data
  _updateSessionData: () => void;
}

const WORKFLOW_ORDER: WorkflowStep[] = [
  'patient-list',
  'patient-scan',
  'vitals-capture',
  'adl-voice',
  'incident-report',
  'review-confirm',
];

const getSessionDataForPatient = (state: AssessmentStore): PatientSessionData => {
  if (!state.currentPatient) {
    return { vitals: null, medications: [], patientUpdates: null, incidents: [], barthelIndex: null };
  }
  return state.patientSessions[state.currentPatient.patient_id] || {
    vitals: null,
    medications: [],
    patientUpdates: null,
    incidents: [],
    barthelIndex: null,
  };
};

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  // Initial state
  currentPatient: null,
  currentStep: 'patient-list',
  vitals: null,
  adlRecordingId: null,
  adlProcessedData: null,
  incidentPhotos: [],
  barthelIndex: null,
  startedAt: null,
  language: 'ja',

  // Session state (hub model) - scoped by patient ID
  patientSessions: {},

  // Computed properties for current patient (will be updated by _updateSessionData)
  sessionVitals: null,
  sessionMedications: [],
  sessionPatientUpdates: null,
  sessionIncidents: [],
  sessionBarthelIndex: null,

  // Internal helper to recompute session data based on current patient
  _updateSessionData: () => {
    const state = get();
    const sessionData = getSessionDataForPatient(state);
    set({
      sessionVitals: sessionData.vitals,
      sessionMedications: sessionData.medications,
      sessionPatientUpdates: sessionData.patientUpdates,
      sessionIncidents: sessionData.incidents,
      sessionBarthelIndex: sessionData.barthelIndex,
    });
  },

  // Actions
  setLanguage: (language) => set({ language }),

  setCurrentPatient: (patient) => {
    set({
      currentPatient: patient,
      startedAt: patient ? new Date() : null,
    });
    // Update session data for the new patient
    get()._updateSessionData();
  },

  setCurrentStep: (step) => set({ currentStep: step }),

  setVitals: (vitals) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: null,
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
      };

      return {
        vitals, // Keep for backward compatibility with PatientInfoScreen
        patientSessions: {
          ...state.patientSessions,
          [patientId]: {
            ...currentSession,
            vitals,
          },
        },
      };
    });
    get()._updateSessionData();
  },

  setADLRecordingId: (id) => set({ adlRecordingId: id }),

  setADLProcessedData: (data) => set({ adlProcessedData: data }),

  addIncidentPhoto: (photo) =>
    set((state) => ({
      incidentPhotos: [...state.incidentPhotos, photo],
    })),

  removeIncidentPhoto: (photoId) =>
    set((state) => ({
      incidentPhotos: state.incidentPhotos.filter((p) => p.id !== photoId),
    })),

  // Session actions (hub model) - automatically scoped to current patient
  addMedication: (med) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: null,
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
      };

      return {
        patientSessions: {
          ...state.patientSessions,
          [patientId]: {
            ...currentSession,
            medications: [...currentSession.medications, med],
          },
        },
      };
    });
    get()._updateSessionData();
  },

  setPatientUpdates: (updates) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: null,
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
      };

      // Also immediately update currentPatient so UI reflects changes
      const updatedPatient = { ...state.currentPatient };
      if (updates.height !== undefined) updatedPatient.height = updates.height;
      if (updates.weight !== undefined) updatedPatient.weight = updates.weight;
      if (updates.allergies !== undefined) updatedPatient.allergies = updates.allergies;
      if (updates.medications !== undefined) updatedPatient.medications = updates.medications;
      if (updates.keyNotes !== undefined) updatedPatient.key_notes = updates.keyNotes;

      return {
        currentPatient: updatedPatient,
        patientSessions: {
          ...state.patientSessions,
          [patientId]: {
            ...currentSession,
            patientUpdates: updates,
          },
        },
      };
    });
    get()._updateSessionData();
  },

  addIncident: (incident) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: null,
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
      };

      return {
        patientSessions: {
          ...state.patientSessions,
          [patientId]: {
            ...currentSession,
            incidents: [...currentSession.incidents, incident],
          },
        },
      };
    });
    get()._updateSessionData();
  },

  setBarthelIndex: (barthel) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: null,
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
      };

      // Also immediately update currentPatient's Barthel Index
      const updatedPatient = { ...state.currentPatient };
      updatedPatient.latest_barthel_index = barthel.total_score;
      updatedPatient.latest_barthel_date = new Date().toISOString().split('T')[0]; // Today's date

      return {
        currentPatient: updatedPatient,
        patientSessions: {
          ...state.patientSessions,
          [patientId]: {
            ...currentSession,
            barthelIndex: barthel,
          },
        },
      };
    });
    get()._updateSessionData();
  },

  clearPatientSession: (patientId) => {
    set((state) => {
      const newSessions = { ...state.patientSessions };
      delete newSessions[patientId];
      return { patientSessions: newSessions };
    });
    get()._updateSessionData();
  },

  nextStep: () => {
    const currentIndex = WORKFLOW_ORDER.indexOf(get().currentStep);
    if (currentIndex < WORKFLOW_ORDER.length - 1) {
      set({ currentStep: WORKFLOW_ORDER[currentIndex + 1] });
    }
  },

  previousStep: () => {
    const currentIndex = WORKFLOW_ORDER.indexOf(get().currentStep);
    if (currentIndex > 0) {
      set({ currentStep: WORKFLOW_ORDER[currentIndex - 1] });
    }
  },

  resetAssessment: () =>
    set({
      currentPatient: null,
      currentStep: 'patient-list',
      vitals: null,
      adlRecordingId: null,
      adlProcessedData: null,
      incidentPhotos: [],
      barthelIndex: null,
      startedAt: null,
      // Do NOT clear patientSessions - keep session data for all patients
    }),
}));
