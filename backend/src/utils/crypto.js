import crypto from 'crypto';
import db from '../db/index.js';

export function createMedicationHash(administrationData, previousHash = '0000000000000000000000000000000000000000000000000000000000000000') {
  const canonical = JSON.stringify({
    patient_id: administrationData.patient_id,
    order_id: administrationData.order_id,
    administered_datetime: administrationData.administered_datetime,
    administered_by: administrationData.administered_by,
    status: administrationData.status,
    dose_given: administrationData.dose_given,
    route_given: administrationData.route_given,
    previous_hash: previousHash,
    timestamp: new Date().toISOString()
  }, Object.keys(administrationData).sort());

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function getLatestChainHash(facilityId) {
  try {
    const query = `
      SELECT ma.record_hash, ma.chain_sequence
      FROM medication_administrations ma
      JOIN patients p ON ma.patient_id = p.patient_id
      WHERE p.facility_id = $1
      ORDER BY ma.chain_sequence DESC
      LIMIT 1
    `;

    const result = await db.query(query, [facilityId]);

    if (result.rows.length === 0) {
      return {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        sequence: 0
      };
    }

    return {
      hash: result.rows[0].record_hash,
      sequence: parseInt(result.rows[0].chain_sequence)
    };
  } catch (error) {
    console.error('Error getting latest chain hash:', error);
    throw error;
  }
}

export async function verifyChainIntegrity(facilityId, limit = 100) {
  try {
    const query = `
      SELECT
        ma.administration_id,
        ma.record_hash,
        ma.previous_hash,
        ma.chain_sequence,
        ma.patient_id,
        ma.order_id,
        ma.administered_datetime,
        ma.administered_by,
        ma.status,
        ma.dose_given,
        ma.route_given
      FROM medication_administrations ma
      JOIN patients p ON ma.patient_id = p.patient_id
      WHERE p.facility_id = $1
      ORDER BY ma.chain_sequence ASC
      LIMIT $2
    `;

    const result = await db.query(query, [facilityId, limit]);

    if (result.rows.length === 0) {
      return { valid: true, brokenLinks: [], tamperedRecords: [], message: 'No records found' };
    }

    const brokenLinks = [];
    const tamperedRecords = [];
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const record of result.rows) {
      if (record.chain_sequence === 1) {
        previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
      }

      // Check if previous_hash matches expected
      if (record.previous_hash !== previousHash) {
        brokenLinks.push({
          sequence: record.chain_sequence,
          administration_id: record.administration_id,
          expected_previous: previousHash,
          actual_previous: record.previous_hash,
          type: 'broken_link'
        });
      }

      // Verify record_hash matches computed hash
      const administrationData = {
        patient_id: record.patient_id,
        order_id: record.order_id,
        administered_datetime: record.administered_datetime,
        administered_by: record.administered_by,
        status: record.status,
        dose_given: record.dose_given,
        route_given: record.route_given
      };

      const computedHash = createMedicationHash(administrationData, record.previous_hash);
      if (computedHash !== record.record_hash) {
        tamperedRecords.push({
          sequence: record.chain_sequence,
          administration_id: record.administration_id,
          expected_hash: computedHash,
          actual_hash: record.record_hash,
          type: 'tampered_data'
        });
      }

      previousHash = record.record_hash;
    }

    const allIssues = [...brokenLinks, ...tamperedRecords];
    
    return {
      valid: allIssues.length === 0,
      brokenLinks,
      tamperedRecords,
      totalIssues: allIssues.length,
      message: allIssues.length === 0
        ? 'Chain integrity verified successfully'
        : `Found ${brokenLinks.length} broken links and ${tamperedRecords.length} tampered records`
    };
  } catch (error) {
    console.error('Error verifying chain integrity:', error);
    throw error;
  }
}

export function generateBarcodeValue(type, identifier) {
  const prefix = type === 'patient' ? 'PAT' : 'MED';
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${identifier}-${timestamp}-${random}`.toUpperCase();
}

export function verifyBarcode(scannedValue, expectedPrefix) {
  if (!scannedValue || typeof scannedValue !== 'string') {
    return false;
  }

  const parts = scannedValue.split('-');
  if (parts.length < 2) {
    return false;
  }

  return parts[0] === expectedPrefix;
}

/**
 * Validate hash chain for a specific patient's medication records
 * 
 * @param {string} patientId - Patient ID to validate records for
 * @returns {Promise<Object>} - Validation result with verification status
 */
export async function validatePatientMedicationChain(patientId) {
  try {
    const query = `
      SELECT
        ma.administration_id,
        ma.record_hash,
        ma.previous_hash,
        ma.chain_sequence,
        ma.patient_id,
        ma.order_id,
        ma.administered_datetime,
        ma.administered_by,
        ma.status,
        ma.dose_given,
        ma.route_given,
        p.facility_id
      FROM medication_administrations ma
      JOIN patients p ON ma.patient_id = p.patient_id
      WHERE ma.patient_id = $1
      ORDER BY ma.chain_sequence ASC
    `;

    const result = await db.query(query, [patientId]);

    if (result.rows.length === 0) {
      return { 
        valid: true, 
        verified: true,
        recordCount: 0,
        message: 'No records found' 
      };
    }

    const facilityId = result.rows[0].facility_id;
    const validation = await verifyChainIntegrity(facilityId, result.rows.length);

    return {
      valid: validation.valid,
      verified: validation.valid,
      recordCount: result.rows.length,
      brokenLinks: validation.brokenLinks || [],
      tamperedRecords: validation.tamperedRecords || [],
      totalIssues: validation.totalIssues || 0,
      message: validation.message
    };
  } catch (error) {
    console.error('Error validating patient medication chain:', error);
    return {
      valid: false,
      verified: false,
      error: error.message,
      message: 'Validation failed due to error'
    };
  }
}

/**
 * Export medication administration records with hash chain data
 * 
 * @param {string} facilityId - Facility ID to export records for
 * @param {Object} options - Export options
 * @param {Date} options.startDate - Start date for export
 * @param {Date} options.endDate - End date for export
 * @param {number} options.limit - Maximum number of records to export
 * @returns {Promise<Array>} - Array of medication records with hash chain data
 */
export async function exportMedicationRecordsWithHashChain(facilityId, options = {}) {
  try {
    const { startDate, endDate, limit = 1000 } = options;
    
    let query = `
      SELECT
        ma.administration_id,
        ma.order_id,
        ma.patient_id,
        ma.scheduled_datetime,
        ma.administered_datetime,
        ma.patient_barcode_scanned,
        ma.patient_barcode_value,
        ma.medication_barcode_scanned,
        ma.medication_barcode_value,
        ma.dose_given,
        ma.route_given,
        ma.status,
        ma.reason_if_not_given,
        ma.administered_by,
        ma.notes,
        ma.record_hash,
        ma.previous_hash,
        ma.chain_sequence,
        ma.created_at,
        p.mrn as patient_mrn,
        mo.medication_name_ja,
        mo.medication_name_en,
        s.username as administered_by_username
      FROM medication_administrations ma
      JOIN patients p ON ma.patient_id = p.patient_id
      LEFT JOIN medication_orders mo ON ma.order_id = mo.order_id
      LEFT JOIN staff s ON ma.administered_by = s.staff_id
      WHERE p.facility_id = $1
    `;
    
    const params = [facilityId];
    let paramCount = 2;
    
    if (startDate) {
      query += ` AND ma.administered_datetime >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }
    
    if (endDate) {
      query += ` AND ma.administered_datetime <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }
    
    query += ` ORDER BY ma.chain_sequence ASC LIMIT $${paramCount}`;
    params.push(limit);
    
    const result = await db.query(query, params);
    
    return result.rows.map(record => ({
      ...record,
      // Ensure hash chain fields are included
      hash_chain: {
        record_hash: record.record_hash,
        previous_hash: record.previous_hash,
        chain_sequence: record.chain_sequence
      }
    }));
  } catch (error) {
    console.error('Error exporting medication records with hash chain:', error);
    throw error;
  }
}