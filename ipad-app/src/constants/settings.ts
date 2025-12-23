/**
 * Settings Constants and Default Values
 * 
 * This file contains default configurations, constants, and fallback values
 * for the backend switching and settings functionality.
 */

import { Language } from '../types/app';
import { 
  UserPreferences, 
  ServerSwitchState, 
  PersistedSettings,
  AVAILABLE_LANGUAGES,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_SWITCH_STATE
} from '../types/settings';
import { getDefaultServer } from '../config/servers';

/**
 * Settings storage key for AsyncStorage
 */
export const SETTINGS_STORAGE_KEY = 'verbumcare_settings';

/**
 * Settings version for migration compatibility
 */
export const SETTINGS_VERSION = 1;

/**
 * Default language for the application
 */
export const DEFAULT_LANGUAGE: Language = 'ja';

/**
 * Connection test configuration
 */
export const CONNECTION_TEST_CONFIG = {
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second between retries
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds for periodic checks
  CONCURRENT_TESTS: 3, // Maximum concurrent health check tests
};

/**
 * Server switching configuration with enhanced error handling
 */
export const SERVER_SWITCH_CONFIG = {
  CONFIRMATION_TIMEOUT: 30000, // 30 seconds to confirm switch
  ROLLBACK_TIMEOUT: 5000, // 5 seconds before rollback on failure
  CACHE_CLEAR_DELAY: 1000, // 1 second delay before clearing cache
  AUTH_REESTABLISH_TIMEOUT: 15000, // 15 seconds for auth re-establishment
  MAX_RETRY_ATTEMPTS: 3, // Maximum retry attempts for server switch
  RETRY_BASE_DELAY: 2000, // Base delay for exponential backoff (2 seconds)
  RETRY_MAX_DELAY: 10000, // Maximum retry delay (10 seconds)
  ENABLE_GRACEFUL_FALLBACK: true, // Enable automatic fallback on failure
  PRESERVE_USER_DATA: true, // Preserve user data during switches
};

/**
 * Error handling configuration
 */
export const ERROR_HANDLING_CONFIG = {
  ENABLE_ENHANCED_ERRORS: true, // Enable enhanced error information
  ENABLE_RETRY_LOGIC: true, // Enable automatic retries
  ENABLE_FALLBACK_STRATEGIES: true, // Enable fallback mechanisms
  LOG_ERROR_DETAILS: __DEV__, // Log detailed error information in development
  SHOW_SUGGESTED_ACTIONS: true, // Show suggested recovery actions to users
  TIMEOUT_GRACE_PERIOD: 2000, // Grace period before timeout (2 seconds)
};

/**
 * UI configuration for settings screen
 */
export const SETTINGS_UI_CONFIG = {
  LOADING_DEBOUNCE: 300, // ms to debounce loading states
  ERROR_DISPLAY_DURATION: 5000, // 5 seconds to show error messages
  SUCCESS_DISPLAY_DURATION: 3000, // 3 seconds to show success messages
  PROGRESS_UPDATE_INTERVAL: 500, // 500ms between progress updates
};

/**
 * Default persisted settings
 */
export const DEFAULT_PERSISTED_SETTINGS: PersistedSettings = {
  currentServerId: getDefaultServer().id,
  currentLanguage: DEFAULT_LANGUAGE,
  serverHistory: [],
  preferences: DEFAULT_USER_PREFERENCES,
  version: SETTINGS_VERSION,
};

/**
 * Settings validation rules
 */
export const SETTINGS_VALIDATION_RULES = {
  SERVER_ID_MAX_LENGTH: 50,
  LANGUAGE_REQUIRED: true,
  HISTORY_MAX_ENTRIES: 100,
  PREFERENCES_REQUIRED_FIELDS: ['autoSwitchOnFailure', 'showServerIndicator', 'confirmServerSwitches'],
};

/**
 * Error messages for settings operations with enhanced descriptions
 */
export const SETTINGS_ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load settings from storage',
  SAVE_FAILED: 'Failed to save settings to storage',
  INVALID_SERVER: 'Invalid server configuration',
  CONNECTION_FAILED: 'Failed to connect to server',
  SWITCH_FAILED: 'Server switch operation failed',
  VALIDATION_FAILED: 'Settings validation failed',
  TIMEOUT: 'Operation timed out',
  NETWORK_ERROR: 'Network connection error',
  AUTH_FAILED: 'Authentication failed on new server',
  ROLLBACK_FAILED: 'Failed to rollback to previous server',
  CACHE_ERROR: 'Cache operation failed',
  SERVER_UNAVAILABLE: 'Server is currently unavailable',
  CONFIGURATION_ERROR: 'Server configuration is invalid',
  RETRY_EXHAUSTED: 'Maximum retry attempts exceeded',
  FALLBACK_FAILED: 'Fallback operation failed',
  DATA_LOSS_PREVENTED: 'Operation cancelled to prevent data loss',
};

/**
 * Success messages for settings operations
 */
export const SETTINGS_SUCCESS_MESSAGES = {
  SETTINGS_LOADED: 'Settings loaded successfully',
  SETTINGS_SAVED: 'Settings saved successfully',
  SERVER_SWITCHED: 'Successfully switched to {serverName}',
  LANGUAGE_CHANGED: 'Language changed to {languageName}',
  CONNECTION_RESTORED: 'Connection restored',
  PREFERENCES_UPDATED: 'Preferences updated successfully',
};

/**
 * Progress messages for server switching with enhanced feedback
 */
export const SWITCH_PROGRESS_MESSAGES = {
  STARTING: 'Starting server switch...',
  TESTING_CONNECTION: 'Testing connection to new server...',
  CLEARING_CACHE: 'Clearing cached data...',
  UPDATING_CONFIG: 'Updating API configuration...',
  REESTABLISHING_AUTH: 'Re-establishing authentication...',
  FINALIZING: 'Finalizing server switch...',
  COMPLETED: 'Server switch completed successfully',
  ROLLING_BACK: 'Rolling back to previous server...',
  FAILED: 'Server switch failed',
  RETRYING: 'Retrying server switch...',
  FALLBACK_INITIATED: 'Initiating fallback to previous server...',
  PRESERVING_DATA: 'Preserving user data...',
  VALIDATING_CONFIG: 'Validating server configuration...',
  TIMEOUT_WARNING: 'Operation is taking longer than expected...',
};

/**
 * Server status indicators
 */
export const SERVER_STATUS_CONFIG = {
  INDICATOR_SIZE: 12, // pixels
  COLORS: {
    CONNECTED: '#5B8558', // Healthcare Green
    DISCONNECTED: '#EF5350', // Medical Red
    TESTING: '#FFA726', // Warm Amber
    SWITCHING: '#5A7A8C', // Navy Light
    ERROR: '#EF5350', // Medical Red
  },
  ANIMATION_DURATION: 300, // ms for status transitions
  PULSE_DURATION: 2000, // ms for pulse animation when testing
};

/**
 * Language switching configuration
 */
export const LANGUAGE_SWITCH_CONFIG = {
  IMMEDIATE_UPDATE: true, // Update UI immediately without restart
  PERSIST_DELAY: 500, // ms delay before persisting to storage
  TRANSLATION_CACHE_SIZE: 1000, // Maximum cached translations
};

/**
 * Logging configuration for settings operations
 */
export const SETTINGS_LOGGING_CONFIG = {
  ENABLED: __DEV__, // Only enable in development
  MAX_LOG_ENTRIES: 500,
  LOG_LEVELS: ['error', 'warn', 'info', 'debug'] as const,
  SENSITIVE_FIELDS: ['password', 'token', 'key'], // Fields to redact in logs
};

/**
 * Feature flags for settings functionality
 */
export const SETTINGS_FEATURE_FLAGS = {
  ENABLE_AUTO_SWITCH: true,
  ENABLE_DETAILED_LOGGING: __DEV__,
  ENABLE_SERVER_HISTORY: true,
  ENABLE_CONNECTION_MONITORING: true,
  ENABLE_OFFLINE_MODE: true,
};

/**
 * Get localized error message
 */
export function getLocalizedErrorMessage(errorKey: keyof typeof SETTINGS_ERROR_MESSAGES, language: Language = DEFAULT_LANGUAGE): string {
  // For now, return English messages. In a full implementation, this would
  // integrate with the translation system.
  return SETTINGS_ERROR_MESSAGES[errorKey];
}

/**
 * Get localized success message with interpolation
 */
export function getLocalizedSuccessMessage(
  messageKey: keyof typeof SETTINGS_SUCCESS_MESSAGES, 
  interpolations: Record<string, string> = {},
  language: Language = DEFAULT_LANGUAGE
): string {
  let message = SETTINGS_SUCCESS_MESSAGES[messageKey];
  
  // Simple interpolation
  Object.entries(interpolations).forEach(([key, value]) => {
    message = message.replace(`{${key}}`, value);
  });
  
  return message;
}

/**
 * Validate settings constants at runtime
 */
export function validateSettingsConstants(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!AVAILABLE_LANGUAGES.includes(DEFAULT_LANGUAGE)) {
    errors.push(`Default language '${DEFAULT_LANGUAGE}' is not in available languages`);
  }

  if (CONNECTION_TEST_CONFIG.TIMEOUT <= 0) {
    errors.push('Connection test timeout must be positive');
  }

  if (CONNECTION_TEST_CONFIG.RETRY_ATTEMPTS < 0) {
    errors.push('Retry attempts cannot be negative');
  }

  if (SETTINGS_VERSION <= 0) {
    errors.push('Settings version must be positive');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}