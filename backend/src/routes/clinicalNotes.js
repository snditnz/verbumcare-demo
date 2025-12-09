import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

/**
 * GET /api/clinical-notes/patient/:patientId
 * Fetch all clinical notes for a specific patient
 * Query params: limit, offset, note_type (nurse_note|doctor_note|care_note),
 *               category, requires_approval, status
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;
    const {
      limit = 50,
      offset = 0,
      note_type,
      category,
      requires_approval,
      status = 'submitted'
    } = req.query;

    let query = `
      SELECT
        cn.*,
        s.family_name as author_family_name,
        s.given_name as author_given_name,
        s.role as author_role_code,
        vr.transcription_text,
        vr.duration_seconds,
        vr.audio_file_path,
        approver.family_name as approver_family_name,
        approver.given_name as approver_given_name
      FROM clinical_notes cn
      JOIN staff s ON cn.authored_by = s.staff_id
      LEFT JOIN voice_recordings vr ON cn.voice_recording_id = vr.recording_id
      LEFT JOIN staff approver ON cn.approved_by = approver.staff_id
      WHERE cn.patient_id = $1 AND cn.deleted_at IS NULL
    `;

    const values = [patientId];
    let paramCount = 2;

    // Filter by note type
    if (note_type) {
      query += ` AND cn.note_type = $${paramCount}`;
      values.push(note_type);
      paramCount++;
    }

    // Filter by category
    if (category) {
      query += ` AND cn.note_category = $${paramCount}`;
      values.push(category);
      paramCount++;
    }

    // Filter by requires_approval
    if (requires_approval !== undefined) {
      query += ` AND cn.requires_approval = $${paramCount}`;
      values.push(requires_approval === 'true');
      paramCount++;
    }

    // Filter by status
    if (status) {
      query += ` AND cn.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    // Order by most recent first, with pagination
    query += ` ORDER BY cn.note_datetime DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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
    console.error('Error fetching clinical notes:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      language
    });
  }
});

/**
 * GET /api/clinical-notes/:noteId
 * Fetch a specific clinical note by ID
 */
router.get('/:noteId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { noteId } = req.params;

    const query = `
      SELECT
        cn.*,
        s.family_name as author_family_name,
        s.given_name as author_given_name,
        s.role as author_role_code,
        p.family_name as patient_family_name,
        p.given_name as patient_given_name,
        p.room,
        p.bed,
        vr.transcription_text,
        vr.transcription_language,
        vr.duration_seconds,
        vr.audio_file_path,
        approver.family_name as approver_family_name,
        approver.given_name as approver_given_name
      FROM clinical_notes cn
      JOIN staff s ON cn.authored_by = s.staff_id
      JOIN patients p ON cn.patient_id = p.patient_id
      LEFT JOIN voice_recordings vr ON cn.voice_recording_id = vr.recording_id
      LEFT JOIN staff approver ON cn.approved_by = approver.staff_id
      WHERE cn.note_id = $1 AND cn.deleted_at IS NULL
    `;

    const result = await db.query(query, [noteId]);

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
    console.error('Error fetching clinical note:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

/**
 * POST /api/clinical-notes
 * Create a new clinical note (immediate save)
 */
router.post('/', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const {
      patient_id,
      note_type,
      note_category,
      note_text,
      voice_recording_id,
      voice_transcribed = false,
      authored_by,
      author_role,
      author_name,
      follow_up_required = false,
      follow_up_date,
      follow_up_notes,
      related_assessment_id,
      related_session_id,
      status = 'submitted',
      requires_approval = false
    } = req.body;

    // Validation
    if (!patient_id || !note_type || !note_text || !authored_by || !author_role || !author_name) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        details: 'Required fields: patient_id, note_type, note_text, authored_by, author_role, author_name',
        language
      });
    }

    // Validate note_type
    if (!['nurse_note', 'doctor_note', 'care_note'].includes(note_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid note_type. Must be: nurse_note, doctor_note, or care_note',
        language
      });
    }

    const query = `
      INSERT INTO clinical_notes (
        patient_id, note_type, note_category, note_datetime, note_text,
        voice_recording_id, voice_transcribed, authored_by, author_role, author_name,
        follow_up_required, follow_up_date, follow_up_notes,
        related_assessment_id, related_session_id, status, requires_approval
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const values = [
      patient_id,
      note_type,
      note_category || 'other',
      new Date(),
      note_text,
      voice_recording_id || null,
      voice_transcribed,
      authored_by,
      author_role,
      author_name,
      follow_up_required,
      follow_up_date || null,
      follow_up_notes || null,
      related_assessment_id || null,
      related_session_id || null,
      status,
      requires_approval
    ];

    const result = await db.query(query, values);

    // Emit real-time Socket.IO event
    const facilityResult = await db.query(
      'SELECT facility_id FROM patients WHERE patient_id = $1',
      [patient_id]
    );

    if (facilityResult.rows.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`facility-${facilityResult.rows[0].facility_id}`).emit('clinical_note:created', {
          note: result.rows[0],
          patient_id,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: language === 'ja' ? '記録が保存されました' : 'Note saved successfully'
    });
  } catch (error) {
    console.error('Error creating clinical note:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      language
    });
  }
});

/**
 * PUT /api/clinical-notes/:noteId
 * Update an existing clinical note
 */
router.put('/:noteId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { noteId } = req.params;
    const {
      note_text,
      note_category,
      follow_up_required,
      follow_up_date,
      follow_up_notes,
      status
    } = req.body;

    // Check if note exists and is not deleted
    const checkResult = await db.query(
      'SELECT * FROM clinical_notes WHERE note_id = $1 AND deleted_at IS NULL',
      [noteId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: getTranslation('not_found', language),
        language
      });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (note_text !== undefined) {
      updateFields.push(`note_text = $${paramCount}`);
      values.push(note_text);
      paramCount++;
    }

    if (note_category !== undefined) {
      updateFields.push(`note_category = $${paramCount}`);
      values.push(note_category);
      paramCount++;
    }

    if (follow_up_required !== undefined) {
      updateFields.push(`follow_up_required = $${paramCount}`);
      values.push(follow_up_required);
      paramCount++;
    }

    if (follow_up_date !== undefined) {
      updateFields.push(`follow_up_date = $${paramCount}`);
      values.push(follow_up_date);
      paramCount++;
    }

    if (follow_up_notes !== undefined) {
      updateFields.push(`follow_up_notes = $${paramCount}`);
      values.push(follow_up_notes);
      paramCount++;
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        language
      });
    }

    values.push(noteId);

    const query = `
      UPDATE clinical_notes
      SET ${updateFields.join(', ')}
      WHERE note_id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, values);

    // Emit real-time update
    const facilityResult = await db.query(
      'SELECT facility_id FROM patients WHERE patient_id = $1',
      [result.rows[0].patient_id]
    );

    if (facilityResult.rows.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`facility-${facilityResult.rows[0].facility_id}`).emit('clinical_note:updated', {
          note: result.rows[0],
          timestamp: new Date()
        });
      }
    }

    res.json({
      success: true,
      data: result.rows[0],
      language,
      message: language === 'ja' ? '記録が更新されました' : 'Note updated successfully'
    });
  } catch (error) {
    console.error('Error updating clinical note:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

/**
 * PUT /api/clinical-notes/:noteId/approve
 * Approve a clinical note (doctor approval workflow)
 */
router.put('/:noteId/approve', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { noteId } = req.params;
    const { approved_by, approver_name, approval_notes, approve = true } = req.body;

    if (!approved_by || !approver_name) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: approved_by, approver_name',
        language
      });
    }

    // Check if note exists and requires approval
    const checkResult = await db.query(
      'SELECT * FROM clinical_notes WHERE note_id = $1 AND deleted_at IS NULL',
      [noteId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: getTranslation('not_found', language),
        language
      });
    }

    const note = checkResult.rows[0];

    if (!note.requires_approval) {
      return res.status(400).json({
        success: false,
        error: 'This note does not require approval',
        language
      });
    }

    const query = `
      UPDATE clinical_notes
      SET
        status = $1,
        approved_by = $2,
        approved_by_name = $3,
        approval_datetime = $4,
        approval_notes = $5
      WHERE note_id = $6 AND deleted_at IS NULL
      RETURNING *
    `;

    const values = [
      approve ? 'approved' : 'rejected',
      approved_by,
      approver_name,
      new Date(),
      approval_notes || null,
      noteId
    ];

    const result = await db.query(query, values);

    // Emit real-time update
    const facilityResult = await db.query(
      'SELECT facility_id FROM patients WHERE patient_id = $1',
      [result.rows[0].patient_id]
    );

    if (facilityResult.rows.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`facility-${facilityResult.rows[0].facility_id}`).emit('clinical_note:approved', {
          note: result.rows[0],
          approved: approve,
          timestamp: new Date()
        });
      }
    }

    res.json({
      success: true,
      data: result.rows[0],
      language,
      message: approve
        ? (language === 'ja' ? '記録が承認されました' : 'Note approved successfully')
        : (language === 'ja' ? '記録が却下されました' : 'Note rejected')
    });
  } catch (error) {
    console.error('Error approving clinical note:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

/**
 * DELETE /api/clinical-notes/:noteId
 * Soft delete a clinical note (only drafts or by author)
 */
router.delete('/:noteId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { noteId } = req.params;
    const { deleted_by } = req.body;

    if (!deleted_by) {
      return res.status(400).json({
        success: false,
        error: 'Required field: deleted_by (staff_id)',
        language
      });
    }

    // Check if note exists
    const checkResult = await db.query(
      'SELECT * FROM clinical_notes WHERE note_id = $1 AND deleted_at IS NULL',
      [noteId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: getTranslation('not_found', language),
        language
      });
    }

    // Soft delete
    const query = `
      UPDATE clinical_notes
      SET deleted_at = $1, deleted_by = $2
      WHERE note_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [new Date(), deleted_by, noteId]);

    res.json({
      success: true,
      data: result.rows[0],
      language,
      message: language === 'ja' ? '記録が削除されました' : 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting clinical note:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

/**
 * GET /api/clinical-notes/pending-approval
 * Get all notes pending approval (for doctor dashboard)
 */
router.get('/pending-approval', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT
        cn.*,
        s.family_name as author_family_name,
        s.given_name as author_given_name,
        p.family_name as patient_family_name,
        p.given_name as patient_given_name,
        p.room,
        p.bed
      FROM clinical_notes cn
      JOIN staff s ON cn.authored_by = s.staff_id
      JOIN patients p ON cn.patient_id = p.patient_id
      WHERE cn.requires_approval = true
        AND cn.status = 'submitted'
        AND cn.deleted_at IS NULL
      ORDER BY cn.note_datetime DESC
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
    console.error('Error fetching pending approval notes:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;
