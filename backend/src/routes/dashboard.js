import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';
import { verifyChainIntegrity } from '../utils/crypto.js';
import hl7Export from '../services/hl7Export.js';

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001', date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const medicationsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE ma.status = 'administered') as administered,
        COUNT(*) FILTER (WHERE ma.status IS NULL AND mo.scheduled_time < CURRENT_TIME) as pending,
        COUNT(*) FILTER (WHERE ma.status = 'refused') as refused,
        COUNT(DISTINCT mo.order_id) FILTER (WHERE mo.prn = false AND mo.status = 'active') as total_scheduled
      FROM medication_orders mo
      LEFT JOIN medication_administrations ma ON (
        mo.order_id = ma.order_id
        AND DATE(ma.scheduled_datetime) = $2
      )
      JOIN patients p ON mo.patient_id = p.patient_id
      WHERE p.facility_id = $1
        AND mo.status = 'active'
        AND mo.start_datetime::date <= $2
        AND (mo.end_datetime IS NULL OR mo.end_datetime::date >= $2)
    `;

    const vitalsQuery = `
      SELECT
        COUNT(*) as total_recorded,
        AVG(DATE_PART('epoch', NOW() - vs.created_at) / 60) as avg_time_since_last
      FROM vital_signs vs
      JOIN patients p ON vs.patient_id = p.patient_id
      WHERE p.facility_id = $1
        AND DATE(vs.measured_at) = $2
    `;

    const assessmentsQuery = `
      SELECT
        COUNT(*) as total_assessments,
        COUNT(*) FILTER (WHERE na.input_method = 'voice') as voice_assessments,
        AVG(na.ai_confidence_score) as avg_confidence
      FROM nursing_assessments na
      JOIN patients p ON na.patient_id = p.patient_id
      WHERE p.facility_id = $1
        AND DATE(na.assessment_datetime) = $2
    `;

    const patientsQuery = `
      SELECT
        COUNT(*) as total_patients,
        COUNT(*) FILTER (WHERE p.admission_date = $2) as new_admissions
      FROM patients p
      WHERE p.facility_id = $1
    `;

    const [medicationsResult, vitalsResult, assessmentsResult, patientsResult] = await Promise.all([
      db.query(medicationsQuery, [facility_id, targetDate]),
      db.query(vitalsQuery, [facility_id, targetDate]),
      db.query(assessmentsQuery, [facility_id, targetDate]),
      db.query(patientsQuery, [facility_id, targetDate])
    ]);

    const medications = medicationsResult.rows[0];
    const vitals = vitalsResult.rows[0];
    const assessments = assessmentsResult.rows[0];
    const patients = patientsResult.rows[0];

    const medicationCompliance = medications.total_scheduled > 0
      ? Math.round((medications.administered / medications.total_scheduled) * 100)
      : 100;

    const avgDocumentationTime = 2.3;

    const metrics = {
      medications: {
        administered: parseInt(medications.administered) || 0,
        pending: parseInt(medications.pending) || 0,
        refused: parseInt(medications.refused) || 0,
        total_scheduled: parseInt(medications.total_scheduled) || 0,
        compliance_percentage: medicationCompliance
      },
      vital_signs: {
        total_recorded: parseInt(vitals.total_recorded) || 0,
        avg_time_since_last: parseFloat(vitals.avg_time_since_last) || 0
      },
      assessments: {
        total: parseInt(assessments.total_assessments) || 0,
        voice_assessments: parseInt(assessments.voice_assessments) || 0,
        avg_confidence: parseFloat(assessments.avg_confidence) || 0
      },
      patients: {
        total: parseInt(patients.total_patients) || 0,
        new_admissions: parseInt(patients.new_admissions) || 0
      },
      documentation: {
        avg_time_minutes: avgDocumentationTime
      },
      date: targetDate
    };

    res.json({
      success: true,
      data: metrics,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/patients/status', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001' } = req.query;

    const query = `
      SELECT
        p.patient_id,
        p.mrn,
        p.family_name,
        p.given_name,
        p.room,
        p.bed,
        DATE_PART('year', AGE(p.date_of_birth)) as age,
        COUNT(DISTINCT mo.order_id) FILTER (
          WHERE mo.status = 'active'
          AND mo.prn = false
          AND mo.scheduled_time < CURRENT_TIME
          AND ma.administration_id IS NULL
        ) as pending_medications,
        MAX(vs.measured_at) as last_vitals,
        MAX(na.assessment_datetime) as last_assessment,
        COUNT(DISTINCT alert_conditions.condition) as alert_count
      FROM patients p
      LEFT JOIN medication_orders mo ON p.patient_id = mo.patient_id
      LEFT JOIN medication_administrations ma ON (
        mo.order_id = ma.order_id
        AND DATE(ma.scheduled_datetime) = CURRENT_DATE
      )
      LEFT JOIN vital_signs vs ON p.patient_id = vs.patient_id
      LEFT JOIN nursing_assessments na ON p.patient_id = na.patient_id
      LEFT JOIN LATERAL (
        SELECT DISTINCT
          CASE
            WHEN vs2.blood_pressure_systolic > 140 OR vs2.blood_pressure_diastolic > 90 THEN 'high_bp'
            WHEN vs2.blood_pressure_systolic < 90 OR vs2.blood_pressure_diastolic < 60 THEN 'low_bp'
            WHEN vs2.heart_rate > 100 THEN 'tachycardia'
            WHEN vs2.heart_rate < 60 THEN 'bradycardia'
            WHEN vs2.oxygen_saturation < 92 THEN 'low_oxygen'
            WHEN vs2.temperature_celsius > 38 THEN 'fever'
            WHEN vs2.pain_score > 5 THEN 'high_pain'
            ELSE NULL
          END as condition
        FROM vital_signs vs2
        WHERE vs2.patient_id = p.patient_id
          AND vs2.measured_at >= NOW() - INTERVAL '24 hours'
          AND (
            vs2.blood_pressure_systolic > 140 OR vs2.blood_pressure_diastolic > 90 OR
            vs2.blood_pressure_systolic < 90 OR vs2.blood_pressure_diastolic < 60 OR
            vs2.heart_rate > 100 OR vs2.heart_rate < 60 OR
            vs2.oxygen_saturation < 92 OR vs2.temperature_celsius > 38 OR
            vs2.pain_score > 5
          )
      ) alert_conditions ON true
      WHERE p.facility_id = $1
      GROUP BY p.patient_id
      ORDER BY p.room, p.bed
    `;

    const result = await db.query(query, [facility_id]);

    const patients = result.rows.map(patient => {
      let status = 'green';

      if (patient.alert_count > 0) {
        status = 'red';
      } else if (patient.pending_medications > 0) {
        status = 'yellow';
      }

      return {
        ...patient,
        status,
        pending_medications: parseInt(patient.pending_medications) || 0,
        alert_count: parseInt(patient.alert_count) || 0
      };
    });

    res.json({
      success: true,
      data: patients,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patient status:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/activity/recent', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001', limit = 20 } = req.query;

    const query = `
      (
        SELECT
          'medication' as type,
          ma.created_at as timestamp,
          p.family_name,
          p.given_name,
          p.room,
          p.bed,
          CASE
            WHEN $2 = 'ja' THEN mo.medication_name_ja
            WHEN $2 = 'zh-TW' THEN COALESCE(mo.medication_name_zh, mo.medication_name_en)
            ELSE COALESCE(mo.medication_name_en, mo.medication_name_ja)
          END as description,
          ma.status,
          s.family_name as staff_name,
          s.given_name as staff_given_name
        FROM medication_administrations ma
        JOIN medication_orders mo ON ma.order_id = mo.order_id
        JOIN patients p ON ma.patient_id = p.patient_id
        JOIN staff s ON ma.administered_by = s.staff_id
        WHERE p.facility_id = $1
      )
      UNION ALL
      (
        SELECT
          'vitals' as type,
          vs.created_at as timestamp,
          p.family_name,
          p.given_name,
          p.room,
          p.bed,
          'Vital signs recorded' as description,
          vs.input_method as status,
          s.family_name as staff_name,
          s.given_name as staff_given_name
        FROM vital_signs vs
        JOIN patients p ON vs.patient_id = p.patient_id
        JOIN staff s ON vs.recorded_by = s.staff_id
        WHERE p.facility_id = $1
      )
      UNION ALL
      (
        SELECT
          'assessment' as type,
          na.created_at as timestamp,
          p.family_name,
          p.given_name,
          p.room,
          p.bed,
          CONCAT(na.assessment_type, ' assessment') as description,
          na.input_method as status,
          s.family_name as staff_name,
          s.given_name as staff_given_name
        FROM nursing_assessments na
        JOIN patients p ON na.patient_id = p.patient_id
        JOIN staff s ON na.assessed_by = s.staff_id
        WHERE p.facility_id = $1
      )
      ORDER BY timestamp DESC
      LIMIT $3
    `;

    const result = await db.query(query, [facility_id, language, limit]);

    res.json({
      success: true,
      data: result.rows,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001' } = req.query;

    const query = `
      SELECT DISTINCT
        p.patient_id,
        p.family_name,
        p.given_name,
        p.room,
        p.bed,
        vs.measured_at,
        CASE
          WHEN vs.blood_pressure_systolic > 140 OR vs.blood_pressure_diastolic > 90 THEN 'high_blood_pressure'
          WHEN vs.blood_pressure_systolic < 90 OR vs.blood_pressure_diastolic < 60 THEN 'low_blood_pressure'
          WHEN vs.heart_rate > 100 THEN 'tachycardia'
          WHEN vs.heart_rate < 60 THEN 'bradycardia'
          WHEN vs.oxygen_saturation < 92 THEN 'low_oxygen'
          WHEN vs.temperature_celsius > 38 THEN 'fever'
          WHEN vs.pain_score > 5 THEN 'high_pain'
        END as alert_type,
        CASE
          WHEN vs.blood_pressure_systolic > 140 OR vs.blood_pressure_diastolic > 90 THEN
            'BP: ' || vs.blood_pressure_systolic || '/' || vs.blood_pressure_diastolic
          WHEN vs.blood_pressure_systolic < 90 OR vs.blood_pressure_diastolic < 60 THEN
            'BP: ' || vs.blood_pressure_systolic || '/' || vs.blood_pressure_diastolic
          WHEN vs.heart_rate > 100 OR vs.heart_rate < 60 THEN
            'HR: ' || vs.heart_rate
          WHEN vs.oxygen_saturation < 92 THEN
            'SpO2: ' || vs.oxygen_saturation || '%'
          WHEN vs.temperature_celsius > 38 THEN
            'Temp: ' || vs.temperature_celsius || '°C'
          WHEN vs.pain_score > 5 THEN
            'Pain: ' || vs.pain_score || '/10'
        END as alert_message,
        CASE
          WHEN vs.blood_pressure_systolic < 90 OR vs.blood_pressure_diastolic < 60 OR vs.oxygen_saturation < 92 THEN 'critical'
          WHEN vs.heart_rate > 120 OR vs.heart_rate < 50 OR vs.temperature_celsius > 39 THEN 'high'
          ELSE 'medium'
        END as severity
      FROM patients p
      JOIN vital_signs vs ON p.patient_id = vs.patient_id
      WHERE p.facility_id = $1
        AND vs.measured_at >= NOW() - INTERVAL '24 hours'
        AND (
          vs.blood_pressure_systolic > 140 OR vs.blood_pressure_diastolic > 90 OR
          vs.blood_pressure_systolic < 90 OR vs.blood_pressure_diastolic < 60 OR
          vs.heart_rate > 100 OR vs.heart_rate < 60 OR
          vs.oxygen_saturation < 92 OR vs.temperature_celsius > 38 OR
          vs.pain_score > 5
        )
      ORDER BY severity DESC, vs.measured_at DESC
    `;

    const result = await db.query(query, [facility_id]);

    res.json({
      success: true,
      data: result.rows,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/export/hl7', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001', type = 'all', date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const facilityQuery = 'SELECT * FROM facilities WHERE facility_id = $1';
    const facilityResult = await db.query(facilityQuery, [facility_id]);
    const facilityData = facilityResult.rows[0] || {};

    const messages = [];

    if (type === 'all' || type === 'patients') {
      const patientsQuery = `
        SELECT p.*, DATE_PART('year', AGE(p.date_of_birth)) as age
        FROM patients p
        WHERE p.facility_id = $1
        ORDER BY p.room, p.bed
      `;
      const patientsResult = await db.query(patientsQuery, [facility_id]);

      for (const patient of patientsResult.rows) {
        messages.push({
          type: 'ADT^A01',
          message: hl7Export.generateHL7_ADT_A01(patient, facilityData)
        });
      }
    }

    if (type === 'all' || type === 'vitals') {
      const vitalsQuery = `
        SELECT vs.*, p.*, DATE_PART('year', AGE(p.date_of_birth)) as age,
               s.family_name as recorded_by_name, s.given_name as recorded_by_given_name
        FROM vital_signs vs
        JOIN patients p ON vs.patient_id = p.patient_id
        JOIN staff s ON vs.recorded_by = s.staff_id
        WHERE p.facility_id = $1 AND DATE(vs.measured_at) = $2
        ORDER BY vs.measured_at DESC
      `;
      const vitalsResult = await db.query(vitalsQuery, [facility_id, targetDate]);

      for (const vitals of vitalsResult.rows) {
        messages.push({
          type: 'ORU^R01',
          message: hl7Export.generateHL7_ORU_R01(vitals, vitals, facilityData)
        });
      }
    }

    if (type === 'all' || type === 'medications') {
      const medicationsQuery = `
        SELECT ma.*, mo.*, p.*, DATE_PART('year', AGE(p.date_of_birth)) as age
        FROM medication_administrations ma
        JOIN medication_orders mo ON ma.order_id = mo.order_id
        JOIN patients p ON ma.patient_id = p.patient_id
        WHERE p.facility_id = $1 AND DATE(ma.administered_datetime) = $2
        ORDER BY ma.administered_datetime DESC
      `;
      const medicationsResult = await db.query(medicationsQuery, [facility_id, targetDate]);

      for (const med of medicationsResult.rows) {
        messages.push({
          type: 'RDE^O11',
          message: hl7Export.generateHL7_RDE_O11(med, med, med, facilityData)
        });
      }
    }

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length,
        facility: facilityData.facility_name || 'Unknown Facility',
        date: targetDate
      },
      language,
      message: getTranslation('export_completed', language)
    });
  } catch (error) {
    console.error('Error generating HL7 export:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/export/ss-mix2', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001' } = req.query;

    const facilityQuery = 'SELECT * FROM facilities WHERE facility_id = $1';
    const facilityResult = await db.query(facilityQuery, [facility_id]);
    const facilityData = facilityResult.rows[0] || {};

    const dataQuery = `
      SELECT
        p.*,
        DATE_PART('year', AGE(p.date_of_birth)) as age,
        json_agg(DISTINCT mo.*) FILTER (WHERE mo.order_id IS NOT NULL) as medications,
        json_agg(DISTINCT vs.*) FILTER (WHERE vs.vital_sign_id IS NOT NULL) as vital_signs,
        json_agg(DISTINCT na.*) FILTER (WHERE na.assessment_id IS NOT NULL) as assessments
      FROM patients p
      LEFT JOIN medication_orders mo ON p.patient_id = mo.patient_id
      LEFT JOIN vital_signs vs ON p.patient_id = vs.patient_id
      LEFT JOIN nursing_assessments na ON p.patient_id = na.patient_id
      WHERE p.facility_id = $1
      GROUP BY p.patient_id
      ORDER BY p.room, p.bed
    `;

    const result = await db.query(dataQuery, [facility_id]);
    const exportData = hl7Export.generateSS_MIX2_Export(result.rows, facilityData);

    res.json({
      success: true,
      data: exportData,
      language,
      message: getTranslation('export_completed', language)
    });
  } catch (error) {
    console.error('Error generating SS-MIX2 export:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/chain/verify', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001', limit = 100 } = req.query;

    const verification = await verifyChainIntegrity(facility_id, parseInt(limit));

    res.json({
      success: true,
      data: verification,
      language,
      message: verification.valid ? 'Chain verification successful' : 'Chain verification failed'
    });
  } catch (error) {
    console.error('Error verifying chain integrity:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;