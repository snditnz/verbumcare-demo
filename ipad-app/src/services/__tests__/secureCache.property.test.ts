/**
 * Property-Based Tests for Secure Cache System
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureCache, CacheMetadata } from '../secureCache';

// Custom generators
const patientDataGenerator = () => fc.record({
  patientId: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  age: fc.integer({ min: 0, max: 120 }),
  notes: fc.string({ minLength: 0, maxLength: 500 }),
  medications: fc.array(fc.string({ minLength: 3, maxLength: 30 }), { maxLength: 10 }),
  vitals: fc.record({
    bloodPressure: fc.string({ minLength: 5, maxLength: 10 }),
    heartRate: fc.integer({ min: 40, max: 200 }),
    // Use integer instead of float to avoid NaN issues with JSON serialization
    temperature: fc.integer({ min: 35, max: 42 }),
  }),
});

const userIdGenerator = () => fc.uuid();

describe('Secure Cache Property Tests', () => {
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
   * Feature: code-consistency-security-offline, Property 7: Encryption round trip
   * Validates: Requirements 3.1
   */
  describe('Property 7: Encryption round trip', () => {
    it('should decrypt to original plaintext for any data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          patientDataGenerator(),
          async (userId, data) => {
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

            // Create cache instance
            const cache = new SecureCache(userId);

            // Store data
            await cache.set('patient', data);

            // Retrieve data
            const retrieved = await cache.get('patient');

            // Verify round trip: decrypted data should equal original
            expect(retrieved).toEqual(data);
            expect(retrieved).not.toBeNull();
            
            // Verify all fields preserved
            if (retrieved) {
              expect(retrieved.patientId).toBe(data.patientId);
              expect(retrieved.name).toBe(data.name);
              expect(retrieved.age).toBe(data.age);
              expect(retrieved.notes).toBe(data.notes);
              expect(retrieved.medications).toEqual(data.medications);
              expect(retrieved.vitals).toEqual(data.vitals);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle complex nested objects', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.record({
            level1: fc.record({
              level2: fc.record({
                level3: fc.array(fc.string(), { maxLength: 5 }),
                numbers: fc.array(fc.integer(), { maxLength: 5 }),
              }),
              dates: fc.array(fc.date(), { maxLength: 3 }),
            }),
            metadata: fc.record({
              created: fc.date(),
              updated: fc.date(),
              version: fc.integer({ min: 1, max: 100 }),
            }),
          }),
          async (userId, complexData) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            const cache = new SecureCache(userId);

            await cache.set('complex', complexData);
            const retrieved = await cache.get('complex');

            // Deep equality check
            expect(JSON.stringify(retrieved)).toBe(JSON.stringify(complexData));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 8: User data isolation
   * Validates: Requirements 3.3
   */
  describe('Property 8: User data isolation', () => {
    it('should isolate data between different users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(userIdGenerator(), userIdGenerator()).filter(([a, b]) => a !== b),
          fc.tuple(patientDataGenerator(), patientDataGenerator()).filter(([a, b]) => 
            JSON.stringify(a) !== JSON.stringify(b)
          ),
          async ([userA, userB], [dataA, dataB]) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Create separate cache instances for each user
            const cacheA = new SecureCache(userA);
            const cacheB = new SecureCache(userB);

            // User A stores their data
            await cacheA.set('patient', dataA);

            // User B stores their data
            await cacheB.set('patient', dataB);

            // User A retrieves their data
            const retrievedA = await cacheA.get('patient');

            // User B retrieves their data
            const retrievedB = await cacheB.get('patient');

            // Verify each user gets their own data
            expect(retrievedA).toEqual(dataA);
            expect(retrievedB).toEqual(dataB);
            expect(retrievedA).not.toEqual(dataB);

            // Verify User A cannot access User B's data
            // (they use different storage keys)
            const keysInStorage = Array.from(storage.keys());
            const userAKeys = keysInStorage.filter(k => k.includes(userA));
            const userBKeys = keysInStorage.filter(k => k.includes(userB));
            
            expect(userAKeys.length).toBeGreaterThan(0);
            expect(userBKeys.length).toBeGreaterThan(0);
            expect(userAKeys).not.toEqual(userBKeys);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent cross-user data access', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(userIdGenerator(), userIdGenerator()).filter(([a, b]) => a !== b),
          fc.string({ minLength: 10, maxLength: 100 }),
          async ([userA, userB], secretData) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // User A stores secret data
            const cacheA = new SecureCache(userA);
            await cacheA.set('secret', secretData);

            // User B tries to access the same key
            const cacheB = new SecureCache(userB);
            const retrievedByB = await cacheB.get('secret');

            // User B should get null (no data) or different data, never User A's data
            if (retrievedByB !== null) {
              expect(retrievedByB).not.toBe(secretData);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 9: Encrypted data is not plaintext
   * Validates: Requirements 3.1
   */
  describe('Property 9: Encrypted data is not plaintext', () => {
    it('should not store plaintext in AsyncStorage', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.record({
            sensitiveField: fc.string({ minLength: 10, maxLength: 50 }),
            patientName: fc.string({ minLength: 5, maxLength: 30 }),
            diagnosis: fc.string({ minLength: 10, maxLength: 100 }),
            ssn: fc.string({ minLength: 9, maxLength: 11 }),
          }),
          async (userId, sensitiveData) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            const cache = new SecureCache(userId);

            // Store sensitive data
            await cache.set('sensitive', sensitiveData);

            // Get the raw encrypted value from storage
            const storageKey = `@user_${userId}@verbumcare_cache_sensitive`;
            const encryptedValue = storage.get(storageKey);

            // Verify data was stored
            expect(encryptedValue).toBeDefined();
            expect(encryptedValue).not.toBeNull();

            if (encryptedValue) {
              // Verify sensitive fields are not in plaintext
              expect(encryptedValue).not.toContain(sensitiveData.sensitiveField);
              expect(encryptedValue).not.toContain(sensitiveData.patientName);
              expect(encryptedValue).not.toContain(sensitiveData.diagnosis);
              expect(encryptedValue).not.toContain(sensitiveData.ssn);

              // Verify it's not just JSON stringified
              const jsonString = JSON.stringify(sensitiveData);
              expect(encryptedValue).not.toBe(jsonString);
              expect(encryptedValue).not.toContain(jsonString);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different encrypted output for same data with different users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(userIdGenerator(), userIdGenerator()).filter(([a, b]) => a !== b),
          // Use alphanumeric strings to avoid edge cases with whitespace-only strings
          fc.string({ minLength: 20, maxLength: 100 }).filter(s => s.trim().length > 10),
          async ([userA, userB], data) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            // Both users store the same data
            const cacheA = new SecureCache(userA);
            const cacheB = new SecureCache(userB);

            await cacheA.set('data', data);
            await cacheB.set('data', data);

            // Get raw encrypted values
            const encryptedA = storage.get(`@user_${userA}@verbumcare_cache_data`);
            const encryptedB = storage.get(`@user_${userB}@verbumcare_cache_data`);

            // Encrypted values should be different (different user keys)
            expect(encryptedA).toBeDefined();
            expect(encryptedB).toBeDefined();
            expect(encryptedA).not.toBe(encryptedB);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Cache metadata tracking
   */
  describe('Cache metadata tracking', () => {
    it('should track metadata for any user', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.record({
            patients: fc.integer({ min: 0, max: 1000 }),
            carePlans: fc.integer({ min: 0, max: 500 }),
            medications: fc.integer({ min: 0, max: 2000 }),
          }),
          async (userId, recordCounts) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });

            const cache = new SecureCache(userId);

            // Set metadata
            await cache.setMetadata({
              recordCounts,
              lastSync: new Date().toISOString(),
            });

            // Retrieve metadata
            const metadata = await cache.getMetadata();

            // Verify metadata preserved
            expect(metadata).not.toBeNull();
            expect(metadata?.recordCounts).toEqual(recordCounts);
            expect(metadata?.version).toBe(1);
            expect(metadata?.lastSync).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Secure deletion
   */
  describe('Secure deletion', () => {
    it('should clear all user data on logout', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdGenerator(),
          fc.array(patientDataGenerator(), { minLength: 1, maxLength: 10 }),
          async (userId, patients) => {
            const storage = new Map<string, string>();
            
            (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
              storage.set(key, value);
              return Promise.resolve();
            });
            
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              return Promise.resolve(storage.get(key) || null);
            });
            
            (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(() => {
              return Promise.resolve(Array.from(storage.keys()));
            });
            
            (AsyncStorage.multiRemove as jest.Mock).mockImplementation((keys: string[]) => {
              keys.forEach(key => storage.delete(key));
              return Promise.resolve();
            });

            const cache = new SecureCache(userId);

            // Store multiple items
            for (let i = 0; i < patients.length; i++) {
              await cache.set(`patient_${i}`, patients[i]);
            }

            // Verify data stored
            const keysBefore = Array.from(storage.keys()).filter(k => k.includes(userId));
            expect(keysBefore.length).toBeGreaterThan(0);

            // Clear cache
            await cache.clear();

            // Verify all user data removed
            const keysAfter = Array.from(storage.keys()).filter(k => k.includes(userId));
            expect(keysAfter.length).toBe(0);

            // Verify data no longer retrievable
            for (let i = 0; i < patients.length; i++) {
              const retrieved = await cache.get(`patient_${i}`);
              expect(retrieved).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
