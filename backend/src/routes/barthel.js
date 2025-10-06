import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

// Get latest Barthel assessment for a patient
router.get('/patients/:patient_id/barthel/latest', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;

    const query = `
      SELECT
        ba.assessment_id,
        ba.patient_id,
        ba.assessed_at,
        ba.total_score,
        ba.category_scores,
        ba.additional_notes,
        ba.voice_recording_id,
        ba.input_method,
        s.family_name || ' ' || s.given_name as assessed_by_name
      FROM barthel_assessments ba
      JOIN staff s ON ba.assessed_by = s.staff_id
      WHERE ba.patient_id = $1
      ORDER BY ba.assessed_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [patient_id]);

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
    console.error('Error fetching latest Barthel assessment:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Get Barthel assessment history for a patient
router.get('/patients/:patient_id/barthel/history', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const query = `
      SELECT
        ba.assessment_id,
        ba.patient_id,
        ba.assessed_at,
        ba.total_score,
        ba.category_scores,
        ba.additional_notes,
        ba.input_method,
        s.family_name || ' ' || s.given_name as assessed_by_name
      FROM barthel_assessments ba
      JOIN staff s ON ba.assessed_by = s.staff_id
      WHERE ba.patient_id = $1
      ORDER BY ba.assessed_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [patient_id, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching Barthel history:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Create new Barthel assessment
router.post('/patients/:patient_id/barthel', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;
    const {
      total_score,
      category_scores,
      additional_notes,
      voice_recording_id,
      assessed_by,
      input_method = 'form'
    } = req.body;

    // Validation
    if (total_score === undefined || !category_scores || !assessed_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: total_score, category_scores, assessed_by',
        language
      });
    }

    if (total_score < 0 || total_score > 100) {
      return res.status(400).json({
        success: false,
        error: 'total_score must be between 0 and 100',
        language
      });
    }

    const query = `
      INSERT INTO barthel_assessments (
        patient_id,
        total_score,
        category_scores,
        additional_notes,
        voice_recording_id,
        assessed_by,
        input_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      patient_id,
      total_score,
      JSON.stringify(category_scores),
      additional_notes,
      voice_recording_id,
      assessed_by,
      input_method
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: 'Barthel assessment created successfully'
    });
  } catch (error) {
    console.error('Error creating Barthel assessment:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Update Barthel assessment
router.put('/barthel/:assessment_id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { assessment_id } = req.params;
    const { total_score, category_scores, additional_notes } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (total_score !== undefined) {
      if (total_score < 0 || total_score > 100) {
        return res.status(400).json({
          success: false,
          error: 'total_score must be between 0 and 100',
          language
        });
      }
      updateFields.push(`total_score = $${paramCount}`);
      values.push(total_score);
      paramCount++;
    }

    if (category_scores !== undefined) {
      updateFields.push(`category_scores = $${paramCount}`);
      values.push(JSON.stringify(category_scores));
      paramCount++;
    }

    if (additional_notes !== undefined) {
      updateFields.push(`additional_notes = $${paramCount}`);
      values.push(additional_notes);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        language
      });
    }

    values.push(assessment_id);

    const query = `
      UPDATE barthel_assessments
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
      message: 'Barthel assessment updated successfully'
    });
  } catch (error) {
    console.error('Error updating Barthel assessment:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;
