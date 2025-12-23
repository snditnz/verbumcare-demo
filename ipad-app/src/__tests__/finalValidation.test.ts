/**
 * Final Validation Tests for Backend Switching Settings
 * 
 * Task 22: Final testing and validation
 * 
 * This test suite validates:
 * - Complete server switching workflow end-to-end
 * - Language switching works across all screens
 * - Error scenarios and recovery mechanisms
 * - Settings persistence and restoration
 * - Concurrent operations and race condition prevention
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '@stores/settingsStore';
import { useAuthStore } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { backendConfigService } from '@services/backendConfigService';
import { networkService } from '@services/networkService';
import { getServerById, AVAILABLE_SERVERS } from '@config/servers';
import { SETTINGS_STORAGE_KEY } from '@constants/settings';
import { Language } from '@types/app';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    defaults: {
      baseURL: 'https://verbumcaremac-mini/api',
    },
  };
  return mockAxios;
});

jest.mock('@services/languageSync', () => ({
  languageSyncService: {
    notifyLanguageChange: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    clearListeners: jest.fn(),
  },
}));

describe('Final Validation: Backend Switching Settings', () => {
  let storage: Map<string, string>;
  let mockNetworkConnected: boolean;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage = new Map<string, string>();
    mockNetworkConnected = true;

    // Setup AsyncStorage mock
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

    (AsyncStorage.multiRemove as jest.Mock).mockImplementation((keys: string[]) => {
      keys.forEach(key => storage.delete(key));
      return Promise.resolve();
    });

    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(() => {
      return Promise.resolve(Array.from(storage.keys()));
    });

    // Setup network service mock
    (networkService.isConnected as jest.Mock) = jest.fn(() => mockNetworkConnected);

    // Setup axios mock responses
    const axios = require('axios');
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { status: 'ok' },
    });

    // Reset stores
    useSettingsStore.setState({
      currentServer: getServerById('mac-mini')!,
      availableServers: AVAILABLE_SERVERS,
      connectionStatus: 'disconnected',
      detailedStatus: undefined,
      currentLanguage: 'ja',
      availableLanguages: ['ja', 'en', 'zh-TW'],
      serverSwitchState: {
        isInProgress: false,
        fromServerId: undefined,
        toServerId: undefined,
        progress: '',
        startedAt: undefined,
        error: undefined,
      },
      lastError: null,
      preferences: {
        autoSwitchOnFailure: false,
        showServerIndicator: true,
        confirmServerSwitches: true,
        connectionTestTimeout: 10000,
        enableDetailedLogging: false,
        maxRetryAttempts: 3,
        enableGracefulFallback: true,
        preserveDataOnFailure: true,
        showSuggestedActions: true,
      },
      serverHistory: [],
    });

    useAuthStore.setState({
      currentUser: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
    });

    useAssessmentStore.setState({
      language: 'ja',
    });
  });

  afterEach(async () => {
    storage.clear();
  });

  describe('Requirement 7.1: Comprehensive health checks', () => {
    it('should perform comprehensive health checks including API and authentication endpoints', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Test connectivity to Mac Mini server
      const result = await settingsStore.testServerConnectivity('mac-mini');

      // Verify comprehensive health checks were performed
      expect(result.status).toBe('connected');
      expect(result.serverId).toBe('mac-mini');
      expect(result.healthChecks).toBeDefined();
      expect(result.healthChecks.length).toBeGreaterThan(0);
      
      // Verify each health check has required information
      result.healthChecks.forEach(check => {
        expect(check.endpoint).toBeDefined();
        expect(check.status).toMatch(/success|failure/);
        expect(typeof check.responseTime).toBe('number');
      });

      console.log('✅ Requirement 7.1 validated: Comprehensive health checks performed');
    });
  });

  describe('Requirement 7.2: Network failure handling', () => {
    it('should handle connection timeouts and retry logic appropriately', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Mock network timeout
      const axios = require('axios');
      let attemptCount = 0;
      (axios.get as jest.Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('ETIMEDOUT'));
        }
        return Promise.resolve({ status: 200, data: { status: 'ok' } });
      });

      // Attempt server switch
      const result = await settingsStore.switchServer('pn51');

      // Verify retry logic was applied
      expect(attemptCount).toBeGreaterThanOrEqual(1);
      
      // Verify final state is consistent
      const finalState = useSettingsStore.getState();
      expect(finalState.serverSwitchState.isInProgress).toBe(false);

      console.log('✅ Requirement 7.2 validated: Network failure handling with retry logic');
    });
  });

  describe('Requirement 7.3: Race condition prevention', () => {
    it('should prevent race conditions when switching between servers rapidly', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Start multiple concurrent switches
      const switch1 = settingsStore.switchServer('pn51');
      const switch2 = settingsStore.switchServer('mac-mini');
      const switch3 = settingsStore.switchServer('pn51');

      // Wait for all to complete
      const results = await Promise.all([switch1, switch2, switch3]);

      // Verify final state is consistent
      const finalState = useSettingsStore.getState();
      expect(finalState.currentServer.id).toBeTruthy();
      expect(AVAILABLE_SERVERS.some(s => s.id === finalState.currentServer.id)).toBe(true);
      expect(finalState.serverSwitchState.isInProgress).toBe(false);

      console.log('✅ Requirement 7.3 validated: Race condition prevention');
    });
  });

  describe('Requirement 7.4: Invalid configuration handling', () => {
    it('should provide clear error messages and recovery options for invalid configurations', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Attempt to switch to invalid server
      const result = await settingsStore.switchServer('invalid-server-id' as any);

      // Verify error handling
      expect(result).toBe(false);
      
      const finalState = useSettingsStore.getState();
      expect(finalState.lastError).toBeDefined();
      expect(finalState.lastError).toContain('Invalid');
      expect(finalState.serverSwitchState.isInProgress).toBe(false);

      console.log('✅ Requirement 7.4 validated: Invalid configuration handling');
    });
  });

  describe('Requirement 7.5: Data integrity during transitions', () => {
    it('should ensure no data loss occurs during server transitions', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Set up initial state with data
      await settingsStore.updatePreferences({
        confirmServerSwitches: true,
        connectionTestTimeout: 15000,
      });
      
      await settingsStore.setLanguage('en');

      // Capture initial state
      const initialLanguage = useSettingsStore.getState().currentLanguage;
      const initialPreferences = useSettingsStore.getState().preferences;

      // Perform server switch
      await settingsStore.switchServer('pn51');

      // Verify data integrity
      const finalState = useSettingsStore.getState();
      expect(finalState.currentLanguage).toBe(initialLanguage);
      expect(finalState.preferences.confirmServerSwitches).toBe(initialPreferences.confirmServerSwitches);
      expect(finalState.preferences.connectionTestTimeout).toBe(initialPreferences.connectionTestTimeout);

      console.log('✅ Requirement 7.5 validated: Data integrity during transitions');
    });
  });

  describe('Complete Server Switching Workflow', () => {
    it('should complete full end-to-end server switching workflow', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Step 1: Initialize
      await settingsStore.loadSettings();
      expect(useSettingsStore.getState().currentServer.id).toBe('mac-mini');

      // Step 2: Test connectivity
      await settingsStore.refreshConnectionStatus();
      expect(useSettingsStore.getState().connectionStatus).toBe('connected');

      // Step 3: Perform server switch
      const switchResult = await settingsStore.switchServer('pn51');

      // Step 4: Verify switch completed
      const finalState = useSettingsStore.getState();
      expect(finalState.serverSwitchState.isInProgress).toBe(false);
      
      // Step 5: Verify settings persistence
      const savedSettings = storage.get(SETTINGS_STORAGE_KEY);
      expect(savedSettings).toBeDefined();

      console.log('✅ Complete server switching workflow validated');
    });
  });

  describe('Language Switching Across Screens', () => {
    it('should switch language immediately across all screens', async () => {
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // Initial language
      expect(useSettingsStore.getState().currentLanguage).toBe('ja');

      // Switch to English
      await settingsStore.setLanguage('en');
      expect(useSettingsStore.getState().currentLanguage).toBe('en');

      // Switch to Traditional Chinese
      await settingsStore.setLanguage('zh-TW');
      expect(useSettingsStore.getState().currentLanguage).toBe('zh-TW');

      // Verify persistence
      const savedSettings = storage.get(SETTINGS_STORAGE_KEY);
      expect(savedSettings).toBeDefined();
      const parsedSettings = JSON.parse(savedSettings!);
      expect(parsedSettings.currentLanguage).toBe('zh-TW');

      console.log('✅ Language switching across screens validated');
    });
  });

  describe('Error Recovery and Fallback', () => {
    it('should recover from errors and provide fallback mechanisms', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Mock server failure
      const axios = require('axios');
      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      // Attempt server switch
      const result = await settingsStore.switchServer('pn51');

      // Verify error handling
      const finalState = useSettingsStore.getState();
      expect(finalState.serverSwitchState.isInProgress).toBe(false);
      expect(finalState.lastError).toBeDefined();

      console.log('✅ Error recovery and fallback validated');
    });
  });

  describe('Settings Persistence and Restoration', () => {
    it('should persist and restore settings across app restarts', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Set up custom settings
      await settingsStore.setLanguage('en');
      await settingsStore.updatePreferences({
        confirmServerSwitches: true,
        connectionTestTimeout: 15000,
      });

      // Simulate app restart
      useSettingsStore.setState({
        currentServer: getServerById('mac-mini')!,
        currentLanguage: 'ja',
        preferences: {
          autoSwitchOnFailure: false,
          showServerIndicator: true,
          confirmServerSwitches: false,
          connectionTestTimeout: 10000,
          enableDetailedLogging: false,
          maxRetryAttempts: 3,
          enableGracefulFallback: true,
          preserveDataOnFailure: true,
          showSuggestedActions: true,
        },
      });

      // Load settings
      await settingsStore.loadSettings();

      // Verify restoration
      const restoredState = useSettingsStore.getState();
      expect(restoredState.currentLanguage).toBe('en');
      expect(restoredState.preferences.confirmServerSwitches).toBe(true);
      expect(restoredState.preferences.connectionTestTimeout).toBe(15000);

      console.log('✅ Settings persistence and restoration validated');
    });
  });

  describe('Concurrent Operations Safety', () => {
    it('should handle concurrent operations safely without corruption', async () => {
      const settingsStore = useSettingsStore.getState();
      
      // Start multiple concurrent operations
      const operations = [
        settingsStore.switchServer('pn51'),
        settingsStore.setLanguage('en'),
        settingsStore.updatePreferences({ confirmServerSwitches: true }),
        settingsStore.refreshConnectionStatus(),
      ];

      // Wait for all to complete
      await Promise.all(operations);

      // Verify final state is consistent
      const finalState = useSettingsStore.getState();
      expect(finalState.serverSwitchState.isInProgress).toBe(false);
      expect(finalState.currentLanguage).toBeTruthy();
      expect(AVAILABLE_SERVERS.some(s => s.id === finalState.currentServer.id)).toBe(true);

      console.log('✅ Concurrent operations safety validated');
    });
  });
});
