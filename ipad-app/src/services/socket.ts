import { io, Socket } from 'socket.io-client';
import { API_CONFIG, FACILITY_ID } from '@constants/config';
import { VoiceProcessingProgress } from '@models/api';

type SocketCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, SocketCallback[]> = new Map();

  connect(): void {
    if (this.socket?.connected) {
      console.log('✅ Socket already connected');
      return;
    }

    console.log('🔌 Connecting to Socket.IO:', API_CONFIG.WS_URL);

    this.socket = io(API_CONFIG.WS_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
      secure: true,
      rejectUnauthorized: false,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', this.socket?.id);
      this.socket?.emit('join-facility', FACILITY_ID);
      console.log('📍 Joined facility:', FACILITY_ID);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('⚠️  Socket.IO connection error:', error.message);
      console.error('Full error:', error);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Socket.IO reconnect attempt ${attempt}/5`);
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
