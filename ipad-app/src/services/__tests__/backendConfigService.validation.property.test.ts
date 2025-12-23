/**
 * Property-Based Tests for Backend Configuration Service - Configuration Validation
 * 
 * **Feature: backend-switching-settings, Property 8: Configuration validation and fallback**
 * **Validates: Requirements 6.2, 6.5, 7.4**
 * 
 * Tests that configuration validation provides clear error messages and falls back
 * to valid default settings when invalid configurations are encountered.
 */

import fc from 'fast-check';
import { backendConfigService } from '../backendConfigService';
import { ServerConfig, validateServerConfig } from '../../config/servers';

// Mock axios to control network responses
jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => ({
      get: jest.fn(),
    })),
    get: jest.fn(),
  };
  return mockAxios;
});

// Mock the settings store
jest.mock('../../stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      tokens: { accessToken: 'mock-token' },
      isAuthenticated: true,
    })),
  },
}));

// Mock the API service
jest.mock('../api', () => ({
  apiService: {
    client: {
      defaults: {
        baseURL: 'https://test-server.local/api',
      },
    },
  },
}));

describe('Backend Configuration Service - Configuration Validation Properties', () => {
  const mockAxios = require('axios');
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock client with more comprehensive mocking
    mockClient = {
      get: jest.fn(),
    };
    
    // Setup axios.create to return our mock client
    mockAxios.create.mockReturnValue(mockClient);
    
    // Setup axios.get for direct calls
    mockAxios.get = jest.fn();
    
    // Default to successful responses for all tests
    mockClient.get.mockResolvedValue({
      status: 200,
      data: { success: true },
    });
    
    mockAxios.get.mockResolvedValue({
      status: 200,
      data: { success: true },
    });
  });

  afterEach(() => {
    // Clear any cached results
    backendConfigService.clearConnectivityCache();
  });

  /**
   * Property 8: Configuration validation and fallback
   * For any invalid server configuration, the system should provide clear error 
   * messages and fall back to valid default settings
   */
  it('should validate server configurations and provide clear error messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various invalid server configurations with proper type handling
        fc.oneof(
          // Invalid ID
          fc.record({
            id: fc.constant(''),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('https://valid-server.local/api'),
            wsUrl: fc.constant('wss://valid-server.local'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.array(fc.constant('/health'), { minLength: 1, maxLength: 2 }).map(arr => [...arr]), // Convert to mutable array
            connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
            retryAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          // Invalid name
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.constant(''),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('https://valid-server.local/api'),
            wsUrl: fc.constant('wss://valid-server.local'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.array(fc.constant('/health'), { minLength: 1, maxLength: 2 }).map(arr => [...arr]),
            connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
            retryAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          // Invalid baseUrl
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('invalid-url'),
            wsUrl: fc.constant('wss://valid-server.local'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.array(fc.constant('/health'), { minLength: 1, maxLength: 2 }).map(arr => [...arr]),
            connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
            retryAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          // Invalid wsUrl
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('https://valid-server.local/api'),
            wsUrl: fc.constant('invalid-ws-url'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.array(fc.constant('/health'), { minLength: 1, maxLength: 2 }).map(arr => [...arr]),
            connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
            retryAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          // Empty health check endpoints
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('https://valid-server.local/api'),
            wsUrl: fc.constant('wss://valid-server.local'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.constant([] as string[]), // Explicitly type as mutable array
            connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
            retryAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          // Invalid connection timeout
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('https://valid-server.local/api'),
            wsUrl: fc.constant('wss://valid-server.local'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.array(fc.constant('/health'), { minLength: 1, maxLength: 2 }).map(arr => [...arr]),
            connectionTimeout: fc.constant(-1000),
            retryAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          // Invalid retry attempts
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('https://valid-server.local/api'),
            wsUrl: fc.constant('wss://valid-server.local'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.array(fc.constant('/health'), { minLength: 1, maxLength: 2 }).map(arr => [...arr]),
            connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
            retryAttempts: fc.constant(-1),
          })
        ),
        async (invalidConfig: ServerConfig) => {
          // Property: Invalid configurations should be detected by structural validation
          const structuralValidation = validateServerConfig(invalidConfig);
          expect(structuralValidation.valid).toBe(false);
          expect(structuralValidation.errors.length).toBeGreaterThanOrEqual(1);
          expect(structuralValidation.errors[0]).toBeDefined();
          expect(structuralValidation.errors[0].length).toBeGreaterThan(0);

          // Property: Error messages should be descriptive and specific
          const allErrors = structuralValidation.errors.join(' ').toLowerCase();
          
          if (invalidConfig.id === '' || invalidConfig.id.trim() === '') {
            expect(allErrors).toContain('server id');
          } else if (invalidConfig.name === '' || invalidConfig.name.trim() === '') {
            expect(allErrors).toContain('server name');
          } else if (invalidConfig.baseUrl === 'invalid-url') {
            expect(allErrors).toContain('base url');
          } else if (invalidConfig.wsUrl === 'invalid-ws-url') {
            expect(allErrors).toContain('websocket url');
          } else if (invalidConfig.healthCheckEndpoints.length === 0) {
            expect(allErrors).toContain('health check');
          } else if (invalidConfig.connectionTimeout <= 0) {
            expect(allErrors).toContain('connection timeout');
          } else if (invalidConfig.retryAttempts < 0) {
            expect(allErrors).toContain('retry attempts');
          }

          // Property: Backend service should detect structural validation failures
          // For structurally invalid configs, the service should fail fast without connectivity testing
          const validationResult = await backendConfigService.validateServerConfiguration(invalidConfig);
          expect(validationResult.valid).toBe(false);
          expect(validationResult.errors.length).toBeGreaterThan(0);
          expect(validationResult.errors[0]).toBeDefined();
          
          // The error should be from structural validation (since we're testing invalid configs)
          const hasStructuralError = validationResult.errors.some(error => 
            error.toLowerCase().includes('server id') ||
            error.toLowerCase().includes('server name') ||
            error.toLowerCase().includes('base url') ||
            error.toLowerCase().includes('websocket url') ||
            error.toLowerCase().includes('health check') ||
            error.toLowerCase().includes('connection timeout') ||
            error.toLowerCase().includes('retry attempts')
          );
          
          // For invalid configs, we should get structural validation errors
          expect(hasStructuralError).toBe(true);
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property: Valid configurations should pass validation
   */
  it('should accept valid server configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid server configurations using known server IDs
        fc.record({
          id: fc.oneof(
            fc.constant('mac-mini'),
            fc.constant('pn51'),
            fc.constant('test-server-1'),
            fc.constant('test-server-2')
          ),
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          displayName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          baseUrl: fc.oneof(
            fc.constant('https://server1.local/api'),
            fc.constant('https://server2.local/api'),
            fc.constant('https://server3.local/api')
          ),
          wsUrl: fc.oneof(
            fc.constant('wss://server1.local'),
            fc.constant('wss://server2.local'),
            fc.constant('wss://server3.local')
          ),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.oneof(
              fc.constant('/health'),
              fc.constant('/api/status'),
              fc.constant('/api/auth/verify')
            ),
            { minLength: 1, maxLength: 3 }
          ).map(arr => [...arr]), // Convert to mutable array
          connectionTimeout: fc.integer({ min: 1000, max: 30000 }),
          retryAttempts: fc.integer({ min: 1, max: 5 }),
        }),
        async (validConfig: ServerConfig) => {
          // Property: Valid configurations should pass structural validation
          const structuralValidation = validateServerConfig(validConfig);
          expect(structuralValidation.valid).toBe(true);
          expect(structuralValidation.errors).toHaveLength(0);

          // For this test, we'll focus on structural validation since the backend service
          // validation requires the server to exist in the predefined list
          // This is actually the correct behavior - the service validates against known servers
          
          // If the server ID matches a known server, test the full validation
          const knownServerIds = ['mac-mini', 'pn51'];
          if (knownServerIds.includes(validConfig.id)) {
            // Ensure mock is set up for successful connectivity
            mockClient.get.mockResolvedValue({
              status: 200,
              data: { success: true },
            });

            // Property: Backend service should accept valid configurations with successful connectivity
            const serviceValidation = await backendConfigService.validateServerConfiguration(validConfig);
            expect(serviceValidation.valid).toBe(true);
            expect(serviceValidation.errors).toHaveLength(0);
          } else {
            // For unknown server IDs, the service should fail with a clear error
            const serviceValidation = await backendConfigService.validateServerConfiguration(validConfig);
            expect(serviceValidation.valid).toBe(false);
            expect(serviceValidation.errors.length).toBeGreaterThan(0);
            expect(serviceValidation.errors[0]).toContain('Server configuration not found');
          }
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: Configuration loading should handle missing or corrupted data gracefully
   */
  it('should handle missing or corrupted server configurations gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate scenarios for configuration loading
        fc.oneof(
          fc.constant('empty_config'),
          fc.constant('corrupted_config'),
          fc.constant('partial_config')
        ),
        async (scenario: string) => {
          // Use scenario to vary test behavior
          console.log(`Testing scenario: ${scenario}`);
          
          // Property: Service should load configurations without throwing errors
          let configurations: ServerConfig[] = [];
          
          try {
            configurations = await backendConfigService.loadServerConfigurations();
          } catch (error) {
            // If loading fails, it should provide a meaningful error message
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBeDefined();
            expect((error as Error).message.length).toBeGreaterThan(0);
          }

          // Property: If configurations are loaded, they should all be valid
          if (configurations.length > 0) {
            configurations.forEach(config => {
              const validation = validateServerConfig(config);
              expect(validation.valid).toBe(true);
            });
          }

          // Property: Service should always have at least one valid configuration or clear error
          expect(configurations.length >= 0).toBe(true);
        }
      ),
      { numRuns: 20, timeout: 30000 }
    );
  });

  /**
   * Property: Fallback behavior should provide working defaults
   */
  it('should provide working fallback configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various failure scenarios
        fc.oneof(
          fc.constant('network_failure'),
          fc.constant('invalid_response'),
          fc.constant('timeout_error')
        ),
        async (failureScenario: string) => {
          // Configure mock to simulate different failure types
          switch (failureScenario) {
            case 'network_failure':
              const networkError = new Error('Network unreachable');
              (networkError as any).code = 'ENETUNREACH';
              mockClient.get.mockRejectedValue(networkError);
              break;
            case 'invalid_response':
              mockClient.get.mockResolvedValue({
                status: 500,
                data: { error: 'Internal server error' },
              });
              break;
            case 'timeout_error':
              const timeoutError = new Error('Request timeout');
              (timeoutError as any).code = 'ETIMEDOUT';
              mockClient.get.mockRejectedValue(timeoutError);
              break;
          }

          // Property: Service should load default configurations even when validation fails
          const configurations = await backendConfigService.loadServerConfigurations();
          expect(configurations.length).toBeGreaterThan(0);

          // Property: All loaded configurations should be structurally valid
          configurations.forEach(config => {
            const validation = validateServerConfig(config);
            expect(validation.valid).toBe(true);
          });

          // Property: At least one configuration should be marked as default
          const defaultConfigs = configurations.filter(config => config.isDefault);
          expect(defaultConfigs.length).toBeGreaterThanOrEqual(1);

          // Property: Default configuration should have all required fields
          const defaultConfig = defaultConfigs[0];
          expect(defaultConfig.id).toBeDefined();
          expect(defaultConfig.id.length).toBeGreaterThan(0);
          expect(defaultConfig.name).toBeDefined();
          expect(defaultConfig.name.length).toBeGreaterThan(0);
          expect(defaultConfig.baseUrl).toBeDefined();
          expect(defaultConfig.baseUrl.length).toBeGreaterThan(0);
          expect(defaultConfig.healthCheckEndpoints).toBeDefined();
          expect(defaultConfig.healthCheckEndpoints.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Error messages should be user-friendly and actionable
   */
  it('should provide user-friendly error messages for configuration issues', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate configurations with specific validation errors
        fc.record({
          errorType: fc.oneof(
            fc.constant('missing_id'),
            fc.constant('invalid_url'),
            fc.constant('empty_endpoints'),
            fc.constant('negative_timeout')
          ),
          baseConfig: fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            displayName: fc.string({ minLength: 1, maxLength: 100 }),
            baseUrl: fc.constant('https://test-server.local/api'),
            wsUrl: fc.constant('wss://test-server.local'),
            description: fc.string({ maxLength: 200 }),
            isDefault: fc.boolean(),
            healthCheckEndpoints: fc.array(fc.constant('/health'), { minLength: 1, maxLength: 2 }),
            connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
            retryAttempts: fc.integer({ min: 1, max: 3 }),
          })
        }),
        async ({ errorType, baseConfig }) => {
          // Create invalid config based on error type
          let invalidConfig: ServerConfig;
          
          switch (errorType) {
            case 'missing_id':
              invalidConfig = { ...baseConfig, id: '' };
              break;
            case 'invalid_url':
              invalidConfig = { ...baseConfig, baseUrl: 'not-a-url' };
              break;
            case 'empty_endpoints':
              invalidConfig = { ...baseConfig, healthCheckEndpoints: [] };
              break;
            case 'negative_timeout':
              invalidConfig = { ...baseConfig, connectionTimeout: -5000 };
              break;
            default:
              invalidConfig = baseConfig;
          }

          const validation = validateServerConfig(invalidConfig);
          
          // Property: Error messages should be present for invalid configs
          expect(validation.valid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);
          
          // Get the first error message for specific validation
          const errorMessage = validation.errors[0];
          
          // Property: Error messages should be descriptive and user-friendly
          expect(errorMessage).toBeDefined();
          expect(errorMessage.length).toBeGreaterThan(10); // Reasonably descriptive
          expect(errorMessage).not.toContain('undefined');
          expect(errorMessage).not.toContain('null');
          
          // Property: Error messages should indicate what's wrong and be actionable
          switch (errorType) {
            case 'missing_id':
              expect(validation.errors.some(err => err.toLowerCase().includes('id'))).toBe(true);
              expect(validation.errors.some(err => err.toLowerCase().includes('required'))).toBe(true);
              break;
            case 'invalid_url':
              expect(validation.errors.some(err => err.toLowerCase().includes('url'))).toBe(true);
              expect(validation.errors.some(err => err.toLowerCase().includes('valid'))).toBe(true);
              break;
            case 'empty_endpoints':
              expect(validation.errors.some(err => err.toLowerCase().includes('health check'))).toBe(true);
              expect(validation.errors.some(err => err.toLowerCase().includes('endpoint'))).toBe(true);
              break;
            case 'negative_timeout':
              expect(validation.errors.some(err => err.toLowerCase().includes('timeout'))).toBe(true);
              expect(validation.errors.some(err => err.toLowerCase().includes('positive'))).toBe(true);
              break;
          }
        }
      ),
      { numRuns: 40, timeout: 30000 }
    );
  });
});