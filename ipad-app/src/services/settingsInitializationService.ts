/**
 * Settings Initialization Service
 * 
 * Handles the initialization of settings on app startup, including:
 * - Loading saved settings from AsyncStorage
 * - Setting default server based on current configuration
 * - Handling missing or corrupted settings gracefully
 * - Migrating settings between versions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../stores/settingsStore';
import { 
  PersistedSettings, 
  validatePersistedSettings, 
  DEFAULT_USER_PREFERENCES,
  AVAILABLE_LANGUAGES,
  SettingsValidationResult
} from '../types/settings';
import { 
  SETTINGS_STORAGE_KEY, 
  DEFAULT_PERSISTED_SETTINGS, 
  SETTINGS_VERSION,
  DEFAULT_LANGUAGE,
  SETTINGS_ERROR_MESSAGES,
  validateSettingsConstants
} from '../constants/settings';
import { getDefaultServer, getServerById, AVAILABLE_SERVERS } from '../config/servers';
import { Language } from '../types/app';

/**
 * Settings initialization result
 */
export interface SettingsInitializationResult {
  success: boolean;
  settings: PersistedSettings;
  isFirstRun: boolean;
  migrationPerformed: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Settings migration result
 */
interface SettingsMigrationResult {
  success: boolean;
  migratedSettings: PersistedSettings;
  warnings: string[];
  errors: string[];
}

/**
 * Settings initialization service
 */
class SettingsInitializationService {
  private initialized = false;
  private initializationPromise: Promise<SettingsInitializationResult> | null = null;

  /**
   * Initialize settings on app startup
   */
  async initialize(): Promise<SettingsInitializationResult> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform the actual settings initialization
   */
  private async performInitialization(): Promise<SettingsInitializationResult> {
    console.log('[SettingsInit] Starting settings initialization...');

    try {
      // First, validate our constants and configuration
      const constantsValidation = validateSettingsConstants();
      if (!constantsValidation.valid) {
        console.error('[SettingsInit] Invalid settings constants:', constantsValidation.errors);
        throw new Error(`Settings constants validation failed: ${constantsValidation.errors.join(', ')}`);
      }

      // Validate server configuration
      const serverValidationErrors = this.validateServerConfiguration();
      if (serverValidationErrors.length > 0) {
        console.error('[SettingsInit] Invalid server configuration:', serverValidationErrors);
        throw new Error(`Server configuration validation failed: ${serverValidationErrors.join(', ')}`);
      }

      // CRITICAL: Load server configuration from iOS Settings FIRST
      // This ensures iOS Settings takes priority over AsyncStorage
      console.log('[SettingsInit] Loading server configuration from iOS Settings...');
      try {
        await useSettingsStore.getState().loadServerFromNativeSettings();
        console.log('[SettingsInit] ✅ iOS Settings server configuration loaded');
      } catch (error: any) {
        console.warn('[SettingsInit] ⚠️ Failed to load iOS Settings, will use fallback:', error.message);
      }

      // Try to load existing settings from AsyncStorage (for language, preferences, etc.)
      const loadResult = await this.loadExistingSettings();
      
      if (loadResult.success && loadResult.settings) {
        // Settings loaded successfully
        console.log('[SettingsInit] ✅ Settings loaded successfully');
        this.initialized = true;
        
        return {
          success: true,
          settings: loadResult.settings,
          isFirstRun: false,
          migrationPerformed: loadResult.migrationPerformed,
          warnings: loadResult.warnings,
          errors: []
        };
      } else {
        // No existing settings or corrupted settings - create defaults
        console.log('[SettingsInit] No valid existing settings found, creating defaults...');
        
        const defaultSettings = await this.createDefaultSettings();
        await this.saveSettings(defaultSettings);
        
        console.log('[SettingsInit] ✅ Default settings created and saved');
        this.initialized = true;
        
        return {
          success: true,
          settings: defaultSettings,
          isFirstRun: true,
          migrationPerformed: false,
          warnings: loadResult.warnings,
          errors: loadResult.errors
        };
      }

    } catch (error: any) {
      console.error('[SettingsInit] ❌ Settings initialization failed:', error);
      
      // Create emergency fallback settings
      const fallbackSettings = this.createEmergencyFallbackSettings();
      
      return {
        success: false,
        settings: fallbackSettings,
        isFirstRun: true,
        migrationPerformed: false,
        warnings: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Load existing settings from AsyncStorage
   */
  private async loadExistingSettings(): Promise<{
    success: boolean;
    settings?: PersistedSettings;
    migrationPerformed: boolean;
    warnings: string[];
    errors: string[];
  }> {
    try {
      const storedData = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      
      if (!storedData) {
        console.log('[SettingsInit] No stored settings found');
        return {
          success: false,
          migrationPerformed: false,
          warnings: [],
          errors: []
        };
      }

      // Parse stored settings
      let parsedSettings: any;
      try {
        parsedSettings = JSON.parse(storedData);
      } catch (parseError: any) {
        console.error('[SettingsInit] Failed to parse stored settings:', parseError);
        return {
          success: false,
          migrationPerformed: false,
          warnings: [],
          errors: [`Failed to parse stored settings: ${parseError.message}`]
        };
      }

      // Validate parsed settings
      const validation = validatePersistedSettings(parsedSettings);
      
      if (!validation.valid) {
        console.warn('[SettingsInit] Stored settings validation failed:', validation.errors);
        return {
          success: false,
          migrationPerformed: false,
          warnings: validation.warnings,
          errors: validation.errors
        };
      }

      // Check if migration is needed
      const migrationResult = await this.migrateSettingsIfNeeded(parsedSettings);
      
      if (!migrationResult.success) {
        console.error('[SettingsInit] Settings migration failed:', migrationResult.errors);
        return {
          success: false,
          migrationPerformed: false,
          warnings: migrationResult.warnings,
          errors: migrationResult.errors
        };
      }

      // Apply additional validation and sanitization
      const sanitizedSettings = this.sanitizeSettings(migrationResult.migratedSettings);

      return {
        success: true,
        settings: sanitizedSettings,
        migrationPerformed: migrationResult.migratedSettings !== parsedSettings,
        warnings: [...validation.warnings, ...migrationResult.warnings],
        errors: []
      };

    } catch (error: any) {
      console.error('[SettingsInit] Error loading existing settings:', error);
      // This is a critical error - AsyncStorage is not working
      throw error; // Re-throw to be handled by the main initialization
    }
  }

  /**
   * Migrate settings if needed
   */
  private async migrateSettingsIfNeeded(settings: any): Promise<SettingsMigrationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Check version
      const currentVersion = settings.version || 0;
      
      if (currentVersion === SETTINGS_VERSION) {
        // No migration needed
        return {
          success: true,
          migratedSettings: settings,
          warnings,
          errors
        };
      }

      console.log(`[SettingsInit] Migrating settings from version ${currentVersion} to ${SETTINGS_VERSION}`);

      // Perform version-specific migrations
      let migratedSettings = { ...settings };

      if (currentVersion < 1) {
        // Migration from version 0 to 1
        migratedSettings = this.migrateToVersion1(migratedSettings, warnings);
      }

      // Update version
      migratedSettings.version = SETTINGS_VERSION;

      console.log('[SettingsInit] ✅ Settings migration completed');

      return {
        success: true,
        migratedSettings,
        warnings,
        errors
      };

    } catch (error: any) {
      console.error('[SettingsInit] Settings migration failed:', error);
      return {
        success: false,
        migratedSettings: settings,
        warnings,
        errors: [error.message]
      };
    }
  }

  /**
   * Migrate settings to version 1
   */
  private migrateToVersion1(settings: any, warnings: string[]): PersistedSettings {
    console.log('[SettingsInit] Performing migration to version 1...');

    // Ensure all required fields exist with defaults
    const migratedSettings: PersistedSettings = {
      currentServerId: settings.currentServerId || getDefaultServer().id,
      currentLanguage: this.validateLanguage(settings.currentLanguage) || DEFAULT_LANGUAGE,
      serverHistory: Array.isArray(settings.serverHistory) ? settings.serverHistory : [],
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        ...(settings.preferences || {})
      },
      version: 1
    };

    // Validate server ID exists
    if (!getServerById(migratedSettings.currentServerId)) {
      warnings.push(`Invalid server ID '${migratedSettings.currentServerId}', using default`);
      migratedSettings.currentServerId = getDefaultServer().id;
    }

    // Clean up server history
    migratedSettings.serverHistory = migratedSettings.serverHistory
      .filter(entry => entry && typeof entry === 'object' && entry.serverId)
      .slice(0, 10); // Keep only last 10 entries

    return migratedSettings;
  }

  /**
   * Create default settings
   */
  private async createDefaultSettings(): Promise<PersistedSettings> {
    console.log('[SettingsInit] Creating default settings...');

    const defaultServer = getDefaultServer();
    
    const defaultSettings: PersistedSettings = {
      currentServerId: defaultServer.id,
      currentLanguage: DEFAULT_LANGUAGE,
      serverHistory: [],
      preferences: { ...DEFAULT_USER_PREFERENCES },
      version: SETTINGS_VERSION
    };

    console.log('[SettingsInit] Default settings created:', {
      server: defaultServer.displayName,
      language: defaultSettings.currentLanguage,
      version: defaultSettings.version
    });

    return defaultSettings;
  }

  /**
   * Create emergency fallback settings (when everything else fails)
   */
  private createEmergencyFallbackSettings(): PersistedSettings {
    console.log('[SettingsInit] Creating emergency fallback settings...');

    // Use hardcoded values as last resort
    return {
      currentServerId: 'mac-mini', // Hardcoded fallback
      currentLanguage: 'ja', // Hardcoded fallback
      serverHistory: [],
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
      version: SETTINGS_VERSION
    };
  }

  /**
   * Sanitize and validate settings
   */
  private sanitizeSettings(settings: PersistedSettings): PersistedSettings {
    return {
      ...settings,
      currentServerId: getServerById(settings.currentServerId)?.id || getDefaultServer().id,
      currentLanguage: this.validateLanguage(settings.currentLanguage) || DEFAULT_LANGUAGE,
      serverHistory: (settings.serverHistory || [])
        .filter(entry => entry && typeof entry === 'object' && entry.serverId)
        .slice(0, 10),
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        ...settings.preferences
      }
    };
  }

  /**
   * Validate language
   */
  private validateLanguage(language: any): Language | null {
    if (typeof language === 'string' && AVAILABLE_LANGUAGES.includes(language as Language)) {
      return language as Language;
    }
    return null;
  }

  /**
   * Validate server configuration
   */
  private validateServerConfiguration(): string[] {
    const errors: string[] = [];

    if (!AVAILABLE_SERVERS || AVAILABLE_SERVERS.length === 0) {
      errors.push('No servers configured');
      return errors;
    }

    const defaultServers = AVAILABLE_SERVERS.filter(server => server.isDefault);
    if (defaultServers.length === 0) {
      errors.push('No default server configured');
    } else if (defaultServers.length > 1) {
      errors.push('Multiple default servers configured');
    }

    // Validate each server
    AVAILABLE_SERVERS.forEach((server, index) => {
      if (!server.id) {
        errors.push(`Server at index ${index} has no ID`);
      }
      if (!server.baseUrl) {
        errors.push(`Server '${server.id}' has no base URL`);
      }
      if (!server.healthCheckEndpoints || server.healthCheckEndpoints.length === 0) {
        errors.push(`Server '${server.id}' has no health check endpoints`);
      }
    });

    return errors;
  }

  /**
   * Save settings to AsyncStorage
   */
  private async saveSettings(settings: PersistedSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      console.log('[SettingsInit] Settings saved to AsyncStorage');
    } catch (error: any) {
      console.error('[SettingsInit] Failed to save settings:', error);
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  /**
   * Check if settings are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset initialization state (for testing)
   */
  reset(): void {
    this.initialized = false;
    this.initializationPromise = null;
  }
}

// Export singleton instance
export const settingsInitializationService = new SettingsInitializationService();