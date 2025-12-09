/**
 * Property-Based Tests for Audit Logging System
 * 
 * Tests Properties 22-25 from the design document
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Mock database module BEFORE importing auditLogService
const mockQuery = jest.fn();
jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Import after mocking
const { default: auditLogService } = await import('../auditLog.js');

// Custom generators for audit log testing
const uuidGenerator = fc.uuid();
const usernameGenerator = fc.string({ minLength: 3, maxLength: 20 });
const eventTypeGenerator = fc.constantFrom(
  'data_access', 'data_create', 'data_update', 'data_delete',
  'patient_view', 'patient_update', 'care_plan_view', 'care_plan_update'
);
const resourceTypeGenerator = fc.constantFrom(
  'patient', 'care_plan', 'medication', 'vital_signs', 'clinical_note'
);

const auditLogParamsGenerator = fc.record({
  eventType: eventTypeGenerator,
  actionDescription: fc.string({ minLength: 10, maxLength: 100 }),
  userId: uuidGenerator,
  username: usernameGenerator,
  resourceType: resourceTypeGenerator,
  resourceId: uuidGenerator,
  patientId: fc.option(uuidGenerator, { nil: null })
});

describe('Audit Logging Property Tests', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: code-consistency-security-offline, Property 22: Data access creates audit log
   * Validates: Requirements 7.1
   */
  describe('Property 22: Data access creates audit log', () => {
    it('should create audit log entry for any data access', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidGenerator,
          usernameGenerator,
          resourceTypeGenerator,
          uuidGenerator,
          fc.option(uuidGenerator, { nil: null }),
          async (userId, username, resourceType, resourceId, patientId) => {
            // Clear mock before each iteration
            mockQuery.mockClear();
            
            // Mock database responses
            mockQuery
              .mockResolvedValueOnce({ rows: [{ hash: '0000000000000000000000000000000000000000000000000000000000000000' }] }) // get_latest_audit_hash
              .mockResolvedValueOnce({ rows: [{ 
                log_id: fc.sample(uuidGenerator, 1)[0],
                event_type: 'data_access',
                user_id: userId,
                username,
                resource_type: resourceType,
                resource_id: resourceId,
                patient_id: patientId,
                timestamp: new Date()
              }] }); // INSERT

            const result = await auditLogService.logDataAccess({
              userId,
              username,
              resourceType,
              resourceId,
              patientId
            });

            // Verify audit log was created
            expect(result).toBeDefined();
            expect(result.event_type).toBe('data_access');
            expect(result.user_id).toBe(userId);
            expect(result.username).toBe(username);
            expect(result.resource_type).toBe(resourceType);
            expect(result.resource_id).toBe(resourceId);
            
            // Verify database was called
            expect(mockQuery).toHaveBeenCalledTimes(2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 23: Data modification logs before/after
   * Validates: Requirements 7.2
   */
  describe('Property 23: Data modification logs before/after', () => {
    it('should log before and after values for any data modification', async () => {
      await fc.assert(
        fc.asyncProperty(
          auditLogParamsGenerator,
          fc.record({
            field1: fc.string(),
            field2: fc.integer()
          }),
          fc.record({
            field1: fc.string(),
            field2: fc.integer()
          }),
          async (params, beforeValue, afterValue) => {
            // Clear mock before each iteration
            mockQuery.mockClear();
            
            // Mock database responses
            mockQuery
              .mockResolvedValueOnce({ rows: [{ hash: '0000000000000000000000000000000000000000000000000000000000000000' }] })
              .mockResolvedValueOnce({ rows: [{ 
                log_id: fc.sample(uuidGenerator, 1)[0],
                event_type: 'data_update',
                before_value: beforeValue,
                after_value: afterValue,
                user_id: params.userId,
                timestamp: new Date()
              }] });

            const result = await auditLogService.logDataModification({
              ...params,
              eventType: 'data_update',
              beforeValue,
              afterValue
            });

            // Verify both before and after values are logged
            expect(result).toBeDefined();
            expect(result.before_value).toEqual(beforeValue);
            expect(result.after_value).toEqual(afterValue);
            expect(result.user_id).toBe(params.userId);
            
            // Verify database was called
            expect(mockQuery).toHaveBeenCalledTimes(2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 24: Audit log immutability
   * Validates: Requirements 7.3
   */
  describe('Property 24: Audit log immutability', () => {
    it('should detect tampering through hash chain verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              log_id: uuidGenerator,
              record_hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
              previous_hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
              timestamp: fc.date()
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (logs) => {
            // Create a valid chain
            const validChain = logs.map((log, index) => ({
              ...log,
              previous_hash: index === 0 
                ? '0000000000000000000000000000000000000000000000000000000000000000'
                : logs[index - 1].record_hash
            }));

            // Mock database to return valid chain
            mockQuery.mockResolvedValueOnce({ rows: validChain });

            const validResult = await auditLogService.verifyHashChain(logs.length);
            
            // Valid chain should pass verification
            expect(validResult.valid).toBe(true);
            expect(validResult.totalChecked).toBe(logs.length);
            expect(validResult.invalidRecords).toHaveLength(0);

            // Now tamper with the chain (break a link)
            if (logs.length > 1) {
              const tamperedChain = [...validChain];
              tamperedChain[1].previous_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

              mockQuery.mockResolvedValueOnce({ rows: tamperedChain });

              const tamperedResult = await auditLogService.verifyHashChain(logs.length);
              
              // Tampered chain should fail verification
              expect(tamperedResult.valid).toBe(false);
              expect(tamperedResult.invalidRecords.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to complexity
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 25: Audit log filtering
   * Validates: Requirements 7.4
   */
  describe('Property 25: Audit log filtering', () => {
    it('should return only logs matching all specified filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidGenerator,
          uuidGenerator,
          resourceTypeGenerator,
          eventTypeGenerator,
          async (userId, patientId, resourceType, eventType) => {
            // Clear mock before each iteration
            mockQuery.mockClear();
            
            // Generate sample logs
            const matchingLogs = fc.sample(
              fc.record({
                log_id: uuidGenerator,
                event_type: fc.constant(eventType),
                user_id: fc.constant(userId),
                patient_id: fc.constant(patientId),
                resource_type: fc.constant(resourceType),
                timestamp: fc.date()
              }),
              5
            );

            // Mock database to return matching logs
            mockQuery.mockResolvedValueOnce({ rows: matchingLogs });

            const filters = {
              userId,
              patientId,
              resourceType,
              eventType,
              limit: 100,
              offset: 0
            };

            const result = await auditLogService.queryAuditLogs(filters);

            // Verify all returned logs match the filters
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            
            result.forEach(log => {
              expect(log.user_id).toBe(userId);
              expect(log.patient_id).toBe(patientId);
              expect(log.resource_type).toBe(resourceType);
              expect(log.event_type).toBe(eventType);
            });

            // Verify database was called with correct filters
            expect(mockQuery).toHaveBeenCalledTimes(1);
            const queryCall = mockQuery.mock.calls[0];
            expect(queryCall[0]).toContain('user_id = $');
            expect(queryCall[0]).toContain('patient_id = $');
            expect(queryCall[0]).toContain('resource_type = $');
            expect(queryCall[0]).toContain('event_type = $');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle date range filters correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          async (date1, date2) => {
            // Clear mock before each iteration
            mockQuery.mockClear();
            
            const startDate = date1 < date2 ? date1 : date2;
            const endDate = date1 < date2 ? date2 : date1;

            // Generate logs within date range
            const logsInRange = fc.sample(
              fc.record({
                log_id: uuidGenerator,
                event_type: eventTypeGenerator,
                timestamp: fc.constant(new Date((startDate.getTime() + endDate.getTime()) / 2))
              }),
              3
            );

            mockQuery.mockResolvedValueOnce({ rows: logsInRange });

            const result = await auditLogService.queryAuditLogs({
              startDate,
              endDate,
              limit: 100,
              offset: 0
            });

            // Verify all returned logs are within date range
            result.forEach(log => {
              const logDate = new Date(log.timestamp);
              expect(logDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(logDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
            });

            // Verify database was called with date filters
            expect(mockQuery).toHaveBeenCalledTimes(1);
            const queryCall = mockQuery.mock.calls[0];
            expect(queryCall[0]).toContain('timestamp >=');
            expect(queryCall[0]).toContain('timestamp <=');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Hash chain continuity
   * Ensures each record links to the previous record
   */
  describe('Hash Chain Continuity', () => {
    it('should maintain continuous hash chain for any sequence of audit logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(auditLogParamsGenerator, { minLength: 2, maxLength: 5 }),
          async (logParams) => {
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            const createdLogs = [];

            for (const params of logParams) {
              // Mock database responses for each log creation
              mockQuery
                .mockResolvedValueOnce({ rows: [{ hash: previousHash }] })
                .mockResolvedValueOnce({ rows: [{ 
                  log_id: fc.sample(uuidGenerator, 1)[0],
                  previous_hash: previousHash,
                  record_hash: fc.sample(fc.hexaString({ minLength: 64, maxLength: 64 }), 1)[0],
                  ...params
                }] });

              const result = await auditLogService.createAuditLog(params);
              
              // Verify this log links to previous
              expect(result.previous_hash).toBe(previousHash);
              
              // Update previous hash for next iteration
              previousHash = result.record_hash;
              createdLogs.push(result);
            }

            // Verify chain continuity
            for (let i = 1; i < createdLogs.length; i++) {
              expect(createdLogs[i].previous_hash).toBe(createdLogs[i - 1].record_hash);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
