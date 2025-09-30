import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';
import { generateBarcodeValue, verifyBarcode } from '../utils/crypto.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001' } = req.query;

    const query = `
      SELECT
        p.patient_id,
        p.mrn,
        p.family_name,
        p.given_name,
        p.family_name_kana,
        p.given_name_kana,
        p.date_of_birth,
        p.gender,
        p.room,
        p.bed,
        p.blood_type,
        p.admission_date,
        DATE_PART('year', AGE(p.date_of_birth)) as age,
        COUNT(DISTINCT mo.order_id) FILTER (WHERE mo.status = 'active' AND mo.prn = false) as active_medications,
        MAX(vs.measured_at) as last_vitals,
        COUNT(DISTINCT ma.administration_id) FILTER (
          WHERE ma.scheduled_datetime < NOW()
          AND ma.scheduled_datetime::date = CURRENT_DATE
          AND ma.status IS NULL
        ) as pending_medications
      FROM patients p
      LEFT JOIN medication_orders mo ON p.patient_id = mo.patient_id
      LEFT JOIN vital_signs vs ON p.patient_id = vs.patient_id
      LEFT JOIN medication_administrations ma ON p.patient_id = ma.patient_id
      WHERE p.facility_id = $1
      GROUP BY p.patient_id
      ORDER BY p.room, p.bed
    `;

    const result = await db.query(query, [facility_id]);

    const patients = result.rows.map(patient => ({
      ...patient,
      status: patient.pending_medications > 0 ? 'yellow' : 'green',
      barcode: generateBarcodeValue('patient', patient.mrn)
    }));

    res.json({
      success: true,
      data: patients,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
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
        p.*,
        DATE_PART('year', AGE(p.date_of_birth)) as age,
        f.facility_name,
        f.facility_name_ja,
        f.facility_name_zh
      FROM patients p
      JOIN facilities f ON p.facility_id = f.facility_id
      WHERE p.patient_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: getTranslation('not_found', language),
        language
      });
    }

    const patient = {
      ...result.rows[0],
      barcode: generateBarcodeValue('patient', result.rows[0].mrn)
    };

    res.json({
      success: true,
      data: patient,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/barcode/:barcode', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { barcode } = req.params;

    if (!verifyBarcode(barcode, 'PAT')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid barcode format',
        language
      });
    }

    const mrnPart = barcode.split('-')[1];

    const query = `
      SELECT
        p.patient_id,
        p.mrn,
        p.family_name,
        p.given_name,
        p.room,
        p.bed,
        DATE_PART('year', AGE(p.date_of_birth)) as age
      FROM patients p
      WHERE p.mrn = $1
    `;

    const result = await db.query(query, [mrnPart]);

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
      verified: true,
      language,
      message: 'Patient verified successfully'
    });
  } catch (error) {
    console.error('Error verifying patient barcode:', error);
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
      facility_id = '550e8400-e29b-41d4-a716-446655440001',
      mrn,
      family_name,
      given_name,
      family_name_kana,
      given_name_kana,
      date_of_birth,
      gender,
      room,
      bed,
      blood_type,
      admission_date
    } = req.body;

    if (!mrn || !family_name || !given_name || !date_of_birth || !gender) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    const query = `
      INSERT INTO patients (
        facility_id, mrn, family_name, given_name,
        family_name_kana, given_name_kana,
        date_of_birth, gender, room, bed, blood_type, admission_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      facility_id, mrn, family_name, given_name,
      family_name_kana, given_name_kana,
      date_of_birth, gender, room, bed, blood_type, admission_date || new Date()
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: 'Patient created successfully'
    });
  } catch (error) {
    console.error('Error creating patient:', error);
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
    const updates = req.body;

    const allowedFields = ['family_name', 'given_name', 'family_name_kana', 'given_name_kana', 'room', 'bed', 'blood_type'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
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
      UPDATE patients
      SET ${updateFields.join(', ')}
      WHERE patient_id = $${paramCount}
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
      message: 'Patient updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;