-- VerbumCare Demo Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if exist (for clean setup)
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
    ai_structured_extraction JSONB,
    ai_confidence_score DECIMAL(3,2),
    recorded_by UUID NOT NULL REFERENCES staff(staff_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key for voice recording reference
ALTER TABLE nursing_assessments
ADD CONSTRAINT fk_voice_recording
FOREIGN KEY (voice_recording_id)
REFERENCES voice_recordings(recording_id);

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