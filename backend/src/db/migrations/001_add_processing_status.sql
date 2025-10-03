-- Add processing status to voice_recordings table
-- Migration: 001_add_processing_status.sql

ALTER TABLE voice_recordings
ADD COLUMN processing_status VARCHAR(20) DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN processing_started_at TIMESTAMP,
ADD COLUMN processing_completed_at TIMESTAMP,
ADD COLUMN processing_error TEXT;

-- Update existing records to 'completed' if they have transcription
UPDATE voice_recordings
SET processing_status = 'completed',
    processing_completed_at = created_at
WHERE transcription_text IS NOT NULL;

-- Create index for status queries
CREATE INDEX idx_voice_recordings_status ON voice_recordings(processing_status);
CREATE INDEX idx_voice_recordings_patient_status ON voice_recordings(patient_id, processing_status);
