import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';
import { processVoiceToStructured, validateStructuredData } from '../services/aiExtraction.js';
import backgroundProcessor from '../services/backgroundProcessor.js';
import voiceEncryptionService from '../services/voiceEncryption.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'voice');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    console.log('File upload - mimetype:', file.mimetype, 'originalname:', file.originalname);
    const allowedTypes = /^audio\/(mpeg|wav|mp4|m4a|ogg|webm|x-m4a|mp3)$/i;
    const allowedExtensions = /\.(mp3|wav|m4a|ogg|webm)$/i;

    if (allowedTypes.test(file.mimetype) || allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      console.error('File rejected - mimetype:', file.mimetype, 'filename:', file.originalname);
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id, recorded_by, duration_seconds } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
        language
      });
    }

    if (!patient_id || !recorded_by) {
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    const recordingId = uuidv4();
    const relativePath = path.relative(process.cwd(), req.file.path);

    // Encrypt audio file immediately after upload
    try {
      console.log('🔒 Encrypting uploaded audio file...');
      const encryptedPath = await voiceEncryptionService.encryptAudioFile(req.file.path, recorded_by);
      
      // Delete original unencrypted file
      await voiceEncryptionService.secureDelete(req.file.path);
      
      console.log('✅ Audio file encrypted and original deleted');
    } catch (encryptionError) {
      console.error('⚠️  Audio encryption failed:', encryptionError);
      // Continue with unencrypted file (fallback for compatibility)
      // In production, you might want to fail here instead
    }

    const query = `
      INSERT INTO voice_recordings (
        recording_id, patient_id, recorded_at, duration_seconds,
        audio_file_path, transcription_language, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      recordingId,
      patient_id,
      new Date(),
      duration_seconds || null,
      relativePath,
      language,
      recorded_by
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      data: {
        recording_id: recordingId,
        file_path: relativePath,
        encrypted: true,
        ...result.rows[0]
      },
      language,
      message: 'Voice recording uploaded and encrypted successfully'
    });
  } catch (error) {
    console.error('Error uploading voice recording:', error);
    const language = detectLanguage(req);

    if (req.file) {
      try {
        await voiceEncryptionService.secureDelete(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.post('/process', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { recording_id, manual_corrections, async = true } = req.body;

    if (!recording_id) {
      return res.status(400).json({
        success: false,
        error: 'Recording ID is required',
        language
      });
    }

    // Check if recording exists
    const recordingQuery = `
      SELECT recording_id, audio_file_path, processing_status
      FROM voice_recordings
      WHERE recording_id = $1
    `;

    const recordingResult = await db.query(recordingQuery, [recording_id]);

    if (recordingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found',
        language
      });
    }

    const recording = recordingResult.rows[0];

    // Check if already processed
    if (recording.processing_status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Recording already processed',
        language
      });
    }

    // Check if currently processing
    if (recording.processing_status === 'processing') {
      return res.status(409).json({
        success: false,
        error: 'Recording is already being processed',
        processing_status: 'processing',
        language
      });
    }

    // Verify audio file exists
    const audioFilePath = path.join(process.cwd(), recording.audio_file_path);
    const fileExists = await fs.access(audioFilePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return res.status(404).json({
        success: false,
        error: 'Audio file not found',
        language
      });
    }

    // Start background processing (async by default)
    if (async !== false) {
      // Start background job (don't await)
      // NOTE: Language is for transcription, translation to English happens automatically
      backgroundProcessor.processRecording(recording_id, {
        language,  // Transcription language (ja, en, zh-TW)
        manual_corrections
      }).catch(err => {
        console.error('Background processing error:', err);
      });

      // Return immediately
      return res.status(202).json({
        success: true,
        message: 'Processing started',
        recording_id,
        processing_status: 'processing',
        language,
        status_url: `/api/voice/status/${recording_id}`
      });
    }

    // Synchronous fallback (for compatibility)
    console.warn('⚠️  Synchronous processing requested - may timeout on long operations');

    const recordingDetails = await db.query(
      `SELECT vr.*, p.family_name, p.given_name, p.room, p.bed
       FROM voice_recordings vr
       LEFT JOIN patients p ON vr.patient_id = p.patient_id
       WHERE vr.recording_id = $1`,
      [recording_id]
    );

    const rec = recordingDetails.rows[0];
    const patientInfo = {
      name: `${rec.family_name || ''} ${rec.given_name || ''}`.trim(),
      room: rec.room,
      bed: rec.bed
    };

    // Extract in Japanese first (native language)
    const processedData = await processVoiceToStructured(
      audioFilePath,
      rec.transcription_language || language,
      patientInfo
    );

    let finalStructuredData = processedData.structuredData;
    if (manual_corrections) {
      const { mergeWithManualInput } = await import('../services/aiExtraction.js');
      finalStructuredData = mergeWithManualInput(processedData.structuredData, manual_corrections);
    }

    // Translate to English
    const ollamaService = (await import('../services/ollamaService.js')).default;
    let englishStructuredData = null;
    let englishClinicalNote = null;

    try {
      const translationResult = await ollamaService.translateToEnglish(finalStructuredData);
      englishStructuredData = translationResult.data;

      if (processedData.clinicalNote) {
        const noteTranslation = await ollamaService.translateToEnglish({
          clinical_note: processedData.clinicalNote
        });
        englishClinicalNote = noteTranslation.data.clinical_note;
      }
    } catch (translationError) {
      console.warn('⚠️  Translation failed, continuing with Japanese only:', translationError.message);
    }

    // Create bilingual data
    const bilingualStructuredData = {
      ja: finalStructuredData,
      en: englishStructuredData || finalStructuredData
    };

    const bilingualClinicalNote = {
      ja: processedData.clinicalNote,
      en: englishClinicalNote || processedData.clinicalNote
    };

    const validation = validateStructuredData(finalStructuredData);

    const updateQuery = `
      UPDATE voice_recordings
      SET
        transcription_text = $1,
        ai_structured_extraction = $2,
        ai_confidence_score = $3,
        processing_status = 'completed',
        processing_completed_at = NOW()
      WHERE recording_id = $4
      RETURNING *
    `;

    const updateValues = [
      processedData.transcription,
      JSON.stringify(bilingualStructuredData),
      processedData.confidence,
      recording_id
    ];

    const updateResult = await db.query(updateQuery, updateValues);

    res.json({
      success: true,
      data: {
        recording: updateResult.rows[0],
        transcription: processedData.transcription,
        structured_data: bilingualStructuredData,
        clinical_note: bilingualClinicalNote,
        confidence: processedData.confidence,
        validation: validation,
        language: processedData.language
      },
      language,
      message: getTranslation('voice_processing', language)
    });
  } catch (error) {
    console.error('Error processing voice recording:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/status/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;

    const query = `
      SELECT
        recording_id,
        processing_status,
        processing_started_at,
        processing_completed_at,
        processing_error,
        transcription_text,
        ai_structured_extraction,
        ai_confidence_score
      FROM voice_recordings
      WHERE recording_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found',
        language
      });
    }

    const recording = result.rows[0];

    res.json({
      success: true,
      data: {
        recording_id: recording.recording_id,
        status: recording.processing_status,
        started_at: recording.processing_started_at,
        completed_at: recording.processing_completed_at,
        error: recording.processing_error,
        // Include results if completed
        ...(recording.processing_status === 'completed' && {
          transcription: recording.transcription_text,
          structured_data: recording.ai_structured_extraction,
          confidence: recording.ai_confidence_score
        })
      },
      language
    });
  } catch (error) {
    console.error('Error fetching processing status:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/recording/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;

    const query = `
      SELECT vr.*, p.family_name, p.given_name, p.room, p.bed
      FROM voice_recordings vr
      LEFT JOIN patients p ON vr.patient_id = p.patient_id
      WHERE vr.recording_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: getTranslation('not_found', language),
        language
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching voice recording:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.delete('/recording/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;

    const recordingQuery = 'SELECT audio_file_path FROM voice_recordings WHERE recording_id = $1';
    const recordingResult = await db.query(recordingQuery, [id]);

    if (recordingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: getTranslation('not_found', language),
        language
      });
    }

    const audioFilePath = recordingResult.rows[0].audio_file_path;

    // Securely delete recording and all associated files
    try {
      await voiceEncryptionService.secureDeleteRecording(id, audioFilePath);
      console.log(`✅ Recording ${id} securely deleted`);
    } catch (error) {
      console.error('Error securely deleting audio files:', error);
      // Continue with database deletion even if file deletion fails
    }

    const deleteQuery = 'DELETE FROM voice_recordings WHERE recording_id = $1 RETURNING *';
    const deleteResult = await db.query(deleteQuery, [id]);

    res.json({
      success: true,
      data: deleteResult.rows[0],
      language,
      message: 'Recording securely deleted'
    });
  } catch (error) {
    console.error('Error deleting voice recording:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;