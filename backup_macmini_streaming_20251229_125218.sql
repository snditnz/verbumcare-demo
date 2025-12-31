--
-- PostgreSQL database dump
--

\restrict n011UFjEhVwRBqKdlI8Kc1Qs6ttGx8Ucetpd2gzTn09yNeQbD9xl82vUvyVXBiw

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: abandon_stale_sessions(); Type: FUNCTION; Schema: public; Owner: nagare
--

CREATE FUNCTION public.abandon_stale_sessions() RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.abandon_stale_sessions() OWNER TO nagare;

--
-- Name: cleanup_expired_sessions(); Type: FUNCTION; Schema: public; Owner: nagare
--

CREATE FUNCTION public.cleanup_expired_sessions() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM staff_sessions
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_sessions() OWNER TO nagare;

--
-- Name: FUNCTION cleanup_expired_sessions(); Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON FUNCTION public.cleanup_expired_sessions() IS 'Removes expired sessions - should be called by cron job daily';


--
-- Name: update_barthel_updated_at(); Type: FUNCTION; Schema: public; Owner: nagare
--

CREATE FUNCTION public.update_barthel_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_barthel_updated_at() OWNER TO nagare;

--
-- Name: update_clinical_notes_updated_at(); Type: FUNCTION; Schema: public; Owner: nagare
--

CREATE FUNCTION public.update_clinical_notes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_clinical_notes_updated_at() OWNER TO nagare;

--
-- Name: update_incident_updated_at(); Type: FUNCTION; Schema: public; Owner: nagare
--

CREATE FUNCTION public.update_incident_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_incident_updated_at() OWNER TO nagare;

--
-- Name: update_session_updated_at(); Type: FUNCTION; Schema: public; Owner: nagare
--

CREATE FUNCTION public.update_session_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.last_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_session_updated_at() OWNER TO nagare;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auth_audit_log; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.auth_audit_log (
    log_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    staff_id uuid,
    username character varying(50),
    event_type character varying(50) NOT NULL,
    ip_address character varying(45),
    device_info jsonb,
    success boolean NOT NULL,
    failure_reason text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT auth_audit_log_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('login'::character varying)::text, ('logout'::character varying)::text, ('failed_login'::character varying)::text, ('token_refresh'::character varying)::text, ('password_change'::character varying)::text, ('password_reset'::character varying)::text])))
);


ALTER TABLE public.auth_audit_log OWNER TO nagare;

--
-- Name: TABLE auth_audit_log; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.auth_audit_log IS 'Security audit log for all authentication events';


--
-- Name: COLUMN auth_audit_log.event_type; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.auth_audit_log.event_type IS 'Type of auth event for tracking and security monitoring';


--
-- Name: COLUMN auth_audit_log.failure_reason; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.auth_audit_log.failure_reason IS 'Reason for failure (e.g., invalid_password, user_not_found)';


--
-- Name: barthel_assessments; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.barthel_assessments (
    assessment_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    assessed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    total_score integer NOT NULL,
    category_scores jsonb NOT NULL,
    additional_notes text,
    voice_recording_id uuid,
    assessed_by uuid NOT NULL,
    input_method character varying(50) DEFAULT 'form'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT barthel_assessments_input_method_check CHECK (((input_method)::text = ANY (ARRAY[('voice'::character varying)::text, ('form'::character varying)::text, ('mixed'::character varying)::text]))),
    CONSTRAINT barthel_assessments_total_score_check CHECK (((total_score >= 0) AND (total_score <= 100)))
);


ALTER TABLE public.barthel_assessments OWNER TO nagare;

--
-- Name: TABLE barthel_assessments; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.barthel_assessments IS 'Barthel Index ADL assessments - standard tool for measuring independence in activities of daily living';


--
-- Name: COLUMN barthel_assessments.total_score; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.barthel_assessments.total_score IS 'Total Barthel Index score (0-100): 0-20=total dependency, 21-60=severe dependency, 61-90=moderate dependency, 91-99=slight dependency, 100=independent';


--
-- Name: COLUMN barthel_assessments.category_scores; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.barthel_assessments.category_scores IS 'Individual scores by category: eating, transfer, toileting, walking, grooming, bathing, stairs, dressing, bowel, bladder';


--
-- Name: COLUMN barthel_assessments.input_method; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.barthel_assessments.input_method IS 'How the assessment was captured: voice (from voice recording), form (manual entry), mixed (both)';


--
-- Name: care_conferences; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.care_conferences (
    care_conference_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    care_plan_id uuid NOT NULL,
    conference_date timestamp without time zone NOT NULL,
    conference_type character varying(50) NOT NULL,
    attendees jsonb NOT NULL,
    discussion jsonb NOT NULL,
    minutes text,
    action_items jsonb,
    care_plan_approved boolean DEFAULT false,
    next_conference_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.care_conferences OWNER TO nagare;

--
-- Name: care_plan_audit_log; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.care_plan_audit_log (
    audit_log_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    care_plan_id uuid NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid,
    user_name character varying(200) NOT NULL,
    action character varying(100) NOT NULL,
    changes jsonb,
    version integer NOT NULL
);


ALTER TABLE public.care_plan_audit_log OWNER TO nagare;

--
-- Name: care_plan_items; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.care_plan_items (
    care_plan_item_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    care_plan_id uuid NOT NULL,
    problem_category character varying(50) NOT NULL,
    problem_description text NOT NULL,
    problem_priority character varying(20) NOT NULL,
    identified_date timestamp without time zone NOT NULL,
    problem_status character varying(20) DEFAULT 'active'::character varying,
    long_term_goal_description text NOT NULL,
    long_term_goal_target_date timestamp without time zone,
    long_term_goal_duration character varying(20),
    long_term_goal_achievement_status integer DEFAULT 0,
    short_term_goal_description text NOT NULL,
    short_term_goal_target_date timestamp without time zone,
    short_term_goal_duration character varying(20),
    short_term_goal_achievement_status integer DEFAULT 0,
    short_term_goal_measurable_criteria text,
    interventions jsonb,
    linked_assessments jsonb,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.care_plan_items OWNER TO nagare;

--
-- Name: care_plan_progress_notes; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.care_plan_progress_notes (
    progress_note_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    care_plan_item_id uuid NOT NULL,
    note_date timestamp without time zone NOT NULL,
    note text NOT NULL,
    author_id uuid NOT NULL,
    author_name character varying(200) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.care_plan_progress_notes OWNER TO nagare;

--
-- Name: care_plans; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.care_plans (
    care_plan_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    care_level character varying(20),
    status character varying(20) DEFAULT 'active'::character varying,
    version integer DEFAULT 1,
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_review_date timestamp without time zone,
    next_review_date timestamp without time zone,
    created_by uuid,
    patient_intent text,
    family_intent text,
    comprehensive_policy text,
    care_manager_id uuid,
    team_members jsonb,
    family_signature jsonb,
    last_monitoring_date timestamp without time zone,
    next_monitoring_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT care_plans_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('draft'::character varying)::text, ('archived'::character varying)::text])))
);


ALTER TABLE public.care_plans OWNER TO nagare;

--
-- Name: clinical_notes; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.clinical_notes (
    note_id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    note_type character varying(50) NOT NULL,
    note_category character varying(50),
    note_datetime timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note_text text NOT NULL,
    voice_recording_id uuid,
    voice_transcribed boolean DEFAULT false,
    authored_by uuid NOT NULL,
    author_role character varying(50) NOT NULL,
    author_name character varying(200) NOT NULL,
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    follow_up_notes text,
    related_assessment_id uuid,
    related_session_id uuid,
    status character varying(20) DEFAULT 'submitted'::character varying NOT NULL,
    requires_approval boolean DEFAULT false,
    approved_by uuid,
    approved_by_name character varying(200),
    approval_datetime timestamp with time zone,
    approval_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT clinical_notes_note_category_check CHECK (((note_category)::text = ANY (ARRAY[('symptom_observation'::character varying)::text, ('treatment'::character varying)::text, ('consultation'::character varying)::text, ('fall_incident'::character varying)::text, ('medication'::character varying)::text, ('vital_signs'::character varying)::text, ('behavioral'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT clinical_notes_note_type_check CHECK (((note_type)::text = ANY (ARRAY[('nurse_note'::character varying)::text, ('doctor_note'::character varying)::text, ('care_note'::character varying)::text]))),
    CONSTRAINT clinical_notes_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('submitted'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text])))
);


ALTER TABLE public.clinical_notes OWNER TO nagare;

--
-- Name: TABLE clinical_notes; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.clinical_notes IS 'Clinical notes from nurses and doctors with voice recording support, categorization, follow-up tracking, and approval workflow';


--
-- Name: COLUMN clinical_notes.note_type; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.clinical_notes.note_type IS 'Type of note: nurse_note (看護記録), doctor_note (医師記録), care_note (介護記録)';


--
-- Name: COLUMN clinical_notes.note_category; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.clinical_notes.note_category IS 'Category of note for filtering and reporting';


--
-- Name: COLUMN clinical_notes.status; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.clinical_notes.status IS 'Workflow status: draft (not saved yet), submitted (visible), approved (co-signed), rejected (needs revision)';


--
-- Name: COLUMN clinical_notes.requires_approval; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.clinical_notes.requires_approval IS 'True if note requires doctor approval (e.g., certain nurse observations)';


--
-- Name: facilities; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.facilities (
    facility_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_name character varying(255) NOT NULL,
    facility_name_ja character varying(255),
    facility_name_zh character varying(255),
    timezone character varying(50) DEFAULT 'Asia/Tokyo'::character varying,
    language character varying(10) DEFAULT 'ja'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.facilities OWNER TO nagare;

--
-- Name: medication_administrations; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.medication_administrations (
    administration_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    scheduled_datetime timestamp without time zone,
    administered_datetime timestamp without time zone NOT NULL,
    patient_barcode_scanned boolean DEFAULT false,
    patient_barcode_value character varying(255),
    medication_barcode_scanned boolean DEFAULT false,
    medication_barcode_value character varying(255),
    dose_given character varying(50),
    route_given character varying(50),
    status character varying(50) NOT NULL,
    reason_if_not_given text,
    administered_by uuid NOT NULL,
    notes text,
    record_hash character varying(64) NOT NULL,
    previous_hash character varying(64),
    chain_sequence bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medication_administrations_status_check CHECK (((status)::text = ANY (ARRAY[('administered'::character varying)::text, ('refused'::character varying)::text, ('held'::character varying)::text, ('omitted'::character varying)::text])))
);


ALTER TABLE public.medication_administrations OWNER TO nagare;

--
-- Name: medication_administrations_chain_sequence_seq; Type: SEQUENCE; Schema: public; Owner: nagare
--

CREATE SEQUENCE public.medication_administrations_chain_sequence_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.medication_administrations_chain_sequence_seq OWNER TO nagare;

--
-- Name: medication_administrations_chain_sequence_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagare
--

ALTER SEQUENCE public.medication_administrations_chain_sequence_seq OWNED BY public.medication_administrations.chain_sequence;


--
-- Name: medication_orders; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.medication_orders (
    order_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    order_number character varying(50) NOT NULL,
    medication_name_ja text NOT NULL,
    medication_name_en text,
    medication_name_zh text,
    hot_code character varying(50),
    dose character varying(50) NOT NULL,
    dose_unit character varying(20) NOT NULL,
    route character varying(50) NOT NULL,
    frequency character varying(50) NOT NULL,
    scheduled_time time without time zone,
    start_datetime timestamp without time zone NOT NULL,
    end_datetime timestamp without time zone,
    prn boolean DEFAULT false,
    prn_reason character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    ordered_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medication_orders_route_check CHECK (((route)::text = ANY (ARRAY[('oral'::character varying)::text, ('iv'::character varying)::text, ('im'::character varying)::text, ('sc'::character varying)::text, ('topical'::character varying)::text, ('inhalation'::character varying)::text, ('rectal'::character varying)::text, ('sublingual'::character varying)::text]))),
    CONSTRAINT medication_orders_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('completed'::character varying)::text, ('discontinued'::character varying)::text, ('on_hold'::character varying)::text])))
);


ALTER TABLE public.medication_orders OWNER TO nagare;

--
-- Name: monitoring_records; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.monitoring_records (
    monitoring_record_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    care_plan_id uuid NOT NULL,
    monitoring_date timestamp without time zone NOT NULL,
    monitoring_type character varying(50) NOT NULL,
    conducted_by uuid NOT NULL,
    conducted_by_name character varying(200) NOT NULL,
    item_reviews jsonb,
    overall_status text,
    patient_feedback text,
    family_feedback text,
    staff_observations text,
    proposed_changes jsonb,
    next_monitoring_date timestamp without time zone,
    action_items jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.monitoring_records OWNER TO nagare;

--
-- Name: nursing_assessments; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.nursing_assessments (
    assessment_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    assessment_datetime timestamp without time zone NOT NULL,
    assessment_type character varying(50) DEFAULT 'routine'::character varying,
    input_method character varying(50) DEFAULT 'form'::character varying,
    voice_recording_id uuid,
    structured_data jsonb,
    narrative_notes text,
    ai_processed boolean DEFAULT false,
    ai_confidence_score numeric(3,2),
    assessed_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT nursing_assessments_input_method_check CHECK (((input_method)::text = ANY (ARRAY[('voice'::character varying)::text, ('form'::character varying)::text, ('mixed'::character varying)::text])))
);


ALTER TABLE public.nursing_assessments OWNER TO nagare;

--
-- Name: patient_incidents; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.patient_incidents (
    incident_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    incident_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    occurred_at timestamp without time zone NOT NULL,
    description text NOT NULL,
    voice_recording_id uuid,
    photo_paths text[],
    reported_by uuid NOT NULL,
    reported_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed boolean DEFAULT false,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    follow_up_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_incidents_incident_type_check CHECK (((incident_type)::text = ANY (ARRAY[('fall'::character varying)::text, ('medication-error'::character varying)::text, ('behavioral'::character varying)::text, ('injury'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT patient_incidents_severity_check CHECK (((severity)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text])))
);


ALTER TABLE public.patient_incidents OWNER TO nagare;

--
-- Name: TABLE patient_incidents; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.patient_incidents IS 'Patient incident reports including falls, medication errors, behavioral events, and injuries';


--
-- Name: COLUMN patient_incidents.incident_type; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_incidents.incident_type IS 'Type of incident: fall, medication-error, behavioral, injury, other';


--
-- Name: COLUMN patient_incidents.severity; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_incidents.severity IS 'Severity level: low, medium, high, critical (determines escalation workflow)';


--
-- Name: COLUMN patient_incidents.occurred_at; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_incidents.occurred_at IS 'When the incident occurred (may differ from when it was reported)';


--
-- Name: COLUMN patient_incidents.photo_paths; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_incidents.photo_paths IS 'Array of file paths to incident photos (e.g., bruises, falls)';


--
-- Name: COLUMN patient_incidents.reviewed; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_incidents.reviewed IS 'Whether the incident has been reviewed by management';


--
-- Name: patient_session_data; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.patient_session_data (
    session_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    session_started_at timestamp without time zone NOT NULL,
    session_device_id character varying(255),
    session_status character varying(20) DEFAULT 'active'::character varying,
    vitals jsonb,
    barthel_index jsonb,
    medications jsonb,
    patient_updates jsonb,
    incidents jsonb,
    last_updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    submitted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_session_data_session_status_check CHECK (((session_status)::text = ANY (ARRAY[('active'::character varying)::text, ('submitted'::character varying)::text, ('abandoned'::character varying)::text])))
);


ALTER TABLE public.patient_session_data OWNER TO nagare;

--
-- Name: TABLE patient_session_data; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.patient_session_data IS 'Temporary storage for iPad app session data before batch submission (supports offline workflow)';


--
-- Name: COLUMN patient_session_data.session_device_id; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_session_data.session_device_id IS 'Device identifier to track which iPad created the session';


--
-- Name: COLUMN patient_session_data.session_status; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_session_data.session_status IS 'active=in progress, submitted=completed and saved, abandoned=stale/incomplete';


--
-- Name: COLUMN patient_session_data.vitals; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_session_data.vitals IS 'Vital signs captured during session';


--
-- Name: COLUMN patient_session_data.barthel_index; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_session_data.barthel_index IS 'Barthel Index assessment data';


--
-- Name: COLUMN patient_session_data.medications; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_session_data.medications IS 'Medication administrations during session';


--
-- Name: COLUMN patient_session_data.patient_updates; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_session_data.patient_updates IS 'Updates to patient demographics/medical info';


--
-- Name: COLUMN patient_session_data.incidents; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patient_session_data.incidents IS 'Incident reports created during session';


--
-- Name: patients; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.patients (
    patient_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    mrn character varying(50) NOT NULL,
    family_name character varying(100) NOT NULL,
    given_name character varying(100) NOT NULL,
    family_name_kana character varying(100),
    given_name_kana character varying(100),
    family_name_en character varying(100),
    given_name_en character varying(100),
    date_of_birth date NOT NULL,
    gender character varying(20) NOT NULL,
    room character varying(20),
    bed character varying(10),
    blood_type character varying(10),
    admission_date date,
    height_cm numeric(5,2),
    weight_kg numeric(5,2),
    allergies text[],
    medications_summary text,
    key_notes text,
    risk_factors text[],
    status character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patients_status_check CHECK (((status)::text = ANY (ARRAY[('green'::character varying)::text, ('yellow'::character varying)::text, ('red'::character varying)::text])))
);


ALTER TABLE public.patients OWNER TO nagare;

--
-- Name: problem_templates; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.problem_templates (
    template_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category character varying(50) NOT NULL,
    japanese_text text NOT NULL,
    english_text text NOT NULL,
    chinese_text text,
    suggested_long_term_goals jsonb,
    suggested_short_term_goals jsonb,
    suggested_interventions jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.problem_templates OWNER TO nagare;

--
-- Name: staff; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.staff (
    staff_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    employee_number character varying(50) NOT NULL,
    family_name character varying(100) NOT NULL,
    given_name character varying(100) NOT NULL,
    family_name_kana character varying(100),
    given_name_kana character varying(100),
    role character varying(50) NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    family_name_en character varying(100),
    given_name_en character varying(100),
    CONSTRAINT staff_role_check CHECK (((role)::text = ANY (ARRAY[('physician'::character varying)::text, ('registered_nurse'::character varying)::text, ('pharmacist'::character varying)::text, ('nurse_assistant'::character varying)::text])))
);


ALTER TABLE public.staff OWNER TO nagare;

--
-- Name: COLUMN staff.family_name_en; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.staff.family_name_en IS 'English family/last name for international staff';


--
-- Name: COLUMN staff.given_name_en; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.staff.given_name_en IS 'English given/first name for international staff';


--
-- Name: staff_sessions; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.staff_sessions (
    session_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    staff_id uuid NOT NULL,
    access_token character varying(500) NOT NULL,
    refresh_token character varying(500),
    device_info jsonb,
    ip_address character varying(45),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.staff_sessions OWNER TO nagare;

--
-- Name: TABLE staff_sessions; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.staff_sessions IS 'Active authentication sessions with JWT tokens';


--
-- Name: COLUMN staff_sessions.access_token; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.staff_sessions.access_token IS 'Short-lived JWT access token (8 hours)';


--
-- Name: COLUMN staff_sessions.refresh_token; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.staff_sessions.refresh_token IS 'Long-lived JWT refresh token (7 days)';


--
-- Name: COLUMN staff_sessions.device_info; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.staff_sessions.device_info IS 'JSON with device platform, app version, etc.';


--
-- Name: vital_signs; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.vital_signs (
    vital_sign_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    measured_at timestamp without time zone NOT NULL,
    temperature_celsius numeric(4,1),
    blood_pressure_systolic integer,
    blood_pressure_diastolic integer,
    heart_rate integer,
    respiratory_rate integer,
    oxygen_saturation integer,
    pain_score integer,
    blood_glucose_mg_dl integer,
    weight_kg numeric(5,2),
    height_cm numeric(5,1),
    input_method character varying(50) DEFAULT 'manual'::character varying,
    device_id character varying(100),
    recorded_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vital_signs_input_method_check CHECK (((input_method)::text = ANY (ARRAY[('iot_sensor'::character varying)::text, ('manual'::character varying)::text, ('voice'::character varying)::text]))),
    CONSTRAINT vital_signs_pain_score_check CHECK (((pain_score >= 0) AND (pain_score <= 10)))
);


ALTER TABLE public.vital_signs OWNER TO nagare;

--
-- Name: voice_categorization_log; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.voice_categorization_log (
    log_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    review_id uuid NOT NULL,
    detected_categories jsonb NOT NULL,
    extraction_prompt text,
    extraction_response text,
    user_edited_transcript boolean DEFAULT false,
    user_edited_data boolean DEFAULT false,
    reanalysis_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    confirmed_at timestamp without time zone,
    confirmed_by uuid
);


ALTER TABLE public.voice_categorization_log OWNER TO nagare;

--
-- Name: TABLE voice_categorization_log; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.voice_categorization_log IS 'Audit trail of AI categorization decisions and user corrections for training feedback';


--
-- Name: COLUMN voice_categorization_log.detected_categories; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_categorization_log.detected_categories IS 'JSONB array of detected category types with confidence scores';


--
-- Name: COLUMN voice_categorization_log.extraction_prompt; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_categorization_log.extraction_prompt IS 'The prompt sent to the AI model for data extraction';


--
-- Name: COLUMN voice_categorization_log.extraction_response; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_categorization_log.extraction_response IS 'The raw response from the AI model';


--
-- Name: COLUMN voice_categorization_log.user_edited_transcript; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_categorization_log.user_edited_transcript IS 'Whether user edited the transcript before confirmation';


--
-- Name: COLUMN voice_categorization_log.user_edited_data; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_categorization_log.user_edited_data IS 'Whether user edited the extracted data fields before confirmation';


--
-- Name: COLUMN voice_categorization_log.reanalysis_count; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_categorization_log.reanalysis_count IS 'Number of times the transcript was re-analyzed after user edits';


--
-- Name: COLUMN voice_categorization_log.confirmed_by; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_categorization_log.confirmed_by IS 'Staff member who confirmed and saved the review to database';


--
-- Name: voice_recordings; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.voice_recordings (
    recording_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid,
    recorded_at timestamp without time zone NOT NULL,
    duration_seconds integer,
    audio_file_path text,
    transcription_text text,
    transcription_language character varying(10),
    ai_structured_extraction jsonb,
    ai_confidence_score numeric(3,2),
    processing_status character varying(50) DEFAULT 'pending'::character varying,
    processing_started_at timestamp without time zone,
    processing_completed_at timestamp without time zone,
    processing_error text,
    recorded_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    review_status character varying(20) DEFAULT 'not_reviewed'::character varying,
    context_type character varying(20),
    context_patient_id uuid,
    CONSTRAINT check_patient_id_context CHECK (((((context_type)::text = 'patient'::text) AND (patient_id IS NOT NULL)) OR ((context_type)::text = 'global'::text) OR ((context_type IS NULL) AND (patient_id IS NOT NULL)))),
    CONSTRAINT voice_recordings_context_type_check CHECK (((context_type)::text = ANY (ARRAY[('patient'::character varying)::text, ('global'::character varying)::text]))),
    CONSTRAINT voice_recordings_review_status_check CHECK (((review_status)::text = ANY (ARRAY[('not_reviewed'::character varying)::text, ('pending_review'::character varying)::text, ('reviewed'::character varying)::text, ('discarded'::character varying)::text])))
);


ALTER TABLE public.voice_recordings OWNER TO nagare;

--
-- Name: COLUMN voice_recordings.review_status; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_recordings.review_status IS 'Review workflow state: not_reviewed (no review needed), pending_review (in queue), reviewed (confirmed), discarded (rejected)';


--
-- Name: COLUMN voice_recordings.context_type; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_recordings.context_type IS 'Recording context: patient (specific patient selected) or global (no patient context)';


--
-- Name: COLUMN voice_recordings.context_patient_id; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_recordings.context_patient_id IS 'Patient ID captured at recording time for context tracking (may differ from patient_id if recording is later associated with different patient)';


--
-- Name: CONSTRAINT check_patient_id_context ON voice_recordings; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON CONSTRAINT check_patient_id_context ON public.voice_recordings IS 'Ensures patient_id is provided when context_type is patient, allows flexibility for global context';


--
-- Name: voice_review_queue; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.voice_review_queue (
    review_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recording_id uuid NOT NULL,
    user_id uuid NOT NULL,
    context_type character varying(20) NOT NULL,
    context_patient_id uuid,
    transcript text NOT NULL,
    transcript_language character varying(10) NOT NULL,
    extracted_data jsonb NOT NULL,
    confidence_score numeric(3,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp without time zone,
    processing_time_ms integer,
    model_version character varying(50),
    CONSTRAINT voice_review_queue_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT voice_review_queue_context_type_check CHECK (((context_type)::text = ANY (ARRAY[('patient'::character varying)::text, ('global'::character varying)::text]))),
    CONSTRAINT voice_review_queue_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('in_review'::character varying)::text, ('confirmed'::character varying)::text, ('discarded'::character varying)::text])))
);


ALTER TABLE public.voice_review_queue OWNER TO nagare;

--
-- Name: TABLE voice_review_queue; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON TABLE public.voice_review_queue IS 'Stores pending voice recording reviews awaiting user approval before database insertion';


--
-- Name: COLUMN voice_review_queue.context_type; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_review_queue.context_type IS 'Whether recording was made with patient context or globally';


--
-- Name: COLUMN voice_review_queue.extracted_data; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_review_queue.extracted_data IS 'JSONB containing categorized data extracted by AI (categories array with type, confidence, data, fieldConfidences)';


--
-- Name: COLUMN voice_review_queue.confidence_score; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_review_queue.confidence_score IS 'Overall AI confidence score (0.0-1.0)';


--
-- Name: COLUMN voice_review_queue.status; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.voice_review_queue.status IS 'Review workflow state: pending (awaiting review), in_review (user opened), confirmed (saved to DB), discarded (rejected)';


--
-- Name: weekly_schedule_items; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.weekly_schedule_items (
    schedule_item_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    care_plan_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    time_slot character varying(20) NOT NULL,
    specific_time time without time zone,
    service_data jsonb NOT NULL,
    linked_to_care_plan_item uuid,
    frequency character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT weekly_schedule_items_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.weekly_schedule_items OWNER TO nagare;

--
-- Name: medication_administrations chain_sequence; Type: DEFAULT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_administrations ALTER COLUMN chain_sequence SET DEFAULT nextval('public.medication_administrations_chain_sequence_seq'::regclass);


--
-- Data for Name: auth_audit_log; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.auth_audit_log (log_id, staff_id, username, event_type, ip_address, device_info, success, failure_reason, "timestamp") FROM stdin;
c324ace2-a364-4270-8163-bdccf906a3fd	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-13 03:26:39.673972
947a8524-38f2-4970-804f-66ff3101d608	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-13 03:26:56.009667
711395bf-0640-4bda-be75-436fd6fce3b4	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-13 04:31:56.873542
b5949aec-dd32-4b3b-bec0-7ae83416b205	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-13 04:53:39.420376
5eee397e-abdb-4fa8-b84c-cd34663e0563	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-13 04:55:15.787262
0443b915-ffcd-4607-91f2-2e7c0de5e0c7	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-13 05:01:14.430762
bab906b5-4e56-465d-966f-99ea9853254f	550e8400-e29b-41d4-a716-446655440105	demo	failed_login	::ffff:172.22.0.4	{"platform": "ios", "appVersion": "1.0.0"}	f	invalid_password	2025-12-15 01:17:47.163461
23c248fb-f9d3-4bb0-a38a-03afe98a9cb9	550e8400-e29b-41d4-a716-446655440105	demo	failed_login	::ffff:172.22.0.4	{"platform": "ios", "appVersion": "1.0.0"}	f	invalid_password	2025-12-15 01:17:55.324193
ac6bd384-12d5-4421-a6fb-8ed7be15b301	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-15 01:18:01.313637
02833c43-da6d-447a-bb9b-6cb84af2be81	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 01:32:32.138977
6d857fdb-5377-4a2a-a610-7d8f61a9b31f	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 01:38:27.777636
37cce064-5fbe-4bc6-b099-9be9eb254bd9	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 01:39:55.09666
103f7369-d3ae-493a-b265-943977de78c9	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 01:41:59.361375
9f9c7de0-c112-4c82-babd-481970911906	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 01:49:04.85076
f405f64c-31ab-4f4d-9cc2-e421f274bebf	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 01:51:32.645334
cf196d21-16e5-4965-9b1d-08c63285e376	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 01:59:04.410214
0ddcd81b-cf01-470e-a667-18e1a75391e6	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-15 04:22:02.412475
905747aa-a7bd-48dd-ba65-88d0c3503c50	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-15 04:39:21.969971
41f526fd-e00e-4c4d-9ef4-d361d67527f1	550e8400-e29b-41d4-a716-446655440105	\N	token_refresh	\N	\N	t	\N	2025-12-15 23:58:55.934516
b6033c71-4efc-41b6-8e41-1d7c0ad3047b	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-15 23:59:16.750753
2c5a2de5-4ae4-440a-b191-8cadc76998b4	550e8400-e29b-41d4-a716-446655440105	\N	token_refresh	\N	\N	t	\N	2025-12-16 10:16:40.878747
63c9d735-9063-4801-ab59-f36b6f1ec662	550e8400-e29b-41d4-a716-446655440105	\N	token_refresh	\N	\N	t	\N	2025-12-16 23:31:03.407832
b39afa25-f4b5-47fe-9ea1-b3d1fab6543e	550e8400-e29b-41d4-a716-446655440105	\N	token_refresh	\N	\N	t	\N	2025-12-17 07:26:04.345921
1fd0e2b9-4c47-4f71-8744-7886d14e1b6a	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.22.0.4	\N	t	\N	2025-12-19 09:26:42.84652
dc97d544-6d68-49b1-af68-62f39359fd22	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:192.168.65.1	\N	t	\N	2025-12-21 02:12:34.879743
e415f14a-6e2d-4482-890e-12a1c3d6a12f	550e8400-e29b-41d4-a716-446655440105	demo	failed_login	::ffff:172.20.0.4	\N	f	invalid_password	2025-12-23 06:14:01.947733
946a8553-d4cc-452d-8d10-03f2c38606ce	550e8400-e29b-41d4-a716-446655440105	demo	failed_login	::ffff:172.20.0.4	\N	f	invalid_password	2025-12-23 06:15:53.862756
626245cb-ada9-415b-a8ed-47e407af4ea6	550e8400-e29b-41d4-a716-446655440105	demo	failed_login	::ffff:172.20.0.4	\N	f	invalid_password	2025-12-23 07:03:08.265411
472be50e-0080-4683-b2e3-63da064115a2	550e8400-e29b-41d4-a716-446655440105	demo	failed_login	::ffff:172.20.0.4	\N	f	invalid_password	2025-12-23 07:18:07.895819
7af008ab-2679-4221-a713-b436f1a58020	550e8400-e29b-41d4-a716-446655440105	demo	failed_login	::ffff:172.20.0.4	\N	f	invalid_password	2025-12-23 07:41:06.033021
c9495f56-d07b-403d-b233-3b495b53f303	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.4	\N	t	\N	2025-12-23 07:47:36.859253
1d4e48b8-aa55-427e-b7d3-f3d6d004386f	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.4	\N	t	\N	2025-12-23 07:58:33.332773
c8242838-2068-4d99-8748-feae2de1f5c7	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.4	\N	t	\N	2025-12-23 09:06:34.609448
a635c1e9-8ede-445c-a66b-c78560f8192e	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.4	\N	t	\N	2025-12-23 09:06:54.138201
640c06fe-f184-4567-9430-35f73b4ee904	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 00:49:17.541467
3b31a85a-5680-466a-b240-4daf99c0d37b	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 00:53:11.984468
5ec9ba67-b411-4ed6-960c-d417425fa800	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 00:57:23.870673
a7fe1117-5ee0-4b2a-8ecf-bcf27e64cc5c	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 00:59:18.66278
68dc90d5-f2f4-450e-b547-02ad7a1280c9	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 01:03:49.084745
3607710f-09f3-4a33-8e28-2eeaad497af4	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 01:31:36.159033
cf8127d6-b9eb-4739-9f3f-4f877d5a0f38	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 01:34:31.27126
75741a7e-cc1a-47e4-9b5e-3b2ebbff0fa2	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-24 01:42:58.016614
23231b9c-81e3-415b-9306-863023569ab7	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-24 01:43:49.117547
f9a9c444-349c-4e78-8e96-cc46644d859b	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "test", "appVersion": "1.0.0"}	t	\N	2025-12-24 02:03:19.648752
ae2e1ae9-f1b6-4ff2-b833-b9cd23371822	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-24 03:46:54.781093
b22ca62f-6552-4618-8a7d-fc90157a3370	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	\N	t	\N	2025-12-24 03:46:58.432271
959439a7-e54d-4c3c-80b4-f4b207acb3f1	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-26 04:24:38.252264
09cf631a-8fdb-495a-b0c9-4aec213e7844	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-28 07:33:24.385641
fdb8fb6f-26fe-4445-8f90-43a45ba4e2ee	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-28 07:40:20.069211
0174937d-a8a3-4db1-b3b4-913ba376052b	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-28 07:48:21.140096
eed831a7-0a8b-4df9-ab39-0ffa93e868d9	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-28 07:58:22.333522
7784edb8-e01f-4102-814b-ed85c27479c9	550e8400-e29b-41d4-a716-446655440105	demo	login	::ffff:172.20.0.2	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-12-28 08:05:16.859357
\.


--
-- Data for Name: barthel_assessments; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.barthel_assessments (assessment_id, patient_id, assessed_at, total_score, category_scores, additional_notes, voice_recording_id, assessed_by, input_method, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: care_conferences; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.care_conferences (care_conference_id, care_plan_id, conference_date, conference_type, attendees, discussion, minutes, action_items, care_plan_approved, next_conference_date, created_at) FROM stdin;
\.


--
-- Data for Name: care_plan_audit_log; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.care_plan_audit_log (audit_log_id, care_plan_id, "timestamp", user_id, user_name, action, changes, version) FROM stdin;
\.


--
-- Data for Name: care_plan_items; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.care_plan_items (care_plan_item_id, care_plan_id, problem_category, problem_description, problem_priority, identified_date, problem_status, long_term_goal_description, long_term_goal_target_date, long_term_goal_duration, long_term_goal_achievement_status, short_term_goal_description, short_term_goal_target_date, short_term_goal_duration, short_term_goal_achievement_status, short_term_goal_measurable_criteria, interventions, linked_assessments, last_updated, updated_by, created_at) FROM stdin;
\.


--
-- Data for Name: care_plan_progress_notes; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.care_plan_progress_notes (progress_note_id, care_plan_item_id, note_date, note, author_id, author_name, created_at) FROM stdin;
\.


--
-- Data for Name: care_plans; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.care_plans (care_plan_id, patient_id, care_level, status, version, created_date, last_review_date, next_review_date, created_by, patient_intent, family_intent, comprehensive_policy, care_manager_id, team_members, family_signature, last_monitoring_date, next_monitoring_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: clinical_notes; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.clinical_notes (note_id, patient_id, note_type, note_category, note_datetime, note_text, voice_recording_id, voice_transcribed, authored_by, author_role, author_name, follow_up_required, follow_up_date, follow_up_notes, related_assessment_id, related_session_id, status, requires_approval, approved_by, approved_by_name, approval_datetime, approval_notes, created_at, updated_at, deleted_at, deleted_by) FROM stdin;
\.


--
-- Data for Name: facilities; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.facilities (facility_id, facility_name, facility_name_ja, facility_name_zh, timezone, language, created_at) FROM stdin;
550e8400-e29b-41d4-a716-446655440001	Nagoya General Hospital	名古屋総合病院	名古屋綜合醫院	Asia/Tokyo	ja	2025-12-13 03:20:13.479679
\.


--
-- Data for Name: medication_administrations; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.medication_administrations (administration_id, order_id, patient_id, scheduled_datetime, administered_datetime, patient_barcode_scanned, patient_barcode_value, medication_barcode_scanned, medication_barcode_value, dose_given, route_given, status, reason_if_not_given, administered_by, notes, record_hash, previous_hash, chain_sequence, created_at) FROM stdin;
\.


--
-- Data for Name: medication_orders; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, end_datetime, prn, prn_reason, status, ordered_by, created_at) FROM stdin;
02653e28-3430-4145-803c-a7c35f60f42e	550e8400-e29b-41d4-a716-446655440201	ORD001-01	アスピリン	Aspirin	阿司匹林	1140001	100	mg	oral	BID	08:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.48795
c8726d8e-c284-4348-a74c-c0d9211c0328	550e8400-e29b-41d4-a716-446655440201	ORD001-02	アスピリン	Aspirin	阿司匹林	1140001	100	mg	oral	BID	20:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.48795
8a02c71b-a35e-4469-a48a-5dd0b77afb08	550e8400-e29b-41d4-a716-446655440201	ORD001-03	メトホルミン	Metformin	二甲雙胍	3961007	500	mg	oral	TID	08:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.48795
c465c20b-60b1-4f81-9dde-ae7015a1d34a	550e8400-e29b-41d4-a716-446655440201	ORD001-04	メトホルミン	Metformin	二甲雙胍	3961007	500	mg	oral	TID	12:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.48795
355c27aa-6c7e-4543-936b-8c74ffcb28d8	550e8400-e29b-41d4-a716-446655440201	ORD001-05	メトホルミン	Metformin	二甲雙胍	3961007	500	mg	oral	TID	18:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.48795
c1fa630d-9c28-413d-9da1-51ebd218bc92	550e8400-e29b-41d4-a716-446655440201	ORD001-06	アムロジピン	Amlodipine	氨氯地平	2171022	5	mg	oral	QD	09:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.48795
5f2303c5-a574-499e-8779-caa26f8b810a	550e8400-e29b-41d4-a716-446655440202	ORD002-01	アセトアミノフェン	Acetaminophen	對乙酰氨基酚	1141007	500	mg	oral	PRN	\N	2024-01-12 00:00:00	\N	t	疼痛時	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.492158
cd58e796-e7b2-4313-98ea-0a826499d4b5	550e8400-e29b-41d4-a716-446655440202	ORD002-02	オメプラゾール	Omeprazole	奧美拉唑	2329023	20	mg	oral	QD	08:00:00	2024-01-12 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.492158
732c90f6-e747-4c5e-9580-0ef2f4e219d2	550e8400-e29b-41d4-a716-446655440202	ORD002-03	レボフロキサシン	Levofloxacin	左氧氟沙星	6241013	500	mg	oral	QD	12:00:00	2024-01-12 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.492158
80b3a577-d0b0-44d1-8a20-07a56f19ad6d	550e8400-e29b-41d4-a716-446655440203	ORD003-01	ワーファリン	Warfarin	華法林	3332001	2	mg	oral	QD	18:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.493272
7975773e-247d-420b-b439-cd8019698b12	550e8400-e29b-41d4-a716-446655440203	ORD003-02	フロセミド	Furosemide	呋塞米	2139005	40	mg	oral	BID	08:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.493272
9bba3012-eade-4c8b-a35f-e576a33d4bd5	550e8400-e29b-41d4-a716-446655440203	ORD003-03	フロセミド	Furosemide	呋塞米	2139005	40	mg	oral	BID	14:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.493272
36079b07-3bf2-4550-8388-b1fc56632686	550e8400-e29b-41d4-a716-446655440203	ORD003-04	リシノプリル	Lisinopril	賴諾普利	2144009	10	mg	oral	QD	09:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.493272
3ec08b3c-4439-40d7-8cde-1134f30fe978	550e8400-e29b-41d4-a716-446655440204	ORD004-01	セファゾリン	Cefazolin	頭孢唑林	6132400	1	g	iv	Q8H	06:00:00	2024-01-14 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.494377
df8bab21-c3ff-4926-bde3-0aaf5521315e	550e8400-e29b-41d4-a716-446655440204	ORD004-02	セファゾリン	Cefazolin	頭孢唑林	6132400	1	g	iv	Q8H	14:00:00	2024-01-14 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.494377
611e8f65-8722-4389-82fb-f63c474682ce	550e8400-e29b-41d4-a716-446655440204	ORD004-03	セファゾリン	Cefazolin	頭孢唑林	6132400	1	g	iv	Q8H	22:00:00	2024-01-14 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.494377
000044b3-c2de-4674-a18f-15f574e41681	550e8400-e29b-41d4-a716-446655440204	ORD004-04	モルヒネ	Morphine	嗎啡	8114006	2	mg	iv	PRN	\N	2024-01-14 00:00:00	\N	t	疼痛時（4時間毎まで）	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.494377
f13aafd5-d1ce-4210-b840-7dacba476d0a	550e8400-e29b-41d4-a716-446655440205	ORD005-01	ドネペジル	Donepezil	多奈哌齊	1190012	5	mg	oral	QHS	21:00:00	2024-01-09 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.495465
c0224ddd-d577-48b9-919e-c606321b2d0e	550e8400-e29b-41d4-a716-446655440205	ORD005-02	リスペリドン	Risperidone	利培酮	1179038	0.5	mg	oral	BID	08:00:00	2024-01-09 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.495465
7cec920d-2d11-4b3b-9e78-e96f84c7665d	550e8400-e29b-41d4-a716-446655440205	ORD005-03	リスペリドン	Risperidone	利培酮	1179038	0.5	mg	oral	BID	20:00:00	2024-01-09 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-12-13 03:20:13.495465
\.


--
-- Data for Name: monitoring_records; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.monitoring_records (monitoring_record_id, care_plan_id, monitoring_date, monitoring_type, conducted_by, conducted_by_name, item_reviews, overall_status, patient_feedback, family_feedback, staff_observations, proposed_changes, next_monitoring_date, action_items, created_at) FROM stdin;
\.


--
-- Data for Name: nursing_assessments; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.nursing_assessments (assessment_id, patient_id, assessment_datetime, assessment_type, input_method, voice_recording_id, structured_data, narrative_notes, ai_processed, ai_confidence_score, assessed_by, created_at) FROM stdin;
\.


--
-- Data for Name: patient_incidents; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.patient_incidents (incident_id, patient_id, incident_type, severity, occurred_at, description, voice_recording_id, photo_paths, reported_by, reported_at, reviewed, reviewed_by, reviewed_at, follow_up_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: patient_session_data; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.patient_session_data (session_id, patient_id, staff_id, session_started_at, session_device_id, session_status, vitals, barthel_index, medications, patient_updates, incidents, last_updated_at, submitted_at, created_at) FROM stdin;
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.patients (patient_id, facility_id, mrn, family_name, given_name, family_name_kana, given_name_kana, family_name_en, given_name_en, date_of_birth, gender, room, bed, blood_type, admission_date, height_cm, weight_kg, allergies, medications_summary, key_notes, risk_factors, status, created_at) FROM stdin;
550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440001	MRN001	山田	太郎	ヤマダ	タロウ	Yamada	Taro	1955-03-15	male	305	A	A+	2024-01-10	165.50	68.20	{ペニシリン系抗生物質,Penicillin}	アムロジピン5mg 1日1回、メトホルミン500mg 1日2回	糖尿病・高血圧の既往あり。食事制限中。	{転倒リスク,糖尿病,高血圧}	yellow	2025-12-13 03:20:13.484763
550e8400-e29b-41d4-a716-446655440202	550e8400-e29b-41d4-a716-446655440001	MRN002	田中	優希	タナカ	ユウキ	Tanaka	Yuki	1978-07-22	female	307	B	B+	2024-01-12	158.00	52.50	{なし,None}	術後鎮痛剤、抗生物質	術後ケア中。創部の観察が必要。	{術後感染リスク}	green	2025-12-13 03:20:13.484763
550e8400-e29b-41d4-a716-446655440203	550e8400-e29b-41d4-a716-446655440001	MRN003	佐藤	健二	サトウ	ケンジ	Sato	Kenji	1951-11-08	male	309	C	O+	2024-01-08	172.00	75.80	{造影剤,"Contrast dye"}	ワーファリン2mg 1日1回、アスピリン100mg 1日1回	心臓疾患あり。抗凝固薬服用中。出血リスクに注意。	{出血リスク,心疾患}	yellow	2025-12-13 03:20:13.484763
550e8400-e29b-41d4-a716-446655440204	550e8400-e29b-41d4-a716-446655440001	MRN004	鈴木	愛子	スズキ	アイコ	Suzuki	Aiko	1968-05-30	female	311	A	AB+	2024-01-14	155.00	48.00	{卵,Eggs}	セフェム系抗生物質、解熱鎮痛剤	抗生物質治療中。アレルギー歴に注意。	{薬剤アレルギー}	green	2025-12-13 03:20:13.484763
550e8400-e29b-41d4-a716-446655440205	550e8400-e29b-41d4-a716-446655440001	MRN005	渡辺	博	ワタナベ	ヒロシ	Watanabe	Hiroshi	1943-12-25	male	315	B	A-	2024-01-09	168.00	58.50	{なし,None}	認知症治療薬（ドネペジル）、血圧降下剤	認知症あり。見当識障害のため見守り必要。徘徊リスクあり。	{認知症,徘徊リスク,転倒リスク}	red	2025-12-13 03:20:13.484763
\.


--
-- Data for Name: problem_templates; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.problem_templates (template_id, category, japanese_text, english_text, chinese_text, suggested_long_term_goals, suggested_short_term_goals, suggested_interventions, created_at) FROM stdin;
107ae440-6cd7-4d50-9457-0ee705f00138	ADL	トイレ動作の自立困難	Difficulty with independent toileting	如廁動作自理困難	{"en": ["Able to perform toileting with supervision only during daytime", "Complete toileting without falling"], "ja": ["日中、見守りのみでトイレ動作ができる", "転倒せずにトイレ動作を完了できる"], "zh": ["白天僅需監督即可完成如廁動作", "完成如廁動作而不跌倒"]}	{"en": ["Able to walk to toilet using handrails", "Safely transfer from sitting to standing"], "ja": ["手すりを使用してトイレまで歩行できる", "座位から立位への移乗が安全にできる"], "zh": ["能使用扶手步行至廁所", "能安全地從坐姿轉為站姿"]}	{"en": [{"type": "observation", "description": "Observe toileting behavior and fall risk each time"}, {"type": "care", "description": "Walker usage training, handrail utilization support"}, {"type": "education", "description": "Safe toileting technique education"}], "ja": [{"type": "observation", "description": "トイレ動作時の様子、転倒リスクを毎回観察"}, {"type": "care", "description": "歩行器使用指導、手すり活用支援"}, {"type": "education", "description": "安全なトイレ動作の指導"}], "zh": [{"type": "observation", "description": "每次觀察如廁行為及跌倒風險"}, {"type": "care", "description": "助行器使用指導、扶手運用協助"}, {"type": "education", "description": "安全如廁技巧衛教"}]}	2025-12-13 03:20:13.504452
123a740c-aba8-4d7f-a593-e9d7b62e9a33	fall_prevention	転倒リスクが高い	High risk of falling	跌倒風險高	{"en": ["Maintain zero fall incidents for 6 months", "Master safe mobility methods"], "ja": ["6ヶ月間転倒事故ゼロを維持する", "安全な移動方法を習得する"], "zh": ["維持6個月零跌倒事故", "掌握安全移動方法"]}	{"en": ["Able to use walker correctly", "Safely get up from bed"], "ja": ["歩行器を正しく使用できる", "ベッドからの起き上がりが安全にできる"], "zh": ["能正確使用助行器", "能安全地從床上起身"]}	{"en": [{"type": "observation", "description": "Continuous observation of unsteadiness, balance, and gait"}, {"type": "care", "description": "Environmental modifications (remove steps, install handrails)"}, {"type": "education", "description": "Fall prevention lifestyle education"}], "ja": [{"type": "observation", "description": "ふらつき、バランス、歩行状態の継続観察"}, {"type": "care", "description": "環境整備（段差解消、手すり設置）"}, {"type": "education", "description": "転倒予防のための生活指導"}], "zh": [{"type": "observation", "description": "持續觀察不穩、平衡和步態"}, {"type": "care", "description": "環境改善（消除高低差、設置扶手）"}, {"type": "education", "description": "跌倒預防生活指導"}]}	2025-12-13 03:20:13.504452
ac2117ac-2fa3-4411-a2f8-8e1955036a95	nutrition	食事摂取量の低下	Decreased food intake	進食量減少	{"en": ["Maintain appropriate weight (BMI 18.5-25)", "Achieve 80%+ of required nutritional intake"], "ja": ["適正体重を維持する（BMI 18.5-25）", "必要栄養量の80%以上を摂取できる"], "zh": ["維持適當體重（BMI 18.5-25）", "達到所需營養攝取量的80%以上"]}	{"en": ["Achieve 50%+ intake for 3 meals daily", "Find preferred food textures"], "ja": ["1日3食、50%以上の摂取ができる", "好みの食事形態を見つける"], "zh": ["每日三餐達到50%以上攝取", "找到喜好的食物質地"]}	{"en": [{"type": "observation", "description": "Record food intake and weight changes"}, {"type": "care", "description": "Modify food textures, provide snacks"}, {"type": "education", "description": "Education on importance of nutrition"}], "ja": [{"type": "observation", "description": "食事摂取量、体重変化の記録"}, {"type": "care", "description": "食事形態の工夫、間食の提供"}, {"type": "education", "description": "栄養の重要性について指導"}], "zh": [{"type": "observation", "description": "記錄進食量和體重變化"}, {"type": "care", "description": "調整食物質地、提供點心"}, {"type": "education", "description": "營養重要性衛教"}]}	2025-12-13 03:20:13.504452
dd23b757-0fcb-4cc4-8703-fcdf0d852d7d	pain_management	慢性的な腰痛がある	Chronic low back pain	慢性下背痛	{"en": ["Reduce pain to level that does not interfere with daily living", "Able to self-manage pain"], "ja": ["痛みが日常生活に支障をきたさないレベルまで軽減する", "痛みのセルフマネジメントができる"], "zh": ["將疼痛減輕至不影響日常生活的程度", "能自我管理疼痛"]}	{"en": ["Resting pain reduces to NRS 3 or below", "Implement 3+ pain relief strategies"], "ja": ["安静時の痛みがNRS 3以下になる", "痛み軽減のための工夫を3つ以上実践できる"], "zh": ["靜止時疼痛降至NRS 3以下", "實踐3種以上疼痛緩解策略"]}	{"en": [{"type": "observation", "description": "Daily assessment of pain intensity, location, and quality"}, {"type": "care", "description": "Position changes, heat therapy, massage"}, {"type": "education", "description": "Positioning education for pain relief"}], "ja": [{"type": "observation", "description": "痛みの程度、部位、性質の評価（毎日）"}, {"type": "care", "description": "体位変換、温罨法、マッサージの実施"}, {"type": "education", "description": "痛み軽減のためのポジショニング指導"}], "zh": [{"type": "observation", "description": "每日評估疼痛程度、部位和性質"}, {"type": "care", "description": "變換姿勢、熱敷、按摩"}, {"type": "education", "description": "疼痛緩解姿勢衛教"}]}	2025-12-13 03:20:13.504452
95a7a4da-0264-44f6-ab0e-87d506331cbd	cognition	認知機能の低下（見当識障害）	Cognitive decline (disorientation)	認知功能下降（定向力障礙）	{"en": ["Maintain time and date orientation", "Live peacefully in facility"], "ja": ["日時の見当識を維持する", "穏やかに施設生活を送ることができる"], "zh": ["維持時間和日期定向力", "能平和地在機構生活"]}	{"en": ["Recognize day of week and time of day", "Remember staff faces and names"], "ja": ["曜日と時間帯がわかる", "職員の顔と名前を覚える"], "zh": ["能辨識星期和時段", "記住工作人員的臉和姓名"]}	{"en": [{"type": "observation", "description": "Regular assessment of orientation, memory, and judgment"}, {"type": "care", "description": "Orientation support (calendar and clock use)"}, {"type": "education", "description": "Dementia care education for family"}], "ja": [{"type": "observation", "description": "見当識、記憶力、判断力の定期評価"}, {"type": "care", "description": "オリエンテーション支援（カレンダー、時計の活用）"}, {"type": "education", "description": "家族への認知症ケアの指導"}], "zh": [{"type": "observation", "description": "定期評估定向力、記憶力和判斷力"}, {"type": "care", "description": "定向力支援（利用日曆和時鐘）"}, {"type": "education", "description": "失智症照護家屬衛教"}]}	2025-12-13 03:20:13.504452
594be457-e9e8-48d9-896b-2aecd227ef58	psychosocial	社会的孤立・活動量の低下	Social isolation and decreased activity	社交孤立與活動量減少	{"en": ["Make close friends within facility", "Find enjoyment and stay active"], "ja": ["施設内で親しい仲間を作る", "楽しみを見つけ、活動的に過ごす"], "zh": ["在機構內建立親密友誼", "找到樂趣並保持活躍"]}	{"en": ["Participate in recreation 3+ times per week", "Enjoy conversations with other residents"], "ja": ["レクリエーションに週3回以上参加する", "他の利用者と会話を楽しむ"], "zh": ["每週參加3次以上康樂活動", "享受與其他住民的交談"]}	{"en": [{"type": "observation", "description": "Observe facial expressions, activity participation, social interactions"}, {"type": "care", "description": "Encourage recreation participation, provide hobby activities"}, {"type": "education", "description": "Explain importance of social participation"}], "ja": [{"type": "observation", "description": "表情、活動参加状況、他者との交流の観察"}, {"type": "care", "description": "レクリエーション参加の声かけ、趣味活動の提供"}, {"type": "education", "description": "社会参加の重要性について説明"}], "zh": [{"type": "observation", "description": "觀察表情、活動參與、與他人互動"}, {"type": "care", "description": "鼓勵參與康樂活動、提供嗜好活動"}, {"type": "education", "description": "說明社交參與的重要性"}]}	2025-12-13 03:20:13.504452
\.


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.staff (staff_id, facility_id, employee_number, family_name, given_name, family_name_kana, given_name_kana, role, username, password_hash, created_at, family_name_en, given_name_en) FROM stdin;
550e8400-e29b-41d4-a716-446655440101	550e8400-e29b-41d4-a716-446655440001	N001	佐藤	美咲	サトウ	ミサキ	registered_nurse	nurse1	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-12-13 03:20:13.481934	Sato	Misaki
550e8400-e29b-41d4-a716-446655440102	550e8400-e29b-41d4-a716-446655440001	N002	鈴木	花子	スズキ	ハナコ	registered_nurse	nurse2	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-12-13 03:20:13.481934	Suzuki	Hanako
550e8400-e29b-41d4-a716-446655440103	550e8400-e29b-41d4-a716-446655440001	D001	田中	健一	タナカ	ケンイチ	physician	doctor1	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-12-13 03:20:13.481934	Tanaka	Kenichi
550e8400-e29b-41d4-a716-446655440104	550e8400-e29b-41d4-a716-446655440001	CM001	田中	博	タナカ	ヒロシ	registered_nurse	manager1	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-12-13 03:22:44.295758	Tanaka	Hiroshi
550e8400-e29b-41d4-a716-446655440105	550e8400-e29b-41d4-a716-446655440001	DEMO001	デモ	職員	デモ	ショクイン	registered_nurse	demo	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-12-13 03:22:44.297339	Demo	Staff
\.


--
-- Data for Name: staff_sessions; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.staff_sessions (session_id, staff_id, access_token, refresh_token, device_info, ip_address, expires_at, created_at, last_activity) FROM stdin;
a23698ed-0617-4e79-a5de-d1170cf0d566	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTU5NjM5OSwiZXhwIjoxNzY1NjI1MTk5fQ.iSXGBeSo68n5T_G4ubmaA3wqEg43tYSuIPX87UtbIpE	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU1OTYzOTksImV4cCI6MTc2NjIwMTE5OX0.ey8wIlXjsVtX1OTZdX8km5updB0PXJctvPc4K-AIVxg	\N	::ffff:172.22.0.4	2025-12-13 11:26:39.669	2025-12-13 03:26:39.669542	2025-12-13 03:26:39.669542
b2c8247c-907e-4d32-b01b-13c07f3914cd	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTU5NjQxNiwiZXhwIjoxNzY1NjI1MjE2fQ.PNS25HDt4OnjN0ymjJoZlWZ5CaFm7cvsx8YnI9gwJNE	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU1OTY0MTYsImV4cCI6MTc2NjIwMTIxNn0.2DmCABjytRpMSDNoqvIqHKGKKuNIy_o7XAjz5aX8EII	\N	::ffff:172.22.0.4	2025-12-13 11:26:56.007	2025-12-13 03:26:56.007962	2025-12-13 03:26:56.007962
a284f1c2-f867-489d-9972-049315d62992	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTYwMDMxNiwiZXhwIjoxNzY1NjI5MTE2fQ.DoZiBaKeGe28eG3vlFqhDOCVZxn9aMy0lSsWtxkyJts	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU2MDAzMTYsImV4cCI6MTc2NjIwNTExNn0.M4ki9Ol19A83KXFlSt19_aNTvYFv5HdzddNkY9KTmSc	\N	::ffff:172.22.0.4	2025-12-13 12:31:56.87	2025-12-13 04:31:56.870331	2025-12-13 04:31:56.870331
ae4f0eeb-aca2-4061-a5c7-6ae8a0959395	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTYwMTYxOSwiZXhwIjoxNzY1NjMwNDE5fQ.dXEebIeYzgGgDJjd1pOQVTQPMJmwTl365wCqajuxS-E	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU2MDE2MTksImV4cCI6MTc2NjIwNjQxOX0.2ucz3svGXECh4ARKi-Ux6TCKfdpiWVkvSH9TI8bL59A	\N	::ffff:172.22.0.4	2025-12-13 12:53:39.416	2025-12-13 04:53:39.417047	2025-12-13 04:53:39.417047
53d50043-1746-4cba-86cd-8f0e4f7a3d7d	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTYwMTcxNSwiZXhwIjoxNzY1NjMwNTE1fQ.o3uM2c3uBe3K2Rmo5iXeieKU5i2MaMiFPNoat23BcIE	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU2MDE3MTUsImV4cCI6MTc2NjIwNjUxNX0.SOoXQyfR2oKpsMVeImbkwGXYUsgqYTZtxFtmD6DVcJs	\N	::ffff:172.22.0.4	2025-12-13 12:55:15.783	2025-12-13 04:55:15.784239	2025-12-13 04:55:15.784239
97be108f-83a8-4235-a34d-10a70d64e45a	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTYwMjA3NCwiZXhwIjoxNzY1NjMwODc0fQ.gHcfzLzf22rVIsrCliryBzJ6pEq0BHUOM0hCWLW7GmY	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU2MDIwNzQsImV4cCI6MTc2NjIwNjg3NH0.uy2jgUHAMl0sIozzKPq8CLxnXtEUczl3EGUr7iNcARI	\N	::ffff:172.22.0.4	2025-12-13 13:01:14.426	2025-12-13 05:01:14.426659	2025-12-13 05:01:14.426659
5c33c537-c472-47b2-b030-cd622a7ce91a	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2MTQ4MSwiZXhwIjoxNzY1NzkwMjgxfQ.gkzBbUrbSH7VmVfshD3sQcnYmJINp86aAJzXJbjnEas	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjE0ODEsImV4cCI6MTc2NjM2NjI4MX0.8Ub_KZrk2_WlheAsAW29nUuK-LehQxcRelGaxJAe1GM	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.22.0.4	2025-12-15 09:18:01.31	2025-12-15 01:18:01.310767	2025-12-15 01:18:01.310767
3e3ca590-9e7a-4962-8090-9a387f12233b	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2MjM1MiwiZXhwIjoxNzY1NzkxMTUyfQ.LoIOo7TU689PzzAj0lHuhplrv4q0w1B0eSX97GXWMSk	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjIzNTIsImV4cCI6MTc2NjM2NzE1Mn0.8aNMMLuU1T_v9yPj8bHUSf7jVHMjcwDL7kUiKmUEF1s	\N	::ffff:172.22.0.4	2025-12-15 09:32:32.135	2025-12-15 01:32:32.135847	2025-12-15 01:32:32.135847
a257782f-d5a4-402b-bb1c-5e309572fc45	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2MjcwNywiZXhwIjoxNzY1NzkxNTA3fQ.Ey72r2viqp9qhnvd5tz6k6rSQMyA5bIyIt23R615BkU	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjI3MDcsImV4cCI6MTc2NjM2NzUwN30.f173p5k4b0y59tzwk2X1neIc0gwnL_lJNzdejTW1BUk	\N	::ffff:172.22.0.4	2025-12-15 09:38:27.774	2025-12-15 01:38:27.774782	2025-12-15 01:38:27.774782
8a23ed1f-318f-4fcc-8cb8-9dc33d68497e	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2Mjc5NSwiZXhwIjoxNzY1NzkxNTk1fQ.tpHZsWicIls9SYjlaNDdF_Bq7YmdBc9MSlNQi1Dg1WU	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjI3OTUsImV4cCI6MTc2NjM2NzU5NX0.XDaCs026Fa3L46iagRIVZa7j-5hFhitacVtVWgPvBT0	\N	::ffff:172.22.0.4	2025-12-15 09:39:55.093	2025-12-15 01:39:55.093738	2025-12-15 01:39:55.093738
eb307f56-0bb1-4f97-8891-0d37608f57a0	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2MjkxOSwiZXhwIjoxNzY1NzkxNzE5fQ.Fuzpk79fnssfURjiJ44jnla_jqLQubhPs7zY2tmXxLY	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjI5MTksImV4cCI6MTc2NjM2NzcxOX0.mfTCFHef8qwaG8w_1RvY-DV6XxLDV8_QmL_m3Jl3dBs	\N	::ffff:172.22.0.4	2025-12-15 09:41:59.357	2025-12-15 01:41:59.35799	2025-12-15 01:41:59.35799
5e6f682c-70a5-4821-8440-afba10e19aa1	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2MzM0NCwiZXhwIjoxNzY1NzkyMTQ0fQ.nV_g7BRy7JfsNrH5kcTdmQ8NOXI0NBjM0yuylCm6Cpk	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjMzNDQsImV4cCI6MTc2NjM2ODE0NH0.5QnyCKTvkFkUmMjkeJ_L5DuUpTlaAIfXfJQyP9Vej_0	\N	::ffff:172.22.0.4	2025-12-15 09:49:04.847	2025-12-15 01:49:04.847707	2025-12-15 01:49:04.847707
f2d0e70b-cbaf-4db0-ad56-28f28240d531	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2MzQ5MiwiZXhwIjoxNzY1NzkyMjkyfQ.724sGVeWTkXMlXq66vYXp5mLyGX_R-_6KeFn-fJMUWM	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjM0OTIsImV4cCI6MTc2NjM2ODI5Mn0.Ii2y8DN9FWl17DLiDMAErvJoNbMlgisWZaODmXL_S0Q	\N	::ffff:172.22.0.4	2025-12-15 09:51:32.641	2025-12-15 01:51:32.64168	2025-12-15 01:51:32.64168
ead3b049-8c8e-447c-97ef-6db11898e27b	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc2Mzk0NCwiZXhwIjoxNzY1NzkyNzQ0fQ._w6qJ0KrXYnoJp9k2cNXKNMqHRDcX1DWbd7D6VvwSy8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NjM5NDQsImV4cCI6MTc2NjM2ODc0NH0.pr2u4mrfiSFL-u2yiEQzQiqExV4VGdPx79eatLJIjDY	\N	::ffff:172.22.0.4	2025-12-15 09:59:04.406	2025-12-15 01:59:04.406983	2025-12-15 01:59:04.406983
3491119a-08ce-4ca0-93ee-1c37a59316a7	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTc3MjUyMiwiZXhwIjoxNzY1ODAxMzIyfQ.V-bJPDIYvtdIFQMzSEJlAIHCPiokB8yMLl9iTh5pIr8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NzI1MjIsImV4cCI6MTc2NjM3NzMyMn0.7c2HlTSZcKhfGLO6_ueRnfQgQzQ61h3RvmKdwC208gk	\N	::ffff:172.22.0.4	2025-12-15 12:22:02.408	2025-12-15 04:22:02.409162	2025-12-15 04:22:02.409162
9091541e-dc3b-4259-a750-f2328e8019dc	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTg0MzEzNSwiZXhwIjoxNzY1ODcxOTM1fQ.jXUjuO3JcmCsuFPHdebvys_f79OCbGLbkaO5JUCxjdQ	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU3NzM1NjEsImV4cCI6MTc2NjM3ODM2MX0.iVmTgAAg_AKOVKQ2EVfP3V9uiR_T7BTi2h3CMZz3qoc	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.22.0.4	2025-12-16 07:58:55.932	2025-12-15 04:39:21.965693	2025-12-15 23:58:55.933011
adec74a0-aa0a-4d4e-8e4e-ebc88863db17	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NTk1NjM2NCwiZXhwIjoxNzY1OTg1MTY0fQ.BYPQcsGfym8al71MbBAqxWPcm3h8tEZ1Ss_tgOxErXc	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjU4NDMxNTYsImV4cCI6MTc2NjQ0Nzk1Nn0.vtbqThTg2iXygCrQovd4_1PN5cZ-CGTitGvbM3e5Npw	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.22.0.4	2025-12-17 15:26:04.343	2025-12-15 23:59:16.748822	2025-12-17 07:26:04.344054
cda7cd6f-a486-46ca-b431-275634db6042	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjEzNjQwMiwiZXhwIjoxNzY2MTY1MjAyfQ.k63sM88gib7zS94fpcvt_KnhB3Ilshu2fLdP--N4zFs	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjYxMzY0MDIsImV4cCI6MTc2Njc0MTIwMn0.k5mg5Q3OFrtGxyimtwnXNnDsTuQzIWkFhiexRyqDotA	\N	::ffff:172.22.0.4	2025-12-19 17:26:42.84	2025-12-19 09:26:42.840745	2025-12-19 09:26:42.840745
0fb4a785-96f5-4b78-b054-e2f3963cc199	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjI4MzE1NCwiZXhwIjoxNzY2MzExOTU0fQ.qUxwH4EmhT_uKgLiXMnTqxT6t0h-XpzVu5-8eU3bxfc	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjYyODMxNTQsImV4cCI6MTc2Njg4Nzk1NH0.g18v2fvoZ4tDZNKmq1Nfd4JuCuVEnL9HY1xpHvJNATQ	\N	::ffff:192.168.65.1	2025-12-21 10:12:34.878	2025-12-21 02:12:34.878268	2025-12-21 02:12:34.878268
d40ce7fc-4792-42b6-a631-80dbadc1d3b9	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjQ3NjA1NiwiZXhwIjoxNzY2NTA0ODU2fQ.4KGjStQmTzT1AGxkQ3NoPp6JDa-RLETH12K_qQpHtzE	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY0NzYwNTYsImV4cCI6MTc2NzA4MDg1Nn0.EzswkeeV4tmguOKzbWMs8X_ok1XmGSCzWZ6DwD7DXyU	\N	::ffff:172.20.0.4	2025-12-23 15:47:36.857	2025-12-23 07:47:36.857706	2025-12-23 07:47:36.857706
f002a5ad-9c96-4cd7-b26f-ec397cb154b5	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjQ3NjcxMywiZXhwIjoxNzY2NTA1NTEzfQ.REl4NjtXe45U44Od0dufLEQlXtaY_KwOnK_NFtzw_ac	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY0NzY3MTMsImV4cCI6MTc2NzA4MTUxM30.YXtECowG3Q5cFWY9evgOQzXClHgG3NqO2Hyehy4UumM	\N	::ffff:172.20.0.4	2025-12-23 15:58:33.33	2025-12-23 07:58:33.330908	2025-12-23 07:58:33.330908
e66c12dc-10ad-4c8c-b423-98c931d8e347	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjQ4MDc5NCwiZXhwIjoxNzY2NTA5NTk0fQ.7nfpeIvPChc_M2pQTY5b9wkfydjKd20cdxDAd6QVPsM	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY0ODA3OTQsImV4cCI6MTc2NzA4NTU5NH0.0Yxl_3NxJ-5MMKNCvr1ZvgqtPoPQrR0UV1E_RS39uBs	\N	::ffff:172.20.0.4	2025-12-23 17:06:34.607	2025-12-23 09:06:34.608147	2025-12-23 09:06:34.608147
1900e69b-b493-4d7a-bafc-3017c6be0d00	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjQ4MDgxNCwiZXhwIjoxNzY2NTA5NjE0fQ.b7NrfZKaUPo0HblAcbNdf63xWfFXBI4dctgrCcK6OZ8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY0ODA4MTQsImV4cCI6MTc2NzA4NTYxNH0.7qJPUqhS8bw5dXSjgFd107utvKh6wU6Dk9zTk7q7EPA	\N	::ffff:172.20.0.4	2025-12-23 17:06:54.137	2025-12-23 09:06:54.137149	2025-12-23 09:06:54.137149
fa40fa31-f3db-401b-ab89-e8794310ee22	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjUzNzM1NywiZXhwIjoxNzY2NTY2MTU3fQ.EgjbmYwcvWYzqKm-l8ReRN8H7pdeZg4vecfvwVssry4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1MzczNTcsImV4cCI6MTc2NzE0MjE1N30.L6kdfcoph6wc1CcxMTTWuja8qAHAPUiRa-exkLGbDSo	\N	::ffff:172.20.0.2	2025-12-24 08:49:17.535	2025-12-24 00:49:17.535626	2025-12-24 00:49:17.535626
8774debe-5e60-4252-a321-8616db9c266a	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjUzNzU5MSwiZXhwIjoxNzY2NTY2MzkxfQ.rCm9ME0FJQnN6lb3d4ZyDqMMY0UctVNYzaUEhKJ_6N4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1Mzc1OTEsImV4cCI6MTc2NzE0MjM5MX0.Ro_vX02zzznNh3RTexgySe7zMkEJYR7Uz-G47zOf2-M	\N	::ffff:172.20.0.2	2025-12-24 08:53:11.982	2025-12-24 00:53:11.982354	2025-12-24 00:53:11.982354
1d2b26a0-c8d5-4693-bbaf-d8ab49c138fc	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjUzNzg0MywiZXhwIjoxNzY2NTY2NjQzfQ.dAcN5tX3PgB4xmgBuWHVrMx5je3MomE9J4IlgHB968w	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1Mzc4NDMsImV4cCI6MTc2NzE0MjY0M30.w9OFrlNa6_MqLasVe7pLT11-aDMXOvNf9lHCl63d-UA	\N	::ffff:172.20.0.2	2025-12-24 08:57:23.868	2025-12-24 00:57:23.868836	2025-12-24 00:57:23.868836
bf72160c-46af-4dd3-8e60-c0d393a4261e	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjUzNzk1OCwiZXhwIjoxNzY2NTY2NzU4fQ.FfU3toj5NGxjGQOnhpVfvbBby0W7n3DYNPSjV9R_Z1w	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1Mzc5NTgsImV4cCI6MTc2NzE0Mjc1OH0.IfR_uf6a_ICHMN4jeKo0lNhDjfVytQk8o_vsoxtib1g	\N	::ffff:172.20.0.2	2025-12-24 08:59:18.661	2025-12-24 00:59:18.661635	2025-12-24 00:59:18.661635
542ae649-af85-42f8-ba85-36121a02d112	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjUzODIyOSwiZXhwIjoxNzY2NTY3MDI5fQ.ws0dn9m1Pytj6qNV1gtSN26TKBAGBRYutOgatN2Zi28	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1MzgyMjksImV4cCI6MTc2NzE0MzAyOX0.uVB_VIW2BhOUlbWNIyrwPawrKWkYsV1cUhMx6FxeJE4	\N	::ffff:172.20.0.2	2025-12-24 09:03:49.082	2025-12-24 01:03:49.083007	2025-12-24 01:03:49.083007
dee6ee89-5e48-4327-a948-d13a0bbd5364	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjUzOTg5NiwiZXhwIjoxNzY2NTY4Njk2fQ.9-Zp-C0z218F1vEVqt3CRC4nC1EauQDNnTySmFrcHCU	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1Mzk4OTYsImV4cCI6MTc2NzE0NDY5Nn0.QKxkzR7qGkpLbZT2FfOAwHVc08XsOfqRPKML1MbFgyc	\N	::ffff:172.20.0.2	2025-12-24 09:31:36.157	2025-12-24 01:31:36.157298	2025-12-24 01:31:36.157298
ed585877-306a-4af6-8469-f9f3dc9056ba	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjU0MDA3MSwiZXhwIjoxNzY2NTY4ODcxfQ.mGocjHhnQhIifjT-uGkkDRxHWF1j2r56rvrtSXPMGnQ	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1NDAwNzEsImV4cCI6MTc2NzE0NDg3MX0.xhmwWvMia1LhFA3jAf0WZy7pTXsWKE9vAOqLMwetTzk	\N	::ffff:172.20.0.2	2025-12-24 09:34:31.269	2025-12-24 01:34:31.269391	2025-12-24 01:34:31.269391
5b074bff-7e58-482d-8fa7-bf7cb956367e	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjU0MDU3OCwiZXhwIjoxNzY2NTY5Mzc4fQ.HZlGF7GSst-TW32lhmbg82p_TyOI4s7cKW0nFfM2WoA	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1NDA1NzgsImV4cCI6MTc2NzE0NTM3OH0.JWExZmQZSeZ12WCd68WbCbbA3JRH08h9t9tLnAh_CTo	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-24 09:42:58.014	2025-12-24 01:42:58.014618	2025-12-24 01:42:58.014618
c9c164f6-8497-4a01-85e3-ad4538c17a95	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjU0MDYyOSwiZXhwIjoxNzY2NTY5NDI5fQ.lBHY2phIHN8NguqV6hpbzJNpyXzvnmjAoLzSbIQ1kyg	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1NDA2MjksImV4cCI6MTc2NzE0NTQyOX0.o2Outt5xlDzfkwECOfRfgmyib2SKzH42tC1sHeelkRg	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-24 09:43:49.116	2025-12-24 01:43:49.116357	2025-12-24 01:43:49.116357
4c164ea5-b635-47a2-bca5-04931249553e	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjU0MTc5OSwiZXhwIjoxNzY2NTcwNTk5fQ.xQqp6-sI2fl8LEb6Ghy4kDlMoJNIEirpgiKvEv7NwMM	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1NDE3OTksImV4cCI6MTc2NzE0NjU5OX0.4xMGRXKCPGhSdZPVE-hxqedNvbSlHxKYy0008iNaFtw	{"platform": "test", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-24 10:03:19.646	2025-12-24 02:03:19.64679	2025-12-24 02:03:19.64679
8026c5bc-f231-4521-a49f-5f2f164aa802	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjU0ODAxNCwiZXhwIjoxNzY2NTc2ODE0fQ.Pd6MVYlPmLWE2pb0LceHrMyFvTbwMcDMtyMBrDxByAw	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1NDgwMTQsImV4cCI6MTc2NzE1MjgxNH0.NvglbEh4XlapvJvSUAw_LKN8M_E5BWMhvvYZW-WjNjM	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-24 11:46:54.779	2025-12-24 03:46:54.779667	2025-12-24 03:46:54.779667
e46a6305-82d0-4ecb-b85e-52644763e40a	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjU0ODAxOCwiZXhwIjoxNzY2NTc2ODE4fQ.ZMsXt4fYNaf44csHL9sXHgarE8ak8NW96L2KUy-nEVE	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY1NDgwMTgsImV4cCI6MTc2NzE1MjgxOH0.PM6BNISYDZb3-pFNNg9vtSG4pN9wl-uTT5i66IkD_6Y	\N	::ffff:172.20.0.2	2025-12-24 11:46:58.43	2025-12-24 03:46:58.43016	2025-12-24 03:46:58.43016
8e96bfc5-b03f-4958-be8a-427199eebb05	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjcyMzA3OCwiZXhwIjoxNzY2NzUxODc4fQ.UcSUKmT_bWfOgzjMOPCRtWDURshXYK-8dedgj2uH1bg	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY3MjMwNzgsImV4cCI6MTc2NzMyNzg3OH0.AqpagYLVejj6F3CJJncetFBi3EQL2Oo9omn4jEw2NwA	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-26 12:24:38.25	2025-12-26 04:24:38.250317	2025-12-26 04:24:38.250317
ed8fd7e5-ced9-4f93-ae16-4518b44fd06d	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjkwNzIwNCwiZXhwIjoxNzY2OTM2MDA0fQ.4X40sztlSdUN5LSNIEwIszETXTcQKZRrbNLJMx0qY3k	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY5MDcyMDQsImV4cCI6MTc2NzUxMjAwNH0.QSqrpuU90ArHSlnP44D_1pZI57idaZulUgPLqERFZak	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-28 15:33:24.379	2025-12-28 07:33:24.379821	2025-12-28 07:33:24.379821
73d8feac-6289-4621-a1d0-c324e45b61ae	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjkwNzYyMCwiZXhwIjoxNzY2OTM2NDIwfQ.W9G8Sb_L5aQsH1CprUZwOpW3YT2Dxs3l7ieyaWu7faI	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY5MDc2MjAsImV4cCI6MTc2NzUxMjQyMH0.4IQSykiI8cZLUyR7kqQNRnz4ROdGJfPZ-jy_og0uBZ0	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-28 15:40:20.066	2025-12-28 07:40:20.066689	2025-12-28 07:40:20.066689
7dd40880-5764-4e49-aed1-7c4ce2729ef1	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjkwODEwMSwiZXhwIjoxNzY2OTM2OTAxfQ.NsIMgUzoij42mbNwu9n1ovAB-wJ8NdAacHVnpKwjt-s	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY5MDgxMDEsImV4cCI6MTc2NzUxMjkwMX0.vFtjQy7qCjSx6jUiYiWk1FacbwJF737h6IOyrJ5ioJQ	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-28 15:48:21.138	2025-12-28 07:48:21.138214	2025-12-28 07:48:21.138214
82932ffa-a03a-4101-aef3-03f1cff99c15	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjkwODcwMiwiZXhwIjoxNzY2OTM3NTAyfQ.118Smq6vUY8XVJ7A-6mEq166wjfBDlT938OXzjrdTRQ	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY5MDg3MDIsImV4cCI6MTc2NzUxMzUwMn0.zCBd5Qm033aVGiJZ3ePeAXuADwqr3qeEEGHFG6rWSqQ	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-28 15:58:22.331	2025-12-28 07:58:22.331532	2025-12-28 07:58:22.331532
0aea851d-e52d-44a9-9d41-74d9be50f561	550e8400-e29b-41d4-a716-446655440105	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZSI6Im51cnNlIiwiZmFjaWxpdHlJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSIsImlhdCI6MTc2NjkwOTExNiwiZXhwIjoxNzY2OTM3OTE2fQ.hfKPnz3OBfV8eYbwPygBe22N6Yd0Ry63XEP9QNCWiIU	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTA1IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjY5MDkxMTYsImV4cCI6MTc2NzUxMzkxNn0.KUtJoXYir-mjSQJt1Jd5wjHobY4itISP6ELLnIrPrEU	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.20.0.2	2025-12-28 16:05:16.857	2025-12-28 08:05:16.85749	2025-12-28 08:05:16.85749
\.


--
-- Data for Name: vital_signs; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.vital_signs (vital_sign_id, patient_id, measured_at, temperature_celsius, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, respiratory_rate, oxygen_saturation, pain_score, blood_glucose_mg_dl, weight_kg, height_cm, input_method, device_id, recorded_by, created_at) FROM stdin;
5ef49a63-342a-4cfe-a498-196fdc1ad8ab	550e8400-e29b-41d4-a716-446655440201	2025-12-13 01:20:13.496418	36.8	142	88	78	16	98	0	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-12-13 03:20:13.496418
28d4bade-94c1-4f48-8af4-e4ed920194cb	550e8400-e29b-41d4-a716-446655440202	2025-12-13 00:20:13.496418	37.2	120	75	72	14	99	2	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440102	2025-12-13 03:20:13.496418
5ccfb9b2-41c2-4fe5-9e96-62320c25b301	550e8400-e29b-41d4-a716-446655440203	2025-12-13 02:20:13.496418	36.5	138	85	65	15	97	0	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-12-13 03:20:13.496418
c6d6a263-f46e-48e4-94d0-750d0981b747	550e8400-e29b-41d4-a716-446655440204	2025-12-13 02:50:13.496418	37.1	115	72	88	18	96	4	\N	\N	\N	voice	\N	550e8400-e29b-41d4-a716-446655440102	2025-12-13 03:20:13.496418
a2430a11-1c10-4ca1-b04a-29cfcfca6994	550e8400-e29b-41d4-a716-446655440205	2025-12-12 23:20:13.496418	36.9	125	78	70	16	98	0	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-12-13 03:20:13.496418
2e86437f-7c35-4993-924d-a9d0d1c8c743	550e8400-e29b-41d4-a716-446655440201	2025-12-24 03:52:40.792	\N	111	59	49	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-24 03:52:40.799973
dcc74936-4a5f-49f7-af18-002b1e4f21c5	550e8400-e29b-41d4-a716-446655440201	2025-12-28 07:49:21.898	36.5	\N	\N	\N	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-28 07:49:21.907874
575d8aa5-f7a9-4024-89e2-00b293c58428	550e8400-e29b-41d4-a716-446655440201	2025-12-28 07:51:53.593	\N	107	56	40	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-28 07:51:53.601832
75c05e3d-5067-4dc9-8241-781a18b743a5	550e8400-e29b-41d4-a716-446655440201	2025-12-28 07:58:52.664	36.5	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-12-28 07:58:52.665382
f1e7c744-fa2b-4a9b-ae63-d6c592ac958a	550e8400-e29b-41d4-a716-446655440201	2025-12-28 08:06:44.868	36.7	\N	\N	\N	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-28 08:06:44.879491
959dac1e-5804-473d-9d66-5840a1806c79	550e8400-e29b-41d4-a716-446655440201	2025-12-28 08:07:38.593	\N	118	79	46	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-28 08:07:38.602488
\.


--
-- Data for Name: voice_categorization_log; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.voice_categorization_log (log_id, review_id, detected_categories, extraction_prompt, extraction_response, user_edited_transcript, user_edited_data, reanalysis_count, created_at, confirmed_at, confirmed_by) FROM stdin;
72c69675-1de1-4e2b-a5ed-970b71f70279	0c7248d7-879a-412d-86c9-d51207f2aaac	["vitals"]	Category detection and extraction	\N	t	f	0	2025-12-13 03:27:47.189571	2025-12-13 03:27:47.420606	550e8400-e29b-41d4-a716-446655440105
f02a8973-dfa0-4c3d-98e8-6cbd2d5cd030	5065b74e-616c-40ae-85a5-752c4a453d4a	["vitals"]	Category detection and extraction	\N	t	f	0	2025-12-13 05:02:05.90156	2025-12-13 05:02:06.191611	550e8400-e29b-41d4-a716-446655440105
aae437f3-bcd8-460c-baa9-588e9393df52	aa2c9be9-07d3-4406-85d9-1a09082085d6	["vitals"]	Category detection and extraction	\N	t	f	0	2025-12-13 04:56:06.983554	2025-12-15 02:00:00.428009	550e8400-e29b-41d4-a716-446655440105
ad39d68f-56c0-484d-9772-0aacab2b16f4	b68ae800-9321-4f72-ac6b-c54de5e42252	["vitals"]	Category detection and extraction	\N	f	f	0	2025-12-16 03:38:14.291513	2025-12-16 03:38:39.985972	550e8400-e29b-41d4-a716-446655440105
c4fd6e1f-767f-4f31-89d7-03f955316e7c	ba932400-d86f-4a0d-839b-fb772a1b4b55	[]	Category detection and extraction	\N	f	f	0	2025-12-19 09:28:10.346521	2025-12-19 09:28:27.317	550e8400-e29b-41d4-a716-446655440105
d2d13145-f28d-4a2b-a152-65ba57b9572b	1a60c2b8-f553-412c-802e-bd550f914abb	[]	Category detection and extraction	\N	f	f	0	2025-12-19 09:29:12.152014	\N	\N
a20c2ae7-d7a4-42d0-b268-28c9020fae4c	87ac8eeb-0bf5-422b-af7f-15bd330120ce	[]	Category detection and extraction	\N	f	f	0	2025-12-24 03:47:40.696881	\N	\N
cba54db3-0bc1-414e-8bd6-39975da9cb29	4e84c6f9-f9ba-438f-b51a-d0ab1e7af6d9	[]	Category detection and extraction	\N	f	f	0	2025-12-24 03:48:45.144333	\N	\N
7523c55e-6b81-44dc-96c6-970a3ac6ec7d	bc34dbb7-7ef0-440f-9dc8-ad4b21377b43	[]	Category detection and extraction	\N	f	f	0	2025-12-24 03:57:30.854608	\N	\N
8185a92a-9829-4960-9aac-ff245754706c	e2c09831-489a-47e4-935b-e1ce42d1dcbf	[]	Category detection and extraction	\N	f	f	0	2025-12-24 03:59:25.022651	\N	\N
5d401425-3a6a-4653-bd0f-a234e48ac4f3	f1e6514c-ccfa-4735-98f4-38c9b55fe7eb	[]	Category detection and extraction	\N	f	f	0	2025-12-24 04:04:56.872708	\N	\N
973b486d-2c91-4c20-87fb-c43ccb6a3bf6	3b290579-b9d4-4b43-b6fb-7e2cfc646907	["clinical_note", "medication"]	Category detection and extraction	\N	f	f	0	2025-12-24 04:18:17.805247	\N	\N
a94110fe-3e0b-4b99-9b51-56817e3359c0	49f1552d-ab6c-427b-a199-8f1fa7e2c440	["vitals"]	Category detection and extraction	\N	f	f	0	2025-12-26 04:29:08.798356	\N	\N
b8158380-9113-46c3-beff-46ca12dfbdac	fb488650-8f50-41a8-a1c5-8cc67cefc26f	["vitals", "medication"]	Category detection and extraction	\N	f	f	0	2025-12-26 04:30:11.788669	\N	\N
19839d2d-2175-4ded-8e3d-f1fa96549084	8aed5c50-6875-4168-b8e1-f653c9a8bd57	[]	Category detection and extraction	\N	f	f	0	2025-12-26 04:37:24.846639	\N	\N
aa7f91dc-edfa-411e-b1e8-d877b5c891fa	8ac3e7e7-4e30-4ff5-a2e1-8634ecb4b9ef	["vitals"]	Category detection and extraction	\N	f	f	0	2025-12-26 05:51:50.72574	\N	\N
514a2a25-c494-49f2-9a8d-5ab88a1e40a2	0d024681-ab85-476f-a3bc-0023eb0aa20a	["vitals"]	Category detection and extraction	\N	f	f	0	2025-12-26 06:00:40.06312	\N	\N
2fff24d6-3d15-444f-9c60-b719c88b040b	11609e1e-60cf-4c6c-b634-6e8ae9a25a46	["vitals", "clinical_note"]	Category detection and extraction	\N	f	f	0	2025-12-26 06:02:49.859811	\N	\N
\.


--
-- Data for Name: voice_recordings; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.voice_recordings (recording_id, patient_id, recorded_at, duration_seconds, audio_file_path, transcription_text, transcription_language, ai_structured_extraction, ai_confidence_score, processing_status, processing_started_at, processing_completed_at, processing_error, recorded_by, created_at, review_status, context_type, context_patient_id) FROM stdin;
dd79a1d1-ec21-40dd-8594-4c9632edb824	\N	2025-12-13 03:26:56.137	5	uploads/voice/0afb4b29-e01c-497a-9c1c-71d22bbe2228-1765596416136.m4a.enc	\N	en	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-13 03:26:56.138229	reviewed	global	\N
6973801f-46df-4344-a388-b27f67aa800c	\N	2025-12-13 05:01:14.501	5	uploads/voice/0dd85d9f-bda9-4990-993f-2d710bcf169a-1765602074500.m4a.enc	\N	en	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-13 05:01:14.502136	reviewed	global	\N
c848ee9f-24ae-4071-bc09-78da76402211	\N	2025-12-13 04:53:39.744	5	uploads/voice/2fc8c7b1-e4fd-4f48-8762-82a7d3de9874-1765601619742.m4a.enc	\N	en	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-13 04:53:39.744721	reviewed	global	\N
c460428b-e481-4686-a26d-65ef90a96657	\N	2025-12-16 03:37:18.888	8	uploads/voice/7b9da89a-6dec-4658-876c-d85fc7e92bf8-1765856238228.m4a.enc	血圧は100の30	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-16 03:37:18.895259	reviewed	global	\N
d7ec5e86-b0fc-4002-8414-7676cf4e95c5	550e8400-e29b-41d4-a716-446655440201	2025-12-19 09:27:39.087	3	uploads/voice/f1497c18-7b2a-427a-9845-571bfb1fc819-1766136459002.m4a.enc	テストテストテスト	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-19 09:27:39.096167	reviewed	patient	550e8400-e29b-41d4-a716-446655440201
cafaf81f-4f9b-4943-a3a8-eeddb414f914	550e8400-e29b-41d4-a716-446655440201	2025-12-24 03:57:25.684	12	uploads/voice/ae00d8d4-80d6-4060-b2b9-8cd3d641712d-1766548645672.m4a.enc	えっと、彼女は料理です。44歳です。今は夢の仕事をしています。OK? Is that enough?	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-24 03:57:25.689941	discarded	patient	550e8400-e29b-41d4-a716-446655440201
7cd3e593-e5f4-4cd7-ac27-49d235bfa54b	\N	2025-12-24 03:59:20.493	33	uploads/voice/eb2c4148-9a7d-4006-9399-6c383b7a7797-1766548760475.m4a.enc	医薬費医療機器法に基づく医療機器及び、対外診断用医薬費の外国製造業者登録制度について、申請書及び添付資料、届証の記載内容で申請前の形式的な確認が必要な事項を中心に チェックリストを作成しております	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-24 03:59:20.499469	discarded	global	\N
6d165216-5827-43fc-a75f-47f09ea99adc	\N	2025-12-24 03:47:29.548	5	uploads/voice/39ae187b-777f-4aa9-87b0-6bb610898ed3-1766548049539.m4a.enc	1、2、3、1、2、3、テスト、テスト、1、2、3	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-24 03:47:29.553894	discarded	global	\N
34c8c04a-3e9d-4d26-b778-a8b09ac3b938	550e8400-e29b-41d4-a716-446655440201	2025-12-19 09:28:57.454	12	uploads/voice/5f82d4d2-59c0-4900-90bb-c3b82c86725a-1766136537312.m4a.enc	私はカッチンレンです。クンティンさんの友達です。 で、ドムは私500万を貸してるから。	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-19 09:28:57.454436	discarded	patient	550e8400-e29b-41d4-a716-446655440201
da0eabf7-0268-4f25-9b92-40425332cebe	550e8400-e29b-41d4-a716-446655440201	2025-12-24 03:48:37.673	11	uploads/voice/f34bdc32-8250-4df7-a2f2-902e102616cc-1766548117661.m4a.enc	新設は170の48です。	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-24 03:48:37.673496	discarded	patient	550e8400-e29b-41d4-a716-446655440201
ced077e0-b1e6-401f-a0b0-b8cf50c36b9e	\N	2025-12-24 04:04:47.063	62	uploads/voice/62398b59-c448-45c5-9763-3fa3c7861728-1766549087034.m4a.enc	日本テレビは自民党総裁選で 党員票が勝敗に大きく関わることから 動向を探るため、党員、党友と答えた方を対象にした 独自の電話調査を行いました 立候補を表明した5人のうち、誰を支持するか尋ねたところ 高市さない氏が35%でトップ 小泉慎二郎氏が28%で続き 林吉政氏が23%などとなりました その党員、党友票についてここからは小栗さんに解説してもらいます 小栗さん 日本テレビは党員、党友と答えた方を対象とした調査を これまで3回行いました 各候補への支持がどう推移してきたかを見ていきますと 小泉さんは2回目の調査で4ポイント減らしましたが 今回は変わらず28% 高市さんは2回目で6ポイントを増やしたんですが 今回は1ポイント増でした	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-24 04:04:47.067036	discarded	global	\N
0a306819-ecba-4108-8bff-663977e5c78e	\N	2025-12-26 04:28:58.701	11	uploads/voice/e924a1f3-9b8c-4db6-a664-5407440622dd-1766723338689.m4a.enc	1、2、3、1、2、3、1、2、3、テスト、テスト 89、89	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-26 04:28:58.705948	discarded	global	\N
75126f78-2538-467d-b2ff-824a3cf61add	\N	2025-12-24 04:17:57.068	58	uploads/voice/cb52e02f-3125-4fa7-b97b-96b01dccef9f-1766549877043.m4a.enc	「お疲れ様です。教育員です。よろしくお願いします。お仕送りをお願いします」 「お願いします。今日は入院の二号の伊藤さんなんですけど、杉母校でおむすやねんけど、 インチ機能が低下して、昼放出したら便移事理あったんですよ。 それで明日アフェなんで、今日下座やるんですけど、今日の時点でマイナス4からしてて、 普段から下座やるのを共有してる人やから、昨日ラキショ20的でも便マイナスっていうことで、 先生の指示で、今日はラキショ1本入れてもらうように言われてます」 「1本…1本ですか?」 「そうそう」 「えっ、伊藤さん寝れるかな夜」 「あまりそうやんな。で、明日9時のオペアやねんけど、 天敵のルート早く入れると抜いちゃうかもしれないから、 入れるのはイーギーのほうが安そうです」 「そうですね」 「それで明日関係で言ったら、伊藤さんの隣のベッドの中尾さんも ラキショ20的入れる予定なので、ちょっとこの日は便フィーバーかもしれないです」 「分かりました。お疲れ様でーす」	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-24 04:17:57.071322	discarded	global	\N
151d45f8-5e51-4744-bed2-d13a6f3eadf8	\N	2025-12-26 06:02:29.141	31	uploads/voice/584602a4-f6c5-4b2f-8ddd-b50b7a227404-1766728949122.m4a.enc	はい、これ1回押して、はいどうぞ こんにちは、なつさん 今日、体調いかがですか 体温が36度7分、血圧が下が80、上が140 ちょっと血圧高いですね また、お薬の方と先生の方で確認してみましょう 他は何か気になることありますか?	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-26 06:02:29.14624	discarded	global	\N
8913b5e0-d32f-4cd3-98c5-f41b4353e9cf	550e8400-e29b-41d4-a716-446655440201	2025-12-26 04:37:20.076	10	uploads/voice/5381ab34-e6d9-4478-ae9c-81844c20fefd-1766723840064.m4a.enc	1、2、3テスト、テスト、98何もわからない	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-26 04:37:20.081516	discarded	patient	550e8400-e29b-41d4-a716-446655440201
734f1ed6-92a3-4f6e-9ca5-d7336d249898	550e8400-e29b-41d4-a716-446655440201	2025-12-26 04:29:59.117	16	uploads/voice/18d24153-5cb7-47e3-84e7-aa5bd3237f3a-1766723399105.m4a.enc	1,2,3、1,2,3、89、89、テスト、テスト 施設は140の55	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-26 04:29:59.11728	discarded	patient	550e8400-e29b-41d4-a716-446655440201
ccd67688-0354-4fb7-bdf1-bbd1ea6a54d5	\N	2025-12-26 05:51:40.341	12	uploads/voice/f8b1a39a-984e-4958-ba02-b8c28323b35a-1766728300329.m4a.enc	体温が37度です。 あと、血圧が上が110度、下が70度です。	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-26 05:51:40.342081	discarded	global	\N
0372ea43-5f86-43c3-95ed-e3b058f30b51	550e8400-e29b-41d4-a716-446655440201	2025-12-26 06:00:29.653	13	uploads/voice/589dbcf4-6f52-44e6-ba67-d6010b56d5bb-1766728829641.m4a.enc	えっと、今日、サクライさんの血圧が上が120、下は70です、で、体温が37度です	ja	\N	\N	pending	\N	\N	\N	550e8400-e29b-41d4-a716-446655440105	2025-12-26 06:00:29.65361	discarded	patient	550e8400-e29b-41d4-a716-446655440201
\.


--
-- Data for Name: voice_review_queue; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.voice_review_queue (review_id, recording_id, user_id, context_type, context_patient_id, transcript, transcript_language, extracted_data, confidence_score, status, created_at, reviewed_at, processing_time_ms, model_version) FROM stdin;
0c7248d7-879a-412d-86c9-d51207f2aaac	dd79a1d1-ec21-40dd-8594-4c9632edb824	550e8400-e29b-41d4-a716-446655440105	global	\N	患者の血圧は120/80、体温は36.5度です。	en	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": 36.5, "blood_pressure": {"systolic": 120, "diastolic": 80}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "en", "confidence": 0.9, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0.9, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}], "overallConfidence": 0.9}	0.90	confirmed	2025-12-13 03:27:47.180251	2025-12-13 03:27:47.420606	50976	llama3.1:8b
5065b74e-616c-40ae-85a5-752c4a453d4a	6973801f-46df-4344-a388-b27f67aa800c	550e8400-e29b-41d4-a716-446655440105	global	\N	患者の血圧は120/80、体温は36.5度です。	en	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": 36.5, "blood_pressure": {"systolic": 120, "diastolic": 80}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "en", "confidence": 0.9, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0.9, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}], "overallConfidence": 0.9}	0.90	confirmed	2025-12-13 05:02:05.892538	2025-12-13 05:02:06.191611	51318	llama3.1:8b
aa2c9be9-07d3-4406-85d9-1a09082085d6	c848ee9f-24ae-4071-bc09-78da76402211	550e8400-e29b-41d4-a716-446655440105	global	\N	患者の血圧は120/80、体温は36.5度です。	en	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": 36.5, "blood_pressure": {"systolic": 120, "diastolic": 80}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "en", "confidence": 0.9, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0.9, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}], "overallConfidence": 0.9}	0.90	confirmed	2025-12-13 04:56:06.9745	2025-12-15 02:00:00.428009	50911	llama3.1:8b
b68ae800-9321-4f72-ac6b-c54de5e42252	c460428b-e481-4686-a26d-65ef90a96657	550e8400-e29b-41d4-a716-446655440105	global	\N	血圧は100の30	ja	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": null, "blood_pressure": {"systolic": 100, "diastolic": 30}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "ja", "confidence": 0.9, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}], "overallConfidence": 0.9}	0.90	confirmed	2025-12-16 03:38:14.281791	2025-12-16 03:38:39.985972	48802	llama3.1:8b
ba932400-d86f-4a0d-839b-fb772a1b4b55	d7ec5e86-b0fc-4002-8414-7676cf4e95c5	550e8400-e29b-41d4-a716-446655440105	patient	550e8400-e29b-41d4-a716-446655440201	テストテストテスト	ja	{"categories": [], "overallConfidence": 0.7}	0.70	confirmed	2025-12-19 09:28:10.340802	2025-12-19 09:28:27.317	24397	llama3.1:8b
87ac8eeb-0bf5-422b-af7f-15bd330120ce	6d165216-5827-43fc-a75f-47f09ea99adc	550e8400-e29b-41d4-a716-446655440105	global	\N	1、2、3、1、2、3、テスト、テスト、1、2、3	ja	{"categories": [], "overallConfidence": 0.5}	0.50	discarded	2025-12-24 03:47:40.693057	2025-12-24 03:48:07.47673	4487	llama3.1:8b
1a60c2b8-f553-412c-802e-bd550f914abb	34c8c04a-3e9d-4d26-b778-a8b09ac3b938	550e8400-e29b-41d4-a716-446655440105	patient	550e8400-e29b-41d4-a716-446655440201	私はカッチンレンです。クンティンさんの友達です。 で、ドムは私500万を貸してるから。	ja	{"categories": [], "overallConfidence": 0.7}	0.70	discarded	2025-12-19 09:29:12.147688	2025-12-24 03:48:12.713254	6643	llama3.1:8b
4e84c6f9-f9ba-438f-b51a-d0ab1e7af6d9	da0eabf7-0268-4f25-9b92-40425332cebe	550e8400-e29b-41d4-a716-446655440105	patient	550e8400-e29b-41d4-a716-446655440201	新設は170の48です。	ja	{"categories": [], "overallConfidence": 0.7}	0.70	discarded	2025-12-24 03:48:45.140744	2025-12-24 03:49:11.432913	1515	llama3.1:8b
bc34dbb7-7ef0-440f-9dc8-ad4b21377b43	cafaf81f-4f9b-4943-a3a8-eeddb414f914	550e8400-e29b-41d4-a716-446655440105	patient	550e8400-e29b-41d4-a716-446655440201	えっと、彼女は料理です。44歳です。今は夢の仕事をしています。OK? Is that enough?	ja	{"categories": [], "overallConfidence": 0.7}	0.70	discarded	2025-12-24 03:57:30.850585	2025-12-24 04:16:18.104048	3791	llama3.1:8b
e2c09831-489a-47e4-935b-e1ce42d1dcbf	7cd3e593-e5f4-4cd7-ac27-49d235bfa54b	550e8400-e29b-41d4-a716-446655440105	global	\N	医薬費医療機器法に基づく医療機器及び、対外診断用医薬費の外国製造業者登録制度について、申請書及び添付資料、届証の記載内容で申請前の形式的な確認が必要な事項を中心に チェックリストを作成しております	ja	{"categories": [], "overallConfidence": 0.7}	0.70	discarded	2025-12-24 03:59:25.018628	2025-12-24 04:16:26.804062	1897	llama3.1:8b
f1e6514c-ccfa-4735-98f4-38c9b55fe7eb	ced077e0-b1e6-401f-a0b0-b8cf50c36b9e	550e8400-e29b-41d4-a716-446655440105	global	\N	日本テレビは自民党総裁選で 党員票が勝敗に大きく関わることから 動向を探るため、党員、党友と答えた方を対象にした 独自の電話調査を行いました 立候補を表明した5人のうち、誰を支持するか尋ねたところ 高市さない氏が35%でトップ 小泉慎二郎氏が28%で続き 林吉政氏が23%などとなりました その党員、党友票についてここからは小栗さんに解説してもらいます 小栗さん 日本テレビは党員、党友と答えた方を対象とした調査を これまで3回行いました 各候補への支持がどう推移してきたかを見ていきますと 小泉さんは2回目の調査で4ポイント減らしましたが 今回は変わらず28% 高市さんは2回目で6ポイントを増やしたんですが 今回は1ポイント増でした	ja	{"categories": [], "overallConfidence": 0.7}	0.70	discarded	2025-12-24 04:04:56.868565	2025-12-24 04:16:32.662627	4906	llama3.1:8b
3b290579-b9d4-4b43-b6fb-7e2cfc646907	75126f78-2538-467d-b2ff-824a3cf61add	550e8400-e29b-41d4-a716-446655440105	global	\N	「お疲れ様です。教育員です。よろしくお願いします。お仕送りをお願いします」 「お願いします。今日は入院の二号の伊藤さんなんですけど、杉母校でおむすやねんけど、 インチ機能が低下して、昼放出したら便移事理あったんですよ。 それで明日アフェなんで、今日下座やるんですけど、今日の時点でマイナス4からしてて、 普段から下座やるのを共有してる人やから、昨日ラキショ20的でも便マイナスっていうことで、 先生の指示で、今日はラキショ1本入れてもらうように言われてます」 「1本…1本ですか?」 「そうそう」 「えっ、伊藤さん寝れるかな夜」 「あまりそうやんな。で、明日9時のオペアやねんけど、 天敵のルート早く入れると抜いちゃうかもしれないから、 入れるのはイーギーのほうが安そうです」 「そうですね」 「それで明日関係で言ったら、伊藤さんの隣のベッドの中尾さんも ラキショ20的入れる予定なので、ちょっとこの日は便フィーバーかもしれないです」 「分かりました。お疲れ様でーす」	ja	{"categories": [{"data": {"plan": "", "category": "", "objective": "", "assessment": "", "subjective": ""}, "type": "clinical_note", "language": "ja", "confidence": 0.8, "fieldConfidences": {"plan": 0.6, "category": 0.6, "objective": 0.6, "assessment": 0.6, "subjective": 0.6}}, {"data": {"dose": "", "time": "", "route": "", "response": "", "medication_name": ""}, "type": "medication", "language": "ja", "confidence": 0.8, "fieldConfidences": {"dose": 0.6, "time": 0.6, "route": 0.6, "response": 0.6, "medication_name": 0.6}}], "overallConfidence": 0.8}	0.80	discarded	2025-12-24 04:18:17.799579	2025-12-26 04:25:17.085081	15889	llama3.1:8b
49f1552d-ab6c-427b-a199-8f1fa7e2c440	0a306819-ecba-4108-8bff-663977e5c78e	550e8400-e29b-41d4-a716-446655440105	global	\N	1、2、3、1、2、3、1、2、3、テスト、テスト 89、89	ja	{"categories": [{"data": {"height_cm": null, "weight_kg": 89, "heart_rate": null, "temperature": null, "blood_pressure": {"systolic": null, "diastolic": null}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "ja", "confidence": 0.8, "fieldConfidences": {"height_cm": 0, "weight_kg": 0.9, "heart_rate": 0, "temperature": 0, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0, "blood_pressure.diastolic": 0}}], "overallConfidence": 0.8}	0.80	discarded	2025-12-26 04:29:08.79281	2025-12-26 04:29:32.258834	8795	llama3.1:8b
8aed5c50-6875-4168-b8e1-f653c9a8bd57	8913b5e0-d32f-4cd3-98c5-f41b4353e9cf	550e8400-e29b-41d4-a716-446655440105	patient	550e8400-e29b-41d4-a716-446655440201	1、2、3テスト、テスト、98何もわからない	ja	{"categories": [], "overallConfidence": 0.5}	0.50	discarded	2025-12-26 04:37:24.841298	2025-12-26 04:58:46.723679	3723	llama3.1:8b
fb488650-8f50-41a8-a1c5-8cc67cefc26f	734f1ed6-92a3-4f6e-9ca5-d7336d249898	550e8400-e29b-41d4-a716-446655440105	patient	550e8400-e29b-41d4-a716-446655440201	1,2,3、1,2,3、89、89、テスト、テスト 施設は140の55	ja	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": null, "blood_pressure": {"systolic": 140, "diastolic": 55}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "ja", "confidence": 0.8, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}, {"data": {"dose": "", "time": "", "route": "", "response": "", "medication_name": ""}, "type": "medication", "language": "ja", "confidence": 0.8, "fieldConfidences": {"dose": 0.6, "time": 0.6, "route": 0.6, "response": 0.6, "medication_name": 0.6}}], "overallConfidence": 0.8}	0.80	discarded	2025-12-26 04:30:11.782067	2025-12-26 05:50:57.038997	11410	llama3.1:8b
8ac3e7e7-4e30-4ff5-a2e1-8634ecb4b9ef	ccd67688-0354-4fb7-bdf1-bbd1ea6a54d5	550e8400-e29b-41d4-a716-446655440105	global	\N	体温が37度です。 あと、血圧が上が110度、下が70度です。	ja	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": 37, "blood_pressure": {"systolic": 110, "diastolic": 70}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "ja", "confidence": 0.9, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0.9, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}], "overallConfidence": 0.9}	0.90	discarded	2025-12-26 05:51:50.721826	2025-12-26 05:52:09.437288	8888	llama3.1:8b
0d024681-ab85-476f-a3bc-0023eb0aa20a	0372ea43-5f86-43c3-95ed-e3b058f30b51	550e8400-e29b-41d4-a716-446655440105	patient	550e8400-e29b-41d4-a716-446655440201	えっと、今日、サクライさんの血圧が上が120、下は70です、で、体温が37度です	ja	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": 37, "blood_pressure": {"systolic": 120, "diastolic": 70}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "ja", "confidence": 0.9, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0.9, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}], "overallConfidence": 0.9}	0.90	discarded	2025-12-26 06:00:40.057968	2025-12-26 06:01:33.675502	9070	llama3.1:8b
11609e1e-60cf-4c6c-b634-6e8ae9a25a46	151d45f8-5e51-4744-bed2-d13a6f3eadf8	550e8400-e29b-41d4-a716-446655440105	global	\N	はい、これ1回押して、はいどうぞ こんにちは、なつさん 今日、体調いかがですか 体温が36度7分、血圧が下が80、上が140 ちょっと血圧高いですね また、お薬の方と先生の方で確認してみましょう 他は何か気になることありますか?	ja	{"categories": [{"data": {"height_cm": null, "weight_kg": null, "heart_rate": null, "temperature": 36.17, "blood_pressure": {"systolic": 140, "diastolic": 80}, "respiratory_rate": null, "oxygen_saturation": null}, "type": "vitals", "language": "ja", "confidence": 0.8, "fieldConfidences": {"height_cm": 0, "weight_kg": 0, "heart_rate": 0, "temperature": 0.9, "respiratory_rate": 0, "oxygen_saturation": 0, "blood_pressure.systolic": 0.9, "blood_pressure.diastolic": 0.9}}, {"data": {"plan": "フィルを硨らい、トグランは歴る。", "category": null, "objective": "フレスは36二7分,フィルを代らい、フィルを反しい。", "assessment": "トグランは一丂に歴る、害を反しい。", "subjective": ""}, "type": "clinical_note", "language": "ja", "confidence": 0.8, "fieldConfidences": {"plan": 0.6, "category": 0, "objective": 0.6, "assessment": 0.6, "subjective": 0.6}}], "overallConfidence": 0.8}	0.80	discarded	2025-12-26 06:02:49.852305	2025-12-26 06:03:28.058936	18339	llama3.1:8b
\.


--
-- Data for Name: weekly_schedule_items; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.weekly_schedule_items (schedule_item_id, care_plan_id, day_of_week, time_slot, specific_time, service_data, linked_to_care_plan_item, frequency, created_at) FROM stdin;
\.


--
-- Name: medication_administrations_chain_sequence_seq; Type: SEQUENCE SET; Schema: public; Owner: nagare
--

SELECT pg_catalog.setval('public.medication_administrations_chain_sequence_seq', 8, true);


--
-- Name: auth_audit_log auth_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.auth_audit_log
    ADD CONSTRAINT auth_audit_log_pkey PRIMARY KEY (log_id);


--
-- Name: barthel_assessments barthel_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.barthel_assessments
    ADD CONSTRAINT barthel_assessments_pkey PRIMARY KEY (assessment_id);


--
-- Name: care_conferences care_conferences_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_conferences
    ADD CONSTRAINT care_conferences_pkey PRIMARY KEY (care_conference_id);


--
-- Name: care_plan_audit_log care_plan_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_audit_log
    ADD CONSTRAINT care_plan_audit_log_pkey PRIMARY KEY (audit_log_id);


--
-- Name: care_plan_items care_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_items
    ADD CONSTRAINT care_plan_items_pkey PRIMARY KEY (care_plan_item_id);


--
-- Name: care_plan_progress_notes care_plan_progress_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_progress_notes
    ADD CONSTRAINT care_plan_progress_notes_pkey PRIMARY KEY (progress_note_id);


--
-- Name: care_plans care_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_pkey PRIMARY KEY (care_plan_id);


--
-- Name: clinical_notes clinical_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_pkey PRIMARY KEY (note_id);


--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (facility_id);


--
-- Name: medication_administrations medication_administrations_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT medication_administrations_pkey PRIMARY KEY (administration_id);


--
-- Name: medication_orders medication_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_pkey PRIMARY KEY (order_id);


--
-- Name: monitoring_records monitoring_records_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.monitoring_records
    ADD CONSTRAINT monitoring_records_pkey PRIMARY KEY (monitoring_record_id);


--
-- Name: nursing_assessments nursing_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.nursing_assessments
    ADD CONSTRAINT nursing_assessments_pkey PRIMARY KEY (assessment_id);


--
-- Name: patient_incidents patient_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_incidents
    ADD CONSTRAINT patient_incidents_pkey PRIMARY KEY (incident_id);


--
-- Name: patient_session_data patient_session_data_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_session_data
    ADD CONSTRAINT patient_session_data_pkey PRIMARY KEY (session_id);


--
-- Name: patients patients_facility_id_mrn_key; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_facility_id_mrn_key UNIQUE (facility_id, mrn);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (patient_id);


--
-- Name: problem_templates problem_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.problem_templates
    ADD CONSTRAINT problem_templates_pkey PRIMARY KEY (template_id);


--
-- Name: staff staff_facility_id_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_facility_id_employee_number_key UNIQUE (facility_id, employee_number);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (staff_id);


--
-- Name: staff_sessions staff_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.staff_sessions
    ADD CONSTRAINT staff_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: staff staff_username_key; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_username_key UNIQUE (username);


--
-- Name: vital_signs vital_signs_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_pkey PRIMARY KEY (vital_sign_id);


--
-- Name: voice_categorization_log voice_categorization_log_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_categorization_log
    ADD CONSTRAINT voice_categorization_log_pkey PRIMARY KEY (log_id);


--
-- Name: voice_categorization_log voice_categorization_log_review_id_key; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_categorization_log
    ADD CONSTRAINT voice_categorization_log_review_id_key UNIQUE (review_id);


--
-- Name: voice_recordings voice_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_recordings
    ADD CONSTRAINT voice_recordings_pkey PRIMARY KEY (recording_id);


--
-- Name: voice_review_queue voice_review_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_review_queue
    ADD CONSTRAINT voice_review_queue_pkey PRIMARY KEY (review_id);


--
-- Name: voice_review_queue voice_review_queue_recording_id_key; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_review_queue
    ADD CONSTRAINT voice_review_queue_recording_id_key UNIQUE (recording_id);


--
-- Name: weekly_schedule_items weekly_schedule_items_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.weekly_schedule_items
    ADD CONSTRAINT weekly_schedule_items_pkey PRIMARY KEY (schedule_item_id);


--
-- Name: idx_auth_audit_event; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_auth_audit_event ON public.auth_audit_log USING btree (event_type);


--
-- Name: idx_auth_audit_staff; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_auth_audit_staff ON public.auth_audit_log USING btree (staff_id);


--
-- Name: idx_auth_audit_timestamp; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_auth_audit_timestamp ON public.auth_audit_log USING btree ("timestamp" DESC);


--
-- Name: idx_barthel_assessed_at; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_barthel_assessed_at ON public.barthel_assessments USING btree (assessed_at DESC);


--
-- Name: idx_barthel_category_scores; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_barthel_category_scores ON public.barthel_assessments USING gin (category_scores);


--
-- Name: idx_barthel_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_barthel_patient ON public.barthel_assessments USING btree (patient_id);


--
-- Name: idx_barthel_total_score; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_barthel_total_score ON public.barthel_assessments USING btree (total_score);


--
-- Name: idx_care_conferences_care_plan; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_care_conferences_care_plan ON public.care_conferences USING btree (care_plan_id);


--
-- Name: idx_care_plan_audit_log_care_plan; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_care_plan_audit_log_care_plan ON public.care_plan_audit_log USING btree (care_plan_id);


--
-- Name: idx_care_plan_items_care_plan; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_care_plan_items_care_plan ON public.care_plan_items USING btree (care_plan_id);


--
-- Name: idx_care_plan_progress_notes_item; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_care_plan_progress_notes_item ON public.care_plan_progress_notes USING btree (care_plan_item_id);


--
-- Name: idx_care_plans_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_care_plans_patient ON public.care_plans USING btree (patient_id);


--
-- Name: idx_care_plans_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_care_plans_status ON public.care_plans USING btree (status);


--
-- Name: idx_categorization_log_categories; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_categorization_log_categories ON public.voice_categorization_log USING gin (detected_categories);


--
-- Name: idx_categorization_log_confirmed_by; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_categorization_log_confirmed_by ON public.voice_categorization_log USING btree (confirmed_by);


--
-- Name: idx_categorization_log_created; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_categorization_log_created ON public.voice_categorization_log USING btree (created_at);


--
-- Name: idx_categorization_log_review; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_categorization_log_review ON public.voice_categorization_log USING btree (review_id);


--
-- Name: idx_clinical_notes_approval; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_approval ON public.clinical_notes USING btree (requires_approval, status) WHERE ((requires_approval = true) AND ((status)::text = 'submitted'::text));


--
-- Name: idx_clinical_notes_authored_by; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_authored_by ON public.clinical_notes USING btree (authored_by);


--
-- Name: idx_clinical_notes_datetime; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_datetime ON public.clinical_notes USING btree (note_datetime DESC);


--
-- Name: idx_clinical_notes_follow_up; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_follow_up ON public.clinical_notes USING btree (follow_up_required, follow_up_date) WHERE (follow_up_required = true);


--
-- Name: idx_clinical_notes_note_type; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_note_type ON public.clinical_notes USING btree (note_type);


--
-- Name: idx_clinical_notes_patient_datetime; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_patient_datetime ON public.clinical_notes USING btree (patient_id, note_datetime DESC);


--
-- Name: idx_clinical_notes_patient_id; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_patient_id ON public.clinical_notes USING btree (patient_id);


--
-- Name: idx_clinical_notes_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_clinical_notes_status ON public.clinical_notes USING btree (status);


--
-- Name: idx_incidents_occurred_at; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_incidents_occurred_at ON public.patient_incidents USING btree (occurred_at DESC);


--
-- Name: idx_incidents_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_incidents_patient ON public.patient_incidents USING btree (patient_id);


--
-- Name: idx_incidents_reviewed; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_incidents_reviewed ON public.patient_incidents USING btree (reviewed) WHERE (reviewed = false);


--
-- Name: idx_incidents_severity; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_incidents_severity ON public.patient_incidents USING btree (severity);


--
-- Name: idx_incidents_type; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_incidents_type ON public.patient_incidents USING btree (incident_type);


--
-- Name: idx_medication_administrations_datetime; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_medication_administrations_datetime ON public.medication_administrations USING btree (administered_datetime);


--
-- Name: idx_medication_administrations_hash; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_medication_administrations_hash ON public.medication_administrations USING btree (record_hash);


--
-- Name: idx_medication_administrations_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_medication_administrations_patient ON public.medication_administrations USING btree (patient_id);


--
-- Name: idx_medication_administrations_sequence; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_medication_administrations_sequence ON public.medication_administrations USING btree (chain_sequence);


--
-- Name: idx_medication_orders_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_medication_orders_patient ON public.medication_orders USING btree (patient_id);


--
-- Name: idx_medication_orders_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_medication_orders_status ON public.medication_orders USING btree (status);


--
-- Name: idx_monitoring_records_care_plan; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_monitoring_records_care_plan ON public.monitoring_records USING btree (care_plan_id);


--
-- Name: idx_nursing_assessments_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_nursing_assessments_patient ON public.nursing_assessments USING btree (patient_id);


--
-- Name: idx_patients_facility; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_patients_facility ON public.patients USING btree (facility_id);


--
-- Name: idx_patients_mrn; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_patients_mrn ON public.patients USING btree (mrn);


--
-- Name: idx_problem_templates_category; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_problem_templates_category ON public.problem_templates USING btree (category);


--
-- Name: idx_review_queue_created; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_review_queue_created ON public.voice_review_queue USING btree (created_at);


--
-- Name: idx_review_queue_extracted_data; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_review_queue_extracted_data ON public.voice_review_queue USING gin (extracted_data);


--
-- Name: idx_review_queue_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_review_queue_patient ON public.voice_review_queue USING btree (context_patient_id);


--
-- Name: idx_review_queue_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_review_queue_status ON public.voice_review_queue USING btree (status);


--
-- Name: idx_review_queue_user_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_review_queue_user_status ON public.voice_review_queue USING btree (user_id, status);


--
-- Name: idx_session_active; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_session_active ON public.patient_session_data USING btree (patient_id, session_started_at DESC) WHERE ((session_status)::text = 'active'::text);


--
-- Name: idx_session_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_session_patient ON public.patient_session_data USING btree (patient_id);


--
-- Name: idx_session_staff; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_session_staff ON public.patient_session_data USING btree (staff_id);


--
-- Name: idx_session_started_at; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_session_started_at ON public.patient_session_data USING btree (session_started_at DESC);


--
-- Name: idx_session_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_session_status ON public.patient_session_data USING btree (session_status);


--
-- Name: idx_staff_sessions_expires; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_staff_sessions_expires ON public.staff_sessions USING btree (expires_at);


--
-- Name: idx_staff_sessions_staff; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_staff_sessions_staff ON public.staff_sessions USING btree (staff_id);


--
-- Name: idx_staff_sessions_token; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_staff_sessions_token ON public.staff_sessions USING btree (access_token);


--
-- Name: idx_vital_signs_measured; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_vital_signs_measured ON public.vital_signs USING btree (measured_at);


--
-- Name: idx_vital_signs_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_vital_signs_patient ON public.vital_signs USING btree (patient_id);


--
-- Name: idx_voice_recordings_context; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_voice_recordings_context ON public.voice_recordings USING btree (context_type, context_patient_id);


--
-- Name: idx_voice_recordings_context_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_voice_recordings_context_patient ON public.voice_recordings USING btree (context_patient_id);


--
-- Name: idx_voice_recordings_extraction_en; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_voice_recordings_extraction_en ON public.voice_recordings USING gin (((ai_structured_extraction -> 'en'::text)));


--
-- Name: idx_voice_recordings_extraction_ja; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_voice_recordings_extraction_ja ON public.voice_recordings USING gin (((ai_structured_extraction -> 'ja'::text)));


--
-- Name: idx_voice_recordings_patient; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_voice_recordings_patient ON public.voice_recordings USING btree (patient_id);


--
-- Name: idx_voice_recordings_processing_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_voice_recordings_processing_status ON public.voice_recordings USING btree (processing_status);


--
-- Name: idx_voice_recordings_review_status; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_voice_recordings_review_status ON public.voice_recordings USING btree (review_status);


--
-- Name: idx_weekly_schedule_items_care_plan; Type: INDEX; Schema: public; Owner: nagare
--

CREATE INDEX idx_weekly_schedule_items_care_plan ON public.weekly_schedule_items USING btree (care_plan_id);


--
-- Name: barthel_assessments barthel_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: nagare
--

CREATE TRIGGER barthel_updated_at_trigger BEFORE UPDATE ON public.barthel_assessments FOR EACH ROW EXECUTE FUNCTION public.update_barthel_updated_at();


--
-- Name: patient_incidents incident_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: nagare
--

CREATE TRIGGER incident_updated_at_trigger BEFORE UPDATE ON public.patient_incidents FOR EACH ROW EXECUTE FUNCTION public.update_incident_updated_at();


--
-- Name: patient_session_data session_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: nagare
--

CREATE TRIGGER session_updated_at_trigger BEFORE UPDATE ON public.patient_session_data FOR EACH ROW EXECUTE FUNCTION public.update_session_updated_at();


--
-- Name: clinical_notes trigger_clinical_notes_updated_at; Type: TRIGGER; Schema: public; Owner: nagare
--

CREATE TRIGGER trigger_clinical_notes_updated_at BEFORE UPDATE ON public.clinical_notes FOR EACH ROW EXECUTE FUNCTION public.update_clinical_notes_updated_at();


--
-- Name: auth_audit_log auth_audit_log_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.auth_audit_log
    ADD CONSTRAINT auth_audit_log_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(staff_id);


--
-- Name: barthel_assessments barthel_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.barthel_assessments
    ADD CONSTRAINT barthel_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.staff(staff_id);


--
-- Name: barthel_assessments barthel_assessments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.barthel_assessments
    ADD CONSTRAINT barthel_assessments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: barthel_assessments barthel_assessments_voice_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.barthel_assessments
    ADD CONSTRAINT barthel_assessments_voice_recording_id_fkey FOREIGN KEY (voice_recording_id) REFERENCES public.voice_recordings(recording_id);


--
-- Name: care_conferences care_conferences_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_conferences
    ADD CONSTRAINT care_conferences_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id) ON DELETE CASCADE;


--
-- Name: care_plan_audit_log care_plan_audit_log_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_audit_log
    ADD CONSTRAINT care_plan_audit_log_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id) ON DELETE CASCADE;


--
-- Name: care_plan_audit_log care_plan_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_audit_log
    ADD CONSTRAINT care_plan_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.staff(staff_id);


--
-- Name: care_plan_items care_plan_items_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_items
    ADD CONSTRAINT care_plan_items_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id) ON DELETE CASCADE;


--
-- Name: care_plan_items care_plan_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_items
    ADD CONSTRAINT care_plan_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff(staff_id);


--
-- Name: care_plan_progress_notes care_plan_progress_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_progress_notes
    ADD CONSTRAINT care_plan_progress_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.staff(staff_id);


--
-- Name: care_plan_progress_notes care_plan_progress_notes_care_plan_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plan_progress_notes
    ADD CONSTRAINT care_plan_progress_notes_care_plan_item_id_fkey FOREIGN KEY (care_plan_item_id) REFERENCES public.care_plan_items(care_plan_item_id) ON DELETE CASCADE;


--
-- Name: care_plans care_plans_care_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_care_manager_id_fkey FOREIGN KEY (care_manager_id) REFERENCES public.staff(staff_id);


--
-- Name: care_plans care_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(staff_id);


--
-- Name: care_plans care_plans_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.care_plans
    ADD CONSTRAINT care_plans_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: clinical_notes clinical_notes_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(staff_id);


--
-- Name: clinical_notes clinical_notes_authored_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_authored_by_fkey FOREIGN KEY (authored_by) REFERENCES public.staff(staff_id);


--
-- Name: clinical_notes clinical_notes_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.staff(staff_id);


--
-- Name: clinical_notes clinical_notes_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: clinical_notes clinical_notes_related_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_related_assessment_id_fkey FOREIGN KEY (related_assessment_id) REFERENCES public.nursing_assessments(assessment_id) ON DELETE SET NULL;


--
-- Name: clinical_notes clinical_notes_related_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_related_session_id_fkey FOREIGN KEY (related_session_id) REFERENCES public.patient_session_data(session_id) ON DELETE SET NULL;


--
-- Name: clinical_notes clinical_notes_voice_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT clinical_notes_voice_recording_id_fkey FOREIGN KEY (voice_recording_id) REFERENCES public.voice_recordings(recording_id) ON DELETE SET NULL;


--
-- Name: nursing_assessments fk_voice_recording; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.nursing_assessments
    ADD CONSTRAINT fk_voice_recording FOREIGN KEY (voice_recording_id) REFERENCES public.voice_recordings(recording_id);


--
-- Name: medication_administrations medication_administrations_administered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT medication_administrations_administered_by_fkey FOREIGN KEY (administered_by) REFERENCES public.staff(staff_id);


--
-- Name: medication_administrations medication_administrations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT medication_administrations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.medication_orders(order_id);


--
-- Name: medication_administrations medication_administrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT medication_administrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: medication_orders medication_orders_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.staff(staff_id);


--
-- Name: medication_orders medication_orders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: monitoring_records monitoring_records_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.monitoring_records
    ADD CONSTRAINT monitoring_records_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id) ON DELETE CASCADE;


--
-- Name: monitoring_records monitoring_records_conducted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.monitoring_records
    ADD CONSTRAINT monitoring_records_conducted_by_fkey FOREIGN KEY (conducted_by) REFERENCES public.staff(staff_id);


--
-- Name: nursing_assessments nursing_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.nursing_assessments
    ADD CONSTRAINT nursing_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.staff(staff_id);


--
-- Name: nursing_assessments nursing_assessments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.nursing_assessments
    ADD CONSTRAINT nursing_assessments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patient_incidents patient_incidents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_incidents
    ADD CONSTRAINT patient_incidents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: patient_incidents patient_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_incidents
    ADD CONSTRAINT patient_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.staff(staff_id);


--
-- Name: patient_incidents patient_incidents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_incidents
    ADD CONSTRAINT patient_incidents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.staff(staff_id);


--
-- Name: patient_incidents patient_incidents_voice_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_incidents
    ADD CONSTRAINT patient_incidents_voice_recording_id_fkey FOREIGN KEY (voice_recording_id) REFERENCES public.voice_recordings(recording_id);


--
-- Name: patient_session_data patient_session_data_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_session_data
    ADD CONSTRAINT patient_session_data_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: patient_session_data patient_session_data_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patient_session_data
    ADD CONSTRAINT patient_session_data_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(staff_id);


--
-- Name: patients patients_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id);


--
-- Name: staff staff_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id);


--
-- Name: staff_sessions staff_sessions_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.staff_sessions
    ADD CONSTRAINT staff_sessions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(staff_id) ON DELETE CASCADE;


--
-- Name: vital_signs vital_signs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: vital_signs vital_signs_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.staff(staff_id);


--
-- Name: voice_categorization_log voice_categorization_log_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_categorization_log
    ADD CONSTRAINT voice_categorization_log_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.staff(staff_id) ON DELETE SET NULL;


--
-- Name: voice_categorization_log voice_categorization_log_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_categorization_log
    ADD CONSTRAINT voice_categorization_log_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.voice_review_queue(review_id) ON DELETE CASCADE;


--
-- Name: voice_recordings voice_recordings_context_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_recordings
    ADD CONSTRAINT voice_recordings_context_patient_id_fkey FOREIGN KEY (context_patient_id) REFERENCES public.patients(patient_id) ON DELETE SET NULL;


--
-- Name: voice_recordings voice_recordings_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_recordings
    ADD CONSTRAINT voice_recordings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: voice_recordings voice_recordings_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_recordings
    ADD CONSTRAINT voice_recordings_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.staff(staff_id);


--
-- Name: voice_review_queue voice_review_queue_context_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_review_queue
    ADD CONSTRAINT voice_review_queue_context_patient_id_fkey FOREIGN KEY (context_patient_id) REFERENCES public.patients(patient_id) ON DELETE SET NULL;


--
-- Name: voice_review_queue voice_review_queue_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_review_queue
    ADD CONSTRAINT voice_review_queue_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.voice_recordings(recording_id) ON DELETE CASCADE;


--
-- Name: voice_review_queue voice_review_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_review_queue
    ADD CONSTRAINT voice_review_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.staff(staff_id) ON DELETE CASCADE;


--
-- Name: weekly_schedule_items weekly_schedule_items_care_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.weekly_schedule_items
    ADD CONSTRAINT weekly_schedule_items_care_plan_id_fkey FOREIGN KEY (care_plan_id) REFERENCES public.care_plans(care_plan_id) ON DELETE CASCADE;


--
-- Name: weekly_schedule_items weekly_schedule_items_linked_to_care_plan_item_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.weekly_schedule_items
    ADD CONSTRAINT weekly_schedule_items_linked_to_care_plan_item_fkey FOREIGN KEY (linked_to_care_plan_item) REFERENCES public.care_plan_items(care_plan_item_id);


--
-- PostgreSQL database dump complete
--

\unrestrict n011UFjEhVwRBqKdlI8Kc1Qs6ttGx8Ucetpd2gzTn09yNeQbD9xl82vUvyVXBiw

