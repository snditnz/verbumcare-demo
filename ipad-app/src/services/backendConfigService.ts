/**
 * Backend Configuration Service
 * 
 * This service manages backend server configuration, connectivity testing,
 * API client reconfiguration, cache management during server switches,
 * and authentication re-establishment handling.
 */

import axios, { AxiosInstance } from 'axios';
import { ServerConfig, AVAILABLE_SERVERS, getServerById, validateServerConfig } from '../config/servers';
import { 
  DetailedConnectionStatus, 
  HealthCheckResult, 
  ConnectionStatus,
  UserPreferences 
} from '../types/settings';
import { cacheService } from './cacheService';
import { useAuthStore } from '../stores/authStore';
import { apiService } from './api';
import { 
  errorHandlingService, 
  ErrorType, 
  EnhancedError, 
  OperationResult,
  FallbackStrategy 
} from './errorHandlingService';
import { 
  loggingService, 
  LogCategory, 
  LogLevel 
} from './loggingService';
import { connectionPoolService } from './connectionPoolService';
import { configurationCacheService } from './configurationCacheService';
import { uiOptimizationService } from './uiOptimizationService';

export interface BackendConfigServiceInterface {
  // Server configuration management
  loadServerConfigurations(): Promise<ServerConfig[]>;
  validateServerConfiguration(config: ServerConfig): Promise<{ valid: boolean; errors: string[] }>;
  
  // Connectivity testing
  testServerConnectivity(serverId: string, preferences?: UserPreferences): Promise<DetailedConnectionStatus>;
  performHealthChecks(server: ServerConfig, timeout?: number): Promise<HealthCheckResult[]>;
  
  // API client reconfiguration
  reconfigureAPIClient(server: ServerConfig): Promise<void>;
  updateAPIBaseURL(baseUrl: string): void;
  
  // Cache management during server switches
  clearServerSpecificCache(): Promise<void>;
  preserveUserPreferences(): Promise<void>;
  restoreCacheForServer(serverId: string): Promise<void>;
  
  // Authentication re-establishment
  reestablishAuthentication(server: ServerConfig): Promise<boolean>;
  verifyAuthenticationOnServer(server: ServerConfig): Promise<boolean>;
  handleAuthenticationFailure(server: ServerConfig): Promise<void>;
}

class BackendConfigService implements BackendConfigServiceInterface {
  private testClient: AxiosInstance;
  private serverConfigCache: Map<string, ServerConfig> = new Map();
  private lastConnectivityResults: Map<string, DetailedConnectionStatus> = new Map();
  private preservedPreferences: Record<string, any> = {};

  constructor() {
    // Create a separate axios instance for testing to avoid interfering with main API
    this.testClient = axios.create({
      timeout: 10000,
      httpsAgent: {
        rejectUnauthorized: false, // For self-signed certificates
      } as any,
    });

    // Initialize server config cache
    this.initializeServerConfigCache();
  }

  private initializeServerConfigCache(): void {
    AVAILABLE_SERVERS.forEach(server => {
      this.serverConfigCache.set(server.id, server);
    });
  }

  // Server configuration management
  async loadServerConfigurations(): Promise<ServerConfig[]> {
    try {
      await loggingService.logInfo(
        LogCategory.CONFIGURATION,
        'load_server_configs',
        'Loading server configurations...'
      );

      // In a real implementation, this might load from a remote config service
      // For now, we return the statically defined servers with validation
      const validatedServers: ServerConfig[] = [];
      
      for (const server of AVAILABLE_SERVERS) {
        const validation = validateServerConfig(server);
        if (validation.valid) {
          validatedServers.push(server);
          this.serverConfigCache.set(server.id, server);
          
          await loggingService.logDebug(
            LogCategory.CONFIGURATION,
            'server_config_validated',
            `Server configuration validated: ${server.displayName}`,
            { serverId: server.id, baseUrl: server.baseUrl },
            undefined,
            server.id,
            server.displayName
          );
        } else {
          await loggingService.logWarning(
            LogCategory.CONFIGURATION,
            'server_config_invalid',
            `Invalid server configuration: ${server.displayName}`,
            { serverId: server.id, errors: validation.errors },
            server.id,
            server.displayName
          );
          console.warn(`Invalid server configuration for ${server.id}:`, validation.errors);
        }
      }

      if (validatedServers.length === 0) {
        const error = new Error('No valid server configurations found');
        await loggingService.logCritical(
          LogCategory.CONFIGURATION,
          'load_server_configs',
          'No valid server configurations found',
          {
            type: ErrorType.CONFIGURATION_ERROR,
            severity: 'CRITICAL' as any,
            message: error.message,
            suggestedActions: ['Check server configuration files', 'Contact system administrator'],
            isRetryable: false,
            timestamp: new Date()
          }
        );
        throw error;
      }

      await loggingService.logInfo(
        LogCategory.CONFIGURATION,
        'load_server_configs',
        `Successfully loaded ${validatedServers.length} valid server configurations`,
        { validatedCount: validatedServers.length, totalCount: AVAILABLE_SERVERS.length }
      );

      console.log(`✅ Loaded ${validatedServers.length} valid server configurations`);
      return validatedServers;
    } catch (error: any) {
      await loggingService.logError(
        LogCategory.CONFIGURATION,
        'load_server_configs',
        'Failed to load server configurations',
        {
          type: ErrorType.CONFIGURATION_ERROR,
          severity: 'HIGH' as any,
          message: error.message,
          suggestedActions: ['Check configuration files', 'Restart application', 'Contact support'],
          isRetryable: true,
          timestamp: new Date()
        },
        { originalError: error.message }
      );
      console.error('❌ Failed to load server configurations:', error);
      throw new Error(`Failed to load server configurations: ${error.message}`);
    }
  }

  async validateServerConfiguration(config: ServerConfig): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Use cached validation for performance
      const cachedResult = await configurationCacheService.getCachedValidation(config, false);
      
      if (cachedResult.fromCache) {
        await loggingService.logDebug(
          LogCategory.CONFIGURATION,
          'server_validation_cached',
          `Using cached validation for ${config.displayName}`,
          { 
            serverId: config.id,
            isValid: cachedResult.valid,
            errorsCount: cachedResult.errors.length
          },
          undefined,
          config.id,
          config.displayName
        );

        return {
          valid: cachedResult.valid,
          errors: cachedResult.errors
        };
      }

      // If not cached or cache miss, perform full validation including connectivity
      if (cachedResult.valid) {
        // Basic validation passed, now test actual connectivity
        const connectivityTest = await this.testServerConnectivity(config.id);
        
        if (connectivityTest.status === 'error') {
          return {
            valid: false,
            errors: [`Server connectivity failed: ${connectivityTest.errorMessage}`]
          };
        }
      }

      return { 
        valid: cachedResult.valid, 
        errors: cachedResult.errors 
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  // Connectivity testing
  async testServerConnectivity(
    serverId: string, 
    preferences?: UserPreferences
  ): Promise<DetailedConnectionStatus> {
    const startTime = Date.now();
    const server = getServerById(serverId);
    
    if (!server) {
      const errorStatus: DetailedConnectionStatus = {
        serverId,
        status: 'error',
        lastChecked: new Date(),
        errorMessage: `Server configuration not found: ${serverId}`,
        healthChecks: [],
      };

      await loggingService.logError(
        LogCategory.CONNECTIVITY_TEST,
        'connectivity_test',
        `Server configuration not found: ${serverId}`,
        {
          type: ErrorType.CONFIGURATION_ERROR,
          severity: 'HIGH' as any,
          message: `Server configuration not found: ${serverId}`,
          suggestedActions: ['Check server ID', 'Verify server configuration'],
          isRetryable: false,
          timestamp: new Date()
        },
        { serverId }
      );

      return errorStatus;
    }

    // Try to get cached result first for performance
    const cachedResult = await configurationCacheService.getCachedConnectivity(
      server, 
      false, // Don't force refresh unless explicitly requested
      preferences?.connectionTestTimeout || server.connectionTimeout
    );

    if (cachedResult.fromCache) {
      await loggingService.logInfo(
        LogCategory.CONNECTIVITY_TEST,
        'connectivity_test_cached',
        `Using cached connectivity result for ${server.displayName}`,
        { 
          serverId, 
          status: cachedResult.status.status,
          cacheAge: Date.now() - cachedResult.status.lastChecked.getTime()
        },
        undefined,
        serverId,
        server.displayName
      );

      return cachedResult.status;
    }

    await loggingService.logInfo(
      LogCategory.CONNECTIVITY_TEST,
      'connectivity_test_start',
      `Starting connectivity test for ${server.displayName}`,
      { serverId, baseUrl: server.baseUrl, timeout: preferences?.connectionTestTimeout },
      undefined,
      serverId,
      server.displayName
    );

    console.log(`🔍 Testing connectivity to ${server.displayName} (${server.baseUrl})`);
    
    // Use error handling service for comprehensive retry and timeout handling
    const result = await errorHandlingService.executeWithErrorHandling(
      async () => {
        // Use optimized health checks with connection pooling
        const healthChecks = await connectionPoolService.performOptimizedHealthCheck(
          server,
          server.healthCheckEndpoints
        );
        
        const successfulChecks = healthChecks.filter(check => check.status === 'success');
        
        // Determine overall status based on health check results
        let overallStatus: ConnectionStatus;
        let errorMessage: string | undefined;

        if (successfulChecks.length === 0) {
          throw new Error(`All ${healthChecks.length} health checks failed`);
        } else if (successfulChecks.length < healthChecks.length) {
          overallStatus = 'connected';
          errorMessage = `${healthChecks.length - successfulChecks.length} of ${healthChecks.length} health checks failed`;
        } else {
          overallStatus = 'connected';
        }

        return {
          serverId,
          status: overallStatus,
          lastChecked: new Date(),
          responseTime: 0, // Will be set by error handling service
          errorMessage,
          healthChecks,
        };
      },
      'connectivityTest',
      { serverId, serverName: server.displayName }
    );

    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      const connectionStatus = result.data;
      connectionStatus.responseTime = result.totalDuration;
      
      // Cache the result for future use
      this.lastConnectivityResults.set(serverId, connectionStatus);

      await loggingService.logConnectivityTest(
        serverId,
        server.displayName,
        'automatic',
        connectionStatus,
        duration,
        false,
        {
          attempts: result.attempts,
          successfulHealthChecks: connectionStatus.healthChecks.filter(hc => hc.status === 'success').length,
          totalHealthChecks: connectionStatus.healthChecks.length,
          usedConnectionPool: true
        }
      );

      console.log(`✅ Connectivity test completed for ${server.displayName}:`, {
        status: connectionStatus.status,
        responseTime: connectionStatus.responseTime,
        attempts: result.attempts
      });

      return connectionStatus;
    } else {
      // Handle failure case
      const errorMessage = result.error?.message || 'Connectivity test failed';
      const connectionStatus: DetailedConnectionStatus = {
        serverId,
        status: 'error',
        lastChecked: new Date(),
        responseTime: result.totalDuration,
        errorMessage,
        healthChecks: [],
      };

      this.lastConnectivityResults.set(serverId, connectionStatus);

      await loggingService.logConnectivityTest(
        serverId,
        server.displayName,
        'automatic',
        connectionStatus,
        duration,
        false,
        {
          attempts: result.attempts,
          error: result.error,
          usedConnectionPool: true
        }
      );

      console.error(`❌ Connectivity test failed for ${server.displayName}:`, result.error);
      
      return connectionStatus;
    }
  }

  async performHealthChecks(server: ServerConfig, timeout?: number): Promise<HealthCheckResult[]> {
    // Use optimized health checks with connection pooling
    return await connectionPoolService.performOptimizedHealthCheck(
      server,
      server.healthCheckEndpoints
    );
  }

  private getAuthHeaders(): Record<string, string> {
    const { tokens } = useAuthStore.getState();
    if (tokens?.accessToken) {
      return {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Accept-Language': 'ja',
      };
    }
    return {
      'Accept-Language': 'ja',
    };
  }

  private formatEndpointError(error: any): string {
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

  // API client reconfiguration
  async reconfigureAPIClient(server: ServerConfig): Promise<void> {
    const result = await errorHandlingService.executeWithErrorHandling(
      async () => {
        console.log(`🔧 Reconfiguring API client for ${server.displayName}`);
        
        // Update the API service base URL
        this.updateAPIBaseURL(server.baseUrl);
        
        // Test the new configuration
        const testResult = await this.testServerConnectivity(server.id);
        if (testResult.status === 'error') {
          throw new Error(`API client reconfiguration failed: ${testResult.errorMessage}`);
        }

        console.log(`✅ API client reconfigured successfully for ${server.displayName}`);
      },
      'serverSwitch',
      { serverId: server.id, serverName: server.displayName }
    );

    if (!result.success) {
      const errorMessage = result.error?.message || 'Failed to reconfigure API client';
      console.error(`❌ API client reconfiguration failed:`, result.error);
      throw new Error(errorMessage);
    }
  }

  updateAPIBaseURL(baseUrl: string): void {
    // Update the API service's base URL using the proper method
    try {
      apiService.updateBaseURL(baseUrl);
      console.log(`📡 API base URL updated to: ${baseUrl}`);
    } catch (error: any) {
      console.warn('⚠️ Could not update API base URL:', error.message);
    }
  }

  // Cache management during server switches
  async clearServerSpecificCache(): Promise<void> {
    try {
      console.log('🧹 Clearing server-specific cache...');
      
      // Use the enhanced selective cache clearing
      await cacheService.selectiveCacheClear({
        preserveUserData: true,
        preserveSettings: true,
        preserveSession: true,
        preserveTemplates: true,
        serverSpecificOnly: true
      });
      
      // Clear our internal connectivity results cache
      this.lastConnectivityResults.clear();
      
      console.log('✅ Server-specific cache cleared successfully');
    } catch (error: any) {
      console.error('❌ Failed to clear server-specific cache:', error);
      throw new Error(`Failed to clear cache: ${error.message}`);
    }
  }

  async preserveUserPreferences(): Promise<void> {
    try {
      console.log('💾 Preserving user preferences during server switch...');
      
      // Use the cache service to preserve user preferences
      const preserved = await cacheService.preserveUserPreferences();
      
      // Store preserved preferences temporarily for restoration if needed
      this.preservedPreferences = preserved;
      
      console.log(`✅ User preferences preserved (${Object.keys(preserved).length} entries)`);
    } catch (error: any) {
      console.error('❌ Failed to preserve user preferences:', error);
      throw new Error(`Failed to preserve preferences: ${error.message}`);
    }
  }

  async restoreCacheForServer(serverId: string): Promise<void> {
    try {
      console.log(`🔄 Restoring cache for server: ${serverId}`);
      
      const server = getServerById(serverId);
      if (!server) {
        throw new Error(`Server not found: ${serverId}`);
      }

      // Try to restore from backup first
      const restored = await cacheService.restoreServerCacheBackup(serverId);
      
      if (restored) {
        console.log(`✅ Cache restored from backup for server: ${server.displayName}`);
      } else {
        console.log(`ℹ️ No backup available for server: ${server.displayName}, will rebuild cache`);
      }

      // Warm up the cache with a basic connectivity test
      await this.testServerConnectivity(serverId);
      
      console.log(`✅ Cache restoration completed for server: ${server.displayName}`);
    } catch (error: any) {
      console.error(`❌ Failed to restore cache for server ${serverId}:`, error);
      throw new Error(`Failed to restore cache: ${error.message}`);
    }
  }

  /**
   * Create cache backup before switching servers
   * Implements Requirements 4.2 (cache restoration for previous servers)
   */
  async createCacheBackupForServer(serverId: string): Promise<string> {
    try {
      console.log(`💾 Creating cache backup for server: ${serverId}`);
      
      const backupKey = await cacheService.createServerCacheBackup(serverId);
      
      console.log(`✅ Cache backup created for server: ${serverId}`);
      return backupKey;
    } catch (error: any) {
      console.error(`❌ Failed to create cache backup for server ${serverId}:`, error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Handle cache corruption during server switches
   * Implements Requirements 4.5 (cache corruption recovery)
   */
  async handleCacheCorruption(): Promise<boolean> {
    try {
      console.log('🔧 Handling cache corruption...');
      
      const recoveryResult = await cacheService.recoverFromCacheCorruption();
      
      if (recoveryResult.recovered) {
        console.log(`✅ Cache corruption handled: ${recoveryResult.corruptedKeys.length} corrupted entries, ${recoveryResult.recoveredKeys.length} recovered`);
      } else {
        console.log('ℹ️ No cache corruption detected');
      }

      return recoveryResult.recovered;
    } catch (error: any) {
      console.error('❌ Failed to handle cache corruption:', error);
      return false;
    }
  }

  /**
   * Validate and migrate cache version if needed
   * Implements Requirements 4.5 (cache versioning and compatibility)
   */
  async validateAndMigrateCache(): Promise<boolean> {
    try {
      console.log('🔍 Validating cache version...');
      
      const versionInfo = await cacheService.validateCacheVersion();
      
      if (!versionInfo.valid) {
        if (versionInfo.migrationNeeded) {
          console.log(`🔄 Cache migration needed from version ${versionInfo.cacheVersion} to ${versionInfo.currentVersion}`);
          const migrated = await cacheService.migrateCacheVersion();
          
          if (migrated) {
            console.log('✅ Cache migration completed successfully');
            return true;
          } else {
            console.error('❌ Cache migration failed');
            return false;
          }
        } else {
          console.log('⚠️ Cache version validation failed, clearing cache');
          await cacheService.clearCache();
          return true;
        }
      }

      console.log('✅ Cache version is valid');
      return true;
    } catch (error: any) {
      console.error('❌ Cache validation and migration failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive server switch with cache management
   * Implements all cache management requirements for server switches
   */
  async performServerSwitchWithCacheManagement(
    fromServerId: string, 
    toServerId: string
  ): Promise<{ success: boolean; backupKey?: string; error?: string }> {
    let backupKey: string | undefined;
    
    try {
      console.log(`🔄 Starting comprehensive server switch from ${fromServerId} to ${toServerId}`);
      
      // Step 1: Validate and migrate cache if needed
      const cacheValid = await this.validateAndMigrateCache();
      if (!cacheValid) {
        throw new Error('Cache validation failed');
      }

      // Step 2: Handle any existing cache corruption
      await this.handleCacheCorruption();

      // Step 3: Create backup of current server cache
      backupKey = await this.createCacheBackupForServer(fromServerId);

      // Step 4: Preserve user preferences
      await this.preserveUserPreferences();

      // Step 5: Clear server-specific cache
      await this.clearServerSpecificCache();

      // Step 6: Restore cache for target server (if available)
      await this.restoreCacheForServer(toServerId);

      // Step 7: Clean up old backups
      await cacheService.cleanupServerBackups();

      console.log(`✅ Server switch cache management completed successfully`);
      
      return { success: true, backupKey };
    } catch (error: any) {
      console.error(`❌ Server switch cache management failed:`, error);
      
      // Try to restore preserved preferences on failure
      if (this.preservedPreferences && Object.keys(this.preservedPreferences).length > 0) {
        try {
          await cacheService.restoreUserPreferences(this.preservedPreferences);
          console.log('✅ User preferences restored after cache management failure');
        } catch (restoreError) {
          console.error('❌ Failed to restore user preferences after failure:', restoreError);
        }
      }

      return { success: false, error: error.message, backupKey };
    }
  }

  // Authentication re-establishment
  async reestablishAuthentication(server: ServerConfig): Promise<boolean> {
    const result = await errorHandlingService.executeWithErrorHandling(
      async () => {
        console.log(`🔐 Re-establishing authentication for ${server.displayName}`);
        
        const { isAuthenticated, tokens } = useAuthStore.getState();
        
        if (!isAuthenticated || !tokens?.accessToken) {
          console.log('No existing authentication to re-establish');
          return true; // Not an error - user just needs to log in
        }

        // Verify current token works on new server
        const isValid = await this.verifyAuthenticationOnServer(server);
        
        if (isValid) {
          console.log('✅ Existing authentication is valid on new server');
          return true;
        }

        // Try to refresh the token
        console.log('🔄 Attempting to refresh authentication token...');
        const { refreshToken } = useAuthStore.getState();
        const refreshed = await refreshToken();
        
        if (refreshed) {
          // Verify refreshed token on new server
          const isRefreshedValid = await this.verifyAuthenticationOnServer(server);
          if (isRefreshedValid) {
            console.log('✅ Authentication refreshed and verified on new server');
            return true;
          }
        }

        console.log('⚠️ Authentication re-establishment failed - user will need to log in again');
        return false;
      },
      'authentication',
      { serverId: server.id, serverName: server.displayName }
    );

    if (result.success) {
      return result.data || false;
    } else {
      console.error('❌ Authentication re-establishment failed:', result.error);
      return false;
    }
  }

  async verifyAuthenticationOnServer(server: ServerConfig): Promise<boolean> {
    const result = await errorHandlingService.executeWithErrorHandling(
      async () => {
        const { tokens } = useAuthStore.getState();
        
        if (!tokens?.accessToken) {
          return false;
        }

        // Test authentication by calling a protected endpoint
        const response = await this.testClient.get(`${server.baseUrl}/auth/verify`, {
          timeout: server.connectionTimeout,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Accept-Language': 'ja',
          },
        });

        return response.status === 200;
      },
      'authentication',
      { serverId: server.id, serverName: server.displayName }
    );

    if (result.success) {
      return result.data || false;
    } else {
      console.log(`Authentication verification failed on ${server.displayName}:`, result.error?.message);
      return false;
    }
  }

  async handleAuthenticationFailure(server: ServerConfig): Promise<void> {
    console.log(`🚨 Handling authentication failure for ${server.displayName}`);
    
    const result = await errorHandlingService.handleAuthenticationFailure(
      server.id,
      // Preserve user data operation
      async () => {
        await this.preserveUserPreferences();
      },
      // Clear authentication operation
      async () => {
        const { logout } = useAuthStore.getState();
        await logout();
        await cacheService.clearUserSpecificCache();
      }
    );

    if (result.success) {
      console.log('✅ Authentication failure handled - user needs to log in again');
    } else {
      console.error('❌ Failed to handle authentication failure:', result.error);
      throw new Error(`Failed to handle auth failure: ${result.error?.message}`);
    }
  }

  /**
   * Comprehensive server switch with graceful fallback and error handling
   * Implements Requirements 1.4, 4.3, 4.4, 6.5
   */
  async performComprehensiveServerSwitch(
    fromServerId: string,
    toServerId: string,
    options?: {
      enableFallback?: boolean;
      preserveUserData?: boolean;
      timeoutMs?: number;
      maxRetries?: number;
    }
  ): Promise<OperationResult<{ 
    switchSuccessful: boolean; 
    fallbackUsed: boolean; 
    authenticationRequired: boolean;
    cacheBackupKey?: string;
  }>> {
    const effectiveOptions = {
      enableFallback: true,
      preserveUserData: true,
      timeoutMs: 30000,
      maxRetries: 3,
      ...options
    };

    // Start comprehensive logging for server switch
    const switchLogId = await loggingService.startServerSwitchLog(
      fromServerId,
      toServerId,
      true,
      {
        enableFallback: effectiveOptions.enableFallback,
        preserveUserData: effectiveOptions.preserveUserData,
        timeoutMs: effectiveOptions.timeoutMs,
        maxRetries: effectiveOptions.maxRetries
      }
    );

    await loggingService.logInfo(
      LogCategory.SERVER_SWITCH,
      'comprehensive_server_switch_start',
      `Starting comprehensive server switch: ${fromServerId} → ${toServerId}`,
      {
        switchLogId,
        fromServerId,
        toServerId,
        options: effectiveOptions
      },
      undefined,
      toServerId
    );

    console.log(`🔄 Starting comprehensive server switch from ${fromServerId} to ${toServerId}`);

    // Configure custom retry settings for server switch
    errorHandlingService.updateRetryConfig('serverSwitch', {
      maxAttempts: effectiveOptions.maxRetries,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR, ErrorType.SERVER_ERROR]
    });

    const result = await errorHandlingService.executeWithErrorHandling(
      async () => {
        // Step 1: Validate target server
        await loggingService.logServerSwitchPhase(
          switchLogId,
          'validate_target_server',
          'in_progress',
          'Validating target server configuration'
        );

        const targetServer = getServerById(toServerId);
        if (!targetServer) {
          throw new Error(`Target server not found: ${toServerId}`);
        }

        await loggingService.logServerSwitchPhase(
          switchLogId,
          'validate_target_server',
          'completed',
          `Target server validated: ${targetServer.displayName}`,
          undefined,
          { serverId: toServerId, serverName: targetServer.displayName }
        );

        // Step 2: Test connectivity to target server
        await loggingService.logServerSwitchPhase(
          switchLogId,
          'test_connectivity',
          'in_progress',
          'Testing connectivity to target server'
        );

        console.log('🔍 Testing connectivity to target server...');
        const connectivityResult = await this.testServerConnectivity(toServerId);
        if (connectivityResult.status !== 'connected') {
          throw new Error(`Target server connectivity failed: ${connectivityResult.errorMessage}`);
        }

        await loggingService.logServerSwitchPhase(
          switchLogId,
          'test_connectivity',
          'completed',
          `Connectivity test successful (${connectivityResult.responseTime}ms)`,
          undefined,
          { 
            responseTime: connectivityResult.responseTime,
            healthChecksCount: connectivityResult.healthChecks.length,
            successfulHealthChecks: connectivityResult.healthChecks.filter(hc => hc.status === 'success').length
          }
        );

        // Step 3: Perform cache management
        await loggingService.logServerSwitchPhase(
          switchLogId,
          'cache_management',
          'in_progress',
          'Managing cache during server switch'
        );

        console.log('💾 Managing cache during server switch...');
        const cacheResult = await this.performServerSwitchWithCacheManagement(fromServerId, toServerId);
        if (!cacheResult.success) {
          throw new Error(`Cache management failed: ${cacheResult.error}`);
        }

        await loggingService.logServerSwitchPhase(
          switchLogId,
          'cache_management',
          'completed',
          'Cache management completed successfully',
          undefined,
          { backupKey: cacheResult.backupKey }
        );

        // Step 4: Reconfigure API client
        await loggingService.logServerSwitchPhase(
          switchLogId,
          'reconfigure_api',
          'in_progress',
          'Reconfiguring API client'
        );

        console.log('🔧 Reconfiguring API client...');
        await this.reconfigureAPIClient(targetServer);

        await loggingService.logServerSwitchPhase(
          switchLogId,
          'reconfigure_api',
          'completed',
          'API client reconfigured successfully'
        );

        // Step 5: Re-establish authentication
        await loggingService.logServerSwitchPhase(
          switchLogId,
          'reestablish_auth',
          'in_progress',
          'Re-establishing authentication'
        );

        console.log('🔐 Re-establishing authentication...');
        const authReestablished = await this.reestablishAuthentication(targetServer);

        await loggingService.logServerSwitchPhase(
          switchLogId,
          'reestablish_auth',
          'completed',
          `Authentication ${authReestablished ? 'reestablished' : 'requires user login'}`,
          undefined,
          { authReestablished }
        );

        return {
          switchSuccessful: true,
          fallbackUsed: false,
          authenticationRequired: !authReestablished,
          cacheBackupKey: cacheResult.backupKey
        };
      },
      'serverSwitch',
      { fromServerId, toServerId },
      undefined, // Use default retry config
      effectiveOptions.timeoutMs
    );

    // Handle failure with graceful fallback if enabled
    if (!result.success && effectiveOptions.enableFallback) {
      await loggingService.logServerSwitchPhase(
        switchLogId,
        'graceful_fallback',
        'in_progress',
        'Server switch failed, attempting graceful fallback'
      );

      console.log('🔄 Server switch failed, attempting graceful fallback...');
      
      const fallbackResult = await errorHandlingService.executeGracefulFallback(
        fromServerId,
        toServerId,
        async () => {
          // Restore previous server configuration
          const previousServer = getServerById(fromServerId);
          if (previousServer) {
            await this.reconfigureAPIClient(previousServer);
            await this.restoreCacheForServer(fromServerId);
          }
        },
        {
          enableAutoFallback: true,
          fallbackTimeout: 10000,
          preserveUserData: effectiveOptions.preserveUserData,
          notifyUser: true
        }
      );

      if (fallbackResult.success) {
        await loggingService.logServerSwitchPhase(
          switchLogId,
          'graceful_fallback',
          'completed',
          'Graceful fallback completed successfully'
        );

        await loggingService.completeServerSwitchLog(
          switchLogId,
          false,
          true,
          result.error?.message
        );

        return {
          success: true,
          data: {
            switchSuccessful: false,
            fallbackUsed: true,
            authenticationRequired: false
          },
          attempts: result.attempts + fallbackResult.attempts,
          totalDuration: result.totalDuration + fallbackResult.totalDuration,
          fallbackUsed: true
        };
      } else {
        await loggingService.logServerSwitchPhase(
          switchLogId,
          'graceful_fallback',
          'failed',
          'Graceful fallback failed',
          fallbackResult.error
        );

        // Both switch and fallback failed
        await loggingService.completeServerSwitchLog(
          switchLogId,
          false,
          false,
          `Switch and fallback failed: ${result.error?.message}`
        );

        // Create comprehensive error report
        if (result.error) {
          await loggingService.createErrorReport(
            result.error,
            'comprehensive_server_switch',
            LogCategory.SERVER_SWITCH,
            toServerId,
            getServerById(toServerId)?.displayName
          );
        }

        return {
          success: false,
          error: result.error,
          attempts: result.attempts + fallbackResult.attempts,
          totalDuration: result.totalDuration + fallbackResult.totalDuration,
          fallbackUsed: true
        };
      }
    }

    // Complete server switch logging
    if (result.success) {
      await loggingService.completeServerSwitchLog(
        switchLogId,
        true,
        false
      );
    } else {
      await loggingService.completeServerSwitchLog(
        switchLogId,
        false,
        false,
        result.error?.message
      );

      // Create comprehensive error report for failed switch
      if (result.error) {
        await loggingService.createErrorReport(
          result.error,
          'comprehensive_server_switch',
          LogCategory.SERVER_SWITCH,
          toServerId,
          getServerById(toServerId)?.displayName
        );
      }
    }

    return result;
  }

  /**
   * Get enhanced error information for user display
   */
  getLastEnhancedError(): EnhancedError | null {
    // This would typically be stored in the service state
    // For now, return null - in a full implementation, we'd track the last error
    return null;
  }

  /**
   * Configure error handling behavior
   */
  configureErrorHandling(config: {
    retryAttempts?: number;
    timeoutMs?: number;
    enableFallback?: boolean;
    enableDetailedLogging?: boolean;
  }): void {
    if (config.retryAttempts !== undefined) {
      errorHandlingService.updateRetryConfig('serverSwitch', {
        maxAttempts: config.retryAttempts,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR, ErrorType.SERVER_ERROR]
      });
    }

    if (config.timeoutMs !== undefined) {
      errorHandlingService.updateTimeoutConfig({
        serverSwitch: config.timeoutMs,
        connectionTest: Math.min(config.timeoutMs / 3, 10000),
        authentication: Math.min(config.timeoutMs / 2, 15000),
        cacheOperation: Math.min(config.timeoutMs / 6, 5000),
        healthCheck: Math.min(config.timeoutMs / 4, 8000)
      });
    }

    if (config.enableFallback !== undefined) {
      errorHandlingService.setFallbackStrategy('serverSwitch', {
        enableAutoFallback: config.enableFallback,
        fallbackTimeout: 10000,
        preserveUserData: true,
        notifyUser: true
      });
    }

    console.log('✅ Error handling configuration updated:', config);
  }

  /**
   * Batch test connectivity for multiple servers with optimization
   */
  async batchTestConnectivity(
    serverIds: string[],
    options?: {
      maxConcurrent?: number;
      quickTest?: boolean;
      useCache?: boolean;
    }
  ): Promise<Map<string, DetailedConnectionStatus>> {
    const servers = serverIds.map(id => getServerById(id)).filter(Boolean) as ServerConfig[];
    const results = new Map<string, DetailedConnectionStatus>();

    if (servers.length === 0) {
      return results;
    }

    await loggingService.logInfo(
      LogCategory.CONNECTIVITY_TEST,
      'batch_connectivity_test_start',
      `Starting batch connectivity test for ${servers.length} servers`,
      { 
        serverIds,
        maxConcurrent: options?.maxConcurrent || 2,
        quickTest: options?.quickTest || false,
        useCache: options?.useCache !== false
      }
    );

    // Use connection pool service for optimized batch testing
    const healthResults = await connectionPoolService.performBatchConnectivityTest(
      servers,
      {
        maxConcurrent: options?.maxConcurrent || 2,
        quickTest: options?.quickTest || false
      }
    );

    // Convert health check results to detailed connection status
    for (const [serverId, healthChecks] of healthResults.entries()) {
      const server = getServerById(serverId);
      if (!server) continue;

      const successfulChecks = healthChecks.filter(check => check.status === 'success');
      const overallStatus: ConnectionStatus = successfulChecks.length > 0 ? 'connected' : 'error';
      const totalResponseTime = healthChecks.reduce((sum, check) => sum + (check.responseTime || 0), 0);

      const connectionStatus: DetailedConnectionStatus = {
        serverId,
        status: overallStatus,
        lastChecked: new Date(),
        responseTime: totalResponseTime / healthChecks.length,
        healthChecks,
        errorMessage: overallStatus === 'error' 
          ? `${healthChecks.length - successfulChecks.length} of ${healthChecks.length} health checks failed`
          : undefined
      };

      results.set(serverId, connectionStatus);
      
      // Cache the result
      this.lastConnectivityResults.set(serverId, connectionStatus);
    }

    await loggingService.logInfo(
      LogCategory.CONNECTIVITY_TEST,
      'batch_connectivity_test_complete',
      `Batch connectivity test completed`,
      { 
        serversCount: servers.length,
        successfulServers: Array.from(results.values()).filter(status => status.status === 'connected').length,
        totalTime: Date.now()
      }
    );

    return results;
  }

  /**
   * Preload and cache server configurations for performance
   */
  async preloadServerConfigurations(): Promise<void> {
    await loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'preload_server_configs_start',
      'Preloading server configurations for performance optimization'
    );

    try {
      // Preload configuration cache
      await configurationCacheService.preloadCache(AVAILABLE_SERVERS);

      // Preload connection pool
      const preloadPromises = AVAILABLE_SERVERS.map(async (server) => {
        try {
          await connectionPoolService.getConnection(server);
        } catch (error) {
          // Ignore individual server connection failures during preload
          console.warn(`Failed to preload connection for ${server.displayName}:`, error);
        }
      });

      await Promise.all(preloadPromises);

      await loggingService.logInfo(
        LogCategory.CONFIGURATION,
        'preload_server_configs_complete',
        'Server configuration preloading completed',
        { 
          serversCount: AVAILABLE_SERVERS.length,
          cacheStats: configurationCacheService.getCacheStats(),
          poolStats: connectionPoolService.getPoolStats()
        }
      );

      console.log('✅ Server configurations preloaded for optimal performance');
    } catch (error: any) {
      await loggingService.logError(
        LogCategory.CONFIGURATION,
        'preload_server_configs_failed',
        'Failed to preload server configurations',
        {
          type: ErrorType.CONFIGURATION_ERROR,
          severity: 'MEDIUM' as any,
          message: error.message,
          suggestedActions: ['Retry preloading', 'Check network connectivity'],
          isRetryable: true,
          timestamp: new Date()
        },
        { originalError: error.message }
      );

      console.error('❌ Failed to preload server configurations:', error);
    }
  }

  /**
   * Get performance statistics for optimization monitoring
   */
  getPerformanceStats(): {
    connectionPool: any;
    configurationCache: any;
    lastConnectivityResults: number;
  } {
    return {
      connectionPool: connectionPoolService.getPoolStats(),
      configurationCache: configurationCacheService.getCacheStats(),
      lastConnectivityResults: this.lastConnectivityResults.size
    };
  }

  /**
   * Clear all performance caches
   */
  clearPerformanceCaches(): void {
    connectionPoolService.clearPool();
    configurationCacheService.clearCache();
    this.lastConnectivityResults.clear();

    loggingService.logInfo(
      LogCategory.CONFIGURATION,
      'performance_caches_cleared',
      'All performance optimization caches cleared'
    );
  }

  // Utility methods
  getLastConnectivityResult(serverId: string): DetailedConnectionStatus | undefined {
    return this.lastConnectivityResults.get(serverId);
  }

  getCachedServerConfig(serverId: string): ServerConfig | undefined {
    return this.serverConfigCache.get(serverId);
  }

  clearConnectivityCache(): void {
    this.lastConnectivityResults.clear();
  }
}

// Export singleton instance
export const backendConfigService = new BackendConfigService();
export default backendConfigService;