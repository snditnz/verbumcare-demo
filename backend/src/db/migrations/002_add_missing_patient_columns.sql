-- Add missing columns to patients table for comprehensive patient tracking
-- These columns are used by the API but were missing from the original schema

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS allergies TEXT[],
ADD COLUMN IF NOT EXISTS medications_summary TEXT,
ADD COLUMN IF NOT EXISTS key_notes TEXT,
ADD COLUMN IF NOT EXISTS risk_factors TEXT[],
ADD COLUMN IF NOT EXISTS status VARCHAR(20) CHECK (status IN ('green', 'yellow', 'red'));

-- Add comments for clarity
COMMENT ON COLUMN patients.height_cm IS 'Patient height in centimeters';
COMMENT ON COLUMN patients.weight_kg IS 'Patient weight in kilograms';
COMMENT ON COLUMN patients.allergies IS 'Array of patient allergies';
COMMENT ON COLUMN patients.medications_summary IS 'Summary of current medications';
COMMENT ON COLUMN patients.key_notes IS 'Important clinical notes';
COMMENT ON COLUMN patients.risk_factors IS 'Array of risk factors';
COMMENT ON COLUMN patients.status IS 'Patient status indicator: green (stable), yellow (caution), red (critical)';
