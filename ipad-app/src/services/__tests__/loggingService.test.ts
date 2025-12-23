/**
 * Logging Service Tests
 * 
 * Tests for the comprehensive logging and debugging service
 */

import { loggingService, LogLevel, LogCategory } from '../loggingService';
import { ErrorType, ErrorSeverity } from '../errorHandlingService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('LoggingService', () => {
  beforeEach(() => {
    // Clear any existing logs before each test
    jest.clearAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log debug messages', async () => {
      await loggingService.logDebug(
        LogCategory.SERVER_SWITCH,
        'test_operation',
        'Test debug message',
        { testContext: 'value' }
      );

      const logs = loggingService.getLogs(LogCategory.SERVER_SWITCH, LogLevel.DEBUG);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].message).toBe('Test debug message');
      expect(logs[0].context).toEqual({ testContext: 'value' });
    });

    it('should log info messages with duration', async () => {
      await loggingService.logInfo(
        LogCategory.CONNECTIVITY_TEST,
        'connectivity_test',
        'Connection test completed',
        { serverId: 'test-server' },
        1500,
        'test-server',
        'Test Server'
      );

      const logs = loggingService.getLogs(LogCategory.CONNECTIVITY_TEST, LogLevel.INFO);
      expect(logs).toHaveLength(1);
      expect(logs[0].duration).toBe(1500);
      expect(logs[0].serverId).toBe('test-server');
      expect(logs[0].serverName).toBe('Test Server');
    });

    it('should log error messages with enhanced error info', async () => {
      const enhancedError = {
        type: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.HIGH,
        message: 'Network connection failed',
        suggestedActions: ['Check network connection', 'Try again'],
        isRetryable: true,
        timestamp: new Date()
      };

      await loggingService.logError(
        LogCategory.SERVER_SWITCH,
        'server_switch_failed',
        'Server switch operation failed',
        enhancedError,
        { serverId: 'test-server' }
      );

      const logs = loggingService.getLogs(LogCategory.SERVER_SWITCH, LogLevel.ERROR);
      expect(logs).toHaveLength(1);
      expect(logs[0].error).toEqual(enhancedError);
    });
  });

  describe('Server Switch Logging', () => {
    it('should track server switch operations', async () => {
      const switchId = await loggingService.startServerSwitchLog(
        'server-a',
        'server-b',
        true,
        { userInitiated: true }
      );

      expect(switchId).toBeDefined();
      expect(switchId).toMatch(/^switch_/);

      // Log a phase
      await loggingService.logServerSwitchPhase(
        switchId,
        'connectivity_test',
        'completed',
        'Connectivity test successful',
        undefined,
        { responseTime: 150 }
      );

      // Complete the switch
      await loggingService.completeServerSwitchLog(
        switchId,
        true,
        false
      );

      const switchLogs = loggingService.getServerSwitchLogs(10);
      expect(switchLogs).toHaveLength(1);
      expect(switchLogs[0].id).toBe(switchId);
      expect(switchLogs[0].success).toBe(true);
      expect(switchLogs[0].phases).toHaveLength(1);
      expect(switchLogs[0].phases[0].phase).toBe('connectivity_test');
      expect(switchLogs[0].phases[0].status).toBe('completed');
    });

    it('should handle failed server switch with fallback', async () => {
      const switchId = await loggingService.startServerSwitchLog(
        'server-a',
        'server-b',
        true
      );

      await loggingService.logServerSwitchPhase(
        switchId,
        'connectivity_test',
        'failed',
        'Connection failed',
        {
          type: ErrorType.NETWORK_ERROR,
          severity: ErrorSeverity.HIGH,
          message: 'Connection timeout',
          suggestedActions: ['Check network'],
          isRetryable: true,
          timestamp: new Date()
        }
      );

      await loggingService.completeServerSwitchLog(
        switchId,
        false,
        true,
        'Switch failed but fallback succeeded'
      );

      const switchLogs = loggingService.getServerSwitchLogs(10);
      expect(switchLogs[0].success).toBe(false);
      expect(switchLogs[0].fallbackUsed).toBe(true);
      expect(switchLogs[0].status).toBe('rolled_back');
    });
  });

  describe('Connectivity Test Logging', () => {
    it('should log connectivity test results', async () => {
      const testResult = {
        serverId: 'test-server',
        status: 'connected' as const,
        lastChecked: new Date(),
        responseTime: 250,
        healthChecks: [
          { endpoint: '/health', status: 'success' as const, responseTime: 100 },
          { endpoint: '/api/status', status: 'success' as const, responseTime: 150 }
        ]
      };

      await loggingService.logConnectivityTest(
        'test-server',
        'Test Server',
        'manual',
        testResult,
        250,
        true,
        { userInitiated: true }
      );

      const connectivityLogs = loggingService.getConnectivityTestLogs('test-server', 10);
      expect(connectivityLogs).toHaveLength(1);
      expect(connectivityLogs[0].serverId).toBe('test-server');
      expect(connectivityLogs[0].testType).toBe('manual');
      expect(connectivityLogs[0].result.status).toBe('connected');
      expect(connectivityLogs[0].userInitiated).toBe(true);
    });
  });

  describe('Error Reporting', () => {
    it('should create comprehensive error reports', async () => {
      const enhancedError = {
        type: ErrorType.SERVER_ERROR,
        severity: ErrorSeverity.CRITICAL,
        message: 'Server internal error',
        suggestedActions: ['Contact support', 'Try different server'],
        isRetryable: false,
        timestamp: new Date()
      };

      const reportId = await loggingService.createErrorReport(
        enhancedError,
        'server_switch',
        LogCategory.SERVER_SWITCH,
        'test-server',
        'Test Server'
      );

      expect(reportId).toBeDefined();
      expect(reportId).toMatch(/^error_report_/);

      const errorReports = loggingService.getErrorReports(10);
      expect(errorReports).toHaveLength(1);
      expect(errorReports[0].id).toBe(reportId);
      expect(errorReports[0].error).toEqual(enhancedError);
      expect(errorReports[0].operation).toBe('server_switch');
    });
  });

  describe('User Action Tracking', () => {
    it('should track user actions', async () => {
      await loggingService.trackUserAction(
        'server_switch_initiated',
        'settings_screen',
        { fromServer: 'server-a', toServer: 'server-b' }
      );

      await loggingService.trackUserAction(
        'language_changed',
        'settings_screen',
        { fromLanguage: 'en', toLanguage: 'ja' }
      );

      // User actions are tracked internally and included in error reports
      // We can verify they're being logged by checking the logs
      const logs = loggingService.getLogs(LogCategory.USER_ACTION);
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      // Log some operations with durations
      await loggingService.logInfo(
        LogCategory.SERVER_SWITCH,
        'server_switch',
        'Server switch completed',
        {},
        2500
      );

      await loggingService.logInfo(
        LogCategory.CONNECTIVITY_TEST,
        'connectivity_test',
        'Connectivity test completed',
        {},
        800
      );

      const metrics = loggingService.getPerformanceMetrics();
      expect(metrics.serverSwitchDurations).toContain(2500);
      expect(metrics.connectivityTestDurations).toContain(800);
    });
  });

  describe('Log Filtering and Search', () => {
    beforeEach(async () => {
      // Add some test logs
      await loggingService.logDebug(LogCategory.SERVER_SWITCH, 'test1', 'Debug message');
      await loggingService.logInfo(LogCategory.CONNECTIVITY_TEST, 'test2', 'Info message');
      await loggingService.logWarning(LogCategory.AUTHENTICATION, 'test3', 'Warning message');
      await loggingService.logError(
        LogCategory.SERVER_SWITCH,
        'test4',
        'Error message',
        {
          type: ErrorType.NETWORK_ERROR,
          severity: ErrorSeverity.HIGH,
          message: 'Network error',
          suggestedActions: [],
          isRetryable: true,
          timestamp: new Date()
        }
      );
    });

    it('should filter logs by category', () => {
      const serverSwitchLogs = loggingService.getLogs(LogCategory.SERVER_SWITCH);
      expect(serverSwitchLogs).toHaveLength(2); // debug and error
      
      const connectivityLogs = loggingService.getLogs(LogCategory.CONNECTIVITY_TEST);
      expect(connectivityLogs).toHaveLength(1); // info
    });

    it('should filter logs by level', () => {
      const errorLogs = loggingService.getLogs(undefined, LogLevel.ERROR);
      expect(errorLogs).toHaveLength(1);
      
      const debugLogs = loggingService.getLogs(undefined, LogLevel.DEBUG);
      expect(debugLogs).toHaveLength(1);
    });

    it('should filter logs by both category and level', () => {
      const serverSwitchErrorLogs = loggingService.getLogs(LogCategory.SERVER_SWITCH, LogLevel.ERROR);
      expect(serverSwitchErrorLogs).toHaveLength(1);
      
      const connectivityErrorLogs = loggingService.getLogs(LogCategory.CONNECTIVITY_TEST, LogLevel.ERROR);
      expect(connectivityErrorLogs).toHaveLength(0);
    });
  });

  describe('Log Export', () => {
    it('should export logs in JSON format', async () => {
      await loggingService.logInfo(
        LogCategory.SERVER_SWITCH,
        'test_export',
        'Test export message'
      );

      const exportData = await loggingService.exportLogs('json');
      expect(exportData).toBeDefined();
      
      const parsed = JSON.parse(exportData);
      expect(parsed.logs).toBeDefined();
      expect(parsed.sessionId).toBeDefined();
      expect(parsed.exportTime).toBeDefined();
    });

    it('should export logs in text format', async () => {
      await loggingService.logInfo(
        LogCategory.SERVER_SWITCH,
        'test_export',
        'Test export message'
      );

      const exportData = await loggingService.exportLogs('text');
      expect(exportData).toBeDefined();
      expect(exportData).toContain('VerbumCare Debug Log Export');
      expect(exportData).toContain('Test export message');
    });
  });

  describe('Log Cleanup', () => {
    it('should clear all logs', async () => {
      // Add some logs
      await loggingService.logInfo(LogCategory.SERVER_SWITCH, 'test', 'Test message');
      
      // Verify logs exist
      let logs = loggingService.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      // Clear logs
      await loggingService.clearLogs();
      
      // Verify logs are cleared
      logs = loggingService.getLogs();
      expect(logs).toHaveLength(0);
      
      const switchLogs = loggingService.getServerSwitchLogs();
      expect(switchLogs).toHaveLength(0);
      
      const connectivityLogs = loggingService.getConnectivityTestLogs();
      expect(connectivityLogs).toHaveLength(0);
      
      const errorReports = loggingService.getErrorReports();
      expect(errorReports).toHaveLength(0);
    });
  });
});