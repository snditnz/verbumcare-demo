/**
 * Comprehensive Error Handling Service for Backend Switching
 * 
 * This service provides centralized error handling, retry logic, timeout management,
 * and graceful fallback mechanisms for server switching operations.
 * 
 * Implements Requirements:
 * - 1.4: Graceful fallback to previous server on failures
 * - 4.3: Timeout handling with configurable retry attempts
 * - 4.4: Automatic retry with exponential backoff
 * - 6.5: Clear error messages with suggested actions
 */

import { ServerConfig } from '../config/servers';
import { ConnectionStatus, DetailedConnectionStatus } from '../types/settings';

/**
 * Error types for categorizing different failure scenarios
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Retry configuration for different operation types
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay cap
  backoffMultiplier: number; // Exponential backoff multiplier
  jitter: boolean; // Add random jitter to prevent thundering herd
  retryableErrors: ErrorType[]; // Which error types should trigger retries
}

/**
 * Timeout configuration for different operations
 */
export interface TimeoutConfig {
  connectionTest: number;
  serverSwitch: number;
  authentication: number;
  cacheOperation: number;
  healthCheck: number;
}

/**
 * Enhanced error information with recovery suggestions
 */
export interface EnhancedError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  suggestedActions: string[];
  isRetryable: boolean;
  context?: Record<string, any>;
  timestamp: Date;
}

/**
 * Fallback strategy configuration
 */
export interface FallbackStrategy {
  enableAutoFallback: boolean;
  fallbackServerId?: string;
  fallbackTimeout: number;
  preserveUserData: boolean;
  notifyUser: boolean;
}

/**
 * Operation result with comprehensive error information
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: EnhancedError;
  attempts: number;
  totalDuration: number;
  fallbackUsed: boolean;
}

/**
 * Default retry configurations for different operations
 */
const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  serverSwitch: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR, ErrorType.SERVER_ERROR]
  },
  connectivityTest: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR]
  },
  authentication: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 1.5,
    jitter: false,
    retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR]
  },
  cacheOperation: {
    maxAttempts: 3,
    baseDelay: 200,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [ErrorType.CACHE_ERROR, ErrorType.TIMEOUT_ERROR]
  }
};

/**
 * Default timeout configurations
 */
const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  connectionTest: 10000, // 10 seconds
  serverSwitch: 30000, // 30 seconds
  authentication: 15000, // 15 seconds
  cacheOperation: 5000, // 5 seconds
  healthCheck: 8000 // 8 seconds
};

/**
 * Comprehensive Error Handling Service
 */
class ErrorHandlingService {
  private retryConfigs: Record<string, RetryConfig>;
  private timeoutConfig: TimeoutConfig;
  private fallbackStrategies: Map<string, FallbackStrategy> = new Map();

  constructor() {
    this.retryConfigs = { ...DEFAULT_RETRY_CONFIGS };
    this.timeoutConfig = { ...DEFAULT_TIMEOUT_CONFIG };
    this.initializeFallbackStrategies();
  }

  /**
   * Initialize default fallback strategies
   */
  private initializeFallbackStrategies(): void {
    this.fallbackStrategies.set('default', {
      enableAutoFallback: true,
      fallbackTimeout: 5000,
      preserveUserData: true,
      notifyUser: true
    });
  }

  /**
   * Execute an operation with comprehensive error handling, retries, and timeouts
   */
  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationType: string,
    context?: Record<string, any>,
    customRetryConfig?: Partial<RetryConfig>,
    customTimeout?: number
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    const retryConfig = { ...this.retryConfigs[operationType], ...customRetryConfig };
    const timeout = customTimeout || this.getTimeoutForOperation(operationType);
    
    let lastError: EnhancedError | undefined;
    let attempts = 0;

    console.log(`🔄 Starting ${operationType} with error handling:`, {
      maxAttempts: retryConfig.maxAttempts,
      timeout,
      context
    });

    for (attempts = 1; attempts <= retryConfig.maxAttempts; attempts++) {
      try {
        console.log(`  📝 Attempt ${attempts}/${retryConfig.maxAttempts} for ${operationType}`);
        
        // Execute operation with timeout
        const result = await this.executeWithTimeout(operation, timeout);
        
        const totalDuration = Date.now() - startTime;
        console.log(`✅ ${operationType} succeeded on attempt ${attempts} (${totalDuration}ms)`);
        
        return {
          success: true,
          data: result,
          attempts,
          totalDuration,
          fallbackUsed: false
        };

      } catch (error: any) {
        const enhancedError = this.enhanceError(error, operationType, context);
        lastError = enhancedError;
        
        console.log(`❌ ${operationType} failed on attempt ${attempts}:`, {
          type: enhancedError.type,
          message: enhancedError.message,
          isRetryable: enhancedError.isRetryable
        });

        // Check if we should retry
        if (attempts < retryConfig.maxAttempts && this.shouldRetry(enhancedError, retryConfig)) {
          const delay = this.calculateRetryDelay(attempts, retryConfig);
          console.log(`⏳ Retrying ${operationType} in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        // No more retries or error is not retryable
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`💥 ${operationType} failed after ${attempts} attempts (${totalDuration}ms)`);

    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration,
      fallbackUsed: false
    };
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Enhance error with additional context and recovery suggestions
   */
  enhanceError(
    error: any,
    operationType: string,
    context?: Record<string, any>
  ): EnhancedError {
    const errorType = this.categorizeError(error);
    const severity = this.determineSeverity(errorType, operationType);
    const suggestedActions = this.getSuggestedActions(errorType, operationType, context);
    const isRetryable = this.isErrorRetryable(errorType, operationType);

    return {
      type: errorType,
      severity,
      message: this.formatErrorMessage(error, errorType),
      originalError: error instanceof Error ? error : new Error(String(error)),
      suggestedActions,
      isRetryable,
      context,
      timestamp: new Date()
    };
  }

  /**
   * Categorize error based on error properties
   */
  private categorizeError(error: any): ErrorType {
    if (!error) return ErrorType.UNKNOWN_ERROR;

    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    // Network-related errors
    if (code === 'econnrefused' || code === 'enotfound' || code === 'enetunreach') {
      return ErrorType.NETWORK_ERROR;
    }

    // Timeout errors
    if (code === 'etimedout' || message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT_ERROR;
    }

    // Authentication errors
    if (error.response?.status === 401 || error.response?.status === 403 || 
        message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorType.AUTHENTICATION_ERROR;
    }

    // Server errors
    if (error.response?.status >= 500 || message.includes('server error')) {
      return ErrorType.SERVER_ERROR;
    }

    // Configuration errors
    if (message.includes('configuration') || message.includes('invalid server') || 
        message.includes('validation')) {
      return ErrorType.CONFIGURATION_ERROR;
    }

    // Cache errors
    if (message.includes('cache') || message.includes('storage')) {
      return ErrorType.CACHE_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Determine error severity based on type and operation
   */
  private determineSeverity(errorType: ErrorType, operationType: string): ErrorSeverity {
    // Critical errors that prevent core functionality
    if (errorType === ErrorType.AUTHENTICATION_ERROR && operationType === 'serverSwitch') {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (errorType === ErrorType.CONFIGURATION_ERROR || 
        (errorType === ErrorType.SERVER_ERROR && operationType === 'serverSwitch')) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (errorType === ErrorType.NETWORK_ERROR || errorType === ErrorType.TIMEOUT_ERROR) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors
    return ErrorSeverity.LOW;
  }

  /**
   * Get suggested actions for error recovery
   */
  private getSuggestedActions(
    errorType: ErrorType,
    operationType: string,
    context?: Record<string, any>
  ): string[] {
    const actions: string[] = [];

    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        actions.push('Check your network connection');
        actions.push('Verify the server is accessible');
        if (operationType === 'serverSwitch') {
          actions.push('Try switching to a different server');
        }
        actions.push('Contact your system administrator if the problem persists');
        break;

      case ErrorType.TIMEOUT_ERROR:
        actions.push('Check your network connection speed');
        actions.push('Try again in a few moments');
        if (operationType === 'serverSwitch') {
          actions.push('Consider switching to a server with better connectivity');
        }
        break;

      case ErrorType.AUTHENTICATION_ERROR:
        actions.push('Please log in again');
        actions.push('Check your credentials');
        if (operationType === 'serverSwitch') {
          actions.push('Your authentication may not be valid on the new server');
        }
        break;

      case ErrorType.SERVER_ERROR:
        actions.push('The server is experiencing issues');
        actions.push('Try again in a few minutes');
        if (operationType === 'serverSwitch') {
          actions.push('Consider switching to a different server');
        }
        actions.push('Contact your system administrator');
        break;

      case ErrorType.CONFIGURATION_ERROR:
        actions.push('Check the server configuration');
        actions.push('Contact your system administrator');
        if (context?.serverId) {
          actions.push(`Verify the configuration for server: ${context.serverId}`);
        }
        break;

      case ErrorType.CACHE_ERROR:
        actions.push('Clear the application cache');
        actions.push('Restart the application');
        actions.push('Try the operation again');
        break;

      default:
        actions.push('Try the operation again');
        actions.push('Restart the application if the problem persists');
        actions.push('Contact support if the issue continues');
        break;
    }

    return actions;
  }

  /**
   * Format error message for user display
   */
  private formatErrorMessage(error: any, errorType: ErrorType): string {
    const baseMessage = error.message || 'An unknown error occurred';

    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return `Network connection failed: ${baseMessage}`;
      case ErrorType.TIMEOUT_ERROR:
        return `Operation timed out: ${baseMessage}`;
      case ErrorType.AUTHENTICATION_ERROR:
        return `Authentication failed: ${baseMessage}`;
      case ErrorType.SERVER_ERROR:
        return `Server error: ${baseMessage}`;
      case ErrorType.CONFIGURATION_ERROR:
        return `Configuration error: ${baseMessage}`;
      case ErrorType.CACHE_ERROR:
        return `Cache operation failed: ${baseMessage}`;
      default:
        return baseMessage;
    }
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(error: EnhancedError, retryConfig: RetryConfig): boolean {
    return error.isRetryable && retryConfig.retryableErrors.includes(error.type);
  }

  /**
   * Check if error type is retryable for the given operation
   */
  private isErrorRetryable(errorType: ErrorType, operationType: string): boolean {
    const retryConfig = this.retryConfigs[operationType];
    return retryConfig ? retryConfig.retryableErrors.includes(errorType) : false;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, retryConfig: RetryConfig): number {
    const exponentialDelay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, retryConfig.maxDelay);
    
    if (retryConfig.jitter) {
      // Add random jitter (±25% of the delay)
      const jitterRange = cappedDelay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.max(0, cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  /**
   * Get timeout for specific operation type
   */
  private getTimeoutForOperation(operationType: string): number {
    switch (operationType) {
      case 'serverSwitch':
        return this.timeoutConfig.serverSwitch;
      case 'connectivityTest':
        return this.timeoutConfig.connectionTest;
      case 'authentication':
        return this.timeoutConfig.authentication;
      case 'cacheOperation':
        return this.timeoutConfig.cacheOperation;
      case 'healthCheck':
        return this.timeoutConfig.healthCheck;
      default:
        return this.timeoutConfig.connectionTest; // Default fallback
    }
  }

  /**
   * Execute graceful fallback to previous server
   */
  async executeGracefulFallback(
    fromServerId: string,
    toServerId: string,
    fallbackOperation: () => Promise<void>,
    strategy?: FallbackStrategy
  ): Promise<OperationResult<void>> {
    const effectiveStrategy = strategy || this.fallbackStrategies.get('default')!;
    
    console.log(`🔄 Executing graceful fallback from ${toServerId} to ${fromServerId}`);

    try {
      // Execute fallback with timeout
      await this.executeWithTimeout(fallbackOperation, effectiveStrategy.fallbackTimeout);
      
      console.log(`✅ Graceful fallback completed successfully`);
      
      return {
        success: true,
        attempts: 1,
        totalDuration: effectiveStrategy.fallbackTimeout,
        fallbackUsed: true
      };

    } catch (error: any) {
      const enhancedError = this.enhanceError(error, 'fallback', {
        fromServerId,
        toServerId
      });

      console.error(`❌ Graceful fallback failed:`, enhancedError);

      return {
        success: false,
        error: enhancedError,
        attempts: 1,
        totalDuration: effectiveStrategy.fallbackTimeout,
        fallbackUsed: true
      };
    }
  }

  /**
   * Handle authentication failure without data loss
   */
  async handleAuthenticationFailure(
    serverId: string,
    preserveDataOperation: () => Promise<void>,
    clearAuthOperation: () => Promise<void>
  ): Promise<OperationResult<void>> {
    console.log(`🔐 Handling authentication failure for server ${serverId}`);

    try {
      // First, preserve user data
      console.log('💾 Preserving user data...');
      await this.executeWithTimeout(preserveDataOperation, this.timeoutConfig.cacheOperation);

      // Then, clear authentication
      console.log('🧹 Clearing invalid authentication...');
      await this.executeWithTimeout(clearAuthOperation, this.timeoutConfig.authentication);

      console.log('✅ Authentication failure handled successfully');

      return {
        success: true,
        attempts: 1,
        totalDuration: this.timeoutConfig.authentication + this.timeoutConfig.cacheOperation,
        fallbackUsed: false
      };

    } catch (error: any) {
      const enhancedError = this.enhanceError(error, 'authFailure', { serverId });
      
      console.error('❌ Failed to handle authentication failure:', enhancedError);

      return {
        success: false,
        error: enhancedError,
        attempts: 1,
        totalDuration: this.timeoutConfig.authentication + this.timeoutConfig.cacheOperation,
        fallbackUsed: false
      };
    }
  }

  /**
   * Update retry configuration for specific operation
   */
  updateRetryConfig(operationType: string, config: Partial<RetryConfig>): void {
    this.retryConfigs[operationType] = {
      ...this.retryConfigs[operationType],
      ...config
    };
  }

  /**
   * Update timeout configuration
   */
  updateTimeoutConfig(config: Partial<TimeoutConfig>): void {
    this.timeoutConfig = {
      ...this.timeoutConfig,
      ...config
    };
  }

  /**
   * Set fallback strategy for specific scenario
   */
  setFallbackStrategy(scenarioId: string, strategy: FallbackStrategy): void {
    this.fallbackStrategies.set(scenarioId, strategy);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current retry configuration for operation
   */
  getRetryConfig(operationType: string): RetryConfig | undefined {
    return this.retryConfigs[operationType];
  }

  /**
   * Get current timeout configuration
   */
  getTimeoutConfig(): TimeoutConfig {
    return { ...this.timeoutConfig };
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();
export default errorHandlingService;

// Export types for external use
export type {
  RetryConfig,
  TimeoutConfig,
  EnhancedError,
  FallbackStrategy,
  OperationResult
};