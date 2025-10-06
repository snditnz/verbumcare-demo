-- Migration: Create Barthel Index assessments table
-- Date: 2025-10-06
-- Barthel Index is the standard ADL assessment tool used in aged care

CREATE TABLE IF NOT EXISTS barthel_assessments (
    assessment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    assessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Total score (0-100)
    total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),

    -- Individual category scores (JSONB for flexibility)
    -- Format: {"eating": 10, "transfer": 15, "toileting": 10, ...}
    category_scores JSONB NOT NULL,

    -- Optional fields
    additional_notes TEXT,
    voice_recording_id UUID REFERENCES voice_recordings(recording_id),

    -- Assessment metadata
    assessed_by UUID NOT NULL REFERENCES staff(staff_id),
    input_method VARCHAR(50) DEFAULT 'form' CHECK (input_method IN ('voice', 'form', 'mixed')),

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_barthel_patient ON barthel_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_barthel_assessed_at ON barthel_assessments(assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_barthel_total_score ON barthel_assessments(total_score);
CREATE INDEX IF NOT EXISTS idx_barthel_category_scores ON barthel_assessments USING GIN (category_scores);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_barthel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER barthel_updated_at_trigger
    BEFORE UPDATE ON barthel_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_barthel_updated_at();

-- Comments for documentation
COMMENT ON TABLE barthel_assessments IS 'Barthel Index ADL assessments - standard tool for measuring independence in activities of daily living';
COMMENT ON COLUMN barthel_assessments.total_score IS 'Total Barthel Index score (0-100): 0-20=total dependency, 21-60=severe dependency, 61-90=moderate dependency, 91-99=slight dependency, 100=independent';
COMMENT ON COLUMN barthel_assessments.category_scores IS 'Individual scores by category: eating, transfer, toileting, walking, grooming, bathing, stairs, dressing, bowel, bladder';
COMMENT ON COLUMN barthel_assessments.input_method IS 'How the assessment was captured: voice (from voice recording), form (manual entry), mixed (both)';
