--
-- PostgreSQL database dump
--

\restrict fKBn516NFkSNcGLsqImDiKjjaShFGleE7GPCF4GcOvJpNSViIxdSP9ChqErIHeX

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

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
-- Name: ensure_audit_user_name(); Type: FUNCTION; Schema: public; Owner: nagare
--

CREATE FUNCTION public.ensure_audit_user_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If user_name is NULL or empty, fetch from staff table
  IF NEW.user_name IS NULL OR trim(NEW.user_name) = '' THEN
    SELECT CONCAT(family_name, ' ', given_name) INTO NEW.user_name
    FROM staff
    WHERE staff_id = NEW.user_id;
    
    -- If still NULL (user not found), use placeholder
    IF NEW.user_name IS NULL OR trim(NEW.user_name) = '' THEN
      RAISE WARNING 'User name not found for user_id: %. Using placeholder.', NEW.user_id;
      NEW.user_name := 'Unknown User (' || NEW.user_id || ')';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_audit_user_name() OWNER TO nagare;

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
    CONSTRAINT auth_audit_log_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['login'::character varying, 'logout'::character varying, 'failed_login'::character varying, 'token_refresh'::character varying, 'password_change'::character varying, 'password_reset'::character varying])::text[])))
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
    CONSTRAINT barthel_assessments_input_method_check CHECK (((input_method)::text = ANY ((ARRAY['voice'::character varying, 'form'::character varying, 'mixed'::character varying])::text[]))),
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
    version integer NOT NULL,
    CONSTRAINT user_name_not_empty CHECK ((((user_name)::text <> ''::text) AND (length(TRIM(BOTH FROM user_name)) > 0)))
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
    CONSTRAINT care_plans_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'draft'::character varying, 'archived'::character varying])::text[])))
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
    CONSTRAINT clinical_notes_note_category_check CHECK (((note_category)::text = ANY ((ARRAY['symptom_observation'::character varying, 'treatment'::character varying, 'consultation'::character varying, 'fall_incident'::character varying, 'medication'::character varying, 'vital_signs'::character varying, 'behavioral'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT clinical_notes_note_type_check CHECK (((note_type)::text = ANY ((ARRAY['nurse_note'::character varying, 'doctor_note'::character varying, 'care_note'::character varying])::text[]))),
    CONSTRAINT clinical_notes_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
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
    CONSTRAINT medication_administrations_status_check CHECK (((status)::text = ANY ((ARRAY['administered'::character varying, 'refused'::character varying, 'held'::character varying, 'omitted'::character varying])::text[])))
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
    CONSTRAINT medication_orders_route_check CHECK (((route)::text = ANY ((ARRAY['oral'::character varying, 'iv'::character varying, 'im'::character varying, 'sc'::character varying, 'topical'::character varying, 'inhalation'::character varying, 'rectal'::character varying, 'sublingual'::character varying])::text[]))),
    CONSTRAINT medication_orders_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'discontinued'::character varying, 'on_hold'::character varying])::text[])))
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
    CONSTRAINT nursing_assessments_input_method_check CHECK (((input_method)::text = ANY ((ARRAY['voice'::character varying, 'form'::character varying, 'mixed'::character varying])::text[])))
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
    CONSTRAINT patient_incidents_incident_type_check CHECK (((incident_type)::text = ANY ((ARRAY['fall'::character varying, 'medication-error'::character varying, 'behavioral'::character varying, 'injury'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT patient_incidents_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
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
    CONSTRAINT patient_session_data_session_status_check CHECK (((session_status)::text = ANY ((ARRAY['active'::character varying, 'submitted'::character varying, 'abandoned'::character varying])::text[])))
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
    date_of_birth date NOT NULL,
    gender character varying(20) NOT NULL,
    room character varying(20),
    bed character varying(10),
    blood_type character varying(10),
    admission_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    family_name_en character varying(100),
    given_name_en character varying(100),
    height_cm numeric(5,2),
    weight_kg numeric(5,2),
    allergies text[],
    medications_summary text,
    key_notes text,
    risk_factors text[],
    status character varying(20),
    CONSTRAINT patients_status_check CHECK (((status)::text = ANY ((ARRAY['green'::character varying, 'yellow'::character varying, 'red'::character varying])::text[])))
);


ALTER TABLE public.patients OWNER TO nagare;

--
-- Name: COLUMN patients.family_name_en; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.family_name_en IS 'Romanized or English version of family name';


--
-- Name: COLUMN patients.given_name_en; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.given_name_en IS 'Romanized or English version of given name';


--
-- Name: COLUMN patients.height_cm; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.height_cm IS 'Patient height in centimeters';


--
-- Name: COLUMN patients.weight_kg; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.weight_kg IS 'Patient weight in kilograms';


--
-- Name: COLUMN patients.allergies; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.allergies IS 'Array of patient allergies';


--
-- Name: COLUMN patients.medications_summary; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.medications_summary IS 'Summary of current medications';


--
-- Name: COLUMN patients.key_notes; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.key_notes IS 'Important clinical notes';


--
-- Name: COLUMN patients.risk_factors; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.risk_factors IS 'Array of risk factors';


--
-- Name: COLUMN patients.status; Type: COMMENT; Schema: public; Owner: nagare
--

COMMENT ON COLUMN public.patients.status IS 'Patient status indicator: green (stable), yellow (caution), red (critical)';


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
    CONSTRAINT staff_role_check CHECK (((role)::text = ANY ((ARRAY['physician'::character varying, 'registered_nurse'::character varying, 'pharmacist'::character varying, 'nurse_assistant'::character varying])::text[])))
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
    CONSTRAINT vital_signs_input_method_check CHECK (((input_method)::text = ANY ((ARRAY['iot_sensor'::character varying, 'manual'::character varying, 'voice'::character varying])::text[]))),
    CONSTRAINT vital_signs_pain_score_check CHECK (((pain_score >= 0) AND (pain_score <= 10)))
);


ALTER TABLE public.vital_signs OWNER TO nagare;

--
-- Name: voice_recordings; Type: TABLE; Schema: public; Owner: nagare
--

CREATE TABLE public.voice_recordings (
    recording_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.voice_recordings OWNER TO nagare;

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
622b05df-33b2-4e13-9aaf-c69afd511819	550e8400-e29b-41d4-a716-446655440101	nurse1	failed_login	::ffff:172.18.0.4	{"platform": "ios", "appVersion": "1.0.0"}	f	invalid_password	2025-11-26 05:42:17.232073
adaf3306-a541-477a-b7a1-7725894a6a6b	550e8400-e29b-41d4-a716-446655440101	nurse1	failed_login	::ffff:172.18.0.4	{"platform": "ios", "appVersion": "1.0.0"}	f	invalid_password	2025-11-26 05:45:58.868042
8f12a861-8c35-4ada-9f6e-709e4662db8b	550e8400-e29b-41d4-a716-446655440101	nurse1	failed_login	::ffff:172.18.0.4	{"platform": "ios", "appVersion": "1.0.0"}	f	invalid_password	2025-11-26 05:52:48.933596
ff48cde4-8ff1-446c-82d3-94a31b8c22ee	550e8400-e29b-41d4-a716-446655440101	nurse1	login	::ffff:172.18.0.4	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-11-26 05:55:19.139666
31e4cd4b-0c73-4638-af1c-eacef9280363	550e8400-e29b-41d4-a716-446655440101	\N	logout	\N	\N	t	\N	2025-11-26 05:55:33.54938
721bd22e-6516-46ec-97aa-78e15392a2f3	550e8400-e29b-41d4-a716-446655440103	doctor1	login	::ffff:172.18.0.4	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-11-26 05:55:44.088949
c6507ab5-3e7f-4163-84d4-8f96faf3bc39	550e8400-e29b-41d4-a716-446655440101	nurse1	login	::ffff:172.18.0.4	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-11-26 06:01:52.355957
ecc602d8-e222-492e-b27c-9d919693d93e	550e8400-e29b-41d4-a716-446655440101	nurse1	login	::ffff:172.18.0.4	{"platform": "ios", "appVersion": "1.0.0"}	t	\N	2025-11-26 06:32:44.901411
\.


--
-- Data for Name: barthel_assessments; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.barthel_assessments (assessment_id, patient_id, assessed_at, total_score, category_scores, additional_notes, voice_recording_id, assessed_by, input_method, created_at, updated_at) FROM stdin;
7ba1bc0d-0b07-4a84-9ed2-5341c9d84fb7	550e8400-e29b-41d4-a716-446655440201	2025-10-05 00:00:00	65	{"bowel": 5, "eating": 10, "stairs": 5, "bathing": 0, "bladder": 5, "walking": 10, "dressing": 10, "grooming": 5, "transfer": 10, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-06 07:20:17.955278	2025-10-06 07:20:17.955278
bd0e2396-1b13-41ae-ad55-3a0d9f93512a	550e8400-e29b-41d4-a716-446655440202	2025-10-04 00:00:00	75	{"bowel": 5, "eating": 10, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 10, "dressing": 10, "grooming": 5, "transfer": 10, "toileting": 10}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-06 07:20:57.294989	2025-10-06 07:20:57.294989
ba460aca-04a4-4a18-8727-2aceffaaf720	550e8400-e29b-41d4-a716-446655440203	2025-10-03 00:00:00	15	{"bowel": 0, "eating": 5, "stairs": 0, "bathing": 0, "bladder": 5, "walking": 0, "dressing": 5, "grooming": 0, "transfer": 0, "toileting": 0}	\N	\N	550e8400-e29b-41d4-a716-446655440102	form	2025-10-06 07:20:57.302143	2025-10-06 07:20:57.302143
604f9113-b39d-484b-b87e-981154b18ccc	550e8400-e29b-41d4-a716-446655440204	2025-10-05 00:00:00	85	{"bowel": 10, "eating": 10, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 10, "dressing": 10, "grooming": 5, "transfer": 15, "toileting": 10}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-06 07:20:57.303252	2025-10-06 07:20:57.303252
4551a7c9-3603-4928-a5e3-e577fab33600	550e8400-e29b-41d4-a716-446655440205	2025-10-04 00:00:00	45	{"bowel": 10, "eating": 5, "stairs": 0, "bathing": 0, "bladder": 5, "walking": 5, "dressing": 5, "grooming": 5, "transfer": 5, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440102	form	2025-10-06 07:20:57.304397	2025-10-06 07:20:57.304397
a5154375-2d32-4579-94f5-c455eaad1766	550e8400-e29b-41d4-a716-446655440201	2025-10-10 02:11:01.909544	60	{"bowel": 5, "eating": 5, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-10 02:11:01.909544	2025-10-10 02:11:01.909544
1421aa58-484c-4245-a186-922cd0ad91ef	550e8400-e29b-41d4-a716-446655440201	2025-10-10 09:22:46.210596	60	{"bowel": 5, "eating": 5, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-10 09:22:46.210596	2025-10-10 09:22:46.210596
d7eaa0d4-c379-45ba-8025-540b8cf3d35f	550e8400-e29b-41d4-a716-446655440201	2025-10-10 09:48:55.321492	85	{"bowel": 10, "eating": 10, "stairs": 10, "bathing": 5, "bladder": 10, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 10}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-10 09:48:55.321492	2025-10-10 09:48:55.321492
ceeaaec6-e3cf-4900-bcf4-760133ccf4f4	550e8400-e29b-41d4-a716-446655440201	2025-10-10 09:49:02.90807	85	{"bowel": 10, "eating": 10, "stairs": 10, "bathing": 5, "bladder": 10, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 10}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-10 09:49:02.90807	2025-10-10 09:49:02.90807
0c86ae92-1654-43da-8040-b1352f0fd9af	550e8400-e29b-41d4-a716-446655440201	2025-10-17 00:11:57.521451	75	{"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 00:11:57.521451	2025-10-17 00:11:57.521451
b198cb5d-65ac-4f3f-87a7-69682a116c7c	550e8400-e29b-41d4-a716-446655440201	2025-10-17 01:01:04.938936	75	{"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 01:01:04.938936	2025-10-17 01:01:04.938936
246c12c4-0b4a-410c-881d-78c93e83bbcd	550e8400-e29b-41d4-a716-446655440201	2025-10-17 01:01:48.220816	75	{"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 01:01:48.220816	2025-10-17 01:01:48.220816
fa7f960c-d7e6-42bb-a266-4cdd7be9ae12	550e8400-e29b-41d4-a716-446655440201	2025-10-17 01:20:21.268059	75	{"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 01:20:21.268059	2025-10-17 01:20:21.268059
8372eeac-0b46-463d-ab77-00a9d0ce127e	550e8400-e29b-41d4-a716-446655440201	2025-10-17 01:56:24.907992	75	{"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 01:56:24.907992	2025-10-17 01:56:24.907992
e14f81d0-4774-46a5-8749-d0b7628be48b	550e8400-e29b-41d4-a716-446655440201	2025-10-17 02:13:19.273037	75	{"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 02:13:19.273037	2025-10-17 02:13:19.273037
976258be-4fb0-46a1-8b1c-61aaf955732e	550e8400-e29b-41d4-a716-446655440201	2025-10-17 02:38:43.546056	75	{"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 02:38:43.546056	2025-10-17 02:38:43.546056
ebcd4fe0-bb09-4d92-b3b3-15c0c0655263	550e8400-e29b-41d4-a716-446655440201	2025-10-17 08:52:14.058858	35	{"bowel": 0, "stairs": 0, "bathing": 5, "bladder": 0, "walking": 10, "dressing": 5, "grooming": 0, "transfer": 15, "toileting": 0}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 08:52:14.058858	2025-10-17 08:52:14.058858
567e5097-0f6f-4cdc-af54-98aea0af4d91	550e8400-e29b-41d4-a716-446655440201	2025-10-17 15:03:31.365216	35	{"bowel": 0, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 5, "dressing": 5, "grooming": 5, "transfer": 5, "toileting": 0}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 15:03:31.365216	2025-10-17 15:03:31.365216
60f87d32-17dd-401e-a2e2-9cc31a195fb4	550e8400-e29b-41d4-a716-446655440201	2025-10-17 16:01:33.288669	35	{"bowel": 0, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 5, "dressing": 5, "grooming": 5, "transfer": 5, "toileting": 0}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 16:01:33.288669	2025-10-17 16:01:33.288669
dd4b2eb2-57d9-4db4-bb0d-653328a323bd	550e8400-e29b-41d4-a716-446655440201	2025-10-17 16:06:20.523159	35	{"bowel": 0, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 5, "dressing": 5, "grooming": 5, "transfer": 5, "toileting": 0}	\N	\N	550e8400-e29b-41d4-a716-446655440101	form	2025-10-17 16:06:20.523159	2025-10-17 16:06:20.523159
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
47147ed6-6305-4991-9e65-b10dbe98a989	c5e0dd1b-427a-4b9f-a270-8fff7e72f210	2025-10-21 07:54:20.728503	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
73d1aa32-37b1-4a45-a9fd-b24a06582751	6bce0e69-974e-4125-bf62-4adc9a708e69	2025-10-21 08:17:51.291545	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
35817602-9a99-4db6-bbb6-ced5d19fc0c1	31c45f78-2e09-4dc7-9d2b-283706d3d591	2025-10-21 08:19:26.176867	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
5101d59e-47d4-449a-9c08-1b4f66d049b0	fc6913db-b49e-4e6f-8ba9-d2c072cf9b77	2025-10-21 08:21:27.930947	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
27659fd4-c697-4f46-a53f-0318894db8a6	0cbd278b-1f5f-4cef-9671-30853310dd17	2025-10-21 08:22:11.383646	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
6fa818e0-0cef-44c3-8166-296d37db312e	89f6d6d4-2f8b-4176-92e4-d1ffb9b11d78	2025-10-21 08:24:55.743956	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
89a118a6-bb6b-4eed-8012-865186bc50b3	89f6d6d4-2f8b-4176-92e4-d1ffb9b11d78	2025-10-21 08:36:05.305475	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	item_added	{"itemId": "66d91121-8ec3-4556-b16e-89378bf97252", "problem": {"status": "active", "category": "ADL", "priority": "medium", "description": "トイレ動作の自立困難", "identifiedDate": "2025-10-21T08:36:05.136Z"}}	1
87adaa65-de8d-476f-a319-eb50a06e4f7b	6fc5c17b-26cc-4091-9f5f-4f042affda6f	2025-10-23 01:56:18.658016	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
a6453f36-82cc-4158-b497-7a5a43b98230	6fc5c17b-26cc-4091-9f5f-4f042affda6f	2025-10-23 01:56:30.429731	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	item_added	{"itemId": "9e7130bb-5c8b-450c-b3ef-2990ae23ed27", "problem": {"status": "active", "category": "nutrition", "priority": "medium", "description": "食事摂取量の低下", "identifiedDate": "2025-10-23T01:56:30.099Z"}}	1
d15b86c2-e423-4edc-a672-20918dcd7886	073ebd00-88f3-4df0-bee1-2e3261a0a64f	2025-10-23 02:00:24.431013	550e8400-e29b-41d4-a716-446655440101	佐藤 美咲	created	\N	1
\.


--
-- Data for Name: care_plan_items; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.care_plan_items (care_plan_item_id, care_plan_id, problem_category, problem_description, problem_priority, identified_date, problem_status, long_term_goal_description, long_term_goal_target_date, long_term_goal_duration, long_term_goal_achievement_status, short_term_goal_description, short_term_goal_target_date, short_term_goal_duration, short_term_goal_achievement_status, short_term_goal_measurable_criteria, interventions, linked_assessments, last_updated, updated_by, created_at) FROM stdin;
66d91121-8ec3-4556-b16e-89378bf97252	89f6d6d4-2f8b-4176-92e4-d1ffb9b11d78	ADL	トイレ動作の自立困難	medium	2025-10-21 08:36:05.136	active	日中、見守りのみでトイレ動作ができる	2026-04-21 08:36:05.136	6_months	0	手すりを使用してトイレまで歩行できる	2026-01-21 08:36:05.136	3_months	0	3	[{"id": "int-obs-1761035765136", "type": "observation", "createdBy": "current-user", "createdDate": "2025-10-21T08:36:05.136Z", "carePlanItemId": "cpi-1761035765136", "observationPlan": {"frequency": "daily", "whatToMonitor": ["トイレ動作時の様子、転倒リスクを毎回観察"], "responsibleRole": "nurse"}}, {"id": "int-care-1761035765136", "type": "care", "carePlan": {"duration": "15分", "provider": "介護職員", "equipment": [], "frequency": "毎日", "serviceType": "ケア", "responsibleRole": "care_worker", "specificActions": ["歩行器使用指導、手すり活用支援"]}, "createdBy": "current-user", "createdDate": "2025-10-21T08:36:05.136Z", "carePlanItemId": "cpi-1761035765136"}, {"id": "int-edu-1761035765136", "type": "education", "createdBy": "current-user", "createdDate": "2025-10-21T08:36:05.136Z", "educationPlan": {"methods": ["口頭指導"], "materials": [], "educationGoals": ["安全なトイレ動作の指導"], "targetAudience": "both"}, "carePlanItemId": "cpi-1761035765136"}]	{}	2025-10-21 08:36:05.301177	550e8400-e29b-41d4-a716-446655440101	2025-10-21 08:36:05.301177
9e7130bb-5c8b-450c-b3ef-2990ae23ed27	6fc5c17b-26cc-4091-9f5f-4f042affda6f	nutrition	食事摂取量の低下	medium	2025-10-23 01:56:30.099	active	適正体重を維持する（BMI 18.5-25）	2026-04-23 01:56:30.099	6_months	0	1日3食、50%以上の摂取ができる	2026-01-23 01:56:30.099	3_months	0	A	[{"id": "int-obs-1761184590099", "type": "observation", "createdBy": "current-user", "createdDate": "2025-10-23T01:56:30.099Z", "carePlanItemId": "cpi-1761184590099", "observationPlan": {"frequency": "daily", "whatToMonitor": ["食事摂取量、体重変化の記録"], "responsibleRole": "nurse"}}, {"id": "int-care-1761184590099", "type": "care", "carePlan": {"duration": "15分", "provider": "介護職員", "equipment": [], "frequency": "毎日", "serviceType": "ケア", "responsibleRole": "care_worker", "specificActions": ["食事形態の工夫、間食の提供"]}, "createdBy": "current-user", "createdDate": "2025-10-23T01:56:30.099Z", "carePlanItemId": "cpi-1761184590099"}, {"id": "int-edu-1761184590099", "type": "education", "createdBy": "current-user", "createdDate": "2025-10-23T01:56:30.099Z", "educationPlan": {"methods": ["口頭指導"], "materials": [], "educationGoals": ["栄養の重要性について指導"], "targetAudience": "both"}, "carePlanItemId": "cpi-1761184590099"}]	{}	2025-10-23 01:56:30.426203	550e8400-e29b-41d4-a716-446655440101	2025-10-23 01:56:30.426203
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
c5e0dd1b-427a-4b9f-a270-8fff7e72f210	550e8400-e29b-41d4-a716-446655440201	要介護3	active	1	2025-10-21 07:54:20.720338	\N	2026-04-21 07:54:20.284	550e8400-e29b-41d4-a716-446655440101	何をわからない	なんで	分からない	550e8400-e29b-41d4-a716-446655440101	[{"name": "田中 ケアマネジャー", "role": "care_manager", "userId": "550e8400-e29b-41d4-a716-446655440101", "assigned": true}]	\N	\N	2026-01-21 07:54:20.71	2025-10-21 07:54:20.720338	2025-10-21 07:54:20.720338
6bce0e69-974e-4125-bf62-4adc9a708e69	550e8400-e29b-41d4-a716-446655440201	要介護3	active	1	2025-10-21 08:17:51.285652	\N	2026-04-21 08:17:51.065	550e8400-e29b-41d4-a716-446655440101	A	B	A	550e8400-e29b-41d4-a716-446655440101	[{"name": "田中 ケアマネジャー", "role": "care_manager", "userId": "550e8400-e29b-41d4-a716-446655440101", "assigned": true}]	\N	\N	2026-01-21 08:17:51.285	2025-10-21 08:17:51.285652	2025-10-21 08:17:51.285652
31c45f78-2e09-4dc7-9d2b-283706d3d591	550e8400-e29b-41d4-a716-446655440201	要介護3	active	1	2025-10-21 08:19:26.169335	\N	2026-04-21 08:00:00	550e8400-e29b-41d4-a716-446655440101	test	test	test	550e8400-e29b-41d4-a716-446655440101	[]	\N	\N	2026-01-21 08:19:26.16	2025-10-21 08:19:26.169335	2025-10-21 08:19:26.169335
fc6913db-b49e-4e6f-8ba9-d2c072cf9b77	550e8400-e29b-41d4-a716-446655440201	要介護3	active	1	2025-10-21 08:21:27.923192	\N	2026-04-21 08:00:00	550e8400-e29b-41d4-a716-446655440101	test3	test3	test3	550e8400-e29b-41d4-a716-446655440101	[]	\N	\N	2026-01-21 08:21:27.912	2025-10-21 08:21:27.923192	2025-10-21 08:21:27.923192
0cbd278b-1f5f-4cef-9671-30853310dd17	550e8400-e29b-41d4-a716-446655440201	要介護3	active	1	2025-10-21 08:22:11.380596	\N	2026-04-21 08:22:11.001	550e8400-e29b-41d4-a716-446655440101	A	Aa	A	550e8400-e29b-41d4-a716-446655440101	[{"name": "田中 ケアマネジャー", "role": "care_manager", "userId": "550e8400-e29b-41d4-a716-446655440101", "assigned": true}]	\N	\N	2026-01-21 08:22:11.38	2025-10-21 08:22:11.380596	2025-10-21 08:22:11.380596
89f6d6d4-2f8b-4176-92e4-d1ffb9b11d78	550e8400-e29b-41d4-a716-446655440201	要介護3	active	1	2025-10-21 08:24:55.737544	\N	2026-04-21 08:24:55.464	550e8400-e29b-41d4-a716-446655440101	1	2	3	550e8400-e29b-41d4-a716-446655440101	[{"name": "田中 ケアマネジャー", "role": "care_manager", "userId": "550e8400-e29b-41d4-a716-446655440101", "assigned": true}]	\N	\N	2026-01-21 08:24:55.737	2025-10-21 08:24:55.737544	2025-10-21 08:24:55.737544
6fc5c17b-26cc-4091-9f5f-4f042affda6f	550e8400-e29b-41d4-a716-446655440202	要支援1	active	1	2025-10-23 01:56:18.652941	\N	2026-04-23 01:56:18.39	550e8400-e29b-41d4-a716-446655440101	A	Bb	A	550e8400-e29b-41d4-a716-446655440101	[{"name": "田中 ケアマネジャー", "role": "care_manager", "userId": "550e8400-e29b-41d4-a716-446655440101", "assigned": true}]	\N	\N	2026-01-23 01:56:18.652	2025-10-23 01:56:18.652941	2025-10-23 01:56:18.652941
073ebd00-88f3-4df0-bee1-2e3261a0a64f	550e8400-e29b-41d4-a716-446655440203	要支援2	active	1	2025-10-23 02:00:24.424362	\N	2026-04-23 02:00:24.105	550e8400-e29b-41d4-a716-446655440101	Blah\t	Bl	A	550e8400-e29b-41d4-a716-446655440101	[{"name": "田中 ケアマネジャー", "role": "care_manager", "userId": "550e8400-e29b-41d4-a716-446655440101", "assigned": true}]	\N	\N	2026-01-23 02:00:24.423	2025-10-23 02:00:24.424362	2025-10-23 02:00:24.424362
\.


--
-- Data for Name: clinical_notes; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.clinical_notes (note_id, patient_id, note_type, note_category, note_datetime, note_text, voice_recording_id, voice_transcribed, authored_by, author_role, author_name, follow_up_required, follow_up_date, follow_up_notes, related_assessment_id, related_session_id, status, requires_approval, approved_by, approved_by_name, approval_datetime, approval_notes, created_at, updated_at, deleted_at, deleted_by) FROM stdin;
11029fd3-a33e-45d7-9866-7c7c80e41214	550e8400-e29b-41d4-a716-446655440201	nurse_note	symptom_observation	2025-11-26 05:06:11.857+00	あからない	\N	f	550e8400-e29b-41d4-a716-446655440101	nurse	佐藤 恵子	f	\N	\N	\N	\N	submitted	f	\N	\N	\N	\N	2025-11-26 05:06:11.858317+00	2025-11-26 05:06:11.858317+00	\N	\N
70af3e56-eb55-464e-bdda-f4ac69736e16	550e8400-e29b-41d4-a716-446655440201	nurse_note	medication	2025-11-26 06:28:55.167+00	Blah blah	\N	f	550e8400-e29b-41d4-a716-446655440101	nurse	佐藤 美咲	f	\N	\N	\N	\N	submitted	f	\N	\N	\N	\N	2025-11-26 06:28:55.168257+00	2025-11-26 06:28:55.168257+00	\N	\N
\.


--
-- Data for Name: facilities; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.facilities (facility_id, facility_name, facility_name_ja, facility_name_zh, timezone, language, created_at) FROM stdin;
550e8400-e29b-41d4-a716-446655440001	Nagoya General Hospital	名古屋総合病院	名古屋綜合醫院	Asia/Tokyo	ja	2025-10-20 06:01:09.798672
\.


--
-- Data for Name: medication_administrations; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.medication_administrations (administration_id, order_id, patient_id, scheduled_datetime, administered_datetime, patient_barcode_scanned, patient_barcode_value, medication_barcode_scanned, medication_barcode_value, dose_given, route_given, status, reason_if_not_given, administered_by, notes, record_hash, previous_hash, chain_sequence, created_at) FROM stdin;
98a0f003-a225-4277-9822-cb8f43e273df	598073f8-3a1f-4572-a465-0ecb945968ee	550e8400-e29b-41d4-a716-446655440204	2025-10-20 06:00:00	2025-10-20 06:05:00	t	PAT-MRN004	t	MED-6132400-ORD004-01	1	iv	administered	\N	550e8400-e29b-41d4-a716-446655440101	\N	374b13e1d2451b19917df75dcd6e269b398ddd9a0002205e97baa5b08b0b7aee	0000000000000000000000000000000000000000000000000000000000000000	1	2025-10-20 06:01:09.798672
\.


--
-- Data for Name: medication_orders; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.medication_orders (order_id, patient_id, order_number, medication_name_ja, medication_name_en, medication_name_zh, hot_code, dose, dose_unit, route, frequency, scheduled_time, start_datetime, end_datetime, prn, prn_reason, status, ordered_by, created_at) FROM stdin;
5d06dbb5-4a69-4a56-bc5c-03346b8fe9a7	550e8400-e29b-41d4-a716-446655440201	ORD001-01	アスピリン	Aspirin	阿司匹林	1140001	100	mg	oral	BID	08:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
7182d2f2-c219-44d1-8e04-9e84c5a98dbf	550e8400-e29b-41d4-a716-446655440201	ORD001-02	アスピリン	Aspirin	阿司匹林	1140001	100	mg	oral	BID	20:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
0ad2618c-05f3-41a3-ac69-16cb521360fc	550e8400-e29b-41d4-a716-446655440201	ORD001-03	メトホルミン	Metformin	二甲雙胍	3961007	500	mg	oral	TID	08:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
611a3769-06a2-44b3-ac76-70a38923a48d	550e8400-e29b-41d4-a716-446655440201	ORD001-04	メトホルミン	Metformin	二甲雙胍	3961007	500	mg	oral	TID	12:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
3421048c-36d5-4473-ac04-6155dc779d3c	550e8400-e29b-41d4-a716-446655440201	ORD001-05	メトホルミン	Metformin	二甲雙胍	3961007	500	mg	oral	TID	18:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
14153c26-e228-4346-b387-4c9190ca6c23	550e8400-e29b-41d4-a716-446655440201	ORD001-06	アムロジピン	Amlodipine	氨氯地平	2171022	5	mg	oral	QD	09:00:00	2024-01-10 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
3b461ee3-71d5-431d-8a11-a88ad05b2fe7	550e8400-e29b-41d4-a716-446655440202	ORD002-01	アセトアミノフェン	Acetaminophen	對乙酰氨基酚	1141007	500	mg	oral	PRN	\N	2024-01-12 00:00:00	\N	t	疼痛時	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
6410e13e-9eb5-4d83-8769-ec5cd4c045cd	550e8400-e29b-41d4-a716-446655440202	ORD002-02	オメプラゾール	Omeprazole	奧美拉唑	2329023	20	mg	oral	QD	08:00:00	2024-01-12 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
9ad3c9dd-8811-48da-88ff-2a1891c5b311	550e8400-e29b-41d4-a716-446655440202	ORD002-03	レボフロキサシン	Levofloxacin	左氧氟沙星	6241013	500	mg	oral	QD	12:00:00	2024-01-12 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
9ab9da5a-895c-47a7-980d-372b5ee7ccd8	550e8400-e29b-41d4-a716-446655440203	ORD003-01	ワーファリン	Warfarin	華法林	3332001	2	mg	oral	QD	18:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
18949aff-47d9-4dbd-a0fa-c3c15c4da0ed	550e8400-e29b-41d4-a716-446655440203	ORD003-02	フロセミド	Furosemide	呋塞米	2139005	40	mg	oral	BID	08:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
0f4ccdd5-0078-4d73-b59a-9b90c06f0bb8	550e8400-e29b-41d4-a716-446655440203	ORD003-03	フロセミド	Furosemide	呋塞米	2139005	40	mg	oral	BID	14:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
da3334b4-2218-48d3-b540-a54618625623	550e8400-e29b-41d4-a716-446655440203	ORD003-04	リシノプリル	Lisinopril	賴諾普利	2144009	10	mg	oral	QD	09:00:00	2024-01-08 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
598073f8-3a1f-4572-a465-0ecb945968ee	550e8400-e29b-41d4-a716-446655440204	ORD004-01	セファゾリン	Cefazolin	頭孢唑林	6132400	1	g	iv	Q8H	06:00:00	2024-01-14 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
5229d611-f4dd-4e32-890d-7f080b257131	550e8400-e29b-41d4-a716-446655440204	ORD004-02	セファゾリン	Cefazolin	頭孢唑林	6132400	1	g	iv	Q8H	14:00:00	2024-01-14 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
454034f6-8ae2-49ba-84f0-155e39f231cb	550e8400-e29b-41d4-a716-446655440204	ORD004-03	セファゾリン	Cefazolin	頭孢唑林	6132400	1	g	iv	Q8H	22:00:00	2024-01-14 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
e0dfebd1-3ea0-4f5c-aedf-fb3df65cf996	550e8400-e29b-41d4-a716-446655440204	ORD004-04	モルヒネ	Morphine	嗎啡	8114006	2	mg	iv	PRN	\N	2024-01-14 00:00:00	\N	t	疼痛時（4時間毎まで）	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
10b2dfb8-05bf-4aac-93b5-a74bc776fd1b	550e8400-e29b-41d4-a716-446655440205	ORD005-01	ドネペジル	Donepezil	多奈哌齊	1190012	5	mg	oral	QHS	21:00:00	2024-01-09 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
ba964b43-1ed0-4a51-86ef-c291359b72b1	550e8400-e29b-41d4-a716-446655440205	ORD005-02	リスペリドン	Risperidone	利培酮	1179038	0.5	mg	oral	BID	08:00:00	2024-01-09 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
13cd6e12-faa8-4ec8-843a-108eb5773741	550e8400-e29b-41d4-a716-446655440205	ORD005-03	リスペリドン	Risperidone	利培酮	1179038	0.5	mg	oral	BID	20:00:00	2024-01-09 00:00:00	\N	f	\N	active	550e8400-e29b-41d4-a716-446655440103	2025-10-20 06:01:09.798672
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
febba9ae-a237-45ed-8e07-b74e5e1a5f02	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-06 12:09:28.146051	ipad-demo	submitted	\N	\N	[]	{"height": 153, "weight": 42, "confirmed": true, "updatedAt": "2025-10-06T12:09:22.470Z"}	[]	2025-10-06 12:09:28.267359	2025-10-06 12:09:28.267359	2025-10-06 12:09:28.146051
086a0983-8ae1-4c10-96a5-5712d4f49feb	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-06 12:11:27.99458	ipad-demo	submitted	{"measured_at": "2025-10-06T12:11:21.013Z", "blood_pressure_systolic": 150, "blood_pressure_diastolic": 89}	\N	[]	\N	[]	2025-10-06 12:11:28.043234	2025-10-06 12:11:28.043234	2025-10-06 12:11:27.99458
616825b7-a7be-472b-acd5-fc80a5c0e7d8	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-06 12:25:47.143676	ipad-demo	submitted	{"measured_at": "2025-10-06T12:25:34.023Z", "blood_pressure_systolic": 120, "blood_pressure_diastolic": 78}	\N	[]	{"height": 152, "weight": 41, "confirmed": true, "updatedAt": "2025-10-06T12:24:34.251Z"}	[]	2025-10-06 12:25:47.188288	2025-10-06 12:25:47.188288	2025-10-06 12:25:47.143676
de5dcfc1-a366-40b0-92ca-62f3861c4b30	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-06 12:34:55.050972	ipad-demo	submitted	{"measured_at": "2025-10-06T12:34:31.433Z", "temperature_celsius": 36.9}	\N	[]	{"height": 152, "weight": 53, "confirmed": true, "updatedAt": "2025-10-06T12:31:43.236Z"}	[]	2025-10-06 12:34:55.089825	2025-10-06 12:34:55.089825	2025-10-06 12:34:55.050972
972b69d6-a3e7-4935-9ee4-ce4f45f36f81	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-06 12:36:28.64214	ipad-demo	submitted	\N	\N	[]	{"height": 152, "weight": 53, "confirmed": true, "updatedAt": "2025-10-06T12:36:22.847Z"}	[]	2025-10-06 12:36:28.683388	2025-10-06 12:36:28.683388	2025-10-06 12:36:28.64214
88afc700-4860-46b7-b7ac-261e4abc013c	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-06 12:42:38.469285	ipad-demo	submitted	{"heart_rate": 53, "measured_at": "2025-10-06T12:41:26.958Z", "respiratory_rate": 16, "oxygen_saturation": 99, "temperature_celsius": 38.9, "blood_pressure_systolic": 150, "blood_pressure_diastolic": 57}	\N	[]	{"height": 152, "weight": 39, "confirmed": true, "updatedAt": "2025-10-06T12:42:02.609Z"}	[]	2025-10-06 12:42:38.50426	2025-10-06 12:42:38.50426	2025-10-06 12:42:38.469285
7043ebbc-e5ea-43fa-82b3-906da350570e	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-06 12:48:33.263461	ipad-demo	submitted	{"heart_rate": 53, "measured_at": "2025-10-06T12:45:39.926Z", "respiratory_rate": 16, "oxygen_saturation": 99, "temperature_celsius": 38.9, "blood_pressure_systolic": 150, "blood_pressure_diastolic": 57}	\N	[]	{"height": 152, "weight": 39, "confirmed": true, "updatedAt": "2025-10-06T12:46:22.158Z"}	[]	2025-10-06 12:48:33.30335	2025-10-06 12:48:33.30335	2025-10-06 12:48:33.263461
8e59766e-a6b7-4fa8-a887-2daafb3e52da	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 00:34:13.754404	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T00:34:05.665Z", "respiratory_rate": 14, "oxygen_saturation": 99, "temperature_celsius": 36.3, "blood_pressure_systolic": 132, "blood_pressure_diastolic": 78}	\N	[]	\N	[]	2025-10-09 00:34:13.790304	2025-10-09 00:34:13.790304	2025-10-09 00:34:13.754404
531ce307-167e-49f8-b620-46994e97d687	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 00:35:00.250715	ipad-demo	submitted	{"measured_at": "2025-10-09T00:34:55.278Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 00:35:00.297149	2025-10-09 00:35:00.297149	2025-10-09 00:35:00.250715
e671252a-f0bd-46af-bc3e-69390e586046	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 00:56:01.335502	ipad-demo	submitted	{"measured_at": "2025-10-09T00:55:44.345Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	{"height": 152, "weight": 43, "confirmed": true, "updatedAt": "2025-10-09T00:55:56.510Z"}	[]	2025-10-09 00:56:01.490417	2025-10-09 00:56:01.490417	2025-10-09 00:56:01.335502
43a6818c-327d-41bf-ae8a-40a5a306e8f0	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 00:59:30.397178	ipad-demo	submitted	{"measured_at": "2025-10-09T00:59:25.963Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 73}	\N	[]	\N	[]	2025-10-09 00:59:30.437427	2025-10-09 00:59:30.437427	2025-10-09 00:59:30.397178
22729c1d-c2a1-4287-8439-0def29ca7a73	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:07:59.650669	ipad-demo	submitted	{"measured_at": "2025-10-09T01:07:56.677Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:07:59.760812	2025-10-09 01:07:59.760812	2025-10-09 01:07:59.650669
a1f1d791-a88c-4705-a045-508870b82df8	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:11:44.519564	ipad-demo	submitted	{"measured_at": "2025-10-09T01:11:37.247Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:11:44.550638	2025-10-09 01:11:44.550638	2025-10-09 01:11:44.519564
04417f82-49e5-44c7-aa15-4791066430a3	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:19:19.628039	ipad-demo	submitted	{"measured_at": "2025-10-09T01:19:16.435Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:19:19.789848	2025-10-09 01:19:19.789848	2025-10-09 01:19:19.628039
e830168a-3f56-4e52-8a8e-78eafbeb88d2	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:21:31.7363	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:21:28.021Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:21:31.891806	2025-10-09 01:21:31.891806	2025-10-09 01:21:31.7363
eed2d179-a098-4014-9e34-8639af45d63d	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:27:15.818048	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:27:11.801Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:27:15.857566	2025-10-09 01:27:15.857566	2025-10-09 01:27:15.818048
e8614d44-c08a-43a7-8ce1-974b7ac1c118	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:44:18.218443	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:44:14.331Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:44:18.264865	2025-10-09 01:44:18.264865	2025-10-09 01:44:18.218443
3fd666f9-1629-438a-ac21-64e6af4ad4ed	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:46:38.065762	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:46:34.227Z", "temperature_celsius": 35.7, "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:46:38.171424	2025-10-09 01:46:38.171424	2025-10-09 01:46:38.065762
b35e40ad-04d2-4694-a544-503307fcd3e4	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:49:07.701052	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:46:34.227Z", "temperature_celsius": 35.7, "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:49:07.737378	2025-10-09 01:49:07.737378	2025-10-09 01:49:07.701052
fb2794dc-32c2-422a-b5ed-b005b9ed8c3b	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 01:57:22.603312	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:46:34.227Z", "temperature_celsius": 35.7, "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 01:57:22.652776	2025-10-09 01:57:22.652776	2025-10-09 01:57:22.603312
bf7b6637-2671-481e-98a8-a8d161d7a1e1	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:00:49.803563	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:46:34.227Z", "temperature_celsius": 35.7, "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 02:00:49.838573	2025-10-09 02:00:49.838573	2025-10-09 02:00:49.803563
0c57cfc1-b4c0-407d-b1f7-d82b7c21f5a5	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:06:05.39209	ipad-demo	submitted	{"heart_rate": 57, "measured_at": "2025-10-09T02:05:59.016Z", "blood_pressure_systolic": 132, "blood_pressure_diastolic": 79}	\N	[]	\N	[]	2025-10-09 02:06:05.525261	2025-10-09 02:06:05.525261	2025-10-09 02:06:05.39209
e6a85ecb-e0fd-4431-936b-7eeb39ecb309	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 04:31:08.58434	ipad-demo	submitted	{"measured_at": "2025-10-09T04:31:05.165Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-09 04:31:08.637157	2025-10-09 04:31:08.637157	2025-10-09 04:31:08.58434
0ce706ff-d1e8-4d24-992e-3e657c11f53c	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 04:36:29.391737	ipad-demo	submitted	{"measured_at": "2025-10-09T04:36:24.161Z", "oxygen_saturation": 99}	\N	[]	\N	[]	2025-10-09 04:36:29.44221	2025-10-09 04:36:29.44221	2025-10-09 04:36:29.391737
395b393d-4e6d-4feb-96bf-d44832d4bf6f	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:11:07.04054	ipad-demo	submitted	{"heart_rate": 54, "measured_at": "2025-10-09T02:10:57.493Z", "temperature_celsius": 41, "blood_pressure_systolic": 123, "blood_pressure_diastolic": 69}	\N	[]	\N	[]	2025-10-09 02:11:07.081743	2025-10-09 02:11:07.081743	2025-10-09 02:11:07.04054
fc189271-9ba0-4dcd-b0fc-724ba705d9f1	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:18:31.364028	ipad-demo	submitted	{"heart_rate": 67, "measured_at": "2025-10-09T02:18:27.161Z", "respiratory_rate": 15, "oxygen_saturation": 87, "temperature_celsius": 38, "blood_pressure_systolic": 128, "blood_pressure_diastolic": 65}	\N	[]	\N	[]	2025-10-09 02:18:31.407482	2025-10-09 02:18:31.407482	2025-10-09 02:18:31.364028
9a3f103e-8a8d-4f08-87c4-e5b146dc21ba	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-21 02:33:49.507503	ipad-demo	submitted	\N	\N	[]	\N	[]	2025-10-21 02:33:49.527343	2025-10-21 02:33:49.527343	2025-10-21 02:33:49.507503
155a1f1c-40a3-4cd5-91a3-4cab21b0e29e	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:23:12.669781	ipad-demo	submitted	{"measured_at": "2025-10-09T02:23:08.858Z", "blood_pressure_systolic": 116, "blood_pressure_diastolic": 65}	\N	[]	\N	[]	2025-10-09 02:23:12.711587	2025-10-09 02:23:12.711587	2025-10-09 02:23:12.669781
9f65f473-7c93-46d7-9214-5c678a9a5b92	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:26:10.640273	ipad-demo	submitted	{"heart_rate": 63, "measured_at": "2025-10-09T02:25:57.768Z", "temperature_celsius": 34.9, "blood_pressure_systolic": 116, "blood_pressure_diastolic": 75}	\N	[]	\N	[]	2025-10-09 02:26:10.687478	2025-10-09 02:26:10.687478	2025-10-09 02:26:10.640273
55ce97b2-49ae-44a4-9ead-4d8ee8d1290f	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:28:33.997277	ipad-demo	submitted	{"heart_rate": 53, "measured_at": "2025-10-09T02:28:28.634Z", "respiratory_rate": 18, "oxygen_saturation": 89, "temperature_celsius": 35.1, "blood_pressure_systolic": 112, "blood_pressure_diastolic": 63}	\N	[]	\N	[]	2025-10-09 02:28:34.030851	2025-10-09 02:28:34.030851	2025-10-09 02:28:33.997277
a645a044-e34d-4111-8615-e2eaec355927	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:34:44.791599	ipad-demo	submitted	{"heart_rate": 65, "measured_at": "2025-10-09T02:34:39.274Z", "respiratory_rate": 15, "oxygen_saturation": 96, "temperature_celsius": 35.2, "blood_pressure_systolic": 112, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 02:34:44.824004	2025-10-09 02:34:44.824004	2025-10-09 02:34:44.791599
edf989af-f945-4942-a194-6a0a6c76cc57	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:39:29.393752	ipad-demo	submitted	{"measured_at": "2025-10-09T02:39:23.076Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 68}	\N	[]	\N	[]	2025-10-09 02:39:29.441178	2025-10-09 02:39:29.441178	2025-10-09 02:39:29.393752
3d83fc56-8d1c-4802-bc26-55457f093e82	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:47:45.991446	ipad-demo	submitted	{"heart_rate": 65, "measured_at": "2025-10-09T02:47:38.642Z", "respiratory_rate": 15, "oxygen_saturation": 96, "temperature_celsius": 34.9, "blood_pressure_systolic": 110, "blood_pressure_diastolic": 67}	\N	[]	\N	[]	2025-10-09 02:47:46.170306	2025-10-09 02:47:46.170306	2025-10-09 02:47:45.991446
794cd17a-3f9d-4610-8477-553c70511801	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:52:29.393348	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-09T02:52:16.700Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 65}	\N	[]	\N	[]	2025-10-09 02:52:29.428667	2025-10-09 02:52:29.428667	2025-10-09 02:52:29.393348
5fb4f6fe-6eec-471f-ab05-60a02422b988	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:55:50.362224	ipad-demo	submitted	{"heart_rate": 39, "measured_at": "2025-10-09T02:55:43.181Z", "respiratory_rate": 12, "oxygen_saturation": 87, "temperature_celsius": 34.8, "blood_pressure_systolic": 112, "blood_pressure_diastolic": 73}	\N	[]	\N	[]	2025-10-09 02:55:50.388653	2025-10-09 02:55:50.388653	2025-10-09 02:55:50.362224
4ac4e530-d0be-4edc-845b-36687f8abdb5	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 02:58:04.509595	ipad-demo	submitted	{"measured_at": "2025-10-09T02:57:59.761Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 67}	\N	[]	\N	[]	2025-10-09 02:58:04.549238	2025-10-09 02:58:04.549238	2025-10-09 02:58:04.509595
dc454cfc-0dbc-403b-9751-105c2d4655f8	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:04:39.805268	ipad-demo	submitted	{"measured_at": "2025-10-09T03:04:32.718Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 59}	\N	[]	\N	[]	2025-10-09 03:04:39.837904	2025-10-09 03:04:39.837904	2025-10-09 03:04:39.805268
e4b796cb-ba96-41e3-ad65-3b689c447aba	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:09:52.687503	ipad-demo	submitted	{"heart_rate": 68, "measured_at": "2025-10-09T03:09:47.571Z", "temperature_celsius": 37, "blood_pressure_systolic": 117, "blood_pressure_diastolic": 78}	\N	[]	\N	[]	2025-10-09 03:09:52.73791	2025-10-09 03:09:52.73791	2025-10-09 03:09:52.687503
99cc07dd-a5dc-452c-a4ba-6790253871e4	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:29:53.764131	ipad-demo	submitted	{"measured_at": "2025-10-09T03:29:50.027Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 03:29:53.812272	2025-10-09 03:29:53.812272	2025-10-09 03:29:53.764131
f6b36d12-e12c-45f9-8994-67df7e791381	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:36:02.438002	ipad-demo	submitted	{"measured_at": "2025-10-09T03:35:57.736Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 78}	\N	[]	\N	[]	2025-10-09 03:36:02.467604	2025-10-09 03:36:02.467604	2025-10-09 03:36:02.438002
114a70d5-bb72-4522-b554-17f9e9d8b94f	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:41:25.64811	ipad-demo	submitted	{"measured_at": "2025-10-09T03:41:21.003Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 67}	\N	[]	\N	[]	2025-10-09 03:41:25.684452	2025-10-09 03:41:25.684452	2025-10-09 03:41:25.64811
89d4d655-1b53-4448-bd97-c6974cffba2c	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:47:34.698511	ipad-demo	submitted	{"heart_rate": 69, "measured_at": "2025-10-09T01:46:34.227Z", "temperature_celsius": 35.7, "blood_pressure_systolic": 132, "blood_pressure_diastolic": 76}	\N	[]	\N	[]	2025-10-09 03:47:34.738847	2025-10-09 03:47:34.738847	2025-10-09 03:47:34.698511
83610cdd-0273-420c-8f00-d9296f611759	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:48:04.233906	ipad-demo	submitted	{"measured_at": "2025-10-09T03:48:00.236Z", "oxygen_saturation": 99}	\N	[]	\N	[]	2025-10-09 03:48:04.272432	2025-10-09 03:48:04.272432	2025-10-09 03:48:04.233906
f8080dea-8819-4471-949e-d3f731fb6f60	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:50:56.382472	ipad-demo	submitted	{"measured_at": "2025-10-09T03:50:49.952Z", "oxygen_saturation": 99}	\N	[]	\N	[]	2025-10-09 03:50:56.455234	2025-10-09 03:50:56.455234	2025-10-09 03:50:56.382472
58d952f2-3dec-4a31-b7ac-a9b6fe47c4a1	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:52:58.749066	ipad-demo	submitted	{"measured_at": "2025-10-09T03:52:54.790Z", "oxygen_saturation": 99}	\N	[]	\N	[]	2025-10-09 03:52:58.805697	2025-10-09 03:52:58.805697	2025-10-09 03:52:58.749066
9eab1eaa-09bf-477c-ba6f-8cb2885d7c80	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:57:03.976739	ipad-demo	submitted	{"measured_at": "2025-10-09T03:52:54.790Z", "oxygen_saturation": 99}	\N	[]	\N	[]	2025-10-09 03:57:04.01835	2025-10-09 03:57:04.01835	2025-10-09 03:57:03.976739
c28a0ff7-73c1-47c7-9ff6-2aa727d93cf9	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 03:57:21.226244	ipad-demo	submitted	{"measured_at": "2025-10-09T03:57:18.520Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 87}	\N	[]	\N	[]	2025-10-09 03:57:21.25233	2025-10-09 03:57:21.25233	2025-10-09 03:57:21.226244
159660f2-3d47-4594-9cdf-bd380ec49203	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 04:00:12.428762	ipad-demo	submitted	{"measured_at": "2025-10-09T03:57:18.520Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 87}	\N	[]	\N	[]	2025-10-09 04:00:12.683874	2025-10-09 04:00:12.683874	2025-10-09 04:00:12.428762
33c624fa-498b-4193-ad21-916b2957d73a	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 04:02:29.128743	ipad-demo	submitted	{"measured_at": "2025-10-09T03:57:18.520Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 87}	\N	[]	\N	[]	2025-10-09 04:02:29.17454	2025-10-09 04:02:29.17454	2025-10-09 04:02:29.128743
75303fa1-9c40-4bb4-8504-41540ac82151	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 04:16:15.924614	ipad-demo	submitted	{"measured_at": "2025-10-09T03:57:18.520Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 87}	\N	[]	\N	[]	2025-10-09 04:16:15.960203	2025-10-09 04:16:15.960203	2025-10-09 04:16:15.924614
48df55d4-7b92-473a-9080-02b9462404e1	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 08:16:10.269863	ipad-demo	submitted	{"measured_at": "2025-10-09T08:16:05.074Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-09 08:16:10.311905	2025-10-09 08:16:10.311905	2025-10-09 08:16:10.269863
c4074783-f45f-4490-b55f-d38413f215a7	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 08:20:02.550356	ipad-demo	submitted	{"measured_at": "2025-10-09T08:16:05.074Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-09 08:20:02.599674	2025-10-09 08:20:02.599674	2025-10-09 08:20:02.550356
16a994aa-d8db-4ea1-ab55-7e225305fd5e	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 09:22:46.115368	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-10T01:49:43.769Z", "respiratory_rate": 12, "oxygen_saturation": 99, "temperature_celsius": 36.7, "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	{"scores": {"bowel": 5, "eating": 5, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 5}, "recorded_at": "2025-10-10T02:10:55.300Z", "total_score": 60}	[]	\N	[]	2025-10-10 09:22:46.210596	2025-10-10 09:22:46.210596	2025-10-10 09:22:46.115368
0c6643cf-38e4-4875-b8e3-8579d3c61f4f	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 08:24:03.142512	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-09T08:24:00.588Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-09 08:24:03.191754	2025-10-09 08:24:03.191754	2025-10-09 08:24:03.142512
c2bdf689-f848-4897-b614-23e5b9fb640a	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 08:37:41.9842	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-09T08:24:00.588Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-09 08:37:42.02868	2025-10-09 08:37:42.02868	2025-10-09 08:37:41.9842
d62a97d8-4676-4c18-a2e0-b019dc3a91ac	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 09:23:47.052599	ipad-demo	submitted	{"heart_rate": 54, "measured_at": "2025-10-10T09:23:40.624Z", "temperature_celsius": 33, "blood_pressure_systolic": 112, "blood_pressure_diastolic": 70}	\N	[]	\N	[]	2025-10-10 09:23:47.094568	2025-10-10 09:23:47.094568	2025-10-10 09:23:47.052599
357eeb9e-eaf7-418d-9c01-5af486b3f9c4	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-09 08:37:51.695046	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-09T08:24:00.588Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-09 08:37:51.805589	2025-10-09 08:37:51.805589	2025-10-09 08:37:51.695046
77854caf-9c22-4277-9242-f67daaf1360c	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 01:47:21.674767	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-09T08:24:00.588Z", "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-10 01:47:21.713242	2025-10-10 01:47:21.713242	2025-10-10 01:47:21.674767
d5ec413f-0995-46fe-aeaf-969e0e3ad936	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 09:48:01.904367	ipad-demo	submitted	{"heart_rate": 54, "measured_at": "2025-10-10T09:23:40.624Z", "temperature_celsius": 33, "blood_pressure_systolic": 112, "blood_pressure_diastolic": 70}	\N	[]	\N	[]	2025-10-10 09:48:01.935908	2025-10-10 09:48:01.935908	2025-10-10 09:48:01.904367
646ac92e-57db-4e40-8728-6f5be72e3f19	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 01:49:49.767114	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-10T01:49:43.769Z", "respiratory_rate": 12, "oxygen_saturation": 99, "temperature_celsius": 36.7, "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-10 01:49:49.892064	2025-10-10 01:49:49.892064	2025-10-10 01:49:49.767114
9f44cd6d-1329-4833-9c7c-a27b86fd6862	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 01:52:21.816243	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-10T01:49:43.769Z", "respiratory_rate": 12, "oxygen_saturation": 99, "temperature_celsius": 36.7, "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-10 01:52:21.8547	2025-10-10 01:52:21.8547	2025-10-10 01:52:21.816243
92711f00-6bc5-440f-aac9-c3a1d7c0dd9b	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 09:48:55.277698	ipad-demo	submitted	{"heart_rate": 54, "measured_at": "2025-10-10T09:23:40.624Z", "temperature_celsius": 33, "blood_pressure_systolic": 112, "blood_pressure_diastolic": 70}	{"scores": {"bowel": 10, "eating": 10, "stairs": 10, "bathing": 5, "bladder": 10, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 10}, "recorded_at": "2025-10-10T09:48:50.065Z", "total_score": 85}	[]	\N	[]	2025-10-10 09:48:55.321492	2025-10-10 09:48:55.321492	2025-10-10 09:48:55.277698
4dee7ff6-8bb4-42e9-bf6f-8f730b21adb0	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 02:06:26.624082	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-10T01:49:43.769Z", "respiratory_rate": 12, "oxygen_saturation": 99, "temperature_celsius": 36.7, "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-10 02:06:26.663354	2025-10-10 02:06:26.663354	2025-10-10 02:06:26.624082
81a9a4fb-0ece-4a73-93db-2a1e3760b0e8	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 02:07:44.547143	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-10T01:49:43.769Z", "respiratory_rate": 12, "oxygen_saturation": 99, "temperature_celsius": 36.7, "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	\N	[]	\N	[]	2025-10-10 02:07:44.667364	2025-10-10 02:07:44.667364	2025-10-10 02:07:44.547143
7e79fcf7-db76-473b-b8e2-e3e7d06f5212	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 09:49:02.873401	ipad-demo	submitted	{"heart_rate": 54, "measured_at": "2025-10-10T09:23:40.624Z", "temperature_celsius": 33, "blood_pressure_systolic": 112, "blood_pressure_diastolic": 70}	{"scores": {"bowel": 10, "eating": 10, "stairs": 10, "bathing": 5, "bladder": 10, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 10}, "recorded_at": "2025-10-10T09:48:50.065Z", "total_score": 85}	[]	\N	[]	2025-10-10 09:49:02.90807	2025-10-10 09:49:02.90807	2025-10-10 09:49:02.873401
3a01644a-b380-4920-967d-5d9777005084	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-10 02:11:01.855022	ipad-demo	submitted	{"heart_rate": 64, "measured_at": "2025-10-10T01:49:43.769Z", "respiratory_rate": 12, "oxygen_saturation": 99, "temperature_celsius": 36.7, "blood_pressure_systolic": 113, "blood_pressure_diastolic": 54}	{"scores": {"bowel": 5, "eating": 5, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 10, "dressing": 5, "grooming": 5, "transfer": 10, "toileting": 5}, "recorded_at": "2025-10-10T02:10:55.300Z", "total_score": 60}	[]	\N	[]	2025-10-10 02:11:01.909544	2025-10-10 02:11:01.909544	2025-10-10 02:11:01.855022
02468855-9bb7-4d79-a8bf-ba12e5611099	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-16 07:13:16.296459	ipad-demo	submitted	{"heart_rate": 46, "measured_at": "2025-10-16T07:13:08.157Z", "blood_pressure_systolic": 116, "blood_pressure_diastolic": 53}	\N	[]	\N	[]	2025-10-16 07:13:16.3284	2025-10-16 07:13:16.3284	2025-10-16 07:13:16.296459
3fddb8e5-782f-4850-97a0-6869dba70953	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 00:03:40.036552	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	\N	[]	\N	[]	2025-10-17 00:03:40.22325	2025-10-17 00:03:40.22325	2025-10-17 00:03:40.036552
740c8fab-f67c-40c1-938f-3b0dce52e05a	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 00:08:50.596801	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	\N	[]	\N	[]	2025-10-17 00:08:50.638882	2025-10-17 00:08:50.638882	2025-10-17 00:08:50.596801
6e81af29-52cf-40af-82bb-2c8692a96226	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 00:11:57.483035	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}, "recorded_at": "2025-10-17T00:11:48.653Z", "total_score": 75}	[]	\N	[]	2025-10-17 00:11:57.521451	2025-10-17 00:11:57.521451	2025-10-17 00:11:57.483035
250931b0-5b36-45ad-9183-e6214e710a1d	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 01:01:04.701194	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}, "recorded_at": "2025-10-17T00:11:48.653Z", "total_score": 75}	[]	\N	[]	2025-10-17 01:01:04.938936	2025-10-17 01:01:04.938936	2025-10-17 01:01:04.701194
ca5ece2f-e9a8-4dcb-822b-020b31761259	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 01:01:48.172223	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}, "recorded_at": "2025-10-17T00:11:48.653Z", "total_score": 75}	[]	{"height": 178, "weight": 65, "confirmed": true, "updatedAt": "2025-10-17T01:01:39.689Z"}	[]	2025-10-17 01:01:48.220816	2025-10-17 01:01:48.220816	2025-10-17 01:01:48.172223
8b249477-5a70-4ea9-933a-f2217951549b	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 01:20:21.227907	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}, "recorded_at": "2025-10-17T00:11:48.653Z", "total_score": 75}	[]	{"height": 178, "weight": 65, "confirmed": true, "updatedAt": "2025-10-17T01:01:39.689Z"}	[]	2025-10-17 01:20:21.268059	2025-10-17 01:20:21.268059	2025-10-17 01:20:21.227907
27f606bb-3e42-4a4b-9e5f-0f1e8870905e	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 01:56:24.855743	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}, "recorded_at": "2025-10-17T00:11:48.653Z", "total_score": 75}	[]	{"height": 178, "weight": 65, "confirmed": true, "updatedAt": "2025-10-17T01:01:39.689Z"}	[]	2025-10-17 01:56:24.907992	2025-10-17 01:56:24.907992	2025-10-17 01:56:24.855743
c5671d80-1c46-437f-b251-94dc1f1ebe18	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 02:13:19.149204	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}, "recorded_at": "2025-10-17T00:11:48.653Z", "total_score": 75}	[]	{"height": 178, "weight": 65, "confirmed": true, "updatedAt": "2025-10-17T01:01:39.689Z"}	[]	2025-10-17 02:13:19.273037	2025-10-17 02:13:19.273037	2025-10-17 02:13:19.149204
14e0c9e0-9a2d-4f9b-b48d-2b0ec8da835a	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 02:38:43.508565	ipad-demo	submitted	{"weight": {"weight_kg": 100.4}, "heart_rate": 54, "measured_at": "2025-10-16T23:44:31.916Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 10, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 10, "walking": 15, "dressing": 5, "grooming": 5, "transfer": 15, "toileting": 5}, "recorded_at": "2025-10-17T00:11:48.653Z", "total_score": 75}	[]	{"height": 178, "weight": 65, "confirmed": true, "updatedAt": "2025-10-17T01:01:39.689Z"}	[]	2025-10-17 02:38:43.546056	2025-10-17 02:38:43.546056	2025-10-17 02:38:43.508565
b5c3f159-63a3-4991-af7a-c6b63e2d658c	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 08:52:14.013784	ipad-demo	submitted	{"weight": {"bmi": 22.98048269752208, "weight_kg": 85.6, "percentage_change": -14.656031904287142, "previous_weight_kg": 100.3}, "heart_rate": 54, "measured_at": "2025-10-17T07:13:24.822Z", "blood_pressure_systolic": 100, "blood_pressure_diastolic": 61}	{"scores": {"bowel": 0, "stairs": 0, "bathing": 5, "bladder": 0, "walking": 10, "dressing": 5, "grooming": 0, "transfer": 15, "toileting": 0}, "recorded_at": "2025-10-17T08:52:00.488Z", "total_score": 35}	[]	{"height": 193, "confirmed": true, "updatedAt": "2025-10-17T03:32:49.221Z"}	[]	2025-10-17 08:52:14.058858	2025-10-17 08:52:14.058858	2025-10-17 08:52:14.013784
000f7bb3-402b-4142-8d7b-84e8c02af2d5	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-20 08:23:52.8188	ipad-demo	submitted	\N	\N	[]	\N	[]	2025-10-20 08:23:52.856908	2025-10-20 08:23:52.856908	2025-10-20 08:23:52.8188
9c64b313-32dd-482e-80ff-dd459136f001	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 15:03:31.340613	ipad-demo	submitted	{"weight": {"bmi": 27.114821874412737, "weight_kg": 101, "percentage_change": 0, "previous_weight_kg": 101}, "heart_rate": 49, "measured_at": "2025-10-17T12:27:10.131Z", "blood_glucose": {"unit": "mg/dL", "value": 90, "test_type": "fasting"}, "consciousness": {"jcs_level": 0, "jcs_category": "alert"}, "temperature_celsius": 40, "blood_pressure_systolic": 129, "blood_pressure_diastolic": 63}	{"scores": {"bowel": 0, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 5, "dressing": 5, "grooming": 5, "transfer": 5, "toileting": 0}, "recorded_at": "2025-10-17T13:33:08.543Z", "total_score": 35}	[]	{"height": 193, "allergies": ["Peanuts", "Penicillin"], "confirmed": true, "updatedAt": "2025-10-17T08:54:58.603Z"}	[]	2025-10-17 15:03:31.365216	2025-10-17 15:03:31.365216	2025-10-17 15:03:31.340613
53a06486-5b71-487e-a3ea-f736b7018595	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 16:01:33.23083	ipad-demo	submitted	{"weight": {"bmi": 27.114821874412737, "weight_kg": 101, "percentage_change": 0, "previous_weight_kg": 101}, "heart_rate": 49, "measured_at": "2025-10-17T12:27:10.131Z", "blood_glucose": {"unit": "mg/dL", "value": 90, "test_type": "fasting"}, "consciousness": {"jcs_level": 0, "jcs_category": "alert"}, "temperature_celsius": 40, "blood_pressure_systolic": 129, "blood_pressure_diastolic": 63}	{"scores": {"bowel": 0, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 5, "dressing": 5, "grooming": 5, "transfer": 5, "toileting": 0}, "recorded_at": "2025-10-17T13:33:08.543Z", "total_score": 35}	[]	{"height": 193, "allergies": ["Peanuts", "Penicillin"], "confirmed": true, "updatedAt": "2025-10-17T08:54:58.603Z"}	[]	2025-10-17 16:01:33.288669	2025-10-17 16:01:33.288669	2025-10-17 16:01:33.23083
6b7abc1c-5100-464f-b919-888c09de8bf9	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-10-17 16:06:20.470242	ipad-demo	submitted	{"weight": {"bmi": 27.114821874412737, "weight_kg": 101, "percentage_change": 0, "previous_weight_kg": 101}, "heart_rate": 49, "measured_at": "2025-10-17T12:27:10.131Z", "blood_glucose": {"unit": "mg/dL", "value": 90, "test_type": "fasting"}, "consciousness": {"jcs_level": 0, "jcs_category": "alert"}, "temperature_celsius": 40, "blood_pressure_systolic": 129, "blood_pressure_diastolic": 63}	{"scores": {"bowel": 0, "eating": 0, "stairs": 5, "bathing": 5, "bladder": 5, "walking": 5, "dressing": 5, "grooming": 5, "transfer": 5, "toileting": 0}, "recorded_at": "2025-10-17T13:33:08.543Z", "total_score": 35}	[]	{"height": 193, "allergies": ["Peanuts", "Penicillin"], "confirmed": true, "updatedAt": "2025-10-17T08:54:58.603Z"}	[]	2025-10-17 16:06:20.523159	2025-10-17 16:06:20.523159	2025-10-17 16:06:20.470242
0d77c306-6318-407d-95e6-0b944704d96e	550e8400-e29b-41d4-a716-446655440202	550e8400-e29b-41d4-a716-446655440101	2025-10-31 02:17:35.052137	ipad-demo	submitted	{"heart_rate": 46, "measured_at": "2025-10-31T02:12:55.893Z", "temperature_celsius": 35.9, "blood_pressure_systolic": 122, "blood_pressure_diastolic": 66}	\N	[]	\N	[]	2025-10-31 02:17:35.263396	2025-10-31 02:17:35.263396	2025-10-31 02:17:35.052137
59451c9f-ff04-4521-b1f7-3a5faa7b36dc	550e8400-e29b-41d4-a716-446655440202	550e8400-e29b-41d4-a716-446655440101	2025-10-31 02:18:32.830833	ipad-demo	submitted	{"heart_rate": 46, "measured_at": "2025-10-31T02:12:55.893Z", "temperature_celsius": 35.9, "blood_pressure_systolic": 122, "blood_pressure_diastolic": 66}	\N	[]	\N	[]	2025-10-31 02:18:32.957679	2025-10-31 02:18:32.957679	2025-10-31 02:18:32.830833
980771a2-06b1-4ff9-a2d3-9b2d518bd2d9	550e8400-e29b-41d4-a716-446655440202	550e8400-e29b-41d4-a716-446655440101	2025-10-31 04:50:50.560514	ipad-demo	submitted	{"heart_rate": 49, "measured_at": "2025-10-31T04:50:06.662Z", "temperature_celsius": 35.9, "blood_pressure_systolic": 122, "blood_pressure_diastolic": 66}	\N	[]	\N	[]	2025-10-31 04:50:50.587616	2025-10-31 04:50:50.587616	2025-10-31 04:50:50.560514
50a0500c-7e24-45e0-a338-54235465c78b	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-11-06 04:18:49.217539	ipad-demo	submitted	{"heart_rate": 49, "measured_at": "2025-11-06T04:18:38.059Z", "blood_pressure_systolic": 112, "blood_pressure_diastolic": 61}	\N	[]	\N	[]	2025-11-06 04:18:49.245635	2025-11-06 04:18:49.245635	2025-11-06 04:18:49.217539
3ecda01c-29b1-49da-83a5-cb035ef6d62f	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:48:57.701241	ipad-demo	submitted	{"heart_rate": 39, "measured_at": "2025-11-10T01:48:50.808Z", "temperature_celsius": 34.8, "blood_pressure_systolic": 102, "blood_pressure_diastolic": 56}	\N	[]	\N	[]	2025-11-10 01:48:57.733231	2025-11-10 01:48:57.733231	2025-11-10 01:48:57.701241
6f2243bf-38e9-41a7-b858-96a6bb0c89ee	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:52:19.360665	ipad-demo	submitted	{"heart_rate": 39, "measured_at": "2025-11-10T01:52:15.728Z", "temperature_celsius": 34.9, "blood_pressure_systolic": 102, "blood_pressure_diastolic": 56}	\N	[]	\N	[]	2025-11-10 01:52:19.392902	2025-11-10 01:52:19.392902	2025-11-10 01:52:19.360665
502c3284-d967-40fe-be11-dddebb16a736	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:55:55.748251	ipad-demo	submitted	{"heart_rate": 39, "measured_at": "2025-11-10T01:55:51.499Z", "temperature_celsius": 35.8, "blood_pressure_systolic": 102, "blood_pressure_diastolic": 56}	\N	[]	\N	[]	2025-11-10 01:55:55.781282	2025-11-10 01:55:55.781282	2025-11-10 01:55:55.748251
b4f854b7-90f5-43c5-bf20-55a4b788517a	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:56:43.421884	ipad-demo	submitted	{"heart_rate": 39, "measured_at": "2025-11-10T01:56:28.567Z", "temperature_celsius": 38.2, "blood_pressure_systolic": 102, "blood_pressure_diastolic": 56}	\N	[]	\N	[]	2025-11-10 01:56:43.44619	2025-11-10 01:56:43.44619	2025-11-10 01:56:43.421884
b69fc05f-b852-4e76-8aac-40e858d7f830	550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440101	2025-11-10 02:05:45.706444	ipad-demo	submitted	{"heart_rate": 39, "measured_at": "2025-11-10T02:05:37.656Z", "temperature_celsius": 36.8, "blood_pressure_systolic": 102, "blood_pressure_diastolic": 56}	\N	[]	\N	[]	2025-11-10 02:05:45.742316	2025-11-10 02:05:45.742316	2025-11-10 02:05:45.706444
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.patients (patient_id, facility_id, mrn, family_name, given_name, family_name_kana, given_name_kana, date_of_birth, gender, room, bed, blood_type, admission_date, created_at, family_name_en, given_name_en, height_cm, weight_kg, allergies, medications_summary, key_notes, risk_factors, status) FROM stdin;
550e8400-e29b-41d4-a716-446655440201	550e8400-e29b-41d4-a716-446655440001	MRN001	山田	太郎	ヤマダ	タロウ	1955-03-15	male	305	A	A+	2024-01-10	2025-10-20 06:01:09.798672	Yamada	Taro	165.50	68.20	{ペニシリン系抗生物質,Penicillin}	アムロジピン5mg 1日1回、メトホルミン500mg 1日2回	糖尿病・高血圧の既往あり。食事制限中。	{転倒リスク,糖尿病,高血圧}	yellow
550e8400-e29b-41d4-a716-446655440202	550e8400-e29b-41d4-a716-446655440001	MRN002	田中	優希	タナカ	ユウキ	1978-07-22	female	307	B	B+	2024-01-12	2025-10-20 06:01:09.798672	Tanaka	Yuki	158.00	52.50	{なし,None}	術後鎮痛剤、抗生物質	術後ケア中。創部の観察が必要。	{術後感染リスク}	green
550e8400-e29b-41d4-a716-446655440203	550e8400-e29b-41d4-a716-446655440001	MRN003	佐藤	健二	サトウ	ケンジ	1951-11-08	male	309	C	O+	2024-01-08	2025-10-20 06:01:09.798672	Sato	Kenji	172.00	75.80	{造影剤,"Contrast dye"}	ワーファリン2mg 1日1回、アスピリン100mg 1日1回	心臓疾患あり。抗凝固薬服用中。出血リスクに注意。	{出血リスク,心疾患}	yellow
550e8400-e29b-41d4-a716-446655440204	550e8400-e29b-41d4-a716-446655440001	MRN004	鈴木	愛子	スズキ	アイコ	1968-05-30	female	311	A	AB+	2024-01-14	2025-10-20 06:01:09.798672	Suzuki	Aiko	155.00	48.00	{卵,Eggs}	セフェム系抗生物質、解熱鎮痛剤	抗生物質治療中。アレルギー歴に注意。	{薬剤アレルギー}	green
550e8400-e29b-41d4-a716-446655440205	550e8400-e29b-41d4-a716-446655440001	MRN005	渡辺	博	ワタナベ	ヒロシ	1943-12-25	male	315	B	A-	2024-01-09	2025-10-20 06:01:09.798672	Watanabe	Hiroshi	168.00	58.50	{なし,None}	認知症治療薬（ドネペジル）、血圧降下剤	認知症あり。見当識障害のため見守り必要。徘徊リスクあり。	{認知症,徘徊リスク,転倒リスク}	red
\.


--
-- Data for Name: problem_templates; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.problem_templates (template_id, category, japanese_text, english_text, chinese_text, suggested_long_term_goals, suggested_short_term_goals, suggested_interventions, created_at) FROM stdin;
047ddfc2-6986-4a68-b3c3-6424a06e0616	ADL	トイレ動作の自立困難	Difficulty with independent toileting	如廁動作自理困難	{"en": ["Able to perform toileting with supervision only during daytime", "Complete toileting without falling"], "ja": ["日中、見守りのみでトイレ動作ができる", "転倒せずにトイレ動作を完了できる"], "zh": ["白天僅需監督即可完成如廁動作", "完成如廁動作而不跌倒"]}	{"en": ["Able to walk to toilet using handrails", "Safely transfer from sitting to standing"], "ja": ["手すりを使用してトイレまで歩行できる", "座位から立位への移乗が安全にできる"], "zh": ["能使用扶手步行至廁所", "能安全地從坐姿轉為站姿"]}	{"en": [{"type": "observation", "description": "Observe toileting behavior and fall risk each time"}, {"type": "care", "description": "Walker usage training, handrail utilization support"}, {"type": "education", "description": "Safe toileting technique education"}], "ja": [{"type": "observation", "description": "トイレ動作時の様子、転倒リスクを毎回観察"}, {"type": "care", "description": "歩行器使用指導、手すり活用支援"}, {"type": "education", "description": "安全なトイレ動作の指導"}], "zh": [{"type": "observation", "description": "每次觀察如廁行為及跌倒風險"}, {"type": "care", "description": "助行器使用指導、扶手運用協助"}, {"type": "education", "description": "安全如廁技巧衛教"}]}	2025-10-20 06:01:09.798672
47fc37e5-6fbe-49bf-a899-07156bae3a6e	fall_prevention	転倒リスクが高い	High risk of falling	跌倒風險高	{"en": ["Maintain zero fall incidents for 6 months", "Master safe mobility methods"], "ja": ["6ヶ月間転倒事故ゼロを維持する", "安全な移動方法を習得する"], "zh": ["維持6個月零跌倒事故", "掌握安全移動方法"]}	{"en": ["Able to use walker correctly", "Safely get up from bed"], "ja": ["歩行器を正しく使用できる", "ベッドからの起き上がりが安全にできる"], "zh": ["能正確使用助行器", "能安全地從床上起身"]}	{"en": [{"type": "observation", "description": "Continuous observation of unsteadiness, balance, and gait"}, {"type": "care", "description": "Environmental modifications (remove steps, install handrails)"}, {"type": "education", "description": "Fall prevention lifestyle education"}], "ja": [{"type": "observation", "description": "ふらつき、バランス、歩行状態の継続観察"}, {"type": "care", "description": "環境整備（段差解消、手すり設置）"}, {"type": "education", "description": "転倒予防のための生活指導"}], "zh": [{"type": "observation", "description": "持續觀察不穩、平衡和步態"}, {"type": "care", "description": "環境改善（消除高低差、設置扶手）"}, {"type": "education", "description": "跌倒預防生活指導"}]}	2025-10-20 06:01:09.798672
f71ac19c-46f3-4e5c-b769-f4d8c8bf7ac6	nutrition	食事摂取量の低下	Decreased food intake	進食量減少	{"en": ["Maintain appropriate weight (BMI 18.5-25)", "Achieve 80%+ of required nutritional intake"], "ja": ["適正体重を維持する（BMI 18.5-25）", "必要栄養量の80%以上を摂取できる"], "zh": ["維持適當體重（BMI 18.5-25）", "達到所需營養攝取量的80%以上"]}	{"en": ["Achieve 50%+ intake for 3 meals daily", "Find preferred food textures"], "ja": ["1日3食、50%以上の摂取ができる", "好みの食事形態を見つける"], "zh": ["每日三餐達到50%以上攝取", "找到喜好的食物質地"]}	{"en": [{"type": "observation", "description": "Record food intake and weight changes"}, {"type": "care", "description": "Modify food textures, provide snacks"}, {"type": "education", "description": "Education on importance of nutrition"}], "ja": [{"type": "observation", "description": "食事摂取量、体重変化の記録"}, {"type": "care", "description": "食事形態の工夫、間食の提供"}, {"type": "education", "description": "栄養の重要性について指導"}], "zh": [{"type": "observation", "description": "記錄進食量和體重變化"}, {"type": "care", "description": "調整食物質地、提供點心"}, {"type": "education", "description": "營養重要性衛教"}]}	2025-10-20 06:01:09.798672
030e9ba3-2d9b-4808-a380-cb860dcaa552	pain_management	慢性的な腰痛がある	Chronic low back pain	慢性下背痛	{"en": ["Reduce pain to level that does not interfere with daily living", "Able to self-manage pain"], "ja": ["痛みが日常生活に支障をきたさないレベルまで軽減する", "痛みのセルフマネジメントができる"], "zh": ["將疼痛減輕至不影響日常生活的程度", "能自我管理疼痛"]}	{"en": ["Resting pain reduces to NRS 3 or below", "Implement 3+ pain relief strategies"], "ja": ["安静時の痛みがNRS 3以下になる", "痛み軽減のための工夫を3つ以上実践できる"], "zh": ["靜止時疼痛降至NRS 3以下", "實踐3種以上疼痛緩解策略"]}	{"en": [{"type": "observation", "description": "Daily assessment of pain intensity, location, and quality"}, {"type": "care", "description": "Position changes, heat therapy, massage"}, {"type": "education", "description": "Positioning education for pain relief"}], "ja": [{"type": "observation", "description": "痛みの程度、部位、性質の評価（毎日）"}, {"type": "care", "description": "体位変換、温罨法、マッサージの実施"}, {"type": "education", "description": "痛み軽減のためのポジショニング指導"}], "zh": [{"type": "observation", "description": "每日評估疼痛程度、部位和性質"}, {"type": "care", "description": "變換姿勢、熱敷、按摩"}, {"type": "education", "description": "疼痛緩解姿勢衛教"}]}	2025-10-20 06:01:09.798672
acfddc15-1892-4d12-980a-9210e0e85332	cognition	認知機能の低下（見当識障害）	Cognitive decline (disorientation)	認知功能下降（定向力障礙）	{"en": ["Maintain time and date orientation", "Live peacefully in facility"], "ja": ["日時の見当識を維持する", "穏やかに施設生活を送ることができる"], "zh": ["維持時間和日期定向力", "能平和地在機構生活"]}	{"en": ["Recognize day of week and time of day", "Remember staff faces and names"], "ja": ["曜日と時間帯がわかる", "職員の顔と名前を覚える"], "zh": ["能辨識星期和時段", "記住工作人員的臉和姓名"]}	{"en": [{"type": "observation", "description": "Regular assessment of orientation, memory, and judgment"}, {"type": "care", "description": "Orientation support (calendar and clock use)"}, {"type": "education", "description": "Dementia care education for family"}], "ja": [{"type": "observation", "description": "見当識、記憶力、判断力の定期評価"}, {"type": "care", "description": "オリエンテーション支援（カレンダー、時計の活用）"}, {"type": "education", "description": "家族への認知症ケアの指導"}], "zh": [{"type": "observation", "description": "定期評估定向力、記憶力和判斷力"}, {"type": "care", "description": "定向力支援（利用日曆和時鐘）"}, {"type": "education", "description": "失智症照護家屬衛教"}]}	2025-10-20 06:01:09.798672
a382f7f2-2a5b-4550-81e9-c26e6f17ff80	psychosocial	社会的孤立・活動量の低下	Social isolation and decreased activity	社交孤立與活動量減少	{"en": ["Make close friends within facility", "Find enjoyment and stay active"], "ja": ["施設内で親しい仲間を作る", "楽しみを見つけ、活動的に過ごす"], "zh": ["在機構內建立親密友誼", "找到樂趣並保持活躍"]}	{"en": ["Participate in recreation 3+ times per week", "Enjoy conversations with other residents"], "ja": ["レクリエーションに週3回以上参加する", "他の利用者と会話を楽しむ"], "zh": ["每週參加3次以上康樂活動", "享受與其他住民的交談"]}	{"en": [{"type": "observation", "description": "Observe facial expressions, activity participation, social interactions"}, {"type": "care", "description": "Encourage recreation participation, provide hobby activities"}, {"type": "education", "description": "Explain importance of social participation"}], "ja": [{"type": "observation", "description": "表情、活動参加状況、他者との交流の観察"}, {"type": "care", "description": "レクリエーション参加の声かけ、趣味活動の提供"}, {"type": "education", "description": "社会参加の重要性について説明"}], "zh": [{"type": "observation", "description": "觀察表情、活動參與、與他人互動"}, {"type": "care", "description": "鼓勵參與康樂活動、提供嗜好活動"}, {"type": "education", "description": "說明社交參與的重要性"}]}	2025-10-20 06:01:09.798672
\.


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.staff (staff_id, facility_id, employee_number, family_name, given_name, family_name_kana, given_name_kana, role, username, password_hash, created_at, family_name_en, given_name_en) FROM stdin;
550e8400-e29b-41d4-a716-446655440101	550e8400-e29b-41d4-a716-446655440001	N001	佐藤	美咲	サトウ	ミサキ	registered_nurse	nurse1	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-10-20 06:01:09.798672	Sato	Misaki
550e8400-e29b-41d4-a716-446655440102	550e8400-e29b-41d4-a716-446655440001	N002	鈴木	花子	スズキ	ハナコ	registered_nurse	nurse2	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-10-20 06:01:09.798672	Suzuki	Hanako
550e8400-e29b-41d4-a716-446655440103	550e8400-e29b-41d4-a716-446655440001	D001	田中	健一	タナカ	ケンイチ	physician	doctor1	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-10-20 06:01:09.798672	Tanaka	Kenichi
550e8400-e29b-41d4-a716-446655440104	550e8400-e29b-41d4-a716-446655440001	CM001	田中	博	タナカ	ヒロシ	registered_nurse	manager1	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-11-26 05:39:29.151888	Tanaka	Hiroshi
550e8400-e29b-41d4-a716-446655440105	550e8400-e29b-41d4-a716-446655440001	DEMO001	デモ	職員	デモ	ショクイン	registered_nurse	demo	$2a$10$rTgfWRiyDf6Rp7lLI2WGYu/Q6mLCHWmQ3T.pAodCiv3CdKpCfv84S	2025-11-26 05:39:29.153303	Demo	Staff
\.


--
-- Data for Name: staff_sessions; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.staff_sessions (session_id, staff_id, access_token, refresh_token, device_info, ip_address, expires_at, created_at, last_activity) FROM stdin;
34f0f7d9-9119-47c1-97a0-0c95ab4a0863	550e8400-e29b-41d4-a716-446655440103	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAzIiwidXNlcm5hbWUiOiJkb2N0b3IxIiwicm9sZSI6ImRvY3RvciIsImZhY2lsaXR5SWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDEiLCJpYXQiOjE3NjQxMzY1NDQsImV4cCI6MTc2NDE2NTM0NH0.41guoXLPPezlubBRf4bipkNItJK2Nnw2VjDR_Jz_LSo	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAzIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjQxMzY1NDQsImV4cCI6MTc2NDc0MTM0NH0.cHh4_bm36NinmkVUHdj8grDBI2W_HrGhUgJEH_wiGJw	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.18.0.4	2025-11-26 13:55:44.086	2025-11-26 05:55:44.086981	2025-11-26 05:55:44.086981
fcedb054-37d0-4078-a9c2-c17ef89cf46f	550e8400-e29b-41d4-a716-446655440101	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAxIiwidXNlcm5hbWUiOiJudXJzZTEiLCJyb2xlIjoibnVyc2UiLCJmYWNpbGl0eUlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAxIiwiaWF0IjoxNzY0MTM2OTEyLCJleHAiOjE3NjQxNjU3MTJ9.AFXpvaBHbICFSbDGzTabtwPfl0g532lzf7ZY0RAgeM0	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAxIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjQxMzY5MTIsImV4cCI6MTc2NDc0MTcxMn0.Eu38E5m2FISr7Iu_1_LA2AOKi6Vo6D4z3Lx3Ysa5KQU	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.18.0.4	2025-11-26 14:01:52.352	2025-11-26 06:01:52.352855	2025-11-26 06:01:52.352855
e112402b-3452-4e63-87a2-5794c73ae4b2	550e8400-e29b-41d4-a716-446655440101	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAxIiwidXNlcm5hbWUiOiJudXJzZTEiLCJyb2xlIjoibnVyc2UiLCJmYWNpbGl0eUlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAxIiwiaWF0IjoxNzY0MTM4NzY0LCJleHAiOjE3NjQxNjc1NjR9.nT0c1A1uv-ScI_ixJzGm5MpYPMuAXRwdtsWlTVHSdE4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGFmZklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMTAxIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3NjQxMzg3NjQsImV4cCI6MTc2NDc0MzU2NH0.a_CofoFo_jJtRkE9lVl6BghxLmOFHxULKLfdJoyRZrU	{"platform": "ios", "appVersion": "1.0.0"}	::ffff:172.18.0.4	2025-11-26 14:32:44.897	2025-11-26 06:32:44.897342	2025-11-26 06:32:44.897342
\.


--
-- Data for Name: vital_signs; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.vital_signs (vital_sign_id, patient_id, measured_at, temperature_celsius, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, respiratory_rate, oxygen_saturation, pain_score, blood_glucose_mg_dl, weight_kg, height_cm, input_method, device_id, recorded_by, created_at) FROM stdin;
267c73b7-0e96-4253-81e7-ec84bc6551d8	550e8400-e29b-41d4-a716-446655440202	2025-10-20 03:01:09.798672	37.2	120	75	72	14	99	2	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440102	2025-10-20 06:01:09.798672
ad15fe46-0ac6-4b19-ae78-5db815bad639	550e8400-e29b-41d4-a716-446655440204	2025-10-20 05:31:09.798672	37.1	115	72	88	18	96	4	\N	\N	\N	voice	\N	550e8400-e29b-41d4-a716-446655440102	2025-10-20 06:01:09.798672
ca7b5e09-c2a6-44ea-a800-34d93cb3ae18	550e8400-e29b-41d4-a716-446655440201	2025-11-06 04:18:38.935	\N	112	61	49	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 04:18:38.943949
61487e64-27cb-4225-997d-be23d9df0125	550e8400-e29b-41d4-a716-446655440201	2025-11-06 05:41:50.378	\N	139	74	55	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 05:41:50.387192
fb0835c5-8319-4c08-bff8-4e3e883a3d7a	550e8400-e29b-41d4-a716-446655440201	2025-11-06 05:43:30.203	\N	113	67	59	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 05:43:30.213291
8d498fcf-eeb2-40fc-a058-8eefd52ae487	550e8400-e29b-41d4-a716-446655440201	2025-11-06 06:55:02.352	\N	112	67	47	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 06:55:02.360881
f700ebf0-5bc3-45d2-bd3d-4cdc8636af28	550e8400-e29b-41d4-a716-446655440201	2025-11-06 07:00:44.145	\N	93	64	64	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 07:00:44.153767
08484a31-21af-4634-b9fb-cbe6be78a363	550e8400-e29b-41d4-a716-446655440201	2025-11-06 07:04:40.691	\N	112	67	47	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 07:04:40.700516
cf7cddd7-7a3d-4b0e-ae77-1b78a39a245b	550e8400-e29b-41d4-a716-446655440201	2025-11-06 07:04:40.74	\N	112	67	47	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 07:04:40.74089
e6808af7-8c20-4f71-aa62-ca17c96338a6	550e8400-e29b-41d4-a716-446655440201	2025-11-06 07:09:12.429	\N	125	69	51	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 07:09:12.429973
08010866-5faf-448e-a8e9-0261204f06ec	550e8400-e29b-41d4-a716-446655440201	2025-11-06 07:09:12.475	\N	125	69	51	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 07:09:12.475323
d1626b58-4ef7-4bbc-b9b3-abd0693d16d6	550e8400-e29b-41d4-a716-446655440201	2025-11-06 07:52:46.974	\N	110	60	51	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 07:52:46.9836
4e0dac01-c9da-4a72-a331-a6b3b60553c4	550e8400-e29b-41d4-a716-446655440201	2025-11-06 07:52:47.022	\N	110	60	51	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 07:52:47.023074
cac7fd2f-3495-46af-8dc2-308145fb53fa	550e8400-e29b-41d4-a716-446655440201	2025-11-06 08:23:09.46	\N	132	65	62	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 08:23:09.467424
87fbce5c-9872-4040-adc7-e6be1a64801b	550e8400-e29b-41d4-a716-446655440201	2025-11-08 06:30:23.727	\N	124	70	57	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-08 06:30:23.734475
ea1ca941-ea2f-48d1-b210-fb8bf98e4cf3	550e8400-e29b-41d4-a716-446655440201	2025-11-10 01:45:49.81	\N	102	56	39	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:45:49.818806
ae866596-3402-47e9-baef-71bf477873a0	550e8400-e29b-41d4-a716-446655440201	2025-11-11 01:41:23.118	37.3	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 01:41:23.118336
76d40f5f-1806-4518-8a3f-934103e3c0dd	550e8400-e29b-41d4-a716-446655440202	2025-10-31 02:12:55.893	35.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-10-31 02:17:35.263396
16e3c9e6-e881-4897-a707-8b9078a98ae9	550e8400-e29b-41d4-a716-446655440202	2025-10-31 02:12:55.893	35.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-10-31 02:18:32.957679
f96d9b30-988f-455b-bddf-04a9a24e9b16	550e8400-e29b-41d4-a716-446655440202	2025-10-31 02:12:55.893	35.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-10-31 02:20:10.138947
eff3a716-0d50-4690-828c-000a90941fe3	550e8400-e29b-41d4-a716-446655440202	2025-10-31 04:50:06.662	35.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-10-31 04:50:50.587616
dbd8a7cc-c542-4aa9-a46b-ab5d495628f6	550e8400-e29b-41d4-a716-446655440201	2025-11-06 04:18:38.059	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-06 04:18:49.245635
ec8b7b9e-8ff5-420c-85a1-9cfa2f16cbb2	550e8400-e29b-41d4-a716-446655440201	2025-11-10 01:48:50.808	34.8	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:48:57.733231
fe1961b6-0bb1-4acb-b009-824dccd3c34c	550e8400-e29b-41d4-a716-446655440201	2025-11-10 01:52:15.728	34.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:52:19.392902
0568b3f8-5307-435b-a44f-fc5a990bbcf2	550e8400-e29b-41d4-a716-446655440201	2025-11-10 01:55:51.499	35.8	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:55:55.781282
6a4e481a-35fd-4e3a-a41a-dd5d34a523b8	550e8400-e29b-41d4-a716-446655440201	2025-11-10 01:56:28.567	38.2	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-10 01:56:43.44619
3e1e911c-8c16-4406-9122-c7454883187d	550e8400-e29b-41d4-a716-446655440201	2025-11-10 02:05:37.656	36.8	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-10 02:05:45.742316
9409c3ca-5616-4be4-9a95-7964ab3c3fe7	550e8400-e29b-41d4-a716-446655440201	2025-11-11 00:38:04.412	37.3	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 00:38:04.412895
39ec3c4f-7558-45d1-9b52-6f6fd39e1f9f	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:08:54.028	\N	134	70	39	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:08:54.036698
19221113-e300-4cde-be24-8726570e4390	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:09:12.286	37.0	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:09:12.286273
1f3ab7bb-9aa8-4c42-943b-bc4727617686	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:17:08.346	\N	104	64	34	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:17:08.355574
9e940a68-c5c3-45e1-b579-a5691ea2c10e	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:17:24.458	34.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:17:24.45863
7fee1f72-a261-49be-8c85-9b479a690c79	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:27:09.724	\N	105	73	35	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:27:09.724428
aa9dcd03-d0e1-4cc9-b59f-093fb356ff16	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:27:20.207	34.8	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:27:20.20755
acd474b0-e4c6-40be-b65c-71a3abb1a0d2	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:36:59.194	\N	113	67	38	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:36:59.204674
7ff051cc-7655-4968-96c5-fab64eb48304	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:37:14.994	35.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:37:14.995183
0ef468db-4c8f-4758-9807-1b94a3b6665e	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:42:17.27	\N	106	66	34	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:42:17.280562
ba7a18f6-5151-4a9d-8156-ed78a536c8b1	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:43:36.944	37.9	\N	\N	\N	\N	\N	\N	\N	\N	\N	manual	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:43:36.944704
ee31e9b3-fefe-4b24-a717-96d623e1d0e6	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:52:35.973	\N	112	66	36	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:52:35.981483
74d6eeee-9c67-40e0-8482-6033e5e258f0	550e8400-e29b-41d4-a716-446655440201	2025-11-11 02:53:26.98	\N	108	64	36	\N	\N	\N	\N	\N	\N	iot_sensor	\N	550e8400-e29b-41d4-a716-446655440101	2025-11-11 02:53:26.989733
\.


--
-- Data for Name: voice_recordings; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.voice_recordings (recording_id, patient_id, recorded_at, duration_seconds, audio_file_path, transcription_text, transcription_language, ai_structured_extraction, ai_confidence_score, processing_status, processing_started_at, processing_completed_at, processing_error, recorded_by, created_at) FROM stdin;
\.


--
-- Data for Name: weekly_schedule_items; Type: TABLE DATA; Schema: public; Owner: nagare
--

COPY public.weekly_schedule_items (schedule_item_id, care_plan_id, day_of_week, time_slot, specific_time, service_data, linked_to_care_plan_item, frequency, created_at) FROM stdin;
\.


--
-- Name: medication_administrations_chain_sequence_seq; Type: SEQUENCE SET; Schema: public; Owner: nagare
--

SELECT pg_catalog.setval('public.medication_administrations_chain_sequence_seq', 1, true);


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
-- Name: voice_recordings voice_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.voice_recordings
    ADD CONSTRAINT voice_recordings_pkey PRIMARY KEY (recording_id);


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
-- Name: care_plan_audit_log trigger_ensure_audit_user_name; Type: TRIGGER; Schema: public; Owner: nagare
--

CREATE TRIGGER trigger_ensure_audit_user_name BEFORE INSERT OR UPDATE ON public.care_plan_audit_log FOR EACH ROW EXECUTE FUNCTION public.ensure_audit_user_name();


--
-- Name: auth_audit_log auth_audit_log_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagare
--

ALTER TABLE ONLY public.auth_audit_log
    ADD CONSTRAINT auth_audit_log_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(staff_id);


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

\unrestrict fKBn516NFkSNcGLsqImDiKjjaShFGleE7GPCF4GcOvJpNSViIxdSP9ChqErIHeX

