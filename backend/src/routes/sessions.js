import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

// Get active session for a patient
router.get('/patients/:patient_id/session/active', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;

    const query = `
      SELECT *
      FROM patient_session_data
      WHERE patient_id = $1
      AND session_status = 'active'
      ORDER BY session_started_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [patient_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active session found',
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
    console.error('Error fetching active session:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Create or update session data
router.post('/patients/:patient_id/session', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;
    const {
      staff_id,
      session_device_id,
      vitals,
      barthel_index,
      medications,
      patient_updates,
      incidents
    } = req.body;

    if (!staff_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: staff_id',
        language
      });
    }

    // Check if active session exists
    const checkQuery = `
      SELECT session_id
      FROM patient_session_data
      WHERE patient_id = $1
      AND staff_id = $2
      AND session_status = 'active'
      AND session_started_at > NOW() - INTERVAL '24 hours'
      ORDER BY session_started_at DESC
      LIMIT 1
    `;

    const existingSession = await db.query(checkQuery, [patient_id, staff_id]);

    let result;

    if (existingSession.rows.length > 0) {
      // Update existing session
      const session_id = existingSession.rows[0].session_id;

      const updateQuery = `
        UPDATE patient_session_data
        SET
          vitals = COALESCE($1, vitals),
          barthel_index = COALESCE($2, barthel_index),
          medications = COALESCE($3, medications),
          patient_updates = COALESCE($4, patient_updates),
          incidents = COALESCE($5, incidents),
          last_updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $6
        RETURNING *
      `;

      const values = [
        vitals ? JSON.stringify(vitals) : null,
        barthel_index ? JSON.stringify(barthel_index) : null,
        medications ? JSON.stringify(medications) : null,
        patient_updates ? JSON.stringify(patient_updates) : null,
        incidents ? JSON.stringify(incidents) : null,
        session_id
      ];

      result = await db.query(updateQuery, values);

      return res.json({
        success: true,
        data: result.rows[0],
        updated: true,
        language,
        message: 'Session data updated successfully'
      });
    } else {
      // Create new session
      const insertQuery = `
        INSERT INTO patient_session_data (
          patient_id,
          staff_id,
          session_started_at,
          session_device_id,
          vitals,
          barthel_index,
          medications,
          patient_updates,
          incidents
        ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        patient_id,
        staff_id,
        session_device_id,
        vitals ? JSON.stringify(vitals) : null,
        barthel_index ? JSON.stringify(barthel_index) : null,
        medications ? JSON.stringify(medications) : null,
        patient_updates ? JSON.stringify(patient_updates) : null,
        incidents ? JSON.stringify(incidents) : null
      ];

      result = await db.query(insertQuery, values);

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        created: true,
        language,
        message: 'Session data created successfully'
      });
    }
  } catch (error) {
    console.error('Error saving session data:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Submit session (batch save all data to respective tables)
router.post('/patients/:patient_id/session/submit', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.params;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: session_id',
        language
      });
    }

    // Get session data
    const sessionQuery = `
      SELECT *
      FROM patient_session_data
      WHERE session_id = $1
      AND patient_id = $2
      AND session_status = 'active'
    `;

    const sessionResult = await db.query(sessionQuery, [session_id, patient_id]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already submitted',
        language
      });
    }

    const session = sessionResult.rows[0];
    const results = {};

    // Start transaction
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Save vitals if present
      if (session.vitals) {
        const vitals = typeof session.vitals === 'string'
          ? JSON.parse(session.vitals)
          : session.vitals;

        const vitalQuery = `
          INSERT INTO vital_signs (
            patient_id,
            measured_at,
            temperature_celsius,
            blood_pressure_systolic,
            blood_pressure_diastolic,
            heart_rate,
            input_method,
            recorded_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING vital_sign_id
        `;

        const vitalResult = await client.query(vitalQuery, [
          patient_id,
          vitals.measured_at || new Date(),
          vitals.temperature_celsius,
          vitals.blood_pressure_systolic,
          vitals.blood_pressure_diastolic,
          vitals.heart_rate,
          'manual',
          session.staff_id
        ]);

        results.vitals = vitalResult.rows[0];
      }

      // 2. Save Barthel Index if present
      if (session.barthel_index) {
        const barthel = typeof session.barthel_index === 'string'
          ? JSON.parse(session.barthel_index)
          : session.barthel_index;

        const barthelQuery = `
          INSERT INTO barthel_assessments (
            patient_id,
            total_score,
            category_scores,
            additional_notes,
            assessed_by,
            input_method
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING assessment_id
        `;

        const barthelResult = await client.query(barthelQuery, [
          patient_id,
          barthel.total_score,
          JSON.stringify(barthel.scores),
          barthel.additional_notes,
          session.staff_id,
          'form'
        ]);

        results.barthel = barthelResult.rows[0];
      }

      // 3. Save patient updates if present and confirmed
      if (session.patient_updates) {
        const updates = typeof session.patient_updates === 'string'
          ? JSON.parse(session.patient_updates)
          : session.patient_updates;

        if (updates.confirmed) {
          const updateFields = [];
          const updateValues = [];
          let paramCount = 1;

          if (updates.height !== undefined) {
            updateFields.push(`height_cm = $${paramCount}`);
            updateValues.push(updates.height);
            paramCount++;
          }

          if (updates.weight !== undefined) {
            updateFields.push(`weight_kg = $${paramCount}`);
            updateValues.push(updates.weight);
            paramCount++;
          }

          if (updates.allergies !== undefined) {
            updateFields.push(`allergies = $${paramCount}`);
            updateValues.push(updates.allergies);
            paramCount++;
          }

          if (updates.medications !== undefined) {
            updateFields.push(`medications_summary = $${paramCount}`);
            updateValues.push(updates.medications);
            paramCount++;
          }

          if (updates.keyNotes !== undefined) {
            updateFields.push(`key_notes = $${paramCount}`);
            updateValues.push(updates.keyNotes);
            paramCount++;
          }

          if (updateFields.length > 0) {
            updateValues.push(patient_id);
            const patientUpdateQuery = `
              UPDATE patients
              SET ${updateFields.join(', ')}
              WHERE patient_id = $${paramCount}
              RETURNING patient_id
            `;

            const patientUpdateResult = await client.query(patientUpdateQuery, updateValues);
            results.patient_updates = patientUpdateResult.rows[0];
          }
        }
      }

      // 4. Save incidents if present
      if (session.incidents) {
        const incidents = typeof session.incidents === 'string'
          ? JSON.parse(session.incidents)
          : session.incidents;

        if (Array.isArray(incidents) && incidents.length > 0) {
          results.incidents = [];

          for (const incident of incidents) {
            const incidentQuery = `
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
              RETURNING incident_id
            `;

            const incidentResult = await client.query(incidentQuery, [
              patient_id,
              incident.type,
              incident.severity,
              incident.datetime,
              incident.description,
              incident.voiceRecordingId,
              incident.photos || [],
              session.staff_id
            ]);

            results.incidents.push(incidentResult.rows[0]);
          }
        }
      }

      // Mark session as submitted
      await client.query(
        'UPDATE patient_session_data SET session_status = $1, submitted_at = CURRENT_TIMESTAMP WHERE session_id = $2',
        ['submitted', session_id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Session data submitted successfully',
        results,
        language
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error submitting session:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;
