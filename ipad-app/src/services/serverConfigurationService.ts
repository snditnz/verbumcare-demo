/**
 * Server Configuration Service
 * 
 * Handles automatic reconnection of services when server configuration changes.
 * This service subscribes to settings store changes and updates API and WebSocket
 * connections accordingly.
 */

import { useSettingsStore } from '../stores/settingsStore';
import { apiService } from './api';
import { socketService } from './socket';

class ServerConfigurationService {
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;

  /**
   * Initialize the service and set up subscriptions
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[ServerConfig] Already initialized');
      return;
    }

    console.log('[ServerConfig] Initializing server configuration service...');

    // Subscribe to server configuration changes
    this.unsubscribe = useSettingsStore.subscribe(
      (state) => state.currentServer,
      (newServer, prevServer) => {
        if (!prevServer || newServer.id !== prevServer.id || newServer.baseUrl !== prevServer.baseUrl) {
          console.log(`[ServerConfig] Server changed from ${prevServer?.displayName || 'none'} to ${newServer.displayName}`);
          this.handleServerChange(newServer, prevServer);
        }
      }
    );

    this.isInitialized = true;
    console.log('[ServerConfig] ✅ Server configuration service initialized');
  }

  /**
   * Handle server configuration changes
   */
  private handleServerChange(newServer: any, prevServer: any): void {
    console.log(`[ServerConfig] Handling server change to: ${newServer.displayName} (${newServer.baseUrl})`);

    try {
      // Update API service configuration
      console.log('[ServerConfig] Updating API service configuration...');
      apiService.handleServerSwitch(newServer);

      // Update WebSocket service configuration
      console.log('[ServerConfig] Updating WebSocket service configuration...');
      socketService.refreshServerConfiguration();

      console.log('[ServerConfig] ✅ Server configuration updated successfully');
    } catch (error) {
      console.error('[ServerConfig] ❌ Failed to update server configuration:', error);
    }
  }

  /**
   * Cleanup subscriptions
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isInitialized = false;
    console.log('[ServerConfig] Server configuration service cleaned up');
  }

  /**
   * Check if the service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const serverConfigurationService = new ServerConfigurationService();
export default serverConfigurationService;