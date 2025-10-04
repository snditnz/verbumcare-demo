-- Migration: Add bilingual support for voice recordings
-- This migration adds columns for processing status and ensures JSONB can store bilingual data

-- Add processing status columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='voice_recordings' AND column_name='processing_status') THEN
        ALTER TABLE voice_recordings ADD COLUMN processing_status VARCHAR(50) DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='voice_recordings' AND column_name='processing_started_at') THEN
        ALTER TABLE voice_recordings ADD COLUMN processing_started_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='voice_recordings' AND column_name='processing_completed_at') THEN
        ALTER TABLE voice_recordings ADD COLUMN processing_completed_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='voice_recordings' AND column_name='processing_error') THEN
        ALTER TABLE voice_recordings ADD COLUMN processing_error TEXT;
    END IF;
END $$;

-- Add comment explaining the bilingual JSONB structure
COMMENT ON COLUMN voice_recordings.ai_structured_extraction IS
'Bilingual structured data: {ja: {...}, en: {...}}. Both Japanese and English versions of extracted medical data.';

-- Create index on processing status for faster queries
CREATE INDEX IF NOT EXISTS idx_voice_recordings_processing_status
ON voice_recordings(processing_status);

-- Create index on JSONB for faster language-specific queries
CREATE INDEX IF NOT EXISTS idx_voice_recordings_extraction_ja
ON voice_recordings USING GIN ((ai_structured_extraction->'ja'));

CREATE INDEX IF NOT EXISTS idx_voice_recordings_extraction_en
ON voice_recordings USING GIN ((ai_structured_extraction->'en'));
