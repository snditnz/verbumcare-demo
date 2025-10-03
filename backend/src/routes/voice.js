import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';
import { processVoiceToStructured, validateStructuredData } from '../services/aiExtraction.js';

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
        ...result.rows[0]
      },
      language,
      message: 'Voice recording uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading voice recording:', error);
    const language = detectLanguage(req);

    if (req.file) {
      try {
        await fs.unlink(req.file.path);
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
    const { recording_id, patient_id, manual_corrections } = req.body;

    if (!recording_id) {
      return res.status(400).json({
        success: false,
        error: 'Recording ID is required',
        language
      });
    }

    const recordingQuery = `
      SELECT vr.*, p.family_name, p.given_name, p.room, p.bed
      FROM voice_recordings vr
      LEFT JOIN patients p ON vr.patient_id = p.patient_id
      WHERE vr.recording_id = $1
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
    const audioFilePath = path.join(process.cwd(), recording.audio_file_path);

    const fileExists = await fs.access(audioFilePath).then(() => true).catch(() => false);
    if (!fileExists) {
      return res.status(404).json({
        success: false,
        error: 'Audio file not found',
        language
      });
    }

    const patientInfo = {
      name: `${recording.family_name} ${recording.given_name}`,
      room: recording.room,
      bed: recording.bed
    };

    const processedData = await processVoiceToStructured(
      audioFilePath,
      recording.transcription_language || language,
      patientInfo
    );

    let finalStructuredData = processedData.structuredData;
    if (manual_corrections) {
      const { mergeWithManualInput } = await import('../services/aiExtraction.js');
      finalStructuredData = mergeWithManualInput(processedData.structuredData, manual_corrections);
    }

    const validation = validateStructuredData(finalStructuredData);

    if (!validation.valid && validation.errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data extracted',
        validation_errors: validation.errors,
        data: processedData,
        language
      });
    }

    const updateQuery = `
      UPDATE voice_recordings
      SET
        transcription_text = $1,
        ai_structured_extraction = $2,
        ai_confidence_score = $3
      WHERE recording_id = $4
      RETURNING *
    `;

    const updateValues = [
      processedData.transcription,
      JSON.stringify(finalStructuredData),
      processedData.confidence,
      recording_id
    ];

    const updateResult = await db.query(updateQuery, updateValues);

    res.json({
      success: true,
      data: {
        recording: updateResult.rows[0],
        transcription: processedData.transcription,
        structured_data: finalStructuredData,
        clinical_note: processedData.clinicalNote,
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

    const filePath = path.join(process.cwd(), recordingResult.rows[0].audio_file_path);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting audio file:', error);
    }

    const deleteQuery = 'DELETE FROM voice_recordings WHERE recording_id = $1 RETURNING *';
    const deleteResult = await db.query(deleteQuery, [id]);

    res.json({
      success: true,
      data: deleteResult.rows[0],
      language,
      message: 'Recording deleted successfully'
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