/**
 * Settings Initialization Service Tests
 * 
 * Tests for the settings initialization service including:
 * - Loading saved settings from AsyncStorage
 * - Setting default server based on current configuration
 * - Handling missing or corrupted settings gracefully
 * - Settings migration between versions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { settingsInitializationService } from '../settingsInitializationService';
import { SETTINGS_STORAGE_KEY, DEFAULT_LANGUAGE, SETTINGS_VERSION } from '../../constants/settings';
import { getDefaultServer } from '../../config/servers';
import { DEFAULT_USER_PREFERENCES } from '../../types/settings';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock server configuration
jest.mock('../../config/servers', () => ({
  getDefaultServer: jest.fn(() => ({
    id: 'mac-mini',
    name: 'verbumcaremac-mini',
    displayName: 'Mac Mini (Production)',
    baseUrl: 'https://verbumcaremac-mini/api',
    wsUrl: 'wss://verbumcaremac-mini',
    description: 'Current production server',
    isDefault: true,
    healthCheckEndpoints: ['/health'],
    connectionTimeout: 10000,
    retryAttempts: 3,
  })),
  getServerById: jest.fn((id: string) => {
    if (id === 'mac-mini') {
      return {
        id: 'mac-mini',
        name: 'verbumcaremac-mini',
        displayName: 'Mac Mini (Production)',
        baseUrl: 'https://verbumcaremac-mini/api',
        wsUrl: 'wss://verbumcaremac-mini',
        description: 'Current production server',
        isDefault: true,
        healthCheckEndpoints: ['/health'],
        connectionTimeout: 10000,
        retryAttempts: 3,
      };
    }
    return undefined;
  }),
  AVAILABLE_SERVERS: [
    {
      id: 'mac-mini',
      name: 'verbumcaremac-mini',
      displayName: 'Mac Mini (Production)',
      baseUrl: 'https://verbumcaremac-mini/api',
      wsUrl: 'wss://verbumcaremac-mini',
      description: 'Current production server',
      isDefault: true,
      healthCheckEndpoints: ['/health'],
      connectionTimeout: 10000,
      retryAttempts: 3,
    }
  ]
}));

describe('SettingsInitializationService', () => {
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsInitializationService.reset();
  });

  describe('First Run (No Existing Settings)', () => {
    it('should create default settings when no stored settings exist', async () => {
      // Arrange
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.isFirstRun).toBe(true);
      expect(result.migrationPerformed).toBe(false);
      expect(result.settings.currentServerId).toBe('mac-mini');
      expect(result.settings.currentLanguage).toBe(DEFAULT_LANGUAGE);
      expect(result.settings.version).toBe(SETTINGS_VERSION);
      expect(result.settings.preferences).toEqual(DEFAULT_USER_PREFERENCES);
      expect(result.settings.serverHistory).toEqual([]);

      // Verify settings were saved
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        SETTINGS_STORAGE_KEY,
        expect.stringContaining('"currentServerId":"mac-mini"')
      );
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      // Arrange
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(false);
      expect(result.isFirstRun).toBe(true);
      expect(result.errors).toContain('Storage error');
      expect(result.settings).toBeDefined(); // Should have emergency fallback
    });
  });

  describe('Loading Existing Settings', () => {
    it('should load valid existing settings', async () => {
      // Arrange
      const validSettings = {
        currentServerId: 'mac-mini',
        currentLanguage: 'ja',
        serverHistory: [],
        preferences: DEFAULT_USER_PREFERENCES,
        version: SETTINGS_VERSION
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(validSettings));

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.isFirstRun).toBe(false);
      expect(result.migrationPerformed).toBe(false);
      expect(result.settings).toEqual(validSettings);
    });

    it('should handle corrupted JSON gracefully', async () => {
      // Arrange
      mockAsyncStorage.getItem.mockResolvedValue('invalid json {');
      mockAsyncStorage.setItem.mockResolvedValue();

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.isFirstRun).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.settings.currentServerId).toBe('mac-mini');
    });

    it('should handle invalid settings structure', async () => {
      // Arrange
      const invalidSettings = {
        currentServerId: '', // Invalid
        currentLanguage: 'invalid-lang', // Invalid
        // Missing required fields
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(invalidSettings));
      mockAsyncStorage.setItem.mockResolvedValue();

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.isFirstRun).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.settings.currentServerId).toBe('mac-mini'); // Should use default
      expect(result.settings.currentLanguage).toBe(DEFAULT_LANGUAGE); // Should use default
    });
  });

  describe('Settings Migration', () => {
    it('should migrate settings from version 0 to current version', async () => {
      // Arrange
      const oldSettings = {
        currentServerId: 'mac-mini',
        currentLanguage: 'ja',
        // No version field (implies version 0)
        // Missing some new fields
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(oldSettings));

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.migrationPerformed).toBe(true);
      expect(result.settings.version).toBe(SETTINGS_VERSION);
      expect(result.settings.preferences).toEqual(DEFAULT_USER_PREFERENCES);
      expect(result.settings.serverHistory).toEqual([]);
    });

    it('should handle migration with invalid server ID', async () => {
      // Arrange
      const oldSettings = {
        currentServerId: 'invalid-server',
        currentLanguage: 'ja',
        version: 0
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(oldSettings));

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.migrationPerformed).toBe(true);
      expect(result.settings.currentServerId).toBe('mac-mini'); // Should fallback to default
      expect(result.warnings.some(w => w.includes('Invalid server ID'))).toBe(true);
    });
  });

  describe('Settings Sanitization', () => {
    it('should sanitize server history', async () => {
      // Arrange
      const settingsWithBadHistory = {
        currentServerId: 'mac-mini',
        currentLanguage: 'ja',
        serverHistory: [
          { serverId: 'mac-mini', lastUsed: new Date(), successful: true },
          null, // Invalid entry
          { serverId: '', lastUsed: new Date(), successful: true }, // Invalid serverId
          { serverId: 'valid-server', lastUsed: new Date(), successful: false },
          // Add many entries to test truncation
          ...Array(15).fill(0).map((_, i) => ({
            serverId: `server-${i}`,
            lastUsed: new Date(),
            successful: true
          }))
        ],
        preferences: DEFAULT_USER_PREFERENCES,
        version: SETTINGS_VERSION
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(settingsWithBadHistory));

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.settings.serverHistory.length).toBeLessThanOrEqual(10); // Should be truncated
      expect(result.settings.serverHistory.every(entry => entry && entry.serverId)).toBe(true); // All entries should be valid
    });

    it('should handle invalid language gracefully', async () => {
      // Arrange
      const settingsWithInvalidLanguage = {
        currentServerId: 'mac-mini',
        currentLanguage: 'invalid-language',
        serverHistory: [],
        preferences: DEFAULT_USER_PREFERENCES,
        version: SETTINGS_VERSION
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(settingsWithInvalidLanguage));

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(true);
      expect(result.settings.currentLanguage).toBe(DEFAULT_LANGUAGE); // Should fallback to default
    });
  });

  describe('Error Handling', () => {
    it('should provide emergency fallback when everything fails', async () => {
      // Arrange
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Critical storage failure'));
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Cannot save'));

      // Act
      const result = await settingsInitializationService.initialize();

      // Assert
      expect(result.success).toBe(false);
      expect(result.settings).toBeDefined();
      expect(result.settings.currentServerId).toBe('mac-mini'); // Emergency fallback
      expect(result.settings.currentLanguage).toBe('ja'); // Emergency fallback
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Initialization State', () => {
    it('should track initialization state correctly', async () => {
      // Arrange
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      // Act & Assert
      expect(settingsInitializationService.isInitialized()).toBe(false);
      
      await settingsInitializationService.initialize();
      
      expect(settingsInitializationService.isInitialized()).toBe(true);
    });

    it('should prevent multiple simultaneous initializations', async () => {
      // Arrange
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      // Act
      const promise1 = settingsInitializationService.initialize();
      const promise2 = settingsInitializationService.initialize();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Assert
      expect(result1).toBe(result2); // Should be the same promise result
      expect(mockAsyncStorage.getItem).toHaveBeenCalledTimes(1); // Should only call once
    });
  });
});