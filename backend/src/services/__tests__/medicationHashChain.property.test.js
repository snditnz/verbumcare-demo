/**
 * Property-Based Tests for Medication Hash Chain
 * 
 * Tests cryptographic hash chain integrity for medication administration records.
 * Implements Requirements 8.1, 8.2, 8.3, 8.5
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Mock database module BEFORE importing crypto utilities
const mockQuery = jest.fn();
jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    query: mockQuery
  }
}));

// Import after mocking
const { createMedicationHash, getLatestChainHash, verifyChainIntegrity } = await import('../../utils/crypto.js');

describe('Medication Hash Chain Property Tests', () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: code-consistency-security-offline, Property 26: Hash chain linking
   * Validates: Requirements 8.1
   * 
   * For any medication administration record, the record's previous_hash field 
   * should equal the record_hash of the chronologically previous administration
   */
  describe('Property 26: Hash chain linking', () => {
    it('should link each record to previous record hash for any sequence of administrations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of medication administration records
          fc.array(
            fc.record({
              patient_id: fc.uuid(),
              order_id: fc.uuid(),
              administered_by: fc.uuid(),
              status: fc.constantFrom('administered', 'not_given', 'refused'),
              dose_given: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
              route_given: fc.option(fc.constantFrom('oral', 'iv', 'im', 'sc', 'topical'), { nil: null })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (administrations) => {
            // Start with genesis hash
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            
            for (let i = 0; i < administrations.length; i++) {
              const admin = administrations[i];
              
              // Add administered_datetime
              const administrationData = {
                ...admin,
                administered_datetime: new Date(Date.now() + i * 1000).toISOString()
              };
              
              // Create hash with previous hash
              const recordHash = createMedicationHash(administrationData, previousHash);
              
              // Verify the hash is deterministic
              const recordHash2 = createMedicationHash(administrationData, previousHash);
              expect(recordHash).toBe(recordHash2);
              
              // Verify hash is a valid SHA-256 (64 hex characters)
              expect(recordHash).toMatch(/^[a-f0-9]{64}$/);
              
              // Verify hash changes if data changes
              const modifiedData = { ...administrationData, status: 'modified' };
              const modifiedHash = createMedicationHash(modifiedData, previousHash);
              expect(modifiedHash).not.toBe(recordHash);
              
              // Update previousHash for next iteration
              previousHash = recordHash;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain chain continuity when querying from database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // facility_id
          fc.array(
            fc.record({
              administration_id: fc.uuid(),
              patient_id: fc.uuid(),
              order_id: fc.uuid(),
              administered_datetime: fc.date(),
              administered_by: fc.uuid(),
              status: fc.constantFrom('administered', 'not_given', 'refused'),
              dose_given: fc.option(fc.string(), { nil: null }),
              route_given: fc.option(fc.string(), { nil: null }),
              chain_sequence: fc.integer({ min: 1, max: 100 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (facilityId, records) => {
            // Sort by chain_sequence
            const sortedRecords = [...records].sort((a, b) => a.chain_sequence - b.chain_sequence);
            
            // Build proper hash chain
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            const chainedRecords = sortedRecords.map((record, index) => {
              const administrationData = {
                patient_id: record.patient_id,
                order_id: record.order_id,
                administered_datetime: record.administered_datetime.toISOString(),
                administered_by: record.administered_by,
                status: record.status,
                dose_given: record.dose_given,
                route_given: record.route_given
              };
              
              const recordHash = createMedicationHash(administrationData, previousHash);
              const chainedRecord = {
                ...record,
                record_hash: recordHash,
                previous_hash: previousHash,
                chain_sequence: index + 1
              };
              
              previousHash = recordHash;
              return chainedRecord;
            });
            
            // Mock database query
            mockQuery.mockResolvedValueOnce({ rows: chainedRecords });
            
            // Verify chain integrity
            const result = await verifyChainIntegrity(facilityId, chainedRecords.length);
            
            // Chain should be valid
            expect(result.valid).toBe(true);
            expect(result.brokenLinks).toHaveLength(0);
            expect(mockQuery).toHaveBeenCalledWith(
              expect.any(String),
              [facilityId, chainedRecords.length]
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 27: Hash chain validation detects tampering
   * Validates: Requirements 8.2
   * 
   * For any medication administration record that has been modified, hash chain 
   * validation should detect the modification and flag the record as invalid
   */
  describe('Property 27: Hash chain validation detects tampering', () => {
    it('should detect tampering when record_hash is modified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // facility_id
          fc.array(
            fc.record({
              administration_id: fc.uuid(),
              patient_id: fc.uuid(),
              order_id: fc.uuid(),
              administered_datetime: fc.date(),
              administered_by: fc.uuid(),
              status: fc.constantFrom('administered', 'not_given', 'refused'),
              dose_given: fc.option(fc.string(), { nil: null }),
              route_given: fc.option(fc.string(), { nil: null })
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.integer({ min: 0, max: 9 }), // Index of record to tamper
          async (facilityId, records, tamperIndex) => {
            // Ensure tamperIndex is within bounds
            const actualTamperIndex = tamperIndex % records.length;
            
            // Build proper hash chain
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            const chainedRecords = records.map((record, index) => {
              const administrationData = {
                patient_id: record.patient_id,
                order_id: record.order_id,
                administered_datetime: record.administered_datetime.toISOString(),
                administered_by: record.administered_by,
                status: record.status,
                dose_given: record.dose_given,
                route_given: record.route_given
              };
              
              const recordHash = createMedicationHash(administrationData, previousHash);
              const chainedRecord = {
                ...record,
                record_hash: recordHash,
                previous_hash: previousHash,
                chain_sequence: index + 1
              };
              
              previousHash = recordHash;
              return chainedRecord;
            });
            
            // Tamper with record_hash (this breaks the chain for next record)
            const tamperedRecords = [...chainedRecords];
            tamperedRecords[actualTamperIndex] = {
              ...tamperedRecords[actualTamperIndex],
              record_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            };
            
            // Mock database query with tampered data
            mockQuery.mockResolvedValueOnce({ rows: tamperedRecords });
            
            // Verify chain integrity
            const result = await verifyChainIntegrity(facilityId, tamperedRecords.length);
            
            // Chain should be invalid - tampering with record_hash breaks the chain
            // for the next record (if there is one) OR gets detected by hash validation
            expect(result.valid).toBe(false);
            
            if (actualTamperIndex < tamperedRecords.length - 1) {
              // Tampering with non-last record breaks the chain for next record
              expect(result.brokenLinks.length).toBeGreaterThan(0);
            } else {
              // Tampering with last record is detected by hash validation
              // (no next record to break, but hash doesn't match data)
              expect(result.tamperedRecords.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect tampering when previous_hash is modified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // facility_id
          fc.array(
            fc.record({
              administration_id: fc.uuid(),
              patient_id: fc.uuid(),
              order_id: fc.uuid(),
              administered_datetime: fc.date(),
              administered_by: fc.uuid(),
              status: fc.constantFrom('administered', 'not_given', 'refused'),
              dose_given: fc.option(fc.string(), { nil: null }),
              route_given: fc.option(fc.string(), { nil: null })
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.integer({ min: 1, max: 9 }), // Index of record to tamper (skip first)
          async (facilityId, records, tamperIndex) => {
            // Ensure tamperIndex is within bounds and not first record
            const actualTamperIndex = (tamperIndex % (records.length - 1)) + 1;
            
            // Build proper hash chain
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            const chainedRecords = records.map((record, index) => {
              const administrationData = {
                patient_id: record.patient_id,
                order_id: record.order_id,
                administered_datetime: record.administered_datetime.toISOString(),
                administered_by: record.administered_by,
                status: record.status,
                dose_given: record.dose_given,
                route_given: record.route_given
              };
              
              const recordHash = createMedicationHash(administrationData, previousHash);
              const chainedRecord = {
                ...record,
                record_hash: recordHash,
                previous_hash: previousHash,
                chain_sequence: index + 1
              };
              
              previousHash = recordHash;
              return chainedRecord;
            });
            
            // Tamper with previous_hash
            const tamperedRecords = [...chainedRecords];
            tamperedRecords[actualTamperIndex] = {
              ...tamperedRecords[actualTamperIndex],
              previous_hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
            };
            
            // Mock database query with tampered data
            mockQuery.mockResolvedValueOnce({ rows: tamperedRecords });
            
            // Verify chain integrity
            const result = await verifyChainIntegrity(facilityId, tamperedRecords.length);
            
            // Chain should be invalid
            expect(result.valid).toBe(false);
            expect(result.brokenLinks.length).toBeGreaterThan(0);
            
            // The broken link should be at the tampered index
            const brokenLink = result.brokenLinks.find(
              link => link.sequence === tamperedRecords[actualTamperIndex].chain_sequence
            );
            expect(brokenLink).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass validation when chain is intact', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // facility_id
          fc.array(
            fc.record({
              administration_id: fc.uuid(),
              patient_id: fc.uuid(),
              order_id: fc.uuid(),
              administered_datetime: fc.date(),
              administered_by: fc.uuid(),
              status: fc.constantFrom('administered', 'not_given', 'refused'),
              dose_given: fc.option(fc.string(), { nil: null }),
              route_given: fc.option(fc.string(), { nil: null })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (facilityId, records) => {
            // Build proper hash chain
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            const chainedRecords = records.map((record, index) => {
              const administrationData = {
                patient_id: record.patient_id,
                order_id: record.order_id,
                administered_datetime: record.administered_datetime.toISOString(),
                administered_by: record.administered_by,
                status: record.status,
                dose_given: record.dose_given,
                route_given: record.route_given
              };
              
              const recordHash = createMedicationHash(administrationData, previousHash);
              const chainedRecord = {
                ...record,
                record_hash: recordHash,
                previous_hash: previousHash,
                chain_sequence: index + 1
              };
              
              previousHash = recordHash;
              return chainedRecord;
            });
            
            // Mock database query with valid chain
            mockQuery.mockResolvedValueOnce({ rows: chainedRecords });
            
            // Verify chain integrity
            const result = await verifyChainIntegrity(facilityId, chainedRecords.length);
            
            // Chain should be valid
            expect(result.valid).toBe(true);
            expect(result.brokenLinks).toHaveLength(0);
            expect(result.message).toContain('verified successfully');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 28: Export includes hash chain
   * Validates: Requirements 8.5
   * 
   * For any medication record export, the exported data should include both 
   * record_hash and previous_hash fields for external verification
   */
  describe('Property 28: Export includes hash chain', () => {
    it('should include hash chain data in all exported records', async () => {
      // Import the export function
      const { exportMedicationRecordsWithHashChain } = await import('../../utils/crypto.js');
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // facility_id
          fc.array(
            fc.record({
              administration_id: fc.uuid(),
              order_id: fc.uuid(),
              patient_id: fc.uuid(),
              scheduled_datetime: fc.date(),
              administered_datetime: fc.date(),
              patient_barcode_scanned: fc.boolean(),
              patient_barcode_value: fc.option(fc.string(), { nil: null }),
              medication_barcode_scanned: fc.boolean(),
              medication_barcode_value: fc.option(fc.string(), { nil: null }),
              dose_given: fc.option(fc.string(), { nil: null }),
              route_given: fc.option(fc.string(), { nil: null }),
              status: fc.constantFrom('administered', 'not_given', 'refused'),
              reason_if_not_given: fc.option(fc.string(), { nil: null }),
              administered_by: fc.uuid(),
              notes: fc.option(fc.string(), { nil: null }),
              created_at: fc.date(),
              patient_mrn: fc.string({ minLength: 5, maxLength: 20 }),
              medication_name_ja: fc.string({ minLength: 3, maxLength: 50 }),
              medication_name_en: fc.option(fc.string(), { nil: null }),
              administered_by_username: fc.string({ minLength: 3, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (facilityId, records) => {
            // Build proper hash chain
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            const chainedRecords = records.map((record, index) => {
              const administrationData = {
                patient_id: record.patient_id,
                order_id: record.order_id,
                administered_datetime: record.administered_datetime.toISOString(),
                administered_by: record.administered_by,
                status: record.status,
                dose_given: record.dose_given,
                route_given: record.route_given
              };
              
              const recordHash = createMedicationHash(administrationData, previousHash);
              const chainedRecord = {
                ...record,
                record_hash: recordHash,
                previous_hash: previousHash,
                chain_sequence: index + 1
              };
              
              previousHash = recordHash;
              return chainedRecord;
            });
            
            // Mock database query for export
            mockQuery.mockResolvedValueOnce({ rows: chainedRecords });
            
            // Export records
            const exportedRecords = await exportMedicationRecordsWithHashChain(facilityId);
            
            // Verify all records have hash chain data
            expect(exportedRecords).toHaveLength(chainedRecords.length);
            
            for (let i = 0; i < exportedRecords.length; i++) {
              const exported = exportedRecords[i];
              const original = chainedRecords[i];
              
              // Verify hash chain fields are present
              expect(exported.record_hash).toBeDefined();
              expect(exported.previous_hash).toBeDefined();
              expect(exported.chain_sequence).toBeDefined();
              
              // Verify hash chain object is present
              expect(exported.hash_chain).toBeDefined();
              expect(exported.hash_chain.record_hash).toBe(original.record_hash);
              expect(exported.hash_chain.previous_hash).toBe(original.previous_hash);
              expect(exported.hash_chain.chain_sequence).toBe(original.chain_sequence);
              
              // Verify hash values match
              expect(exported.record_hash).toBe(original.record_hash);
              expect(exported.previous_hash).toBe(original.previous_hash);
              expect(exported.chain_sequence).toBe(original.chain_sequence);
            }
            
            // Verify database was queried correctly
            expect(mockQuery).toHaveBeenCalledWith(
              expect.stringContaining('record_hash'),
              expect.arrayContaining([facilityId])
            );
            expect(mockQuery).toHaveBeenCalledWith(
              expect.stringContaining('previous_hash'),
              expect.arrayContaining([facilityId])
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve hash chain integrity in exported data', async () => {
      // Import the export function
      const { exportMedicationRecordsWithHashChain } = await import('../../utils/crypto.js');
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // facility_id
          fc.array(
            fc.record({
              administration_id: fc.uuid(),
              patient_id: fc.uuid(),
              order_id: fc.uuid(),
              administered_datetime: fc.date(),
              administered_by: fc.uuid(),
              status: fc.constantFrom('administered', 'not_given', 'refused'),
              dose_given: fc.option(fc.string(), { nil: null }),
              route_given: fc.option(fc.string(), { nil: null })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (facilityId, records) => {
            // Build proper hash chain
            let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
            const chainedRecords = records.map((record, index) => {
              const administrationData = {
                patient_id: record.patient_id,
                order_id: record.order_id,
                administered_datetime: record.administered_datetime.toISOString(),
                administered_by: record.administered_by,
                status: record.status,
                dose_given: record.dose_given,
                route_given: record.route_given
              };
              
              const recordHash = createMedicationHash(administrationData, previousHash);
              const chainedRecord = {
                ...record,
                record_hash: recordHash,
                previous_hash: previousHash,
                chain_sequence: index + 1,
                // Add required fields for export
                scheduled_datetime: record.administered_datetime,
                patient_barcode_scanned: false,
                patient_barcode_value: null,
                medication_barcode_scanned: false,
                medication_barcode_value: null,
                reason_if_not_given: null,
                notes: null,
                created_at: new Date(),
                patient_mrn: 'MRN-' + index,
                medication_name_ja: 'Med-' + index,
                medication_name_en: null,
                administered_by_username: 'user-' + index
              };
              
              previousHash = recordHash;
              return chainedRecord;
            });
            
            // Mock database query for export
            mockQuery.mockResolvedValueOnce({ rows: chainedRecords });
            
            // Export records
            const exportedRecords = await exportMedicationRecordsWithHashChain(facilityId);
            
            // Verify chain integrity in exported data
            for (let i = 0; i < exportedRecords.length; i++) {
              if (i === 0) {
                // First record should link to genesis hash
                expect(exportedRecords[i].previous_hash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
              } else {
                // Each record should link to previous record's hash
                expect(exportedRecords[i].previous_hash).toBe(exportedRecords[i - 1].record_hash);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
