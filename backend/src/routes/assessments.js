import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

router.get('/patient/:patientId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;
    const { limit = 20, offset = 0, type } = req.query;

    let query = `
      SELECT
        na.*,
        s.family_name as assessed_by_name,
        s.given_name as assessed_by_given_name,
        vr.transcription_text,
        vr.duration_seconds
      FROM nursing_assessments na
      JOIN staff s ON na.assessed_by = s.staff_id
      LEFT JOIN voice_recordings vr ON na.voice_recording_id = vr.recording_id
      WHERE na.patient_id = $1
    `;

    const values = [patientId];
    let paramCount = 2;

    if (type) {
      query += ` AND na.assessment_type = $${paramCount}`;
      values.push(type);
      paramCount++;
    }

    query += ` ORDER BY na.assessment_datetime DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);

    res.json({
      success: true,
      data: result.rows,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patient assessments:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;

    const query = `
      SELECT
        na.*,
        s.family_name as assessed_by_name,
        s.given_name as assessed_by_given_name,
        p.family_name as patient_family_name,
        p.given_name as patient_given_name,
        p.room,
        p.bed,
        vr.transcription_text,
        vr.transcription_language,
        vr.ai_structured_extraction as voice_extraction,
        vr.duration_seconds
      FROM nursing_assessments na
      JOIN staff s ON na.assessed_by = s.staff_id
      JOIN patients p ON na.patient_id = p.patient_id
      LEFT JOIN voice_recordings vr ON na.voice_recording_id = vr.recording_id
      WHERE na.assessment_id = $1
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
    console.error('Error fetching assessment:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const {
      patient_id,
      assessment_type = 'routine',
      input_method = 'form',
      voice_recording_id,
      structured_data,
      narrative_notes,
      ai_processed = false,
      ai_confidence_score,
      assessed_by
    } = req.body;

    if (!patient_id || !assessed_by) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    if (!structured_data && !narrative_notes) {
      return res.status(400).json({
        success: false,
        error: 'Either structured data or narrative notes must be provided',
        language
      });
    }

    const query = `
      INSERT INTO nursing_assessments (
        patient_id, assessment_datetime, assessment_type,
        input_method, voice_recording_id, structured_data,
        narrative_notes, ai_processed, ai_confidence_score, assessed_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *
    `;

    const values = [
      patient_id,
      new Date(),
      assessment_type,
      input_method,
      voice_recording_id || null,
      structured_data ? JSON.stringify(structured_data) : null,
      narrative_notes || null,
      ai_processed,
      ai_confidence_score || null,
      assessed_by
    ];

    const result = await db.query(query, values);

    const facilityResult = await db.query(
      'SELECT facility_id FROM patients WHERE patient_id = $1',
      [patient_id]
    );

    if (facilityResult.rows.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`facility-${facilityResult.rows[0].facility_id}`).emit('assessment:completed', {
          assessment: result.rows[0],
          patient_id,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: getTranslation('assessment_completed', language)
    });
  } catch (error) {
    console.error('Error creating assessment:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.post('/voice', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const {
      patient_id,
      voice_recording_id,
      structured_data,
      narrative_notes,
      ai_confidence_score,
      assessed_by
    } = req.body;

    if (!patient_id || !voice_recording_id || !assessed_by) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    const voiceResult = await db.query(
      'SELECT * FROM voice_recordings WHERE recording_id = $1',
      [voice_recording_id]
    );

    if (voiceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voice recording not found',
        language
      });
    }

    const voiceData = voiceResult.rows[0];
    const assessmentData = structured_data || voiceData.ai_structured_extraction || {};

    const query = `
      INSERT INTO nursing_assessments (
        patient_id, assessment_datetime, assessment_type,
        input_method, voice_recording_id, structured_data,
        narrative_notes, ai_processed, ai_confidence_score, assessed_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *
    `;

    const values = [
      patient_id,
      new Date(),
      'voice',
      'voice',
      voice_recording_id,
      JSON.stringify(assessmentData),
      narrative_notes || voiceData.transcription_text,
      true,
      ai_confidence_score || voiceData.ai_confidence_score || 0.85,
      assessed_by
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        voice_recording: voiceData
      },
      language,
      message: 'Voice assessment created successfully'
    });
  } catch (error) {
    console.error('Error creating voice assessment:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;
    const { structured_data, narrative_notes, ai_confidence_score } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (structured_data !== undefined) {
      updateFields.push(`structured_data = $${paramCount}`);
      values.push(JSON.stringify(structured_data));
      paramCount++;
    }

    if (narrative_notes !== undefined) {
      updateFields.push(`narrative_notes = $${paramCount}`);
      values.push(narrative_notes);
      paramCount++;
    }

    if (ai_confidence_score !== undefined) {
      updateFields.push(`ai_confidence_score = $${paramCount}`);
      values.push(ai_confidence_score);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        language
      });
    }

    values.push(id);

    const query = `
      UPDATE nursing_assessments
      SET ${updateFields.join(', ')}
      WHERE assessment_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

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
      message: 'Assessment updated successfully'
    });
  } catch (error) {
    console.error('Error updating assessment:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;