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

interface AssessmentStore extends AssessmentSession {
  language: Language;

  // Session-based data (hub model)
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

  // Session actions
  addMedication: (med: MedicationAdmin) => void;
  setPatientUpdates: (updates: PatientUpdateDraft) => void;
  addIncident: (incident: IncidentReport) => void;
  setBarthelIndex: (barthel: BarthelIndex) => void;

  nextStep: () => void;
  previousStep: () => void;
  resetAssessment: () => void;
}

const WORKFLOW_ORDER: WorkflowStep[] = [
  'patient-list',
  'patient-scan',
  'vitals-capture',
  'adl-voice',
  'incident-report',
  'review-confirm',
];

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

  // Session state (hub model)
  sessionMedications: [],
  sessionPatientUpdates: null,
  sessionIncidents: [],
  sessionBarthelIndex: null,

  // Actions
  setLanguage: (language) => set({ language }),

  setCurrentPatient: (patient) =>
    set({
      currentPatient: patient,
      startedAt: patient ? new Date() : null,
    }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setVitals: (vitals) => set({ vitals }),

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

  // Session actions (hub model)
  addMedication: (med) =>
    set((state) => ({
      sessionMedications: [...state.sessionMedications, med],
    })),

  setPatientUpdates: (updates) =>
    set({ sessionPatientUpdates: updates }),

  addIncident: (incident) =>
    set((state) => ({
      sessionIncidents: [...state.sessionIncidents, incident],
    })),

  setBarthelIndex: (barthel) =>
    set({ sessionBarthelIndex: barthel }),

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
      // Clear session data
      sessionMedications: [],
      sessionPatientUpdates: null,
      sessionIncidents: [],
      sessionBarthelIndex: null,
    }),
}));
