/**
 * Audit Logging Service
 * 
 * Provides comprehensive audit logging with cryptographic hash chain for immutability.
 * Implements Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import crypto from 'crypto';
import db from '../db/index.js';

/**
 * Event types for audit logging
 */
export const AuditEventType = {
  DATA_ACCESS: 'data_access',
  DATA_CREATE: 'data_create',
  DATA_UPDATE: 'data_update',
  DATA_DELETE: 'data_delete',
  PATIENT_VIEW: 'patient_view',
  PATIENT_UPDATE: 'patient_update',
  CARE_PLAN_VIEW: 'care_plan_view',
  CARE_PLAN_UPDATE: 'care_plan_update',
  MEDICATION_VIEW: 'medication_view',
  MEDICATION_ADMIN: 'medication_admin',
  VITALS_VIEW: 'vitals_view',
  VITALS_CREATE: 'vitals_create',
  CLINICAL_NOTE_VIEW: 'clinical_note_view',
  CLINICAL_NOTE_CREATE: 'clinical_note_create',
  ASSESSMENT_VIEW: 'assessment_view',
  ASSESSMENT_CREATE: 'assessment_create',
  VOICE_UPLOAD: 'voice_upload',
  VOICE_PROCESS: 'voice_process',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data'
};

/**
 * Calculate SHA-256 hash of audit log record
 * @param {Object} record - Audit log record data
 * @returns {string} - Hex-encoded SHA-256 hash
 */
function calculateRecordHash(record) {
  const data = JSON.stringify({
    event_type: record.event_type,
    action_description: record.action_description,
    user_id: record.user_id,
    username: record.username,
    resource_type: record.resource_type,
    resource_id: record.resource_id,
    patient_id: record.patient_id,
    before_value: record.before_value,
    after_value: record.after_value,
    timestamp: record.timestamp,
    previous_hash: record.previous_hash
  });
  
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Get the hash of the most recent audit log entry
 * @returns {Promise<string>} - Hash of latest entry or genesis hash
 */
async function getLatestHash() {
  try {
    const result = await db.query('SELECT get_latest_audit_hash() as hash');
    return result.rows[0].hash;
  } catch (error) {
    console.error('[AuditLog] Error getting latest hash:', error);
    // Return genesis hash on error
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
}

/**
 * Create an audit log entry
 * 
 * @param {Object} params - Audit log parameters
 * @param {string} params.eventType - Type of event (from AuditEventType)
 * @param {string} params.actionDescription - Human-readable description
 * @param {string} params.userId - UUID of user performing action
 * @param {string} params.username - Username of user
 * @param {string} [params.userRole] - Role of user
 * @param {string} [params.resourceType] - Type of resource (e.g., 'patient', 'care_plan')
 * @param {string} [params.resourceId] - UUID of resource
 * @param {string} [params.patientId] - UUID of patient (for patient-related actions)
 * @param {Object} [params.beforeValue] - State before modification
 * @param {Object} [params.afterValue] - State after modification
 * @param {string} [params.ipAddress] - IP address of request
 * @param {Object} [params.deviceInfo] - Device information
 * @param {string} [params.sessionId] - Session ID
 * @param {string} [params.facilityId] - Facility ID
 * @returns {Promise<Object>} - Created audit log entry
 */
export async function createAuditLog(params) {
  const {
    eventType,
    actionDescription,
    userId,
    username,
    userRole = null,
    resourceType = null,
    resourceId = null,
    patientId = null,
    beforeValue = null,
    afterValue = null,
    ipAddress = null,
    deviceInfo = null,
    sessionId = null,
    facilityId = null
  } = params;

  try {
    // Get previous hash for chain
    const previousHash = await getLatestHash();
    
    // Create timestamp
    const timestamp = new Date();
    
    // Prepare record for hashing
    const recordForHash = {
      event_type: eventType,
      action_description: actionDescription,
      user_id: userId,
      username,
      resource_type: resourceType,
      resource_id: resourceId,
      patient_id: patientId,
      before_value: beforeValue,
      after_value: afterValue,
      timestamp: timestamp.toISOString(),
      previous_hash: previousHash
    };
    
    // Calculate hash
    const recordHash = calculateRecordHash(recordForHash);
    
    // Insert audit log
    const query = `
      INSERT INTO audit_logs (
        event_type, action_description, user_id, username, user_role,
        resource_type, resource_id, patient_id,
        before_value, after_value,
        ip_address, device_info, session_id,
        record_hash, previous_hash,
        timestamp, facility_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    
    const values = [
      eventType,
      actionDescription,
      userId,
      username,
      userRole,
      resourceType,
      resourceId,
      patientId,
      beforeValue ? JSON.stringify(beforeValue) : null,
      afterValue ? JSON.stringify(afterValue) : null,
      ipAddress,
      deviceInfo ? JSON.stringify(deviceInfo) : null,
      sessionId,
      recordHash,
      previousHash,
      timestamp,
      facilityId
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[AuditLog] Error creating audit log:', error);
    throw error;
  }
}

/**
 * Log data access event
 * 
 * @param {Object} params - Access log parameters
 * @param {string} params.userId - User ID
 * @param {string} params.username - Username
 * @param {string} params.resourceType - Type of resource accessed
 * @param {string} params.resourceId - ID of resource accessed
 * @param {string} [params.patientId] - Patient ID if applicable
 * @param {string} [params.ipAddress] - IP address
 * @param {Object} [params.deviceInfo] - Device info
 * @returns {Promise<Object>} - Audit log entry
 */
export async function logDataAccess(params) {
  return createAuditLog({
    eventType: AuditEventType.DATA_ACCESS,
    actionDescription: `Accessed ${params.resourceType} ${params.resourceId}`,
    ...params
  });
}

/**
 * Log data modification event
 * 
 * @param {Object} params - Modification log parameters
 * @param {string} params.userId - User ID
 * @param {string} params.username - Username
 * @param {string} params.eventType - Type of modification (create/update/delete)
 * @param {string} params.resourceType - Type of resource modified
 * @param {string} params.resourceId - ID of resource modified
 * @param {Object} params.beforeValue - State before modification
 * @param {Object} params.afterValue - State after modification
 * @param {string} [params.patientId] - Patient ID if applicable
 * @param {string} [params.ipAddress] - IP address
 * @param {Object} [params.deviceInfo] - Device info
 * @returns {Promise<Object>} - Audit log entry
 */
export async function logDataModification(params) {
  const { eventType, resourceType, beforeValue, afterValue } = params;
  
  let actionDescription;
  if (eventType === AuditEventType.DATA_CREATE) {
    actionDescription = `Created ${resourceType}`;
  } else if (eventType === AuditEventType.DATA_UPDATE) {
    actionDescription = `Updated ${resourceType}`;
  } else if (eventType === AuditEventType.DATA_DELETE) {
    actionDescription = `Deleted ${resourceType}`;
  } else {
    actionDescription = `Modified ${resourceType}`;
  }
  
  return createAuditLog({
    ...params,
    actionDescription,
    beforeValue,
    afterValue
  });
}

/**
 * Query audit logs with filters
 * 
 * @param {Object} filters - Query filters
 * @param {string} [filters.userId] - Filter by user ID
 * @param {string} [filters.patientId] - Filter by patient ID
 * @param {string} [filters.resourceType] - Filter by resource type
 * @param {string} [filters.eventType] - Filter by event type
 * @param {Date} [filters.startDate] - Filter by start date
 * @param {Date} [filters.endDate] - Filter by end date
 * @param {number} [filters.limit=100] - Maximum number of results
 * @param {number} [filters.offset=0] - Offset for pagination
 * @returns {Promise<Array>} - Array of audit log entries
 */
export async function queryAuditLogs(filters = {}) {
  const {
    userId,
    patientId,
    resourceType,
    eventType,
    startDate,
    endDate,
    limit = 100,
    offset = 0
  } = filters;

  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (userId) {
      query += ` AND user_id = $${paramCount}`;
      values.push(userId);
      paramCount++;
    }

    if (patientId) {
      query += ` AND patient_id = $${paramCount}`;
      values.push(patientId);
      paramCount++;
    }

    if (resourceType) {
      query += ` AND resource_type = $${paramCount}`;
      values.push(resourceType);
      paramCount++;
    }

    if (eventType) {
      query += ` AND event_type = $${paramCount}`;
      values.push(eventType);
      paramCount++;
    }

    if (startDate) {
      query += ` AND timestamp >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await db.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('[AuditLog] Error querying audit logs:', error);
    throw error;
  }
}

/**
 * Verify hash chain integrity
 * 
 * @param {number} [limit=1000] - Number of recent records to verify
 * @returns {Promise<Object>} - Verification result
 */
export async function verifyHashChain(limit = 1000) {
  try {
    const query = `
      SELECT log_id, record_hash, previous_hash, timestamp
      FROM audit_logs
      ORDER BY timestamp ASC, log_id ASC
      LIMIT $1
    `;
    
    const result = await db.query(query, [limit]);
    const logs = result.rows;
    
    if (logs.length === 0) {
      return {
        valid: true,
        message: 'No audit logs to verify',
        totalChecked: 0
      };
    }
    
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const invalidRecords = [];
    
    for (const log of logs) {
      if (log.previous_hash !== previousHash) {
        invalidRecords.push({
          log_id: log.log_id,
          timestamp: log.timestamp,
          expected_previous_hash: previousHash,
          actual_previous_hash: log.previous_hash
        });
      }
      previousHash = log.record_hash;
    }
    
    return {
      valid: invalidRecords.length === 0,
      totalChecked: logs.length,
      invalidRecords,
      message: invalidRecords.length === 0 
        ? `All ${logs.length} records verified successfully`
        : `Found ${invalidRecords.length} invalid records out of ${logs.length}`
    };
  } catch (error) {
    console.error('[AuditLog] Error verifying hash chain:', error);
    throw error;
  }
}

/**
 * Export audit logs to JSON
 * 
 * @param {Object} filters - Query filters (same as queryAuditLogs)
 * @returns {Promise<string>} - JSON string of audit logs
 */
export async function exportAuditLogs(filters = {}) {
  try {
    // Remove limit/offset for export (get all matching records)
    const { limit, offset, ...exportFilters } = filters;
    const logs = await queryAuditLogs({ ...exportFilters, limit: 10000, offset: 0 });
    
    return JSON.stringify({
      export_date: new Date().toISOString(),
      total_records: logs.length,
      filters: exportFilters,
      audit_logs: logs
    }, null, 2);
  } catch (error) {
    console.error('[AuditLog] Error exporting audit logs:', error);
    throw error;
  }
}

/**
 * Get audit log statistics
 * 
 * @returns {Promise<Object>} - Statistics about audit logs
 */
export async function getAuditLogStats() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT patient_id) as unique_patients,
        MIN(timestamp) as earliest_log,
        MAX(timestamp) as latest_log,
        event_type,
        COUNT(*) as event_count
      FROM audit_logs
      GROUP BY event_type
    `;
    
    const result = await db.query(query);
    
    const totalQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT patient_id) as unique_patients,
        MIN(timestamp) as earliest_log,
        MAX(timestamp) as latest_log
      FROM audit_logs
    `;
    
    const totalResult = await db.query(totalQuery);
    
    return {
      ...totalResult.rows[0],
      event_breakdown: result.rows
    };
  } catch (error) {
    console.error('[AuditLog] Error getting audit log stats:', error);
    throw error;
  }
}

export default {
  AuditEventType,
  createAuditLog,
  logDataAccess,
  logDataModification,
  queryAuditLogs,
  verifyHashChain,
  exportAuditLogs,
  getAuditLogStats
};
