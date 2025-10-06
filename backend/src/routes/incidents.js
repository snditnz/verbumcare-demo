import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

// Get incidents for a patient
router.get('/patients/:patient_id/incidents', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;
    const { limit = 20, offset = 0, reviewed } = req.query;

    let query = `
      SELECT
        i.incident_id,
        i.patient_id,
        i.incident_type,
        i.severity,
        i.occurred_at,
        i.description,
        i.voice_recording_id,
        i.photo_paths,
        i.reported_by,
        i.reported_at,
        i.reviewed,
        i.reviewed_by,
        i.reviewed_at,
        i.follow_up_notes,
        s1.family_name || ' ' || s1.given_name as reported_by_name,
        s2.family_name || ' ' || s2.given_name as reviewed_by_name
      FROM patient_incidents i
      JOIN staff s1 ON i.reported_by = s1.staff_id
      LEFT JOIN staff s2 ON i.reviewed_by = s2.staff_id
      WHERE i.patient_id = $1
    `;

    const values = [patient_id];
    let paramCount = 2;

    if (reviewed !== undefined) {
      query += ` AND i.reviewed = $${paramCount}`;
      values.push(reviewed === 'true');
      paramCount++;
    }

    query += ` ORDER BY i.occurred_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patient incidents:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Get unreviewed incidents (facility-wide)
router.get('/incidents/unreviewed', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT
        i.incident_id,
        i.patient_id,
        i.incident_type,
        i.severity,
        i.occurred_at,
        i.description,
        i.reported_at,
        p.family_name || ' ' || p.given_name as patient_name,
        p.room,
        p.bed,
        s.family_name || ' ' || s.given_name as reported_by_name
      FROM patient_incidents i
      JOIN patients p ON i.patient_id = p.patient_id
      JOIN staff s ON i.reported_by = s.staff_id
      WHERE i.reviewed = FALSE
      ORDER BY
        CASE i.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        i.occurred_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching unreviewed incidents:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Create new incident
router.post('/patients/:patient_id/incidents', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;
    const {
      incident_type,
      severity,
      occurred_at,
      description,
      voice_recording_id,
      photo_paths,
      reported_by
    } = req.body;

    // Validation
    if (!incident_type || !severity || !occurred_at || !description || !reported_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: incident_type, severity, occurred_at, description, reported_by',
        language
      });
    }

    const validTypes = ['fall', 'medication-error', 'behavioral', 'injury', 'other'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    if (!validTypes.includes(incident_type)) {
      return res.status(400).json({
        success: false,
        error: `incident_type must be one of: ${validTypes.join(', ')}`,
        language
      });
    }

    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: `severity must be one of: ${validSeverities.join(', ')}`,
        language
      });
    }

    const query = `
      INSERT INTO patient_incidents (
        patient_id,
        incident_type,
        severity,
        occurred_at,
        description,
        voice_recording_id,
        photo_paths,
        reported_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      patient_id,
      incident_type,
      severity,
      occurred_at,
      description,
      voice_recording_id,
      photo_paths || [],
      reported_by
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: 'Incident reported successfully'
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Mark incident as reviewed
router.patch('/incidents/:incident_id/review', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { incident_id } = req.params;
    const { reviewed_by, follow_up_notes } = req.body;

    if (!reviewed_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: reviewed_by',
        language
      });
    }

    const query = `
      UPDATE patient_incidents
      SET
        reviewed = TRUE,
        reviewed_by = $1,
        reviewed_at = CURRENT_TIMESTAMP,
        follow_up_notes = $2
      WHERE incident_id = $3
      RETURNING *
    `;

    const values = [reviewed_by, follow_up_notes, incident_id];
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
      message: 'Incident marked as reviewed'
    });
  } catch (error) {
    console.error('Error reviewing incident:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;
