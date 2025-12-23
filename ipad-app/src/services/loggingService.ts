/**
 * Comprehensive Logging and Debugging Service for Backend Switching
 * 
 * This service provides detailed logging for server switch operations, connectivity tests,
 * error reporting, and debugging information to help troubleshoot server switching issues.
 * 
 * Implements Requirements:
 * - 6.5: Clear error messages with suggested actions
 * - 7.4: Debug information for troubleshooting
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServerConfig } from '../config/servers';
import { DetailedConnectionStatus, ServerSwitchState, ConnectionStatus } from '../types/settings';
import { EnhancedError, ErrorType, ErrorSeverity } from './errorHandlingService';

/**
 * Log levels for filtering and categorizing log entries
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Log categories for organizing different types of operations
 */
export enum LogCategory {
  SERVER_SWITCH = 'SERVER_SWITCH',
  CONNECTIVITY_TEST = 'CONNECTIVITY_TEST',
  AUTHENTICATION = 'AUTHENTICATION',
  CACHE_MANAGEMENT = 'CACHE_MANAGEMENT',
  ERROR_HANDLING = 'ERROR_HANDLING',
  CONFIGURATION = 'CONFIGURATION',
  PERFORMANCE = 'PERFORMANCE',
  USER_ACTION = 'USER_ACTION'
}

/**
 * Structured log entry interface
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  operation: string;
  message: string;
  context?: Record<string, any>;
  error?: EnhancedError;
  duration?: number;
  serverId?: string;
  serverName?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Server switch operation log with detailed tracking
 */
export interface ServerSwitchLog {
  id: string;
  startTime: Date;
  endTime?: Date;
  fromServerId: string;
  toServerId: string;
  status: 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  phases: ServerSwitchPhaseLog[];
  totalDuration?: number;
  success: boolean;
  errorMessage?: string;
  fallbackUsed: boolean;
  userInitiated: boolean;
  context?: Record<string, any>;
}

/**
 * Individual phase within a server switch operation
 */
export interface ServerSwitchPhaseLog {
  phase: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  message?: string;
  error?: EnhancedError;
  details?: Record<string, any>;
}

/**
 * Connectivity test result log
 */
export interface ConnectivityTestLog {
  id: string;
  timestamp: Date;
  serverId: string;
  serverName: string;
  testType: 'manual' | 'automatic' | 'switch_validation' | 'health_check';
  result: DetailedConnectionStatus;
  duration: number;
  userInitiated: boolean;
  context?: Record<string, any>;
}

/**
 * Error report with comprehensive debugging information
 */
export interface ErrorReport {
  id: string;
  timestamp: Date;
  error: EnhancedError;
  operation: string;
  category: LogCategory;
  serverId?: string;
  serverName?: string;
  systemInfo: SystemInfo;
  userActions: UserActionLog[];
  relatedLogs: LogEntry[];
  debugInfo: DebugInfo;
}

/**
 * System information for debugging
 */
export interface SystemInfo {
  appVersion: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  networkType: string;
  isOnline: boolean;
  memoryUsage?: number;
  storageUsage?: number;
}

/**
 * User action tracking for debugging
 */
export interface UserActionLog {
  timestamp: Date;
  action: string;
  screen: string;
  details?: Record<string, any>;
}

/**
 * Debug information collection
 */
export interface DebugInfo {
  currentServer: ServerConfig;
  connectionStatus: ConnectionStatus;
  cacheStatus: Record<string, any>;
  authStatus: Record<string, any>;
  queueStatus: Record<string, any>;
  recentErrors: EnhancedError[];
  performanceMetrics: Record<string, number>;
}

/**
 * Log storage configuration
 */
interface LogStorageConfig {
  maxEntries: number;
  maxAge: number; // in milliseconds
  compressionEnabled: boolean;
  persistToDisk: boolean;
  uploadToServer: boolean;
}

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  serverSwitchDurations: number[];
  connectivityTestDurations: number[];
  authenticationDurations: number[];
  cacheOperationDurations: number[];
  errorCounts: Record<ErrorType, number>;
  successRates: Record<string, number>;
}

/**
 * Comprehensive Logging Service
 */
class LoggingService {
  private logs: LogEntry[] = [];
  private serverSwitchLogs: Map<string, ServerSwitchLog> = new Map();
  private connectivityTestLogs: ConnectivityTestLog[] = [];
  private errorReports: ErrorReport[] = [];
  private userActions: UserActionLog[] = [];
  private performanceMetrics: PerformanceMetrics;
  private sessionId: string;
  private config: LogStorageConfig;

  // Storage keys
  private readonly LOGS_STORAGE_KEY = '@VerbumCare:logs';
  private readonly SERVER_SWITCH_LOGS_KEY = '@VerbumCare:serverSwitchLogs';
  private readonly CONNECTIVITY_LOGS_KEY = '@VerbumCare:connectivityLogs';
  private readonly ERROR_REPORTS_KEY = '@VerbumCare:errorReports';
  private readonly PERFORMANCE_METRICS_KEY = '@VerbumCare:performanceMetrics';

  constructor() {
    this.sessionId = this.generateSessionId();
    this.config = {
      maxEntries: 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      compressionEnabled: true,
      persistToDisk: true,
      uploadToServer: false
    };
    
    this.performanceMetrics = {
      serverSwitchDurations: [],
      connectivityTestDurations: [],
      authenticationDurations: [],
      cacheOperationDurations: [],
      errorCounts: {} as Record<ErrorType, number>,
      successRates: {}
    };

    this.initializeLogging();
  }

  /**
   * Initialize logging service and load persisted logs
   */
  private async initializeLogging(): Promise<void> {
    try {
      console.log('[LoggingService] Initializing logging service...');
      
      if (this.config.persistToDisk) {
        await this.loadPersistedLogs();
      }
      
      // Clean up old logs
      await this.cleanupOldLogs();
      
      // Log service initialization
      this.logInfo(
        LogCategory.CONFIGURATION,
        'logging_service_init',
        'Logging service initialized successfully',
        {
          sessionId: this.sessionId,
          config: this.config,
          existingLogsCount: this.logs.length
        }
      );

      console.log('[LoggingService] ✅ Logging service initialized');
    } catch (error: any) {
      console.error('[LoggingService] ❌ Failed to initialize logging service:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogLevel,
    category: LogCategory,
    operation: string,
    message: string,
    context?: Record<string, any>,
    error?: EnhancedError,
    duration?: number,
    serverId?: string,
    serverName?: string
  ): Promise<void> {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      category,
      operation,
      message,
      context,
      error,
      duration,
      serverId,
      serverName,
      sessionId: this.sessionId
    };

    // Add to in-memory logs
    this.logs.push(logEntry);

    // Console output with formatting
    this.outputToConsole(logEntry);

    // Persist to storage if enabled
    if (this.config.persistToDisk) {
      await this.persistLogs();
    }

    // Maintain log size limits
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries);
    }

    // Update performance metrics
    this.updatePerformanceMetrics(logEntry);
  }

  /**
   * Output log entry to console with formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.level}] [${entry.category}] [${entry.operation}]`;
    
    const contextStr = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
    const durationStr = entry.duration ? ` | Duration: ${entry.duration}ms` : '';
    const serverStr = entry.serverName ? ` | Server: ${entry.serverName}` : '';
    
    const fullMessage = `${prefix} ${entry.message}${serverStr}${durationStr}${contextStr}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage);
        break;
      case LogLevel.INFO:
        console.log(fullMessage);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(fullMessage);
        if (entry.error) {
          console.error('Error details:', entry.error);
        }
        break;
    }
  }

  /**
   * Update performance metrics based on log entry
   */
  private updatePerformanceMetrics(entry: LogEntry): void {
    if (entry.duration) {
      switch (entry.category) {
        case LogCategory.SERVER_SWITCH:
          this.performanceMetrics.serverSwitchDurations.push(entry.duration);
          break;
        case LogCategory.CONNECTIVITY_TEST:
          this.performanceMetrics.connectivityTestDurations.push(entry.duration);
          break;
        case LogCategory.AUTHENTICATION:
          this.performanceMetrics.authenticationDurations.push(entry.duration);
          break;
        case LogCategory.CACHE_MANAGEMENT:
          this.performanceMetrics.cacheOperationDurations.push(entry.duration);
          break;
      }
    }

    if (entry.error) {
      const errorType = entry.error.type;
      this.performanceMetrics.errorCounts[errorType] = 
        (this.performanceMetrics.errorCounts[errorType] || 0) + 1;
    }

    // Calculate success rates
    const operationLogs = this.logs.filter(log => log.operation === entry.operation);
    const successfulLogs = operationLogs.filter(log => !log.error);
    this.performanceMetrics.successRates[entry.operation] = 
      operationLogs.length > 0 ? (successfulLogs.length / operationLogs.length) * 100 : 0;
  }

  // Public logging methods
  async logDebug(
    category: LogCategory,
    operation: string,
    message: string,
    context?: Record<string, any>,
    serverId?: string,
    serverName?: string
  ): Promise<void> {
    await this.log(LogLevel.DEBUG, category, operation, message, context, undefined, undefined, serverId, serverName);
  }

  async logInfo(
    category: LogCategory,
    operation: string,
    message: string,
    context?: Record<string, any>,
    duration?: number,
    serverId?: string,
    serverName?: string
  ): Promise<void> {
    await this.log(LogLevel.INFO, category, operation, message, context, undefined, duration, serverId, serverName);
  }

  async logWarning(
    category: LogCategory,
    operation: string,
    message: string,
    context?: Record<string, any>,
    serverId?: string,
    serverName?: string
  ): Promise<void> {
    await this.log(LogLevel.WARN, category, operation, message, context, undefined, undefined, serverId, serverName);
  }

  async logError(
    category: LogCategory,
    operation: string,
    message: string,
    error: EnhancedError,
    context?: Record<string, any>,
    serverId?: string,
    serverName?: string
  ): Promise<void> {
    await this.log(LogLevel.ERROR, category, operation, message, context, error, undefined, serverId, serverName);
  }

  async logCritical(
    category: LogCategory,
    operation: string,
    message: string,
    error: EnhancedError,
    context?: Record<string, any>,
    serverId?: string,
    serverName?: string
  ): Promise<void> {
    await this.log(LogLevel.CRITICAL, category, operation, message, context, error, undefined, serverId, serverName);
  }

  /**
   * Start tracking a server switch operation
   */
  async startServerSwitchLog(
    fromServerId: string,
    toServerId: string,
    userInitiated: boolean = true,
    context?: Record<string, any>
  ): Promise<string> {
    const switchId = `switch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const switchLog: ServerSwitchLog = {
      id: switchId,
      startTime: new Date(),
      fromServerId,
      toServerId,
      status: 'in_progress',
      phases: [],
      success: false,
      fallbackUsed: false,
      userInitiated,
      context
    };

    this.serverSwitchLogs.set(switchId, switchLog);

    await this.logInfo(
      LogCategory.SERVER_SWITCH,
      'server_switch_start',
      `Starting server switch: ${fromServerId} → ${toServerId}`,
      {
        switchId,
        fromServerId,
        toServerId,
        userInitiated,
        ...context
      },
      undefined,
      toServerId
    );

    return switchId;
  }

  /**
   * Log a phase within a server switch operation
   */
  async logServerSwitchPhase(
    switchId: string,
    phase: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped',
    message?: string,
    error?: EnhancedError,
    details?: Record<string, any>
  ): Promise<void> {
    const switchLog = this.serverSwitchLogs.get(switchId);
    if (!switchLog) {
      await this.logWarning(
        LogCategory.SERVER_SWITCH,
        'server_switch_phase_log',
        `Switch log not found for ID: ${switchId}`,
        { switchId, phase, status }
      );
      return;
    }

    // Find existing phase or create new one
    let phaseLog = switchLog.phases.find(p => p.phase === phase);
    if (!phaseLog) {
      phaseLog = {
        phase,
        startTime: new Date(),
        status: 'pending'
      };
      switchLog.phases.push(phaseLog);
    }

    // Update phase
    phaseLog.status = status;
    if (message) phaseLog.message = message;
    if (error) phaseLog.error = error;
    if (details) phaseLog.details = details;

    if (status === 'completed' || status === 'failed') {
      phaseLog.endTime = new Date();
      phaseLog.duration = phaseLog.endTime.getTime() - phaseLog.startTime.getTime();
    }

    // Log the phase update
    const logLevel = status === 'failed' ? LogLevel.ERROR : 
                    status === 'completed' ? LogLevel.INFO : LogLevel.DEBUG;
    
    await this.log(
      logLevel,
      LogCategory.SERVER_SWITCH,
      'server_switch_phase',
      `Phase ${phase}: ${status}${message ? ` - ${message}` : ''}`,
      {
        switchId,
        phase,
        status,
        duration: phaseLog.duration,
        ...details
      },
      error,
      phaseLog.duration,
      switchLog.toServerId
    );
  }

  /**
   * Complete a server switch operation
   */
  async completeServerSwitchLog(
    switchId: string,
    success: boolean,
    fallbackUsed: boolean = false,
    errorMessage?: string
  ): Promise<void> {
    const switchLog = this.serverSwitchLogs.get(switchId);
    if (!switchLog) {
      await this.logWarning(
        LogCategory.SERVER_SWITCH,
        'server_switch_complete',
        `Switch log not found for ID: ${switchId}`,
        { switchId, success, fallbackUsed }
      );
      return;
    }

    switchLog.endTime = new Date();
    switchLog.totalDuration = switchLog.endTime.getTime() - switchLog.startTime.getTime();
    switchLog.success = success;
    switchLog.fallbackUsed = fallbackUsed;
    switchLog.status = success ? 'completed' : (fallbackUsed ? 'rolled_back' : 'failed');
    
    if (errorMessage) {
      switchLog.errorMessage = errorMessage;
    }

    const logLevel = success ? LogLevel.INFO : LogLevel.ERROR;
    const statusText = success ? 'completed successfully' : 
                      fallbackUsed ? 'failed but rolled back successfully' : 'failed';

    await this.log(
      logLevel,
      LogCategory.SERVER_SWITCH,
      'server_switch_complete',
      `Server switch ${statusText}: ${switchLog.fromServerId} → ${switchLog.toServerId}`,
      {
        switchId,
        success,
        fallbackUsed,
        totalDuration: switchLog.totalDuration,
        phasesCount: switchLog.phases.length,
        errorMessage
      },
      undefined,
      switchLog.totalDuration,
      switchLog.toServerId
    );

    // Persist server switch logs
    await this.persistServerSwitchLogs();
  }

  /**
   * Log connectivity test results
   */
  async logConnectivityTest(
    serverId: string,
    serverName: string,
    testType: 'manual' | 'automatic' | 'switch_validation' | 'health_check',
    result: DetailedConnectionStatus,
    duration: number,
    userInitiated: boolean = false,
    context?: Record<string, any>
  ): Promise<void> {
    const testLog: ConnectivityTestLog = {
      id: `conn_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      serverId,
      serverName,
      testType,
      result,
      duration,
      userInitiated,
      context
    };

    this.connectivityTestLogs.push(testLog);

    const logLevel = result.status === 'connected' ? LogLevel.INFO : LogLevel.WARN;
    const statusText = result.status === 'connected' ? 'successful' : 'failed';
    const healthCheckSummary = result.healthChecks.length > 0 ? 
      ` (${result.healthChecks.filter(hc => hc.status === 'success').length}/${result.healthChecks.length} health checks passed)` : '';

    await this.log(
      logLevel,
      LogCategory.CONNECTIVITY_TEST,
      'connectivity_test',
      `Connectivity test ${statusText} for ${serverName}${healthCheckSummary}`,
      {
        testId: testLog.id,
        serverId,
        testType,
        status: result.status,
        responseTime: result.responseTime,
        healthChecksCount: result.healthChecks.length,
        userInitiated,
        ...context
      },
      result.errorMessage ? {
        type: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: result.errorMessage,
        suggestedActions: ['Check network connection', 'Verify server status'],
        isRetryable: true,
        timestamp: new Date()
      } : undefined,
      duration,
      serverId,
      serverName
    );

    // Persist connectivity logs
    await this.persistConnectivityLogs();
  }

  /**
   * Create comprehensive error report
   */
  async createErrorReport(
    error: EnhancedError,
    operation: string,
    category: LogCategory,
    serverId?: string,
    serverName?: string
  ): Promise<string> {
    const reportId = `error_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorReport: ErrorReport = {
      id: reportId,
      timestamp: new Date(),
      error,
      operation,
      category,
      serverId,
      serverName,
      systemInfo: await this.collectSystemInfo(),
      userActions: this.getRecentUserActions(10),
      relatedLogs: this.getRelatedLogs(operation, serverId, 20),
      debugInfo: await this.collectDebugInfo()
    };

    this.errorReports.push(errorReport);

    await this.logCritical(
      category,
      'error_report_created',
      `Error report created for ${operation}`,
      error,
      {
        reportId,
        errorType: error.type,
        errorSeverity: error.severity,
        operation,
        serverId,
        serverName
      },
      serverId,
      serverName
    );

    // Persist error reports
    await this.persistErrorReports();

    return reportId;
  }

  /**
   * Track user actions for debugging
   */
  async trackUserAction(
    action: string,
    screen: string,
    details?: Record<string, any>
  ): Promise<void> {
    const userAction: UserActionLog = {
      timestamp: new Date(),
      action,
      screen,
      details
    };

    this.userActions.push(userAction);

    // Keep only recent user actions
    if (this.userActions.length > 100) {
      this.userActions = this.userActions.slice(-100);
    }

    await this.logDebug(
      LogCategory.USER_ACTION,
      'user_action',
      `User action: ${action} on ${screen}`,
      {
        action,
        screen,
        ...details
      }
    );
  }

  /**
   * Collect system information for debugging
   */
  private async collectSystemInfo(): Promise<SystemInfo> {
    // This would be implemented with actual system info collection
    // For now, return mock data
    return {
      appVersion: '1.0.0',
      platform: 'iOS',
      osVersion: '17.0',
      deviceModel: 'iPad Pro',
      networkType: 'WiFi',
      isOnline: true,
      memoryUsage: 150,
      storageUsage: 2048
    };
  }

  /**
   * Collect debug information
   */
  private async collectDebugInfo(): Promise<DebugInfo> {
    // This would collect actual debug info from various services
    // For now, return mock data
    return {
      currentServer: {} as ServerConfig,
      connectionStatus: 'connected',
      cacheStatus: {},
      authStatus: {},
      queueStatus: {},
      recentErrors: [],
      performanceMetrics: {}
    };
  }

  /**
   * Get recent user actions
   */
  private getRecentUserActions(count: number): UserActionLog[] {
    return this.userActions.slice(-count);
  }

  /**
   * Get related logs for debugging
   */
  private getRelatedLogs(operation: string, serverId?: string, count: number = 20): LogEntry[] {
    return this.logs
      .filter(log => 
        log.operation === operation || 
        (serverId && log.serverId === serverId) ||
        log.category === LogCategory.SERVER_SWITCH ||
        log.category === LogCategory.CONNECTIVITY_TEST
      )
      .slice(-count);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get server switch logs
   */
  getServerSwitchLogs(limit?: number): ServerSwitchLog[] {
    const logs = Array.from(this.serverSwitchLogs.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Get connectivity test logs
   */
  getConnectivityTestLogs(serverId?: string, limit?: number): ConnectivityTestLog[] {
    let logs = this.connectivityTestLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (serverId) {
      logs = logs.filter(log => log.serverId === serverId);
    }
    
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Get error reports
   */
  getErrorReports(limit?: number): ErrorReport[] {
    const reports = this.errorReports
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? reports.slice(0, limit) : reports;
  }

  /**
   * Get logs by category and level
   */
  getLogs(
    category?: LogCategory,
    level?: LogLevel,
    serverId?: string,
    limit?: number
  ): LogEntry[] {
    let filteredLogs = this.logs;

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    if (serverId) {
      filteredLogs = filteredLogs.filter(log => log.serverId === serverId);
    }

    filteredLogs = filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? filteredLogs.slice(0, limit) : filteredLogs;
  }

  /**
   * Export logs for debugging or support
   */
  async exportLogs(format: 'json' | 'text' = 'json'): Promise<string> {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      logs: this.logs,
      serverSwitchLogs: Array.from(this.serverSwitchLogs.values()),
      connectivityTestLogs: this.connectivityTestLogs,
      errorReports: this.errorReports,
      performanceMetrics: this.performanceMetrics,
      userActions: this.userActions
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else {
      // Convert to human-readable text format
      let textOutput = `VerbumCare Debug Log Export\n`;
      textOutput += `Session ID: ${this.sessionId}\n`;
      textOutput += `Export Time: ${exportData.exportTime}\n\n`;

      textOutput += `=== RECENT LOGS ===\n`;
      this.logs.slice(-50).forEach(log => {
        textOutput += `[${log.timestamp.toISOString()}] [${log.level}] [${log.category}] ${log.message}\n`;
        if (log.error) {
          textOutput += `  Error: ${log.error.message}\n`;
        }
      });

      textOutput += `\n=== SERVER SWITCH LOGS ===\n`;
      Array.from(this.serverSwitchLogs.values()).slice(-10).forEach(switchLog => {
        textOutput += `Switch ${switchLog.id}: ${switchLog.fromServerId} → ${switchLog.toServerId} (${switchLog.status})\n`;
        textOutput += `  Duration: ${switchLog.totalDuration}ms, Success: ${switchLog.success}\n`;
      });

      return textOutput;
    }
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    this.logs = [];
    this.serverSwitchLogs.clear();
    this.connectivityTestLogs = [];
    this.errorReports = [];
    this.userActions = [];
    
    // Reset performance metrics
    this.performanceMetrics = {
      serverSwitchDurations: [],
      connectivityTestDurations: [],
      authenticationDurations: [],
      cacheOperationDurations: [],
      errorCounts: {} as Record<ErrorType, number>,
      successRates: {}
    };

    if (this.config.persistToDisk) {
      await this.clearPersistedLogs();
    }

    // Log that logs were cleared, then clear this log too
    await this.logInfo(
      LogCategory.CONFIGURATION,
      'logs_cleared',
      'All logs cleared successfully'
    );
    
    // Clear the log we just created
    this.logs = [];
  }

  // Storage methods
  private async loadPersistedLogs(): Promise<void> {
    try {
      const [logs, switchLogs, connectivityLogs, errorReports, performanceMetrics] = await Promise.all([
        AsyncStorage.getItem(this.LOGS_STORAGE_KEY),
        AsyncStorage.getItem(this.SERVER_SWITCH_LOGS_KEY),
        AsyncStorage.getItem(this.CONNECTIVITY_LOGS_KEY),
        AsyncStorage.getItem(this.ERROR_REPORTS_KEY),
        AsyncStorage.getItem(this.PERFORMANCE_METRICS_KEY)
      ]);

      if (logs) {
        const parsedLogs = JSON.parse(logs);
        // Convert timestamp strings back to Date objects
        this.logs = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }

      if (switchLogs) {
        const parsedSwitchLogs = JSON.parse(switchLogs);
        parsedSwitchLogs.forEach((log: any) => {
          // Convert timestamp strings back to Date objects
          const convertedLog = {
            ...log,
            startTime: new Date(log.startTime),
            endTime: log.endTime ? new Date(log.endTime) : undefined,
            phases: log.phases.map((phase: any) => ({
              ...phase,
              startTime: new Date(phase.startTime),
              endTime: phase.endTime ? new Date(phase.endTime) : undefined
            }))
          };
          this.serverSwitchLogs.set(convertedLog.id, convertedLog);
        });
      }

      if (connectivityLogs) {
        const parsedConnectivityLogs = JSON.parse(connectivityLogs);
        // Convert timestamp strings back to Date objects
        this.connectivityTestLogs = parsedConnectivityLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }

      if (errorReports) {
        const parsedErrorReports = JSON.parse(errorReports);
        // Convert timestamp strings back to Date objects
        this.errorReports = parsedErrorReports.map((report: any) => ({
          ...report,
          timestamp: new Date(report.timestamp),
          error: {
            ...report.error,
            timestamp: report.error.timestamp ? new Date(report.error.timestamp) : undefined
          }
        }));
      }

      if (performanceMetrics) {
        this.performanceMetrics = { ...this.performanceMetrics, ...JSON.parse(performanceMetrics) };
      }

    } catch (error: any) {
      console.error('[LoggingService] Failed to load persisted logs:', error);
    }
  }

  private async persistLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.LOGS_STORAGE_KEY, JSON.stringify(this.logs.slice(-this.config.maxEntries)));
    } catch (error: any) {
      console.error('[LoggingService] Failed to persist logs:', error);
    }
  }

  private async persistServerSwitchLogs(): Promise<void> {
    try {
      const logsArray = Array.from(this.serverSwitchLogs.values());
      await AsyncStorage.setItem(this.SERVER_SWITCH_LOGS_KEY, JSON.stringify(logsArray.slice(-50)));
    } catch (error: any) {
      console.error('[LoggingService] Failed to persist server switch logs:', error);
    }
  }

  private async persistConnectivityLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CONNECTIVITY_LOGS_KEY, JSON.stringify(this.connectivityTestLogs.slice(-100)));
    } catch (error: any) {
      console.error('[LoggingService] Failed to persist connectivity logs:', error);
    }
  }

  private async persistErrorReports(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.ERROR_REPORTS_KEY, JSON.stringify(this.errorReports.slice(-20)));
    } catch (error: any) {
      console.error('[LoggingService] Failed to persist error reports:', error);
    }
  }

  private async clearPersistedLogs(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.LOGS_STORAGE_KEY),
        AsyncStorage.removeItem(this.SERVER_SWITCH_LOGS_KEY),
        AsyncStorage.removeItem(this.CONNECTIVITY_LOGS_KEY),
        AsyncStorage.removeItem(this.ERROR_REPORTS_KEY),
        AsyncStorage.removeItem(this.PERFORMANCE_METRICS_KEY)
      ]);
    } catch (error: any) {
      console.error('[LoggingService] Failed to clear persisted logs:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const cutoffTime = Date.now() - this.config.maxAge;
    
    this.logs = this.logs.filter(log => log.timestamp.getTime() > cutoffTime);
    this.connectivityTestLogs = this.connectivityTestLogs.filter(log => log.timestamp.getTime() > cutoffTime);
    this.errorReports = this.errorReports.filter(report => report.timestamp.getTime() > cutoffTime);
    
    // Clean up server switch logs
    for (const [id, switchLog] of this.serverSwitchLogs.entries()) {
      if (switchLog.startTime.getTime() < cutoffTime) {
        this.serverSwitchLogs.delete(id);
      }
    }
  }
}

// Export singleton instance
export const loggingService = new LoggingService();
export default loggingService;

// Export types for external use
export type {
  LogEntry,
  ServerSwitchLog,
  ServerSwitchPhaseLog,
  ConnectivityTestLog,
  ErrorReport,
  SystemInfo,
  UserActionLog,
  DebugInfo,
  PerformanceMetrics
};