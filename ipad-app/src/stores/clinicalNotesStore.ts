import { create } from 'zustand';

export type NoteType = 'nurse_note' | 'doctor_note' | 'care_note';
export type NoteCategory =
  | 'symptom_observation'  // 症状観察
  | 'treatment'            // 処置
  | 'consultation'         // 相談
  | 'fall_incident'        // 転倒
  | 'medication'           // 投薬
  | 'vital_signs'          // バイタルサイン
  | 'behavioral'           // 行動観察
  | 'other';               // その他

export type NoteStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface ClinicalNote {
  note_id: string;
  patient_id: string;
  note_type: NoteType;
  note_category: NoteCategory;
  note_datetime: string; // ISO string
  note_text: string;

  // Voice recording
  voice_recording_id?: string;
  voice_transcribed?: boolean;

  // Author info
  authored_by: string;
  author_role: string;
  author_name: string;
  author_family_name?: string;
  author_given_name?: string;

  // Follow-up
  follow_up_required: boolean;
  follow_up_date?: string; // ISO string
  follow_up_notes?: string;

  // Related data
  related_assessment_id?: string;
  related_session_id?: string;

  // Approval workflow
  status: NoteStatus;
  requires_approval: boolean;
  approved_by?: string;
  approved_by_name?: string;
  approver_family_name?: string;
  approver_given_name?: string;
  approval_datetime?: string;
  approval_notes?: string;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Voice recording details (if available)
  transcription_text?: string;
  duration_seconds?: number;
  audio_url?: string;

  // Patient details (if fetched with note)
  patient_family_name?: string;
  patient_given_name?: string;
  room?: string;
  bed?: string;
}

interface ClinicalNotesStore {
  // State
  notes: Map<string, ClinicalNote[]>; // patientId -> notes[]
  isLoading: boolean;
  error: string | null;
  lastFetch: Map<string, Date>; // patientId -> timestamp

  // Actions
  fetchNotesForPatient: (patientId: string, forceRefresh?: boolean) => Promise<void>;
  addNote: (note: ClinicalNote) => void;
  updateNote: (noteId: string, updates: Partial<ClinicalNote>) => void;
  removeNote: (noteId: string) => void;
  clearNotesForPatient: (patientId: string) => void;
  clearAllNotes: () => void;

  // Getters
  getNotesForPatient: (patientId: string) => ClinicalNote[];
  getNurseNotesForPatient: (patientId: string) => ClinicalNote[];
  getDoctorNotesForPatient: (patientId: string) => ClinicalNote[];
  getNotesRequiringApproval: (patientId?: string) => ClinicalNote[];
}

export const useClinicalNotesStore = create<ClinicalNotesStore>((set, get) => ({
  // Initial state
  notes: new Map(),
  isLoading: false,
  error: null,
  lastFetch: new Map(),

  // Fetch notes for a specific patient
  fetchNotesForPatient: async (patientId: string, forceRefresh: boolean = false) => {
    const state = get();
    const lastFetchTime = state.lastFetch.get(patientId);

    // If fetched in last 30 seconds and not forcing refresh, skip
    if (!forceRefresh && lastFetchTime && (Date.now() - lastFetchTime.getTime() < 30000)) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // This will be implemented in the API service
      // For now, just set loading to false
      set({ isLoading: false });

      // Update last fetch time
      const newLastFetch = new Map(state.lastFetch);
      newLastFetch.set(patientId, new Date());
      set({ lastFetch: newLastFetch });
    } catch (error) {
      console.error('Error fetching clinical notes:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch clinical notes'
      });
    }
  },

  // Add a new note to the store
  addNote: (note: ClinicalNote) => {
    const state = get();
    const currentNotes = state.notes.get(note.patient_id) || [];
    const updatedNotes = [note, ...currentNotes].sort((a, b) =>
      new Date(b.note_datetime).getTime() - new Date(a.note_datetime).getTime()
    );

    const newNotes = new Map(state.notes);
    newNotes.set(note.patient_id, updatedNotes);
    set({ notes: newNotes });
  },

  // Update an existing note
  updateNote: (noteId: string, updates: Partial<ClinicalNote>) => {
    const state = get();
    const newNotes = new Map(state.notes);

    // Find and update the note in the map
    for (const [patientId, patientNotes] of newNotes.entries()) {
      const noteIndex = patientNotes.findIndex(n => n.note_id === noteId);
      if (noteIndex !== -1) {
        const updatedPatientNotes = [...patientNotes];
        updatedPatientNotes[noteIndex] = {
          ...updatedPatientNotes[noteIndex],
          ...updates,
          updated_at: new Date().toISOString()
        };
        newNotes.set(patientId, updatedPatientNotes);
        break;
      }
    }

    set({ notes: newNotes });
  },

  // Remove a note (soft delete)
  removeNote: (noteId: string) => {
    const state = get();
    const newNotes = new Map(state.notes);

    for (const [patientId, patientNotes] of newNotes.entries()) {
      const filteredNotes = patientNotes.filter(n => n.note_id !== noteId);
      if (filteredNotes.length !== patientNotes.length) {
        newNotes.set(patientId, filteredNotes);
        break;
      }
    }

    set({ notes: newNotes });
  },

  // Clear notes for a specific patient
  clearNotesForPatient: (patientId: string) => {
    const state = get();
    const newNotes = new Map(state.notes);
    newNotes.delete(patientId);

    const newLastFetch = new Map(state.lastFetch);
    newLastFetch.delete(patientId);

    set({ notes: newNotes, lastFetch: newLastFetch });
  },

  // Clear all notes
  clearAllNotes: () => {
    set({ notes: new Map(), lastFetch: new Map(), error: null });
  },

  // Get all notes for a patient (sorted by most recent first)
  getNotesForPatient: (patientId: string) => {
    return get().notes.get(patientId) || [];
  },

  // Get only nurse notes for a patient
  getNurseNotesForPatient: (patientId: string) => {
    const allNotes = get().notes.get(patientId) || [];
    return allNotes.filter(note => note.note_type === 'nurse_note');
  },

  // Get only doctor notes for a patient
  getDoctorNotesForPatient: (patientId: string) => {
    const allNotes = get().notes.get(patientId) || [];
    return allNotes.filter(note => note.note_type === 'doctor_note');
  },

  // Get notes requiring approval (optionally for specific patient)
  getNotesRequiringApproval: (patientId?: string) => {
    const state = get();
    let allNotes: ClinicalNote[] = [];

    if (patientId) {
      allNotes = state.notes.get(patientId) || [];
    } else {
      // Get all notes from all patients
      for (const patientNotes of state.notes.values()) {
        allNotes.push(...patientNotes);
      }
    }

    return allNotes.filter(note =>
      note.requires_approval && note.status === 'submitted'
    );
  },
}));
