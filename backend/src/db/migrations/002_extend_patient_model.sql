-- Migration: Extend patient model with additional fields for iPad app
-- Date: 2025-10-06

-- Add English name fields for bilingual support
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS family_name_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS given_name_en VARCHAR(100);

-- Add physical measurements (baseline - different from vital signs which are time-series)
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS height_cm DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(5,2);

-- Add medical information fields
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS medications_summary TEXT,
ADD COLUMN IF NOT EXISTS key_notes TEXT;

-- Add risk factors as array
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS risk_factors TEXT[];

-- Add status field (computed from risk factors and recent assessments)
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS status VARCHAR(20) CHECK (status IN ('green', 'yellow', 'red'));

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_patients_family_name_en ON patients(family_name_en);
CREATE INDEX IF NOT EXISTS idx_patients_given_name_en ON patients(given_name_en);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_risk_factors ON patients USING GIN (risk_factors);

COMMENT ON COLUMN patients.family_name_en IS 'English/romanized version of family name for bilingual display';
COMMENT ON COLUMN patients.given_name_en IS 'English/romanized version of given name for bilingual display';
COMMENT ON COLUMN patients.height_cm IS 'Baseline height in centimeters (not time-series like vital signs)';
COMMENT ON COLUMN patients.weight_kg IS 'Baseline weight in kilograms (not time-series like vital signs)';
COMMENT ON COLUMN patients.allergies IS 'Known allergies and contraindications';
COMMENT ON COLUMN patients.medications_summary IS 'Current medications summary (comma-separated Japanese format)';
COMMENT ON COLUMN patients.key_notes IS 'Important clinical notes and care instructions';
COMMENT ON COLUMN patients.risk_factors IS 'Array of risk factors (e.g., 認知症, 転倒リスク, etc.)';
COMMENT ON COLUMN patients.status IS 'Visual status indicator: green (stable), yellow (caution), red (high risk)';
