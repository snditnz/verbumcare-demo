import { Patient, PatientUpdateDraft } from '@models';

/**
 * Patient Diff Utility
 *
 * Compares original patient data with session updates to determine
 * which fields have been edited. Used for highlighting edited fields
 * in the UI with yellow background decoration.
 */

export interface EditedFields {
  height?: boolean;
  weight?: boolean;
  allergies?: boolean;
  medications?: boolean;
  keyNotes?: boolean;
}

/**
 * Compare original patient data with session updates
 * Returns an object indicating which fields have been edited
 */
export function getEditedFields(
  originalPatient: Patient | null,
  sessionUpdates: PatientUpdateDraft | null
): EditedFields {
  if (!originalPatient || !sessionUpdates) {
    return {};
  }

  const edited: EditedFields = {};

  // Check height
  if (sessionUpdates.height !== undefined && sessionUpdates.height !== null) {
    if (sessionUpdates.height !== originalPatient.height) {
      edited.height = true;
    }
  }

  // Check weight
  if (sessionUpdates.weight !== undefined && sessionUpdates.weight !== null) {
    if (sessionUpdates.weight !== originalPatient.weight) {
      edited.weight = true;
    }
  }

  // Check allergies (array comparison)
  if (sessionUpdates.allergies !== undefined) {
    // Convert arrays to sorted, trimmed, comma-separated strings for comparison
    const originalAllergies = Array.isArray(originalPatient.allergies)
      ? originalPatient.allergies.map(a => a.trim()).sort().join(',')
      : (originalPatient.allergies || '').toString().trim();
    const newAllergies = Array.isArray(sessionUpdates.allergies)
      ? sessionUpdates.allergies.map(a => a.trim()).sort().join(',')
      : (sessionUpdates.allergies || '').toString().trim();
    if (originalAllergies !== newAllergies) {
      edited.allergies = true;
    }
  }

  // Check medications
  if (sessionUpdates.medications !== undefined) {
    const originalMeds = originalPatient.medications || '';
    const newMeds = sessionUpdates.medications || '';
    if (originalMeds.trim() !== newMeds.trim()) {
      edited.medications = true;
    }
  }

  // Check key notes
  if (sessionUpdates.keyNotes !== undefined) {
    const originalNotes = originalPatient.key_notes || '';
    const newNotes = sessionUpdates.keyNotes || '';
    if (originalNotes.trim() !== newNotes.trim()) {
      edited.keyNotes = true;
    }
  }

  return edited;
}

/**
 * Check if any field has been edited
 */
export function hasAnyEdits(editedFields: EditedFields): boolean {
  return Object.values(editedFields).some(isEdited => isEdited === true);
}

/**
 * Get count of edited fields
 */
export function getEditedFieldsCount(editedFields: EditedFields): number {
  return Object.values(editedFields).filter(isEdited => isEdited === true).length;
}

/**
 * Get list of edited field names
 */
export function getEditedFieldNames(editedFields: EditedFields): string[] {
  return Object.keys(editedFields).filter(
    (key) => editedFields[key as keyof EditedFields] === true
  );
}
