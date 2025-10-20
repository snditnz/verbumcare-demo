-- Add English name columns to patients table
-- These columns store romanized/English versions of names for multilingual support

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS family_name_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS given_name_en VARCHAR(100);

-- Add comments for clarity
COMMENT ON COLUMN patients.family_name_en IS 'Romanized or English version of family name';
COMMENT ON COLUMN patients.given_name_en IS 'Romanized or English version of given name';
