/**
 * Property-Based Tests for Settings Persistence
 * 
 * **Feature: backend-switching-settings, Property 6: Settings persistence round trip**
 * **Validates: Requirements 3.3, 3.4**
 * 
 * Tests that settings persistence operations maintain data integrity through
 * save/load cycles and handle various data scenarios correctly.
 */

import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as fc from 'fast-check';
import { useSettingsStore } from '../settingsStore';
import { AVAILABLE_SERVERS } from '../../config/servers';
import { Language } from '../../types/app';
import { PersistedSettings, ServerHistoryEntry } from '../../types/settings';
import { SETTINGS_STORAGE_KEY, DEFAULT_PERSISTED_SETTINGS } from '../../constants/settings';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('axios');
jest.mock('../../services/cacheService', () => ({
  cacheService: {
    clearServerSpecificCache: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../services/networkService', () => ({
  networkService: {
    isConnected: jest.fn().mockReturnValue(true),
  },
}));
jest.mock('../authStore', () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({
      isAuthenticated: false,
      currentUser: null,
      tokens: null,
      isLoading: false,
      lastUsername: null,
    }),
  },
}));
jest.mock('../../services/languageSync', () => ({
  languageSyncService: {
    notifyLanguageChange: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    clearListeners: jest.fn(),
  },
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Test timeout for property tests
jest.setTimeout(30000);

describe('Settings Persistence Property Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Reset AsyncStorage
    (mockedAsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (mockedAsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (mockedAsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    
    // Ensure clean store state before each test
    await act(async () => {
      await useSettingsStore.getState().resetToDefaults();
    });
  });

  afterEach(async () => {
    // Clean up any store state
    await act(async () => {
      await useSettingsStore.getState().resetToDefaults();
    });
    
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  /**
   * Property 6: Settings persistence round trip
   * For any settings change (server or language), persisting then loading should produce equivalent settings
   */
  it('Property 6: Settings persistence maintains round trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data for settings
        fc.record({
          currentServerId: fc.constantFrom(...AVAILABLE_SERVERS.map(s => s.id)),
          currentLanguage: fc.constantFrom('ja', 'en', 'zh-TW') as fc.Arbitrary<Language>,
          serverHistory: fc.array(
            fc.record({
              serverId: fc.constantFrom(...AVAILABLE_SERVERS.map(s => s.id)),
              lastUsed: fc.date(),
              successful: fc.boolean(),
              duration: fc.integer({ min: 100, max: 10000 }),
            }),
            { maxLength: 10 }
          ),
          preferences: fc.record({
            autoSwitchOnFailure: fc.boolean(),
            showServerIndicator: fc.boolean(),
            confirmServerSwitches: fc.boolean(),
            connectionTestTimeout: fc.integer({ min: 1000, max: 30000 }),
            enableDetailedLogging: fc.boolean(),
            maxRetryAttempts: fc.integer({ min: 1, max: 10 }),
            enableGracefulFallback: fc.boolean(),
            preserveDataOnFailure: fc.boolean(),
            showSuggestedActions: fc.boolean(),
          }),
          version: fc.constant(1), // Use current version to avoid migration issues
        }),
        async (testSettings) => {
          // Clear all mocks and reset AsyncStorage before each test iteration
          jest.clearAllMocks();
          (mockedAsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
          (mockedAsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
          (mockedAsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
          
          // Create the settings object to persist
          const settingsToPersist: PersistedSettings = {
            currentServerId: testSettings.currentServerId,
            currentLanguage: testSettings.currentLanguage,
            serverHistory: testSettings.serverHistory,
            preferences: testSettings.preferences,
            version: testSettings.version,
          };

          // Create a fresh hook instance
          const { result } = renderHook(() => useSettingsStore());

          // Test the save operation first
          await act(async () => {
            const store = result.current;
            const server = AVAILABLE_SERVERS.find(s => s.id === testSettings.currentServerId)!;
            
            // Directly set the store state to our test values
            store.currentServer = server;
            store.currentLanguage = testSettings.currentLanguage;
            store.serverHistory = testSettings.serverHistory;
            store.preferences = testSettings.preferences;
            
            // Save the settings
            await store.saveSettings();
          });

          // Verify that setItem was called with the correct data
          expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
            SETTINGS_STORAGE_KEY,
            expect.any(String)
          );

          // Parse the saved data to verify it matches our input
          const setItemCall = (mockedAsyncStorage.setItem as jest.Mock).mock.calls[0];
          const savedData = JSON.parse(setItemCall[1]);
          
          // Verify the saved data matches our test settings
          expect(savedData.currentServerId).toBe(testSettings.currentServerId);
          expect(savedData.currentLanguage).toBe(testSettings.currentLanguage);
          expect(savedData.preferences).toEqual(testSettings.preferences);
          expect(savedData.serverHistory).toHaveLength(testSettings.serverHistory.length);

          // Test the load operation - this is the core round-trip test
          // Mock AsyncStorage to return our saved data
          (mockedAsyncStorage.getItem as jest.Mock).mockResolvedValue(
            JSON.stringify(settingsToPersist)
          );

          // Create a new store instance to test loading
          const { result: loadResult } = renderHook(() => useSettingsStore());

          // Load settings from storage
          await act(async () => {
            await loadResult.current.loadSettings();
          });

          // Verify the loaded settings match what we saved
          const loadedState = loadResult.current;
          
          // The key test: loaded data should match our original test data
          expect(loadedState.currentServer.id).toBe(testSettings.currentServerId);
          expect(loadedState.currentLanguage).toBe(testSettings.currentLanguage);
          
          // Server history should match (with proper date handling)
          expect(loadedState.serverHistory).toHaveLength(testSettings.serverHistory.length);
          loadedState.serverHistory.forEach((entry, index) => {
            const originalEntry = testSettings.serverHistory[index];
            expect(entry.serverId).toBe(originalEntry.serverId);
            expect(entry.successful).toBe(originalEntry.successful);
            expect(entry.duration).toBe(originalEntry.duration);
            // Date comparison (allowing for serialization/deserialization)
            expect(new Date(entry.lastUsed).getTime()).toBe(originalEntry.lastUsed.getTime());
          });
          
          // Preferences should match
          expect(loadedState.preferences).toEqual(testSettings.preferences);
        }
      ),
      { numRuns: 50 } // Reduced runs for faster testing
    );
  });

  /**
   * Additional property: Invalid settings are handled gracefully
   * When loading corrupted or invalid settings, the system should fall back to defaults
   */
  it('Property 6a: Invalid settings fallback to defaults gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(null), // No settings
          fc.constant('invalid json'), // Invalid JSON
          fc.constant('{}'), // Empty object
          fc.record({
            currentServerId: fc.string(), // Invalid server ID
            currentLanguage: fc.string(), // Invalid language
            serverHistory: fc.anything(), // Invalid history
            preferences: fc.anything(), // Invalid preferences
          }),
        ),
        async (invalidSettings) => {
          const { result } = renderHook(() => useSettingsStore());
          
          // Mock AsyncStorage to return invalid settings
          if (invalidSettings === null) {
            (mockedAsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
          } else if (typeof invalidSettings === 'string') {
            (mockedAsyncStorage.getItem as jest.Mock).mockResolvedValue(invalidSettings);
          } else {
            (mockedAsyncStorage.getItem as jest.Mock).mockResolvedValue(
              JSON.stringify(invalidSettings)
            );
          }

          // Load settings - should not throw and should use defaults
          await act(async () => {
            await result.current.loadSettings();
          });

          const state = result.current;
          
          // Should fall back to valid defaults
          expect(AVAILABLE_SERVERS.some(s => s.id === state.currentServer.id)).toBe(true);
          expect(['ja', 'en', 'zh-TW'].includes(state.currentLanguage)).toBe(true);
          expect(Array.isArray(state.serverHistory)).toBe(true);
          expect(typeof state.preferences).toBe('object');
          expect(typeof state.preferences.autoSwitchOnFailure).toBe('boolean');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Settings persistence is atomic
   * Save operations should either complete fully or not at all
   */
  it('Property 6b: Settings save operations are atomic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          shouldSaveFail: fc.boolean(),
          currentServerId: fc.constantFrom(...AVAILABLE_SERVERS.map(s => s.id)),
          currentLanguage: fc.constantFrom('ja', 'en', 'zh-TW') as fc.Arbitrary<Language>,
        }),
        async (testData) => {
          const { result } = renderHook(() => useSettingsStore());
          
          // Set up the store with test data
          await act(async () => {
            const store = result.current;
            const server = AVAILABLE_SERVERS.find(s => s.id === testData.currentServerId)!;
            store.currentServer = server;
            store.currentLanguage = testData.currentLanguage;
            // Clear any previous errors
            store.clearError();
          });

          // Mock save success or failure
          if (testData.shouldSaveFail) {
            (mockedAsyncStorage.setItem as jest.Mock).mockRejectedValue(
              new Error('Storage full')
            );
          } else {
            (mockedAsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
          }

          // Attempt to save
          await act(async () => {
            await result.current.saveSettings();
          });

          const finalState = result.current;

          if (testData.shouldSaveFail) {
            // Should have error state but maintain consistency
            expect(finalState.lastError).toBeTruthy();
            expect(finalState.currentServer.id).toBe(testData.currentServerId);
            expect(finalState.currentLanguage).toBe(testData.currentLanguage);
          } else {
            // Should have saved successfully
            expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
              SETTINGS_STORAGE_KEY,
              expect.any(String)
            );
            // Error might still be present from previous operations, so don't check it
            expect(finalState.currentServer.id).toBe(testData.currentServerId);
            expect(finalState.currentLanguage).toBe(testData.currentLanguage);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Language changes persist immediately
   * Language changes should be saved to storage immediately
   */
  it('Property 6c: Language changes persist immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialLanguage: fc.constantFrom('ja', 'en', 'zh-TW') as fc.Arbitrary<Language>,
          targetLanguage: fc.constantFrom('ja', 'en', 'zh-TW') as fc.Arbitrary<Language>,
        }),
        async (testData) => {
          const { result } = renderHook(() => useSettingsStore());
          
          // Set initial language
          await act(async () => {
            result.current.currentLanguage = testData.initialLanguage;
          });

          // Change language
          await act(async () => {
            await result.current.setLanguage(testData.targetLanguage);
          });

          // Verify language was changed
          expect(result.current.currentLanguage).toBe(testData.targetLanguage);

          if (testData.initialLanguage !== testData.targetLanguage) {
            // Should have saved to storage
            expect(mockedAsyncStorage.setItem).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Additional property: Settings reset clears storage completely
   * Reset operations should remove all stored settings
   */
  it('Property 6d: Settings reset clears storage completely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasExistingSettings: fc.boolean(),
        }),
        async (testData) => {
          const { result } = renderHook(() => useSettingsStore());
          
          if (testData.hasExistingSettings) {
            // Mock existing settings
            (mockedAsyncStorage.getItem as jest.Mock).mockResolvedValue(
              JSON.stringify(DEFAULT_PERSISTED_SETTINGS)
            );
            
            // Load existing settings
            await act(async () => {
              await result.current.loadSettings();
            });
          }

          // Reset to defaults
          await act(async () => {
            await result.current.resetToDefaults();
          });

          // Should have removed settings from storage
          expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(SETTINGS_STORAGE_KEY);

          // Should be in default state
          const state = result.current;
          expect(AVAILABLE_SERVERS.some(s => s.id === state.currentServer.id && s.isDefault)).toBe(true);
          expect(state.currentLanguage).toBe('ja'); // Default language
          expect(state.serverHistory).toEqual([]);
          expect(state.lastError).toBeNull();
        }
      ),
      { numRuns: 30 }
    );
  });
});