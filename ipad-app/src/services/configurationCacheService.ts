/**
 * Configuration Cache Service for Performance Optimization
 * 
 * This service implements intelligent caching for server configuration validation
 * and connectivity test results to improve performance during server switching.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServerConfig } from '../config/servers';
import { DetailedConnectionStatus, HealthCheckResult } from '../types/settings';
import { 
  loggingService, 
  LogCategory 
} from './loggingService';

interface CachedValidationResult {
  serverId: string;
  isValid: boolean;
  errors: string[];
  timestamp: Date;
  configHash: string; // Hash of the configuration to detect changes
}

interface CachedConnectivityResult {
  serverId: string;
  status: DetailedConnectionStatus;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
}

interface ConfigurationCacheConfig {
  validationCacheTTL: number; // milliseconds
  connectivityCacheTTL: number; // milliseconds
  maxCacheSize: number;
  enablePersistence: boolean;
  compressionEnabled: boolean;
}

interface CacheStats {
  validationHits: number;
  validationMisses: number;
  connectivityHits: number;
  connectivityMisses: number;
  cacheSize: number;
  hitRate: number;
}

class ConfigurationCacheService {
  private validationCache: Map<string, CachedValidationResult> = new Map();
  private connectivityCache: Map<string, CachedConnectivityResult> = new Map();
  private config: ConfigurationCacheConfig;
  private stats: CacheStats = {
    validationHits: 0,
    validationMisses: 0,
    connectivityHits: 0,
    connectivityMisses: 0,
    cacheSize: 0,
    hitRate: 0
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly VALIDATION_CACHE_KEY = 'config_validation_cache';
  private readonly CONNECTIVITY_CACHE_KEY = 'config_connectivity_cache';

  constructor(config?: Partial<ConfigurationCacheConfig>) {
    this.config = {
      validationCacheTTL: 300000, // 5 minutes
      connectivityCacheTTL: 60000, // 1 minute
      maxCacheSize: 50,
      enablePersistence: true,
      compressionEnabled: false,
      ...config
    };

    this.initialize();
  }

  /**
   * Get cached validation result or validate and cache
   */
  async getCachedValidation(
    server: ServerConfig,
    forceRefresh = false
  ): Promise<{ valid: boolean; errors: string[]; fromCache: boolean }> {
    const configHash = this.generateConfigHash(server);
    const cached = this.validationCache.get(server.id);

    // Check if we can use cached result
    if (!forceRefresh && cached && this.isValidationCacheValid(cached, configHash)) {
      this.stats.validationHits++;
      
      await loggingService.logDebug(
        LogCategory.CONFIGURATION,
        'validation_cache_hit',
        `Using cached validation for ${server.displayName}`,
        { 
          serverId: server.id,
          cacheAge: Date.now() - cached.timestamp.getTime(),
          isValid: cached.isValid
        },
        undefined,
        server.id,
        server.displayName
      );

      return {
        valid: cached.isValid,
        errors: cached.errors,
        fromCache: true
      };
    }

    // Perform validation and cache result
    this.stats.validationMisses++;
    const validationResult = await this.performValidation(server);
    
    const cacheEntry: CachedValidationResult = {
      serverId: server.id,
      isValid: validationResult.valid,
      errors: validationResult.errors,
      timestamp: new Date(),
      configHash
    };

    this.validationCache.set(server.id, cacheEntry);
    this.updateCacheStats();

    // Persist to storage if enabled
    if (this.config.enablePersistence) {
      await this.persistValidationCache();
    }

    await loggingService.logDebug(
      LogCategory.CONFIGURATION,
      'validation_cache_store',
      `Stored validation result for ${server.displayName}`,
      { 
        serverId: server.id,
        isValid: validationResult.valid,
        errorsCount: validationResult.errors.length
      },
      undefined,
      server.id,
      server.displayName
    );

    return {
      valid: validationResult.valid,
      errors: validationResult.errors,
      fromCache: false
    };
  }

  /**
   * Get cached connectivity result or test and cache
   */
  async getCachedConnectivity(
    server: ServerConfig,
    forceRefresh = false,
    customTTL?: number
  ): Promise<{ status: DetailedConnectionStatus; fromCache: boolean }> {
    const cached = this.connectivityCache.get(server.id);
    const ttl = customTTL || this.config.connectivityCacheTTL;

    // Check if we can use cached result
    if (!forceRefresh && cached && this.isConnectivityCacheValid(cached)) {
      this.stats.connectivityHits++;
      
      await loggingService.logDebug(
        LogCategory.CONNECTIVITY_TEST,
        'connectivity_cache_hit',
        `Using cached connectivity for ${server.displayName}`,
        { 
          serverId: server.id,
          cacheAge: Date.now() - cached.timestamp.getTime(),
          status: cached.status.status,
          responseTime: cached.status.responseTime
        },
        undefined,
        server.id,
        server.displayName
      );

      return {
        status: cached.status,
        fromCache: true
      };
    }

    // Perform connectivity test and cache result
    this.stats.connectivityMisses++;
    const connectivityResult = await this.performConnectivityTest(server);
    
    const cacheEntry: CachedConnectivityResult = {
      serverId: server.id,
      status: connectivityResult,
      timestamp: new Date(),
      ttl
    };

    this.connectivityCache.set(server.id, cacheEntry);
    this.updateCacheStats();

    // Persist to storage if enabled
    if (this.config.enablePersistence) {
      await this.persistConnectivityCache();
    }

    await loggingService.logDebug(
      LogCategory.CONNECTIVITY_TEST,
      'connectivity_cache_store',
      `Stored connectivity result for ${server.displayName}`,
      { 
        serverId: server.id,
        status: connectivityResult.status,
        responseTime: connectivityResult.responseTime,
        ttl
      },
      undefined,
      server.id,
      server.displayName
    );

    return {
      status: connectivityResult,
      fromCache: false
    };
  }

  /**
   * Batch validate multiple servers with caching
   */
  async batchValidateServers(
    servers: ServerConfig[],
    forceRefresh = false
  ): Promise<Map<string, { valid: boolean; errors: string[]; fromCache: boolean }>> {
    const results = new Map<string, { valid: boolean; errors: string[]; fromCache: boolean }>();

    await loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'batch_validation_start',
      `Starting batch validation for ${servers.length} servers`,
      { 
        serversCount: servers.length,
        forceRefresh,
        serverIds: servers.map(s => s.id)
      }
    );

    // Process all servers concurrently
    const validationPromises = servers.map(async (server) => {
      try {
        const result = await this.getCachedValidation(server, forceRefresh);
        results.set(server.id, result);
      } catch (error: any) {
        results.set(server.id, {
          valid: false,
          errors: [`Validation failed: ${error.message}`],
          fromCache: false
        });
      }
    });

    await Promise.all(validationPromises);

    const cacheHits = Array.from(results.values()).filter(r => r.fromCache).length;
    
    await loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'batch_validation_complete',
      `Batch validation completed`,
      { 
        serversCount: servers.length,
        cacheHits,
        cacheMisses: servers.length - cacheHits,
        validServers: Array.from(results.values()).filter(r => r.valid).length
      }
    );

    return results;
  }

  /**
   * Preload cache with server configurations
   */
  async preloadCache(servers: ServerConfig[]): Promise<void> {
    await loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'cache_preload_start',
      `Preloading cache for ${servers.length} servers`,
      { serversCount: servers.length }
    );

    // Preload validation cache
    const validationPromises = servers.map(server => 
      this.getCachedValidation(server, false).catch(error => {
        loggingService.logWarning(
          LogCategory.CONFIGURATION,
          'cache_preload_validation_failed',
          `Failed to preload validation for ${server.displayName}`,
          { serverId: server.id, error: error.message },
          server.id,
          server.displayName
        );
      })
    );

    // Preload connectivity cache (with longer TTL for preloading)
    const connectivityPromises = servers.map(server => 
      this.getCachedConnectivity(server, false, this.config.connectivityCacheTTL * 2).catch(error => {
        loggingService.logWarning(
          LogCategory.CONNECTIVITY_TEST,
          'cache_preload_connectivity_failed',
          `Failed to preload connectivity for ${server.displayName}`,
          { serverId: server.id, error: error.message },
          server.id,
          server.displayName
        );
      })
    );

    await Promise.all([...validationPromises, ...connectivityPromises]);

    await loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'cache_preload_complete',
      `Cache preloading completed`,
      { 
        serversCount: servers.length,
        validationCacheSize: this.validationCache.size,
        connectivityCacheSize: this.connectivityCache.size
      }
    );
  }

  /**
   * Invalidate cache for a specific server
   */
  invalidateServer(serverId: string): void {
    const hadValidation = this.validationCache.has(serverId);
    const hadConnectivity = this.connectivityCache.has(serverId);

    this.validationCache.delete(serverId);
    this.connectivityCache.delete(serverId);
    this.updateCacheStats();

    if (hadValidation || hadConnectivity) {
      loggingService.logDebug(
        LogCategory.CONFIGURATION,
        'cache_invalidate_server',
        `Invalidated cache for server: ${serverId}`,
        { 
          serverId,
          hadValidation,
          hadConnectivity
        }
      );
    }
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    const previousSize = this.validationCache.size + this.connectivityCache.size;
    
    this.validationCache.clear();
    this.connectivityCache.clear();
    this.updateCacheStats();

    // Clear persisted cache
    if (this.config.enablePersistence) {
      await AsyncStorage.multiRemove([
        this.VALIDATION_CACHE_KEY,
        this.CONNECTIVITY_CACHE_KEY
      ]);
    }

    await loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'cache_cleared',
      'Configuration cache cleared',
      { previousSize }
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    this.updateCacheStats();
    return { ...this.stats };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<ConfigurationCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'cache_config_updated',
      'Cache configuration updated',
      { newConfig }
    );
  }

  /**
   * Cleanup and destroy the cache service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clearCache();
    
    loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'cache_service_destroyed',
      'Configuration cache service destroyed'
    );
  }

  // Private methods

  private async initialize(): Promise<void> {
    // Load persisted cache if enabled
    if (this.config.enablePersistence) {
      await this.loadPersistedCache();
    }

    // Start periodic cleanup
    this.startCleanup();

    loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'cache_service_initialized',
      'Configuration cache service initialized',
      { 
        config: this.config,
        persistenceEnabled: this.config.enablePersistence
      }
    );
  }

  private generateConfigHash(server: ServerConfig): string {
    // Simple hash based on key configuration properties
    const configString = JSON.stringify({
      id: server.id,
      baseUrl: server.baseUrl,
      wsUrl: server.wsUrl,
      healthCheckEndpoints: server.healthCheckEndpoints,
      connectionTimeout: server.connectionTimeout,
      retryAttempts: server.retryAttempts
    });
    
    // Simple hash function (in production, consider using a proper hash library)
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  private isValidationCacheValid(cached: CachedValidationResult, currentHash: string): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    return (
      age < this.config.validationCacheTTL &&
      cached.configHash === currentHash
    );
  }

  private isConnectivityCacheValid(cached: CachedConnectivityResult): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    return age < cached.ttl;
  }

  private async performValidation(server: ServerConfig): Promise<{ valid: boolean; errors: string[] }> {
    // Basic validation logic (this would typically import from the config validation)
    const errors: string[] = [];

    if (!server.id || server.id.trim() === '') {
      errors.push('Server ID is required');
    }

    if (!server.baseUrl || server.baseUrl.trim() === '') {
      errors.push('Base URL is required');
    } else {
      try {
        new URL(server.baseUrl);
      } catch {
        errors.push('Base URL must be a valid URL');
      }
    }

    if (!server.wsUrl || server.wsUrl.trim() === '') {
      errors.push('WebSocket URL is required');
    } else {
      try {
        new URL(server.wsUrl);
      } catch {
        errors.push('WebSocket URL must be a valid URL');
      }
    }

    if (!server.healthCheckEndpoints || server.healthCheckEndpoints.length === 0) {
      errors.push('At least one health check endpoint is required');
    }

    if (server.connectionTimeout <= 0) {
      errors.push('Connection timeout must be positive');
    }

    if (server.retryAttempts < 0) {
      errors.push('Retry attempts cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async performConnectivityTest(server: ServerConfig): Promise<DetailedConnectionStatus> {
    // This would typically use the connection pool service or backend config service
    // For now, we'll create a simplified version
    const startTime = Date.now();
    
    try {
      // Import axios here to avoid circular dependencies
      const axios = require('axios');
      
      const client = axios.create({
        timeout: server.connectionTimeout,
        httpsAgent: { rejectUnauthorized: false } as any,
      });

      const healthChecks: HealthCheckResult[] = [];

      // Test primary health endpoint only for cache
      const primaryEndpoint = server.healthCheckEndpoints[0];
      const endpointStartTime = Date.now();
      
      try {
        const response = await client.get(`${server.baseUrl}${primaryEndpoint}`);
        healthChecks.push({
          endpoint: primaryEndpoint,
          status: 'success',
          responseTime: Date.now() - endpointStartTime,
        });
      } catch (error: any) {
        healthChecks.push({
          endpoint: primaryEndpoint,
          status: 'failure',
          responseTime: Date.now() - endpointStartTime,
          error: error.message,
        });
      }

      const totalTime = Date.now() - startTime;
      const hasSuccess = healthChecks.some(check => check.status === 'success');

      return {
        serverId: server.id,
        status: hasSuccess ? 'connected' : 'error',
        lastChecked: new Date(),
        responseTime: totalTime,
        healthChecks,
        errorMessage: hasSuccess ? undefined : 'Health check failed'
      };

    } catch (error: any) {
      return {
        serverId: server.id,
        status: 'error',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message,
        healthChecks: [],
      };
    }
  }

  private updateCacheStats(): void {
    this.stats.cacheSize = this.validationCache.size + this.connectivityCache.size;
    
    const totalAttempts = this.stats.validationHits + this.stats.validationMisses + 
                         this.stats.connectivityHits + this.stats.connectivityMisses;
    const totalHits = this.stats.validationHits + this.stats.connectivityHits;
    
    this.stats.hitRate = totalAttempts > 0 ? (totalHits / totalAttempts) * 100 : 0;
  }

  private async persistValidationCache(): Promise<void> {
    try {
      const cacheData = Array.from(this.validationCache.entries()).map(([key, value]) => ({
        key,
        value: {
          ...value,
          timestamp: value.timestamp.toISOString()
        }
      }));

      await AsyncStorage.setItem(this.VALIDATION_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error: any) {
      loggingService.logWarning(
        LogCategory.CONFIGURATION,
        'cache_persist_validation_failed',
        'Failed to persist validation cache',
        { error: error.message }
      );
    }
  }

  private async persistConnectivityCache(): Promise<void> {
    try {
      const cacheData = Array.from(this.connectivityCache.entries()).map(([key, value]) => ({
        key,
        value: {
          ...value,
          timestamp: value.timestamp.toISOString(),
          status: {
            ...value.status,
            lastChecked: value.status.lastChecked.toISOString()
          }
        }
      }));

      await AsyncStorage.setItem(this.CONNECTIVITY_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error: any) {
      loggingService.logWarning(
        LogCategory.CONNECTIVITY_TEST,
        'cache_persist_connectivity_failed',
        'Failed to persist connectivity cache',
        { error: error.message }
      );
    }
  }

  private async loadPersistedCache(): Promise<void> {
    try {
      // Load validation cache
      const validationData = await AsyncStorage.getItem(this.VALIDATION_CACHE_KEY);
      if (validationData) {
        const parsedData = JSON.parse(validationData);
        for (const { key, value } of parsedData) {
          this.validationCache.set(key, {
            ...value,
            timestamp: new Date(value.timestamp)
          });
        }
      }

      // Load connectivity cache
      const connectivityData = await AsyncStorage.getItem(this.CONNECTIVITY_CACHE_KEY);
      if (connectivityData) {
        const parsedData = JSON.parse(connectivityData);
        for (const { key, value } of parsedData) {
          this.connectivityCache.set(key, {
            ...value,
            timestamp: new Date(value.timestamp),
            status: {
              ...value.status,
              lastChecked: new Date(value.status.lastChecked)
            }
          });
        }
      }

      this.updateCacheStats();

      loggingService.logDebug(
        LogCategory.CONFIGURATION,
        'cache_loaded_from_storage',
        'Cache loaded from persistent storage',
        { 
          validationEntries: this.validationCache.size,
          connectivityEntries: this.connectivityCache.size
        }
      );

    } catch (error: any) {
      loggingService.logWarning(
        LogCategory.CONFIGURATION,
        'cache_load_from_storage_failed',
        'Failed to load cache from storage',
        { error: error.message }
      );
    }
  }

  private startCleanup(): void {
    // Run cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 120000);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean validation cache
    for (const [serverId, cached] of this.validationCache.entries()) {
      const age = now - cached.timestamp.getTime();
      if (age >= this.config.validationCacheTTL) {
        this.validationCache.delete(serverId);
        cleanedCount++;
      }
    }

    // Clean connectivity cache
    for (const [serverId, cached] of this.connectivityCache.entries()) {
      const age = now - cached.timestamp.getTime();
      if (age >= cached.ttl) {
        this.connectivityCache.delete(serverId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.updateCacheStats();
      
      loggingService.logDebug(
        LogCategory.CONFIGURATION,
        'cache_cleanup_expired',
        `Cleaned up ${cleanedCount} expired cache entries`,
        { 
          cleanedCount,
          remainingEntries: this.stats.cacheSize
        }
      );
    }
  }
}

// Export singleton instance
export const configurationCacheService = new ConfigurationCacheService();
export default configurationCacheService;