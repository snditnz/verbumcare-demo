/**
 * Audit Logs API Routes
 * 
 * Provides endpoints for querying and exporting audit logs.
 * Admin-only access for security.
 */

import express from 'express';
import auditLogService from '../services/auditLog.js';

const router = express.Router();

/**
 * Query audit logs with filters
 * GET /api/audit-logs
 * 
 * Query parameters:
 * - userId: Filter by user ID
 * - patientId: Filter by patient ID
 * - resourceType: Filter by resource type
 * - eventType: Filter by event type
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 * - limit: Maximum results (default 100)
 * - offset: Pagination offset (default 0)
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      patientId: req.query.patientId,
      resourceType: req.query.resourceType,
      eventType: req.query.eventType,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const logs = await auditLogService.queryAuditLogs(filters);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
      filters
    });
  } catch (error) {
    console.error('[AuditLogs API] Error querying audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
      message: error.message
    });
  }
});

/**
 * Get audit log statistics
 * GET /api/audit-logs/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await auditLogService.getAuditLogStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[AuditLogs API] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit log statistics',
      message: error.message
    });
  }
});

/**
 * Verify hash chain integrity
 * GET /api/audit-logs/verify
 * 
 * Query parameters:
 * - limit: Number of recent records to verify (default 1000)
 */
router.get('/verify', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    const verification = await auditLogService.verifyHashChain(limit);

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('[AuditLogs API] Error verifying hash chain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify hash chain',
      message: error.message
    });
  }
});

/**
 * Export audit logs
 * GET /api/audit-logs/export
 * 
 * Query parameters: Same as query endpoint
 * Returns: JSON file download
 */
router.get('/export', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      patientId: req.query.patientId,
      resourceType: req.query.resourceType,
      eventType: req.query.eventType,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
    };

    const exportData = await auditLogService.exportAuditLogs(filters);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.json"`);
    res.send(exportData);
  } catch (error) {
    console.error('[AuditLogs API] Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
      message: error.message
    });
  }
});

export default router;
