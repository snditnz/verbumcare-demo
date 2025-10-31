import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

router.get('/patient/:patientId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;
    const { limit = 50, offset = 0, start_date, end_date, vital_types } = req.query;

    // Build dynamic WHERE clause
    let whereConditions = ['vs.patient_id = $1'];
    let queryParams = [patientId];
    let paramIndex = 2;

    // Add date range filtering if provided
    if (start_date) {
      whereConditions.push(`vs.measured_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`vs.measured_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    // Build SELECT clause based on vital_types filter
    let selectClause = 'vs.*';
    if (vital_types) {
      // Parse comma-separated vital types (e.g., "hr,temp,bp")
      const types = vital_types.split(',').map(t => t.trim());
      const vitalColumns = [];

      // Always include base columns
      vitalColumns.push('vs.vital_sign_id', 'vs.patient_id', 'vs.measured_at', 'vs.input_method', 'vs.device_id', 'vs.recorded_by', 'vs.created_at');

      // Add specific vital columns based on filter
      if (types.includes('hr') || types.includes('heart_rate')) {
        vitalColumns.push('vs.heart_rate');
      }
      if (types.includes('bp') || types.includes('blood_pressure')) {
        vitalColumns.push('vs.blood_pressure_systolic', 'vs.blood_pressure_diastolic');
      }
      if (types.includes('temp') || types.includes('temperature')) {
        vitalColumns.push('vs.temperature_celsius');
      }
      if (types.includes('spo2') || types.includes('oxygen_saturation')) {
        vitalColumns.push('vs.oxygen_saturation');
      }
      if (types.includes('rr') || types.includes('respiratory_rate')) {
        vitalColumns.push('vs.respiratory_rate');
      }
      if (types.includes('glucose') || types.includes('blood_glucose')) {
        vitalColumns.push('vs.blood_glucose_mg_dl');
      }
      if (types.includes('weight')) {
        vitalColumns.push('vs.weight_kg');
      }
      if (types.includes('pain')) {
        vitalColumns.push('vs.pain_score');
      }

      selectClause = vitalColumns.join(', ');
    }

    const query = `
      SELECT
        ${selectClause},
        s.family_name as recorded_by_name,
        s.given_name as recorded_by_given_name
      FROM vital_signs vs
      JOIN staff s ON vs.recorded_by = s.staff_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY vs.measured_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      filters: { start_date, end_date, vital_types },
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patient vital signs:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      details: error.message,
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

// Get statistics for patient vitals over a date range
router.get('/patient/:patientId/statistics', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;
    const { start_date, end_date, vital_type = 'hr' } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required',
        language
      });
    }

    // Map vital_type to database column
    const vitalColumnMap = {
      'hr': 'heart_rate',
      'heart_rate': 'heart_rate',
      'bp_systolic': 'blood_pressure_systolic',
      'bp_diastolic': 'blood_pressure_diastolic',
      'temp': 'temperature_celsius',
      'temperature': 'temperature_celsius',
      'spo2': 'oxygen_saturation',
      'oxygen_saturation': 'oxygen_saturation',
      'rr': 'respiratory_rate',
      'respiratory_rate': 'respiratory_rate',
      'glucose': 'blood_glucose_mg_dl',
      'blood_glucose': 'blood_glucose_mg_dl',
      'weight': 'weight_kg',
      'pain': 'pain_score',
    };

    const column = vitalColumnMap[vital_type];
    if (!column) {
      return res.status(400).json({
        success: false,
        error: `Invalid vital_type: ${vital_type}. Valid types: ${Object.keys(vitalColumnMap).join(', ')}`,
        language
      });
    }

    // Calculate statistics
    const query = `
      SELECT
        MIN(${column}) as min,
        MAX(${column}) as max,
        ROUND(AVG(${column})::numeric, 1) as avg,
        COUNT(*) as count,
        ROUND(STDDEV(${column})::numeric, 2) as stddev
      FROM vital_signs
      WHERE patient_id = $1
        AND ${column} IS NOT NULL
        AND measured_at >= $2
        AND measured_at <= $3
    `;

    const result = await db.query(query, [patientId, start_date, end_date]);
    const stats = result.rows[0];

    // Calculate trend (compare first half vs second half)
    const trendQuery = `
      WITH date_range AS (
        SELECT
          $2::timestamp as start_date,
          $3::timestamp as end_date
      ),
      midpoint AS (
        SELECT start_date + (end_date - start_date) / 2 as mid_date
        FROM date_range
      ),
      first_half AS (
        SELECT ROUND(AVG(${column})::numeric, 1) as avg
        FROM vital_signs, midpoint
        WHERE patient_id = $1
          AND ${column} IS NOT NULL
          AND measured_at >= $2
          AND measured_at < mid_date
      ),
      second_half AS (
        SELECT ROUND(AVG(${column})::numeric, 1) as avg
        FROM vital_signs, midpoint
        WHERE patient_id = $1
          AND ${column} IS NOT NULL
          AND measured_at >= (SELECT mid_date FROM midpoint)
          AND measured_at <= $3
      )
      SELECT
        first_half.avg as first_half_avg,
        second_half.avg as second_half_avg
      FROM first_half, second_half
    `;

    const trendResult = await db.query(trendQuery, [patientId, start_date, end_date]);
    const trendData = trendResult.rows[0];

    let trend = 'stable';
    if (trendData.first_half_avg && trendData.second_half_avg) {
      const percentChange = ((trendData.second_half_avg - trendData.first_half_avg) / trendData.first_half_avg) * 100;
      if (percentChange > 5) {
        trend = 'increasing';
      } else if (percentChange < -5) {
        trend = 'decreasing';
      }
    }

    res.json({
      success: true,
      data: {
        vital_type,
        min: parseFloat(stats.min),
        max: parseFloat(stats.max),
        avg: parseFloat(stats.avg),
        stddev: stats.stddev ? parseFloat(stats.stddev) : null,
        count: parseInt(stats.count),
        trend,
        trend_data: {
          first_half_avg: trendData.first_half_avg ? parseFloat(trendData.first_half_avg) : null,
          second_half_avg: trendData.second_half_avg ? parseFloat(trendData.second_half_avg) : null,
        },
        date_range: {
          start: start_date,
          end: end_date
        }
      },
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error calculating vital statistics:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      details: error.message,
      language
    });
  }
});

export default router;