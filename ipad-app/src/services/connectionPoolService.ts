/**
 * Connection Pool Service for Performance Optimization
 * 
 * This service implements connection pooling for health checks and server connectivity testing
 * to improve performance and reduce overhead during server switching operations.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ServerConfig } from '../config/servers';
import { HealthCheckResult } from '../types/settings';
import { 
  loggingService, 
  LogCategory 
} from './loggingService';

interface PooledConnection {
  serverId: string;
  client: AxiosInstance;
  lastUsed: Date;
  activeRequests: number;
  totalRequests: number;
  createdAt: Date;
}

interface ConnectionPoolConfig {
  maxPoolSize: number;
  maxIdleTime: number; // milliseconds
  maxConnectionAge: number; // milliseconds
  requestTimeout: number;
  keepAliveTimeout: number;
  maxConcurrentRequests: number;
}

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalRequests: number;
  averageResponseTime: number;
  hitRate: number;
}

class ConnectionPoolService {
  private pool: Map<string, PooledConnection> = new Map();
  private config: ConnectionPoolConfig;
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    hitRate: 0
  };
  private responseTimes: number[] = [];
  private poolHits = 0;
  private poolMisses = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ConnectionPoolConfig>) {
    this.config = {
      maxPoolSize: 5,
      maxIdleTime: 30000, // 30 seconds
      maxConnectionAge: 300000, // 5 minutes
      requestTimeout: 8000, // 8 seconds
      keepAliveTimeout: 5000, // 5 seconds
      maxConcurrentRequests: 3,
      ...config
    };

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get or create a pooled connection for a server
   */
  async getConnection(server: ServerConfig): Promise<AxiosInstance> {
    const existingConnection = this.pool.get(server.id);
    
    if (existingConnection && this.isConnectionValid(existingConnection)) {
      // Update usage stats
      existingConnection.lastUsed = new Date();
      this.poolHits++;
      
      await loggingService.logDebug(
        LogCategory.CONNECTIVITY_TEST,
        'connection_pool_hit',
        `Using pooled connection for ${server.displayName}`,
        { 
          serverId: server.id,
          activeRequests: existingConnection.activeRequests,
          totalRequests: existingConnection.totalRequests,
          connectionAge: Date.now() - existingConnection.createdAt.getTime()
        },
        undefined,
        server.id,
        server.displayName
      );

      return existingConnection.client;
    }

    // Create new connection
    this.poolMisses++;
    const connection = await this.createConnection(server);
    
    // Remove old connection if it exists
    if (existingConnection) {
      this.removeConnection(server.id);
    }

    // Add to pool if there's space
    if (this.pool.size < this.config.maxPoolSize) {
      this.pool.set(server.id, connection);
      this.updateStats();
      
      await loggingService.logDebug(
        LogCategory.CONNECTIVITY_TEST,
        'connection_pool_create',
        `Created new pooled connection for ${server.displayName}`,
        { 
          serverId: server.id,
          poolSize: this.pool.size,
          maxPoolSize: this.config.maxPoolSize
        },
        undefined,
        server.id,
        server.displayName
      );
    } else {
      // Pool is full, remove oldest connection
      const oldestConnection = this.findOldestConnection();
      if (oldestConnection) {
        this.removeConnection(oldestConnection.serverId);
      }
      this.pool.set(server.id, connection);
      this.updateStats();
    }

    return connection.client;
  }

  /**
   * Perform optimized health check using pooled connections
   */
  async performOptimizedHealthCheck(
    server: ServerConfig,
    endpoints?: string[]
  ): Promise<HealthCheckResult[]> {
    const startTime = Date.now();
    const client = await this.getConnection(server);
    const connection = this.pool.get(server.id);
    
    if (!connection) {
      throw new Error('Failed to get pooled connection');
    }

    const endpointsToTest = endpoints || server.healthCheckEndpoints;
    const results: HealthCheckResult[] = [];

    // Limit concurrent requests per connection
    const maxConcurrent = Math.min(
      this.config.maxConcurrentRequests,
      endpointsToTest.length
    );

    await loggingService.logDebug(
      LogCategory.CONNECTIVITY_TEST,
      'optimized_health_check_start',
      `Starting optimized health check for ${server.displayName}`,
      { 
        serverId: server.id,
        endpointsCount: endpointsToTest.length,
        maxConcurrent,
        pooledConnection: true
      },
      undefined,
      server.id,
      server.displayName
    );

    // Process endpoints in batches to control concurrency
    for (let i = 0; i < endpointsToTest.length; i += maxConcurrent) {
      const batch = endpointsToTest.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (endpoint) => {
        const endpointStartTime = Date.now();
        connection.activeRequests++;
        
        try {
          const response = await client.get(`${server.baseUrl}${endpoint}`, {
            timeout: this.config.requestTimeout,
            headers: {
              'Accept-Language': 'ja',
              'Connection': 'keep-alive',
            },
          });

          const responseTime = Date.now() - endpointStartTime;
          this.recordResponseTime(responseTime);
          
          connection.totalRequests++;
          connection.activeRequests--;

          return {
            endpoint,
            status: 'success' as const,
            responseTime,
          };
        } catch (error: any) {
          const responseTime = Date.now() - endpointStartTime;
          connection.totalRequests++;
          connection.activeRequests--;

          return {
            endpoint,
            status: 'failure' as const,
            responseTime,
            error: this.formatError(error),
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const totalTime = Date.now() - startTime;
    
    await loggingService.logDebug(
      LogCategory.CONNECTIVITY_TEST,
      'optimized_health_check_complete',
      `Optimized health check completed for ${server.displayName}`,
      { 
        serverId: server.id,
        totalTime,
        endpointsCount: results.length,
        successfulCount: results.filter(r => r.status === 'success').length,
        averageResponseTime: results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length
      },
      totalTime,
      server.id,
      server.displayName
    );

    return results;
  }

  /**
   * Perform batch connectivity tests for multiple servers
   */
  async performBatchConnectivityTest(
    servers: ServerConfig[],
    options?: {
      maxConcurrent?: number;
      quickTest?: boolean; // Only test primary health endpoint
    }
  ): Promise<Map<string, HealthCheckResult[]>> {
    const maxConcurrent = options?.maxConcurrent || 2;
    const results = new Map<string, HealthCheckResult[]>();

    await loggingService.logInfo(
      LogCategory.CONNECTIVITY_TEST,
      'batch_connectivity_test_start',
      `Starting batch connectivity test for ${servers.length} servers`,
      { 
        serversCount: servers.length,
        maxConcurrent,
        quickTest: options?.quickTest || false,
        serverIds: servers.map(s => s.id)
      }
    );

    // Process servers in batches to control concurrency
    for (let i = 0; i < servers.length; i += maxConcurrent) {
      const batch = servers.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (server) => {
        try {
          const endpoints = options?.quickTest 
            ? [server.healthCheckEndpoints[0]] 
            : server.healthCheckEndpoints;
            
          const healthResults = await this.performOptimizedHealthCheck(server, endpoints);
          results.set(server.id, healthResults);
        } catch (error: any) {
          // Create error result
          results.set(server.id, [{
            endpoint: server.healthCheckEndpoints[0],
            status: 'failure',
            responseTime: 0,
            error: error.message
          }]);
        }
      });

      await Promise.all(batchPromises);
    }

    await loggingService.logInfo(
      LogCategory.CONNECTIVITY_TEST,
      'batch_connectivity_test_complete',
      `Batch connectivity test completed`,
      { 
        serversCount: servers.length,
        successfulServers: Array.from(results.entries()).filter(([_, results]) => 
          results.some(r => r.status === 'success')
        ).length
      }
    );

    return results;
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): PoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear all pooled connections
   */
  clearPool(): void {
    this.pool.clear();
    this.updateStats();
    
    loggingService.logInfo(
      LogCategory.CONNECTIVITY_TEST,
      'connection_pool_cleared',
      'Connection pool cleared',
      { previousPoolSize: this.stats.totalConnections }
    );
  }

  /**
   * Remove a specific connection from the pool
   */
  removeConnection(serverId: string): void {
    const connection = this.pool.get(serverId);
    if (connection) {
      this.pool.delete(serverId);
      this.updateStats();
      
      loggingService.logDebug(
        LogCategory.CONNECTIVITY_TEST,
        'connection_pool_remove',
        `Removed connection from pool: ${serverId}`,
        { 
          serverId,
          connectionAge: Date.now() - connection.createdAt.getTime(),
          totalRequests: connection.totalRequests
        }
      );
    }
  }

  /**
   * Cleanup and destroy the connection pool
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clearPool();
    
    loggingService.logInfo(
      LogCategory.CONNECTIVITY_TEST,
      'connection_pool_destroyed',
      'Connection pool destroyed'
    );
  }

  // Private methods

  private async createConnection(server: ServerConfig): Promise<PooledConnection> {
    const client = axios.create({
      timeout: this.config.requestTimeout,
      httpsAgent: {
        rejectUnauthorized: false, // For self-signed certificates
        keepAlive: true,
        keepAliveMsecs: this.config.keepAliveTimeout,
      } as any,
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': `timeout=${this.config.keepAliveTimeout / 1000}`,
      },
    });

    return {
      serverId: server.id,
      client,
      lastUsed: new Date(),
      activeRequests: 0,
      totalRequests: 0,
      createdAt: new Date(),
    };
  }

  private isConnectionValid(connection: PooledConnection): boolean {
    const now = Date.now();
    const age = now - connection.createdAt.getTime();
    const idleTime = now - connection.lastUsed.getTime();

    return (
      age < this.config.maxConnectionAge &&
      idleTime < this.config.maxIdleTime &&
      connection.activeRequests < this.config.maxConcurrentRequests
    );
  }

  private findOldestConnection(): PooledConnection | null {
    let oldest: PooledConnection | null = null;
    
    for (const connection of this.pool.values()) {
      if (!oldest || connection.lastUsed < oldest.lastUsed) {
        oldest = connection;
      }
    }
    
    return oldest;
  }

  private updateStats(): void {
    const connections = Array.from(this.pool.values());
    
    this.stats.totalConnections = connections.length;
    this.stats.activeConnections = connections.filter(c => c.activeRequests > 0).length;
    this.stats.idleConnections = connections.filter(c => c.activeRequests === 0).length;
    this.stats.totalRequests = connections.reduce((sum, c) => sum + c.totalRequests, 0);
    
    if (this.responseTimes.length > 0) {
      this.stats.averageResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }
    
    const totalAttempts = this.poolHits + this.poolMisses;
    this.stats.hitRate = totalAttempts > 0 ? (this.poolHits / totalAttempts) * 100 : 0;
  }

  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    // Keep only last 100 response times for average calculation
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }

  private formatError(error: any): string {
    if (error.code === 'ECONNREFUSED') {
      return 'Connection refused';
    } else if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout';
    } else if (error.code === 'ENOTFOUND') {
      return 'Host not found';
    } else if (error.response) {
      return `HTTP ${error.response.status}: ${error.response.statusText}`;
    } else {
      return error.message || 'Unknown error';
    }
  }

  private startCleanup(): void {
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000);
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [serverId, connection] of this.pool.entries()) {
      if (!this.isConnectionValid(connection)) {
        staleConnections.push(serverId);
      }
    }

    if (staleConnections.length > 0) {
      staleConnections.forEach(serverId => {
        this.removeConnection(serverId);
      });

      loggingService.logDebug(
        LogCategory.CONNECTIVITY_TEST,
        'connection_pool_cleanup',
        `Cleaned up ${staleConnections.length} stale connections`,
        { 
          cleanedConnections: staleConnections.length,
          remainingConnections: this.pool.size
        }
      );
    }
  }
}

// Export singleton instance
export const connectionPoolService = new ConnectionPoolService();
export default connectionPoolService;