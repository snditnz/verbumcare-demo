-- Migration 015: Add streaming columns to voice_recordings table
-- Requirements: 1.1 (Real-time streaming support)
-- 
-- This migration adds columns to track streaming-related information
-- for voice recordings, enabling correlation between streaming sessions
-- and final recordings.

-- Add streaming-related columns to voice_recordings
ALTER TABLE voice_recordings 
    ADD COLUMN IF NOT EXISTS streaming_session_id UUID REFERENCES streaming_sessions(session_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_streamed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS streaming_started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS streaming_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for streaming session lookups
CREATE INDEX IF NOT EXISTS idx_voice_recordings_streaming_session 
    ON voice_recordings(streaming_session_id) 
    WHERE streaming_session_id IS NOT NULL;

-- Create index for streamed recordings
CREATE INDEX IF NOT EXISTS idx_voice_recordings_is_streamed 
    ON voice_recordings(is_streamed) 
    WHERE is_streamed = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN voice_recordings.streaming_session_id IS 'Reference to the streaming session that created this recording';
COMMENT ON COLUMN voice_recordings.is_streamed IS 'Whether this recording was created via streaming (true) or upload (false)';
COMMENT ON COLUMN voice_recordings.chunk_count IS 'Number of audio chunks received during streaming';
COMMENT ON COLUMN voice_recordings.streaming_started_at IS 'When streaming started for this recording';
COMMENT ON COLUMN voice_recordings.streaming_completed_at IS 'When streaming completed for this recording';
