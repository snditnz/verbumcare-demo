/**
 * Network Connectivity Service
 *
 * Monitors network connectivity (WiFi, cellular, etc.)
 * Used to prevent unnecessary connection attempts when offline
 * Triggers background sync when connectivity is restored
 * Supports server-specific connectivity testing and monitoring
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { cacheService } from './cacheService';
import { getCurrentServer } from '../stores/settingsStore';
import { ServerConfig } from '../config/servers';
import axios from 'axios';

type ConnectivityCallback = (isConnected: boolean) => void;
type ReconnectionCallback = () => void | Promise<void>;
type ServerConnectivityCallback = (serverId: string, isConnected: boolean) => void;

interface ServerConnectivityStatus {
  serverId: string;
  isConnected: boolean;
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

class NetworkService {
  private isCurrentlyConnected: boolean = false;
  private listeners: ConnectivityCallback[] = [];
  private reconnectionListeners: ReconnectionCallback[] = [];
  private serverConnectivityListeners: ServerConnectivityCallback[] = [];
  private subscription: NetInfoSubscription | null = null;
  private serverStatusCache: Map<string, ServerConnectivityStatus> = new Map();
  private serverTestTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize network monitoring
   * Should be called once on app start
   */
  async initialize(): Promise<void> {
    console.log('[Network] Initializing network monitoring...');

    // Get initial state
    const state = await NetInfo.fetch();
    this.isCurrentlyConnected = state.isConnected ?? false;
    console.log(`[Network] Initial state: ${this.isCurrentlyConnected ? 'ONLINE' : 'OFFLINE'}`);

    // Subscribe to network changes
    this.subscription = NetInfo.addEventListener((state: NetInfoState) => {
      this.handleConnectivityChange(state);
    });
  }

  /**
   * Handle connectivity state changes
   * Detects reconnection and triggers sync
   */
  private handleConnectivityChange(state: NetInfoState): void {
    const wasConnected = this.isCurrentlyConnected;
    const isNowConnected = state.isConnected ?? false;
    
    this.isCurrentlyConnected = isNowConnected;

    // Notify connectivity change listeners
    if (wasConnected !== isNowConnected) {
      console.log(`[Network] State changed: ${isNowConnected ? 'ONLINE' : 'OFFLINE'}`);
      this.notifyListeners(isNowConnected);

      // Detect reconnection (offline → online transition)
      if (!wasConnected && isNowConnected) {
        console.log('[Network] Reconnection detected, triggering sync...');
        this.handleReconnection();
      }
    }
  }

  /**
   * Handle reconnection - trigger background sync and offline queue processing
   */
  private async handleReconnection(): Promise<void> {
    try {
      // Notify all reconnection listeners
      for (const listener of this.reconnectionListeners) {
        try {
          await listener();
        } catch (error) {
          console.error('[Network] Reconnection listener error:', error);
        }
      }

      // Trigger background sync of pending changes
      await this.syncPendingChanges();
      
      // Process offline queue (import dynamically to avoid circular dependency)
      try {
        const { offlineQueueService } = await import('./offlineQueueService');
        // The offline queue service will automatically process when reconnection is detected
        console.log('[Network] Offline queue processing will be handled automatically');
      } catch (error) {
        console.error('[Network] Failed to trigger offline queue processing:', error);
      }
    } catch (error) {
      console.error('[Network] Reconnection handling error:', error);
    }
  }

  /**
   * Sync pending changes to backend
   */
  private async syncPendingChanges(): Promise<void> {
    try {
      const pendingItems = await cacheService.getPendingSync();
      
      if (pendingItems.length === 0) {
        console.log('[Network] No pending changes to sync');
        return;
      }

      console.log(`[Network] Syncing ${pendingItems.length} pending changes...`);
      
      // TODO: Implement actual sync logic in Phase 2
      // For now, just log that sync would happen
      // In Phase 2, this will call API service to sync each pending item
      
      console.log('[Network] Sync completed (placeholder)');
    } catch (error) {
      console.error('[Network] Sync error:', error);
    }
  }

  /**
   * Clean up network monitoring
   */
  cleanup(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
    
    // Clear all server test timers
    this.serverTestTimers.forEach(timer => clearTimeout(timer));
    this.serverTestTimers.clear();
    
    // Clear listeners
    this.listeners = [];
    this.reconnectionListeners = [];
    this.serverConnectivityListeners = [];
    this.serverStatusCache.clear();
  }

  /**
   * Check if device has network connectivity (WiFi or cellular)
   */
  isConnected(): boolean {
    return this.isCurrentlyConnected;
  }

  /**
   * Register a callback for network connectivity changes
   * Callback is invoked whenever connectivity state changes (online/offline)
   */
  onConnectivityChange(callback: ConnectivityCallback): void {
    if (!this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
  }

  /**
   * Unregister a connectivity change callback
   */
  offConnectivityChange(callback: ConnectivityCallback): void {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Register a callback for reconnection events
   * Callback is invoked when device transitions from offline to online
   */
  onReconnection(callback: ReconnectionCallback): void {
    if (!this.reconnectionListeners.includes(callback)) {
      this.reconnectionListeners.push(callback);
    }
  }

  /**
   * Unregister a reconnection callback
   */
  offReconnection(callback: ReconnectionCallback): void {
    this.reconnectionListeners = this.reconnectionListeners.filter(cb => cb !== callback);
  }

  /**
   * Notify all listeners of connectivity change
   */
  private notifyListeners(isConnected: boolean): void {
    this.listeners.forEach(callback => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error('[Network] Listener error:', error);
      }
    });
  }

  /**
   * Get detailed network state (for debugging)
   */
  async getDetailedState(): Promise<NetInfoState> {
    return await NetInfo.fetch();
  }

  /**
   * Test connectivity to a specific server
   * Implements Requirements 1.3, 7.1 (server-specific connectivity testing)
   */
  async testServerConnectivity(server: ServerConfig): Promise<ServerConnectivityStatus> {
    const startTime = Date.now();
    
    try {
      // Test the primary health check endpoint
      const primaryEndpoint = server.healthCheckEndpoints[0] || '/health';
      const response = await axios.get(`${server.baseUrl.replace('/api', '')}${primaryEndpoint}`, {
        timeout: server.connectionTimeout,
        httpsAgent: { rejectUnauthorized: false } as any,
      });

      const status: ServerConnectivityStatus = {
        serverId: server.id,
        isConnected: response.status >= 200 && response.status < 300,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
      };

      // Cache the result
      this.serverStatusCache.set(server.id, status);
      
      // Notify listeners
      this.notifyServerConnectivityListeners(server.id, status.isConnected);

      return status;
    } catch (error: any) {
      const status: ServerConnectivityStatus = {
        serverId: server.id,
        isConnected: false,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message,
      };

      // Cache the result
      this.serverStatusCache.set(server.id, status);
      
      // Notify listeners
      this.notifyServerConnectivityListeners(server.id, false);

      return status;
    }
  }

  /**
   * Test connectivity to current server
   * Implements Requirements 2.2, 2.3 (current server connectivity)
   */
  async testCurrentServerConnectivity(): Promise<ServerConnectivityStatus | null> {
    try {
      const currentServer = getCurrentServer();
      return await this.testServerConnectivity(currentServer);
    } catch (error) {
      console.warn('Could not get current server for connectivity test:', error);
      return null;
    }
  }

  /**
   * Get cached server connectivity status
   */
  getServerConnectivityStatus(serverId: string): ServerConnectivityStatus | null {
    return this.serverStatusCache.get(serverId) || null;
  }

  /**
   * Get all cached server connectivity statuses
   */
  getAllServerConnectivityStatuses(): ServerConnectivityStatus[] {
    return Array.from(this.serverStatusCache.values());
  }

  /**
   * Start periodic server connectivity monitoring
   * Implements Requirements 2.4, 2.5 (real-time status updates)
   */
  startServerMonitoring(server: ServerConfig, intervalMs: number = 30000): void {
    // Clear existing timer for this server
    this.stopServerMonitoring(server.id);

    // Start new monitoring
    const timer = setInterval(async () => {
      if (this.isCurrentlyConnected) {
        await this.testServerConnectivity(server);
      }
    }, intervalMs);

    this.serverTestTimers.set(server.id, timer);
    console.log(`📡 Started monitoring server ${server.displayName} every ${intervalMs}ms`);
  }

  /**
   * Stop periodic server connectivity monitoring
   */
  stopServerMonitoring(serverId: string): void {
    const timer = this.serverTestTimers.get(serverId);
    if (timer) {
      clearTimeout(timer);
      this.serverTestTimers.delete(serverId);
      console.log(`📡 Stopped monitoring server ${serverId}`);
    }
  }

  /**
   * Register a callback for server-specific connectivity changes
   */
  onServerConnectivityChange(callback: ServerConnectivityCallback): void {
    if (!this.serverConnectivityListeners.includes(callback)) {
      this.serverConnectivityListeners.push(callback);
    }
  }

  /**
   * Unregister a server connectivity callback
   */
  offServerConnectivityChange(callback: ServerConnectivityCallback): void {
    this.serverConnectivityListeners = this.serverConnectivityListeners.filter(cb => cb !== callback);
  }

  /**
   * Notify server connectivity listeners
   */
  private notifyServerConnectivityListeners(serverId: string, isConnected: boolean): void {
    this.serverConnectivityListeners.forEach(callback => {
      try {
        callback(serverId, isConnected);
      } catch (error) {
        console.error('[Network] Server connectivity listener error:', error);
      }
    });
  }

  /**
   * Handle server switch - update monitoring
   * Implements Requirements 1.2, 4.2 (server switch handling)
   */
  handleServerSwitch(oldServer: ServerConfig, newServer: ServerConfig): void {
    console.log(`📡 Handling server switch: ${oldServer.displayName} → ${newServer.displayName}`);
    
    // Stop monitoring old server
    this.stopServerMonitoring(oldServer.id);
    
    // Start monitoring new server if network is available
    if (this.isCurrentlyConnected) {
      this.startServerMonitoring(newServer);
      
      // Test connectivity immediately
      this.testServerConnectivity(newServer).catch(error => {
        console.warn('Initial connectivity test failed for new server:', error);
      });
    }
  }

  /**
   * Clear server-specific cached data
   * Implements Requirements 4.2 (cache management during server switches)
   */
  clearServerSpecificCache(serverId?: string): void {
    if (serverId) {
      this.serverStatusCache.delete(serverId);
      console.log(`📡 Cleared connectivity cache for server ${serverId}`);
    } else {
      this.serverStatusCache.clear();
      console.log('📡 Cleared all server connectivity cache');
    }
  }
}

export const networkService = new NetworkService();
export default networkService;
