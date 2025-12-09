import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';
import { 
  createMedicationHash, 
  getLatestChainHash, 
  generateBarcodeValue, 
  verifyBarcode,
  verifyChainIntegrity,
  validatePatientMedicationChain,
  exportMedicationRecordsWithHashChain
} from '../utils/crypto.js';

const router = express.Router();

router.get('/patient/:patientId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;

    const query = `
      SELECT
        mo.*,
        CASE
          WHEN $2 = 'ja' THEN mo.medication_name_ja
          WHEN $2 = 'zh-TW' THEN COALESCE(mo.medication_name_zh, mo.medication_name_en)
          ELSE COALESCE(mo.medication_name_en, mo.medication_name_ja)
        END as medication_name,
        s.family_name as ordered_by_name,
        s.given_name as ordered_by_given_name
      FROM medication_orders mo
      LEFT JOIN staff s ON mo.ordered_by = s.staff_id
      WHERE mo.patient_id = $1
      ORDER BY mo.scheduled_time, mo.medication_name_ja
    `;

    const result = await db.query(query, [patientId, language]);

    const medications = result.rows.map(med => ({
      ...med,
      barcode: generateBarcodeValue('medication', med.hot_code || med.order_number)
    }));

    res.json({
      success: true,
      data: medications,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching patient medications:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/patient/:patientId/today', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;

    const query = `
      SELECT
        mo.*,
        CASE
          WHEN $2 = 'ja' THEN mo.medication_name_ja
          WHEN $2 = 'zh-TW' THEN COALESCE(mo.medication_name_zh, mo.medication_name_en)
          ELSE COALESCE(mo.medication_name_en, mo.medication_name_ja)
        END as medication_name,
        ma.administration_id,
        ma.status as admin_status,
        ma.administered_datetime,
        s.family_name as administered_by_name,
        s.given_name as administered_by_given_name
      FROM medication_orders mo
      LEFT JOIN medication_administrations ma ON (
        mo.order_id = ma.order_id
        AND DATE(ma.scheduled_datetime) = CURRENT_DATE
      )
      LEFT JOIN staff s ON ma.administered_by = s.staff_id
      WHERE mo.patient_id = $1
        AND mo.status = 'active'
        AND (
          (mo.prn = false AND mo.scheduled_time IS NOT NULL)
          OR mo.prn = true
        )
      ORDER BY mo.scheduled_time, mo.medication_name_ja
    `;

    const result = await db.query(query, [patientId, language]);

    const scheduledMeds = result.rows.filter(m => !m.prn).map(med => ({
      ...med,
      barcode: generateBarcodeValue('medication', med.hot_code || med.order_number),
      status: med.admin_status || 'pending'
    }));

    const prnMeds = result.rows.filter(m => m.prn).map(med => ({
      ...med,
      barcode: generateBarcodeValue('medication', med.hot_code || med.order_number),
      status: med.admin_status || 'available'
    }));

    // Validate hash chain for this patient (background validation)
    const validation = await validatePatientMedicationChain(patientId);

    res.json({
      success: true,
      data: {
        scheduled: scheduledMeds,
        prn: prnMeds
      },
      hashChainVerification: {
        verified: validation.verified,
        valid: validation.valid,
        recordCount: validation.recordCount,
        hasIssues: validation.totalIssues > 0
      },
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching today medications:', error);
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

    if (!verifyBarcode(barcode, 'MED')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid medication barcode format',
        language
      });
    }

    const parts = barcode.split('-');
    const identifier = parts[1];

    const query = `
      SELECT
        mo.*,
        CASE
          WHEN $2 = 'ja' THEN mo.medication_name_ja
          WHEN $2 = 'zh-TW' THEN COALESCE(mo.medication_name_zh, mo.medication_name_en)
          ELSE COALESCE(mo.medication_name_en, mo.medication_name_ja)
        END as medication_name
      FROM medication_orders mo
      WHERE mo.hot_code = $1
         OR mo.order_number = $1
      LIMIT 1
    `;

    const result = await db.query(query, [identifier, language]);

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
      message: 'Medication verified successfully'
    });
  } catch (error) {
    console.error('Error verifying medication barcode:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.post('/administer', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const {
      order_id,
      patient_id,
      scheduled_datetime,
      patient_barcode_scanned,
      patient_barcode_value,
      medication_barcode_scanned,
      medication_barcode_value,
      dose_given,
      route_given,
      status = 'administered',
      reason_if_not_given,
      administered_by,
      notes
    } = req.body;

    if (!order_id || !patient_id || !administered_by || !status) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    const facilityResult = await db.query(
      'SELECT facility_id FROM patients WHERE patient_id = $1',
      [patient_id]
    );

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found',
        language
      });
    }

    const facilityId = facilityResult.rows[0].facility_id;
    const latestHash = await getLatestChainHash(facilityId);

    const administrationData = {
      order_id,
      patient_id,
      administered_datetime: new Date().toISOString(),
      administered_by,
      status,
      dose_given: dose_given || null,
      route_given: route_given || null
    };

    const recordHash = createMedicationHash(administrationData, latestHash.hash);

    const query = `
      INSERT INTO medication_administrations (
        order_id, patient_id, scheduled_datetime, administered_datetime,
        patient_barcode_scanned, patient_barcode_value,
        medication_barcode_scanned, medication_barcode_value,
        dose_given, route_given, status, reason_if_not_given,
        administered_by, notes, record_hash, previous_hash
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *
    `;

    const values = [
      order_id,
      patient_id,
      scheduled_datetime || new Date(),
      new Date(),
      patient_barcode_scanned || false,
      patient_barcode_value,
      medication_barcode_scanned || false,
      medication_barcode_value,
      dose_given,
      route_given,
      status,
      reason_if_not_given,
      administered_by,
      notes,
      recordHash,
      latestHash.hash
    ];

    const result = await db.transaction(async (client) => {
      const adminResult = await client.query(query, values);

      const io = req.app.get('io');
      if (io) {
        io.to(`facility-${facilityId}`).emit('medication:administered', {
          administration: adminResult.rows[0],
          patient_id,
          timestamp: new Date()
        });
      }

      return adminResult;
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      hash: recordHash,
      language,
      message: getTranslation('medication_administered', language)
    });
  } catch (error) {
    console.error('Error recording medication administration:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facility_id = '550e8400-e29b-41d4-a716-446655440001', status } = req.query;

    let query = `
      SELECT
        mo.*,
        CASE
          WHEN $1 = 'ja' THEN mo.medication_name_ja
          WHEN $1 = 'zh-TW' THEN COALESCE(mo.medication_name_zh, mo.medication_name_en)
          ELSE COALESCE(mo.medication_name_en, mo.medication_name_ja)
        END as medication_name,
        p.family_name,
        p.given_name,
        p.room,
        p.bed,
        s.family_name as ordered_by_name,
        s.given_name as ordered_by_given_name
      FROM medication_orders mo
      JOIN patients p ON mo.patient_id = p.patient_id
      LEFT JOIN staff s ON mo.ordered_by = s.staff_id
      WHERE p.facility_id = $2
    `;

    const values = [language, facility_id];

    if (status) {
      query += ` AND mo.status = $3`;
      values.push(status);
    }

    query += ` ORDER BY mo.created_at DESC`;

    const result = await db.query(query, values);

    res.json({
      success: true,
      data: result.rows,
      language,
      message: getTranslation('success', language)
    });
  } catch (error) {
    console.error('Error fetching medication orders:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const {
      patient_id,
      order_number,
      medication_name_ja,
      medication_name_en,
      medication_name_zh,
      hot_code,
      dose,
      dose_unit,
      route,
      frequency,
      scheduled_time,
      start_datetime,
      end_datetime,
      prn = false,
      prn_reason,
      ordered_by
    } = req.body;

    if (!patient_id || !order_number || !medication_name_ja || !dose || !dose_unit || !route || !frequency) {
      return res.status(400).json({
        success: false,
        error: getTranslation('validation_error', language),
        language
      });
    }

    const query = `
      INSERT INTO medication_orders (
        patient_id, order_number, medication_name_ja, medication_name_en,
        medication_name_zh, hot_code, dose, dose_unit, route, frequency,
        scheduled_time, start_datetime, end_datetime, prn, prn_reason,
        status, ordered_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const values = [
      patient_id, order_number, medication_name_ja, medication_name_en,
      medication_name_zh, hot_code, dose, dose_unit, route, frequency,
      scheduled_time, start_datetime || new Date(), end_datetime,
      prn, prn_reason, 'active', ordered_by
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      language,
      message: 'Medication order created successfully'
    });
  } catch (error) {
    console.error('Error creating medication order:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;
    const { status, end_datetime, ...updates } = req.body;

    const allowedFields = ['dose', 'dose_unit', 'frequency', 'scheduled_time', 'prn_reason'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (end_datetime !== undefined) {
      updateFields.push(`end_datetime = $${paramCount}`);
      values.push(end_datetime);
      paramCount++;
    }

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
      UPDATE medication_orders
      SET ${updateFields.join(', ')}
      WHERE order_id = $${paramCount}
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
      message: 'Medication order updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication order:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Verify hash chain integrity for a facility
router.get('/verify-chain/:facilityId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facilityId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;

    const verification = await verifyChainIntegrity(facilityId, limit);

    res.json({
      success: true,
      data: verification,
      language,
      message: verification.message
    });
  } catch (error) {
    console.error('Error verifying medication hash chain:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Verify hash chain for a specific patient
router.get('/verify-chain/patient/:patientId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patientId } = req.params;

    const validation = await validatePatientMedicationChain(patientId);

    res.json({
      success: true,
      data: validation,
      language,
      message: validation.message
    });
  } catch (error) {
    console.error('Error validating patient medication chain:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

// Export medication records with hash chain data
router.get('/export/:facilityId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { facilityId } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 1000
    };

    const records = await exportMedicationRecordsWithHashChain(facilityId, options);

    res.json({
      success: true,
      data: records,
      count: records.length,
      language,
      message: `Exported ${records.length} medication records with hash chain data`
    });
  } catch (error) {
    console.error('Error exporting medication records:', error);
    const language = detectLanguage(req);
    res.status(500).json({
      success: false,
      error: getTranslation('error', language),
      language
    });
  }
});

export default router;