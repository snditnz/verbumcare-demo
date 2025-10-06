-- Migration: Create session data table for hub-and-spoke workflow
-- Date: 2025-10-06
-- Stores temporary session data before batch submission (offline support)

CREATE TABLE IF NOT EXISTS patient_session_data (
    session_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(staff_id),

    -- Session metadata
    session_started_at TIMESTAMP NOT NULL,
    session_device_id VARCHAR(255), -- For tracking which iPad
    session_status VARCHAR(20) DEFAULT 'active' CHECK (session_status IN ('active', 'submitted', 'abandoned')),

    -- Session data (JSONB for flexibility)
    vitals JSONB,                    -- {temperature_celsius, blood_pressure_systolic, ...}
    barthel_index JSONB,              -- {total_score, scores: {...}, additional_notes}
    medications JSONB,                -- [{medicationId, medicationName, dosage, route, ...}]
    patient_updates JSONB,            -- {height, weight, allergies, medications, keyNotes, confirmed}
    incidents JSONB,                  -- [{id, type, severity, datetime, description, ...}]

    -- Timestamps
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_patient ON patient_session_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_session_staff ON patient_session_data(staff_id);
CREATE INDEX IF NOT EXISTS idx_session_status ON patient_session_data(session_status);
CREATE INDEX IF NOT EXISTS idx_session_started_at ON patient_session_data(session_started_at DESC);

-- Create partial index for active sessions only
CREATE INDEX IF NOT EXISTS idx_session_active
ON patient_session_data(patient_id, session_started_at DESC)
WHERE session_status = 'active';

-- Add trigger to update last_updated_at timestamp
CREATE OR REPLACE FUNCTION update_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_updated_at_trigger
    BEFORE UPDATE ON patient_session_data
    FOR EACH ROW
    EXECUTE FUNCTION update_session_updated_at();

-- Function to auto-abandon stale sessions (older than 24 hours)
CREATE OR REPLACE FUNCTION abandon_stale_sessions()
RETURNS INTEGER AS $$
DECLARE
    abandoned_count INTEGER;
BEGIN
    UPDATE patient_session_data
    SET session_status = 'abandoned'
    WHERE session_status = 'active'
    AND session_started_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS abandoned_count = ROW_COUNT;
    RETURN abandoned_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE patient_session_data IS 'Temporary storage for iPad app session data before batch submission (supports offline workflow)';
COMMENT ON COLUMN patient_session_data.session_device_id IS 'Device identifier to track which iPad created the session';
COMMENT ON COLUMN patient_session_data.session_status IS 'active=in progress, submitted=completed and saved, abandoned=stale/incomplete';
COMMENT ON COLUMN patient_session_data.vitals IS 'Vital signs captured during session';
COMMENT ON COLUMN patient_session_data.barthel_index IS 'Barthel Index assessment data';
COMMENT ON COLUMN patient_session_data.medications IS 'Medication administrations during session';
COMMENT ON COLUMN patient_session_data.patient_updates IS 'Updates to patient demographics/medical info';
COMMENT ON COLUMN patient_session_data.incidents IS 'Incident reports created during session';
