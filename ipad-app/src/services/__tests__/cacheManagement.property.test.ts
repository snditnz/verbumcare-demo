/**
 * Property-Based Tests for Cache Management During Server Switches
 * 
 * **Feature: backend-switching-settings, Property 11: Cache management during server switches**
 * **Validates: Requirements 4.2, 4.5**
 * 
 * Tests the cache management functionality including selective clearing,
 * backup/restore, corruption recovery, and version compatibility.
 */

import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheService } from '../cacheService';
import { backendConfigService } from '../backendConfigService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock the auth store
jest.mock('../../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      isAuthenticated: true,
      tokens: { accessToken: 'mock-token' },
      refreshToken: jest.fn().mockResolvedValue(true),
    }),
  },
}));

// Mock the API service
jest.mock('../api', () => ({
  apiService: {
    client: {
      defaults: { baseURL: 'https://mock-server.com/api' },
    },
  },
}));

describe('Cache Management During Server Switches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset AsyncStorage mock
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiSet as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  /**
   * Property 11: Selective cache clearing preserves user preferences
   * For any cache state, selective clearing should preserve user preferences while clearing server-specific data
   */
  it('should preserve user preferences during selective cache clearing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          serverDataCount: fc.integer({ min: 1, max: 3 }),
          userPrefsCount: fc.integer({ min: 1, max: 2 }),
          sessionDataCount: fc.integer({ min: 0, max: 1 }),
        }),
        async ({ serverDataCount, userPrefsCount, sessionDataCount }) => {
          // Setup mock cache keys
          const serverKeys = Array.from({ length: serverDataCount }, (_, i) => `@verbumcare/patients_${i}`);
          const carePlanKeys = Array.from({ length: serverDataCount }, (_, i) => `@verbumcare/care_plan_${i}`);
          const userKeys = Array.from({ length: userPrefsCount }, (_, i) => `@verbumcare/preferences_${i}`);
          const sessionKeys = Array.from({ length: sessionDataCount }, (_, i) => `@verbumcare/session_data_${i}`);
          
          const allKeys = [...serverKeys, ...carePlanKeys, ...userKeys, ...sessionKeys];

          (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(allKeys);

          // Perform selective cache clear
          await cacheService.selectiveCacheClear({
            preserveUserData: true,
            preserveSettings: true,
            preserveSession: true,
            preserveTemplates: true,
            serverSpecificOnly: true,
          });

          // Verify that multiRemove was called
          expect(AsyncStorage.multiRemove).toHaveBeenCalled();

          const removedKeys = (AsyncStorage.multiRemove as jest.Mock).mock.calls[0][0];

          // Check that some server-specific keys were removed (at least one)
          const serverSpecificKeys = [...serverKeys, ...carePlanKeys];
          const removedServerKeys = serverSpecificKeys.filter(key => removedKeys.includes(key));
          expect(removedServerKeys.length).toBeGreaterThan(0);

          // Check that user preferences were NOT removed
          for (const userKey of userKeys) {
            expect(removedKeys).not.toContain(userKey);
          }

          // Check that session data was NOT removed
          for (const sessionKey of sessionKeys) {
            expect(removedKeys).not.toContain(sessionKey);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 11: Cache backup and restore maintains data integrity
   * For any server cache state, creating a backup and restoring should preserve all data
   */
  it('should maintain data integrity during backup and restore operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          serverId: fc.constantFrom('mac-mini', 'pn51'),
          entryCount: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ serverId, entryCount }) => {
          // Setup mock cache data
          const cacheKeys = Array.from({ length: entryCount }, (_, i) => `@verbumcare/patients_entry_${i}`);
          const cacheValues = Array.from({ length: entryCount }, (_, i) => JSON.stringify({
            data: `test-data-${i}`,
            timestamp: Date.now(),
            expiresAt: Date.now() + 3600000,
          }));

          // Reset mocks before each test
          jest.clearAllMocks();
          
          (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(cacheKeys);
          (AsyncStorage.multiGet as jest.Mock).mockResolvedValue(
            cacheKeys.map((key, index) => [key, cacheValues[index]])
          );

          // Create backup
          const backupKey = await cacheService.createServerCacheBackup(serverId);

          // Verify backup was created
          expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            expect.stringContaining(`server_backup_${serverId}`),
            expect.any(String)
          );

          // Get the backup data that was stored
          const backupCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(call =>
            call[0].includes(`server_backup_${serverId}`)
          );
          expect(backupCall).toBeDefined();

          const backupData = JSON.parse(backupCall[1]);
          expect(backupData.serverId).toBe(serverId);
          expect(backupData.data).toBeDefined();
          expect(Object.keys(backupData.data)).toHaveLength(entryCount);

          // Mock the backup retrieval for restore
          (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
            if (key === backupKey) {
              return Promise.resolve(backupCall[1]);
            }
            return Promise.resolve(null);
          });

          (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([backupKey]);

          // Restore from backup
          const restored = await cacheService.restoreServerCacheBackup(serverId);

          expect(restored).toBe(true);
          expect(AsyncStorage.multiSet).toHaveBeenCalledWith(
            expect.arrayContaining(
              cacheKeys.map((key, index) => [key, cacheValues[index]])
            )
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 11: Cache corruption recovery handles invalid data gracefully
   * For any cache state with corrupted entries, recovery should identify and handle corruption
   */
  it('should handle cache corruption gracefully during recovery', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validCount: fc.integer({ min: 1, max: 2 }),
          corruptedCount: fc.integer({ min: 1, max: 1 }),
        }),
        async ({ validCount, corruptedCount }) => {
          // Setup mock cache with valid and corrupted entries
          const validKeys = Array.from({ length: validCount }, (_, i) => `@verbumcare/patients_valid_${i}`);
          const corruptedKeys = Array.from({ length: corruptedCount }, (_, i) => `@verbumcare/care_plan_corrupt_${i}`);
          const allKeys = [...validKeys, ...corruptedKeys];

          // Reset mocks
          jest.clearAllMocks();
          (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(allKeys);

          // Mock getItem to return valid or corrupted data
          (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
            if (validKeys.includes(key)) {
              return Promise.resolve(JSON.stringify({
                data: 'valid-data',
                timestamp: Date.now(),
                expiresAt: Date.now() + 3600000,
              }));
            }

            if (corruptedKeys.includes(key)) {
              return Promise.resolve('invalid json{');
            }

            return Promise.resolve(null);
          });

          // Perform corruption recovery
          const result = await cacheService.recoverFromCacheCorruption();

          // Verify corruption was detected
          if (corruptedCount > 0) {
            expect(result.recovered).toBe(true);
            expect(result.corruptedKeys.length).toBeGreaterThan(0);
            expect(result.corruptedKeys.length).toBeLessThanOrEqual(corruptedCount);

            // Verify corrupted entries were removed
            expect(AsyncStorage.removeItem).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 11: Cache version validation handles version mismatches correctly
   * For any cache version state, validation should correctly identify compatibility
   */
  it('should handle cache version validation and migration correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cacheVersion: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
        }),
        async ({ cacheVersion }) => {
          // Use the actual current version from the cache service
          const currentVersion = 2; // This matches PROBLEM_TEMPLATES_VERSION in cacheService

          // Mock cache version retrieval
          (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
            if (key.includes('problem_templates_version')) {
              return Promise.resolve(cacheVersion?.toString() || null);
            }
            return Promise.resolve(null);
          });

          // Validate cache version
          const validation = await cacheService.validateCacheVersion();

          // Check validation results
          expect(validation.currentVersion).toBe(currentVersion);
          expect(validation.cacheVersion).toBe(cacheVersion);

          if (cacheVersion === null) {
            // No cached version - should be invalid (new installation)
            expect(validation.valid).toBe(false);
            expect(validation.migrationNeeded).toBe(false);
          } else if (cacheVersion === currentVersion) {
            // Versions match - should be valid
            expect(validation.valid).toBe(true);
            expect(validation.migrationNeeded).toBe(false);
          } else if (cacheVersion < currentVersion) {
            // Old version - needs migration
            expect(validation.valid).toBe(false);
            expect(validation.migrationNeeded).toBe(true);
          } else {
            // Future version - invalid
            expect(validation.valid).toBe(false);
            expect(validation.migrationNeeded).toBe(false);
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  /**
   * Property 11: Comprehensive server switch cache management preserves critical data
   * For any server switch operation, cache management should preserve user data while clearing server data
   */
  it('should preserve critical data during comprehensive server switch cache management', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fromServerId: fc.constantFrom('mac-mini', 'pn51'),
          toServerId: fc.constantFrom('mac-mini', 'pn51'),
          dataCount: fc.integer({ min: 1, max: 5 }),
        }),
        async ({ fromServerId, toServerId, dataCount }) => {
          // Skip if switching to same server
          fc.pre(fromServerId !== toServerId);

          // Setup mock cache
          const allKeys = Array.from({ length: dataCount }, (_, i) => `@verbumcare/patients_${i}`);

          (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(allKeys);
          (AsyncStorage.multiGet as jest.Mock).mockResolvedValue(
            allKeys.map(key => [key, JSON.stringify({ data: 'mock-data', timestamp: Date.now() })])
          );

          // Mock version validation to pass
          (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
            if (key.includes('problem_templates_version')) {
              return Promise.resolve('2'); // Current version
            }
            return Promise.resolve(null);
          });

          // Perform comprehensive server switch cache management
          const result = await backendConfigService.performServerSwitchWithCacheManagement(
            fromServerId,
            toServerId
          );

          // Verify operation succeeded
          expect(result.success).toBe(true);
          expect(result.backupKey).toBeDefined();

          // Verify backup was created
          expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            expect.stringContaining(`server_backup_${fromServerId}`),
            expect.any(String)
          );

          // Verify server-specific cache was cleared
          expect(AsyncStorage.multiRemove).toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });
});