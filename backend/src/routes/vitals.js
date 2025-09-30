import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

router.get('/patient/:patientId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT
        vs.*,
        s.family_name as recorded_by_name,
        s.given_name as recorded_by_given_name
      FROM vital_signs vs
      JOIN staff s ON vs.recorded_by = s.staff_id
      WHERE vs.patient_id = $1
      ORDER BY vs.measured_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [patientId, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patient vital signs:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/patient/:patientId/latest', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;

    const query = `
      SELECT
        vs.*,
        s.family_name as recorded_by_name,
        s.given_name as recorded_by_given_name
      FROM vital_signs vs
      JOIN staff s ON vs.recorded_by = s.staff_id
      WHERE vs.patient_id = $1
      ORDER BY vs.measured_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [patientId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        language,
        message: 'No vital signs recorded yet'
      });
    }

    const vitals = result.rows[0];
    const alertConditions = [];

    if (vitals.blood_pressure_systolic > 140 || vitals.blood_pressure_diastolic > 90) {
      alertConditions.push({
        type: 'high_blood_pressure',
        message: `BP: ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`,
        severity: 'warning'
      });
    }

    if (vitals.blood_pressure_systolic < 90 || vitals.blood_pressure_diastolic < 60) {
      alertConditions.push({
        type: 'low_blood_pressure',
        message: `BP: ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`,
        severity: 'critical'
      });
    }

    if (vitals.heart_rate > 100) {
      alertConditions.push({
        type: 'tachycardia',
        message: `HR: ${vitals.heart_rate}`,
        severity: 'warning'
      });
    }

    if (vitals.heart_rate < 60) {
      alertConditions.push({
        type: 'bradycardia',
        message: `HR: ${vitals.heart_rate}`,
        severity: 'warning'
      });
    }

    if (vitals.oxygen_saturation && vitals.oxygen_saturation < 92) {
      alertConditions.push({
        type: 'low_oxygen',
        message: `SpO2: ${vitals.oxygen_saturation}%`,
        severity: 'critical'
      });
    }

    if (vitals.temperature_celsius > 38) {
      alertConditions.push({
        type: 'fever',
        message: `Temp: ${vitals.temperature_celsius}°C`,
        severity: 'warning'
      });
    }

    res.json({
      success: true,
      data: {
        ...vitals,
        alerts: alertConditions
      },
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching latest vital signs:', error);
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
      temperature_celsius,
      blood_pressure_systolic,
      blood_pressure_diastolic,
      heart_rate,
      respiratory_rate,
      oxygen_saturation,
      pain_score,
      blood_glucose_mg_dl,
      weight_kg,
      height_cm,
      input_method = 'manual',
      device_id,
      recorded_by
    } = req.body;

    if (!patient_id || !recorded_by) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    const hasValidVitalSign = temperature_celsius || blood_pressure_systolic ||
      heart_rate || respiratory_rate || oxygen_saturation ||
      pain_score !== undefined || blood_glucose_mg_dl || weight_kg;

    if (!hasValidVitalSign) {
      return res.status(400).json({
        success: false,
        error: 'At least one vital sign must be provided',
        language
      });
    }

    const query = `
      INSERT INTO vital_signs (
        patient_id, measured_at, temperature_celsius,
        blood_pressure_systolic, blood_pressure_diastolic,
        heart_rate, respiratory_rate, oxygen_saturation,
        pain_score, blood_glucose_mg_dl, weight_kg, height_cm,
        input_method, device_id, recorded_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING *
    `;

    const values = [
      patient_id,
      new Date(),
      temperature_celsius || null,
      blood_pressure_systolic || null,
      blood_pressure_diastolic || null,
      heart_rate || null,
      respiratory_rate || null,
      oxygen_saturation || null,
      pain_score !== undefined ? pain_score : null,
      blood_glucose_mg_dl || null,
      weight_kg || null,
      height_cm || null,
      input_method,
      device_id || null,
      recorded_by
    ];

    const result = await db.query(query, values);

    const facilityResult = await db.query(
      'SELECT facility_id FROM patients WHERE patient_id = $1',
      [patient_id]
    );

    if (facilityResult.rows.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`facility-${facilityResult.rows[0].facility_id}`).emit('vitals:recorded', {
          vitals: result.rows[0],
          patient_id,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: getTranslation('vital_signs_recorded', language)
    });
  } catch (error) {
    console.error('Error recording vital signs:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.post('/iot', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id, device_id, measurements, recorded_by } = req.body;

    if (!patient_id || !device_id || !measurements || !recorded_by) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    const vitalData = {
      patient_id,
      ...measurements,
      input_method: 'iot_sensor',
      device_id,
      recorded_by
    };

    const query = `
      INSERT INTO vital_signs (
        patient_id, measured_at, temperature_celsius,
        blood_pressure_systolic, blood_pressure_diastolic,
        heart_rate, respiratory_rate, oxygen_saturation,
        pain_score, blood_glucose_mg_dl, weight_kg, height_cm,
        input_method, device_id, recorded_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING *
    `;

    const values = [
      vitalData.patient_id,
      new Date(),
      vitalData.temperature_celsius || null,
      vitalData.blood_pressure_systolic || null,
      vitalData.blood_pressure_diastolic || null,
      vitalData.heart_rate || null,
      vitalData.respiratory_rate || null,
      vitalData.oxygen_saturation || null,
      vitalData.pain_score !== undefined ? vitalData.pain_score : null,
      vitalData.blood_glucose_mg_dl || null,
      vitalData.weight_kg || null,
      vitalData.height_cm || null,
      vitalData.input_method,
      vitalData.device_id,
      vitalData.recorded_by
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: 'IoT vital signs recorded successfully'
    });
  } catch (error) {
    console.error('Error recording IoT vital signs:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;