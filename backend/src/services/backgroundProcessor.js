import path from 'path';
import db from '../db/index.js';
import { processVoiceToStructured, validateStructuredData } from './aiExtraction.js';
import ollamaService from './ollamaService.js';
import voiceEncryptionService from './voiceEncryption.js';
import categorizationService from './categorizationService.js';
import reviewQueueService from './reviewQueueService.js';

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

      // Phase 3: Translation to English
      this.emitProgress(recordingId, {
        status: 'processing',
        phase: 'translation',
        message: 'Translating to English...',
        progress: 75
      });

      let englishStructuredData = null;
      let englishClinicalNote = null;

      try {
        // Translate structured data
        const translationResult = await ollamaService.translateToEnglish(finalStructuredData);
        englishStructuredData = translationResult.data;

        // Translate clinical note if it exists
        if (processedData.clinicalNote) {
          const noteTranslation = await ollamaService.translateToEnglish({
            clinical_note: processedData.clinicalNote
          });
          englishClinicalNote = noteTranslation.data.clinical_note;
        }

        console.log('✅ Translation to English completed');
      } catch (translationError) {
        console.warn('⚠️  Translation failed, continuing with Japanese only:', translationError.message);
        // Continue processing even if translation fails - we have Japanese data
      }

      // Create bilingual data structure
      const bilingualStructuredData = {
        ja: finalStructuredData,
        en: englishStructuredData || finalStructuredData  // Fallback to Japanese if translation failed
      };

      const bilingualClinicalNote = {
        ja: processedData.clinicalNote,
        en: englishClinicalNote || processedData.clinicalNote  // Fallback to Japanese if translation failed
      };

      // Validate
      const validation = validateStructuredData(finalStructuredData);

      this.emitProgress(recordingId, {
        status: 'processing',
        phase: 'saving',
        message: 'Saving results...',
        progress: 90
      });

      // Encrypt transcription before storage
      let encryptedTranscription = processedData.transcription;
      try {
        console.log('🔒 Encrypting transcription...');
        const transcriptionData = JSON.stringify({
          text: processedData.transcription,
          language: processedData.language,
          timestamp: new Date().toISOString()
        });
        
        const { encrypted } = await voiceEncryptionService.encryptTranscription(
          transcriptionData,
          recording.recorded_by
        );
        
        // Store as base64 for database compatibility
        encryptedTranscription = encrypted.toString('base64');
        console.log('✅ Transcription encrypted');
      } catch (encryptionError) {
        console.error('⚠️  Transcription encryption failed:', encryptionError);
        // Continue with unencrypted transcription (fallback)
      }

      // Save results with bilingual data
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
        encryptedTranscription,  // Store encrypted transcription
        JSON.stringify(bilingualStructuredData),  // Store both ja and en
        processedData.confidence,
        recordingId
      ];

      const updateResult = await db.query(updateQuery, updateValues);

      // Call categorization service to detect categories and extract data
      this.emitProgress(recordingId, {
        status: 'processing',
        phase: 'categorization',
        message: 'Categorizing voice data...',
        progress: 95
      });

      try {
        console.log('🔍 Starting AI categorization...');
        const categorization = await categorizationService.categorizeAndExtract(
          processedData.transcription,
          processedData.language
        );

        console.log('✅ Categorization complete:', categorization.categories);

        // Create review queue item
        const reviewItem = await reviewQueueService.createReviewItem({
          recording_id: recordingId,
          user_id: recording.recorded_by,
          context_type: recording.context_type || 'global',
          context_patient_id: recording.context_patient_id,
          transcript: processedData.transcription,
          transcript_language: processedData.language,
          extracted_data: categorization.extractedData,
          confidence_score: categorization.overallConfidence,
          processing_time_ms: Date.now() - this.activeJobs.get(recordingId).startedAt.getTime(),
          model_version: 'llama3.1:8b'
        });

        console.log('✅ Review queue item created:', reviewItem.review_id);

        // Log categorization details
        await db.query(
          `INSERT INTO voice_categorization_log 
           (review_id, detected_categories, extraction_prompt, extraction_response)
           VALUES ($1, $2, $3, $4)`,
          [
            reviewItem.review_id,
            JSON.stringify(categorization.categories),
            categorization.prompt || '',
            JSON.stringify(categorization.extractedData)
          ]
        );

      } catch (categorizationError) {
        console.error('⚠️  Categorization failed:', categorizationError);
        // Continue without categorization - user can still review raw transcript
      }

      // Emit completion with bilingual data
      this.emitProgress(recordingId, {
        status: 'completed',
        phase: 'done',
        message: 'Processing complete',
        progress: 100,
        data: {
          recording: updateResult.rows[0],
          transcription: processedData.transcription,
          structured_data: bilingualStructuredData,  // Both ja and en
          clinical_note: bilingualClinicalNote,      // Both ja and en
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

      // Emit error notification
      this.emitProgress(recordingId, {
        status: 'failed',
        phase: 'error',
        message: error.message,
        error: error.message
      });

      // Also emit to user-specific room for error notification
      if (this.io) {
        this.io.to(`user:${recording.recorded_by}`).emit('voice-processing-error', {
          recording_id: recordingId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

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
