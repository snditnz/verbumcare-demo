/**
 * Property-Based Tests for Native Settings Service - iOS Settings Integration
 * 
 * **Feature: backend-switching-settings, Property 1: iOS Settings integration and validation**
 * **Feature: backend-switching-settings, Property 8: Native settings synchronization**
 * **Feature: backend-switching-settings, Property 9: Server address normalization**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.4, 6.2, 7.1, 7.2, 7.4**
 * 
 * Tests that iOS Settings integration works correctly with validation, normalization,
 * and synchronization across app state changes.
 */

import fc from 'fast-check';
import { Platform } from 'react-native';
import { nativeSettingsService } from '../nativeSettingsService';
import { getDefaultServer } from '../../config/servers';

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Linking: {
    openSettings: jest.fn().mockResolvedValue(true),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock axios for connectivity testing
jest.mock('axios', () => ({
  get: jest.fn(),
}));

// Mock the native settings module
jest.mock('../NativeSettingsModule', () => ({
  nativeSettingsModule: {
    isAvailable: jest.fn(() => true),
    readAllSettings: jest.fn(),
    getEffectiveServerConfig: jest.fn(),
    hasConfiguredSettings: jest.fn(),
    validateServerAddress: jest.fn(),
  },
}));

describe('Native Settings Service - iOS Settings Integration Properties', () => {
  const mockAsyncStorage = require('@react-native-async-storage/async-storage');
  const mockAxios = require('axios');
  const { nativeSettingsModule } = require('../NativeSettingsModule');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockAxios.get.mockResolvedValue({
      status: 200,
      data: { success: true },
    });
    
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(true);
    
    // Clear cache before each test
    nativeSettingsService.clearCache();
  });

  /**
   * Property 1: iOS Settings integration and validation
   * For any server address configured in iOS Settings, the app should validate 
   * the address, test connectivity, and provide clear feedback on configuration status
   */
  it('should validate server addresses from iOS Settings and provide clear feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various server address configurations
        fc.record({
          serverAddress: fc.oneof(
            // Valid prefilled addresses
            fc.constant('https://verbumcare-lab.local/api'),
            fc.constant('https://verbumcaremac-mini/api'),
            fc.constant('https://verbumcarenomac-mini.local/api'),
            // Valid custom addresses
            fc.constant('https://custom-server.local/api'),
            fc.constant('https://192.168.1.100/api'),
            // Invalid addresses for negative testing
            fc.constant('http://insecure-server.local/api'),
            fc.constant('https://localhost/api'),
            fc.constant('invalid-url'),
            fc.constant(''),
          ),
          customServerAddress: fc.option(fc.string(), { nil: undefined }),
          connectionTimeout: fc.integer({ min: 5, max: 60 }),
          autoSwitchOnFailure: fc.boolean(),
          enableDetailedLogging: fc.boolean(),
        }),
        async (nativeSettings) => {
          // Mock native settings module to return our test data
          nativeSettingsModule.readAllSettings.mockResolvedValue({
            backendServerAddress: nativeSettings.serverAddress,
            customServerAddress: nativeSettings.customServerAddress,
            connectionTimeout: nativeSettings.connectionTimeout,
            autoSwitchOnFailure: nativeSettings.autoSwitchOnFailure,
            enableDetailedLogging: nativeSettings.enableDetailedLogging,
            appVersion: '1.0.0',
          });

          // Property: Service should always return a result (success or failure)
          const result = await nativeSettingsService.readNativeSettings();
          expect(result).toBeDefined();
          expect(result.success).toBeDefined();
          expect(result.source).toBeDefined();
          expect(['ios_settings', 'cache', 'default']).toContain(result.source);

          if (result.success) {
            // Property: Successful results should have valid settings and server config
            expect(result.settings).toBeDefined();
            expect(result.serverConfig).toBeDefined();
            
            if (result.settings) {
              expect(result.settings.backendServerAddress).toBeDefined();
              expect(result.settings.connectionTimeout).toBeGreaterThan(0);
              expect(typeof result.settings.autoSwitchOnFailure).toBe('boolean');
              expect(typeof result.settings.enableDetailedLogging).toBe('boolean');
            }

            if (result.serverConfig) {
              expect(result.serverConfig.id).toBeDefined();
              expect(result.serverConfig.displayName).toBeDefined();
              expect(result.serverConfig.baseUrl).toBeDefined();
              expect(result.serverConfig.healthCheckEndpoints).toBeDefined();
              expect(result.serverConfig.healthCheckEndpoints.length).toBeGreaterThan(0);
            }
          } else {
            // Property: Failed results should have clear error messages
            expect(result.error).toBeDefined();
            expect(result.error!.length).toBeGreaterThan(0);
            expect(result.error).not.toContain('undefined');
            expect(result.error).not.toContain('null');
          }

          // Property: Invalid addresses should be rejected with specific error messages
          if (nativeSettings.serverAddress === 'invalid-url' || 
              nativeSettings.serverAddress === '' ||
              nativeSettings.serverAddress.startsWith('http://') ||
              nativeSettings.serverAddress.includes('localhost')) {
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            
            if (nativeSettings.serverAddress === 'invalid-url' || nativeSettings.serverAddress === '') {
              expect(result.error!.toLowerCase()).toMatch(/invalid|url|format/);
            } else if (nativeSettings.serverAddress.startsWith('http://')) {
              expect(result.error!.toLowerCase()).toMatch(/https|secure|protocol/);
            } else if (nativeSettings.serverAddress.includes('localhost')) {
              expect(result.error!.toLowerCase()).toMatch(/localhost|forbidden|production/);
            }
          }
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property 8: Native settings synchronization
   * For any change in iOS Settings, the app should detect and apply the new 
   * configuration when it becomes active
   */
  it('should synchronize settings changes when app becomes active', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate initial and updated settings
        fc.record({
          initialSettings: fc.record({
            backendServerAddress: fc.constant('https://verbumcare-lab.local/api'),
            connectionTimeout: fc.integer({ min: 10, max: 30 }),
            autoSwitchOnFailure: fc.boolean(),
            enableDetailedLogging: fc.boolean(),
          }),
          updatedSettings: fc.record({
            backendServerAddress: fc.oneof(
              fc.constant('https://verbumcaremac-mini/api'),
              fc.constant('https://verbumcarenomac-mini.local/api'),
              fc.constant('https://custom-server.local/api')
            ),
            connectionTimeout: fc.integer({ min: 10, max: 30 }),
            autoSwitchOnFailure: fc.boolean(),
            enableDetailedLogging: fc.boolean(),
          }),
        }),
        async ({ initialSettings, updatedSettings }) => {
          // Setup initial settings
          nativeSettingsModule.readAllSettings.mockResolvedValueOnce({
            ...initialSettings,
            appVersion: '1.0.0',
          });

          // Property: Initial read should return cached result
          const initialResult = await nativeSettingsService.readNativeSettings();
          expect(initialResult.success).toBe(true);
          expect(initialResult.source).toBe('ios_settings');

          // Simulate settings change in iOS Settings
          nativeSettingsModule.readAllSettings.mockResolvedValueOnce({
            ...updatedSettings,
            appVersion: '1.0.0',
          });

          // Property: Cache should prevent immediate detection of changes
          const cachedResult = await nativeSettingsService.readNativeSettings();
          if (initialResult.success && cachedResult.success) {
            // Should return cached result (same as initial)
            expect(cachedResult.settings?.backendServerAddress).toBe(initialSettings.backendServerAddress);
          }

          // Property: Clearing cache should allow detection of new settings
          nativeSettingsService.clearCache();
          
          const updatedResult = await nativeSettingsService.readNativeSettings();
          expect(updatedResult.success).toBe(true);
          expect(updatedResult.source).toBe('ios_settings');
          
          if (updatedResult.success) {
            expect(updatedResult.settings?.backendServerAddress).toBe(updatedSettings.backendServerAddress);
            expect(updatedResult.settings?.connectionTimeout).toBe(updatedSettings.connectionTimeout);
            expect(updatedResult.settings?.autoSwitchOnFailure).toBe(updatedSettings.autoSwitchOnFailure);
            expect(updatedResult.settings?.enableDetailedLogging).toBe(updatedSettings.enableDetailedLogging);
          }

          // Property: Server config should be updated to match new settings
          if (updatedResult.success && updatedResult.serverConfig) {
            expect(updatedResult.serverConfig.baseUrl).toBe(updatedSettings.backendServerAddress);
            expect(updatedResult.serverConfig.connectionTimeout).toBe(updatedSettings.connectionTimeout * 1000); // Convert to ms
          }
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property 9: Server address normalization
   * For any server address input, the system should normalize the format and 
   * ensure it meets security and connectivity requirements
   */
  it('should normalize server addresses and enforce security requirements', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various server address formats that need normalization
        fc.record({
          inputAddress: fc.oneof(
            // Addresses that need normalization
            fc.constant('https://server.local'),           // Missing /api
            fc.constant('https://server.local/'),          // Trailing slash, missing /api
            fc.constant('https://server.local/api/'),      // Extra trailing slash
            fc.constant('HTTPS://SERVER.LOCAL/API'),       // Case variations
            fc.constant('https://server.local:443/api'),   // Explicit HTTPS port
            fc.constant('https://192.168.1.100:8443/api'), // Custom port
            // Addresses that should be rejected
            fc.constant('http://server.local/api'),        // Insecure HTTP
            fc.constant('https://localhost/api'),          // Forbidden localhost
            fc.constant('https://127.0.0.1/api'),         // Forbidden loopback
            fc.constant('ftp://server.local/api'),         // Wrong protocol
            fc.constant('server.local/api'),               // Missing protocol
          ),
          expectValid: fc.boolean(),
        }),
        async ({ inputAddress }) => {
          // Property: Validation should always return a result
          const validation = await nativeSettingsService.validateServerAddress(inputAddress);
          expect(validation).toBeDefined();
          expect(validation.valid).toBeDefined();
          expect(validation.errors).toBeDefined();
          expect(validation.warnings).toBeDefined();
          expect(validation.suggestions).toBeDefined();
          expect(validation.normalizedAddress).toBeDefined();

          // Property: Normalized address should be provided even for invalid inputs
          expect(validation.normalizedAddress.length).toBeGreaterThan(0);

          // Property: Security requirements should be enforced
          if (inputAddress.startsWith('http://')) {
            expect(validation.valid).toBe(false);
            expect(validation.errors.some(err => err.toLowerCase().includes('https'))).toBe(true);
          }

          if (inputAddress.includes('localhost') || inputAddress.includes('127.0.0.1')) {
            expect(validation.valid).toBe(false);
            expect(validation.errors.some(err => err.toLowerCase().includes('localhost') || err.toLowerCase().includes('forbidden'))).toBe(true);
          }

          if (!inputAddress.includes('://')) {
            expect(validation.valid).toBe(false);
            expect(validation.errors.some(err => err.toLowerCase().includes('protocol') || err.toLowerCase().includes('https'))).toBe(true);
          }

          // Property: Valid HTTPS addresses should be normalized correctly
          if (inputAddress.startsWith('https://') && 
              !inputAddress.includes('localhost') && 
              !inputAddress.includes('127.0.0.1') &&
              inputAddress.includes('.')) {
            
            // Should normalize to end with /api
            expect(validation.normalizedAddress.endsWith('/api')).toBe(true);
            
            // Should be lowercase for hostname
            const url = new URL(validation.normalizedAddress);
            expect(url.hostname).toBe(url.hostname.toLowerCase());
            
            // Should use https protocol
            expect(url.protocol).toBe('https:');
          }

          // Property: Error messages should be specific and actionable
          if (!validation.valid) {
            expect(validation.errors.length).toBeGreaterThan(0);
            validation.errors.forEach(error => {
              expect(error.length).toBeGreaterThan(5); // Reasonably descriptive
              expect(error).not.toContain('undefined');
              expect(error).not.toContain('null');
            });
          }

          // Property: Suggestions should be provided for common mistakes
          if (!validation.valid && validation.suggestions.length > 0) {
            validation.suggestions.forEach(suggestion => {
              expect(suggestion.length).toBeGreaterThan(5);
              expect(suggestion).not.toContain('undefined');
              expect(suggestion).not.toContain('null');
            });
          }
        }
      ),
      { numRuns: 40, timeout: 30000 }
    );
  });

  /**
   * Property: Custom server management should be persistent and validated
   */
  it('should manage custom servers with persistence and validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate custom server addresses
        fc.array(
          fc.oneof(
            fc.constant('https://custom1.local/api'),
            fc.constant('https://custom2.local/api'),
            fc.constant('https://192.168.1.200/api'),
            fc.constant('https://test-server.example.com/api'),
            // Some invalid ones to test rejection
            fc.constant('http://invalid.local/api'),
            fc.constant('https://localhost/api'),
          ),
          { minLength: 1, maxLength: 5 }
        ),
        async (customAddresses) => {
          // Property: Adding custom servers should validate addresses first
          const addResults: boolean[] = [];
          
          for (const address of customAddresses) {
            const result = await nativeSettingsService.addCustomServer(address);
            addResults.push(result);
            
            // Property: Invalid addresses should be rejected
            if (address.startsWith('http://') || address.includes('localhost')) {
              expect(result).toBe(false);
            }
          }

          // Property: Valid custom servers should be retrievable
          const availableServers = await nativeSettingsService.getAvailableServers();
          expect(availableServers).toBeDefined();
          expect(Array.isArray(availableServers)).toBe(true);
          
          // Should include prefilled servers
          expect(availableServers).toContain('https://verbumcare-lab.local/api');
          expect(availableServers).toContain('https://verbumcaremac-mini/api');
          expect(availableServers).toContain('https://verbumcarenomac-mini.local/api');

          // Property: Successfully added custom servers should be in the list
          const validCustomAddresses = customAddresses.filter(addr => 
            addr.startsWith('https://') && !addr.includes('localhost')
          );
          
          validCustomAddresses.forEach(address => {
            expect(availableServers).toContain(address);
          });

          // Property: Removing custom servers should work
          for (const address of validCustomAddresses) {
            const removeResult = await nativeSettingsService.removeCustomServer(address);
            expect(removeResult).toBe(true);
          }

          // Property: Removed servers should no longer be in the list
          const updatedServers = await nativeSettingsService.getAvailableServers();
          validCustomAddresses.forEach(address => {
            expect(updatedServers).not.toContain(address);
          });

          // Property: Prefilled servers should still be present after custom server removal
          expect(updatedServers).toContain('https://verbumcare-lab.local/api');
          expect(updatedServers).toContain('https://verbumcaremac-mini/api');
          expect(updatedServers).toContain('https://verbumcarenomac-mini.local/api');
        }
      ),
      { numRuns: 20, timeout: 30000 }
    );
  });

  /**
   * Property: Effective server configuration should handle all scenarios
   */
  it('should provide effective server configuration for all scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different iOS Settings scenarios
        fc.oneof(
          // Native module available with valid settings
          fc.record({
            scenario: fc.constant('native_available_valid'),
            nativeSettings: fc.record({
              backendServerAddress: fc.oneof(
                fc.constant('https://verbumcare-lab.local/api'),
                fc.constant('https://verbumcaremac-mini/api'),
                fc.constant('https://verbumcarenomac-mini.local/api')
              ),
              connectionTimeout: fc.integer({ min: 10, max: 30 }),
              autoSwitchOnFailure: fc.boolean(),
              enableDetailedLogging: fc.boolean(),
            }),
          }),
          // Native module available with custom server
          fc.record({
            scenario: fc.constant('native_available_custom'),
            nativeSettings: fc.record({
              backendServerAddress: fc.constant('__CUSTOM__'),
              customServerAddress: fc.constant('https://custom-server.local/api'),
              connectionTimeout: fc.integer({ min: 10, max: 30 }),
              autoSwitchOnFailure: fc.boolean(),
              enableDetailedLogging: fc.boolean(),
            }),
          }),
          // Native module unavailable
          fc.record({
            scenario: fc.constant('native_unavailable'),
            nativeSettings: fc.constant(null),
          }),
          // Native module error
          fc.record({
            scenario: fc.constant('native_error'),
            nativeSettings: fc.constant(null),
          }),
        ),
        async ({ scenario, nativeSettings }) => {
          // Configure mocks based on scenario
          switch (scenario) {
            case 'native_available_valid':
            case 'native_available_custom':
              nativeSettingsModule.isAvailable.mockReturnValue(true);
              nativeSettingsModule.getEffectiveServerConfig.mockResolvedValue({
                id: 'test-server',
                name: 'test-server',
                displayName: 'Test Server',
                baseUrl: nativeSettings?.backendServerAddress === '__CUSTOM__' 
                  ? nativeSettings.customServerAddress 
                  : nativeSettings?.backendServerAddress,
                wsUrl: 'wss://test-server.local',
                description: 'Test server configuration',
                isDefault: false,
                healthCheckEndpoints: ['/health'],
                connectionTimeout: (nativeSettings?.connectionTimeout || 15) * 1000,
                retryAttempts: 3,
                metadata: {
                  environment: 'development' as const,
                  capabilities: ['test'],
                },
              });
              break;
            case 'native_unavailable':
              nativeSettingsModule.isAvailable.mockReturnValue(false);
              break;
            case 'native_error':
              nativeSettingsModule.isAvailable.mockReturnValue(true);
              nativeSettingsModule.getEffectiveServerConfig.mockRejectedValue(new Error('Native module error'));
              break;
          }

          // Property: Service should always return a valid server configuration
          const serverConfig = await nativeSettingsService.getEffectiveServerConfig();
          expect(serverConfig).toBeDefined();
          expect(serverConfig.id).toBeDefined();
          expect(serverConfig.name).toBeDefined();
          expect(serverConfig.displayName).toBeDefined();
          expect(serverConfig.baseUrl).toBeDefined();
          expect(serverConfig.wsUrl).toBeDefined();
          expect(serverConfig.description).toBeDefined();
          expect(serverConfig.healthCheckEndpoints).toBeDefined();
          expect(serverConfig.healthCheckEndpoints.length).toBeGreaterThan(0);
          expect(serverConfig.connectionTimeout).toBeGreaterThan(0);
          expect(serverConfig.retryAttempts).toBeGreaterThan(0);

          // Property: Server configuration should be structurally valid
          expect(serverConfig.id.length).toBeGreaterThan(0);
          expect(serverConfig.baseUrl.startsWith('https://')).toBe(true);
          expect(serverConfig.wsUrl.startsWith('wss://')).toBe(true);
          expect(serverConfig.connectionTimeout).toBeGreaterThanOrEqual(1000); // At least 1 second
          expect(serverConfig.retryAttempts).toBeGreaterThanOrEqual(1);

          // Property: For error scenarios, should fall back to default server
          if (scenario === 'native_unavailable' || scenario === 'native_error') {
            const defaultServer = getDefaultServer();
            expect(serverConfig.id).toBe(defaultServer.id);
            expect(serverConfig.baseUrl).toBe(defaultServer.baseUrl);
          }
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: Native settings override detection should be accurate
   */
  it('should accurately detect native settings overrides', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate scenarios for override detection
        fc.record({
          hasNativeModule: fc.boolean(),
          hasConfiguredSettings: fc.boolean(),
          moduleError: fc.boolean(),
        }),
        async ({ hasNativeModule, hasConfiguredSettings, moduleError }) => {
          // Configure mocks
          nativeSettingsModule.isAvailable.mockReturnValue(hasNativeModule);
          
          if (hasNativeModule && !moduleError) {
            nativeSettingsModule.hasConfiguredSettings.mockResolvedValue(hasConfiguredSettings);
          } else if (moduleError) {
            nativeSettingsModule.hasConfiguredSettings.mockRejectedValue(new Error('Module error'));
          }

          // Property: Override detection should always return a boolean
          const hasOverride = await nativeSettingsService.hasNativeSettingsOverride();
          expect(typeof hasOverride).toBe('boolean');

          // Property: Override should only be true when native module is available and has settings
          if (hasNativeModule && hasConfiguredSettings && !moduleError) {
            expect(hasOverride).toBe(true);
          } else {
            expect(hasOverride).toBe(false);
          }

          // Property: Method should not throw errors even when native module fails
          // (This is tested by the fact that we reach this point without exceptions)
          expect(true).toBe(true);
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });
});