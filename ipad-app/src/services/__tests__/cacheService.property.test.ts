/**
 * Property-Based Tests for Cache Service
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheService } from '../cacheService';

// Custom generators
const offlineChangeGenerator = () => fc.record({
  type: fc.constantFrom('care_plan_update', 'patient_update', 'vital_signs', 'medication_admin', 'clinical_note'),
  data: fc.record({
    id: fc.uuid(),
    patientId: fc.uuid(),
    timestamp: fc.date(),
    content: fc.string({ minLength: 10, maxLength: 500 }),
    userId: fc.uuid(),
  }),
});

const patientDataGenerator = () => fc.array(
  fc.record({
    patient_id: fc.uuid(),
    mrn: fc.string({ minLength: 5, maxLength: 20 }),
    family_name: fc.string({ minLength: 2, maxLength: 30 }),
    given_name: fc.string({ minLength: 2, maxLength: 30 }),
    gender: fc.constantFrom('male', 'female', 'other'),
    date_of_birth: fc.integer({ min: 1920, max: 2020 }).chain(year =>
      fc.integer({ min: 1, max: 12 }).chain(month =>
        fc.integer({ min: 1, max: 28 }).map(day =>
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        )
      )
    ),
    age: fc.integer({ min: 0, max: 120 }),
    room_number: fc.string({ minLength: 3, maxLength: 10 }),
    facility_id: fc.uuid(),
  }),
  { minLength: 1, maxLength: 50 }
);

describe('Cache Service Property Tests', () => {
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
   * Feature: code-consistency-security-offline, Property 12: Offline changes queued for sync
   * Validates: Requirements 4.3
   */
  describe('Property 12: Offline changes queued for sync', () => {
    it('should queue any offline change for synchronization', async () => {
      await fc.assert(
        fc.asyncProperty(
          offlineChangeGenerator(),
          async (change) => {
            // Create a storage map to simulate AsyncStorage
            const storage = new Map<string, string>();
            
            // Mock AsyncStorage to use our map
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Add offline change to pending sync queue
            await cacheService.addPendingSync(change.type, change.data);

            // Retrieve pending sync items
            const pending = await cacheService.getPendingSync();

            // Verify change was queued
            expect(pending.length).toBeGreaterThan(0);
            
            // Find our change in the queue
            const queuedChange = pending.find(item => 
              item.type === change.type && 
              item.data.id === change.data.id
            );
            
            expect(queuedChange).toBeDefined();
            expect(queuedChange?.type).toBe(change.type);
            expect(queuedChange?.data.patientId).toBe(change.data.patientId);
            expect(queuedChange?.timestamp).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all queued changes in order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(offlineChangeGenerator(), { minLength: 2, maxLength: 10 }),
          async (changes) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Queue all changes
            for (const change of changes) {
              await cacheService.addPendingSync(change.type, change.data);
            }

            // Retrieve pending sync items
            const pending = await cacheService.getPendingSync();

            // Verify all changes were queued
            expect(pending.length).toBe(changes.length);
            
            // Verify order is preserved (timestamps should be increasing)
            for (let i = 1; i < pending.length; i++) {
              expect(pending[i].timestamp).toBeGreaterThanOrEqual(pending[i - 1].timestamp);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain queue integrity after multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(offlineChangeGenerator(), { minLength: 1, maxLength: 20 }),
          async (changes) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });
            
            (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
              storage.delete(key);
              return Promise.resolve();
            });

            // Queue changes
            for (const change of changes) {
              await cacheService.addPendingSync(change.type, change.data);
            }

            // Get pending count before clear
            const pendingBefore = await cacheService.getPendingSync();
            expect(pendingBefore.length).toBe(changes.length);

            // Clear pending sync
            await cacheService.clearPendingSync();

            // Verify queue is empty
            const pendingAfter = await cacheService.getPendingSync();
            expect(pendingAfter.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 14: Background refresh updates cache
   * Validates: Requirements 4.5
   */
  describe('Property 14: Background refresh updates cache', () => {
    it('should trigger refresh when cache is expired', async () => {
      await fc.assert(
        fc.asyncProperty(
          patientDataGenerator(),
          async (patients) => {
            const storage = new Map<string, string>();
            let refreshCalled = false;
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Set last sync time to old value (expired)
            const oldTimestamp = Date.now() - (9 * 60 * 60 * 1000); // 9 hours ago (expired)
            storage.set('@verbumcare/last_sync', oldTimestamp.toString());

            // Create refresh callback
            const refreshCallback = async () => {
              refreshCalled = true;
              await cacheService.cachePatients(patients);
            };

            // Trigger background refresh
            await cacheService.triggerBackgroundRefresh(refreshCallback);

            // Verify refresh was called
            expect(refreshCalled).toBe(true);

            // Verify cache was updated (dates will be serialized as strings)
            const cachedPatients = await cacheService.getCachedPatients();
            expect(cachedPatients?.length).toBe(patients.length);
            
            // Verify patient IDs match (dates get serialized, so we check structure)
            if (cachedPatients) {
              for (let i = 0; i < patients.length; i++) {
                expect(cachedPatients[i].patient_id).toBe(patients[i].patient_id);
                expect(cachedPatients[i].mrn).toBe(patients[i].mrn);
                expect(cachedPatients[i].family_name).toBe(patients[i].family_name);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger refresh when cache is fresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          patientDataGenerator(),
          async (patients) => {
            const storage = new Map<string, string>();
            let refreshCalled = false;
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Set last sync time to recent value (not expired)
            const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago (fresh)
            storage.set('@verbumcare/last_sync', recentTimestamp.toString());

            // Create refresh callback
            const refreshCallback = async () => {
              refreshCalled = true;
            };

            // Trigger background refresh
            await cacheService.triggerBackgroundRefresh(refreshCallback);

            // Verify refresh was NOT called (cache is fresh)
            expect(refreshCalled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update last sync time after refresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          patientDataGenerator(),
          async (patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Set old last sync time
            const oldTimestamp = Date.now() - (10 * 60 * 60 * 1000); // 10 hours ago
            storage.set('@verbumcare/last_sync', oldTimestamp.toString());

            const refreshCallback = async () => {
              await cacheService.cachePatients(patients);
            };

            // Get timestamp before refresh
            const timestampBefore = await cacheService.getLastSyncTime();

            // Trigger background refresh
            await cacheService.triggerBackgroundRefresh(refreshCallback);

            // Get timestamp after refresh
            const timestampAfter = await cacheService.getLastSyncTime();

            // Verify timestamp was updated
            expect(timestampAfter).not.toBeNull();
            if (timestampBefore && timestampAfter) {
              expect(timestampAfter).toBeGreaterThan(timestampBefore);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 15: Cache timestamp accuracy
   * Validates: Requirements 4.6
   */
  describe('Property 15: Cache timestamp accuracy', () => {
    it('should accurately track last sync timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(undefined),
          async () => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Record time before sync
            const timeBefore = Date.now();

            // Set last sync time
            await cacheService.setLastSyncTime();

            // Record time after sync
            const timeAfter = Date.now();

            // Get stored timestamp
            const storedTimestamp = await cacheService.getLastSyncTime();

            // Verify timestamp is within expected range
            expect(storedTimestamp).not.toBeNull();
            if (storedTimestamp) {
              expect(storedTimestamp).toBeGreaterThanOrEqual(timeBefore);
              expect(storedTimestamp).toBeLessThanOrEqual(timeAfter);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain timestamp accuracy across multiple syncs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (numSyncs) => {
            const storage = new Map<string, string>();
            const timestamps: number[] = [];
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Perform multiple syncs
            for (let i = 0; i < numSyncs; i++) {
              await cacheService.setLastSyncTime();
              const timestamp = await cacheService.getLastSyncTime();
              if (timestamp) {
                timestamps.push(timestamp);
              }
              
              // Small delay to ensure timestamps are different
              await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Verify all timestamps were recorded
            expect(timestamps.length).toBe(numSyncs);

            // Verify timestamps are monotonically increasing
            for (let i = 1; i < timestamps.length; i++) {
              expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reflect accurate cache age', async () => {
      await fc.assert(
        fc.asyncProperty(
          patientDataGenerator(),
          async (patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Cache patients
            await cacheService.cachePatients(patients);

            // Get detailed cache info
            const cacheInfo = await cacheService.getDetailedCacheInfo();

            // Verify timestamp exists and is recent
            expect(cacheInfo.patients.timestamp).not.toBeNull();
            if (cacheInfo.patients.timestamp) {
              const age = Date.now() - cacheInfo.patients.timestamp;
              // Cache should be less than 1 second old
              expect(age).toBeLessThan(1000);
            }

            // Verify expiry time is set correctly
            expect(cacheInfo.patients.expiresAt).not.toBeNull();
            if (cacheInfo.patients.timestamp && cacheInfo.patients.expiresAt) {
              const expiryDuration = cacheInfo.patients.expiresAt - cacheInfo.patients.timestamp;
              // Should be 8 hours (28800000 ms)
              expect(expiryDuration).toBe(8 * 60 * 60 * 1000);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify expired cache', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 24 }),
          async (hoursAgo) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Create timestamp from hours ago
            const timestamp = Date.now() - (hoursAgo * 60 * 60 * 1000);
            const expiryMs = 8 * 60 * 60 * 1000; // 8 hours

            // Check if cache should be expired
            const isExpired = cacheService.isCacheExpired(timestamp, expiryMs);

            // Verify expiry logic
            if (hoursAgo > 8) {
              expect(isExpired).toBe(true);
            } else {
              expect(isExpired).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Auto-save session data
   */
  describe('Auto-save session data', () => {
    it('should auto-save session data with timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            vitals: fc.record({
              bloodPressure: fc.string(),
              heartRate: fc.integer({ min: 40, max: 200 }),
            }),
            patientId: fc.uuid(),
          }),
          async (sessionData) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Auto-save session data
            await cacheService.autoSaveSessionData(sessionData);

            // Retrieve session data
            const saved = await cacheService.getCachedSessionData();

            // Verify data was saved with metadata
            expect(saved).not.toBeNull();
            expect(saved?.vitals).toEqual(sessionData.vitals);
            expect(saved?.patientId).toBe(sessionData.patientId);
            expect(saved?.lastSaved).toBeDefined();
            expect(saved?.autoSaved).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly determine when auto-save is needed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 60 }),
          async (secondsAgo) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Create session data with lastSaved timestamp
            const sessionData = {
              data: 'test',
              lastSaved: Date.now() - (secondsAgo * 1000),
            };
            
            await cacheService.cacheSessionData(sessionData);

            // Check if auto-save is needed
            const shouldSave = await cacheService.shouldAutoSaveSession();

            // Verify logic (should save if > 30 seconds)
            if (secondsAgo >= 30) {
              expect(shouldSave).toBe(true);
            } else {
              expect(shouldSave).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
