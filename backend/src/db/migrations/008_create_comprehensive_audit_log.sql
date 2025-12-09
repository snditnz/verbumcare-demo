-- Migration: Create Comprehensive Audit Log System
-- Description: Creates a comprehensive audit_logs table with hash chain for immutability
--              Preserves existing auth_audit_log and care_plan_audit_log tables

-- ========== 1. Create Comprehensive Audit Log Table ==========

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Event identification
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'data_access', 'data_create', 'data_update', 'data_delete',
        'patient_view', 'patient_update', 'care_plan_view', 'care_plan_update',
        'medication_view', 'medication_admin', 'vitals_view', 'vitals_create',
        'clinical_note_view', 'clinical_note_create', 'assessment_view', 'assessment_create',
        'voice_upload', 'voice_process', 'export_data', 'import_data'
    )),
    action_description TEXT NOT NULL,
    
    -- User information
    user_id UUID REFERENCES staff(staff_id),
    username VARCHAR(100),
    user_role VARCHAR(50),
    
    -- Resource information
    resource_type VARCHAR(50), -- e.g., 'patient', 'care_plan', 'medication', 'vital_signs'
    resource_id UUID,
    patient_id UUID REFERENCES patients(patient_id), -- For patient-related actions
    
    -- Data changes (for modifications)
    before_value JSONB, -- State before modification
    after_value JSONB,  -- State after modification
    
    -- Request context
    ip_address INET,
    device_info JSONB,
    session_id UUID,
    
    -- Hash chain for immutability
    record_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of this record
    previous_hash VARCHAR(64) NOT NULL, -- Hash of previous record (genesis: all zeros)
    
    -- Metadata
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    facility_id UUID REFERENCES facilities(facility_id)
);

-- ========== 2. Create Indexes for Performance ==========

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient ON audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash ON audit_logs(record_hash);

-- ========== 3. Add Comments ==========

COMMENT ON TABLE audit_logs IS 'Comprehensive audit log with cryptographic hash chain for immutability';
COMMENT ON COLUMN audit_logs.event_type IS 'Type of event being audited';
COMMENT ON COLUMN audit_logs.before_value IS 'State of data before modification (NULL for access/create)';
COMMENT ON COLUMN audit_logs.after_value IS 'State of data after modification (NULL for access/delete)';
COMMENT ON COLUMN audit_logs.record_hash IS 'SHA-256 hash of this record for integrity verification';
COMMENT ON COLUMN audit_logs.previous_hash IS 'Hash of previous audit log entry (forms immutable chain)';

-- ========== 4. Create Function to Get Latest Hash ==========

CREATE OR REPLACE FUNCTION get_latest_audit_hash()
RETURNS VARCHAR(64) AS $$
DECLARE
    latest_hash VARCHAR(64);
BEGIN
    SELECT record_hash INTO latest_hash
    FROM audit_logs
    ORDER BY timestamp DESC, log_id DESC
    LIMIT 1;
    
    -- If no records exist, return genesis hash (all zeros)
    IF latest_hash IS NULL THEN
        RETURN '0000000000000000000000000000000000000000000000000000000000000000';
    END IF;
    
    RETURN latest_hash;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_latest_audit_hash() IS 'Returns the hash of the most recent audit log entry for hash chain';

-- ========== 5. Migration Summary ==========

-- Summary:
-- - Created audit_logs table with comprehensive event tracking
-- - Implemented hash chain for immutability (record_hash, previous_hash)
-- - Added indexes for efficient querying by user, patient, resource, event type, and timestamp
-- - Created helper function to get latest hash for chain continuation
-- - Preserved existing auth_audit_log and care_plan_audit_log tables (no changes)
