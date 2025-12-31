-- Migration 014: Create streaming_sessions table for real-time voice transcription
-- Requirements: 4.1, 4.2 (Session management for streaming)
-- 
-- This migration creates the streaming_sessions table to track active and completed
-- streaming transcription sessions. Sessions are used to manage real-time audio
-- streaming with progressive transcription.

-- Create streaming_sessions table
CREATE TABLE IF NOT EXISTS streaming_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    context_type VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (context_type IN ('patient', 'global')),
    language VARCHAR(10) NOT NULL DEFAULT 'ja' CHECK (language IN ('ja', 'en', 'zh-TW')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'processing', 'completed', 'failed', 'cancelled')),
    transcription_buffer TEXT,
    chunk_count INTEGER DEFAULT 0,
    total_audio_duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient queries
-- Index for cleanup queries (find idle/stale sessions)
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_status_activity 
    ON streaming_sessions(status, last_activity_at);

-- Index for user's active sessions
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_user_status 
    ON streaming_sessions(user_id, status);

-- Index for patient context queries
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_patient 
    ON streaming_sessions(patient_id) 
    WHERE patient_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE streaming_sessions IS 'Tracks real-time voice streaming sessions for progressive transcription';
COMMENT ON COLUMN streaming_sessions.session_id IS 'Unique identifier for the streaming session';
COMMENT ON COLUMN streaming_sessions.user_id IS 'User who initiated the streaming session';
COMMENT ON COLUMN streaming_sessions.patient_id IS 'Optional patient context for the recording';
COMMENT ON COLUMN streaming_sessions.context_type IS 'Whether recording is patient-specific or global';
COMMENT ON COLUMN streaming_sessions.language IS 'Language for transcription (ja, en, zh-TW)';
COMMENT ON COLUMN streaming_sessions.status IS 'Current session status';
COMMENT ON COLUMN streaming_sessions.transcription_buffer IS 'Accumulated transcription text';
COMMENT ON COLUMN streaming_sessions.chunk_count IS 'Number of audio chunks received';
COMMENT ON COLUMN streaming_sessions.total_audio_duration_ms IS 'Total audio duration in milliseconds';
COMMENT ON COLUMN streaming_sessions.last_activity_at IS 'Last activity timestamp for idle detection';
COMMENT ON COLUMN streaming_sessions.completed_at IS 'When the session was completed';
COMMENT ON COLUMN streaming_sessions.error_message IS 'Error message if session failed';
COMMENT ON COLUMN streaming_sessions.metadata IS 'Additional session metadata as JSON';
