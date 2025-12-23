/**
 * Native Settings Module TypeScript Bindings
 * 
 * This file provides TypeScript bindings for the iOS Native Settings Module,
 * enabling type-safe access to iOS Settings app configuration from React Native.
 */

import { NativeModules } from 'react-native';

// Type definitions for native settings
export interface NativeSettings {
  backendServerAddress: string;
  customServerAddress: string;
  connectionTimeout: number;
  autoSwitchOnFailure: boolean;
  enableDetailedLogging: boolean;
  appVersion: string;
}

export interface EffectiveServerConfig {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  wsUrl: string;
  description: string;
  isDefault: boolean;
  isCustomServer: boolean;
  healthCheckEndpoints: string[];
  connectionTimeout: number;
  retryAttempts: number;
  metadata: {
    source: string;
    environment: string;
    capabilities: string[];
  };
}

// Native module interface
interface NativeSettingsModuleInterface {
  // Constants exported from native module
  SETTINGS_KEYS: {
    BACKEND_SERVER_ADDRESS: string;
    CUSTOM_SERVER_ADDRESS: string;
    CONNECTION_TIMEOUT: string;
    AUTO_SWITCH_ON_FAILURE: string;
    ENABLE_DETAILED_LOGGING: string;
    APP_VERSION: string;
  };
  
  DEFAULT_VALUES: {
    BACKEND_SERVER_ADDRESS: string;
    CUSTOM_SERVER_ADDRESS: string;
    CONNECTION_TIMEOUT: number;
    AUTO_SWITCH_ON_FAILURE: boolean;
    ENABLE_DETAILED_LOGGING: boolean;
  };

  // Methods
  readAllSettings(): Promise<NativeSettings>;
  getEffectiveServerConfig(): Promise<EffectiveServerConfig>;
  registerDefaultValues(): Promise<boolean>;
}

// Get the native module
const NativeSettingsModule = NativeModules.NativeSettingsModule as NativeSettingsModuleInterface;

// Validate that the native module is available
if (!NativeSettingsModule) {
  console.warn(
    'NativeSettingsModule is not available. Make sure the native module is properly linked and the app is running on iOS.'
  );
}

// Export the module with error handling wrappers
export class NativeSettingsService {
  private static instance: NativeSettingsService;
  
  public static getInstance(): NativeSettingsService {
    if (!NativeSettingsService.instance) {
      NativeSettingsService.instance = new NativeSettingsService();
    }
    return NativeSettingsService.instance;
  }

  private constructor() {
    // Initialize default values on construction
    this.initializeDefaults().catch(error => {
      console.warn('[NativeSettingsService] Failed to initialize defaults:', error);
    });
  }

  /**
   * Initialize default values in iOS Settings
   */
  private async initializeDefaults(): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('[NativeSettingsService] Native module not available, skipping initialization');
      return;
    }

    try {
      await NativeSettingsModule.registerDefaultValues();
      console.log('[NativeSettingsService] ✅ Default values registered');
    } catch (error) {
      console.error('[NativeSettingsService] ❌ Failed to register defaults:', error);
      throw error;
    }
  }

  /**
   * Read all settings from iOS Settings app
   */
  async readAllSettings(): Promise<NativeSettings> {
    if (!this.isAvailable()) {
      throw new Error('NativeSettingsModule is not available');
    }

    try {
      const settings = await NativeSettingsModule.readAllSettings();
      console.log('[NativeSettingsService] ✅ Read all settings:', settings);
      return settings;
    } catch (error) {
      console.error('[NativeSettingsService] ❌ Failed to read all settings:', error);
      throw new Error(`Failed to read iOS Settings: ${error}`);
    }
  }

  /**
   * Get the effective server configuration based on iOS Settings
   */
  async getEffectiveServerConfig(): Promise<EffectiveServerConfig> {
    if (!this.isAvailable()) {
      throw new Error('NativeSettingsModule is not available');
    }

    try {
      const config = await NativeSettingsModule.getEffectiveServerConfig();
      console.log('[NativeSettingsService] ✅ Got effective server config:', config);
      return config;
    } catch (error) {
      console.error('[NativeSettingsService] ❌ Failed to get server config:', error);
      throw new Error(`Failed to get server configuration: ${error}`);
    }
  }

  /**
   * Get settings keys constants
   */
  getSettingsKeys() {
    if (!this.isAvailable()) {
      return null;
    }
    return NativeSettingsModule.SETTINGS_KEYS;
  }

  /**
   * Get default values constants
   */
  getDefaultValues() {
    if (!this.isAvailable()) {
      return null;
    }
    return NativeSettingsModule.DEFAULT_VALUES;
  }

  /**
   * Check if the native module is available
   */
  isAvailable(): boolean {
    return !!NativeSettingsModule;
  }
}

// Export singleton instance
export const nativeSettingsModule = NativeSettingsService.getInstance();

// Export types and constants
export { NativeSettingsModule };
export default nativeSettingsModule;