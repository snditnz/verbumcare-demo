/**
 * Settings Types for Backend Switching and Configuration
 */

import { ServerConfig } from '../config/servers';
import { Language } from './app';

/**
 * Connection status for a server
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'testing' | 'switching' | 'error';

/**
 * Connection test result for a specific endpoint
 */
export interface HealthCheckResult {
  endpoint: string;
  status: 'success' | 'failure';
  responseTime?: number;
  error?: string;
}

/**
 * Detailed connection status with health check results
 */
export interface DetailedConnectionStatus {
  serverId: string;
  status: ConnectionStatus;
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
  healthChecks: HealthCheckResult[];
}

/**
 * Settings persistence model
 */
export interface PersistedSettings {
  currentServerId: string;
  currentLanguage: Language;
  serverHistory: ServerHistoryEntry[];
  preferences: UserPreferences;
  version: number; // For migration compatibility
}

/**
 * Server usage history entry
 */
export interface ServerHistoryEntry {
  serverId: string;
  lastUsed: Date;
  successful: boolean;
  duration?: number; // How long the connection lasted (ms)
}

/**
 * User preferences for settings behavior
 */
export interface UserPreferences {
  autoSwitchOnFailure: boolean;
  showServerIndicator: boolean;
  confirmServerSwitches: boolean;
  connectionTestTimeout: number; // ms
  enableDetailedLogging: boolean;
  maxRetryAttempts: number; // Maximum retry attempts for operations
  enableGracefulFallback: boolean; // Enable automatic fallback on failures
  preserveDataOnFailure: boolean; // Preserve user data during failures
  showSuggestedActions: boolean; // Show recovery suggestions in error messages
}

/**
 * Server switching operation state
 */
export interface ServerSwitchState {
  isInProgress: boolean;
  fromServerId?: string;
  toServerId?: string;
  progress: string; // Human-readable progress message
  startedAt?: Date;
  error?: string;
}

/**
 * Settings store state interface
 */
export interface SettingsState {
  // Server configuration
  currentServer: ServerConfig;
  availableServers: ServerConfig[];
  connectionStatus: ConnectionStatus;
  detailedStatus?: DetailedConnectionStatus;
  serverSource: 'ios_settings' | 'fallback';
  
  // Language settings
  currentLanguage: Language;
  availableLanguages: Language[];
  
  // UI state
  serverSwitchState: ServerSwitchState;
  lastError: string | null;
  
  // User preferences
  preferences: UserPreferences;
  
  // History
  serverHistory: ServerHistoryEntry[];
}

/**
 * Settings store actions interface
 */
export interface SettingsActions {
  // Server management
  switchServer: (serverId: string) => Promise<boolean>;
  loadServerFromNativeSettings: () => Promise<void>;
  refreshServerConfig: () => Promise<void>;
  testServerConnectivity: (serverId: string) => Promise<DetailedConnectionStatus>;
  refreshConnectionStatus: () => Promise<void>;
  openIOSSettings: () => void;
  
  // Language management
  setLanguage: (language: Language) => Promise<void>;
  
  // Settings persistence
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  initializeWithDefaults: () => Promise<void>;
  
  // Preferences
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  
  // Error handling
  clearError: () => void;
  setError: (error: string) => void;
  
  // Offline mode support
  getOfflineStatus: () => {
    isOnline: boolean;
    queueStatus: any;
    lastKnownConfig: any;
    offlineFunctionalityAvailable: boolean;
    offlineEditingAvailable: boolean;
  };
  
  // Queue management
  clearOfflineQueue: () => Promise<void>;
  processOfflineQueue: () => Promise<void>;
}

/**
 * Default user preferences
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  autoSwitchOnFailure: false,
  showServerIndicator: true,
  confirmServerSwitches: true,
  connectionTestTimeout: 10000, // 10 seconds
  enableDetailedLogging: false,
  maxRetryAttempts: 3,
  enableGracefulFallback: true,
  preserveDataOnFailure: true,
  showSuggestedActions: true,
};

/**
 * Default server switch state
 */
export const DEFAULT_SWITCH_STATE: ServerSwitchState = {
  isInProgress: false,
  progress: '',
};

/**
 * Available languages for the application
 */
export const AVAILABLE_LANGUAGES: Language[] = ['ja', 'en', 'zh-TW'];

/**
 * Language display names
 */
export const LANGUAGE_DISPLAY_NAMES: Record<Language, string> = {
  'ja': '日本語',
  'en': 'English',
  'zh-TW': '繁體中文',
};

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate persisted settings
 */
export function validatePersistedSettings(settings: any): SettingsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!settings) {
    errors.push('Settings object is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!settings.currentServerId || typeof settings.currentServerId !== 'string') {
    errors.push('Current server ID is required and must be a string');
  }

  if (!settings.currentLanguage || !AVAILABLE_LANGUAGES.includes(settings.currentLanguage)) {
    errors.push('Current language must be one of: ' + AVAILABLE_LANGUAGES.join(', '));
  }

  if (!Array.isArray(settings.serverHistory)) {
    warnings.push('Server history should be an array, will be reset');
  }

  if (!settings.preferences || typeof settings.preferences !== 'object') {
    warnings.push('Preferences should be an object, will use defaults');
  }

  if (typeof settings.version !== 'number') {
    warnings.push('Settings version should be a number, will use current version');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}