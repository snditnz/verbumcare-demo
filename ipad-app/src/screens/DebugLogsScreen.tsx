/**
 * Debug Logs Screen - Comprehensive Logging and Debugging Interface
 * 
 * This screen provides access to detailed logs, error reports, performance metrics,
 * and debugging information for troubleshooting server switching issues.
 * 
 * Implements Requirements:
 * - 6.5: Clear error messages with suggested actions
 * - 7.4: Debug information for troubleshooting
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  RefreshControl,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { 
  loggingService, 
  LogLevel, 
  LogCategory, 
  LogEntry, 
  ServerSwitchLog, 
  ConnectivityTestLog, 
  ErrorReport,
  PerformanceMetrics 
} from '../services/loggingService';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';

interface DebugLogsScreenProps {
  navigation: any;
}

type TabType = 'logs' | 'server_switches' | 'connectivity' | 'errors' | 'performance';

const DebugLogsScreen: React.FC<DebugLogsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serverSwitchLogs, setServerSwitchLogs] = useState<ServerSwitchLog[]>([]);
  const [connectivityLogs, setConnectivityLogs] = useState<ConnectivityTestLog[]>([]);
  const [errorReports, setErrorReports] = useState<ErrorReport[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLogEntry, setSelectedLogEntry] = useState<LogEntry | null>(null);
  const [selectedErrorReport, setSelectedErrorReport] = useState<ErrorReport | null>(null);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Load logs on component mount and tab change
  useEffect(() => {
    loadLogs();
  }, [activeTab, filterLevel, filterCategory]);

  const loadLogs = useCallback(async () => {
    try {
      switch (activeTab) {
        case 'logs':
          const filteredLogs = loggingService.getLogs(
            filterCategory !== 'ALL' ? filterCategory : undefined,
            filterLevel !== 'ALL' ? filterLevel : undefined,
            undefined,
            100
          );
          setLogs(filteredLogs);
          break;
        
        case 'server_switches':
          const switchLogs = loggingService.getServerSwitchLogs(50);
          setServerSwitchLogs(switchLogs);
          break;
        
        case 'connectivity':
          const connLogs = loggingService.getConnectivityTestLogs(undefined, 100);
          setConnectivityLogs(connLogs);
          break;
        
        case 'errors':
          const errReports = loggingService.getErrorReports(50);
          setErrorReports(errReports);
          break;
        
        case 'performance':
          const metrics = loggingService.getPerformanceMetrics();
          setPerformanceMetrics(metrics);
          break;
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }, [activeTab, filterLevel, filterCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  }, [loadLogs]);

  const exportLogs = async () => {
    try {
      const exportData = await loggingService.exportLogs('text');
      
      await Share.share({
        message: exportData,
        title: 'VerbumCare Debug Logs',
      });
    } catch (error) {
      Alert.alert('Export Failed', 'Failed to export logs. Please try again.');
    }
  };

  const clearAllLogs = () => {
    Alert.alert(
      'Clear All Logs',
      'Are you sure you want to clear all logs? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await loggingService.clearLogs();
              await loadLogs();
              Alert.alert('Success', 'All logs have been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear logs. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatTimestamp = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getLogLevelColor = (level: LogLevel): string => {
    switch (level) {
      case LogLevel.DEBUG: return COLORS.text.secondary;
      case LogLevel.INFO: return COLORS.primary;
      case LogLevel.WARN: return COLORS.warning;
      case LogLevel.ERROR: return COLORS.error;
      case LogLevel.CRITICAL: return COLORS.error;
      default: return COLORS.text.primary;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
      case 'success':
      case 'connected': return COLORS.success;
      case 'failed':
      case 'error':
      case 'failure': return COLORS.error;
      case 'in_progress':
      case 'testing': return COLORS.warning;
      default: return COLORS.text.secondary;
    }
  };

  const renderTabButton = (tab: TabType, title: string) => (
    <TouchableOpacity
      key={tab}
      style={[
        styles.tabButton,
        activeTab === tab && styles.activeTabButton
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tab && styles.activeTabButtonText
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderLogEntry = ({ item }: { item: LogEntry }) => {
    const matchesSearch = searchQuery === '' || 
      item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.operation.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return null;

    return (
      <TouchableOpacity
        style={styles.logEntry}
        onPress={() => setSelectedLogEntry(item)}
      >
        <View style={styles.logHeader}>
          <Text style={[styles.logLevel, { color: getLogLevelColor(item.level) }]}>
            {item.level}
          </Text>
          <Text style={styles.logTimestamp}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
        <Text style={styles.logCategory}>{item.category}</Text>
        <Text style={styles.logMessage} numberOfLines={2}>
          {item.message}
        </Text>
        {item.duration && (
          <Text style={styles.logDuration}>
            Duration: {formatDuration(item.duration)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderServerSwitchLog = ({ item }: { item: ServerSwitchLog }) => (
    <View style={styles.serverSwitchEntry}>
      <View style={styles.switchHeader}>
        <Text style={styles.switchTitle}>
          {item.fromServerId} → {item.toServerId}
        </Text>
        <Text style={[styles.switchStatus, { color: getStatusColor(item.status) }]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.switchTime}>
        {formatTimestamp(item.startTime)}
      </Text>
      <Text style={styles.switchDuration}>
        Duration: {formatDuration(item.totalDuration)}
      </Text>
      <Text style={styles.switchPhases}>
        Phases: {item.phases.length} | Success: {item.success ? 'Yes' : 'No'}
      </Text>
      {item.errorMessage && (
        <Text style={styles.switchError} numberOfLines={2}>
          Error: {item.errorMessage}
        </Text>
      )}
    </View>
  );

  const renderConnectivityLog = ({ item }: { item: ConnectivityTestLog }) => (
    <View style={styles.connectivityEntry}>
      <View style={styles.connHeader}>
        <Text style={styles.connServer}>{item.serverName}</Text>
        <Text style={[styles.connStatus, { color: getStatusColor(item.result.status) }]}>
          {item.result.status}
        </Text>
      </View>
      <Text style={styles.connTime}>
        {formatTimestamp(item.timestamp)}
      </Text>
      <Text style={styles.connDuration}>
        Duration: {formatDuration(item.duration)}
      </Text>
      <Text style={styles.connHealthChecks}>
        Health Checks: {item.result.healthChecks.filter(hc => hc.status === 'success').length}/{item.result.healthChecks.length}
      </Text>
      {item.result.errorMessage && (
        <Text style={styles.connError} numberOfLines={2}>
          Error: {item.result.errorMessage}
        </Text>
      )}
    </View>
  );

  const renderErrorReport = ({ item }: { item: ErrorReport }) => (
    <TouchableOpacity
      style={styles.errorEntry}
      onPress={() => setSelectedErrorReport(item)}
    >
      <View style={styles.errorHeader}>
        <Text style={styles.errorType}>{item.error.type}</Text>
        <Text style={[styles.errorSeverity, { color: getStatusColor(item.error.severity) }]}>
          {item.error.severity}
        </Text>
      </View>
      <Text style={styles.errorTime}>
        {formatTimestamp(item.timestamp)}
      </Text>
      <Text style={styles.errorOperation}>{item.operation}</Text>
      <Text style={styles.errorMessage} numberOfLines={2}>
        {item.error.message}
      </Text>
    </TouchableOpacity>
  );

  const renderPerformanceMetrics = () => {
    if (!performanceMetrics) return null;

    const avgServerSwitchTime = performanceMetrics.serverSwitchDurations.length > 0
      ? performanceMetrics.serverSwitchDurations.reduce((a, b) => a + b, 0) / performanceMetrics.serverSwitchDurations.length
      : 0;

    const avgConnectivityTime = performanceMetrics.connectivityTestDurations.length > 0
      ? performanceMetrics.connectivityTestDurations.reduce((a, b) => a + b, 0) / performanceMetrics.connectivityTestDurations.length
      : 0;

    return (
      <ScrollView style={styles.metricsContainer}>
        <View style={styles.metricSection}>
          <Text style={styles.metricTitle}>Server Switch Performance</Text>
          <Text style={styles.metricValue}>
            Average Duration: {formatDuration(avgServerSwitchTime)}
          </Text>
          <Text style={styles.metricValue}>
            Total Switches: {performanceMetrics.serverSwitchDurations.length}
          </Text>
        </View>

        <View style={styles.metricSection}>
          <Text style={styles.metricTitle}>Connectivity Test Performance</Text>
          <Text style={styles.metricValue}>
            Average Duration: {formatDuration(avgConnectivityTime)}
          </Text>
          <Text style={styles.metricValue}>
            Total Tests: {performanceMetrics.connectivityTestDurations.length}
          </Text>
        </View>

        <View style={styles.metricSection}>
          <Text style={styles.metricTitle}>Error Counts</Text>
          {Object.entries(performanceMetrics.errorCounts).map(([errorType, count]) => (
            <Text key={errorType} style={styles.metricValue}>
              {errorType}: {count}
            </Text>
          ))}
        </View>

        <View style={styles.metricSection}>
          <Text style={styles.metricTitle}>Success Rates</Text>
          {Object.entries(performanceMetrics.successRates).map(([operation, rate]) => (
            <Text key={operation} style={styles.metricValue}>
              {operation}: {rate.toFixed(1)}%
            </Text>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Level:</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            // Cycle through log levels
            const levels: (LogLevel | 'ALL')[] = ['ALL', LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
            const currentIndex = levels.indexOf(filterLevel);
            const nextIndex = (currentIndex + 1) % levels.length;
            setFilterLevel(levels[nextIndex]);
          }}
        >
          <Text style={styles.filterButtonText}>{filterLevel}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Category:</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            // Cycle through categories
            const categories: (LogCategory | 'ALL')[] = ['ALL', ...Object.values(LogCategory)];
            const currentIndex = categories.indexOf(filterCategory);
            const nextIndex = (currentIndex + 1) % categories.length;
            setFilterCategory(categories[nextIndex]);
          }}
        >
          <Text style={styles.filterButtonText}>{filterCategory}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchBar = () => (
    <TextInput
      style={styles.searchInput}
      placeholder="Search logs..."
      value={searchQuery}
      onChangeText={setSearchQuery}
      clearButtonMode="while-editing"
    />
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'logs':
        return (
          <View style={styles.contentContainer}>
            {renderFilters()}
            {renderSearchBar()}
            <FlatList
              data={logs}
              renderItem={renderLogEntry}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              style={styles.list}
            />
          </View>
        );

      case 'server_switches':
        return (
          <FlatList
            data={serverSwitchLogs}
            renderItem={renderServerSwitchLog}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            style={styles.list}
          />
        );

      case 'connectivity':
        return (
          <FlatList
            data={connectivityLogs}
            renderItem={renderConnectivityLog}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            style={styles.list}
          />
        );

      case 'errors':
        return (
          <FlatList
            data={errorReports}
            renderItem={renderErrorReport}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            style={styles.list}
          />
        );

      case 'performance':
        return renderPerformanceMetrics();

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug Logs</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={exportLogs}>
            <Text style={styles.actionButtonText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={clearAllLogs}>
            <Text style={styles.actionButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {renderTabButton('logs', 'Logs')}
        {renderTabButton('server_switches', 'Server Switches')}
        {renderTabButton('connectivity', 'Connectivity')}
        {renderTabButton('errors', 'Errors')}
        {renderTabButton('performance', 'Performance')}
      </ScrollView>

      {/* Content */}
      {renderContent()}

      {/* Log Entry Detail Modal */}
      <Modal
        visible={selectedLogEntry !== null}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedLogEntry && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Entry Details</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedLogEntry(null)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.detailLabel}>Level:</Text>
              <Text style={[styles.detailValue, { color: getLogLevelColor(selectedLogEntry.level) }]}>
                {selectedLogEntry.level}
              </Text>

              <Text style={styles.detailLabel}>Category:</Text>
              <Text style={styles.detailValue}>{selectedLogEntry.category}</Text>

              <Text style={styles.detailLabel}>Operation:</Text>
              <Text style={styles.detailValue}>{selectedLogEntry.operation}</Text>

              <Text style={styles.detailLabel}>Message:</Text>
              <Text style={styles.detailValue}>{selectedLogEntry.message}</Text>

              <Text style={styles.detailLabel}>Timestamp:</Text>
              <Text style={styles.detailValue}>{formatTimestamp(selectedLogEntry.timestamp)}</Text>

              {selectedLogEntry.duration && (
                <>
                  <Text style={styles.detailLabel}>Duration:</Text>
                  <Text style={styles.detailValue}>{formatDuration(selectedLogEntry.duration)}</Text>
                </>
              )}

              {selectedLogEntry.context && (
                <>
                  <Text style={styles.detailLabel}>Context:</Text>
                  <Text style={styles.detailValue}>
                    {JSON.stringify(selectedLogEntry.context, null, 2)}
                  </Text>
                </>
              )}

              {selectedLogEntry.error && (
                <>
                  <Text style={styles.detailLabel}>Error:</Text>
                  <Text style={styles.detailValue}>
                    {JSON.stringify(selectedLogEntry.error, null, 2)}
                  </Text>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Error Report Detail Modal */}
      <Modal
        visible={selectedErrorReport !== null}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedErrorReport && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Error Report Details</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedErrorReport(null)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.detailLabel}>Error Type:</Text>
              <Text style={styles.detailValue}>{selectedErrorReport.error.type}</Text>

              <Text style={styles.detailLabel}>Severity:</Text>
              <Text style={[styles.detailValue, { color: getStatusColor(selectedErrorReport.error.severity) }]}>
                {selectedErrorReport.error.severity}
              </Text>

              <Text style={styles.detailLabel}>Operation:</Text>
              <Text style={styles.detailValue}>{selectedErrorReport.operation}</Text>

              <Text style={styles.detailLabel}>Message:</Text>
              <Text style={styles.detailValue}>{selectedErrorReport.error.message}</Text>

              <Text style={styles.detailLabel}>Suggested Actions:</Text>
              {selectedErrorReport.error.suggestedActions.map((action, index) => (
                <Text key={index} style={styles.detailValue}>• {action}</Text>
              ))}

              <Text style={styles.detailLabel}>System Info:</Text>
              <Text style={styles.detailValue}>
                {JSON.stringify(selectedErrorReport.systemInfo, null, 2)}
              </Text>

              <Text style={styles.detailLabel}>Debug Info:</Text>
              <Text style={styles.detailValue}>
                {JSON.stringify(selectedErrorReport.debugInfo, null, 2)}
              </Text>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.secondary,
  },
  backButton: {
    padding: SPACING.xs,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  actionButtonText: {
    color: COLORS.background.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  tabsContainer: {
    backgroundColor: COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  tabButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xs,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  filterLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginRight: SPACING.xs,
  },
  filterButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.background.primary,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  filterButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
  },
  searchInput: {
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background.primary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  list: {
    flex: 1,
  },
  logEntry: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  logLevel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  logTimestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  logCategory: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  logMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  logDuration: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  serverSwitchEntry: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  switchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  switchTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  switchStatus: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  switchTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  switchDuration: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  switchPhases: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  switchError: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
  },
  connectivityEntry: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  connHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  connServer: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  connStatus: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  connTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  connDuration: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  connHealthChecks: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  connError: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
  },
  errorEntry: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  errorType: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  errorSeverity: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  errorTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  errorOperation: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
  },
  metricsContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  metricSection: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 8,
  },
  metricTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.secondary,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    padding: SPACING.xs,
  },
  modalCloseText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: SPACING.md,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
});

export default DebugLogsScreen;