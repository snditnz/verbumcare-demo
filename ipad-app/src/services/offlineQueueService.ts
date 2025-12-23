/**
 * Offline Queue Service
 * 
 * Manages queued operations when offline, including server switch requests.
 * Handles operation persistence, retry logic, and execution when connectivity returns.
 * 
 * Implements Requirements 2.3, 4.4 (offline mode handling for server switches)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { networkService } from './networkService';
import { ServerConfig } from '../config/servers';

/**
 * Types of operations that can be queued
 */
export type QueuedOperationType = 
  | 'server_switch'
  | 'language_change'
  | 'settings_update'
  | 'connectivity_test';

/**
 * Base interface for queued operations
 */
export interface QueuedOperation {
  id: string;
  type: QueuedOperationType;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  priority: number; // Higher number = higher priority
  data: any;
}

/**
 * Server switch operation data
 */
export interface ServerSwitchOperation extends QueuedOperation {
  type: 'server_switch';
  data: {
    fromServerId: string;
    toServerId: string;
    preserveUserData: boolean;
    enableFallback: boolean;
    userInitiated: boolean;
  };
}

/**
 * Language change operation data
 */
export interface LanguageChangeOperation extends QueuedOperation {
  type: 'language_change';
  data: {
    language: string;
  };
}

/**
 * Settings update operation data
 */
export interface SettingsUpdateOperation extends QueuedOperation {
  type: 'settings_update';
  data: {
    preferences: Record<string, any>;
  };
}

/**
 * Connectivity test operation data
 */
export interface ConnectivityTestOperation extends QueuedOperation {
  type: 'connectivity_test';
  data: {
    serverId: string;
  };
}

/**
 * Queue execution result
 */
export interface QueueExecutionResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Array<{ operationId: string; error: string }>;
}

/**
 * Offline server configuration
 */
export interface OfflineServerConfig {
  serverId: string;
  serverConfig: ServerConfig;
  lastKnownGood: Date;
  offlineCapabilities: {
    canViewData: boolean;
    canEditData: boolean;
    canSync: boolean;
  };
}

const QUEUE_STORAGE_KEY = 'verbumcare_offline_queue';
const OFFLINE_CONFIG_STORAGE_KEY = 'verbumcare_offline_server_config';
const MAX_QUEUE_SIZE = 100;
const DEFAULT_MAX_RETRIES = 3;

class OfflineQueueService {
  private queue: QueuedOperation[] = [];
  private isProcessing: boolean = false;
  private offlineServerConfig: OfflineServerConfig | null = null;
  private listeners: Array<(result: QueueExecutionResult) => void> = [];

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the offline queue service
   */
  private async initialize(): Promise<void> {
    try {
      // Load persisted queue
      await this.loadQueue();
      
      // Load offline server configuration
      await this.loadOfflineServerConfig();
      
      // Listen for network connectivity changes
      networkService.onReconnection(() => {
        this.processQueueOnReconnection();
      });

      console.log('[OfflineQueue] Service initialized');
    } catch (error) {
      console.error('[OfflineQueue] Initialization failed:', error);
    }
  }

  /**
   * Load queue from persistent storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (queueData) {
        const parsedQueue = JSON.parse(queueData);
        // Convert timestamp strings back to Date objects
        this.queue = parsedQueue.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }));
        
        console.log(`[OfflineQueue] Loaded ${this.queue.length} queued operations`);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue:', error);
    }
  }

  /**
   * Load offline server configuration
   */
  private async loadOfflineServerConfig(): Promise<void> {
    try {
      const configData = await AsyncStorage.getItem(OFFLINE_CONFIG_STORAGE_KEY);
      if (configData) {
        const parsedConfig = JSON.parse(configData);
        this.offlineServerConfig = {
          ...parsedConfig,
          lastKnownGood: new Date(parsedConfig.lastKnownGood)
        };
        
        console.log(`[OfflineQueue] Loaded offline config for server: ${this.offlineServerConfig.serverId}`);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load offline config:', error);
    }
  }

  /**
   * Save offline server configuration
   */
  private async saveOfflineServerConfig(): Promise<void> {
    try {
      if (this.offlineServerConfig) {
        await AsyncStorage.setItem(OFFLINE_CONFIG_STORAGE_KEY, JSON.stringify(this.offlineServerConfig));
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to save offline config:', error);
    }
  }

  /**
   * Preserve last known server configuration when going offline
   * Implements Requirements 2.3 (preserve last known server configuration when offline)
   */
  async preserveServerConfiguration(server: ServerConfig): Promise<void> {
    try {
      this.offlineServerConfig = {
        serverId: server.id,
        serverConfig: server,
        lastKnownGood: new Date(),
        offlineCapabilities: {
          canViewData: true, // Can view cached data
          canEditData: true, // Can edit with local storage
          canSync: false,    // Cannot sync while offline
        }
      };

      await this.saveOfflineServerConfig();
      
      console.log(`[OfflineQueue] Preserved server configuration: ${server.displayName}`);
    } catch (error) {
      console.error('[OfflineQueue] Failed to preserve server config:', error);
    }
  }

  /**
   * Get last known server configuration
   */
  getLastKnownServerConfig(): OfflineServerConfig | null {
    return this.offlineServerConfig;
  }

  /**
   * Queue a server switch operation for when connectivity returns
   * Implements Requirements 2.3, 4.4 (queue server switch requests for when connectivity returns)
   */
  async queueServerSwitch(
    fromServerId: string,
    toServerId: string,
    options: {
      preserveUserData?: boolean;
      enableFallback?: boolean;
      userInitiated?: boolean;
      priority?: number;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const operation: ServerSwitchOperation = {
      id: this.generateOperationId(),
      type: 'server_switch',
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      priority: options.priority || 5, // High priority for server switches
      data: {
        fromServerId,
        toServerId,
        preserveUserData: options.preserveUserData ?? true,
        enableFallback: options.enableFallback ?? true,
        userInitiated: options.userInitiated ?? true,
      }
    };

    return this.addToQueue(operation);
  }

  /**
   * Queue a language change operation
   */
  async queueLanguageChange(language: string, priority: number = 3): Promise<string> {
    const operation: LanguageChangeOperation = {
      id: this.generateOperationId(),
      type: 'language_change',
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      priority,
      data: { language }
    };

    return this.addToQueue(operation);
  }

  /**
   * Queue a settings update operation
   */
  async queueSettingsUpdate(preferences: Record<string, any>, priority: number = 2): Promise<string> {
    const operation: SettingsUpdateOperation = {
      id: this.generateOperationId(),
      type: 'settings_update',
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      priority,
      data: { preferences }
    };

    return this.addToQueue(operation);
  }

  /**
   * Queue a connectivity test operation
   */
  async queueConnectivityTest(serverId: string, priority: number = 1): Promise<string> {
    const operation: ConnectivityTestOperation = {
      id: this.generateOperationId(),
      type: 'connectivity_test',
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 1, // Only retry once for connectivity tests
      priority,
      data: { serverId }
    };

    return this.addToQueue(operation);
  }

  /**
   * Add operation to queue
   */
  private async addToQueue(operation: QueuedOperation): Promise<string> {
    try {
      // Check for duplicate operations
      const existingIndex = this.queue.findIndex(op => 
        op.type === operation.type && 
        JSON.stringify(op.data) === JSON.stringify(operation.data)
      );

      if (existingIndex !== -1) {
        // Update existing operation with newer timestamp and reset retry count
        this.queue[existingIndex] = {
          ...operation,
          id: this.queue[existingIndex].id, // Keep original ID
          retryCount: 0 // Reset retry count
        };
        console.log(`[OfflineQueue] Updated existing ${operation.type} operation: ${operation.id}`);
      } else {
        // Add new operation
        this.queue.push(operation);
        console.log(`[OfflineQueue] Queued ${operation.type} operation: ${operation.id}`);
      }

      // Maintain queue size limit
      if (this.queue.length > MAX_QUEUE_SIZE) {
        // Remove oldest, lowest priority operations
        this.queue.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority; // Higher priority first
          }
          return a.timestamp.getTime() - b.timestamp.getTime(); // Older first for same priority
        });
        
        const removed = this.queue.splice(MAX_QUEUE_SIZE);
        console.log(`[OfflineQueue] Removed ${removed.length} old operations to maintain queue size`);
      }

      await this.saveQueue();
      return operation.id;
    } catch (error) {
      console.error('[OfflineQueue] Failed to add operation to queue:', error);
      throw error;
    }
  }

  /**
   * Process queue when connectivity is restored
   * Implements Requirements 4.4 (handle connectivity restoration gracefully)
   */
  private async processQueueOnReconnection(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    console.log(`[OfflineQueue] Processing ${this.queue.length} queued operations after reconnection`);
    
    try {
      const result = await this.processQueue();
      
      // Notify listeners
      this.notifyListeners(result);
      
      console.log(`[OfflineQueue] Queue processing completed: ${result.processedCount} processed, ${result.failedCount} failed`);
    } catch (error) {
      console.error('[OfflineQueue] Queue processing failed:', error);
    }
  }

  /**
   * Process all queued operations
   */
  async processQueue(): Promise<QueueExecutionResult> {
    if (this.isProcessing) {
      throw new Error('Queue is already being processed');
    }

    this.isProcessing = true;
    const result: QueueExecutionResult = {
      success: true,
      processedCount: 0,
      failedCount: 0,
      errors: []
    };

    try {
      // Sort queue by priority (highest first) and timestamp (oldest first)
      const sortedQueue = [...this.queue].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

      for (const operation of sortedQueue) {
        try {
          const success = await this.executeOperation(operation);
          
          if (success) {
            result.processedCount++;
            // Remove successful operation from queue
            this.queue = this.queue.filter(op => op.id !== operation.id);
          } else {
            // Increment retry count
            operation.retryCount++;
            
            if (operation.retryCount >= operation.maxRetries) {
              result.failedCount++;
              result.errors.push({
                operationId: operation.id,
                error: `Max retries (${operation.maxRetries}) exceeded`
              });
              
              // Remove failed operation from queue
              this.queue = this.queue.filter(op => op.id !== operation.id);
            }
          }
        } catch (error: any) {
          result.failedCount++;
          result.errors.push({
            operationId: operation.id,
            error: error.message
          });
          
          // Remove operation that caused an exception
          this.queue = this.queue.filter(op => op.id !== operation.id);
        }
      }

      // Save updated queue
      await this.saveQueue();
      
      result.success = result.failedCount === 0;
      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single queued operation
   */
  private async executeOperation(operation: QueuedOperation): Promise<boolean> {
    console.log(`[OfflineQueue] Executing ${operation.type} operation: ${operation.id}`);
    
    try {
      switch (operation.type) {
        case 'server_switch':
          return await this.executeServerSwitch(operation as ServerSwitchOperation);
        
        case 'language_change':
          return await this.executeLanguageChange(operation as LanguageChangeOperation);
        
        case 'settings_update':
          return await this.executeSettingsUpdate(operation as SettingsUpdateOperation);
        
        case 'connectivity_test':
          return await this.executeConnectivityTest(operation as ConnectivityTestOperation);
        
        default:
          console.warn(`[OfflineQueue] Unknown operation type: ${operation.type}`);
          return false;
      }
    } catch (error) {
      console.error(`[OfflineQueue] Operation execution failed:`, error);
      return false;
    }
  }

  /**
   * Execute server switch operation
   */
  private async executeServerSwitch(operation: ServerSwitchOperation): Promise<boolean> {
    try {
      // Use require for better Jest compatibility
      let settingsStoreModule;
      if (process.env.NODE_ENV === 'test') {
        // In test environment, use require to get the mocked module
        settingsStoreModule = require('../stores/settingsStore');
      } else {
        // In production, use dynamic import
        settingsStoreModule = await import('../stores/settingsStore');
      }
      
      const { useSettingsStore } = settingsStoreModule;
      const state = useSettingsStore.getState();
      const { switchServer } = state;
      
      const success = await switchServer(operation.data.toServerId);
      
      if (success) {
        console.log(`[OfflineQueue] Server switch executed: ${operation.data.fromServerId} → ${operation.data.toServerId}`);
      }
      
      return success;
    } catch (error) {
      console.error('[OfflineQueue] Server switch execution failed:', error);
      return false;
    }
  }

  /**
   * Execute language change operation
   */
  private async executeLanguageChange(operation: LanguageChangeOperation): Promise<boolean> {
    try {
      // Use require for better Jest compatibility
      let settingsStoreModule;
      if (process.env.NODE_ENV === 'test') {
        // In test environment, use require to get the mocked module
        settingsStoreModule = require('../stores/settingsStore');
      } else {
        // In production, use dynamic import
        settingsStoreModule = await import('../stores/settingsStore');
      }
      
      const { useSettingsStore } = settingsStoreModule;
      const { setLanguage } = useSettingsStore.getState();
      
      await setLanguage(operation.data.language as any);
      
      console.log(`[OfflineQueue] Language change executed: ${operation.data.language}`);
      return true;
    } catch (error) {
      console.error('[OfflineQueue] Language change execution failed:', error);
      return false;
    }
  }

  /**
   * Execute settings update operation
   */
  private async executeSettingsUpdate(operation: SettingsUpdateOperation): Promise<boolean> {
    try {
      // Import settings store dynamically to avoid circular dependency
      const { useSettingsStore } = await import('../stores/settingsStore');
      const { updatePreferences } = useSettingsStore.getState();
      
      await updatePreferences(operation.data.preferences);
      
      console.log(`[OfflineQueue] Settings update executed`);
      return true;
    } catch (error) {
      console.error('[OfflineQueue] Settings update execution failed:', error);
      return false;
    }
  }

  /**
   * Execute connectivity test operation
   */
  private async executeConnectivityTest(operation: ConnectivityTestOperation): Promise<boolean> {
    try {
      // Import settings store dynamically to avoid circular dependency
      const { useSettingsStore } = await import('../stores/settingsStore');
      const { testServerConnectivity } = useSettingsStore.getState();
      
      const result = await testServerConnectivity(operation.data.serverId);
      
      console.log(`[OfflineQueue] Connectivity test executed for ${operation.data.serverId}: ${result.status}`);
      return result.status === 'connected';
    } catch (error) {
      console.error('[OfflineQueue] Connectivity test execution failed:', error);
      return false;
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    operationsByType: Record<QueuedOperationType, number>;
    oldestOperation?: Date;
    newestOperation?: Date;
  } {
    const operationsByType: Record<QueuedOperationType, number> = {
      server_switch: 0,
      language_change: 0,
      settings_update: 0,
      connectivity_test: 0,
    };

    this.queue.forEach(op => {
      operationsByType[op.type]++;
    });

    const timestamps = this.queue.map(op => op.timestamp);
    
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      operationsByType,
      oldestOperation: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
      newestOperation: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined,
    };
  }

  /**
   * Clear all queued operations
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    console.log('[OfflineQueue] Queue cleared');
  }

  /**
   * Remove specific operation from queue
   */
  async removeOperation(operationId: string): Promise<boolean> {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(op => op.id !== operationId);
    
    if (this.queue.length < initialLength) {
      await this.saveQueue();
      console.log(`[OfflineQueue] Removed operation: ${operationId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Check if offline functionality is available for current server
   * Implements Requirements 2.3 (maintain offline functionality regardless of selected server)
   */
  isOfflineFunctionalityAvailable(): boolean {
    return this.offlineServerConfig?.offlineCapabilities.canViewData ?? false;
  }

  /**
   * Check if offline editing is available
   */
  isOfflineEditingAvailable(): boolean {
    return this.offlineServerConfig?.offlineCapabilities.canEditData ?? false;
  }

  /**
   * Register listener for queue processing results
   */
  onQueueProcessed(listener: (result: QueueExecutionResult) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Unregister queue processing listener
   */
  offQueueProcessed(listener: (result: QueueExecutionResult) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify listeners of queue processing results
   */
  private notifyListeners(result: QueueExecutionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('[OfflineQueue] Listener error:', error);
      }
    });
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.listeners = [];
    networkService.offReconnection(this.processQueueOnReconnection);
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();
export default offlineQueueService;