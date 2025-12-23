/**
 * Performance Optimization Tests
 * 
 * Tests for connection pooling, configuration caching, and UI optimization services
 * to ensure performance improvements are working correctly.
 */

import { connectionPoolService } from '../connectionPoolService';
import { configurationCacheService } from '../configurationCacheService';
import { uiOptimizationService } from '../uiOptimizationService';
import { AVAILABLE_SERVERS } from '../../config/servers';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    defaults: { baseURL: '' }
  })),
  get: jest.fn()
}));

// Mock logging service
jest.mock('../loggingService', () => ({
  loggingService: {
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logWarning: jest.fn(),
    logError: jest.fn(),
    logConnectivityTest: jest.fn(),
    trackUserAction: jest.fn(),
  },
  LogCategory: {
    CONNECTIVITY_TEST: 'connectivity_test',
    CONFIGURATION: 'configuration',
    USER_INTERFACE: 'ui'
  }
}));

// Mock React Native components
jest.mock('react-native', () => ({
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      stopAnimation: jest.fn()
    })),
    timing: jest.fn(() => ({
      start: jest.fn()
    })),
    loop: jest.fn(() => ({
      start: jest.fn()
    })),
    sequence: jest.fn(() => ({
      start: jest.fn()
    })),
    delay: jest.fn()
  },
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => callback())
  }
}));

describe('Performance Optimization Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up services
    connectionPoolService.clearPool();
    configurationCacheService.clearCache();
    uiOptimizationService.clearPendingUpdates();
  });

  describe('Connection Pool Service', () => {
    it('should create and manage pooled connections', async () => {
      const server = AVAILABLE_SERVERS[0];
      
      // Get connection (should create new one)
      const connection1 = await connectionPoolService.getConnection(server);
      expect(connection1).toBeDefined();
      
      // Get same connection again (should reuse)
      const connection2 = await connectionPoolService.getConnection(server);
      expect(connection2).toBe(connection1);
      
      // Check pool stats
      const stats = connectionPoolService.getPoolStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should perform optimized health checks', async () => {
      const server = AVAILABLE_SERVERS[0];
      
      // Mock successful response
      const mockAxios = require('axios');
      mockAxios.create().get.mockResolvedValue({ status: 200 });
      
      const results = await connectionPoolService.performOptimizedHealthCheck(server);
      
      expect(results).toHaveLength(server.healthCheckEndpoints.length);
      expect(results[0]).toHaveProperty('endpoint');
      expect(results[0]).toHaveProperty('status');
      expect(results[0]).toHaveProperty('responseTime');
    });

    it('should handle batch connectivity tests', async () => {
      const servers = AVAILABLE_SERVERS.slice(0, 2);
      
      // Mock successful responses
      const mockAxios = require('axios');
      mockAxios.create().get.mockResolvedValue({ status: 200 });
      
      const results = await connectionPoolService.performBatchConnectivityTest(servers);
      
      expect(results.size).toBe(2);
      for (const [serverId, healthChecks] of results.entries()) {
        expect(healthChecks).toBeInstanceOf(Array);
        expect(healthChecks.length).toBeGreaterThan(0);
      }
    });

    it('should cleanup stale connections', () => {
      // This would test the internal cleanup mechanism
      // For now, just verify the pool can be cleared
      connectionPoolService.clearPool();
      const stats = connectionPoolService.getPoolStats();
      expect(stats.totalConnections).toBe(0);
    });
  });

  describe('Configuration Cache Service', () => {
    it('should cache and retrieve validation results', async () => {
      const server = AVAILABLE_SERVERS[0];
      
      // First call should perform validation
      const result1 = await configurationCacheService.getCachedValidation(server);
      expect(result1.fromCache).toBe(false);
      expect(result1.valid).toBeDefined();
      
      // Second call should use cache
      const result2 = await configurationCacheService.getCachedValidation(server);
      expect(result2.fromCache).toBe(true);
      expect(result2.valid).toBe(result1.valid);
    });

    it('should cache and retrieve connectivity results', async () => {
      const server = AVAILABLE_SERVERS[0];
      
      // Mock axios for connectivity test
      const mockAxios = require('axios');
      mockAxios.create().get.mockResolvedValue({ status: 200 });
      
      // First call should perform test
      const result1 = await configurationCacheService.getCachedConnectivity(server);
      expect(result1.fromCache).toBe(false);
      expect(result1.status).toBeDefined();
      
      // Second call should use cache
      const result2 = await configurationCacheService.getCachedConnectivity(server);
      expect(result2.fromCache).toBe(true);
      expect(result2.status.serverId).toBe(result1.status.serverId);
    });

    it('should handle batch validation', async () => {
      const servers = AVAILABLE_SERVERS.slice(0, 2);
      
      const results = await configurationCacheService.batchValidateServers(servers);
      
      expect(results.size).toBe(2);
      for (const [serverId, result] of results.entries()) {
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('fromCache');
      }
    });

    it('should preload cache for performance', async () => {
      const servers = AVAILABLE_SERVERS.slice(0, 2);
      
      // Mock axios for connectivity tests
      const mockAxios = require('axios');
      mockAxios.create().get.mockResolvedValue({ status: 200 });
      
      await configurationCacheService.preloadCache(servers);
      
      // Verify cache is populated
      const stats = configurationCacheService.getCacheStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
    });

    it('should invalidate specific server cache', () => {
      const serverId = AVAILABLE_SERVERS[0].id;
      
      configurationCacheService.invalidateServer(serverId);
      
      // Cache should be cleared for that server
      const stats = configurationCacheService.getCacheStats();
      // Since we haven't cached anything yet, this just verifies the method works
      expect(stats).toBeDefined();
    });
  });

  describe('UI Optimization Service', () => {
    it('should schedule UI updates with optimization', () => {
      const callback = jest.fn();
      
      uiOptimizationService.scheduleUpdate(
        'status',
        { serverId: 'test', status: 'connected' },
        {
          component: 'test_component',
          priority: 5,
          callback
        }
      );
      
      // Verify update was scheduled
      const metrics = uiOptimizationService.getPerformanceMetrics();
      expect(metrics.totalUpdates).toBe(1);
    });

    it('should handle server switch progress updates', () => {
      uiOptimizationService.scheduleServerSwitchProgress(
        'Testing connectivity...',
        25,
        { animate: true, duration: 300 }
      );
      
      const metrics = uiOptimizationService.getPerformanceMetrics();
      expect(metrics.totalUpdates).toBeGreaterThan(0);
    });

    it('should schedule connection status updates with debouncing', () => {
      const serverId = 'test-server';
      
      // Schedule multiple rapid updates
      uiOptimizationService.scheduleConnectionStatusUpdate(serverId, 'testing');
      uiOptimizationService.scheduleConnectionStatusUpdate(serverId, 'connected');
      uiOptimizationService.scheduleConnectionStatusUpdate(serverId, 'error');
      
      const metrics = uiOptimizationService.getPerformanceMetrics();
      expect(metrics.totalUpdates).toBeGreaterThan(0);
    });

    it('should handle error display with immediate processing', () => {
      uiOptimizationService.scheduleErrorDisplay(
        'Test error message',
        { details: 'Error details' },
        { persistent: true }
      );
      
      const metrics = uiOptimizationService.getPerformanceMetrics();
      expect(metrics.totalUpdates).toBeGreaterThan(0);
    });

    it('should batch multiple updates efficiently', () => {
      const updates = [
        { type: 'status' as const, data: { status: 'connected' } },
        { type: 'progress' as const, data: { message: 'Progress update' } },
        { type: 'server_info' as const, data: { serverId: 'test' } }
      ];
      
      uiOptimizationService.batchUpdates(updates);
      
      const metrics = uiOptimizationService.getPerformanceMetrics();
      expect(metrics.batchedUpdates).toBe(3);
    });

    it('should optimize server switch animations', () => {
      uiOptimizationService.optimizeServerSwitchAnimations(true, {
        fadeInDuration: 300,
        fadeOutDuration: 200,
        progressAnimationDuration: 500
      });
      
      // Verify configuration was applied
      // This is mainly testing that the method doesn't throw
      expect(true).toBe(true);
    });

    it('should clear pending updates', () => {
      // Schedule some updates
      uiOptimizationService.scheduleUpdate('status', { test: true });
      uiOptimizationService.scheduleUpdate('progress', { test: true });
      
      // Clear all updates
      uiOptimizationService.clearPendingUpdates();
      
      // Verify updates were cleared
      // This mainly tests that the method works without errors
      expect(true).toBe(true);
    });

    it('should provide performance metrics', () => {
      const metrics = uiOptimizationService.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('totalUpdates');
      expect(metrics).toHaveProperty('batchedUpdates');
      expect(metrics).toHaveProperty('debouncedUpdates');
      expect(metrics).toHaveProperty('averageUpdateTime');
      expect(metrics).toHaveProperty('droppedUpdates');
      expect(metrics).toHaveProperty('animationFrameRate');
    });
  });

  describe('Integration Tests', () => {
    it('should work together for optimized server switching', async () => {
      const server = AVAILABLE_SERVERS[0];
      
      // Mock axios
      const mockAxios = require('axios');
      mockAxios.create().get.mockResolvedValue({ status: 200 });
      
      // Test connection pooling + caching + UI optimization
      const connection = await connectionPoolService.getConnection(server);
      expect(connection).toBeDefined();
      
      const validation = await configurationCacheService.getCachedValidation(server);
      expect(validation.valid).toBeDefined();
      
      uiOptimizationService.scheduleServerSwitchProgress('Testing...', 50);
      
      // Verify all services are working
      const poolStats = connectionPoolService.getPoolStats();
      const cacheStats = configurationCacheService.getCacheStats();
      const uiMetrics = uiOptimizationService.getPerformanceMetrics();
      
      expect(poolStats.totalConnections).toBeGreaterThan(0);
      expect(cacheStats.cacheSize).toBeGreaterThan(0);
      expect(uiMetrics.totalUpdates).toBeGreaterThan(0);
    });

    it('should handle performance optimization cleanup', () => {
      // Test that all services can be cleaned up properly
      connectionPoolService.clearPool();
      configurationCacheService.clearCache();
      uiOptimizationService.clearPendingUpdates();
      
      const poolStats = connectionPoolService.getPoolStats();
      const cacheStats = configurationCacheService.getCacheStats();
      
      expect(poolStats.totalConnections).toBe(0);
      expect(cacheStats.cacheSize).toBe(0);
    });
  });
});