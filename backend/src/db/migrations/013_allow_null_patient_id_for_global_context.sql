-- Migration 013: Allow NULL patient_id for Global Context Recordings
-- This migration modifies the voice_recordings table to allow NULL patient_id
-- when context_type is 'global', enabling global recordings without patient context
-- Requirements: Voice categorization feature support for global recordings

-- Remove NOT NULL constraint from patient_id column
ALTER TABLE voice_recordings 
ALTER COLUMN patient_id DROP NOT NULL;

-- Add a check constraint to ensure data integrity:
-- - If context_type is 'patient', patient_id must not be NULL
-- - If context_type is 'global', patient_id should be NULL (but not enforced for flexibility)
ALTER TABLE voice_recordings
ADD CONSTRAINT check_patient_id_context 
CHECK (
    (context_type = 'patient' AND patient_id IS NOT NULL) OR
    (context_type = 'global') OR
    (context_type IS NULL AND patient_id IS NOT NULL) -- For backward compatibility with old records
);

-- Add comment for documentation
COMMENT ON CONSTRAINT check_patient_id_context ON voice_recordings IS 
'Ensures patient_id is provided when context_type is patient, allows flexibility for global context';