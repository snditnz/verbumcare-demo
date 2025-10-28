import { io, Socket } from 'socket.io-client';
import { API_CONFIG, FACILITY_ID } from '@constants/config';
import { VoiceProcessingProgress } from '@models/api';
import { networkService } from './networkService';

type SocketCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, SocketCallback[]> = new Map();
  private shouldConnect: boolean = true;

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

    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    console.log('[Socket] Connecting to:', API_CONFIG.WS_URL);

    this.socket = io(API_CONFIG.WS_URL, {
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
