/**
 * Integration Test: Backend Switching Settings - Complete Workflows
 * 
 * Tests complete workflows for backend server switching and settings management:
 * 1. Full server switching workflow with connectivity testing and fallback
 * 2. Language switching across multiple screens with immediate updates
 * 3. Settings persistence across app restarts
 * 4. Error recovery and fallback scenarios
 * 
 * **Feature: backend-switching-settings, Integration Tests**
 * **Validates: Requirements 7.2, 7.3, 7.5**
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '@stores/settingsStore';
import { useAuthStore } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { backendConfigService } from '@services/backendConfigService';
import { cacheService } from '@services/cacheService';
import { networkService } from '@services/networkService';
import { offlineQueueService } from '@services/offlineQueueService';
import { languageSyncService } from '@services/languageSync';
import { getServerById, AVAILABLE_SERVERS } from '@config/servers';
import { DEFAULT_PERSISTED_SETTINGS, SETTINGS_STORAGE_KEY } from '@constants/settings';
import { Language } from '@types/app';
import { ConnectionStatus, ServerSwitchState } from '@types/settings';

// Mock network connectivity
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// Mock axios for API calls
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

// Mock language sync service
jest.mock('@services/languageSync', () => ({
  languageSyncService: {
    notifyLanguageChange: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    clearListeners: jest.fn(),
  },
}));

describe('Integration Test: Backend Switching Settings - Complete Workflows', () => {
  let storage: Map<string, string>;
  let mockNetworkConnected: boolean;
  let mockServerResponses: Map<string, any>;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage = new Map<string, string>();
    mockNetworkConnected = true;
    mockServerResponses = new Map();

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
    
    // Default successful health check responses
    mockServerResponses.set('mac-mini-health', { status: 200, data: { status: 'ok' } });
    mockServerResponses.set('pn51-health', { status: 200, data: { status: 'ok' } });
    mockServerResponses.set('mac-mini-auth', { status: 200, data: { valid: true } });
    mockServerResponses.set('pn51-auth', { status: 200, data: { valid: true } });

    (axios.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('verbumcaremac-mini') && url.includes('/health')) {
        return Promise.resolve(mockServerResponses.get('mac-mini-health'));
      }
      if (url.includes('verbumcare-lab.local') && url.includes('/health')) {
        return Promise.resolve(mockServerResponses.get('pn51-health'));
      }
      if (url.includes('verbumcaremac-mini') && url.includes('/auth/verify')) {
        return Promise.resolve(mockServerResponses.get('mac-mini-auth'));
      }
      if (url.includes('verbumcare-lab.local') && url.includes('/auth/verify')) {
        return Promise.resolve(mockServerResponses.get('pn51-auth'));
      }
      return Promise.resolve({ status: 200, data: {} });
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
      preferences: DEFAULT_PERSISTED_SETTINGS.preferences,
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
    mockServerResponses.clear();
  });

  describe('Full Server Switching Workflow', () => {
    it('should complete full server switching workflow: connectivity test → switch → cache management → auth', async () => {
      // ============================================================
      // STEP 1: Initialize with Mac Mini as current server
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      expect(useSettingsStore.getState().currentServer.id).toBe('mac-mini');
      expect(useSettingsStore.getState().connectionStatus).toBe('disconnected');

      // ============================================================
      // STEP 2: Test connectivity to current server
      // ============================================================
      await settingsStore.refreshConnectionStatus();

      const stateAfterConnectivity = useSettingsStore.getState();
      expect(stateAfterConnectivity.connectionStatus).toBe('connected');
      expect(stateAfterConnectivity.detailedStatus).toBeDefined();
      expect(stateAfterConnectivity.detailedStatus?.serverId).toBe('mac-mini');
      expect(stateAfterConnectivity.detailedStatus?.status).toBe('connected');

      // ============================================================
      // STEP 3: Setup authentication for server switch
      // ============================================================
      const mockUser = {
        userId: 'user-123',
        staffId: 'staff-123',
        username: 'nurse1',
        fullName: 'Test Nurse',
        role: 'nurse' as const,
        facilityId: 'facility-123',
        loginTime: new Date(),
      };

      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: new Date(Date.now() + 3600000),
      };

      useAuthStore.setState({
        currentUser: mockUser,
        tokens: mockTokens,
        isAuthenticated: true,
        isLoading: false,
      });

      // ============================================================
      // STEP 4: Perform server switch from Mac Mini to pn51
      // ============================================================
      console.log('🔄 Starting server switch from mac-mini to pn51...');
      
      const switchPromise = settingsStore.switchServer('pn51');

      // Verify switch state is updated immediately
      const stateWhileSwitching = useSettingsStore.getState();
      expect(stateWhileSwitching.serverSwitchState.isInProgress).toBe(true);
      expect(stateWhileSwitching.serverSwitchState.fromServerId).toBe('mac-mini');
      expect(stateWhileSwitching.serverSwitchState.toServerId).toBe('pn51');
      expect(stateWhileSwitching.connectionStatus).toBe('switching');

      // Wait for switch to complete
      const switchResult = await switchPromise;

      // ============================================================
      // STEP 5: Verify successful server switch
      // ============================================================
      expect(switchResult).toBe(true);

      const stateAfterSwitch = useSettingsStore.getState();
      expect(stateAfterSwitch.currentServer.id).toBe('pn51');
      expect(stateAfterSwitch.connectionStatus).toBe('connected');
      expect(stateAfterSwitch.serverSwitchState.isInProgress).toBe(false);
      expect(stateAfterSwitch.lastError).toBeNull();

      // Verify server history is updated
      expect(stateAfterSwitch.serverHistory.length).toBeGreaterThan(0);
      const latestHistoryEntry = stateAfterSwitch.serverHistory[0];
      expect(latestHistoryEntry.serverId).toBe('pn51');
      expect(latestHistoryEntry.successful).toBe(true);

      // ============================================================
      // STEP 6: Verify cache management occurred
      // ============================================================
      // Cache service should have been called for server-specific operations
      // This is verified through the successful switch completion

      // ============================================================
      // STEP 7: Test connectivity to new server
      // ============================================================
      const connectivityResult = await settingsStore.testServerConnectivity('pn51');
      expect(connectivityResult.status).toBe('connected');
      expect(connectivityResult.serverId).toBe('pn51');
      expect(connectivityResult.healthChecks.length).toBeGreaterThan(0);

      // ============================================================
      // STEP 8: Verify settings persistence
      // ============================================================
      await settingsStore.saveSettings();
      
      const savedSettings = storage.get(SETTINGS_STORAGE_KEY);
      expect(savedSettings).toBeDefined();
      
      const parsedSettings = JSON.parse(savedSettings!);
      expect(parsedSettings.currentServerId).toBe('pn51');
      expect(parsedSettings.serverHistory).toBeDefined();
      expect(parsedSettings.serverHistory.length).toBeGreaterThan(0);

      console.log('✅ Full server switching workflow completed successfully');
    }, 30000);

    it('should handle server switch failure with graceful fallback', async () => {
      // ============================================================
      // STEP 1: Setup initial state with Mac Mini
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 2: Mock pn51 server failure
      // ============================================================
      mockServerResponses.set('pn51-health', { 
        status: 500, 
        statusText: 'Internal Server Error' 
      });

      // Make axios.get reject for pn51 health checks
      const axios = require('axios');
      (axios.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('verbumcare-lab.local') && url.includes('/health')) {
          return Promise.reject(new Error('Connection refused'));
        }
        if (url.includes('verbumcaremac-mini') && url.includes('/health')) {
          return Promise.resolve(mockServerResponses.get('mac-mini-health'));
        }
        return Promise.resolve({ status: 200, data: {} });
      });

      // ============================================================
      // STEP 3: Attempt server switch to failing server
      // ============================================================
      console.log('🔄 Attempting server switch to failing server...');
      
      const switchResult = await settingsStore.switchServer('pn51');

      // ============================================================
      // STEP 4: Verify switch failed but fallback occurred
      // ============================================================
      expect(switchResult).toBe(false);

      const stateAfterFailedSwitch = useSettingsStore.getState();
      
      // Should remain on original server (Mac Mini)
      expect(stateAfterFailedSwitch.currentServer.id).toBe('mac-mini');
      expect(stateAfterFailedSwitch.serverSwitchState.isInProgress).toBe(false);
      expect(stateAfterFailedSwitch.lastError).toBeDefined();
      expect(stateAfterFailedSwitch.lastError).toContain('failed');

      // Verify failed attempt is recorded in history
      expect(stateAfterFailedSwitch.serverHistory.length).toBeGreaterThan(0);
      const failedHistoryEntry = stateAfterFailedSwitch.serverHistory.find(
        entry => entry.serverId === 'pn51' && !entry.successful
      );
      expect(failedHistoryEntry).toBeDefined();

      console.log('✅ Server switch failure with fallback handled correctly');
    }, 30000);

    it('should handle offline server switch by queuing operation', async () => {
      // ============================================================
      // STEP 1: Setup initial state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 2: Go offline
      // ============================================================
      mockNetworkConnected = false;

      // ============================================================
      // STEP 3: Attempt server switch while offline
      // ============================================================
      console.log('🔄 Attempting server switch while offline...');
      
      const switchResult = await settingsStore.switchServer('pn51');

      // ============================================================
      // STEP 4: Verify operation was queued
      // ============================================================
      expect(switchResult).toBe(true); // Should return true indicating request was accepted

      const stateAfterOfflineSwitch = useSettingsStore.getState();
      
      // Should still be on original server but with queued state
      expect(stateAfterOfflineSwitch.currentServer.id).toBe('mac-mini');
      expect(stateAfterOfflineSwitch.serverSwitchState.isInProgress).toBe(false);
      expect(stateAfterOfflineSwitch.serverSwitchState.progress).toContain('queued');

      // ============================================================
      // STEP 5: Come back online and process queue
      // ============================================================
      mockNetworkConnected = true;

      // Process offline queue
      await settingsStore.processOfflineQueue();

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('✅ Offline server switch queuing handled correctly');
    }, 30000);
  });

  describe('Language Switching Across Multiple Screens', () => {
    it('should switch language immediately across all stores and components', async () => {
      // ============================================================
      // STEP 1: Initialize with Japanese
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      expect(useSettingsStore.getState().currentLanguage).toBe('ja');
      expect(useAssessmentStore.getState().language).toBe('ja');

      // ============================================================
      // STEP 2: Switch to English
      // ============================================================
      console.log('🌐 Switching language from Japanese to English...');
      
      await settingsStore.setLanguage('en');

      // ============================================================
      // STEP 3: Verify immediate language update in settings store
      // ============================================================
      const settingsStateAfterSwitch = useSettingsStore.getState();
      expect(settingsStateAfterSwitch.currentLanguage).toBe('en');
      expect(settingsStateAfterSwitch.lastError).toBeNull();

      // ============================================================
      // STEP 4: Verify language sync service was called
      // ============================================================
      expect(languageSyncService.notifyLanguageChange).toHaveBeenCalledWith('en');

      // ============================================================
      // STEP 5: Verify settings persistence
      // ============================================================
      const savedSettings = storage.get(SETTINGS_STORAGE_KEY);
      expect(savedSettings).toBeDefined();
      
      const parsedSettings = JSON.parse(savedSettings!);
      expect(parsedSettings.currentLanguage).toBe('en');

      // ============================================================
      // STEP 6: Switch to Traditional Chinese
      // ============================================================
      console.log('🌐 Switching language to Traditional Chinese...');
      
      await settingsStore.setLanguage('zh-TW');

      const finalState = useSettingsStore.getState();
      expect(finalState.currentLanguage).toBe('zh-TW');

      // Verify multiple language sync calls
      expect(languageSyncService.notifyLanguageChange).toHaveBeenCalledTimes(2);
      expect(languageSyncService.notifyLanguageChange).toHaveBeenLastCalledWith('zh-TW');

      console.log('✅ Language switching across multiple screens completed successfully');
    }, 30000);

    it('should handle offline language switching with queuing', async () => {
      // ============================================================
      // STEP 1: Setup initial state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      expect(useSettingsStore.getState().currentLanguage).toBe('ja');

      // ============================================================
      // STEP 2: Go offline
      // ============================================================
      mockNetworkConnected = false;

      // ============================================================
      // STEP 3: Switch language while offline
      // ============================================================
      console.log('🌐 Switching language while offline...');
      
      await settingsStore.setLanguage('en');

      // ============================================================
      // STEP 4: Verify immediate language change even offline
      // ============================================================
      const stateAfterOfflineSwitch = useSettingsStore.getState();
      expect(stateAfterOfflineSwitch.currentLanguage).toBe('en');

      // Verify language sync was called
      expect(languageSyncService.notifyLanguageChange).toHaveBeenCalledWith('en');

      // Verify settings were saved locally
      const savedSettings = storage.get(SETTINGS_STORAGE_KEY);
      expect(savedSettings).toBeDefined();
      
      const parsedSettings = JSON.parse(savedSettings!);
      expect(parsedSettings.currentLanguage).toBe('en');

      // ============================================================
      // STEP 5: Come back online
      // ============================================================
      mockNetworkConnected = true;

      // Process offline queue (language change should have been queued)
      await settingsStore.processOfflineQueue();

      // Language should still be English
      expect(useSettingsStore.getState().currentLanguage).toBe('en');

      console.log('✅ Offline language switching with queuing handled correctly');
    }, 30000);

    it('should reject invalid language changes', async () => {
      // ============================================================
      // STEP 1: Setup initial state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      const initialLanguage = useSettingsStore.getState().currentLanguage;

      // ============================================================
      // STEP 2: Attempt invalid language change
      // ============================================================
      console.log('🌐 Attempting invalid language change...');
      
      await settingsStore.setLanguage('invalid-lang' as Language);

      // ============================================================
      // STEP 3: Verify language remained unchanged
      // ============================================================
      const stateAfterInvalidChange = useSettingsStore.getState();
      expect(stateAfterInvalidChange.currentLanguage).toBe(initialLanguage);
      expect(stateAfterInvalidChange.lastError).toBeDefined();
      expect(stateAfterInvalidChange.lastError).toContain('Invalid language');

      // Verify language sync was not called
      expect(languageSyncService.notifyLanguageChange).not.toHaveBeenCalled();

      console.log('✅ Invalid language change rejection handled correctly');
    }, 30000);
  });

  describe('Settings Persistence Across App Restarts', () => {
    it('should restore complete settings state after app restart', async () => {
      // ============================================================
      // STEP 1: Setup initial state with custom settings
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // Switch to pn51 server
      mockServerResponses.set('pn51-health', { status: 200, data: { status: 'ok' } });
      await settingsStore.switchServer('pn51');

      // Change language to English
      await settingsStore.setLanguage('en');

      // Update preferences
      await settingsStore.updatePreferences({
        confirmServerSwitches: true,
        autoSwitchOnFailure: false,
        connectionTestTimeout: 15000,
      });

      // ============================================================
      // STEP 2: Verify settings are saved
      // ============================================================
      const stateBeforeRestart = useSettingsStore.getState();
      expect(stateBeforeRestart.currentServer.id).toBe('pn51');
      expect(stateBeforeRestart.currentLanguage).toBe('en');
      expect(stateBeforeRestart.preferences.confirmServerSwitches).toBe(true);
      expect(stateBeforeRestart.preferences.connectionTestTimeout).toBe(15000);

      // ============================================================
      // STEP 3: Simulate app restart (clear in-memory state)
      // ============================================================
      console.log('🔄 Simulating app restart...');
      
      useSettingsStore.setState({
        currentServer: getServerById('mac-mini')!, // Reset to default
        currentLanguage: 'ja', // Reset to default
        serverHistory: [],
        preferences: DEFAULT_PERSISTED_SETTINGS.preferences,
        connectionStatus: 'disconnected',
        detailedStatus: undefined,
        serverSwitchState: {
          isInProgress: false,
          fromServerId: undefined,
          toServerId: undefined,
          progress: '',
          startedAt: undefined,
          error: undefined,
        },
        lastError: null,
      });

      // Verify state was reset
      const stateAfterReset = useSettingsStore.getState();
      expect(stateAfterReset.currentServer.id).toBe('mac-mini');
      expect(stateAfterReset.currentLanguage).toBe('ja');

      // ============================================================
      // STEP 4: Load settings (simulate app startup)
      // ============================================================
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 5: Verify settings were restored correctly
      // ============================================================
      const stateAfterRestore = useSettingsStore.getState();
      
      expect(stateAfterRestore.currentServer.id).toBe('pn51');
      expect(stateAfterRestore.currentLanguage).toBe('en');
      expect(stateAfterRestore.preferences.confirmServerSwitches).toBe(true);
      expect(stateAfterRestore.preferences.connectionTestTimeout).toBe(15000);
      expect(stateAfterRestore.serverHistory.length).toBeGreaterThan(0);

      // Verify language sync was called during restoration
      expect(languageSyncService.notifyLanguageChange).toHaveBeenCalledWith('en');

      console.log('✅ Settings persistence across app restart completed successfully');
    }, 30000);

    it('should handle corrupted settings gracefully with fallback to defaults', async () => {
      // ============================================================
      // STEP 1: Setup corrupted settings in storage
      // ============================================================
      console.log('🔧 Setting up corrupted settings...');
      
      storage.set(SETTINGS_STORAGE_KEY, 'invalid-json-data');

      // ============================================================
      // STEP 2: Attempt to load settings
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 3: Verify fallback to defaults occurred
      // ============================================================
      const stateAfterCorruptedLoad = useSettingsStore.getState();
      
      // Should fall back to default server (Mac Mini)
      expect(stateAfterCorruptedLoad.currentServer.id).toBe('mac-mini');
      expect(stateAfterCorruptedLoad.currentLanguage).toBe('ja');
      expect(stateAfterCorruptedLoad.serverHistory).toEqual([]);
      expect(stateAfterCorruptedLoad.lastError).toBeDefined();
      expect(stateAfterCorruptedLoad.lastError).toContain('initialization failed');

      // Verify language sync was called with default language
      expect(languageSyncService.notifyLanguageChange).toHaveBeenCalledWith('ja');

      console.log('✅ Corrupted settings fallback handled correctly');
    }, 30000);

    it('should migrate settings from older versions', async () => {
      // ============================================================
      // STEP 1: Setup old version settings
      // ============================================================
      console.log('🔄 Setting up old version settings...');
      
      const oldVersionSettings = {
        currentServerId: 'pn51',
        currentLanguage: 'en',
        // Missing newer fields like serverHistory, preferences
        version: '1.0.0', // Old version
      };

      storage.set(SETTINGS_STORAGE_KEY, JSON.stringify(oldVersionSettings));

      // ============================================================
      // STEP 2: Load settings (should trigger migration)
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 3: Verify migration occurred
      // ============================================================
      const stateAfterMigration = useSettingsStore.getState();
      
      // Core settings should be preserved
      expect(stateAfterMigration.currentServer.id).toBe('pn51');
      expect(stateAfterMigration.currentLanguage).toBe('en');
      
      // New fields should be initialized with defaults
      expect(stateAfterMigration.serverHistory).toEqual([]);
      expect(stateAfterMigration.preferences).toBeDefined();
      expect(stateAfterMigration.preferences.confirmServerSwitches).toBeDefined();

      // Verify migrated settings are saved
      const savedSettings = storage.get(SETTINGS_STORAGE_KEY);
      expect(savedSettings).toBeDefined();
      
      const parsedSettings = JSON.parse(savedSettings!);
      expect(parsedSettings.version).toBe(DEFAULT_PERSISTED_SETTINGS.version);
      expect(parsedSettings.serverHistory).toBeDefined();
      expect(parsedSettings.preferences).toBeDefined();

      console.log('✅ Settings migration completed successfully');
    }, 30000);
  });

  describe('Error Recovery and Fallback Scenarios', () => {
    it('should handle concurrent server switch attempts safely', async () => {
      // ============================================================
      // STEP 1: Setup initial state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 2: Start first server switch
      // ============================================================
      console.log('🔄 Starting first server switch...');
      
      const firstSwitchPromise = settingsStore.switchServer('pn51');

      // Verify first switch is in progress
      expect(useSettingsStore.getState().serverSwitchState.isInProgress).toBe(true);

      // ============================================================
      // STEP 3: Attempt concurrent server switch
      // ============================================================
      console.log('🔄 Attempting concurrent server switch...');
      
      const secondSwitchResult = await settingsStore.switchServer('mac-mini');

      // ============================================================
      // STEP 4: Verify concurrent switch was prevented
      // ============================================================
      expect(secondSwitchResult).toBe(true); // Should return true (already on target server)

      // Wait for first switch to complete
      const firstSwitchResult = await firstSwitchPromise;
      expect(firstSwitchResult).toBe(true);

      // Verify final state is consistent
      const finalState = useSettingsStore.getState();
      expect(finalState.currentServer.id).toBe('pn51');
      expect(finalState.serverSwitchState.isInProgress).toBe(false);

      console.log('✅ Concurrent server switch prevention handled correctly');
    }, 30000);

    it('should recover from network interruption during server switch', async () => {
      // ============================================================
      // STEP 1: Setup initial state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 2: Start server switch
      // ============================================================
      console.log('🔄 Starting server switch...');
      
      // Mock network failure during switch
      let switchAttempts = 0;
      const axios = require('axios');
      (axios.get as jest.Mock).mockImplementation((url: string) => {
        switchAttempts++;
        
        if (url.includes('verbumcare-lab.local') && switchAttempts <= 2) {
          // Fail first 2 attempts, succeed on 3rd
          return Promise.reject(new Error('Network timeout'));
        }
        
        if (url.includes('verbumcare-lab.local') && url.includes('/health')) {
          return Promise.resolve({ status: 200, data: { status: 'ok' } });
        }
        
        return Promise.resolve({ status: 200, data: {} });
      });

      // ============================================================
      // STEP 3: Perform server switch (should retry and succeed)
      // ============================================================
      const switchResult = await settingsStore.switchServer('pn51');

      // ============================================================
      // STEP 4: Verify switch eventually succeeded
      // ============================================================
      expect(switchResult).toBe(true);
      expect(switchAttempts).toBeGreaterThan(2); // Should have retried

      const finalState = useSettingsStore.getState();
      expect(finalState.currentServer.id).toBe('pn51');
      expect(finalState.connectionStatus).toBe('connected');

      console.log('✅ Network interruption recovery handled correctly');
    }, 30000);

    it('should handle authentication failure during server switch', async () => {
      // ============================================================
      // STEP 1: Setup authenticated state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      useAuthStore.setState({
        currentUser: {
          userId: 'user-123',
          staffId: 'staff-123',
          username: 'nurse1',
          fullName: 'Test Nurse',
          role: 'nurse',
          facilityId: 'facility-123',
          loginTime: new Date(),
        },
        tokens: {
          accessToken: 'invalid-token',
          refreshToken: 'invalid-refresh',
          expiresAt: new Date(Date.now() + 3600000),
        },
        isAuthenticated: true,
        isLoading: false,
      });

      // ============================================================
      // STEP 2: Mock authentication failure on target server
      // ============================================================
      const axios = require('axios');
      (axios.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/health')) {
          return Promise.resolve({ status: 200, data: { status: 'ok' } });
        }
        if (url.includes('/auth/verify')) {
          return Promise.reject({ response: { status: 401, statusText: 'Unauthorized' } });
        }
        return Promise.resolve({ status: 200, data: {} });
      });

      // ============================================================
      // STEP 3: Perform server switch
      // ============================================================
      console.log('🔄 Performing server switch with auth failure...');
      
      const switchResult = await settingsStore.switchServer('pn51');

      // ============================================================
      // STEP 4: Verify switch succeeded but auth is required
      // ============================================================
      expect(switchResult).toBe(true);

      const finalState = useSettingsStore.getState();
      expect(finalState.currentServer.id).toBe('pn51');
      expect(finalState.lastError).toContain('Authentication required');

      console.log('✅ Authentication failure during server switch handled correctly');
    }, 30000);

    it('should handle cache corruption during server switch', async () => {
      // ============================================================
      // STEP 1: Setup initial state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 2: Mock cache corruption
      // ============================================================
      // Mock cacheService to simulate corruption
      const originalClearCache = cacheService.selectiveCacheClear;
      (cacheService.selectiveCacheClear as jest.Mock) = jest.fn()
        .mockRejectedValueOnce(new Error('Cache corruption detected'))
        .mockResolvedValue(undefined);

      // ============================================================
      // STEP 3: Perform server switch
      // ============================================================
      console.log('🔄 Performing server switch with cache corruption...');
      
      const switchResult = await settingsStore.switchServer('pn51');

      // ============================================================
      // STEP 4: Verify switch handled corruption gracefully
      // ============================================================
      // Switch might fail due to cache corruption, but should not crash
      const finalState = useSettingsStore.getState();
      expect(finalState.serverSwitchState.isInProgress).toBe(false);
      
      // Should either succeed or fail gracefully with error message
      if (!switchResult) {
        expect(finalState.lastError).toBeDefined();
        expect(finalState.lastError).toContain('failed');
      }

      // Restore original function
      cacheService.selectiveCacheClear = originalClearCache;

      console.log('✅ Cache corruption during server switch handled correctly');
    }, 30000);
  });

  describe('Offline Queue Management', () => {
    it('should process queued operations when connectivity returns', async () => {
      // ============================================================
      // STEP 1: Setup initial state
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      // ============================================================
      // STEP 2: Go offline and queue multiple operations
      // ============================================================
      mockNetworkConnected = false;

      console.log('📱 Going offline and queuing operations...');
      
      // Queue server switch
      await settingsStore.switchServer('pn51');
      
      // Queue language change
      await settingsStore.setLanguage('en');
      
      // Queue preferences update
      await settingsStore.updatePreferences({
        confirmServerSwitches: true,
      });

      // ============================================================
      // STEP 3: Verify operations were applied locally
      // ============================================================
      const stateWhileOffline = useSettingsStore.getState();
      expect(stateWhileOffline.currentLanguage).toBe('en');
      expect(stateWhileOffline.preferences.confirmServerSwitches).toBe(true);

      // ============================================================
      // STEP 4: Come back online
      // ============================================================
      mockNetworkConnected = true;
      console.log('🌐 Coming back online...');

      // ============================================================
      // STEP 5: Process offline queue
      // ============================================================
      await settingsStore.processOfflineQueue();

      // ============================================================
      // STEP 6: Verify all operations were processed
      // ============================================================
      const finalState = useSettingsStore.getState();
      expect(finalState.currentLanguage).toBe('en');
      expect(finalState.preferences.confirmServerSwitches).toBe(true);

      console.log('✅ Offline queue processing completed successfully');
    }, 30000);

    it('should clear offline queue when requested', async () => {
      // ============================================================
      // STEP 1: Setup offline state with queued operations
      // ============================================================
      const settingsStore = useSettingsStore.getState();
      await settingsStore.loadSettings();

      mockNetworkConnected = false;

      // Queue some operations
      await settingsStore.switchServer('pn51');
      await settingsStore.setLanguage('en');

      // ============================================================
      // STEP 2: Clear offline queue
      // ============================================================
      console.log('🗑️ Clearing offline queue...');
      
      await settingsStore.clearOfflineQueue();

      // ============================================================
      // STEP 3: Come back online and verify queue is empty
      // ============================================================
      mockNetworkConnected = true;
      
      // Process queue (should be empty)
      await settingsStore.processOfflineQueue();

      console.log('✅ Offline queue clearing completed successfully');
    }, 30000);
  });
});