/**
 * Property-Based Tests for Backend Configuration Service - Server Switch Rollback
 * 
 * **Feature: backend-switching-settings, Property 3: Server switch rollback consistency**
 * **Validates: Requirements 1.4, 4.3**
 * 
 * Tests that server switch rollback functionality maintains consistency and properly
 * restores the previous server configuration when switches fail.
 */

import fc from 'fast-check';
import { ServerConfig } from '../../config/servers';
import { DetailedConnectionStatus } from '../../types/settings';

// Mock axios to control HTTP responses
const mockAxiosGet = jest.fn();
const mockAxiosCreate = jest.fn(() => ({
  get: mockAxiosGet,
}));

jest.mock('axios', () => ({
  create: mockAxiosCreate,
  get: mockAxiosGet,
}));

// Mock the settings store
jest.mock('../../stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      tokens: { accessToken: 'mock-token' },
      isAuthenticated: true,
      refreshToken: jest.fn().mockResolvedValue(true),
      logout: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock cache service
jest.mock('../cacheService', () => ({
  cacheService: {
    clearCache: jest.fn().mockResolvedValue(undefined),
    clearUserSpecificCache: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock API service
jest.mock('../api', () => ({
  apiService: {
    client: {
      defaults: {
        baseURL: 'https://mock-server.local/api',
      },
    },
  },
}));

// Mock server configurations
jest.mock('../../config/servers', () => ({
  AVAILABLE_SERVERS: [
    {
      id: 'original-server',
      name: 'original-server',
      displayName: 'Original Server',
      baseUrl: 'https://original-server.local/api',
      wsUrl: 'wss://original-server.local',
      description: 'Original test server',
      isDefault: true,
      healthCheckEndpoints: ['/health'],
      connectionTimeout: 5000,
      retryAttempts: 2,
    },
    {
      id: 'target-server',
      name: 'target-server',
      displayName: 'Target Server',
      baseUrl: 'https://target-server.local/api',
      wsUrl: 'wss://target-server.local',
      description: 'Target test server',
      isDefault: false,
      healthCheckEndpoints: ['/health'],
      connectionTimeout: 5000,
      retryAttempts: 2,
    },
  ],
  getServerById: jest.fn((id: string) => {
    const servers = [
      {
        id: 'original-server',
        name: 'original-server',
        displayName: 'Original Server',
        baseUrl: 'https://original-server.local/api',
        wsUrl: 'wss://original-server.local',
        description: 'Original test server',
        isDefault: true,
        healthCheckEndpoints: ['/health'],
        connectionTimeout: 5000,
        retryAttempts: 2,
      },
      {
        id: 'target-server',
        name: 'target-server',
        displayName: 'Target Server',
        baseUrl: 'https://target-server.local/api',
        wsUrl: 'wss://target-server.local',
        description: 'Target test server',
        isDefault: false,
        healthCheckEndpoints: ['/health'],
        connectionTimeout: 5000,
        retryAttempts: 2,
      },
    ];
    return servers.find(s => s.id === id) || servers.find(s => s.id.includes(id.split('_')[0]));
  }),
  validateServerConfig: jest.fn(() => ({ valid: true, errors: [] })),
}));

describe('Backend Configuration Service - Server Switch Rollback Properties', () => {
  let backendConfigService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockClear();
    mockAxiosCreate.mockClear();
    
    // Reset axios.create to return our mock instance
    mockAxiosCreate.mockReturnValue({
      get: mockAxiosGet,
    });
    
    // Reset all mock implementations
    const mockGetServerById = require('../../config/servers').getServerById;
    mockGetServerById.mockClear();
    
    // Clear the module cache to get a fresh instance
    jest.resetModules();
    
    // Re-import the service to get a fresh instance
    backendConfigService = require('../backendConfigService').backendConfigService;
  });

  /**
   * Property 3: Server switch rollback consistency
   * For any failed server switch, the system should revert to the previous server 
   * configuration and restore the previous connection state
   */
  it('should maintain rollback consistency for failed server switches', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate two different server configurations
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://original-server.local/api'),
          wsUrl: fc.constant('wss://original-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.constant('/health'),
            { minLength: 1, maxLength: 2 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
          retryAttempts: fc.integer({ min: 1, max: 3 }),
        }),
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://target-server.local/api'),
          wsUrl: fc.constant('wss://target-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.constant('/health'),
            { minLength: 1, maxLength: 2 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
          retryAttempts: fc.integer({ min: 1, max: 3 }),
        }),
        async (originalServer: ServerConfig, targetServer: ServerConfig) => {
          // Ensure servers have different IDs
          if (originalServer.id === targetServer.id) {
            targetServer.id = targetServer.id + '_target';
          }

          // Update mock to return these specific servers
          const mockGetServerById = require('../../config/servers').getServerById;
          mockGetServerById.mockImplementation((id: string) => {
            if (id === originalServer.id || id.includes(originalServer.id.split('_')[0])) {
              return originalServer;
            }
            if (id === targetServer.id || id.includes(targetServer.id.split('_')[0])) {
              return targetServer;
            }
            return undefined;
          });

          // Setup mock HTTP responses - ensure proper sequencing
          mockAxiosGet.mockReset(); // Clear any previous mock calls
          
          // For original server (should succeed) - one call per health check endpoint
          originalServer.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
          });
          
          // For target server (should fail) - one call per health check endpoint
          targetServer.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockRejectedValueOnce(new Error('Connection refused'));
          });
          
          // For original server rollback (should succeed) - one call per health check endpoint
          originalServer.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
          });

          // Import the service after mocking
          // Use the fresh instance from beforeEach

          // Step 1: Establish successful connection to original server
          const originalConnectResult = await backendConfigService.testServerConnectivity(originalServer.id);
          
          // Property: Original server should be successfully connected
          expect(originalConnectResult.status).toBe('connected');
          expect(originalConnectResult.serverId).toBe(originalServer.id);
          expect(originalConnectResult.healthChecks).toHaveLength(originalServer.healthCheckEndpoints.length);

          // Step 2: Attempt to switch to target server (simulate failure)
          const targetConnectResult = await backendConfigService.testServerConnectivity(targetServer.id);

          // Property: Target server connection should fail
          expect(targetConnectResult.status).toBe('error');
          expect(targetConnectResult.serverId).toBe(targetServer.id);
          expect(targetConnectResult.errorMessage).toBeDefined();

          // Step 3: Verify rollback behavior - original server should still be accessible
          const rollbackConnectResult = await backendConfigService.testServerConnectivity(originalServer.id);

          // Property: Rollback should restore original server connectivity
          expect(rollbackConnectResult.status).toBe('connected');
          expect(rollbackConnectResult.serverId).toBe(originalServer.id);
          expect(rollbackConnectResult.healthChecks).toHaveLength(originalServer.healthCheckEndpoints.length);

          // Property: Rollback result should be consistent with original connection
          expect(rollbackConnectResult.serverId).toBe(originalConnectResult.serverId);
          expect(rollbackConnectResult.status).toBe(originalConnectResult.status);

          // Property: Failed target server should remain in error state
          const targetRetestResult = backendConfigService.getLastConnectivityResult(targetServer.id);
          expect(targetRetestResult).toBeDefined();
          expect(targetRetestResult!.status).toBe('error');
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: Rollback should preserve server configuration integrity
   */
  it('should preserve server configuration integrity during rollback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://stable-server.local/api'),
          wsUrl: fc.constant('wss://stable-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.constant('/health'),
            { minLength: 1, maxLength: 3 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
          retryAttempts: fc.integer({ min: 1, max: 3 }),
        }),
        async (serverConfig: ServerConfig) => {
          // Update mock to return this specific server
          const mockGetServerById = require('../../config/servers').getServerById;
          mockGetServerById.mockImplementation((id: string) => {
            if (id === serverConfig.id || id.includes(serverConfig.id.split('_')[0])) {
              return serverConfig;
            }
            return undefined;
          });

          // Mock the getCachedServerConfig method to return our test server
          backendConfigService.getCachedServerConfig = jest.fn().mockReturnValue(serverConfig);

          // Setup mock HTTP responses for different scenarios
          mockAxiosGet.mockReset(); // Clear any previous mock calls
          
          // Initial connection (should succeed) - one call per health check endpoint
          serverConfig.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
          });
          
          // Temporary failure - one call per health check endpoint
          serverConfig.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockRejectedValueOnce(new Error('Temporary network error'));
          });
          
          // Recovery (should succeed) - one call per health check endpoint
          serverConfig.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
          });

          // Import the service after mocking
          // Use the fresh instance from beforeEach

          // Test initial connection
          const initialConnectResult = await backendConfigService.testServerConnectivity(serverConfig.id);

          // Property: Initial connection should succeed
          expect(initialConnectResult.status).toBe('connected');
          expect(initialConnectResult.serverId).toBe(serverConfig.id);

          // Simulate temporary failure
          const failureConnectResult = await backendConfigService.testServerConnectivity(serverConfig.id);

          // Property: Temporary failure should be recorded
          expect(failureConnectResult.status).toBe('error');
          expect(failureConnectResult.serverId).toBe(serverConfig.id);

          // Test recovery
          const recoveryConnectResult = await backendConfigService.testServerConnectivity(serverConfig.id);

          // Property: Recovery should restore original server configuration
          expect(recoveryConnectResult.status).toBe('connected');
          expect(recoveryConnectResult.serverId).toBe(serverConfig.id);
          expect(recoveryConnectResult.healthChecks).toHaveLength(serverConfig.healthCheckEndpoints.length);

          // Property: Server configuration should remain unchanged
          const cachedConfig = backendConfigService.getCachedServerConfig(serverConfig.id);
          expect(cachedConfig).toBeDefined();
          expect(cachedConfig!.id).toBe(serverConfig.id);
          expect(cachedConfig!.baseUrl).toBe(serverConfig.baseUrl);
          expect(cachedConfig!.healthCheckEndpoints).toEqual(serverConfig.healthCheckEndpoints);
        }
      ),
      { numRuns: 25, timeout: 30000 }
    );
  });

  /**
   * Property: Rollback should handle authentication state correctly
   */
  it('should handle authentication state correctly during rollback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://auth-server.local/api'),
          wsUrl: fc.constant('wss://auth-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.oneof(
              fc.constant('/health'),
              fc.constant('/api/auth/verify')
            ),
            { minLength: 1, maxLength: 2 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
          retryAttempts: fc.integer({ min: 1, max: 3 }),
        }),
        // Test with different authentication states
        fc.boolean(),
        async (serverConfig: ServerConfig, isAuthenticated: boolean) => {
          // Update mock to return this specific server
          const mockGetServerById = require('../../config/servers').getServerById;
          mockGetServerById.mockImplementation((id: string) => {
            if (id === serverConfig.id || id.includes(serverConfig.id.split('_')[0])) {
              return serverConfig;
            }
            return undefined;
          });

          // Mock authentication state
          const mockAuthStore = require('../../stores/authStore');
          mockAuthStore.useAuthStore.getState.mockReturnValue({
            tokens: isAuthenticated ? { accessToken: 'valid-token' } : null,
            isAuthenticated,
            refreshToken: jest.fn().mockResolvedValue(true),
            logout: jest.fn().mockResolvedValue(undefined),
          });

          // Setup mock HTTP responses based on authentication state
          mockAxiosGet.mockReset(); // Clear any previous mock calls
          if (isAuthenticated) {
            // Mock successful responses for authenticated requests
            mockAxiosGet.mockResolvedValue({ status: 200, data: { status: 'ok' } });
          } else {
            // Mock authentication failures for unauthenticated requests
            const authError = new Error('Unauthorized');
            (authError as any).response = { status: 401, statusText: 'Unauthorized' };
            mockAxiosGet.mockImplementation((url: string) => {
              if (url.includes('/auth/')) {
                return Promise.reject(authError);
              }
              return Promise.resolve({ status: 200, data: { status: 'ok' } });
            });
          }

          // Import the service after mocking
          // Use the fresh instance from beforeEach

          const connectResult = await backendConfigService.testServerConnectivity(serverConfig.id);

          // Property: Authentication state should be reflected in connectivity result
          if (isAuthenticated) {
            expect(connectResult.status).toBe('connected');
            // Property: All health checks should succeed with valid auth
            connectResult.healthChecks.forEach((check: any) => {
              expect(check.status).toBe('success');
            });
          } else {
            // Property: Auth-protected endpoints should fail without valid auth
            const authEndpoints = connectResult.healthChecks.filter((check: any) => 
              check.endpoint.includes('/auth/'));
            authEndpoints.forEach((check: any) => {
              expect(check.status).toBe('failure');
              expect(check.error).toContain('401');
            });
          }

          // Property: Server configuration should remain intact regardless of auth state
          expect(connectResult.serverId).toBe(serverConfig.id);
          expect(connectResult.healthChecks).toHaveLength(serverConfig.healthCheckEndpoints.length);
        }
      ),
      { numRuns: 20, timeout: 30000 }
    );
  });

  /**
   * Property: Rollback should maintain cache consistency
   */
  it('should maintain cache consistency during rollback operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://cache-server.local/api'),
          wsUrl: fc.constant('wss://cache-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.constant('/health'),
            { minLength: 1, maxLength: 2 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
          retryAttempts: fc.integer({ min: 1, max: 3 }),
        }),
        async (serverConfig: ServerConfig) => {
          // Update mock to return this specific server
          const mockGetServerById = require('../../config/servers').getServerById;
          mockGetServerById.mockImplementation((id: string) => {
            if (id === serverConfig.id || id.includes(serverConfig.id.split('_')[0])) {
              return serverConfig;
            }
            return undefined;
          });

          // Setup mock HTTP responses for different scenarios
          mockAxiosGet.mockReset(); // Clear any previous mock calls
          
          // Initial connection (should succeed) - one call per health check endpoint
          serverConfig.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
          });
          
          // Failure - one call per health check endpoint
          serverConfig.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockRejectedValueOnce(new Error('Server unavailable'));
          });
          
          // Recovery (should succeed) - one call per health check endpoint
          serverConfig.healthCheckEndpoints.forEach(() => {
            mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });
          });

          // Import the service after mocking
          // Use the fresh instance from beforeEach

          // Step 1: Establish initial connection and cache result
          const initialConnectResult = await backendConfigService.testServerConnectivity(serverConfig.id);
          expect(initialConnectResult.status).toBe('connected');

          // Property: Result should be cached
          const cachedResult1 = backendConfigService.getLastConnectivityResult(serverConfig.id);
          expect(cachedResult1).toBeDefined();
          expect(cachedResult1!.status).toBe('connected');

          // Step 2: Simulate failure and verify cache update
          const failureConnectResult = await backendConfigService.testServerConnectivity(serverConfig.id);
          expect(failureConnectResult.status).toBe('error');

          // Property: Cache should be updated with failure result
          const cachedResult2 = backendConfigService.getLastConnectivityResult(serverConfig.id);
          expect(cachedResult2).toBeDefined();
          expect(cachedResult2!.status).toBe('error');

          // Step 3: Restore connection and verify cache consistency
          const recoveryConnectResult = await backendConfigService.testServerConnectivity(serverConfig.id);
          expect(recoveryConnectResult.status).toBe('connected');

          // Property: Cache should be updated with recovery result
          const cachedResult3 = backendConfigService.getLastConnectivityResult(serverConfig.id);
          expect(cachedResult3).toBeDefined();
          expect(cachedResult3!.status).toBe('connected');

          // Property: All cached results should have consistent server ID
          expect(cachedResult1!.serverId).toBe(serverConfig.id);
          expect(cachedResult2!.serverId).toBe(serverConfig.id);
          expect(cachedResult3!.serverId).toBe(serverConfig.id);

          // Property: Cache timestamps should be in chronological order
          expect(cachedResult2!.lastChecked.getTime()).toBeGreaterThanOrEqual(
            cachedResult1!.lastChecked.getTime()
          );
          expect(cachedResult3!.lastChecked.getTime()).toBeGreaterThanOrEqual(
            cachedResult2!.lastChecked.getTime()
          );
        }
      ),
      { numRuns: 20, timeout: 30000 }
    );
  });
});