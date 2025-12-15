-- Migration 010: Create Voice Review Queue Table
-- This migration creates the voice_review_queue table for managing pending voice recording reviews
-- Requirements: 8.1, 8.2, 11.5

-- Create voice_review_queue table
CREATE TABLE IF NOT EXISTS voice_review_queue (
    review_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recording_id UUID NOT NULL REFERENCES voice_recordings(recording_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    
    -- Context information
    context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('patient', 'global')),
    context_patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    
    -- AI Processing Results
    transcript TEXT NOT NULL,
    transcript_language VARCHAR(10) NOT NULL,
    extracted_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Review State
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'confirmed', 'discarded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    
    -- Metadata
    processing_time_ms INTEGER,
    model_version VARCHAR(50),
    
    -- Ensure one review per recording
    UNIQUE(recording_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_review_queue_user_status 
ON voice_review_queue(user_id, status);

CREATE INDEX IF NOT EXISTS idx_review_queue_created 
ON voice_review_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_review_queue_patient 
ON voice_review_queue(context_patient_id);

CREATE INDEX IF NOT EXISTS idx_review_queue_status 
ON voice_review_queue(status);

-- Create GIN index for JSONB extracted_data for efficient category filtering
CREATE INDEX IF NOT EXISTS idx_review_queue_extracted_data 
ON voice_review_queue USING GIN (extracted_data);

-- Add comments for documentation
COMMENT ON TABLE voice_review_queue IS 'Stores pending voice recording reviews awaiting user approval before database insertion';
COMMENT ON COLUMN voice_review_queue.context_type IS 'Whether recording was made with patient context or globally';
COMMENT ON COLUMN voice_review_queue.extracted_data IS 'JSONB containing categorized data extracted by AI (categories array with type, confidence, data, fieldConfidences)';
COMMENT ON COLUMN voice_review_queue.confidence_score IS 'Overall AI confidence score (0.0-1.0)';
COMMENT ON COLUMN voice_review_queue.status IS 'Review workflow state: pending (awaiting review), in_review (user opened), confirmed (saved to DB), discarded (rejected)';
