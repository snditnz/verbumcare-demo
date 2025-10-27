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

// Today's Schedule endpoint - aggregate all scheduled items for a patient today
router.get('/today-schedule/:patientId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday

    // 1. Get medications due today
    const medicationsQuery = `
      SELECT
        mo.order_id as id,
        CASE
          WHEN $2 = 'ja' THEN mo.medication_name_ja
          WHEN $2 = 'zh-TW' THEN COALESCE(mo.medication_name_zh, mo.medication_name_en)
          ELSE COALESCE(mo.medication_name_en, mo.medication_name_ja)
        END as medication_name,
        mo.dose,
        mo.dose_unit,
        mo.route,
        mo.scheduled_time as time,
        ma.status as administered_status,
        ma.administered_datetime,
        mo.prn
      FROM medication_orders mo
      LEFT JOIN medication_administrations ma ON (
        mo.order_id = ma.order_id
        AND DATE(ma.scheduled_datetime) = $3
      )
      WHERE mo.patient_id = $1
        AND mo.status = 'active'
        AND mo.start_datetime::date <= $3
        AND (mo.end_datetime IS NULL OR mo.end_datetime::date >= $3)
      ORDER BY mo.scheduled_time
    `;

    // 2. Get weekly schedule items for today's day of week
    const scheduleQuery = `
      SELECT
        wsi.schedule_item_id as id,
        wsi.time_slot,
        wsi.specific_time,
        wsi.service_data,
        wsi.frequency,
        cpi.problem_description as related_goal
      FROM care_plans cp
      JOIN weekly_schedule_items wsi ON cp.care_plan_id = wsi.care_plan_id
      LEFT JOIN care_plan_items cpi ON wsi.linked_to_care_plan_item = cpi.care_plan_item_id
      WHERE cp.patient_id = $1
        AND cp.status = 'active'
        AND wsi.day_of_week = $2
      ORDER BY
        CASE wsi.time_slot
          WHEN 'morning' THEN 1
          WHEN 'afternoon' THEN 2
          WHEN 'evening' THEN 3
          WHEN 'night' THEN 4
          ELSE 5
        END,
        wsi.specific_time
    `;

    // 3. Get vitals schedule (if patient has regular vitals monitoring)
    // For demo purposes, we'll check if patient has had vitals in last 7 days
    // and suggest they're due if not done today
    const vitalsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE DATE(vs.measured_at) = $2) as recorded_today,
        MAX(vs.measured_at) as last_recorded,
        CASE
          WHEN COUNT(*) FILTER (WHERE vs.measured_at >= NOW() - INTERVAL '7 days') > 0 THEN true
          ELSE false
        END as has_regular_monitoring
      FROM vital_signs vs
      WHERE vs.patient_id = $1
    `;

    // 4. Get assessments (check if any are due based on care plan monitoring schedule)
    const assessmentsQuery = `
      SELECT
        cp.next_monitoring_date,
        COUNT(*) FILTER (WHERE DATE(na.assessment_datetime) = $2) as assessments_today
      FROM care_plans cp
      LEFT JOIN nursing_assessments na ON na.patient_id = cp.patient_id
      WHERE cp.patient_id = $1
        AND cp.status = 'active'
      GROUP BY cp.care_plan_id, cp.next_monitoring_date
    `;

    // Execute all queries in parallel
    const [medicationsResult, scheduleResult, vitalsResult, assessmentsResult] = await Promise.all([
      db.query(medicationsQuery, [patientId, language, today]),
      db.query(scheduleQuery, [patientId, dayOfWeek]),
      db.query(vitalsQuery, [patientId, today]),
      db.query(assessmentsQuery, [patientId, today])
    ]);

    // Process medications
    const medications = medicationsResult.rows.map(med => ({
      id: med.id,
      type: 'medication',
      title: med.medication_name,
      time: med.time,
      details: `${med.dose}${med.dose_unit} - ${med.route}`,
      status: med.administered_status || (med.prn ? 'prn' : 'pending'),
      completed: !!med.administered_status,
      completedAt: med.administered_datetime,
      isPRN: med.prn
    }));

    // Process weekly schedule
    const weeklyServices = scheduleResult.rows.map(item => ({
      id: item.id,
      type: 'service',
      title: item.service_data.serviceType || 'Scheduled Service',
      time: item.specific_time || item.time_slot,
      details: item.service_data.provider || item.related_goal || '',
      timeSlot: item.time_slot,
      status: 'scheduled',
      completed: false
    }));

    // Process vitals
    const vitalsInfo = vitalsResult.rows[0];
    const vitalsItems = [];
    if (vitalsInfo.has_regular_monitoring && vitalsInfo.recorded_today === 0) {
      vitalsItems.push({
        id: 'vitals-daily',
        type: 'vitals',
        title: language === 'ja' ? 'バイタルサイン測定' : 'Vital Signs',
        time: '09:00', // Default morning time
        details: language === 'ja' ? '血圧、脈拍、体温、SpO2' : 'BP, HR, Temp, SpO2',
        status: 'pending',
        completed: false,
        lastRecorded: vitalsInfo.last_recorded
      });
    } else if (vitalsInfo.recorded_today > 0) {
      vitalsItems.push({
        id: 'vitals-daily',
        type: 'vitals',
        title: language === 'ja' ? 'バイタルサイン測定' : 'Vital Signs',
        time: '09:00',
        details: language === 'ja' ? '完了' : 'Completed',
        status: 'completed',
        completed: true
      });
    }

    // Process assessments
    const assessmentInfo = assessmentsResult.rows[0];
    const assessmentItems = [];
    if (assessmentInfo && assessmentInfo.next_monitoring_date) {
      const nextDate = new Date(assessmentInfo.next_monitoring_date);
      const todayDate = new Date(today);
      if (nextDate <= todayDate && assessmentInfo.assessments_today === 0) {
        assessmentItems.push({
          id: 'assessment-monitoring',
          type: 'assessment',
          title: language === 'ja' ? 'モニタリング評価' : 'Monitoring Assessment',
          time: '14:00', // Default afternoon time
          details: language === 'ja' ? 'ケアプラン評価' : 'Care Plan Review',
          status: 'due',
          completed: false
        });
      }
    }

    // Combine all items and sort by time
    const allItems = [...medications, ...weeklyServices, ...vitalsItems, ...assessmentItems];

    // Sort by time (convert time strings to comparable format)
    allItems.sort((a, b) => {
      const timeA = a.time || a.timeSlot || '99:99';
      const timeB = b.time || b.timeSlot || '99:99';
      return timeA.localeCompare(timeB);
    });

    // Group by time slot for better organization
    const grouped = {
      morning: allItems.filter(item => {
        const time = item.time || item.timeSlot || '';
        return time < '12:00' || item.timeSlot === 'morning';
      }),
      afternoon: allItems.filter(item => {
        const time = item.time || item.timeSlot || '';
        return (time >= '12:00' && time < '17:00') || item.timeSlot === 'afternoon';
      }),
      evening: allItems.filter(item => {
        const time = item.time || item.timeSlot || '';
        return (time >= '17:00' && time < '21:00') || item.timeSlot === 'evening';
      }),
      night: allItems.filter(item => {
        const time = item.time || item.timeSlot || '';
        return time >= '21:00' || item.timeSlot === 'night';
      })
    };

    res.json({
      success: true,
      data: {
        patientId,
        date: today,
        dayOfWeek,
        allItems,
        grouped,
        summary: {
          total: allItems.length,
          completed: allItems.filter(i => i.completed).length,
          pending: allItems.filter(i => !i.completed && i.status !== 'prn').length,
          medications: medications.length,
          services: weeklyServices.length,
          vitals: vitalsItems.length,
          assessments: assessmentItems.length
        }
      },
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching today schedule:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      details: error.message,
      language
    });
  }
});

// Get staff member's schedule for today (their assigned patients only)
router.get('/today-schedule-all', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const {
      facility_id = '550e8400-e29b-41d4-a716-446655440001',
      staff_id = '550e8400-e29b-41d4-a716-446655440101' // DEMO_STAFF_ID
    } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();

    // Get patients assigned to this staff member (where they are the care manager)
    // Limit to 15 patients max to keep the schedule manageable
    const patientsResult = await db.query(`
      SELECT DISTINCT p.patient_id, p.family_name, p.given_name, p.room
      FROM patients p
      LEFT JOIN care_plans cp ON p.patient_id = cp.patient_id
      WHERE p.facility_id = $1
        AND (cp.care_manager_id = $2 OR cp.care_manager_id IS NULL)
      ORDER BY p.room
      LIMIT 15
    `, [facility_id, staff_id]);

    const allScheduleItems = [];
    let totalStats = {
      total: 0,
      completed: 0,
      pending: 0,
      medications: 0,
      services: 0,
      vitals: 0,
      assessments: 0
    };

    // Get schedule for each patient
    for (const patient of patientsResult.rows) {
      // 1. Medications
      const medicationsQuery = `
        SELECT
          mo.order_id as id,
          CASE
            WHEN $2 = 'ja' THEN mo.medication_name_ja
            WHEN $2 = 'zh-TW' THEN COALESCE(mo.medication_name_zh, mo.medication_name_en)
            ELSE COALESCE(mo.medication_name_en, mo.medication_name_ja)
          END as medication_name,
          mo.dose,
          mo.dose_unit,
          mo.route,
          mo.scheduled_time as time,
          ma.status as administered_status,
          ma.administered_datetime,
          mo.prn
        FROM medication_orders mo
        LEFT JOIN medication_administrations ma ON (
          mo.order_id = ma.order_id
          AND DATE(ma.scheduled_datetime) = $3
        )
        WHERE mo.patient_id = $1
          AND mo.status = 'active'
          AND mo.start_datetime::date <= $3
          AND (mo.end_datetime IS NULL OR mo.end_datetime::date >= $3)
        ORDER BY mo.scheduled_time
      `;

      const medications = await db.query(medicationsQuery, [patient.patient_id, language, today]);

      medications.rows.forEach(med => {
        const completed = med.administered_status === 'administered';
        allScheduleItems.push({
          id: `med-${med.id}`,
          patientId: patient.patient_id,
          patientName: `${patient.family_name} ${patient.given_name}`,
          room: patient.room,
          type: 'medication',
          title: med.medication_name,
          time: med.time || '',
          details: `${med.dose}${med.dose_unit} - ${med.route}`,
          status: med.prn ? 'prn' : (completed ? 'completed' : 'pending'),
          completed,
          completedAt: med.administered_datetime,
          isPRN: med.prn
        });

        totalStats.total++;
        totalStats.medications++;
        if (completed) totalStats.completed++;
        else totalStats.pending++;
      });

      // 2. Weekly schedule items for today
      const weeklyScheduleQuery = `
        SELECT
          wsi.schedule_item_id as id,
          wsi.specific_time as time,
          wsi.time_slot,
          wsi.service_data,
          cp.care_plan_id
        FROM weekly_schedule_items wsi
        JOIN care_plans cp ON wsi.care_plan_id = cp.care_plan_id
        WHERE cp.patient_id = $1
          AND wsi.day_of_week = $2
        ORDER BY wsi.specific_time
      `;

      const weeklyServices = await db.query(weeklyScheduleQuery, [patient.patient_id, dayOfWeek]);

      weeklyServices.rows.forEach(svc => {
        const serviceData = svc.service_data || {};
        const serviceName = serviceData.service_name_ja || serviceData.service_name || 'Service';
        const duration = serviceData.duration_minutes || '';
        const provider = serviceData.provider || '';
        const location = serviceData.location || '';

        allScheduleItems.push({
          id: `svc-${svc.id}`,
          patientId: patient.patient_id,
          patientName: `${patient.family_name} ${patient.given_name}`,
          room: patient.room,
          type: 'service',
          title: serviceName,
          time: svc.time || svc.time_slot,
          details: duration ? `${duration}分 - ${provider} @ ${location}` : `${provider} @ ${location}`,
          status: 'scheduled',
          completed: false
        });

        totalStats.total++;
        totalStats.services++;
        totalStats.pending++;
      });
    }

    // Sort all items by time first, then by room
    allScheduleItems.sort((a, b) => {
      // Handle items without time
      if (!a.time && !b.time) {
        return (a.room || '').localeCompare(b.room || '');
      }
      if (!a.time) return 1;
      if (!b.time) return -1;

      // Primary sort: by time
      const timeCompare = a.time.localeCompare(b.time);
      if (timeCompare !== 0) return timeCompare;

      // Secondary sort: by room (when times are equal)
      return (a.room || '').localeCompare(b.room || '');
    });

    // Group by time slot
    const grouped = {
      morning: allScheduleItems.filter(item => {
        const hour = parseInt(item.time?.split(':')[0] || '0');
        return hour >= 6 && hour < 12;
      }),
      afternoon: allScheduleItems.filter(item => {
        const hour = parseInt(item.time?.split(':')[0] || '0');
        return hour >= 12 && hour < 17;
      }),
      evening: allScheduleItems.filter(item => {
        const hour = parseInt(item.time?.split(':')[0] || '0');
        return hour >= 17 && hour < 21;
      }),
      night: allScheduleItems.filter(item => {
        const hour = parseInt(item.time?.split(':')[0] || '0');
        return hour >= 21 || hour < 6;
      })
    };

    res.json({
      success: true,
      data: {
        facilityId: facility_id,
        staffId: staff_id,
        date: today,
        dayOfWeek,
        totalPatients: patientsResult.rows.length,
        allItems: allScheduleItems,
        grouped,
        summary: totalStats
      },
      language
    });

  } catch (error) {
    console.error('Error fetching facility schedule:', error);
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