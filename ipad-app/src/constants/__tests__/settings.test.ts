/**
 * Tests for settings constants and validation
 */

import {
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION,
  DEFAULT_LANGUAGE,
  DEFAULT_PERSISTED_SETTINGS,
  CONNECTION_TEST_CONFIG,
  SERVER_SWITCH_CONFIG,
  validateSettingsConstants,
  getLocalizedErrorMessage,
  getLocalizedSuccessMessage,
  SETTINGS_ERROR_MESSAGES,
  SETTINGS_SUCCESS_MESSAGES
} from '../settings';

import {
  validatePersistedSettings,
  AVAILABLE_LANGUAGES,
  DEFAULT_USER_PREFERENCES
} from '../../types/settings';

describe('Settings Constants', () => {
  test('should have valid storage key', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('verbumcare_settings');
    expect(typeof SETTINGS_STORAGE_KEY).toBe('string');
    expect(SETTINGS_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  test('should have positive settings version', () => {
    expect(SETTINGS_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(SETTINGS_VERSION)).toBe(true);
  });

  test('should have valid default language', () => {
    expect(AVAILABLE_LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  test('should have valid connection test configuration', () => {
    expect(CONNECTION_TEST_CONFIG.TIMEOUT).toBeGreaterThan(0);
    expect(CONNECTION_TEST_CONFIG.RETRY_ATTEMPTS).toBeGreaterThanOrEqual(0);
    expect(CONNECTION_TEST_CONFIG.RETRY_DELAY).toBeGreaterThan(0);
  });

  test('should have valid server switch configuration', () => {
    expect(SERVER_SWITCH_CONFIG.CONFIRMATION_TIMEOUT).toBeGreaterThan(0);
    expect(SERVER_SWITCH_CONFIG.ROLLBACK_TIMEOUT).toBeGreaterThan(0);
    expect(SERVER_SWITCH_CONFIG.CACHE_CLEAR_DELAY).toBeGreaterThanOrEqual(0);
  });

  test('should validate settings constants successfully', () => {
    const result = validateSettingsConstants();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should have valid default persisted settings', () => {
    const result = validatePersistedSettings(DEFAULT_PERSISTED_SETTINGS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should return error messages', () => {
    const errorMessage = getLocalizedErrorMessage('CONNECTION_FAILED');
    expect(errorMessage).toBe(SETTINGS_ERROR_MESSAGES.CONNECTION_FAILED);
    expect(typeof errorMessage).toBe('string');
    expect(errorMessage.length).toBeGreaterThan(0);
  });

  test('should return success messages with interpolation', () => {
    const message = getLocalizedSuccessMessage('SERVER_SWITCHED', { serverName: 'Test Server' });
    expect(message).toContain('Test Server');
    expect(typeof message).toBe('string');
  });

  test('should have all required default preferences', () => {
    expect(DEFAULT_USER_PREFERENCES).toHaveProperty('autoSwitchOnFailure');
    expect(DEFAULT_USER_PREFERENCES).toHaveProperty('showServerIndicator');
    expect(DEFAULT_USER_PREFERENCES).toHaveProperty('confirmServerSwitches');
    expect(DEFAULT_USER_PREFERENCES).toHaveProperty('connectionTestTimeout');
    expect(DEFAULT_USER_PREFERENCES).toHaveProperty('enableDetailedLogging');
  });
});

describe('Settings Validation', () => {
  test('should validate valid persisted settings', () => {
    const validSettings = {
      currentServerId: 'mac-mini',
      currentLanguage: 'ja' as const,
      serverHistory: [],
      preferences: DEFAULT_USER_PREFERENCES,
      version: 1
    };

    const result = validatePersistedSettings(validSettings);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject null settings', () => {
    const result = validatePersistedSettings(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should reject settings with invalid language', () => {
    const invalidSettings = {
      currentServerId: 'mac-mini',
      currentLanguage: 'invalid-language',
      serverHistory: [],
      preferences: DEFAULT_USER_PREFERENCES,
      version: 1
    };

    const result = validatePersistedSettings(invalidSettings);
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('language'))).toBe(true);
  });

  test('should reject settings without server ID', () => {
    const invalidSettings = {
      currentLanguage: 'ja' as const,
      serverHistory: [],
      preferences: DEFAULT_USER_PREFERENCES,
      version: 1
    };

    const result = validatePersistedSettings(invalidSettings);
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('server ID'))).toBe(true);
  });

  test('should provide warnings for missing optional fields', () => {
    const settingsWithMissingOptional = {
      currentServerId: 'mac-mini',
      currentLanguage: 'ja' as const,
      // Missing serverHistory, preferences, version
    };

    const result = validatePersistedSettings(settingsWithMissingOptional);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});