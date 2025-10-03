import path from 'path';
import db from '../db/index.js';
import { processVoiceToStructured, validateStructuredData } from './aiExtraction.js';

/**
 * Background Voice Processing Service
 * Processes audio files asynchronously without blocking HTTP requests
 * Supports long-running AI operations (Whisper + Ollama)
 */

class BackgroundProcessor {
  constructor() {
    this.activeJobs = new Map();
    this.io = null;
  }

  /**
   * Set Socket.IO instance for real-time updates
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Emit progress update via Socket.IO
   */
  emitProgress(recordingId, data) {
    if (this.io) {
      this.io.emit('voice-processing-progress', {
        recording_id: recordingId,
        ...data
      });
    }
  }

  /**
   * Process voice recording in background
   * @param {string} recordingId - Recording UUID
   * @param {object} options - Processing options
   * @returns {Promise<void>}
   */
  async processRecording(recordingId, options = {}) {
    const { language = 'ja', manual_corrections = null } = options;

    // Check if already processing
    if (this.activeJobs.has(recordingId)) {
      console.warn(`⚠️  Recording ${recordingId} is already being processed`);
      return;
    }

    this.activeJobs.set(recordingId, { status: 'starting', startedAt: new Date() });

    try {
      // Update status to processing
      await db.query(
        `UPDATE voice_recordings
         SET processing_status = 'processing',
             processing_started_at = NOW()
         WHERE recording_id = $1`,
        [recordingId]
      );

      this.emitProgress(recordingId, {
        status: 'processing',
        phase: 'starting',
        message: 'Starting AI processing...'
      });

      // Fetch recording details
      const recordingQuery = `
        SELECT vr.*, p.family_name, p.given_name, p.room, p.bed
        FROM voice_recordings vr
        LEFT JOIN patients p ON vr.patient_id = p.patient_id
        WHERE vr.recording_id = $1
      `;

      const recordingResult = await db.query(recordingQuery, [recordingId]);
      if (recordingResult.rows.length === 0) {
        throw new Error('Recording not found');
      }

      const recording = recordingResult.rows[0];
      const audioFilePath = path.join(process.cwd(), recording.audio_file_path);

      const patientInfo = {
        name: `${recording.family_name || ''} ${recording.given_name || ''}`.trim(),
        room: recording.room,
        bed: recording.bed
      };

      this.emitProgress(recordingId, {
        status: 'processing',
        phase: 'transcription',
        message: 'Transcribing audio with Whisper...'
      });

      // Process with AI
      const processedData = await processVoiceToStructured(
        audioFilePath,
        recording.transcription_language || language,
        patientInfo
      );

      this.emitProgress(recordingId, {
        status: 'processing',
        phase: 'extraction',
        message: 'Extracting structured data with Ollama...',
        progress: 50
      });

      // Apply manual corrections if provided
      let finalStructuredData = processedData.structuredData;
      if (manual_corrections) {
        const { mergeWithManualInput } = await import('./aiExtraction.js');
        finalStructuredData = mergeWithManualInput(processedData.structuredData, manual_corrections);
      }

      // Validate
      const validation = validateStructuredData(finalStructuredData);

      this.emitProgress(recordingId, {
        status: 'processing',
        phase: 'saving',
        message: 'Saving results...',
        progress: 90
      });

      // Save results
      const updateQuery = `
        UPDATE voice_recordings
        SET
          transcription_text = $1,
          ai_structured_extraction = $2,
          ai_confidence_score = $3,
          processing_status = 'completed',
          processing_completed_at = NOW(),
          processing_error = NULL
        WHERE recording_id = $4
        RETURNING *
      `;

      const updateValues = [
        processedData.transcription,
        JSON.stringify(finalStructuredData),
        processedData.confidence,
        recordingId
      ];

      const updateResult = await db.query(updateQuery, updateValues);

      // Emit completion
      this.emitProgress(recordingId, {
        status: 'completed',
        phase: 'done',
        message: 'Processing complete',
        progress: 100,
        data: {
          recording: updateResult.rows[0],
          transcription: processedData.transcription,
          structured_data: finalStructuredData,
          clinical_note: processedData.clinicalNote,
          confidence: processedData.confidence,
          validation: validation,
          language: processedData.language
        }
      });

      console.log(`✅ Background processing completed for ${recordingId}`);

    } catch (error) {
      console.error(`❌ Background processing failed for ${recordingId}:`, error);

      // Save error
      await db.query(
        `UPDATE voice_recordings
         SET processing_status = 'failed',
             processing_completed_at = NOW(),
             processing_error = $1
         WHERE recording_id = $2`,
        [error.message, recordingId]
      );

      // Emit error
      this.emitProgress(recordingId, {
        status: 'failed',
        phase: 'error',
        message: error.message,
        error: error.message
      });

    } finally {
      this.activeJobs.delete(recordingId);
    }
  }

  /**
   * Get status of a processing job
   */
  getJobStatus(recordingId) {
    return this.activeJobs.get(recordingId) || null;
  }

  /**
   * Get list of active jobs
   */
  getActiveJobs() {
    return Array.from(this.activeJobs.entries()).map(([id, status]) => ({
      recording_id: id,
      ...status
    }));
  }
}

// Singleton instance
const backgroundProcessor = new BackgroundProcessor();

export default backgroundProcessor;
