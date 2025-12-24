/**
 * Settings Screen - Backend Switching and Configuration Management
 * 
 * This screen provides a centralized interface for managing server configuration,
 * language preferences, and other app settings. It includes real-time connection
 * status, server switching capabilities, and comprehensive error handling.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSettingsStore } from '@stores/settingsStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { Card } from '@components/ui';
import { SettingsHelpModal } from '@components/SettingsHelpModal';
import { SettingsTooltip, HelpIcon, InfoCard, QuickHelpBanner } from '@components/SettingsTooltip';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { ServerConfig } from '@config/servers';
import { Language } from '@types/app';
import { ConnectionStatus } from '@types/settings';
import { LANGUAGE_DISPLAY_NAMES } from '@types/settings';
import { nativeSettingsService } from '@services/nativeSettingsService';

type RootStackParamList = {
  Settings: undefined;
  Dashboard: undefined;
  NativeModuleTest: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export default function SettingsScreen({ navigation }: Props) {
  const {
    currentServer,
    availableServers,
    connectionStatus,
    detailedStatus,
    currentLanguage,
    availableLanguages,
    serverSwitchState,
    lastError,
    preferences,
    testServerConnectivity,
    refreshConnectionStatus,
    setLanguage,
    clearError,
    loadSettings,
    getOfflineStatus,
    clearOfflineQueue,
    processOfflineQueue,
  } = useSettingsStore();

  const { language: assessmentLanguage } = useAssessmentStore();
  const [refreshing, setRefreshing] = useState(false);
  const [testingConnections, setTestingConnections] = useState<Set<string>>(new Set());
  const [offlineStatus, setOfflineStatus] = useState<any>(null);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [showQuickHelp, setShowQuickHelp] = useState(true);
  const [serverSource, setServerSource] = useState<'ios_settings' | 'fallback'>('fallback');

  const t = translations[assessmentLanguage];

  // Load settings on mount and check server source
  useEffect(() => {
    loadSettings();
    refreshConnectionStatus();
    updateOfflineStatus();
    checkServerSource();
  }, []);

  // Check if server configuration comes from iOS Settings
  const checkServerSource = async () => {
    try {
      const hasNativeOverride = await nativeSettingsService.hasNativeSettingsOverride();
      setServerSource(hasNativeOverride ? 'ios_settings' : 'fallback');
    } catch (error) {
      console.error('Failed to check server source:', error);
      setServerSource('fallback');
    }
  };

  // Auto-refresh connection status and offline status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!serverSwitchState.isInProgress) {
        refreshConnectionStatus();
        updateOfflineStatus();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [serverSwitchState.isInProgress]);

  const updateOfflineStatus = () => {
    try {
      const status = getOfflineStatus();
      setOfflineStatus(status);
    } catch (error) {
      console.error('Failed to get offline status:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSettings();
      await refreshConnectionStatus();
      updateOfflineStatus();
      await checkServerSource(); // Also refresh server source
    } catch (error) {
      console.error('Failed to refresh settings:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenIOSSettings = async () => {
    try {
      // Deep link to iOS Settings app
      await Linking.openSettings();
    } catch (error) {
      console.error('Failed to open iOS Settings:', error);
      Alert.alert(
        assessmentLanguage === 'ja' ? 'エラー' : 'Error',
        assessmentLanguage === 'ja' 
          ? 'iOS設定アプリを開けませんでした。手動で設定 > VerbumCareを開いてください。'
          : 'Failed to open iOS Settings. Please manually open Settings > VerbumCare.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTestConnection = async () => {
    if (testingConnections.has(currentServer.id)) {
      return; // Already testing
    }

    setTestingConnections(prev => new Set(prev).add(currentServer.id));
    
    try {
      const result = await testServerConnectivity(currentServer.id);
      
      const statusMessage = result.status === 'connected' 
        ? (assessmentLanguage === 'ja' ? '接続成功' : 'Connection successful')
        : (assessmentLanguage === 'ja' ? '接続失敗' : 'Connection failed');
      
      Alert.alert(
        assessmentLanguage === 'ja' ? '接続テスト結果' : 'Connection Test Result',
        `${currentServer.displayName}: ${statusMessage}${result.errorMessage ? `\n${result.errorMessage}` : ''}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert(
        assessmentLanguage === 'ja' ? 'テスト失敗' : 'Test Failed',
        error.message,
        [{ text: 'OK' }]
      );
    } finally {
      setTestingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentServer.id);
        return newSet;
      });
    }
  };

  const handleLanguageChange = async (language: Language) => {
    if (language === currentLanguage) {
      return;
    }

    await setLanguage(language);
    updateOfflineStatus(); // Update offline status after language change
  };

  const handleClearOfflineQueue = async () => {
    Alert.alert(
      assessmentLanguage === 'ja' ? 'オフラインキューをクリア' : 'Clear Offline Queue',
      assessmentLanguage === 'ja' 
        ? 'キューに保存されているすべての操作を削除しますか？'
        : 'Delete all queued operations? This cannot be undone.',
      [
        {
          text: assessmentLanguage === 'ja' ? 'キャンセル' : 'Cancel',
          style: 'cancel',
        },
        {
          text: assessmentLanguage === 'ja' ? 'クリア' : 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearOfflineQueue();
              updateOfflineStatus();
              Alert.alert(
                assessmentLanguage === 'ja' ? '完了' : 'Complete',
                assessmentLanguage === 'ja' ? 'オフラインキューをクリアしました' : 'Offline queue cleared successfully'
              );
            } catch (error) {
              Alert.alert(
                assessmentLanguage === 'ja' ? 'エラー' : 'Error',
                assessmentLanguage === 'ja' ? 'キューのクリアに失敗しました' : 'Failed to clear offline queue'
              );
            }
          },
        },
      ]
    );
  };

  const handleProcessOfflineQueue = async () => {
    try {
      await processOfflineQueue();
      updateOfflineStatus();
      Alert.alert(
        assessmentLanguage === 'ja' ? '完了' : 'Complete',
        assessmentLanguage === 'ja' ? 'オフラインキューを処理しました' : 'Offline queue processed successfully'
      );
    } catch (error) {
      Alert.alert(
        assessmentLanguage === 'ja' ? 'エラー' : 'Error',
        assessmentLanguage === 'ja' ? 'キューの処理に失敗しました' : 'Failed to process offline queue'
      );
    }
  };



  const getConnectionStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return COLORS.success;
      case 'disconnected': return COLORS.text.disabled;
      case 'testing': return COLORS.warning;
      case 'switching': return COLORS.info;
      case 'error': return COLORS.error;
      default: return COLORS.text.disabled;
    }
  };

  const getConnectionStatusIcon = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return 'checkmark-circle';
      case 'disconnected': return 'close-circle';
      case 'testing': return 'time';
      case 'switching': return 'swap-horizontal';
      case 'error': return 'warning';
      default: return 'help-circle';
    }
  };

  const getConnectionStatusText = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return assessmentLanguage === 'ja' ? '接続中' : 'Connected';
      case 'disconnected': return assessmentLanguage === 'ja' ? '未接続' : 'Disconnected';
      case 'testing': return assessmentLanguage === 'ja' ? 'テスト中' : 'Testing';
      case 'switching': return assessmentLanguage === 'ja' ? '切り替え中' : 'Switching';
      case 'error': return assessmentLanguage === 'ja' ? 'エラー' : 'Error';
      default: return assessmentLanguage === 'ja' ? '不明' : 'Unknown';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={ICON_SIZES.md} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {assessmentLanguage === 'ja' ? '設定' : 'Settings'}
        </Text>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => setHelpModalVisible(true)}
        >
          <Ionicons name="help-circle" size={ICON_SIZES.md} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            title={assessmentLanguage === 'ja' ? '更新中...' : 'Refreshing...'}
            titleColor={COLORS.text.secondary}
          />
        }
      >
        {/* Quick Help Banner */}
        {showQuickHelp && (
          <QuickHelpBanner
            title={t['settings.helpTitle']}
            message={t['settings.helpIntroduction']}
            onDismiss={() => setShowQuickHelp(false)}
            onLearnMore={() => setHelpModalVisible(true)}
            language={assessmentLanguage}
          />
        )}

        {/* Server Configuration Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server" size={ICON_SIZES.md} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {assessmentLanguage === 'ja' ? 'サーバー設定' : 'Server Configuration'}
            </Text>
            <SettingsTooltip
              type="serverSelector"
              language={assessmentLanguage}
            >
              <HelpIcon onPress={() => {}} />
            </SettingsTooltip>
          </View>

          {/* Current Server Status - Read Only */}
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>
                {assessmentLanguage === 'ja' ? '現在のサーバー' : 'Current Server'}
              </Text>
              <View style={styles.connectionStatus}>
                <View style={[styles.statusDot, { backgroundColor: getConnectionStatusColor(connectionStatus) }]} />
                <Text style={[styles.statusText, { color: getConnectionStatusColor(connectionStatus) }]}>
                  {getConnectionStatusText(connectionStatus)}
                </Text>
              </View>
            </View>
            
            <View style={styles.currentServerInfo}>
              <Text style={styles.serverName}>{currentServer.displayName}</Text>
              <Text style={styles.serverDescription}>{currentServer.description}</Text>
              <Text style={styles.serverUrl}>{currentServer.baseUrl}</Text>
              
              {/* Server Source Indicator */}
              <View style={styles.serverSourceContainer}>
                <Ionicons 
                  name={serverSource === 'ios_settings' ? 'settings' : 'warning'} 
                  size={ICON_SIZES.xs} 
                  color={serverSource === 'ios_settings' ? COLORS.success : COLORS.warning} 
                />
                <Text style={[styles.serverSourceText, { 
                  color: serverSource === 'ios_settings' ? COLORS.success : COLORS.warning 
                }]}>
                  {serverSource === 'ios_settings' 
                    ? (assessmentLanguage === 'ja' ? 'iOS設定から設定済み' : 'Configured via iOS Settings')
                    : (assessmentLanguage === 'ja' ? 'デフォルト設定を使用' : 'Using default settings')
                  }
                </Text>
              </View>
              
              {detailedStatus && detailedStatus.responseTime && (
                <Text style={styles.responseTime}>
                  {assessmentLanguage === 'ja' ? '応答時間' : 'Response time'}: {detailedStatus.responseTime}ms
                </Text>
              )}
            </View>

            {/* Server Actions */}
            <View style={styles.serverActionsContainer}>
              {/* Test Connection Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.testButton, testingConnections.has(currentServer.id) && styles.testButtonTesting]}
                onPress={handleTestConnection}
                disabled={testingConnections.has(currentServer.id)}
              >
                {testingConnections.has(currentServer.id) ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="pulse" size={ICON_SIZES.sm} color={COLORS.primary} />
                )}
                <Text style={styles.actionButtonText}>
                  {assessmentLanguage === 'ja' ? 'テスト' : 'Test Connection'}
                </Text>
              </TouchableOpacity>

              {/* Open iOS Settings Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.settingsButton]}
                onPress={handleOpenIOSSettings}
              >
                <Ionicons name="settings" size={ICON_SIZES.sm} color={COLORS.white} />
                <Text style={styles.settingsButtonText}>
                  {assessmentLanguage === 'ja' ? 'iOS設定を開く' : 'Open iOS Settings'}
                </Text>
              </TouchableOpacity>

              {/* Native Module Test Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.testButton]}
                onPress={() => navigation.navigate('NativeModuleTest')}
              >
                <Ionicons name="code" size={ICON_SIZES.sm} color={COLORS.primary} />
                <Text style={styles.actionButtonText}>
                  {assessmentLanguage === 'ja' ? 'ネイティブモジュールテスト' : 'Native Module Test'}
                </Text>
              </TouchableOpacity>

              {/* Force iOS Settings Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.settingsButton]}
                onPress={async () => {
                  Alert.alert(
                    assessmentLanguage === 'ja' ? 'iOS設定を強制適用' : 'Force iOS Settings',
                    assessmentLanguage === 'ja' 
                      ? 'アプリの保存された設定をクリアして、iOS設定を強制的に適用しますか？'
                      : 'Clear app saved settings and force iOS Settings to take precedence?',
                    [
                      {
                        text: assessmentLanguage === 'ja' ? 'キャンセル' : 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: assessmentLanguage === 'ja' ? '強制適用' : 'Force Apply',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await useSettingsStore.getState().clearPersistedSettings();
                            Alert.alert(
                              assessmentLanguage === 'ja' ? '完了' : 'Complete',
                              assessmentLanguage === 'ja' ? 'iOS設定が適用されました' : 'iOS Settings have been applied'
                            );
                          } catch (error) {
                            Alert.alert(
                              assessmentLanguage === 'ja' ? 'エラー' : 'Error',
                              assessmentLanguage === 'ja' ? '設定のクリアに失敗しました' : 'Failed to clear settings'
                            );
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="refresh-circle" size={ICON_SIZES.sm} color={COLORS.white} />
                <Text style={styles.settingsButtonText}>
                  {assessmentLanguage === 'ja' ? 'iOS設定を強制適用' : 'Force iOS Settings'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Server Switch Progress */}
            {serverSwitchState.isInProgress && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.progressText}>{serverSwitchState.progress}</Text>
              </View>
            )}
          </Card>

          {/* Configuration Help */}
          <InfoCard
            icon="information-circle"
            title={assessmentLanguage === 'ja' ? 'サーバー設定について' : 'About Server Configuration'}
            description={
              assessmentLanguage === 'ja' 
                ? 'サーバーアドレスはiOS設定アプリで設定できます。設定 > VerbumCareを開いて、バックエンドサーバーを選択してください。'
                : 'Server addresses can be configured in the iOS Settings app. Open Settings > VerbumCare to select your backend server.'
            }
            color={COLORS.info}
            onPress={handleOpenIOSSettings}
          />
        </View>

        {/* Language Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language" size={ICON_SIZES.md} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>
              {assessmentLanguage === 'ja' ? '言語設定' : 'Language Settings'}
            </Text>
            <SettingsTooltip
              type="languageSelector"
              language={assessmentLanguage}
            >
              <HelpIcon onPress={() => {}} />
            </SettingsTooltip>
          </View>

          <Card style={styles.languageCard}>
            <Text style={styles.subsectionTitle}>
              {assessmentLanguage === 'ja' ? '表示言語' : 'Display Language'}
            </Text>
            
            <View style={styles.languageOptions}>
              {availableLanguages.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.languageOption,
                    lang === currentLanguage && styles.languageOptionSelected,
                  ]}
                  onPress={() => handleLanguageChange(lang)}
                  disabled={serverSwitchState.isInProgress}
                >
                  <Text style={[
                    styles.languageOptionText,
                    lang === currentLanguage && styles.languageOptionTextSelected,
                  ]}>
                    {LANGUAGE_DISPLAY_NAMES[lang]}
                  </Text>
                  {lang === currentLanguage && (
                    <Ionicons name="checkmark" size={ICON_SIZES.sm} color={COLORS.white} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </View>

        {/* Connection Details Section */}
        {detailedStatus && detailedStatus.healthChecks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="analytics" size={ICON_SIZES.md} color={COLORS.info} />
              <Text style={styles.sectionTitle}>
                {assessmentLanguage === 'ja' ? '接続詳細' : 'Connection Details'}
              </Text>
              <SettingsTooltip
                type="healthCheck"
                language={assessmentLanguage}
              >
                <HelpIcon onPress={() => {}} />
              </SettingsTooltip>
            </View>

            <Card style={styles.detailsCard}>
              <Text style={styles.subsectionTitle}>
                {assessmentLanguage === 'ja' ? 'ヘルスチェック結果' : 'Health Check Results'}
              </Text>
              
              {detailedStatus.healthChecks.map((check, index) => (
                <View key={index} style={styles.healthCheckItem}>
                  <Ionicons
                    name={check.status === 'success' ? 'checkmark-circle' : 'close-circle'}
                    size={ICON_SIZES.sm}
                    color={check.status === 'success' ? COLORS.success : COLORS.error}
                  />
                  <View style={styles.healthCheckInfo}>
                    <Text style={styles.healthCheckEndpoint}>{check.endpoint}</Text>
                    {check.responseTime && (
                      <Text style={styles.healthCheckTime}>{check.responseTime}ms</Text>
                    )}
                    {check.error && (
                      <Text style={styles.healthCheckError}>{check.error}</Text>
                    )}
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Error Display */}
        {lastError && (
          <View style={styles.section}>
            <Card style={styles.errorCard}>
              <View style={styles.errorHeader}>
                <Ionicons name="warning" size={ICON_SIZES.md} color={COLORS.error} />
                <Text style={styles.errorTitle}>
                  {assessmentLanguage === 'ja' ? 'エラー' : 'Error'}
                </Text>
                <TouchableOpacity onPress={clearError} style={styles.errorDismiss}>
                  <Ionicons name="close" size={ICON_SIZES.sm} color={COLORS.error} />
                </TouchableOpacity>
              </View>
              <Text style={styles.errorMessage}>{lastError}</Text>
            </Card>
          </View>
        )}

        {/* Debug Section (Development Only) */}
        {__DEV__ && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bug" size={ICON_SIZES.md} color={COLORS.warning} />
              <Text style={styles.sectionTitle}>
                {assessmentLanguage === 'ja' ? 'デバッグ・トラブルシューティング' : 'Debug & Troubleshooting'}
              </Text>
              <SettingsTooltip
                type="debugLogs"
                language={assessmentLanguage}
              >
                <HelpIcon onPress={() => {}} />
              </SettingsTooltip>
            </View>

            <Card style={styles.debugCard}>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => navigation.navigate('DebugLogs' as any)}
              >
                <View style={styles.debugButtonContent}>
                  <Ionicons name="document-text" size={ICON_SIZES.md} color={COLORS.primary} />
                  <View style={styles.debugButtonText}>
                    <Text style={styles.debugButtonTitle}>
                      {assessmentLanguage === 'ja' ? 'デバッグログを表示' : 'View Debug Logs'}
                    </Text>
                    <Text style={styles.debugButtonSubtitle}>
                      {assessmentLanguage === 'ja' 
                        ? '詳細なログとトラブルシューティング情報にアクセス' 
                        : 'Access detailed logs and troubleshooting information'
                      }
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={ICON_SIZES.sm} color={COLORS.text.secondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={async () => {
                  try {
                    const { loggingService } = await import('../services/loggingService');
                    const { Share } = await import('react-native');
                    
                    const exportData = await loggingService.exportLogs('text');
                    await Share.share({
                      message: exportData,
                      title: 'VerbumCare Debug Logs',
                    });
                  } catch (error) {
                    Alert.alert(
                      assessmentLanguage === 'ja' ? 'エクスポート失敗' : 'Export Failed',
                      assessmentLanguage === 'ja' 
                        ? 'ログのエクスポートに失敗しました。もう一度お試しください。'
                        : 'Failed to export logs. Please try again.'
                    );
                  }
                }}
              >
                <View style={styles.debugButtonContent}>
                  <Ionicons name="share" size={ICON_SIZES.md} color={COLORS.primary} />
                  <View style={styles.debugButtonText}>
                    <Text style={styles.debugButtonTitle}>
                      {assessmentLanguage === 'ja' ? 'デバッグログをエクスポート' : 'Export Debug Logs'}
                    </Text>
                    <Text style={styles.debugButtonSubtitle}>
                      {assessmentLanguage === 'ja' 
                        ? 'テクニカルサポート用にログを共有' 
                        : 'Share logs for technical support'
                      }
                    </Text>
                  </View>
                </View>
                <Ionicons name="open" size={ICON_SIZES.sm} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Settings Help Modal */}
      <SettingsHelpModal
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
        language={assessmentLanguage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.xl,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
    textAlign: 'center',
  },
  helpButton: {
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  subsectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  statusCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  currentServerInfo: {
    marginBottom: SPACING.md,
  },
  serverName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  serverDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  serverUrl: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.disabled,
    fontFamily: TYPOGRAPHY.fontFamily.mono,
  },
  responseTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  serverSourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  serverSourceText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginLeft: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  serverActionsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    flex: 1,
    justifyContent: 'center',
  },
  testButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  testButtonTesting: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  settingsButton: {
    backgroundColor: COLORS.primary,
  },
  settingsButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white,
    marginLeft: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
  },
  languageCard: {
    padding: SPACING.lg,
  },
  languageOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    minWidth: 120,
  },
  languageOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  languageOptionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    flex: 1,
  },
  languageOptionTextSelected: {
    color: COLORS.white,
  },
  detailsCard: {
    padding: SPACING.lg,
  },
  healthCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  healthCheckInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  healthCheckEndpoint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  healthCheckTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  healthCheckError: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
  },
  errorCard: {
    padding: SPACING.lg,
    backgroundColor: `${COLORS.error}10`,
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
    flex: 1,
    marginLeft: SPACING.sm,
  },
  errorDismiss: {
    padding: SPACING.xs,
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
  debugCard: {
    padding: SPACING.lg,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  debugButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debugButtonText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  debugButtonTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  debugButtonSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
});