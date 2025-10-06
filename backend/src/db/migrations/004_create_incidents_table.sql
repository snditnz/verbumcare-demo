-- Migration: Create patient incidents table
-- Date: 2025-10-06
-- Track falls, medication errors, behavioral incidents, injuries, etc.

CREATE TABLE IF NOT EXISTS patient_incidents (
    incident_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,

    -- Incident classification
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('fall', 'medication-error', 'behavioral', 'injury', 'other')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- Incident details
    occurred_at TIMESTAMP NOT NULL,
    description TEXT NOT NULL,

    -- Voice recording (optional)
    voice_recording_id UUID REFERENCES voice_recordings(recording_id),

    -- Photo evidence (stored as array of file paths)
    photo_paths TEXT[],

    -- Metadata
    reported_by UUID NOT NULL REFERENCES staff(staff_id),
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Review and follow-up
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES staff(staff_id),
    reviewed_at TIMESTAMP,
    follow_up_notes TEXT,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_incidents_patient ON patient_incidents(patient_id);
CREATE INDEX IF NOT EXISTS idx_incidents_occurred_at ON patient_incidents(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON patient_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON patient_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_reviewed ON patient_incidents(reviewed) WHERE reviewed = FALSE;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_incident_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_updated_at_trigger
    BEFORE UPDATE ON patient_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_updated_at();

-- Comments for documentation
COMMENT ON TABLE patient_incidents IS 'Patient incident reports including falls, medication errors, behavioral events, and injuries';
COMMENT ON COLUMN patient_incidents.incident_type IS 'Type of incident: fall, medication-error, behavioral, injury, other';
COMMENT ON COLUMN patient_incidents.severity IS 'Severity level: low, medium, high, critical (determines escalation workflow)';
COMMENT ON COLUMN patient_incidents.occurred_at IS 'When the incident occurred (may differ from when it was reported)';
COMMENT ON COLUMN patient_incidents.photo_paths IS 'Array of file paths to incident photos (e.g., bruises, falls)';
COMMENT ON COLUMN patient_incidents.reviewed IS 'Whether the incident has been reviewed by management';
