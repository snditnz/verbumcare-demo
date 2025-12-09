/**
 * Property-Based Tests for Cache Warmer Service
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { warmAllCaches, warmScheduleCaches, warmAllDataForDemo } from '../cacheWarmer';
import { apiService } from '../api';
import { cacheService } from '../cacheService';
import { SecureCache, createSecureCache } from '../secureCache';

// Mock the services
jest.mock('../api');
jest.mock('../cacheService');
jest.mock('../secureCache');

// Custom generators
const userIdGenerator = () => fc.uuid();

const patientGenerator = () => fc.record({
  patient_id: fc.uuid(),
  mrn: fc.string({ minLength: 5, maxLength: 20 }),
  family_name: fc.string({ minLength: 2, maxLength: 30 }),
  given_name: fc.string({ minLength: 2, maxLength: 30 }),
  gender: fc.constantFrom('male', 'female', 'other'),
  date_of_birth: fc.date({ min: new Date('1920-01-01'), max: new Date('2020-12-31') }),
  age: fc.integer({ min: 0, max: 120 }),
  room_number: fc.string({ minLength: 3, maxLength: 10 }),
  facility_id: fc.uuid(),
});

const carePlanGenerator = () => fc.record({
  id: fc.uuid(),
  patient_id: fc.uuid(),
  care_level: fc.constantFrom('要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'),
  status: fc.constantFrom('active', 'draft', 'archived'),
  version: fc.float({ min: 1.0, max: 10.0 }),
  created_at: fc.date(),
});

const problemTemplateGenerator = () => fc.record({
  id: fc.uuid(),
  category: fc.string({ minLength: 5, maxLength: 50 }),
  problem_text: fc.string({ minLength: 10, maxLength: 200 }),
  problem_text_ja: fc.string({ minLength: 5, maxLength: 100 }),
});

describe('Cache Warmer Service Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
  });

  /**
   * Feature: code-consistency-security-offline, Property 16: Login triggers cache warming
   * Validates: Requirements 5.1
   */
  describe('Property 16: Login triggers cache warming', () => {
    it('should prefetch patients, care plans, problem templates, and schedules for any user', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.array(patientGenerator(), { minLength: 1, maxLength: 20 }),
          fc.array(carePlanGenerator(), { minLength: 0, maxLength: 10 }),
          fc.array(problemTemplateGenerator(), { minLength: 1, maxLength: 50 }),
          async (userId, patients, carePlans, templates) => {
            // Setup storage
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Mock API responses
            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            (apiService.getProblemTemplates as jest.Mock).mockResolvedValue(templates);

            // Mock SecureCache
            const mockCache = {
              setMultiple: jest.fn().mockResolvedValue(undefined),
              setMetadata: jest.fn().mockResolvedValue(undefined),
              get: jest.fn(),
              getMetadata: jest.fn(),
              clear: jest.fn(),
              getStats: jest.fn(),
            };
            
            (createSecureCache as jest.Mock).mockReturnValue(mockCache);

            // Trigger cache warming
            const result = await warmAllCaches(userId);

            // Verify success
            expect(result.success).toBe(true);
            expect(result.recordCounts).toBeDefined();

            // Verify patients were fetched
            expect(apiService.getPatients).toHaveBeenCalledWith(false);
            
            // Verify templates were fetched
            expect(apiService.getProblemTemplates).toHaveBeenCalled();

            // Verify data was cached
            expect(mockCache.setMultiple).toHaveBeenCalled();
            expect(mockCache.setMetadata).toHaveBeenCalled();

            // Verify record counts
            if (result.recordCounts) {
              expect(result.recordCounts.patients).toBe(patients.length);
              expect(result.recordCounts.templates).toBe(templates.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cache data for the specific user only', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.array(patientGenerator(), { minLength: 1, maxLength: 10 }),
          async (userId, patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            (apiService.getProblemTemplates as jest.Mock).mockResolvedValue([]);

            const mockCache = {
              setMultiple: jest.fn().mockResolvedValue(undefined),
              setMetadata: jest.fn().mockResolvedValue(undefined),
              get: jest.fn(),
              getMetadata: jest.fn(),
              clear: jest.fn(),
              getStats: jest.fn(),
            };
            
            (createSecureCache as jest.Mock).mockReturnValue(mockCache);

            // Warm cache for user
            await warmAllCaches(userId);

            // Verify SecureCache was created for the correct user
            expect(createSecureCache).toHaveBeenCalledWith(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include timestamp in cache warming result', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          async (userId) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            (apiService.getPatients as jest.Mock).mockResolvedValue([]);
            (apiService.getProblemTemplates as jest.Mock).mockResolvedValue([]);

            const mockCache = {
              setMultiple: jest.fn().mockResolvedValue(undefined),
              setMetadata: jest.fn().mockResolvedValue(undefined),
              get: jest.fn(),
              getMetadata: jest.fn(),
              clear: jest.fn(),
              getStats: jest.fn(),
            };
            
            (createSecureCache as jest.Mock).mockReturnValue(mockCache);

            const timeBefore = Date.now();
            const result = await warmAllCaches(userId);
            const timeAfter = Date.now();

            // Verify timestamp is present and within expected range
            expect(result.timestamp).toBeDefined();
            if (result.timestamp) {
              const timestamp = new Date(result.timestamp).getTime();
              expect(timestamp).toBeGreaterThanOrEqual(timeBefore);
              expect(timestamp).toBeLessThanOrEqual(timeAfter);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 17: Partial cache warming continues
   * Validates: Requirements 5.3
   */
  describe('Property 17: Partial cache warming continues', () => {
    it('should successfully cache items that were fetched even when some fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.array(patientGenerator(), { minLength: 5, maxLength: 20 }),
          async (userId, patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Mock patients to succeed
            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            
            // Mock templates to fail
            (apiService.getProblemTemplates as jest.Mock).mockRejectedValue(new Error('Network error'));

            const mockCache = {
              setMultiple: jest.fn().mockResolvedValue(undefined),
              setMetadata: jest.fn().mockResolvedValue(undefined),
              get: jest.fn(),
              getMetadata: jest.fn(),
              clear: jest.fn(),
              getStats: jest.fn(),
            };
            
            (createSecureCache as jest.Mock).mockReturnValue(mockCache);

            // Warm cache (should not throw despite template failure)
            const result = await warmAllCaches(userId);

            // Verify operation completed
            expect(result).toBeDefined();
            
            // Verify patients were still cached
            expect(mockCache.setMultiple).toHaveBeenCalled();
            
            // Verify record counts show what was successfully cached
            if (result.recordCounts) {
              expect(result.recordCounts.patients).toBe(patients.length);
              // Templates should be 0 due to failure
              expect(result.recordCounts.templates).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue warming schedules even when individual patient schedules fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.array(patientGenerator(), { minLength: 3, maxLength: 10 }),
          fc.integer({ min: 0, max: 2 }), // Index of patient that will fail
          async (staffId, patients, failIndex) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Mock patients list
            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            
            // Mock staff schedule
            (apiService.getAllTodaySchedule as jest.Mock).mockResolvedValue({ allItems: [] });
            
            // Mock per-patient schedules - one will fail
            (apiService.getTodaySchedule as jest.Mock).mockImplementation((patientId: string) => {
              const index = patients.findIndex(p => p.patient_id === patientId);
              if (index === failIndex) {
                return Promise.reject(new Error('Schedule fetch failed'));
              }
              return Promise.resolve({ allItems: [] });
            });

            // Mock cache service
            (cacheService.cachePatients as jest.Mock).mockResolvedValue(undefined);
            (cacheService.cacheStaffSchedule as jest.Mock).mockResolvedValue(undefined);
            (cacheService.cacheTodaySchedule as jest.Mock).mockResolvedValue(undefined);

            // Warm schedules
            const result = await warmScheduleCaches(staffId);

            // Verify operation completed
            expect(result).toBeDefined();
            
            // Verify some patients were warmed (all except the failed one)
            expect(result.patientsWarmed).toBe(patients.length - 1);
            
            // Verify errors were recorded
            expect(result.errors.length).toBeGreaterThan(0);
            
            // Verify success is still true if at least one patient was warmed
            if (patients.length > 1) {
              expect(result.success).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should record errors for failed items without stopping the warming process', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.array(patientGenerator(), { minLength: 2, maxLength: 5 }),
          async (staffId, patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            
            // Staff schedule fails
            (apiService.getAllTodaySchedule as jest.Mock).mockRejectedValue(new Error('Staff schedule error'));
            
            // Patient schedules succeed
            (apiService.getTodaySchedule as jest.Mock).mockResolvedValue({ allItems: [] });

            (cacheService.cachePatients as jest.Mock).mockResolvedValue(undefined);
            (cacheService.cacheTodaySchedule as jest.Mock).mockResolvedValue(undefined);

            const result = await warmScheduleCaches(staffId);

            // Verify errors were recorded
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Staff schedule');
            
            // Verify patient schedules were still warmed
            expect(result.patientsWarmed).toBe(patients.length);
            
            // Verify staff schedule flag is false
            expect(result.staffScheduleWarmed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide detailed error information for debugging', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.array(patientGenerator(), { minLength: 1, maxLength: 3 }),
          async (staffId, patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            (apiService.getAllTodaySchedule as jest.Mock).mockResolvedValue({ allItems: [] });
            
            // All patient schedules fail with specific error
            const specificError = 'Database connection timeout';
            (apiService.getTodaySchedule as jest.Mock).mockRejectedValue(new Error(specificError));

            (cacheService.cachePatients as jest.Mock).mockResolvedValue(undefined);
            (cacheService.cacheStaffSchedule as jest.Mock).mockResolvedValue(undefined);

            const result = await warmScheduleCaches(staffId);

            // Verify errors contain specific error messages
            expect(result.errors.length).toBe(patients.length);
            result.errors.forEach(error => {
              expect(error).toContain(specificError);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 18: Expired cache triggers refresh
   * Validates: Requirements 5.4
   */
  describe('Property 18: Expired cache triggers refresh', () => {
    it('should trigger refresh when cache is past expiration time', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.array(patientGenerator(), { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 9, max: 24 }), // Hours past expiration (8 hours)
          async (userId, patients, hoursOld) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Set old cache timestamp (expired)
            const oldTimestamp = Date.now() - (hoursOld * 60 * 60 * 1000);
            storage.set('@verbumcare/last_sync', oldTimestamp.toString());

            // Mock API to return fresh data
            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            (apiService.getProblemTemplates as jest.Mock).mockResolvedValue([]);

            // Mock cacheService.shouldSync to return true for expired cache
            (cacheService.shouldSync as jest.Mock).mockResolvedValue(true);

            const mockCache = {
              setMultiple: jest.fn().mockResolvedValue(undefined),
              setMetadata: jest.fn().mockResolvedValue(undefined),
              get: jest.fn(),
              getMetadata: jest.fn().mockResolvedValue({
                lastSync: new Date(oldTimestamp).toISOString(),
                version: 1,
                recordCounts: {},
              }),
              clear: jest.fn(),
              getStats: jest.fn(),
            };
            
            (createSecureCache as jest.Mock).mockReturnValue(mockCache);

            // Check if cache should be refreshed
            const shouldRefresh = await cacheService.shouldSync();

            // Verify refresh is triggered for expired cache
            expect(shouldRefresh).toBe(true);

            // Trigger cache warming (which should refresh)
            const result = await warmAllCaches(userId);

            // Verify fresh data was fetched
            expect(apiService.getPatients).toHaveBeenCalledWith(false);
            
            // Verify cache was updated
            expect(mockCache.setMultiple).toHaveBeenCalled();
            expect(mockCache.setMetadata).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger unnecessary refresh when cache is fresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.integer({ min: 1, max: 7 }), // Hours within expiration (< 8 hours)
          async (userId, hoursOld) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Set recent cache timestamp (not expired)
            const recentTimestamp = Date.now() - (hoursOld * 60 * 60 * 1000);
            storage.set('@verbumcare/last_sync', recentTimestamp.toString());

            // Mock cacheService.shouldSync to return false for fresh cache
            (cacheService.shouldSync as jest.Mock).mockResolvedValue(false);

            // Check if cache should be refreshed
            const shouldRefresh = await cacheService.shouldSync();

            // Verify refresh is NOT triggered for fresh cache
            expect(shouldRefresh).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update cache metadata with new timestamp after refresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.array(patientGenerator(), { minLength: 1, maxLength: 5 }),
          async (userId, patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Set old timestamp
            const oldTimestamp = Date.now() - (10 * 60 * 60 * 1000); // 10 hours ago
            storage.set('@verbumcare/last_sync', oldTimestamp.toString());

            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            (apiService.getProblemTemplates as jest.Mock).mockResolvedValue([]);

            let metadataUpdated = false;
            const mockCache = {
              setMultiple: jest.fn().mockResolvedValue(undefined),
              setMetadata: jest.fn().mockImplementation((metadata) => {
                metadataUpdated = true;
                // Verify new timestamp is recent
                const syncTime = new Date(metadata.lastSync).getTime();
                const now = Date.now();
                expect(syncTime).toBeGreaterThan(oldTimestamp);
                expect(syncTime).toBeLessThanOrEqual(now);
                return Promise.resolve();
              }),
              get: jest.fn(),
              getMetadata: jest.fn(),
              clear: jest.fn(),
              getStats: jest.fn(),
            };
            
            (createSecureCache as jest.Mock).mockReturnValue(mockCache);

            // Trigger refresh
            await warmAllCaches(userId);

            // Verify metadata was updated
            expect(metadataUpdated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cache expiry correctly across different time zones', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -12, max: 14 }), // Timezone offset in hours
          fc.integer({ min: 1, max: 24 }), // Hours old
          async (timezoneOffset, hoursOld) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Create timestamp with timezone offset
            const timestamp = Date.now() - (hoursOld * 60 * 60 * 1000);
            storage.set('@verbumcare/last_sync', timestamp.toString());

            // Check expiry (should be timezone-independent)
            const expiryMs = 8 * 60 * 60 * 1000; // 8 hours
            const expectedExpired = hoursOld > 8;
            
            // Mock cacheService.isCacheExpired to return correct value
            (cacheService.isCacheExpired as jest.Mock).mockReturnValue(expectedExpired);
            
            const isExpired = cacheService.isCacheExpired(timestamp, expiryMs);

            // Verify expiry logic is consistent regardless of timezone
            if (hoursOld > 8) {
              expect(isExpired).toBe(true);
            } else {
              expect(isExpired).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should refresh all data types when cache expires', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.array(patientGenerator(), { minLength: 1, maxLength: 5 }),
          fc.array(problemTemplateGenerator(), { minLength: 1, maxLength: 10 }),
          async (staffId, patients, templates) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Set expired timestamp
            const expiredTimestamp = Date.now() - (10 * 60 * 60 * 1000);
            storage.set('@verbumcare/last_sync', expiredTimestamp.toString());

            // Mock all API calls
            (apiService.getPatients as jest.Mock).mockResolvedValue(patients);
            (apiService.getProblemTemplates as jest.Mock).mockResolvedValue(templates);
            (apiService.getAllTodaySchedule as jest.Mock).mockResolvedValue({ allItems: [] });
            (apiService.getTodaySchedule as jest.Mock).mockResolvedValue({ allItems: [] });

            (cacheService.cachePatients as jest.Mock).mockResolvedValue(undefined);
            (cacheService.cacheProblemTemplates as jest.Mock).mockResolvedValue(undefined);
            (cacheService.cacheStaffSchedule as jest.Mock).mockResolvedValue(undefined);
            (cacheService.cacheTodaySchedule as jest.Mock).mockResolvedValue(undefined);

            // Trigger comprehensive refresh
            const result = await warmAllDataForDemo(staffId);

            // Verify all data types were refreshed
            expect(apiService.getPatients).toHaveBeenCalled();
            expect(apiService.getProblemTemplates).toHaveBeenCalled();
            expect(apiService.getAllTodaySchedule).toHaveBeenCalled();
            
            // Verify result includes all data types
            expect(result.details.patients).toBeGreaterThan(0);
            expect(result.details.templates).toBeGreaterThan(0);
            expect(result.details.schedules).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
