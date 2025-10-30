import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  BarthelIndex,
  PainAssessment,
  FallRiskAssessment,
  KihonChecklist
} from '@models';

// Per-patient session data
interface PatientSessionData {
  vitals: VitalSigns[]; // Array to support session history
  medications: MedicationAdmin[];
  patientUpdates: PatientUpdateDraft | null;
  incidents: IncidentReport[];
  barthelIndex: BarthelIndex | null;
  painAssessment: PainAssessment | null;
  fallRiskAssessment: FallRiskAssessment | null;
  kihonChecklist: KihonChecklist | null;
}

interface AssessmentStore extends AssessmentSession {
  language: Language;

  // Session-based data (hub model) - scoped by patient ID
  patientSessions: Record<string, PatientSessionData>;

  // Original patient data (before any edits) - for diff comparison
  originalPatientData: Record<string, Patient>;

  // Hydration flag to prevent saving before data is loaded
  _hasHydrated: boolean;

  // Computed properties for current patient's session data (updated automatically)
  sessionVitals: VitalSigns | null;
  sessionMedications: MedicationAdmin[];
  sessionPatientUpdates: PatientUpdateDraft | null;
  sessionIncidents: IncidentReport[];
  sessionBarthelIndex: BarthelIndex | null;
  sessionPainAssessment: PainAssessment | null;
  sessionFallRiskAssessment: FallRiskAssessment | null;
  sessionKihonChecklist: KihonChecklist | null;

  // Actions
  setLanguage: (language: Language) => void;
  setCurrentPatient: (patient: Patient | null) => void;
  setCurrentStep: (step: WorkflowStep) => void;
  setVitals: (vitals: VitalSigns | null) => void;
  removeLastVital: () => void; // Remove the most recent vital reading
  setADLRecordingId: (id: string | null) => void;
  setADLProcessedData: (data: any) => void;
  addIncidentPhoto: (photo: IncidentPhoto) => void;
  removeIncidentPhoto: (photoId: string) => void;

  // Session actions (automatically scoped to current patient)
  addMedication: (med: MedicationAdmin) => void;
  setPatientUpdates: (updates: PatientUpdateDraft) => void;
  addIncident: (incident: IncidentReport) => void;
  setBarthelIndex: (barthel: BarthelIndex) => void;
  setPainAssessment: (pain: PainAssessment) => void;
  setFallRiskAssessment: (fallRisk: FallRiskAssessment) => void;
  setKihonChecklist: (kihon: KihonChecklist) => void;

  // Helper to get original patient data
  getOriginalPatient: (patientId: string) => Patient | null;

  nextStep: () => void;
  previousStep: () => void;
  resetAssessment: () => void;
  clearPatientSession: (patientId: string) => void;

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
    return { vitals: [], medications: [], patientUpdates: null, incidents: [], barthelIndex: null, painAssessment: null, fallRiskAssessment: null, kihonChecklist: null };
  }

  return state.patientSessions[state.currentPatient.patient_id] || {
    vitals: [],
    medications: [],
    patientUpdates: null,
    incidents: [],
    barthelIndex: null,
    painAssessment: null,
    fallRiskAssessment: null,
    kihonChecklist: null,
  };
};

// Track last saved state to prevent overwriting with empty data
let lastSavedPatientSessions: Record<string, PatientSessionData> = {};

export const useAssessmentStore = create<AssessmentStore>()(
  persist(
    (set, get) => ({
  // Initial state
  currentPatient: null,
  currentStep: 'patient-list',
  vitals: null, // Legacy field for backward compatibility
  adlRecordingId: null,
  adlProcessedData: null,
  incidentPhotos: [],
  barthelIndex: null,
  startedAt: null,
  language: 'ja',

  // Session state (hub model) - scoped by patient ID - will be loaded async
  patientSessions: {},

  // Original patient data (before any edits) - for diff comparison
  originalPatientData: {},

  // Hydration tracking
  _hasHydrated: false,

  // Computed properties for current patient (updated automatically in each action)
  sessionVitals: null,
  sessionMedications: [],
  sessionPatientUpdates: null,
  sessionIncidents: [],
  sessionBarthelIndex: null,
  sessionPainAssessment: null,
  sessionFallRiskAssessment: null,
  sessionKihonChecklist: null,

  // Actions
  setLanguage: (language) => set((state) => ({ ...state, language })),

  setCurrentPatient: (patient) => {
    console.log('[Store] setCurrentPatient called with:', patient?.patient_id);

    set((state) => {
      console.log('[Store] setCurrentPatient set() - _hasHydrated:', state._hasHydrated);
      console.log('[Store] setCurrentPatient set() - state.patientSessions:', Object.keys(state.patientSessions));

      // CRITICAL: If state is empty but we have saved data, use the saved data!
      // This prevents race conditions where navigation clears the state
      const preservedSessions = Object.keys(state.patientSessions).length === 0 && Object.keys(lastSavedPatientSessions).length > 0
        ? lastSavedPatientSessions
        : state.patientSessions;

      console.log('[Store] Using sessions:', Object.keys(preservedSessions), '(preserved:', preservedSessions !== state.patientSessions, ')', 'lastSaved:', Object.keys(lastSavedPatientSessions));

      // Store original patient data if not already stored (for diff comparison)
      const newOriginalPatientData = { ...state.originalPatientData };
      if (patient && !newOriginalPatientData[patient.patient_id]) {
        newOriginalPatientData[patient.patient_id] = JSON.parse(JSON.stringify(patient)); // Deep clone
        console.log('[Store] 📸 Stored original patient data for:', patient.patient_id);
      }

      // Compute session data for the new patient INSIDE this set() callback
      const sessionData: PatientSessionData = patient
        ? (preservedSessions[patient.patient_id] || {
            vitals: [],
            medications: [],
            patientUpdates: null,
            incidents: [],
            barthelIndex: null,
            painAssessment: null,
            fallRiskAssessment: null,
            kihonChecklist: null,
          })
        : { vitals: [], medications: [], patientUpdates: null, incidents: [], barthelIndex: null, painAssessment: null, fallRiskAssessment: null, kihonChecklist: null };

      console.log('[Store] Computed sessionData for patient:', patient?.patient_id, sessionData);

      // Apply session updates to patient object if they exist
      let updatedPatient = patient;
      if (patient && (sessionData.patientUpdates || sessionData.barthelIndex || sessionData.painAssessment || sessionData.fallRiskAssessment)) {
        updatedPatient = { ...patient };

        // Apply patient info updates
        if (sessionData.patientUpdates) {
          if (sessionData.patientUpdates.height !== undefined) updatedPatient.height = sessionData.patientUpdates.height;
          if (sessionData.patientUpdates.weight !== undefined) updatedPatient.weight = sessionData.patientUpdates.weight;
          if (sessionData.patientUpdates.allergies !== undefined) updatedPatient.allergies = sessionData.patientUpdates.allergies;
          if (sessionData.patientUpdates.medications !== undefined) updatedPatient.medications = sessionData.patientUpdates.medications;
          if (sessionData.patientUpdates.keyNotes !== undefined) updatedPatient.key_notes = sessionData.patientUpdates.keyNotes;
        }

        // Apply latest assessment data to patient
        if (sessionData.barthelIndex) {
          updatedPatient.latest_barthel_index = sessionData.barthelIndex.total_score;
          updatedPatient.latest_barthel_date = new Date(sessionData.barthelIndex.recorded_at).toISOString().split('T')[0];
        }
        if (sessionData.painAssessment) {
          updatedPatient.latest_pain_score = sessionData.painAssessment.pain_score;
          updatedPatient.latest_pain_date = new Date(sessionData.painAssessment.recorded_at).toISOString().split('T')[0];
        }
        if (sessionData.fallRiskAssessment) {
          updatedPatient.latest_fall_risk_score = sessionData.fallRiskAssessment.risk_score;
          updatedPatient.latest_fall_risk_level = sessionData.fallRiskAssessment.risk_level;
          updatedPatient.latest_fall_risk_date = new Date(sessionData.fallRiskAssessment.recorded_at).toISOString().split('T')[0];
        }

        console.log('[Store] 🔄 Applied session updates to patient data');
      }

      // Ensure vitals is an array (migration from old state)
      const vitalsArray = Array.isArray(sessionData.vitals) ? sessionData.vitals : [];

      return {
        ...state,
        currentPatient: updatedPatient,
        startedAt: patient ? new Date() : null,
        patientSessions: preservedSessions,  // Use preserved sessions
        originalPatientData: newOriginalPatientData,
        // Update all session-computed properties IN THE SAME UPDATE
        // Extract latest vital from array
        sessionVitals: vitalsArray.length > 0 ? vitalsArray[vitalsArray.length - 1] : null,
        sessionMedications: sessionData.medications,
        sessionPatientUpdates: sessionData.patientUpdates,
        sessionIncidents: sessionData.incidents,
        sessionBarthelIndex: sessionData.barthelIndex,
        sessionPainAssessment: sessionData.painAssessment,
        sessionFallRiskAssessment: sessionData.fallRiskAssessment,
        sessionKihonChecklist: sessionData.kihonChecklist,
      };
    });
  },

  setCurrentStep: (step) => set((state) => ({ ...state, currentStep: step })),

  setVitals: (vitals) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      // Ensure currentSession.vitals is always an array (migration from old state)
      const existingVitals = Array.isArray(currentSession.vitals) ? currentSession.vitals : [];

      // Append new vital to history array (or set to empty if null)
      const newVitalsArray = vitals ? [...existingVitals, vitals] : existingVitals;

      const newSession = {
        ...currentSession,
        vitals: newVitalsArray,
      };

      const newPatientSessions = {
        ...state.patientSessions,
        [patientId]: newSession,
      };

      console.log('[setVitals] 🔵 Setting vitals for patient:', patientId);
      console.log('[setVitals] 🔵 New vitals:', vitals);
      console.log('[setVitals] 🔵 Total vitals in history:', newVitalsArray.length);

      return {
        ...state, // ← CRITICAL: preserve all other state
        vitals, // Keep for backward compatibility with PatientInfoScreen
        patientSessions: newPatientSessions,
        // Compute session data IN THE SAME UPDATE to avoid async issues
        // Extract latest vital from array
        sessionVitals: newVitalsArray.length > 0 ? newVitalsArray[newVitalsArray.length - 1] : null,
        sessionMedications: newSession.medications,
        sessionPatientUpdates: newSession.patientUpdates,
        sessionIncidents: newSession.incidents,
        sessionBarthelIndex: newSession.barthelIndex,
        sessionPainAssessment: newSession.painAssessment,
        sessionFallRiskAssessment: newSession.fallRiskAssessment,
        sessionKihonChecklist: newSession.kihonChecklist,
      };
    });
  },

  removeLastVital: () => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId];

      if (!currentSession) {
        console.log('[removeLastVital] No session found');
        return state;
      }

      // Ensure vitals is an array (migration from old state)
      const existingVitals = Array.isArray(currentSession.vitals) ? currentSession.vitals : [];

      if (existingVitals.length === 0) {
        console.log('[removeLastVital] No vitals to remove');
        return state;
      }

      // Remove the last vital from the array
      const newVitalsArray = existingVitals.slice(0, -1);

      const newSession = {
        ...currentSession,
        vitals: newVitalsArray,
      };

      const newPatientSessions = {
        ...state.patientSessions,
        [patientId]: newSession,
      };

      console.log('[removeLastVital] 🗑️ Removed last vital for patient:', patientId);
      console.log('[removeLastVital] 🗑️ Remaining vitals in history:', newVitalsArray.length);

      return {
        ...state,
        patientSessions: newPatientSessions,
        // Update computed property with new latest (or null if empty)
        sessionVitals: newVitalsArray.length > 0 ? newVitalsArray[newVitalsArray.length - 1] : null,
        sessionMedications: newSession.medications,
        sessionPatientUpdates: newSession.patientUpdates,
        sessionIncidents: newSession.incidents,
        sessionBarthelIndex: newSession.barthelIndex,
        sessionPainAssessment: newSession.painAssessment,
        sessionFallRiskAssessment: newSession.fallRiskAssessment,
        sessionKihonChecklist: newSession.kihonChecklist,
      };
    });
  },

  setADLRecordingId: (id) => set((state) => ({ ...state, adlRecordingId: id })),

  setADLProcessedData: (data) => set((state) => ({ ...state, adlProcessedData: data })),

  addIncidentPhoto: (photo) =>
    set((state) => ({
      ...state,
      incidentPhotos: [...state.incidentPhotos, photo],
    })),

  removeIncidentPhoto: (photoId) =>
    set((state) => ({
      ...state,
      incidentPhotos: state.incidentPhotos.filter((p) => p.id !== photoId),
    })),

  // Session actions (hub model) - automatically scoped to current patient
  addMedication: (med) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      const newSession = {
        ...currentSession,
        medications: [...currentSession.medications, med],
      };

      return {
        ...state, // ← CRITICAL: preserve all other state
        patientSessions: {
          ...state.patientSessions,
          [patientId]: newSession,
        },
        // Update computed properties
        sessionMedications: newSession.medications,
      };
    });
  },

  setPatientUpdates: (updates) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      // Also immediately update currentPatient so UI reflects changes
      const updatedPatient = { ...state.currentPatient };
      if (updates.height !== undefined) updatedPatient.height = updates.height;
      if (updates.weight !== undefined) updatedPatient.weight = updates.weight;
      if (updates.allergies !== undefined) updatedPatient.allergies = updates.allergies;
      if (updates.medications !== undefined) updatedPatient.medications = updates.medications;
      if (updates.keyNotes !== undefined) updatedPatient.key_notes = updates.keyNotes;

      const newSession = {
        ...currentSession,
        patientUpdates: {
          ...updates,
          updatedAt: new Date().toISOString(), // Add timestamp
        },
      };

      return {
        ...state, // ← CRITICAL: preserve all other state
        currentPatient: updatedPatient,
        patientSessions: {
          ...state.patientSessions,
          [patientId]: newSession,
        },
        // Update computed properties
        sessionPatientUpdates: newSession.patientUpdates,
      };
    });
  },

  addIncident: (incident) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      const newSession = {
        ...currentSession,
        incidents: [...currentSession.incidents, incident],
      };

      return {
        ...state, // ← CRITICAL: preserve all other state
        patientSessions: {
          ...state.patientSessions,
          [patientId]: newSession,
        },
        // Update computed properties
        sessionIncidents: newSession.incidents,
      };
    });
  },

  setBarthelIndex: (barthel) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      // Also immediately update currentPatient's Barthel Index
      const updatedPatient = { ...state.currentPatient };
      updatedPatient.latest_barthel_index = barthel.total_score;
      updatedPatient.latest_barthel_date = new Date().toISOString().split('T')[0]; // Today's date

      const newSession = {
        ...currentSession,
        barthelIndex: barthel,
      };

      return {
        ...state, // ← CRITICAL: preserve all other state
        currentPatient: updatedPatient,
        patientSessions: {
          ...state.patientSessions,
          [patientId]: newSession,
        },
        // Update computed properties
        sessionBarthelIndex: newSession.barthelIndex,
      };
    });
  },

  setPainAssessment: (pain) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      // Also immediately update currentPatient's pain score
      const updatedPatient = { ...state.currentPatient };
      updatedPatient.latest_pain_score = pain.pain_score;
      updatedPatient.latest_pain_date = new Date().toISOString().split('T')[0]; // Today's date

      const newSession = {
        ...currentSession,
        painAssessment: pain,
      };

      return {
        ...state, // ← CRITICAL: preserve all other state
        currentPatient: updatedPatient,
        patientSessions: {
          ...state.patientSessions,
          [patientId]: newSession,
        },
        // Update computed properties
        sessionPainAssessment: newSession.painAssessment,
      };
    });
  },

  setFallRiskAssessment: (fallRisk) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      // Also immediately update currentPatient's fall risk data
      const updatedPatient = { ...state.currentPatient };
      updatedPatient.latest_fall_risk_score = fallRisk.risk_score;
      updatedPatient.latest_fall_risk_level = fallRisk.risk_level;
      updatedPatient.latest_fall_risk_date = new Date().toISOString().split('T')[0]; // Today's date

      const newSession = {
        ...currentSession,
        fallRiskAssessment: fallRisk,
      };

      return {
        ...state, // ← CRITICAL: preserve all other state
        currentPatient: updatedPatient,
        patientSessions: {
          ...state.patientSessions,
          [patientId]: newSession,
        },
        // Update computed properties
        sessionFallRiskAssessment: newSession.fallRiskAssessment,
      };
    });
  },

  setKihonChecklist: (kihon) => {
    set((state) => {
      if (!state.currentPatient) return state;
      const patientId = state.currentPatient.patient_id;
      const currentSession = state.patientSessions[patientId] || {
        vitals: [],
        medications: [],
        patientUpdates: null,
        incidents: [],
        barthelIndex: null,
        painAssessment: null,
        fallRiskAssessment: null,
        kihonChecklist: null,
      };

      const newSession = {
        ...currentSession,
        kihonChecklist: kihon,
      };

      return {
        ...state, // ← CRITICAL: preserve all other state
        patientSessions: {
          ...state.patientSessions,
          [patientId]: newSession,
        },
        // Update computed properties
        sessionKihonChecklist: newSession.kihonChecklist,
      };
    });
  },

  // Helper to get original patient data
  getOriginalPatient: (patientId) => {
    return get().originalPatientData[patientId] || null;
  },

  clearPatientSession: (patientId) => {
    set((state) => {
      const newSessions = { ...state.patientSessions };
      delete newSessions[patientId];

      // If we're clearing the current patient's session, reset computed properties
      const shouldResetComputed = state.currentPatient?.patient_id === patientId;

      return {
        ...state, // ← CRITICAL: preserve all other state
        patientSessions: newSessions,
        ...(shouldResetComputed && {
          sessionVitals: null,
          sessionMedications: [],
          sessionPatientUpdates: null,
          sessionIncidents: [],
          sessionBarthelIndex: null,
          sessionPainAssessment: null,
          sessionFallRiskAssessment: null,
          sessionKihonChecklist: null,
        }),
      };
    });
  },

  nextStep: () => {
    const currentIndex = WORKFLOW_ORDER.indexOf(get().currentStep);
    if (currentIndex < WORKFLOW_ORDER.length - 1) {
      set((state) => ({ ...state, currentStep: WORKFLOW_ORDER[currentIndex + 1] }));
    }
  },

  previousStep: () => {
    const currentIndex = WORKFLOW_ORDER.indexOf(get().currentStep);
    if (currentIndex > 0) {
      set((state) => ({ ...state, currentStep: WORKFLOW_ORDER[currentIndex - 1] }));
    }
  },

  resetAssessment: () =>
    set((state) => ({
      ...state,
      currentPatient: null,
      currentStep: 'patient-list',
      vitals: null, // Legacy field
      adlRecordingId: null,
      adlProcessedData: null,
      incidentPhotos: [],
      barthelIndex: null,
      startedAt: null,
      // patientSessions preserved by ...state spread
    })),
}),
    {
      name: 'verbumcare-assessment-store',
      storage: createJSONStorage(() => ({
        getItem: async (key) => {
          const value = await AsyncStorage.getItem(key);
          console.log('[AsyncStorage] GET', key, value ? `${value.substring(0, 100)}...` : 'null');
          return value;
        },
        setItem: async (key, value) => {
          console.log('[AsyncStorage] SET', key, value.substring(0, 200));
          await AsyncStorage.setItem(key, value);
          console.log('[AsyncStorage] ✅ SET complete');
        },
        removeItem: async (key) => {
          console.log('[AsyncStorage] REMOVE', key);
          await AsyncStorage.removeItem(key);
        },
      })),
      // Only persist patientSessions - this is the data we want to keep
      partialize: (state) => {
        const currentKeys = Object.keys(state.patientSessions);
        const lastKeys = Object.keys(lastSavedPatientSessions);

        // CRITICAL: Don't save empty state - NEVER overwrite existing data with empty state
        // This can happen due to stale closures or batched updates during navigation
        if (currentKeys.length === 0 && lastKeys.length > 0) {
          console.log('[Persist] ⏭️ Preventing empty save - using last saved data:', lastKeys);
          // Return the last valid state instead of empty state
          return {
            patientSessions: lastSavedPatientSessions,
          };
        }

        // Update last saved state if current state has data
        if (currentKeys.length > 0) {
          lastSavedPatientSessions = state.patientSessions;
          console.log('[Persist] 💾 Saving patientSessions:', currentKeys);
        }

        return {
          patientSessions: state.patientSessions,
        };
      },
      // Custom merge to ensure patientSessions is properly restored
      merge: (persistedState: any, currentState: AssessmentStore) => {
        const hydratedSessions = persistedState?.patientSessions || {};
        console.log('[Persist] 📥 Hydrating with persistedState patientSessions:', Object.keys(hydratedSessions));

        // Initialize lastSavedPatientSessions with hydrated data
        lastSavedPatientSessions = hydratedSessions;

        return {
          ...currentState,
          patientSessions: hydratedSessions,
          _hasHydrated: true, // Mark as hydrated
        };
      },
      onRehydrateStorage: () => {
        console.log('[Persist] 🔄 Starting hydration');
        return (state, error) => {
          if (error) {
            console.error('[Persist] ❌ Hydration error:', error);
          } else {
            console.log('[Persist] ✅ Hydration complete');
            // Ensure _hasHydrated is set
            if (state) {
              state._hasHydrated = true;
            }
          }
        };
      },
    }
  )
);
