-- VerbumCare Demo Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if exist (for clean setup)
DROP TABLE IF EXISTS care_plan_audit_log CASCADE;
DROP TABLE IF EXISTS care_conferences CASCADE;
DROP TABLE IF EXISTS monitoring_records CASCADE;
DROP TABLE IF EXISTS weekly_schedule_items CASCADE;
DROP TABLE IF EXISTS care_plan_progress_notes CASCADE;
DROP TABLE IF EXISTS care_plan_items CASCADE;
DROP TABLE IF EXISTS care_plans CASCADE;
DROP TABLE IF EXISTS problem_templates CASCADE;
DROP TABLE IF EXISTS voice_recordings CASCADE;
DROP TABLE IF EXISTS nursing_assessments CASCADE;
DROP TABLE IF EXISTS vital_signs CASCADE;
DROP TABLE IF EXISTS medication_administrations CASCADE;
DROP TABLE IF EXISTS medication_orders CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;

-- Facilities table
CREATE TABLE facilities (
    facility_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    facility_name VARCHAR(255) NOT NULL,
    facility_name_ja VARCHAR(255),
    facility_name_zh VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Asia/Tokyo',
    language VARCHAR(10) DEFAULT 'ja',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
    patient_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    facility_id UUID NOT NULL REFERENCES facilities(facility_id),
    mrn VARCHAR(50) NOT NULL,
    family_name VARCHAR(100) NOT NULL,
    given_name VARCHAR(100) NOT NULL,
    family_name_kana VARCHAR(100),
    given_name_kana VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    room VARCHAR(20),
    bed VARCHAR(10),
    blood_type VARCHAR(10),
    admission_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(facility_id, mrn)
);

-- Staff table
CREATE TABLE staff (
    staff_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    facility_id UUID NOT NULL REFERENCES facilities(facility_id),
    employee_number VARCHAR(50) NOT NULL,
    family_name VARCHAR(100) NOT NULL,
    given_name VARCHAR(100) NOT NULL,
    family_name_kana VARCHAR(100),
    given_name_kana VARCHAR(100),
    role VARCHAR(50) NOT NULL CHECK (role IN ('physician', 'registered_nurse', 'pharmacist', 'nurse_assistant')),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(facility_id, employee_number)
);

-- Medication orders table
CREATE TABLE medication_orders (
    order_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id),
    order_number VARCHAR(50) NOT NULL,
    medication_name_ja TEXT NOT NULL,
    medication_name_en TEXT,
    medication_name_zh TEXT,
    hot_code VARCHAR(50),
    dose VARCHAR(50) NOT NULL,
    dose_unit VARCHAR(20) NOT NULL,
    route VARCHAR(50) NOT NULL CHECK (route IN ('oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'rectal', 'sublingual')),
    frequency VARCHAR(50) NOT NULL,
    scheduled_time TIME,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP,
    prn BOOLEAN DEFAULT FALSE,
    prn_reason VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued', 'on_hold')),
    ordered_by UUID REFERENCES staff(staff_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medication administrations table with hash chain
CREATE TABLE medication_administrations (
    administration_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES medication_orders(order_id),
    patient_id UUID NOT NULL REFERENCES patients(patient_id),
    scheduled_datetime TIMESTAMP,
    administered_datetime TIMESTAMP NOT NULL,
    patient_barcode_scanned BOOLEAN DEFAULT FALSE,
    patient_barcode_value VARCHAR(255),
    medication_barcode_scanned BOOLEAN DEFAULT FALSE,
    medication_barcode_value VARCHAR(255),
    dose_given VARCHAR(50),
    route_given VARCHAR(50),
    status VARCHAR(50) NOT NULL CHECK (status IN ('administered', 'refused', 'held', 'omitted')),
    reason_if_not_given TEXT,
    administered_by UUID NOT NULL REFERENCES staff(staff_id),
    notes TEXT,
    record_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    chain_sequence BIGSERIAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on hash for faster lookups
CREATE INDEX idx_medication_administrations_hash ON medication_administrations(record_hash);
CREATE INDEX idx_medication_administrations_sequence ON medication_administrations(chain_sequence);

-- Vital signs table
CREATE TABLE vital_signs (
    vital_sign_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id),
    measured_at TIMESTAMP NOT NULL,
    temperature_celsius DECIMAL(4,1),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
    blood_glucose_mg_dl INTEGER,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,1),
    input_method VARCHAR(50) DEFAULT 'manual' CHECK (input_method IN ('iot_sensor', 'manual', 'voice')),
    device_id VARCHAR(100),
    recorded_by UUID NOT NULL REFERENCES staff(staff_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Nursing assessments table
CREATE TABLE nursing_assessments (
    assessment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id),
    assessment_datetime TIMESTAMP NOT NULL,
    assessment_type VARCHAR(50) DEFAULT 'routine',
    input_method VARCHAR(50) DEFAULT 'form' CHECK (input_method IN ('voice', 'form', 'mixed')),
    voice_recording_id UUID,
    structured_data JSONB,
    narrative_notes TEXT,
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_confidence_score DECIMAL(3,2),
    assessed_by UUID NOT NULL REFERENCES staff(staff_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice recordings table
CREATE TABLE voice_recordings (
    recording_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id),
    recorded_at TIMESTAMP NOT NULL,
    duration_seconds INTEGER,
    audio_file_path TEXT,
    transcription_text TEXT,
    transcription_language VARCHAR(10),
    ai_structured_extraction JSONB,  -- Bilingual format: {ja: {...}, en: {...}}
    ai_confidence_score DECIMAL(3,2),
    processing_status VARCHAR(50) DEFAULT 'pending',
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_error TEXT,
    recorded_by UUID NOT NULL REFERENCES staff(staff_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key for voice recording reference
ALTER TABLE nursing_assessments
ADD CONSTRAINT fk_voice_recording
FOREIGN KEY (voice_recording_id)
REFERENCES voice_recordings(recording_id);

-- Care Plans table (Japanese Long-Term Care Insurance compliant)
CREATE TABLE care_plans (
    care_plan_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(patient_id),
    care_level VARCHAR(20), -- 要支援1, 要支援2, 要介護1-5
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    version INTEGER DEFAULT 1,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_review_date TIMESTAMP,
    next_review_date TIMESTAMP,
    created_by UUID REFERENCES staff(staff_id),

    -- Table 1 - Basic Info & Policy
    patient_intent TEXT, -- 利用者の意向
    family_intent TEXT, -- 家族の意向
    comprehensive_policy TEXT, -- 総合的な援助の方針

    -- Team & Family
    care_manager_id UUID REFERENCES staff(staff_id),
    team_members JSONB, -- Array of team member objects
    family_signature JSONB, -- Family signature data

    -- Monitoring
    last_monitoring_date TIMESTAMP,
    next_monitoring_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Care Plan Items (Problems, Goals, Interventions)
CREATE TABLE care_plan_items (
    care_plan_item_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    care_plan_id UUID NOT NULL REFERENCES care_plans(care_plan_id) ON DELETE CASCADE,

    -- Problem/Need
    problem_category VARCHAR(50) NOT NULL, -- ADL, fall_prevention, pain_management, etc.
    problem_description TEXT NOT NULL,
    problem_priority VARCHAR(20) NOT NULL, -- urgent, high, medium, low
    identified_date TIMESTAMP NOT NULL,
    problem_status VARCHAR(20) DEFAULT 'active', -- active, resolved, monitoring

    -- Long-term Goal
    long_term_goal_description TEXT NOT NULL,
    long_term_goal_target_date TIMESTAMP,
    long_term_goal_duration VARCHAR(20), -- 1_month, 3_months, 6_months, 12_months
    long_term_goal_achievement_status INTEGER DEFAULT 0, -- 0-100

    -- Short-term Goal
    short_term_goal_description TEXT NOT NULL,
    short_term_goal_target_date TIMESTAMP,
    short_term_goal_duration VARCHAR(20),
    short_term_goal_achievement_status INTEGER DEFAULT 0, -- 0-100
    short_term_goal_measurable_criteria TEXT,

    -- Interventions (stored as JSONB array)
    interventions JSONB, -- Array of intervention objects

    -- Links to assessments
    linked_assessments JSONB, -- {adlId, fallRiskId, painAssessmentId, nutritionId}

    -- Metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES staff(staff_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Care Plan Progress Notes
CREATE TABLE care_plan_progress_notes (
    progress_note_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    care_plan_item_id UUID NOT NULL REFERENCES care_plan_items(care_plan_item_id) ON DELETE CASCADE,
    note_date TIMESTAMP NOT NULL,
    note TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES staff(staff_id),
    author_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Schedule Items
CREATE TABLE weekly_schedule_items (
    schedule_item_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    care_plan_id UUID NOT NULL REFERENCES care_plans(care_plan_id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    time_slot VARCHAR(20) NOT NULL, -- morning, afternoon, evening, night, specific_time
    specific_time TIME,

    service_data JSONB NOT NULL, -- Service details (type, description, duration, provider, location)
    linked_to_care_plan_item UUID REFERENCES care_plan_items(care_plan_item_id),
    frequency VARCHAR(50), -- daily, weekly, biweekly, monthly, as_needed

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring Records
CREATE TABLE monitoring_records (
    monitoring_record_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    care_plan_id UUID NOT NULL REFERENCES care_plans(care_plan_id) ON DELETE CASCADE,
    monitoring_date TIMESTAMP NOT NULL,
    monitoring_type VARCHAR(50) NOT NULL, -- routine_3month, formal_6month, condition_change
    conducted_by UUID NOT NULL REFERENCES staff(staff_id),
    conducted_by_name VARCHAR(200) NOT NULL,

    -- Assessment data
    item_reviews JSONB, -- Array of item review objects
    overall_status TEXT,
    patient_feedback TEXT,
    family_feedback TEXT,
    staff_observations TEXT,

    -- Changes needed
    proposed_changes JSONB, -- {newProblems[], resolvedProblems[], goalAdjustments[], interventionChanges[]}

    -- Next steps
    next_monitoring_date TIMESTAMP,
    action_items JSONB, -- Array of action item strings

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Care Conferences
CREATE TABLE care_conferences (
    care_conference_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    care_plan_id UUID NOT NULL REFERENCES care_plans(care_plan_id) ON DELETE CASCADE,
    conference_date TIMESTAMP NOT NULL,
    conference_type VARCHAR(50) NOT NULL, -- initial, routine_review, condition_change, family_request

    attendees JSONB NOT NULL, -- Array of attendee objects
    discussion JSONB NOT NULL, -- {currentStatus, concerns[], suggestions[], decisions[]}
    minutes TEXT,
    action_items JSONB, -- Array of action item objects

    care_plan_approved BOOLEAN DEFAULT FALSE,
    next_conference_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Care Plan Audit Log
CREATE TABLE care_plan_audit_log (
    audit_log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    care_plan_id UUID NOT NULL REFERENCES care_plans(care_plan_id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES staff(staff_id),
    user_name VARCHAR(200) NOT NULL,
    action VARCHAR(100) NOT NULL,
    changes JSONB,
    version INTEGER NOT NULL
);

-- Problem Templates (for quick entry)
CREATE TABLE problem_templates (
    template_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- ADL, fall_prevention, pain_management, etc.
    japanese_text TEXT NOT NULL,
    english_text TEXT NOT NULL,
    suggested_long_term_goals JSONB, -- Array of goal strings
    suggested_short_term_goals JSONB, -- Array of goal strings
    suggested_interventions JSONB, -- Array of {type, description} objects
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_patients_facility ON patients(facility_id);
CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_medication_orders_patient ON medication_orders(patient_id);
CREATE INDEX idx_medication_orders_status ON medication_orders(status);
CREATE INDEX idx_medication_administrations_patient ON medication_administrations(patient_id);
CREATE INDEX idx_medication_administrations_datetime ON medication_administrations(administered_datetime);
CREATE INDEX idx_vital_signs_patient ON vital_signs(patient_id);
CREATE INDEX idx_vital_signs_measured ON vital_signs(measured_at);
CREATE INDEX idx_nursing_assessments_patient ON nursing_assessments(patient_id);
CREATE INDEX idx_voice_recordings_patient ON voice_recordings(patient_id);
CREATE INDEX idx_voice_recordings_processing_status ON voice_recordings(processing_status);
CREATE INDEX idx_voice_recordings_extraction_ja ON voice_recordings USING GIN ((ai_structured_extraction->'ja'));
CREATE INDEX idx_voice_recordings_extraction_en ON voice_recordings USING GIN ((ai_structured_extraction->'en'));

-- Care Plan indexes
CREATE INDEX idx_care_plans_patient ON care_plans(patient_id);
CREATE INDEX idx_care_plans_status ON care_plans(status);
CREATE INDEX idx_care_plan_items_care_plan ON care_plan_items(care_plan_id);
CREATE INDEX idx_care_plan_progress_notes_item ON care_plan_progress_notes(care_plan_item_id);
CREATE INDEX idx_weekly_schedule_items_care_plan ON weekly_schedule_items(care_plan_id);
CREATE INDEX idx_monitoring_records_care_plan ON monitoring_records(care_plan_id);
CREATE INDEX idx_care_conferences_care_plan ON care_conferences(care_plan_id);
CREATE INDEX idx_care_plan_audit_log_care_plan ON care_plan_audit_log(care_plan_id);
CREATE INDEX idx_problem_templates_category ON problem_templates(category);