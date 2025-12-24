/**
 * Settings Store - Backend Switching and Configuration Management
 * 
 * This store manages server configuration, language preferences, and settings persistence
 * using Zustand for state management and AsyncStorage for persistence.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { 
  SettingsState, 
  SettingsActions, 
  PersistedSettings, 
  DetailedConnectionStatus,
  ServerSwitchState,
  UserPreferences,
  ServerHistoryEntry,
  ConnectionStatus,
  HealthCheckResult,
  validatePersistedSettings,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_SWITCH_STATE,
  AVAILABLE_LANGUAGES
} from '../types/settings';
import { ServerConfig, AVAILABLE_SERVERS, getServerById, getDefaultServer } from '../config/servers';
import { Language } from '../types/app';
import { languageSyncService } from '../services/languageSync';
import { 
  SETTINGS_STORAGE_KEY, 
  DEFAULT_PERSISTED_SETTINGS, 
  CONNECTION_TEST_CONFIG,
  SERVER_SWITCH_CONFIG,
  SWITCH_PROGRESS_MESSAGES,
  SETTINGS_ERROR_MESSAGES,
  DEFAULT_LANGUAGE
} from '../constants/settings';
import { networkService } from '../services/networkService';
import { cacheService } from '../services/cacheService';
import { backendConfigService } from '../services/backendConfigService';
import { offlineQueueService } from '../services/offlineQueueService';
import { useAuthStore } from './authStore';
import { 
  errorHandlingService, 
  ErrorType, 
  EnhancedError, 
  OperationResult 
} from '../services/errorHandlingService';
import { 
  loggingService, 
  LogCategory, 
  LogLevel 
} from '../services/loggingService';
import { 
  settingsInitializationService, 
  SettingsInitializationResult 
} from '../services/settingsInitializationService';
import { uiOptimizationService } from '../services/uiOptimizationService';
import { nativeSettingsService } from '../services/nativeSettingsService';
import { smartServerSelector, ServerSelectionResult } from '../services/smartServerSelector';

// Combined store interface
interface SettingsStore extends SettingsState, SettingsActions {}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Initial state
  currentServer: getDefaultServer(),
  availableServers: AVAILABLE_SERVERS,
  connectionStatus: 'disconnected',
  detailedStatus: undefined,
  serverSource: 'fallback',
  currentLanguage: DEFAULT_LANGUAGE,
  availableLanguages: AVAILABLE_LANGUAGES,
  serverSwitchState: DEFAULT_SWITCH_STATE,
  lastError: null,
  preferences: DEFAULT_USER_PREFERENCES,
  serverHistory: [],

  // Smart server selection methods (defined early to be available for other methods)
  performSmartDefaultSelection: async (): Promise<ServerConfig> => {
    try {
      console.log('[SettingsStore] Performing smart server selection...');
      
      const selectionResult: ServerSelectionResult = await smartServerSelector.selectBestServer();
      
      console.log(`[SettingsStore] Smart selection result: ${selectionResult.selectedServer.displayName}`);
      console.log(`[SettingsStore] Selection reason: ${selectionResult.selectionReason}`);
      
      // Log test results for transparency
      if (selectionResult.testResults.length > 0) {
        console.log('[SettingsStore] Server test results:');
        selectionResult.testResults.forEach(result => {
          const status = result.success ? '✅' : '❌';
          console.log(`  ${status} ${result.serverId}: ${result.responseTime}ms ${result.error ? `(${result.error})` : ''}`);
        });
      }
      
      return selectionResult.selectedServer;
    } catch (error: any) {
      console.error('[SettingsStore] Smart server selection failed:', error);
      
      // Fall back to default server
      const fallbackServer = getDefaultServer();
      console.log(`[SettingsStore] Using fallback server: ${fallbackServer.displayName}`);
      
      return fallbackServer;
    }
  },

  // Server selection with priority system
  selectServerWithPriority: async (): Promise<{
    server: ServerConfig;
    source: 'ios_settings' | 'user_explicit' | 'smart_default' | 'fallback';
    reason: string;
  }> => {
    try {
      // Priority 1: iOS Settings
      const nativeResult = await nativeSettingsService.readNativeSettings();
      const hasValidIOSSettings = nativeResult.success && nativeResult.serverConfig && 
        (nativeResult.source === 'ios_settings' || nativeResult.source === 'cache');
      
      if (hasValidIOSSettings) {
        return {
          server: nativeResult.serverConfig!,
          source: 'ios_settings',
          reason: 'User configured server in iOS Settings'
        };
      }
      
      // Priority 2: User explicit choice (from persisted settings)
      try {
        const persistedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (persistedSettings) {
          const settings = JSON.parse(persistedSettings);
          if (settings.currentServerId) {
            const userServer = getServerById(settings.currentServerId);
            if (userServer) {
              return {
                server: userServer,
                source: 'user_explicit',
                reason: 'User previously selected this server'
              };
            }
          }
        }
      } catch (error) {
        console.warn('[SettingsStore] Failed to read user explicit choice:', error);
      }
      
      // Priority 3: Smart default selection
      const smartServer = await get().performSmartDefaultSelection();
      return {
        server: smartServer,
        source: 'smart_default',
        reason: 'Auto-selected based on server availability'
      };
      
    } catch (error: any) {
      console.error('[SettingsStore] Server selection with priority failed:', error);
      
      // Priority 4: Emergency fallback
      return {
        server: getDefaultServer(),
        source: 'fallback',
        reason: 'Emergency fallback due to selection failure'
      };
    }
  },

  // DEBUG: Force clear settings and reload (for development/debugging)
  debugClearAndReload: async (): Promise<void> => {
    try {
      console.log('[SettingsStore] DEBUG: Clearing persisted settings and reloading...');
      await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
      
      // Reset to default state
      set({
        currentServer: getDefaultServer(),
        serverSource: 'fallback',
        currentLanguage: DEFAULT_LANGUAGE,
        serverHistory: [],
        preferences: DEFAULT_USER_PREFERENCES,
        lastError: null,
        connectionStatus: 'disconnected',
        detailedStatus: null,
        serverSwitchState: DEFAULT_SWITCH_STATE,
      });
      
      // Immediately reload settings to use iOS Settings
      await get().loadSettings();
      
      console.log('[SettingsStore] ✅ DEBUG: Settings cleared and reloaded');
    } catch (error: any) {
      console.error('[SettingsStore] ❌ DEBUG: Failed to clear and reload:', error);
    }
  },

  // Force clear persisted settings to allow iOS Settings to take precedence
  clearPersistedSettings: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
      console.log('[SettingsStore] ✅ Persisted settings cleared - iOS Settings will now take precedence');
      
      // Reload settings to use iOS Settings
      await get().loadSettings();
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to clear persisted settings:', error);
    }
  },

  // Server management actions
  switchServer: async (serverId: string): Promise<boolean> => {
    const state = get();
    const targetServer = getServerById(serverId);
    
    // Track user action
    await loggingService.trackUserAction(
      'server_switch_initiated',
      'settings_screen',
      {
        fromServerId: state.currentServer.id,
        toServerId: serverId,
        targetServerName: targetServer?.displayName
      }
    );

    if (!targetServer) {
      const errorMessage = `${SETTINGS_ERROR_MESSAGES.INVALID_SERVER}: ${serverId}`;
      
      await loggingService.logError(
        LogCategory.SERVER_SWITCH,
        'server_switch_validation',
        'Invalid server ID provided for switch',
        {
          type: ErrorType.CONFIGURATION_ERROR,
          severity: 'HIGH' as any,
          message: errorMessage,
          suggestedActions: ['Check server configuration', 'Verify server ID'],
          isRetryable: false,
          timestamp: new Date()
        },
        { serverId, availableServers: AVAILABLE_SERVERS.map(s => s.id) }
      );

      set({ lastError: errorMessage });
      return false;
    }

    if (state.currentServer.id === serverId) {
      // Already on target server - update connection status and return success
      await loggingService.logInfo(
        LogCategory.SERVER_SWITCH,
        'server_switch_already_active',
        `Already connected to server: ${targetServer.displayName}`,
        { serverId, serverName: targetServer.displayName },
        undefined,
        serverId,
        targetServer.displayName
      );

      await get().refreshConnectionStatus();
      return true;
    }

    // Check if we're offline
    const isOnline = networkService.isConnected();
    
    if (!isOnline) {
      await loggingService.logInfo(
        LogCategory.SERVER_SWITCH,
        'server_switch_offline_queue',
        `Offline - queuing server switch: ${state.currentServer.id} → ${serverId}`,
        {
          fromServerId: state.currentServer.id,
          toServerId: serverId,
          isOnline: false
        },
        undefined,
        serverId,
        targetServer.displayName
      );

      console.log(`[SettingsStore] Offline - queuing server switch: ${state.currentServer.id} → ${serverId}`);
      
      try {
        // Queue the server switch for when connectivity returns
        const operationId = await offlineQueueService.queueServerSwitch(
          state.currentServer.id,
          serverId,
          {
            preserveUserData: state.preferences.preserveDataOnFailure,
            enableFallback: state.preferences.enableGracefulFallback,
            userInitiated: true,
            priority: 5 // High priority for user-initiated switches
          }
        );

        // Preserve current server configuration for offline use
        await offlineQueueService.preserveServerConfiguration(state.currentServer);

        // Update UI to show queued state
        set({
          serverSwitchState: {
            isInProgress: false,
            fromServerId: state.currentServer.id,
            toServerId: serverId,
            progress: 'Server switch queued for when connectivity returns',
            startedAt: new Date(),
          },
          lastError: null,
        });

        await loggingService.logInfo(
          LogCategory.SERVER_SWITCH,
          'server_switch_queued',
          `Server switch queued successfully (${operationId})`,
          {
            operationId,
            fromServerId: state.currentServer.id,
            toServerId: serverId,
            queuePriority: 5
          },
          undefined,
          serverId,
          targetServer.displayName
        );

        console.log(`[SettingsStore] ✅ Server switch queued (${operationId}) - will execute when online`);
        return true; // Return true to indicate the request was accepted
      } catch (error: any) {
        await loggingService.logError(
          LogCategory.SERVER_SWITCH,
          'server_switch_queue_failed',
          'Failed to queue server switch for offline execution',
          {
            type: ErrorType.CACHE_ERROR,
            severity: 'MEDIUM' as any,
            message: error.message,
            suggestedActions: ['Try again when online', 'Check device storage'],
            isRetryable: true,
            timestamp: new Date()
          },
          {
            fromServerId: state.currentServer.id,
            toServerId: serverId,
            originalError: error.message
          },
          serverId,
          targetServer.displayName
        );

        console.error('[SettingsStore] ❌ Failed to queue server switch:', error);
        set({ 
          lastError: `Failed to queue server switch: ${error.message}`,
          serverSwitchState: DEFAULT_SWITCH_STATE,
        });
        return false;
      }
    }

    // Start server switch process (online)
    const switchState: ServerSwitchState = {
      isInProgress: true,
      fromServerId: state.currentServer.id,
      toServerId: serverId,
      progress: SWITCH_PROGRESS_MESSAGES.STARTING,
      startedAt: new Date(),
    };

    set({ 
      serverSwitchState: switchState,
      connectionStatus: 'switching',
      lastError: null 
    });

    // Schedule optimized UI updates for server switching
    uiOptimizationService.scheduleServerSwitchProgress(
      SWITCH_PROGRESS_MESSAGES.STARTING,
      0,
      { animate: true, duration: 300 }
    );

    // Optimize animations for server switching
    uiOptimizationService.optimizeServerSwitchAnimations(true, {
      fadeInDuration: 300,
      fadeOutDuration: 200,
      progressAnimationDuration: 500
    });

    await loggingService.logInfo(
      LogCategory.SERVER_SWITCH,
      'server_switch_start',
      `Starting online server switch: ${state.currentServer.id} → ${serverId}`,
      {
        fromServerId: state.currentServer.id,
        fromServerName: state.currentServer.displayName,
        toServerId: serverId,
        toServerName: targetServer.displayName,
        userPreferences: state.preferences
      },
      undefined,
      serverId,
      targetServer.displayName
    );

    try {
      // Configure error handling based on user preferences
      backendConfigService.configureErrorHandling({
        retryAttempts: state.preferences.autoSwitchOnFailure ? 3 : 1,
        timeoutMs: state.preferences.connectionTestTimeout * 3, // 3x connection test timeout for full switch
        enableFallback: state.preferences.autoSwitchOnFailure,
        enableDetailedLogging: state.preferences.enableDetailedLogging
      });

      // Schedule progress updates
      uiOptimizationService.scheduleServerSwitchProgress(
        'Testing connectivity...',
        25,
        { animate: true }
      );

      // Use comprehensive server switch with error handling
      const result = await backendConfigService.performComprehensiveServerSwitch(
        switchState.fromServerId!,
        serverId,
        {
          enableFallback: state.preferences.autoSwitchOnFailure,
          preserveUserData: true,
          timeoutMs: state.preferences.connectionTestTimeout * 3,
          maxRetries: state.preferences.autoSwitchOnFailure ? 3 : 1
        }
      );

      if (result.success && result.data) {
        const { switchSuccessful, fallbackUsed, authenticationRequired, cacheBackupKey } = result.data;

        if (switchSuccessful) {
          // Successful switch to new server
          set({ 
            currentServer: targetServer,
            serverSource: 'user_explicit' // Mark as user's explicit choice
          });
          
          // Schedule success notification with animation
          uiOptimizationService.scheduleSuccessNotification(
            `Successfully switched to ${targetServer.displayName}`,
            { serverId: targetServer.id, duration: result.totalDuration },
            { animate: true, duration: 3000 }
          );

          // Schedule final progress update
          uiOptimizationService.scheduleServerSwitchProgress(
            SWITCH_PROGRESS_MESSAGES.COMPLETED,
            100,
            { animate: true, duration: 200 }
          );
          
          // Preserve new server configuration for offline use
          await offlineQueueService.preserveServerConfiguration(targetServer);
          
          // Record successful switch
          const historyEntry: ServerHistoryEntry = {
            serverId: targetServer.id,
            lastUsed: new Date(),
            successful: true,
            duration: result.totalDuration,
          };

          const updatedHistory = [
            historyEntry,
            ...state.serverHistory.filter(entry => entry.serverId !== serverId).slice(0, 9)
          ];

          set({
            connectionStatus: 'connected',
            serverSwitchState: {
              ...switchState,
              isInProgress: false,
              progress: SWITCH_PROGRESS_MESSAGES.COMPLETED,
            },
            serverHistory: updatedHistory,
            lastError: authenticationRequired ? 'Authentication required on new server' : null,
          });

          await loggingService.logInfo(
            LogCategory.SERVER_SWITCH,
            'server_switch_success',
            `Server switch completed successfully: ${switchState.fromServerId} → ${serverId}`,
            {
              fromServerId: switchState.fromServerId,
              toServerId: serverId,
              duration: result.totalDuration,
              attempts: result.attempts,
              authRequired: authenticationRequired,
              cacheBackupKey,
              fallbackUsed: false
            },
            result.totalDuration,
            serverId,
            targetServer.displayName
          );

          console.log('✅ Server switch completed successfully:', {
            from: switchState.fromServerId,
            to: serverId,
            duration: result.totalDuration,
            attempts: result.attempts,
            authRequired: authenticationRequired
          });

        } else if (fallbackUsed) {
          // Switch failed but fallback succeeded
          const historyEntry: ServerHistoryEntry = {
            serverId: serverId,
            lastUsed: new Date(),
            successful: false,
            duration: result.totalDuration,
          };

          const updatedHistory = [
            historyEntry,
            ...state.serverHistory.slice(0, 9)
          ];

          // Schedule error notification for failed switch
          uiOptimizationService.scheduleErrorDisplay(
            'Server switch failed but successfully reverted to previous server',
            { 
              targetServerId: serverId, 
              fallbackServerId: switchState.fromServerId,
              duration: result.totalDuration 
            },
            { persistent: false }
          );

          set({
            connectionStatus: 'connected', // Back on original server
            serverSwitchState: {
              ...switchState,
              isInProgress: false,
              progress: 'Switch failed, reverted to previous server',
            },
            serverHistory: updatedHistory,
            lastError: 'Server switch failed but successfully reverted to previous server',
          });

          await loggingService.logWarning(
            LogCategory.SERVER_SWITCH,
            'server_switch_fallback',
            `Server switch failed but fallback succeeded: ${switchState.fromServerId} → ${serverId}`,
            {
              fromServerId: switchState.fromServerId,
              toServerId: serverId,
              duration: result.totalDuration,
              attempts: result.attempts,
              fallbackUsed: true
            },
            switchState.fromServerId,
            state.currentServer.displayName
          );

          console.log('⚠️ Server switch failed but fallback succeeded');
        }

        // Save settings
        await get().saveSettings();
        return switchSuccessful;

      } else {
        // Complete failure
        throw new Error(result.error?.message || 'Server switch failed');
      }

    } catch (error: any) {
      // Record failed attempt
      const failedHistoryEntry: ServerHistoryEntry = {
        serverId: serverId,
        lastUsed: new Date(),
        successful: false,
        duration: Date.now() - switchState.startedAt!.getTime(),
      };

      const updatedHistory = [
        failedHistoryEntry,
        ...state.serverHistory.slice(0, 9)
      ];

      // Determine appropriate error message
      let errorMessage = `${SETTINGS_ERROR_MESSAGES.SWITCH_FAILED}: ${error.message}`;
      
      // Check if this is an enhanced error with suggested actions
      if (error.suggestedActions && Array.isArray(error.suggestedActions)) {
        errorMessage += `. Suggestions: ${error.suggestedActions.join(', ')}`;
      }

      // Schedule error display with immediate processing
      uiOptimizationService.scheduleErrorDisplay(
        errorMessage,
        { 
          targetServerId: serverId,
          originalError: error.message,
          duration: Date.now() - switchState.startedAt!.getTime()
        },
        { persistent: true }
      );

      set({
        connectionStatus: 'error',
        serverSwitchState: {
          ...switchState,
          isInProgress: false,
          progress: SWITCH_PROGRESS_MESSAGES.FAILED,
          error: error.message,
        },
        serverHistory: updatedHistory,
        lastError: errorMessage,
      });

      await loggingService.logError(
        LogCategory.SERVER_SWITCH,
        'server_switch_failed',
        `Server switch failed: ${switchState.fromServerId} → ${serverId}`,
        {
          type: ErrorType.SERVER_ERROR,
          severity: 'HIGH' as any,
          message: error.message,
          suggestedActions: error.suggestedActions || ['Check network connection', 'Try again later', 'Contact support'],
          isRetryable: true,
          timestamp: new Date()
        },
        {
          fromServerId: switchState.fromServerId,
          toServerId: serverId,
          duration: Date.now() - switchState.startedAt!.getTime(),
          originalError: error.message
        },
        serverId,
        targetServer.displayName
      );

      console.error('❌ Server switch failed:', error);

      // Save settings even after failed switch to record the failure in history
      await get().saveSettings();

      return false;
    }
  },

  testServerConnectivity: async (serverId: string): Promise<DetailedConnectionStatus> => {
    const server = getServerById(serverId);
    
    if (!server) {
      return {
        serverId,
        status: 'error',
        lastChecked: new Date(),
        errorMessage: `Server not found: ${serverId}`,
        healthChecks: [],
      };
    }

    const startTime = Date.now();
    const healthChecks: HealthCheckResult[] = [];

    try {
      // Test each health check endpoint
      for (const endpoint of server.healthCheckEndpoints) {
        const endpointStartTime = Date.now();
        
        try {
          const response = await axios.get(`${server.baseUrl}${endpoint}`, {
            timeout: server.connectionTimeout,
            // Note: httpsAgent not supported in React Native
            // Self-signed certificates are handled by the platform
          });

          healthChecks.push({
            endpoint,
            status: 'success',
            responseTime: Date.now() - endpointStartTime,
          });
        } catch (endpointError: any) {
          healthChecks.push({
            endpoint,
            status: 'failure',
            responseTime: Date.now() - endpointStartTime,
            error: endpointError.message,
          });
        }
      }

      // Determine overall status
      const successfulChecks = healthChecks.filter(check => check.status === 'success');
      const overallStatus: ConnectionStatus = successfulChecks.length > 0 ? 'connected' : 'error';
      const totalResponseTime = Date.now() - startTime;

      const result: DetailedConnectionStatus = {
        serverId,
        status: overallStatus,
        lastChecked: new Date(),
        responseTime: totalResponseTime,
        healthChecks,
      };

      if (overallStatus === 'error') {
        result.errorMessage = `${healthChecks.length - successfulChecks.length} of ${healthChecks.length} health checks failed`;
      }

      return result;

    } catch (error: any) {
      return {
        serverId,
        status: 'error',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message,
        healthChecks,
      };
    }
  },

  refreshConnectionStatus: async (): Promise<void> => {
    const { currentServer, serverSource } = get();
    
    set({ connectionStatus: 'testing' });
    
    try {
      const status = await get().testServerConnectivity(currentServer.id);
      
      // Enhanced auto-fallback logic - only for non-user-explicit choices
      if (status.status === 'error' && serverSource !== 'user_explicit') {
        console.log(`[SettingsStore] ${currentServer.id} failed, attempting smart fallback...`);
        
        try {
          // Use smart server selection to find alternative
          const smartSelection = await get().performSmartDefaultSelection();
          
          if (smartSelection.id !== currentServer.id) {
            console.log(`[SettingsStore] ✅ Smart fallback to ${smartSelection.displayName}`);
            
            set({
              currentServer: smartSelection,
              connectionStatus: 'connected',
              detailedStatus: await get().testServerConnectivity(smartSelection.id),
              lastError: `Automatically switched to ${smartSelection.displayName} (${currentServer.displayName} unavailable)`,
              serverSource: 'smart_default'
            });
            
            // Save the automatic switch
            await get().saveSettings();
            return;
          }
        } catch (fallbackError) {
          console.warn('[SettingsStore] Smart fallback failed:', fallbackError);
        }
      }
      
      set({ 
        connectionStatus: status.status,
        detailedStatus: status,
        lastError: status.errorMessage || null,
      });
    } catch (error: any) {
      set({ 
        connectionStatus: 'error',
        lastError: error.message,
      });
    }
  },

  // iOS Settings integration actions
  loadServerFromNativeSettings: async (): Promise<void> => {
    try {
      console.log('[SettingsStore] Loading server configuration from iOS Settings...');
      
      const nativeResult = await nativeSettingsService.readNativeSettings();
      const hasValidIOSSettings = nativeResult.success && nativeResult.serverConfig && 
        (nativeResult.source === 'ios_settings' || nativeResult.source === 'cache');
      
      const effectiveServer = hasValidIOSSettings ? nativeResult.serverConfig : getDefaultServer();
      
      set({
        currentServer: effectiveServer,
        serverSource: hasValidIOSSettings ? 'ios_settings' : 'fallback',
        lastError: null,
      });

      console.log(`[SettingsStore] ✅ Server loaded from ${hasValidIOSSettings ? 'iOS Settings' : 'fallback'}: ${effectiveServer.displayName}`);
      
      // Test connectivity to the new server
      setTimeout(() => {
        get().refreshConnectionStatus();
      }, 1000);
      
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to load server from native settings:', error);
      set({ 
        lastError: `Failed to load server from iOS Settings: ${error.message}`,
        serverSource: 'fallback',
      });
    }
  },

  refreshServerConfig: async (): Promise<void> => {
    try {
      console.log('[SettingsStore] Refreshing server configuration...');
      
      // Clear native settings cache to force fresh read
      nativeSettingsService.clearCache();
      
      // Reload server configuration
      await get().loadServerFromNativeSettings();
      
      console.log('[SettingsStore] ✅ Server configuration refreshed');
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to refresh server configuration:', error);
      set({ lastError: `Failed to refresh server configuration: ${error.message}` });
    }
  },

  openIOSSettings: (): void => {
    try {
      console.log('[SettingsStore] Opening iOS Settings...');
      
      // Use static import instead of dynamic import
      const { Linking } = require('react-native');
      Linking.openSettings().catch((error: any) => {
        console.error('[SettingsStore] ❌ Failed to open iOS Settings:', error);
        set({ lastError: 'Failed to open iOS Settings. Please open Settings > VerbumCare manually.' });
      });
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to open iOS Settings:', error);
      set({ lastError: 'Failed to open iOS Settings. Please open Settings > VerbumCare manually.' });
    }
  },

  // Language management actions
  setLanguage: async (language: Language): Promise<void> => {
    const state = get();
    
    // Track user action
    await loggingService.trackUserAction(
      'language_change_initiated',
      'settings_screen',
      {
        fromLanguage: state.currentLanguage,
        toLanguage: language
      }
    );
    
    if (state.currentLanguage === language) {
      await loggingService.logDebug(
        LogCategory.USER_ACTION,
        'language_change_skipped',
        `Language already set to: ${language}`,
        { currentLanguage: language }
      );
      return; // Already set
    }

    if (!AVAILABLE_LANGUAGES.includes(language)) {
      const errorMessage = `Invalid language: ${language}`;
      
      await loggingService.logError(
        LogCategory.CONFIGURATION,
        'language_change_invalid',
        'Invalid language provided for change',
        {
          type: ErrorType.VALIDATION_ERROR,
          severity: 'MEDIUM' as any,
          message: errorMessage,
          suggestedActions: ['Use a supported language', 'Check available languages'],
          isRetryable: false,
          timestamp: new Date()
        },
        { 
          requestedLanguage: language, 
          availableLanguages: AVAILABLE_LANGUAGES 
        }
      );

      set({ lastError: errorMessage });
      return;
    }

    try {
      // Check if we're offline
      const isOnline = networkService.isConnected();
      
      if (!isOnline) {
        await loggingService.logInfo(
          LogCategory.CONFIGURATION,
          'language_change_offline',
          `Offline - queuing language change: ${state.currentLanguage} → ${language}`,
          {
            fromLanguage: state.currentLanguage,
            toLanguage: language,
            isOnline: false
          }
        );

        console.log(`[SettingsStore] Offline - queuing language change: ${language}`);
        
        // Queue the language change for when connectivity returns
        await offlineQueueService.queueLanguageChange(language, 3);
        
        // Apply language change immediately for offline use
        set({ currentLanguage: language });
        languageSyncService.notifyLanguageChange(language);
        
        // Save to persistence
        await get().saveSettings();
        
        await loggingService.logInfo(
          LogCategory.CONFIGURATION,
          'language_change_offline_complete',
          `Language changed offline and queued: ${language}`,
          { language, queued: true }
        );

        console.log(`[SettingsStore] ✅ Language changed offline and queued: ${language}`);
        return;
      }

      // Update language immediately (online)
      set({ currentLanguage: language });

      // Notify other stores of language change
      languageSyncService.notifyLanguageChange(language);

      // Save to persistence
      await get().saveSettings();

      await loggingService.logInfo(
        LogCategory.CONFIGURATION,
        'language_change_success',
        `Language changed successfully: ${state.currentLanguage} → ${language}`,
        {
          fromLanguage: state.currentLanguage,
          toLanguage: language,
          isOnline: true
        }
      );

      console.log('✅ Language changed to:', language);
    } catch (error: any) {
      await loggingService.logError(
        LogCategory.CONFIGURATION,
        'language_change_failed',
        'Failed to change language',
        {
          type: ErrorType.CONFIGURATION_ERROR,
          severity: 'MEDIUM' as any,
          message: error.message,
          suggestedActions: ['Try again', 'Check device storage', 'Restart application'],
          isRetryable: true,
          timestamp: new Date()
        },
        {
          fromLanguage: state.currentLanguage,
          toLanguage: language,
          originalError: error.message
        }
      );

      console.error('❌ Language change failed:', error);
      set({ lastError: `Failed to change language: ${error.message}` });
    }
  },

  // Settings persistence actions
  loadSettings: async (): Promise<void> => {
    try {
      console.log('⚙️ [SETTINGS] Starting settings initialization...');
      
      // Use the dedicated initialization service
      const initResult: SettingsInitializationResult = await settingsInitializationService.initialize();
      
      console.log('📋 [SETTINGS] Initialization result:', {
        success: initResult.success,
        isFirstRun: initResult.isFirstRun,
        migrationPerformed: initResult.migrationPerformed,
        warningsCount: initResult.warnings.length,
        errorsCount: initResult.errors.length
      });
      
      if (initResult.success) {
        console.log('🎯 [SETTINGS] Performing priority-based server selection...');
        
        // Use priority-based server selection
        const serverSelection = await get().selectServerWithPriority();
        
        console.log('✅ [SETTINGS] Server selection completed:', {
          selectedServer: serverSelection.server.displayName,
          serverId: serverSelection.server.id,
          baseUrl: serverSelection.server.baseUrl,
          source: serverSelection.source,
          reason: serverSelection.reason
        });
        
        set({
          currentServer: serverSelection.server,
          serverSource: serverSelection.source,
          currentLanguage: initResult.settings.currentLanguage,
          serverHistory: initResult.settings.serverHistory || [],
          preferences: { ...DEFAULT_USER_PREFERENCES, ...initResult.settings.preferences },
          lastError: null,
        });

        // Sync language with other stores
        languageSyncService.notifyLanguageChange(initResult.settings.currentLanguage);

        // Log initialization result
        if (initResult.isFirstRun) {
          console.log('🆕 [SETTINGS] First run - using smart server selection');
        } else {
          console.log('📂 [SETTINGS] Settings loaded from storage');
        }

        if (initResult.migrationPerformed) {
          console.log('🔄 [SETTINGS] Settings migration completed');
        }

        // Show warnings if any
        if (initResult.warnings.length > 0) {
          console.warn('⚠️ [SETTINGS] Settings loaded with warnings:', initResult.warnings);
          set({ lastError: `Settings loaded with warnings: ${initResult.warnings.join(', ')}` });
        }

        // Test connection to selected server after initialization
        console.log('🔍 [SETTINGS] Scheduling connection test in 1 second...');
        setTimeout(() => {
          console.log('🌐 [SETTINGS] Starting connection test to selected server...');
          get().refreshConnectionStatus();
        }, 1000);

      } else {
        // Initialization failed - use smart server selection as fallback
        console.error('❌ [SETTINGS] Settings initialization failed, using smart server selection fallback');
        console.error('📋 [SETTINGS] Initialization errors:', initResult.errors);
        
        const serverSelection = await get().selectServerWithPriority();
        
        console.log('🔄 [SETTINGS] Fallback server selection:', {
          selectedServer: serverSelection.server.displayName,
          serverId: serverSelection.server.id,
          source: serverSelection.source,
          reason: serverSelection.reason
        });
        
        set({
          currentServer: serverSelection.server,
          serverSource: serverSelection.source,
          currentLanguage: DEFAULT_LANGUAGE,
          serverHistory: [],
          preferences: DEFAULT_USER_PREFERENCES,
          lastError: `Settings initialization failed: ${initResult.errors.join(', ')}`,
        });

        // Still sync language
        languageSyncService.notifyLanguageChange(DEFAULT_LANGUAGE);
      }

    } catch (error: any) {
      console.error('💥 [SETTINGS] Critical settings initialization error:', {
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code
      });
      
      // Last resort fallback
      const fallbackServer = getDefaultServer();
      console.log('🆘 [SETTINGS] Using emergency fallback server:', {
        serverId: fallbackServer.id,
        displayName: fallbackServer.displayName,
        baseUrl: fallbackServer.baseUrl
      });
      
      set({
        currentServer: fallbackServer,
        serverSource: 'fallback',
        currentLanguage: DEFAULT_LANGUAGE,
        serverHistory: [],
        preferences: DEFAULT_USER_PREFERENCES,
        lastError: `Critical settings error: ${error.message}`,
      });

      languageSyncService.notifyLanguageChange(DEFAULT_LANGUAGE);
    }
  },

  saveSettings: async (): Promise<void> => {
    try {
      const state = get();
      
      const settingsToSave: PersistedSettings = {
        currentServerId: state.currentServer.id,
        currentLanguage: state.currentLanguage,
        serverHistory: state.serverHistory,
        preferences: state.preferences,
        version: DEFAULT_PERSISTED_SETTINGS.version,
      };

      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
      
      console.log('✅ Settings saved successfully');
    } catch (error: any) {
      console.error('❌ Failed to save settings:', error);
      set({ lastError: `${SETTINGS_ERROR_MESSAGES.SAVE_FAILED}: ${error.message}` });
    }
  },

  resetToDefaults: async (): Promise<void> => {
    try {
      // Clear stored settings
      await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
      
      // Reset to default state
      set({
        currentServer: getDefaultServer(),
        serverSource: 'fallback',
        currentLanguage: DEFAULT_LANGUAGE,
        serverHistory: [],
        preferences: DEFAULT_USER_PREFERENCES,
        connectionStatus: 'disconnected',
        detailedStatus: undefined,
        serverSwitchState: DEFAULT_SWITCH_STATE,
        lastError: null,
      });

      console.log('✅ Settings reset to defaults');
    } catch (error: any) {
      console.error('❌ Failed to reset settings:', error);
      set({ lastError: `Failed to reset settings: ${error.message}` });
    }
  },

  initializeWithDefaults: async (): Promise<void> => {
    try {
      console.log('[SettingsStore] Initializing with default settings...');
      
      // Get default server configuration
      const defaultServer = getDefaultServer();
      
      // Set default state
      set({
        currentServer: defaultServer,
        serverSource: 'fallback',
        currentLanguage: DEFAULT_LANGUAGE,
        serverHistory: [],
        preferences: DEFAULT_USER_PREFERENCES,
        connectionStatus: 'disconnected',
        detailedStatus: undefined,
        serverSwitchState: DEFAULT_SWITCH_STATE,
        lastError: null,
      });

      // Sync language with other stores
      languageSyncService.notifyLanguageChange(DEFAULT_LANGUAGE);

      // Save default settings to storage
      await get().saveSettings();

      // Test connection to default server
      setTimeout(() => {
        get().refreshConnectionStatus();
      }, 500);

      console.log('[SettingsStore] ✅ Default settings initialized and saved');
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to initialize default settings:', error);
      set({ lastError: `Failed to initialize default settings: ${error.message}` });
    }
  },

  // Preferences management
  updatePreferences: async (preferences: Partial<UserPreferences>): Promise<void> => {
    try {
      const state = get();
      const updatedPreferences = { ...state.preferences, ...preferences };
      
      // Check if we're offline
      const isOnline = networkService.isConnected();
      
      if (!isOnline) {
        console.log('[SettingsStore] Offline - queuing preferences update');
        
        // Queue the preferences update for when connectivity returns
        await offlineQueueService.queueSettingsUpdate(preferences, 2);
        
        // Apply preferences immediately for offline use
        set({ preferences: updatedPreferences });
        await get().saveSettings();
        
        console.log('[SettingsStore] ✅ Preferences updated offline and queued');
        return;
      }
      
      // Apply preferences immediately (online)
      set({ preferences: updatedPreferences });
      await get().saveSettings();
      
      console.log('✅ Preferences updated:', preferences);
    } catch (error: any) {
      console.error('❌ Failed to update preferences:', error);
      set({ lastError: `Failed to update preferences: ${error.message}` });
    }
  },

  // Error handling
  clearError: (): void => {
    set({ lastError: null });
  },

  setError: (error: string): void => {
    set({ lastError: error });
  },

  // Offline mode support
  getOfflineStatus: () => {
    const isOnline = networkService.isConnected();
    const queueStatus = offlineQueueService.getQueueStatus();
    const lastKnownConfig = offlineQueueService.getLastKnownServerConfig();
    
    return {
      isOnline,
      queueStatus,
      lastKnownConfig,
      offlineFunctionalityAvailable: offlineQueueService.isOfflineFunctionalityAvailable(),
      offlineEditingAvailable: offlineQueueService.isOfflineEditingAvailable(),
    };
  },

  // Queue management
  clearOfflineQueue: async (): Promise<void> => {
    try {
      await offlineQueueService.clearQueue();
      console.log('[SettingsStore] ✅ Offline queue cleared');
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to clear offline queue:', error);
      set({ lastError: `Failed to clear offline queue: ${error.message}` });
    }
  },

  processOfflineQueue: async (): Promise<void> => {
    try {
      const result = await offlineQueueService.processQueue();
      
      if (result.success) {
        console.log(`[SettingsStore] ✅ Offline queue processed: ${result.processedCount} operations`);
      } else {
        console.warn(`[SettingsStore] ⚠️ Queue processing completed with errors: ${result.failedCount} failed`);
        set({ lastError: `Queue processing completed with ${result.failedCount} errors` });
      }
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to process offline queue:', error);
      set({ lastError: `Failed to process offline queue: ${error.message}` });
    }
  },

  // Smart server selector management
  clearServerSelectionCache: async (): Promise<void> => {
    try {
      await smartServerSelector.clearCache();
      console.log('[SettingsStore] ✅ Server selection cache cleared');
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to clear server selection cache:', error);
      set({ lastError: `Failed to clear server selection cache: ${error.message}` });
    }
  },

  getServerSelectionCacheStatus: async (): Promise<any> => {
    try {
      return await smartServerSelector.getCacheStatus();
    } catch (error: any) {
      console.error('[SettingsStore] ❌ Failed to get cache status:', error);
      return { hasCachedSelection: false };
    }
  },
}));

// Helper functions for external use
export const getCurrentServer = (): ServerConfig => {
  return useSettingsStore.getState().currentServer;
};

export const getCurrentLanguage = (): Language => {
  return useSettingsStore.getState().currentLanguage;
};

export const isServerSwitching = (): boolean => {
  return useSettingsStore.getState().serverSwitchState.isInProgress;
};

export const getConnectionStatus = (): ConnectionStatus => {
  return useSettingsStore.getState().connectionStatus;
};