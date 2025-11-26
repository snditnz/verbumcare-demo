-- Migration: Add Authentication Support
-- Description: Adds JWT session management, auth audit logging, English names for staff,
--              and proper password hashes for production-ready authentication

-- ========== 1. Add English Name Fields to Staff Table ==========

ALTER TABLE staff
ADD COLUMN IF NOT EXISTS family_name_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS given_name_en VARCHAR(100);

COMMENT ON COLUMN staff.family_name_en IS 'English family/last name for international staff';
COMMENT ON COLUMN staff.given_name_en IS 'English given/first name for international staff';

-- ========== 2. Create Staff Sessions Table (JWT Token Management) ==========

CREATE TABLE IF NOT EXISTS staff_sessions (
    session_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    staff_id UUID NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
    access_token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    device_info JSONB,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_staff ON staff_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON staff_sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_expires ON staff_sessions(expires_at);

COMMENT ON TABLE staff_sessions IS 'Active authentication sessions with JWT tokens';
COMMENT ON COLUMN staff_sessions.access_token IS 'Short-lived JWT access token (8 hours)';
COMMENT ON COLUMN staff_sessions.refresh_token IS 'Long-lived JWT refresh token (7 days)';
COMMENT ON COLUMN staff_sessions.device_info IS 'JSON with device platform, app version, etc.';

-- ========== 3. Create Auth Audit Log Table ==========

CREATE TABLE IF NOT EXISTS auth_audit_log (
    log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    staff_id UUID REFERENCES staff(staff_id),
    username VARCHAR(50),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'login',
        'logout',
        'failed_login',
        'token_refresh',
        'password_change',
        'password_reset'
    )),
    ip_address VARCHAR(45),
    device_info JSONB,
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_staff ON auth_audit_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_timestamp ON auth_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event ON auth_audit_log(event_type);

COMMENT ON TABLE auth_audit_log IS 'Security audit log for all authentication events';
COMMENT ON COLUMN auth_audit_log.event_type IS 'Type of auth event for tracking and security monitoring';
COMMENT ON COLUMN auth_audit_log.failure_reason IS 'Reason for failure (e.g., invalid_password, user_not_found)';

-- ========== 4. Update Existing Staff with English Names ==========

-- Sato Misaki (nurse1)
UPDATE staff SET
    family_name_en = 'Sato',
    given_name_en = 'Misaki'
WHERE staff_id = '550e8400-e29b-41d4-a716-446655440101';

-- Suzuki Hanako (nurse2)
UPDATE staff SET
    family_name_en = 'Suzuki',
    given_name_en = 'Hanako'
WHERE staff_id = '550e8400-e29b-41d4-a716-446655440102';

-- Tanaka Kenichi (doctor1)
UPDATE staff SET
    family_name_en = 'Tanaka',
    given_name_en = 'Kenichi'
WHERE staff_id = '550e8400-e29b-41d4-a716-446655440103';

-- ========== 5. Update Usernames to Match Frontend Expectations ==========

UPDATE staff SET username = 'nurse1'
WHERE staff_id = '550e8400-e29b-41d4-a716-446655440101';

UPDATE staff SET username = 'nurse2'
WHERE staff_id = '550e8400-e29b-41d4-a716-446655440102';

UPDATE staff SET username = 'doctor1'
WHERE staff_id = '550e8400-e29b-41d4-a716-446655440103';

-- ========== 6. Add Proper Password Hashes (bcrypt) ==========
-- Password for all demo users: "demo123"
-- bcrypt hash rounds: 10
-- Generated with: bcryptjs.hash('demo123', 10)
-- NOTE: Using $2a$ format (bcryptjs), not $2b$ (bcrypt)

UPDATE staff SET password_hash = '$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S'
WHERE staff_id IN (
    '550e8400-e29b-41d4-a716-446655440101', -- nurse1
    '550e8400-e29b-41d4-a716-446655440102', -- nurse2
    '550e8400-e29b-41d4-a716-446655440103'  -- doctor1
);

-- ========== 7. Insert Additional Demo Users ==========

-- Care Manager (manager1)
INSERT INTO staff (
    staff_id,
    facility_id,
    employee_number,
    family_name,
    given_name,
    family_name_kana,
    given_name_kana,
    family_name_en,
    given_name_en,
    role,
    username,
    password_hash
) VALUES (
    '550e8400-e29b-41d4-a716-446655440104',
    '550e8400-e29b-41d4-a716-446655440001', -- Same facility as others
    'CM001',
    '田中',
    '博',
    'タナカ',
    'ヒロシ',
    'Tanaka',
    'Hiroshi',
    'registered_nurse', -- Will map to 'care_manager' in frontend
    'manager1',
    '$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S' -- demo123
) ON CONFLICT (staff_id) DO NOTHING;

-- Demo User (demo)
INSERT INTO staff (
    staff_id,
    facility_id,
    employee_number,
    family_name,
    given_name,
    family_name_kana,
    given_name_kana,
    family_name_en,
    given_name_en,
    role,
    username,
    password_hash
) VALUES (
    '550e8400-e29b-41d4-a716-446655440105',
    '550e8400-e29b-41d4-a716-446655440001', -- Same facility
    'DEMO001',
    'デモ',
    '職員',
    'デモ',
    'ショクイン',
    'Demo',
    'Staff',
    'registered_nurse',
    'demo',
    '$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S' -- demo123
) ON CONFLICT (staff_id) DO NOTHING;

-- ========== 8. Function to Clean Up Expired Sessions ==========

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM staff_sessions
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired sessions - should be called by cron job daily';

-- ========== Migration Complete ==========
-- Summary:
-- - Added English name fields to staff table
-- - Created staff_sessions table for JWT token management
-- - Created auth_audit_log table for security tracking
-- - Updated existing staff with English names and proper usernames
-- - Added bcrypt password hashes (password: demo123)
-- - Inserted manager1 and demo users
-- - Added cleanup function for expired sessions
