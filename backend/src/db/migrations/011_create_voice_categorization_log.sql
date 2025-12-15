-- Migration 011: Create Voice Categorization Log Table
-- This migration creates the voice_categorization_log table for audit trail of AI categorization decisions
-- Requirements: 4.1, 4.3, 4.5

-- Create voice_categorization_log table
CREATE TABLE IF NOT EXISTS voice_categorization_log (
    log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES voice_review_queue(review_id) ON DELETE CASCADE,
    
    -- Categorization Details
    detected_categories JSONB NOT NULL,
    extraction_prompt TEXT,
    extraction_response TEXT,
    
    -- User Corrections
    user_edited_transcript BOOLEAN DEFAULT FALSE,
    user_edited_data BOOLEAN DEFAULT FALSE,
    reanalysis_count INTEGER DEFAULT 0,
    
    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    confirmed_by UUID REFERENCES staff(staff_id) ON DELETE SET NULL,
    
    -- Ensure one log per review
    UNIQUE(review_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_categorization_log_review 
ON voice_categorization_log(review_id);

CREATE INDEX IF NOT EXISTS idx_categorization_log_confirmed_by 
ON voice_categorization_log(confirmed_by);

CREATE INDEX IF NOT EXISTS idx_categorization_log_created 
ON voice_categorization_log(created_at);

-- Create GIN index for JSONB detected_categories for efficient category analysis
CREATE INDEX IF NOT EXISTS idx_categorization_log_categories 
ON voice_categorization_log USING GIN (detected_categories);

-- Add comments for documentation
COMMENT ON TABLE voice_categorization_log IS 'Audit trail of AI categorization decisions and user corrections for training feedback';
COMMENT ON COLUMN voice_categorization_log.detected_categories IS 'JSONB array of detected category types with confidence scores';
COMMENT ON COLUMN voice_categorization_log.extraction_prompt IS 'The prompt sent to the AI model for data extraction';
COMMENT ON COLUMN voice_categorization_log.extraction_response IS 'The raw response from the AI model';
COMMENT ON COLUMN voice_categorization_log.user_edited_transcript IS 'Whether user edited the transcript before confirmation';
COMMENT ON COLUMN voice_categorization_log.user_edited_data IS 'Whether user edited the extracted data fields before confirmation';
COMMENT ON COLUMN voice_categorization_log.reanalysis_count IS 'Number of times the transcript was re-analyzed after user edits';
COMMENT ON COLUMN voice_categorization_log.confirmed_by IS 'Staff member who confirmed and saved the review to database';
