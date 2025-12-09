/**
 * Network Connectivity Service
 *
 * Monitors network connectivity (WiFi, cellular, etc.)
 * Used to prevent unnecessary connection attempts when offline
 * Triggers background sync when connectivity is restored
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { cacheService } from './cacheService';

type ConnectivityCallback = (isConnected: boolean) => void;
type ReconnectionCallback = () => void | Promise<void>;

class NetworkService {
  private isCurrentlyConnected: boolean = false;
  private listeners: ConnectivityCallback[] = [];
  private reconnectionListeners: ReconnectionCallback[] = [];
  private subscription: NetInfoSubscription | null = null;

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
   * Handle reconnection - trigger background sync
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
    this.listeners = [];
    this.reconnectionListeners = [];
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
}

export const networkService = new NetworkService();
export default networkService;
