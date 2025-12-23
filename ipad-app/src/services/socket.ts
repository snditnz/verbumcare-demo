import { io, Socket } from 'socket.io-client';
import { API_CONFIG, FACILITY_ID } from '@constants/config';
import { VoiceProcessingProgress } from '@models/api';
import { networkService } from './networkService';
import { getCurrentServer } from '../stores/settingsStore';

type SocketCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, SocketCallback[]> = new Map();
  private shouldConnect: boolean = true;
  private currentWsUrl: string | null = null;

  /**
   * Get the effective WebSocket URL from settings store
   */
  private getEffectiveWsUrl(): string {
    try {
      const currentServer = getCurrentServer();
      console.log(`📡 WebSocket using server: ${currentServer.displayName} (${currentServer.wsUrl})`);
      return currentServer.wsUrl;
    } catch (error) {
      console.warn('Could not get current server for WebSocket, using fallback API_CONFIG.WS_URL');
      return API_CONFIG.WS_URL;
    }
  }

  /**
   * Initialize Socket.IO with network monitoring
   * Only connects when network is available
   */
  initialize(): void {
    // Listen for network changes
    networkService.onConnectivityChange((isConnected) => {
      if (isConnected && this.shouldConnect) {
        console.log('[Socket] Network available, attempting connection...');
        this.connect();
      } else if (!isConnected) {
        console.log('[Socket] Network unavailable, disconnecting...');
        this.disconnect();
      }
    });

    // Try initial connection if network is available
    if (networkService.isConnected() && this.shouldConnect) {
      this.connect();
    } else {
      console.log('[Socket] Skipping connection - no network available');
    }
  }

  connect(): void {
    // Only connect if network is available
    if (!networkService.isConnected()) {
      console.log('[Socket] Skipping connection - no network');
      return;
    }

    // Get current WebSocket URL from settings
    const wsUrl = this.getEffectiveWsUrl();
    
    // If already connected to the same URL, don't reconnect
    if (this.socket?.connected && this.currentWsUrl === wsUrl) {
      console.log('[Socket] Already connected to current server');
      return;
    }

    // Disconnect from old server if connected to different URL
    if (this.socket?.connected && this.currentWsUrl !== wsUrl) {
      console.log(`[Socket] Server changed from ${this.currentWsUrl} to ${wsUrl}, reconnecting...`);
      this.disconnect();
    }

    console.log('[Socket] Connecting to:', wsUrl);
    this.currentWsUrl = wsUrl;

    this.socket = io(wsUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000, // Reduced from 20s to 5s for faster failure
      forceNew: true,
      secure: true,
      rejectUnauthorized: false,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] ✅ Connected:', this.socket?.id);
      this.socket?.emit('join-facility', FACILITY_ID);
    });

    this.socket.on('disconnect', (reason) => {
      // Only log if it's not an intentional disconnect
      if (reason !== 'io client disconnect') {
        console.log('[Socket] Disconnected:', reason);
      }
    });

    this.socket.on('connect_error', (error) => {
      // SILENT ERROR: Only log in debug mode, don't show full error
      // This prevents "Full error: Error: timeout" from appearing
      if (__DEV__) {
        console.log('[Socket] Connection failed (silent):', error.message);
      }
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      // Silent - only connect if network is available
      if (!networkService.isConnected()) {
        this.socket?.close();
      }
    });

    // Setup event listeners
    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentWsUrl = null;
    }
  }

  /**
   * Reconnect to a new WebSocket URL (used when server configuration changes)
   */
  reconnect(newWsUrl?: string): void {
    console.log('[Socket] Reconnecting WebSocket...');
    this.disconnect();
    
    // If a specific URL is provided, temporarily override the settings
    if (newWsUrl) {
      this.currentWsUrl = newWsUrl;
    }
    
    // Reconnect with current network status check
    if (networkService.isConnected() && this.shouldConnect) {
      this.connect();
    }
  }

  /**
   * Refresh server configuration and reconnect if needed
   */
  refreshServerConfiguration(): void {
    const newWsUrl = this.getEffectiveWsUrl();
    
    if (this.currentWsUrl !== newWsUrl) {
      console.log(`[Socket] Server configuration changed, reconnecting from ${this.currentWsUrl} to ${newWsUrl}`);
      this.reconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('voice-processing-progress', (data: VoiceProcessingProgress) => {
      console.log('📢 Received voice-processing-progress:', data);
      this.emit('voice-processing-progress', data);
    });

    this.socket.on('medication:administered', (data: any) => {
      console.log('📢 Received medication:administered:', data);
      this.emit('medication:administered', data);
    });

    this.socket.on('vitals:recorded', (data: any) => {
      console.log('📢 Received vitals:recorded:', data);
      this.emit('vitals:recorded', data);
    });

    this.socket.on('assessment:completed', (data: any) => {
      console.log('📢 Received assessment:completed:', data);
      this.emit('assessment:completed', data);
    });
  }

  on(event: string, callback: SocketCallback): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
  }

  off(event: string, callback: SocketCallback): void {
    const callbacks = this.listeners.get(event) || [];
    const filtered = callbacks.filter((cb) => cb !== callback);
    this.listeners.set(event, filtered);
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((callback) => callback(data));
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export default socketService;
