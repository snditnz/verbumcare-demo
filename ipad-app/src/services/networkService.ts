/**
 * Network Connectivity Service
 *
 * Monitors network connectivity (WiFi, cellular, etc.)
 * Used to prevent unnecessary connection attempts when offline
 */

import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

type ConnectivityCallback = (isConnected: boolean) => void;

class NetworkService {
  private isCurrentlyConnected: boolean = false;
  private listeners: ConnectivityCallback[] = [];
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
      const wasConnected = this.isCurrentlyConnected;
      this.isCurrentlyConnected = state.isConnected ?? false;

      if (wasConnected !== this.isCurrentlyConnected) {
        console.log(`[Network] State changed: ${this.isCurrentlyConnected ? 'ONLINE' : 'OFFLINE'}`);
        this.notifyListeners(this.isCurrentlyConnected);
      }
    });
  }

  /**
   * Clean up network monitoring
   */
  cleanup(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
  }

  /**
   * Check if device has network connectivity (WiFi or cellular)
   */
  isConnected(): boolean {
    return this.isCurrentlyConnected;
  }

  /**
   * Register a callback for network connectivity changes
   */
  onConnectivityChange(callback: ConnectivityCallback): void {
    this.listeners.push(callback);
  }

  /**
   * Unregister a callback
   */
  offConnectivityChange(callback: ConnectivityCallback): void {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Notify all listeners of connectivity change
   */
  private notifyListeners(isConnected: boolean): void {
    this.listeners.forEach(callback => callback(isConnected));
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
