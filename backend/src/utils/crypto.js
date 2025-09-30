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
      return { valid: true, brokenLinks: [], message: 'No records found' };
    }

    const brokenLinks = [];
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const record of result.rows) {
      if (record.chain_sequence === 1) {
        previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
      }

      if (record.previous_hash !== previousHash) {
        brokenLinks.push({
          sequence: record.chain_sequence,
          administration_id: record.administration_id,
          expected_previous: previousHash,
          actual_previous: record.previous_hash
        });
      }

      const administrationData = {
        patient_id: record.patient_id,
        order_id: record.order_id,
        administered_datetime: record.administered_datetime,
        administered_by: record.administered_by,
        status: record.status,
        dose_given: record.dose_given,
        route_given: record.route_given
      };

      previousHash = record.record_hash;
    }

    return {
      valid: brokenLinks.length === 0,
      brokenLinks,
      message: brokenLinks.length === 0
        ? 'Chain integrity verified successfully'
        : `Found ${brokenLinks.length} broken links in chain`
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