-- Migration 012: Modify Voice Recordings Table for Review Queue Support
-- This migration adds review status and context tracking to voice_recordings table
-- Requirements: 1.1, 2.1

-- Add review_status column with check constraint
ALTER TABLE voice_recordings
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'not_reviewed' 
CHECK (review_status IN ('not_reviewed', 'pending_review', 'reviewed', 'discarded'));

-- Add context_type column to track patient vs global context
ALTER TABLE voice_recordings
ADD COLUMN IF NOT EXISTS context_type VARCHAR(20) 
CHECK (context_type IN ('patient', 'global'));

-- Add context_patient_id column for patient context tracking
-- Note: This is separate from the existing patient_id to allow for global recordings
-- that may later be associated with a patient
ALTER TABLE voice_recordings
ADD COLUMN IF NOT EXISTS context_patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_voice_recordings_review_status 
ON voice_recordings(review_status);

CREATE INDEX IF NOT EXISTS idx_voice_recordings_context 
ON voice_recordings(context_type, context_patient_id);

CREATE INDEX IF NOT EXISTS idx_voice_recordings_context_patient 
ON voice_recordings(context_patient_id);

-- Update existing records to have default values
-- Set context_type to 'patient' for all existing recordings with patient_id
UPDATE voice_recordings
SET context_type = 'patient',
    context_patient_id = patient_id,
    review_status = 'not_reviewed'
WHERE context_type IS NULL AND patient_id IS NOT NULL;

-- Set context_type to 'global' for any recordings without patient_id (if any exist)
UPDATE voice_recordings
SET context_type = 'global',
    review_status = 'not_reviewed'
WHERE context_type IS NULL AND patient_id IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN voice_recordings.review_status IS 'Review workflow state: not_reviewed (no review needed), pending_review (in queue), reviewed (confirmed), discarded (rejected)';
COMMENT ON COLUMN voice_recordings.context_type IS 'Recording context: patient (specific patient selected) or global (no patient context)';
COMMENT ON COLUMN voice_recordings.context_patient_id IS 'Patient ID captured at recording time for context tracking (may differ from patient_id if recording is later associated with different patient)';
