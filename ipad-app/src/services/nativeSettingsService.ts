/**
 * Native Settings Service
 * 
 * This service reads backend server configuration from the iOS Settings app
 * and integrates it with the app's internal settings system.
 * 
 * CRITICAL: This allows users to configure backend servers BEFORE login,
 * which is essential since login depends on backend connectivity.
 * 
 * Updated to use actual iOS Settings integration via native module.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import axios from 'axios';
import { ServerConfig, getServerById, getDefaultServer } from '../config/servers';
import { 
  nativeSettingsModule, 
  NativeSettings as NativeSettingsType
} from './NativeSettingsModule';

// Storage key for native settings cache (fallback only)
const NATIVE_SETTINGS_CACHE_KEY = '@VerbumCare:NativeSettings';

// Local interface for internal use (without appVersion)
export interface NativeSettingsInternal {
  backendServerAddress: string;
  customServerAddress?: string;
  connectionTimeout: number;
  autoSwitchOnFailure: boolean;
  enableDetailedLogging: boolean;
}

export interface NativeSettingsResult {
  success: boolean;
  settings?: NativeSettingsInternal;
  serverConfig?: ServerConfig;
  error?: string;
  isCustomServer?: boolean;
  source: 'ios_settings' | 'cache' | 'default';
}

class NativeSettingsService {
  private cachedSettings: NativeSettingsInternal | null = null;
  private lastReadTime: number = 0;
  private readonly CACHE_DURATION = 5000; // 5 seconds cache

  /**
   * Read settings from iOS Settings app using native module
   * Falls back to cached values if native settings are not available
   */
  async readNativeSettings(): Promise<NativeSettingsResult> {
    try {
      // Check cache first (avoid excessive native calls)
      if (this.cachedSettings && (Date.now() - this.lastReadTime) < this.CACHE_DURATION) {
        return this.processSettings(this.cachedSettings, 'cache');
      }

      // Try to read from iOS Settings app via native module
      if (Platform.OS === 'ios' && nativeSettingsModule.isAvailable()) {
        try {
          const nativeSettings = await nativeSettingsModule.readAllSettings();
          
          if (nativeSettings) {
            // Convert native settings format to our internal format
            const convertedSettings: NativeSettingsInternal = {
              backendServerAddress: nativeSettings.backendServerAddress,
              customServerAddress: nativeSettings.customServerAddress,
              connectionTimeout: nativeSettings.connectionTimeout,
              autoSwitchOnFailure: nativeSettings.autoSwitchOnFailure,
              enableDetailedLogging: nativeSettings.enableDetailedLogging,
            };

            this.cachedSettings = convertedSettings;
            this.lastReadTime = Date.now();
            
            // Cache the settings for faster subsequent reads
            await AsyncStorage.setItem(NATIVE_SETTINGS_CACHE_KEY, JSON.stringify(convertedSettings));
            
            return this.processSettings(convertedSettings, 'ios_settings');
          }
        } catch (nativeError) {
          console.warn('[NativeSettings] Native module failed, falling back to cache:', nativeError);
        }
      }

      // Fallback to cached settings from previous reads
      const cachedFromStorage = await AsyncStorage.getItem(NATIVE_SETTINGS_CACHE_KEY);
      if (cachedFromStorage) {
        const parsed = JSON.parse(cachedFromStorage);
        this.cachedSettings = parsed;
        return this.processSettings(parsed, 'cache');
      }

      // No settings available - return default
      return {
        success: false,
        error: 'No native settings available, using app defaults',
        source: 'default'
      };

    } catch (error: any) {
      console.error('[NativeSettings] Failed to read native settings:', error);
      return {
        success: false,
        error: `Failed to read native settings: ${error.message}`,
        source: 'default'
      };
    }
  }



  /**
   * Process native settings and determine server configuration
   */
  private processSettings(settings: NativeSettingsInternal, source: 'ios_settings' | 'cache' | 'default'): NativeSettingsResult {
    try {
      // Check if using custom server URL
      if (settings.backendServerAddress === '__CUSTOM__' && settings.customServerAddress && settings.customServerAddress.trim()) {
        const customUrl = settings.customServerAddress.trim();
        
        // Validate custom URL
        try {
          new URL(customUrl);
        } catch {
          return {
            success: false,
            error: `Invalid custom server URL: ${customUrl}`,
            source
          };
        }

        // Create custom server config
        const customServerConfig: ServerConfig = {
          id: 'custom',
          name: 'custom-server',
          displayName: 'Custom Server',
          baseUrl: customUrl,
          wsUrl: customUrl.replace('http', 'ws'),
          description: 'Custom server configured in iOS Settings',
          isDefault: false,
          healthCheckEndpoints: ['/health'],
          connectionTimeout: settings.connectionTimeout * 1000, // Convert to ms
          retryAttempts: settings.autoSwitchOnFailure ? 3 : 1,
          metadata: {
            environment: 'development' as const, // Use valid environment type
            capabilities: ['custom-configured']
          }
        };

        return {
          success: true,
          settings,
          serverConfig: customServerConfig,
          isCustomServer: true,
          source
        };
      }

      // Use predefined server - map address to server ID
      let serverId: string;
      switch (settings.backendServerAddress) {
        case 'https://verbumcare-lab.local/api':
          serverId = 'pn51';
          break;
        case 'https://verbumcarenomac-mini.local/api':
          serverId = 'mac-mini';
          break;
        case 'https://verbumcaremac-mini.tail609750.ts.net/api':
          serverId = 'mac-mini-tailscale';
          break;
        default:
          serverId = 'pn51'; // Default fallback
          break;
      }

      const serverConfig = getServerById(serverId);
      if (!serverConfig) {
        return {
          success: false,
          error: `Unknown server ID from native settings: ${serverId}`,
          source
        };
      }

      // Apply native settings to server config
      const enhancedServerConfig: ServerConfig = {
        ...serverConfig,
        connectionTimeout: settings.connectionTimeout * 1000, // Convert to ms
        retryAttempts: settings.autoSwitchOnFailure ? 3 : 1,
      };

      return {
        success: true,
        settings,
        serverConfig: enhancedServerConfig,
        isCustomServer: false,
        source
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to process native settings: ${error.message}`,
        source
      };
    }
  }



  /**
   * Get the effective server configuration considering native settings
   * This is the main method that should be called during app initialization
   */
  async getEffectiveServerConfig(): Promise<ServerConfig> {
    // Try to use native module directly for better performance
    if (Platform.OS === 'ios' && nativeSettingsModule.isAvailable()) {
      try {
        const effectiveConfig = await nativeSettingsModule.getEffectiveServerConfig();
        
        // Convert native config to our ServerConfig format
        const serverConfig: ServerConfig = {
          id: effectiveConfig.id,
          name: effectiveConfig.name,
          displayName: effectiveConfig.displayName,
          baseUrl: effectiveConfig.baseUrl,
          wsUrl: effectiveConfig.wsUrl,
          description: effectiveConfig.description,
          isDefault: effectiveConfig.isDefault,
          healthCheckEndpoints: effectiveConfig.healthCheckEndpoints,
          connectionTimeout: effectiveConfig.connectionTimeout,
          retryAttempts: effectiveConfig.retryAttempts,
          metadata: {
            environment: effectiveConfig.metadata.environment as 'production' | 'staging' | 'development',
            capabilities: effectiveConfig.metadata.capabilities
          }
        };

        console.log(`[NativeSettings] ✅ Using server from iOS Settings: ${serverConfig.displayName}`);
        return serverConfig;
      } catch (error) {
        console.warn('[NativeSettings] Failed to get effective config from native module:', error);
      }
    }

    // Fallback to legacy method
    const nativeResult = await this.readNativeSettings();
    
    if (nativeResult.success && nativeResult.serverConfig) {
      console.log(`[NativeSettings] ✅ Using server from ${nativeResult.source}: ${nativeResult.serverConfig.displayName}`);
      return nativeResult.serverConfig;
    }

    // Fallback to default server
    const defaultServer = getDefaultServer();
    console.log(`[NativeSettings] ⚠️ Using default server (no iOS Settings): ${defaultServer.displayName}`);
    return defaultServer;
  }

  /**
   * Check if native settings override app settings
   */
  async hasNativeSettingsOverride(): Promise<boolean> {
    // Fallback to legacy method since native module doesn't have this method
    const result = await this.readNativeSettings();
    return result.success && result.source === 'ios_settings';
  }

  /**
   * Validate a server address using comprehensive validation
   */
  async validateServerAddress(address: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
    normalizedAddress: string;
  }> {
    // Use comprehensive validation since native module doesn't have this method
    return this.comprehensiveValidateServerAddress(address);
  }

  /**
   * Comprehensive server address validation with security checks
   */
  private comprehensiveValidateServerAddress(address: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
    normalizedAddress: string;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validation rules from design document
    const VALIDATION_RULES = {
      REQUIRED_PROTOCOL: ['https'],           // Only HTTPS allowed
      ALLOWED_PORTS: [443, 8443, 3000],     // Common secure ports
      MDNS_PATTERN: /\.local$/,              // mDNS hostname pattern
      IP_PATTERN: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      FORBIDDEN_HOSTS: ['localhost', '127.0.0.1', '0.0.0.0'],
      MAX_ADDRESS_LENGTH: 255,
      REQUIRED_PATH_SUFFIX: '/api'           // Must end with /api
    };

    try {
      // Basic format validation
      if (!address || address.trim().length === 0) {
        errors.push('Server address cannot be empty');
        suggestions.push('Enter a valid server address');
        return {
          valid: false,
          errors,
          warnings,
          suggestions,
          normalizedAddress: address
        };
      }

      const trimmedAddress = address.trim();
      
      // Length validation
      if (trimmedAddress.length > VALIDATION_RULES.MAX_ADDRESS_LENGTH) {
        errors.push(`Server address too long (max ${VALIDATION_RULES.MAX_ADDRESS_LENGTH} characters)`);
        return {
          valid: false,
          errors,
          warnings,
          suggestions,
          normalizedAddress: trimmedAddress
        };
      }

      // URL parsing
      let url: URL;
      try {
        url = new URL(trimmedAddress);
      } catch {
        errors.push('Invalid URL format');
        suggestions.push('Ensure the address starts with https:// or http://');
        suggestions.push('Example: https://verbumcare-lab.local/api');
        return {
          valid: false,
          errors,
          warnings,
          suggestions,
          normalizedAddress: trimmedAddress
        };
      }

      // Protocol validation (HTTPS only for production)
      if (!VALIDATION_RULES.REQUIRED_PROTOCOL.includes(url.protocol.slice(0, -1))) {
        errors.push('Only HTTPS protocol is allowed for security');
        suggestions.push('Change http:// to https://');
      }

      if (url.protocol === 'http:') {
        warnings.push('Using insecure HTTP protocol. HTTPS is strongly recommended');
        suggestions.push('Consider using https:// for better security');
      }

      // Hostname validation
      if (!url.hostname) {
        errors.push('Missing hostname');
        suggestions.push('Provide a valid hostname or IP address');
      } else {
        // Check for forbidden hosts
        if (VALIDATION_RULES.FORBIDDEN_HOSTS.includes(url.hostname.toLowerCase())) {
          errors.push(`Forbidden hostname: ${url.hostname}`);
          suggestions.push('Use a proper server hostname or IP address');
          suggestions.push('Localhost addresses are not allowed in production');
        }

        // Detect hostname type
        const isIP = VALIDATION_RULES.IP_PATTERN.test(url.hostname);
        const isMDNS = VALIDATION_RULES.MDNS_PATTERN.test(url.hostname);
        
        if (isMDNS) {
          warnings.push('Using mDNS hostname (.local) - ensure mDNS is supported on your network');
        }
        
        if (isIP) {
          warnings.push('Using IP address - consider using hostname for better reliability');
        }
      }

      // Port validation
      if (url.port) {
        const portNum = parseInt(url.port, 10);
        if (!VALIDATION_RULES.ALLOWED_PORTS.includes(portNum)) {
          warnings.push(`Unusual port ${portNum} - common secure ports are 443, 8443, 3000`);
        }
      }

      // Path validation
      if (!url.pathname.endsWith(VALIDATION_RULES.REQUIRED_PATH_SUFFIX)) {
        errors.push('Server address must end with /api');
        suggestions.push(`Add ${VALIDATION_RULES.REQUIRED_PATH_SUFFIX} to the end of the address`);
      }

      // Normalize the address
      let normalizedAddress = url.toString();
      
      // Ensure it ends with /api if not already
      if (!normalizedAddress.endsWith('/api')) {
        normalizedAddress = normalizedAddress.replace(/\/$/, '') + '/api';
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        normalizedAddress
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        suggestions: ['Check the server address format', 'Ensure the address is reachable'],
        normalizedAddress: address
      };
    }
  }

  /**
   * Add a custom server address (for testing/development)
   */
  async addCustomServer(address: string): Promise<boolean> {
    try {
      const validation = await this.validateServerAddress(address);
      
      if (!validation.valid) {
        console.error('[NativeSettings] Cannot add invalid server address:', validation.errors);
        return false;
      }

      // Test connectivity before accepting custom server
      console.log('[NativeSettings] Testing connectivity to custom server...');
      
      // Test connectivity using a simple HTTP request
      try {
        const response = await axios.get(`${validation.normalizedAddress}/health`, {
          timeout: 10000,
          httpsAgent: { rejectUnauthorized: false } as any,
        });
        
        if (response.status !== 200) {
          console.error('[NativeSettings] Custom server health check failed:', response.status);
          return false;
        }
        
        console.log('[NativeSettings] ✅ Custom server connectivity test passed');
      } catch (connectivityError: any) {
        console.warn('[NativeSettings] Custom server connectivity test failed:', connectivityError.message);
        // Don't fail completely - allow adding server with warning
        console.warn('[NativeSettings] Proceeding with server addition despite connectivity test failure');
      }

      // Store custom servers in AsyncStorage (since iOS Settings.bundle dropdown is static)
      const customServers = await this.getCustomServers();
      if (!customServers.includes(validation.normalizedAddress)) {
        customServers.push(validation.normalizedAddress);
        await AsyncStorage.setItem('@VerbumCare:CustomServers', JSON.stringify(customServers));
      }

      console.log('[NativeSettings] ✅ Custom server added:', validation.normalizedAddress);
      return true;
    } catch (error: any) {
      console.error('[NativeSettings] ❌ Failed to add custom server:', error);
      return false;
    }
  }

  /**
   * Remove a custom server address
   */
  async removeCustomServer(address: string): Promise<boolean> {
    try {
      const customServers = await this.getCustomServers();
      const filteredServers = customServers.filter(server => server !== address);
      
      await AsyncStorage.setItem('@VerbumCare:CustomServers', JSON.stringify(filteredServers));
      
      console.log('[NativeSettings] ✅ Custom server removed:', address);
      return true;
    } catch (error: any) {
      console.error('[NativeSettings] ❌ Failed to remove custom server:', error);
      return false;
    }
  }

  /**
   * Get list of all available servers (prefilled + custom)
   */
  async getAvailableServers(): Promise<string[]> {
    try {
      // Prefilled server addresses from iOS Settings Bundle
      const prefilledServers = [
        'https://verbumcare-lab.local/api',      // pn51 (Default)
        'https://verbumcarenomac-mini.local/api',        // Mac Mini
        'https://verbumcaremac-mini.tail609750.ts.net/api' // Mac Mini Tailscale
      ];

      // Get custom servers from storage
      const customServers = await this.getCustomServers();

      // Combine and deduplicate
      const allServers = [...prefilledServers, ...customServers];
      const uniqueServers = Array.from(new Set(allServers));

      console.log(`[NativeSettings] Available servers: ${uniqueServers.length} total (${prefilledServers.length} prefilled, ${customServers.length} custom)`);
      return uniqueServers;
    } catch (error) {
      console.warn('[NativeSettings] Failed to get available servers:', error);
      // Return at least the prefilled servers
      return [
        'https://verbumcare-lab.local/api',
        'https://verbumcarenomac-mini.local/api',
        'https://verbumcaremac-mini.tail609750.ts.net/api'
      ];
    }
  }

  /**
   * Get the current server address from iOS Settings
   */
  async getServerAddress(): Promise<string> {
    try {
      const result = await this.readNativeSettings();
      
      if (result.success && result.settings) {
        // Handle custom server case
        if (result.settings.backendServerAddress === '__CUSTOM__' && result.settings.customServerAddress) {
          return result.settings.customServerAddress;
        }
        
        // Return the configured server address
        return result.settings.backendServerAddress;
      }

      // Fallback to default
      return 'https://verbumcare-lab.local/api';
    } catch (error) {
      console.warn('[NativeSettings] Failed to get server address:', error);
      return 'https://verbumcare-lab.local/api';
    }
  }
  /**
   * Convert server address to ServerConfig object
   */
  createServerConfigFromAddress(address: string): ServerConfig {
    // Check if it's a prefilled server
    switch (address) {
      case 'https://verbumcare-lab.local/api':
        return getServerById('pn51') || getDefaultServer();
      case 'https://verbumcarenomac-mini.local/api':
        return getServerById('mac-mini') || getDefaultServer();
      case 'https://verbumcaremac-mini.tail609750.ts.net/api':
        return getServerById('mac-mini-tailscale') || getDefaultServer();
      default:
        // Create custom server config
        try {
          const url = new URL(address);
          const hostname = url.hostname;
          
          return {
            id: `custom-${hostname.replace(/\./g, '-')}`,
            name: hostname,
            displayName: `Custom Server (${hostname})`,
            baseUrl: address,
            wsUrl: address.replace('http', 'ws'),
            description: `Custom server at ${hostname}`,
            isDefault: false,
            healthCheckEndpoints: ['/health', '/api/patients'],
            connectionTimeout: 15000, // 15 seconds for custom servers
            retryAttempts: 2,
            metadata: {
              environment: 'development' as const,
              capabilities: ['custom-configured']
            }
          };
        } catch (error) {
          console.error('[NativeSettings] Failed to create server config from address:', error);
          return getDefaultServer();
        }
    }
  }

  async getCustomServers(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem('@VerbumCare:CustomServers');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('[NativeSettings] Failed to get custom servers:', error);
      return [];
    }
  }

  /**
   * Clear cached settings (force re-read from native)
   */
  clearCache(): void {
    this.cachedSettings = null;
    this.lastReadTime = 0;
  }

  /**
   * Check if native module is available
   */
  isNativeModuleAvailable(): boolean {
    return Platform.OS === 'ios' && nativeSettingsModule.isAvailable();
  }

  /**
   * Write settings to iOS Settings app (for testing/development)
   * DEPRECATED: This method is kept for backward compatibility but should not be used
   * In production, users configure settings through iOS Settings directly
   */
  async writeNativeSettingsForTesting(settings: Partial<NativeSettingsInternal>): Promise<void> {
    console.warn('[NativeSettings] writeNativeSettingsForTesting is deprecated. Use iOS Settings app directly.');
    
    try {
      // For testing, we can still write to AsyncStorage cache
      const currentSettings = this.cachedSettings || {
        backendServerAddress: 'https://verbumcare-lab.local/api',
        customServerAddress: '',
        connectionTimeout: 120, // Increased default timeout for high network latency (350ms+ observed)
        autoSwitchOnFailure: true,
        enableDetailedLogging: false,
      };

      const updatedSettings = { ...currentSettings, ...settings };
      
      await AsyncStorage.setItem(NATIVE_SETTINGS_CACHE_KEY, JSON.stringify(updatedSettings));
      
      // Clear cache to force re-read
      this.cachedSettings = null;
      this.lastReadTime = 0;

      console.log('[NativeSettings] ✅ Test settings cached successfully');
    } catch (error: any) {
      console.error('[NativeSettings] ❌ Failed to cache test settings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const nativeSettingsService = new NativeSettingsService();

export default nativeSettingsService;