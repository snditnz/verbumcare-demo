/**
 * Property-Based Tests for Backend Configuration Service - Connectivity Testing
 * 
 * **Feature: backend-switching-settings, Property 2: Connectivity testing completeness**
 * **Validates: Requirements 1.3, 7.1**
 * 
 * Tests that connectivity testing performs comprehensive health checks across all
 * configured endpoints and provides complete status information.
 */

import fc from 'fast-check';
import { ServerConfig } from '../../config/servers';
import { DetailedConnectionStatus, HealthCheckResult } from '../../types/settings';

// Create a mock axios instance that will be returned by axios.create()
const mockAxiosInstance = {
  get: jest.fn(),
  defaults: { baseURL: 'https://test.local/api' },
};

// Mock axios module
jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));

// Mock the auth store
jest.mock('../../stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      tokens: { accessToken: 'mock-token' },
      isAuthenticated: true,
    })),
  },
}));

// Mock the cache service
jest.mock('../cacheService', () => ({
  cacheService: {
    clearCache: jest.fn().mockResolvedValue(undefined),
    clearUserSpecificCache: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the API service
jest.mock('../api', () => ({
  apiService: {
    client: {
      defaults: {
        baseURL: 'https://test.local/api',
      },
    },
  },
}));

// Mock the server config
const mockGetServerById = jest.fn();
jest.mock('../../config/servers', () => ({
  AVAILABLE_SERVERS: [],
  getServerById: mockGetServerById,
  validateServerConfig: jest.fn(() => ({ valid: true, errors: [] })),
}));

describe('Backend Configuration Service - Connectivity Testing Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance.get.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 2: Connectivity testing completeness
   * For any server connectivity test, all configured health check endpoints 
   * should be tested and results should be comprehensive
   */
  it('should test all health check endpoints comprehensively', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate server configurations with various endpoint combinations
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://test-server.local/api'),
          wsUrl: fc.constant('wss://test-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.oneof(
              fc.constant('/health'),
              fc.constant('/api/patients'),
              fc.constant('/api/auth/verify')
            ),
            { minLength: 1, maxLength: 3 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 30000 }),
          retryAttempts: fc.integer({ min: 1, max: 5 }),
        }),
        // Generate success/failure scenarios
        fc.boolean(),
        async (serverConfig: ServerConfig, allSuccessful: boolean) => {
          // Mock the getServerById function to return our test server
          mockGetServerById.mockReturnValue(serverConfig);

          // Clear previous mock calls
          mockAxiosInstance.get.mockClear();
          
          // Mock axios responses for each endpoint
          serverConfig.healthCheckEndpoints.forEach(endpoint => {
            if (allSuccessful) {
              mockAxiosInstance.get.mockResolvedValueOnce({
                status: 200,
                data: { status: 'ok' },
              });
            } else {
              const error = new Error('Network error');
              (error as any).code = 'ECONNREFUSED';
              mockAxiosInstance.get.mockRejectedValueOnce(error);
            }
          });

          // Import and test the actual service
          const { backendConfigService } = require('../backendConfigService');
          const result = await backendConfigService.testServerConnectivity(serverConfig.id);

          // Property: All health check endpoints must be tested
          expect(result.healthChecks).toHaveLength(serverConfig.healthCheckEndpoints.length);

          // Property: Each health check result must correspond to a configured endpoint
          const testedEndpoints = result.healthChecks.map((check: HealthCheckResult) => check.endpoint);
          const sortedTestedEndpoints = [...testedEndpoints].sort();
          const sortedConfigEndpoints = [...serverConfig.healthCheckEndpoints].sort();
          expect(sortedTestedEndpoints).toEqual(sortedConfigEndpoints);

          // Property: Each health check must have a status (success or failure)
          result.healthChecks.forEach((check: HealthCheckResult) => {
            expect(['success', 'failure']).toContain(check.status);
            expect(typeof check.responseTime).toBe('number');
            expect(check.responseTime).toBeGreaterThanOrEqual(0);
          });

          // Property: Overall status must be consistent with individual check results
          const successfulChecks = result.healthChecks.filter((check: HealthCheckResult) => check.status === 'success');
          if (allSuccessful) {
            expect(result.status).toBe('connected');
            expect(successfulChecks).toHaveLength(serverConfig.healthCheckEndpoints.length);
          } else {
            expect(result.status).toBe('error');
            expect(successfulChecks).toHaveLength(0);
            
            // Property: Failed checks must include error information
            const failedChecks = result.healthChecks.filter((check: HealthCheckResult) => check.status === 'failure');
            failedChecks.forEach((check: HealthCheckResult) => {
              expect(typeof check.error).toBe('string');
              expect(check.error!.length).toBeGreaterThan(0);
            });
          }

          // Property: Result must include comprehensive metadata
          expect(result.serverId).toBe(serverConfig.id);
          expect(result.lastChecked).toBeInstanceOf(Date);
          expect(typeof result.responseTime).toBe('number');
          expect(result.responseTime).toBeGreaterThanOrEqual(0);

          // Property: All endpoints must be called exactly once
          expect(mockAxiosInstance.get).toHaveBeenCalledTimes(serverConfig.healthCheckEndpoints.length);

          // Property: Each endpoint must be called with correct URL and headers
          // Note: We check that all expected URLs were called, but not necessarily in order
          const calledUrls = mockAxiosInstance.get.mock.calls.map((call: any[]) => call[0]);
          const expectedUrls = serverConfig.healthCheckEndpoints.map(endpoint => `${serverConfig.baseUrl}${endpoint}`);
          expect(calledUrls.sort()).toEqual(expectedUrls.sort());

          // Property: All calls must include proper headers and timeout
          mockAxiosInstance.get.mock.calls.forEach((call: any[]) => {
            const [url, config] = call;
            expect(config).toMatchObject({
              timeout: serverConfig.connectionTimeout,
              headers: expect.objectContaining({
                'Accept-Language': 'ja',
              }),
            });
          });
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property: Connectivity testing must handle various network conditions gracefully
   */
  it('should handle various network error conditions comprehensively', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate server config
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://test-server.local/api'),
          wsUrl: fc.constant('wss://test-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.constant('/health'),
            { minLength: 1, maxLength: 2 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 10000 }),
          retryAttempts: fc.integer({ min: 1, max: 3 }),
        }),
        // Generate various error conditions
        fc.oneof(
          fc.constant('ECONNREFUSED'),
          fc.constant('ETIMEDOUT'),
          fc.constant('ENOTFOUND')
        ),
        async (serverConfig: ServerConfig, errorCode: string) => {
          // Mock the getServerById function to return our test server
          mockGetServerById.mockReturnValue(serverConfig);

          // Clear previous mock calls
          mockAxiosInstance.get.mockClear();
          
          // Mock axios to throw specific errors
          serverConfig.healthCheckEndpoints.forEach(() => {
            const error = new Error('Network error');
            (error as any).code = errorCode;
            mockAxiosInstance.get.mockRejectedValueOnce(error);
          });

          // Import and test the actual service
          const { backendConfigService } = require('../backendConfigService');
          const result = await backendConfigService.testServerConnectivity(serverConfig.id);

          // Property: Must handle all error conditions gracefully
          expect(result.status).toBe('error');
          expect(result.errorMessage).toBeDefined();
          expect(result.errorMessage!.length).toBeGreaterThan(0);

          // Property: All endpoints must still be tested even when failing
          expect(result.healthChecks).toHaveLength(serverConfig.healthCheckEndpoints.length);

          // Property: All health checks must report failure with error details
          result.healthChecks.forEach((check: HealthCheckResult) => {
            expect(check.status).toBe('failure');
            expect(check.error).toBeDefined();
            expect(check.error!.length).toBeGreaterThan(0);
            expect(typeof check.responseTime).toBe('number');
            expect(check.responseTime).toBeGreaterThanOrEqual(0);
          });

          // Property: Error messages must be user-friendly and specific
          result.healthChecks.forEach((check: HealthCheckResult) => {
            const errorMessage = check.error!.toLowerCase();
            switch (errorCode) {
              case 'ECONNREFUSED':
                expect(errorMessage).toContain('connection refused');
                break;
              case 'ETIMEDOUT':
                expect(errorMessage).toContain('timeout');
                break;
              case 'ENOTFOUND':
                expect(errorMessage).toContain('not found');
                break;
            }
          });

          // Property: All endpoints must still be tested even when failing
          expect(mockAxiosInstance.get).toHaveBeenCalledTimes(serverConfig.healthCheckEndpoints.length);
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: Connectivity testing must include authentication headers when available
   */
  it('should include authentication headers in health check requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          baseUrl: fc.constant('https://test-server.local/api'),
          wsUrl: fc.constant('wss://test-server.local'),
          description: fc.string({ maxLength: 200 }),
          isDefault: fc.boolean(),
          healthCheckEndpoints: fc.array(
            fc.oneof(
              fc.constant('/health'),
              fc.constant('/api/auth/verify')
            ),
            { minLength: 1, maxLength: 2 }
          ),
          connectionTimeout: fc.integer({ min: 1000, max: 5000 }),
          retryAttempts: fc.integer({ min: 1, max: 3 }),
        }),
        async (serverConfig: ServerConfig) => {
          // Mock the getServerById function to return our test server
          mockGetServerById.mockReturnValue(serverConfig);

          // Clear previous mock calls
          mockAxiosInstance.get.mockClear();
          
          // Mock successful responses
          serverConfig.healthCheckEndpoints.forEach(() => {
            mockAxiosInstance.get.mockResolvedValueOnce({
              status: 200,
              data: { status: 'ok' },
            });
          });

          // Import and test the actual service
          const { backendConfigService } = require('../backendConfigService');
          const result = await backendConfigService.testServerConnectivity(serverConfig.id);

          // Property: All requests must include proper headers
          expect(mockAxiosInstance.get).toHaveBeenCalledTimes(serverConfig.healthCheckEndpoints.length);
          
          // Property: Each call must include authentication and language headers
          mockAxiosInstance.get.mock.calls.forEach((call: any[]) => {
            const [url, config] = call;
            expect(config.headers).toMatchObject({
              'Authorization': 'Bearer mock-token',
              'Accept-Language': 'ja',
            });
            expect(config.timeout).toBe(serverConfig.connectionTimeout);
          });

          // Property: All health checks must succeed
          expect(result.healthChecks).toHaveLength(serverConfig.healthCheckEndpoints.length);
          result.healthChecks.forEach((check: HealthCheckResult) => {
            expect(check.status).toBe('success');
            expect(typeof check.responseTime).toBe('number');
            expect(check.responseTime).toBeGreaterThanOrEqual(0);
          });

          // Property: Overall status must be connected when all checks pass
          expect(result.status).toBe('connected');
          expect(result.serverId).toBe(serverConfig.id);
          expect(result.lastChecked).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 20, timeout: 30000 }
    );
  });
});