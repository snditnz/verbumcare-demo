-- Migration: Create clinical_notes table for nurse and doctor notes
-- Description: Supports immediate-save notes with voice recording, categorization,
--              follow-up tracking, and approval workflow

CREATE TABLE IF NOT EXISTS clinical_notes (
    note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,

    -- Note metadata
    note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('nurse_note', 'doctor_note', 'care_note')),
    note_category VARCHAR(50) CHECK (note_category IN (
        'symptom_observation',  -- 症状観察
        'treatment',            -- 処置
        'consultation',         -- 相談
        'fall_incident',        -- 転倒
        'medication',           -- 投薬
        'vital_signs',          -- バイタルサイン
        'behavioral',           -- 行動観察
        'other'                 -- その他
    )),
    note_datetime TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Note content
    note_text TEXT NOT NULL,

    -- Voice recording support
    voice_recording_id UUID REFERENCES voice_recordings(recording_id) ON DELETE SET NULL,
    voice_transcribed BOOLEAN DEFAULT false,

    -- Author information
    authored_by UUID NOT NULL REFERENCES staff(staff_id),
    author_role VARCHAR(50) NOT NULL,
    author_name VARCHAR(200) NOT NULL,

    -- Follow-up tracking
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Related data
    related_assessment_id UUID REFERENCES nursing_assessments(assessment_id) ON DELETE SET NULL,
    related_session_id UUID REFERENCES patient_session_data(session_id) ON DELETE SET NULL,

    -- Approval workflow
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES staff(staff_id),
    approved_by_name VARCHAR(200),
    approval_datetime TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES staff(staff_id)
);

-- Indexes for performance
CREATE INDEX idx_clinical_notes_patient_id ON clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_datetime ON clinical_notes(note_datetime DESC);
CREATE INDEX idx_clinical_notes_note_type ON clinical_notes(note_type);
CREATE INDEX idx_clinical_notes_status ON clinical_notes(status);
CREATE INDEX idx_clinical_notes_authored_by ON clinical_notes(authored_by);
CREATE INDEX idx_clinical_notes_follow_up ON clinical_notes(follow_up_required, follow_up_date) WHERE follow_up_required = true;
CREATE INDEX idx_clinical_notes_approval ON clinical_notes(requires_approval, status) WHERE requires_approval = true AND status = 'submitted';

-- Composite index for common query patterns
CREATE INDEX idx_clinical_notes_patient_datetime ON clinical_notes(patient_id, note_datetime DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clinical_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_clinical_notes_updated_at
    BEFORE UPDATE ON clinical_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_clinical_notes_updated_at();

-- Comments for documentation
COMMENT ON TABLE clinical_notes IS 'Clinical notes from nurses and doctors with voice recording support, categorization, follow-up tracking, and approval workflow';
COMMENT ON COLUMN clinical_notes.note_type IS 'Type of note: nurse_note (看護記録), doctor_note (医師記録), care_note (介護記録)';
COMMENT ON COLUMN clinical_notes.note_category IS 'Category of note for filtering and reporting';
COMMENT ON COLUMN clinical_notes.requires_approval IS 'True if note requires doctor approval (e.g., certain nurse observations)';
COMMENT ON COLUMN clinical_notes.status IS 'Workflow status: draft (not saved yet), submitted (visible), approved (co-signed), rejected (needs revision)';
