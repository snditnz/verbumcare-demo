/**
 * AudioStreamerService
 * 
 * Manages real-time audio streaming with WebSocket connection for progressive transcription.
 * Implements offline-first architecture with graceful degradation.
 * 
 * Requirements: 1.1, 1.4, 5.1, 5.2 (Real-time streaming, fallback, network resilience)
 */

import { io, Socket } from 'socket.io-client';
import { networkService } from './networkService';
import { getCurrentServer } from '../stores/settingsStore';
import { API_CONFIG } from '@constants/config';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface StreamingSessionConfig {
  patientId?: string;
  contextType: 'patient' | 'global';
  language: 'ja' | 'en' | 'zh-TW';
  userId: string;
}

export interface StreamingSession {
  sessionId: string;
  startedAt: Date;
  status: StreamingSessionStatus;
}

export type StreamingSessionStatus = 'connected' | 'streaming' | 'buffering' | 'offline';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'offline';

export interface TranscriptionUpdate {
  text: string;
  confidence: number;
  isFinal: boolean;
  segmentId?: string;
}

export interface StreamingError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface StreamingResult {
  sessionId: string;
  transcription: string;
  duration: number;
  wasOffline: boolean;
  audioUri?: string;
}

export interface AudioChunk {
  sequenceNumber: number;
  data: ArrayBuffer;
  timestamp: number;
}

/**
 * Live audio data event from react-native-live-audio-stream
 * Requirement 6.1: Accept live audio chunks
 */
export interface LiveAudioDataEvent {
  data: string;            // Base64-encoded audio chunk
  timestamp: number;       // Capture timestamp (relative to session start)
  sequenceNumber: number;  // For ordering
}

/**
 * Audio format metadata for live streaming
 */
export interface AudioFormatMetadata {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

/**
 * Audio source type for mode selection
 * Requirement 3.5: Track audio source
 */
export type AudioSourceType = 'live' | 'fallback';

// ============================================================================
// Event Types
// ============================================================================

type TranscriptionCallback = (update: TranscriptionUpdate) => void;
type ConnectionStatusCallback = (status: ConnectionStatus) => void;
type ErrorCallback = (error: StreamingError) => void;
type SessionStatusCallback = (status: StreamingSessionStatus) => void;

// ============================================================================
// AudioStreamerService Class
// ============================================================================

class AudioStreamerService {
  // Connection state
  private socket: Socket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private currentSession: StreamingSession | null = null;
  private sessionConfig: StreamingSessionConfig | null = null;
  
  // Chunk buffering for network resilience
  private chunkBuffer: AudioChunk[] = [];
  private sequenceNumber: number = 0;
  private isStreaming: boolean = false;
  private isPaused: boolean = false;
  
  // Reconnection handling
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // Network latency detection (Requirement 5.3, 5.4)
  private latencyHistory: number[] = [];
  private maxLatencyHistorySize: number = 10;
  private latencyThreshold: number = 2000; // 2 seconds
  private lastPingTime: number = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private isHighLatencyMode: boolean = false;
  
  // Event callbacks
  private transcriptionCallbacks: TranscriptionCallback[] = [];
  private connectionStatusCallbacks: ConnectionStatusCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private sessionStatusCallbacks: SessionStatusCallback[] = [];
  
  // Network monitoring
  private networkUnsubscribe: (() => void) | null = null;
  
  // Live audio integration (Requirement 6.1, 3.5)
  private audioSource: AudioSourceType = 'fallback';
  private audioFormat: AudioFormatMetadata = {
    sampleRate: 32000,
    channels: 1,
    bitsPerSample: 16,
  };

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to the streaming WebSocket server
   * Implements Requirement 1.1: Establish WebSocket connection
   * Implements Requirement 5.1: Check network availability first
   */
  async connect(config: StreamingSessionConfig): Promise<StreamingSession> {
    this.sessionConfig = config;
    
    // Requirement 5.1: Check network availability before attempting connection
    if (!networkService.isConnected()) {
      console.log('[AudioStreamer] Network unavailable, using offline mode');
      return this.createOfflineSession(config);
    }

    this.setConnectionStatus('connecting');
    
    try {
      const wsUrl = this.getWebSocketUrl();
      console.log('[AudioStreamer] 🔌 Connecting to WebSocket:', wsUrl);
      console.log('[AudioStreamer] 🔌 Config:', JSON.stringify(config));
      console.log('[AudioStreamer] 🔌 Creating Socket.IO instance with options:', {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        reconnection: false,
        timeout: 15000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: true,
        rejectUnauthorized: false,
      });
      
      // Create Socket.IO connection with streaming-specific options
      // Use polling first, then upgrade to websocket (more reliable with self-signed certs)
      this.socket = io(wsUrl, {
        path: '/socket.io',
        transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket
        reconnection: false, // We handle reconnection manually
        timeout: 15000, // Increased timeout for SSL handshake
        forceNew: true,
        upgrade: true, // Allow upgrade from polling to websocket
        rememberUpgrade: true,
        // For self-signed certificates on local network
        rejectUnauthorized: false,
      });
      
      console.log('[AudioStreamer] 🔌 Socket.IO instance created, socket id:', this.socket?.id);

      // Set up connection event handlers
      this.setupSocketEventHandlers();
      
      // Wait for connection with timeout
      const session = await this.waitForConnection(config);
      
      // Start network monitoring for this session
      this.startNetworkMonitoring();
      
      return session;
    } catch (error: any) {
      console.log('[AudioStreamer] ❌ Connection failed:', error.message);
      console.log('[AudioStreamer] Falling back to offline mode');
      // Requirement 5.2: Fall back to offline mode without showing errors
      return this.createOfflineSession(config);
    }
  }

  /**
   * Disconnect from the streaming server
   */
  disconnect(): void {
    this.stopNetworkMonitoring();
    this.clearReconnectTimer();
    this.stopLatencyMonitoring();
    
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.setConnectionStatus('disconnected');
    this.currentSession = null;
    this.sessionConfig = null;
    this.chunkBuffer = [];
    this.sequenceNumber = 0;
    this.isStreaming = false;
    this.isPaused = false;
    this.reconnectAttempts = 0;
    this.latencyHistory = [];
    this.isHighLatencyMode = false;
    this.audioSource = 'fallback';
  }

  /**
   * Get the WebSocket URL from current server configuration
   * Uses wss:// for secure connections - Socket.IO handles self-signed certs via rejectUnauthorized
   */
  private getWebSocketUrl(): string {
    try {
      const currentServer = getCurrentServer();
      const wsUrl = currentServer.wsUrl;
      console.log('[AudioStreamer] Using WebSocket URL:', wsUrl);
      return wsUrl;
    } catch (error) {
      console.warn('[AudioStreamer] Could not get current server, using fallback');
      return API_CONFIG.WS_URL;
    }
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[AudioStreamer] ✅ Connected to server! Socket ID:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.setConnectionStatus('connected');
      
      // Start latency monitoring
      this.startLatencyMonitoring();
      
      // Flush buffered chunks if any
      this.flushChunkBuffer();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[AudioStreamer] ❌ Disconnected from server. Reason:', reason);
      
      if (reason === 'io client disconnect') {
        // Intentional disconnect, don't reconnect
        this.setConnectionStatus('disconnected');
      } else if (this.isStreaming) {
        // Unexpected disconnect during streaming, try to reconnect
        this.handleUnexpectedDisconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.log('[AudioStreamer] ⚠️ Connection error:', error.message);
      console.log('[AudioStreamer] ⚠️ Error details:', JSON.stringify(error));
    });

    // Streaming-specific events
    this.socket.on('stream:started', (data: { sessionId: string }) => {
      console.log('[AudioStreamer] Session started:', data.sessionId);
      if (this.currentSession) {
        this.currentSession.sessionId = data.sessionId;
        this.currentSession.status = 'connected';
        this.notifySessionStatusChange('connected');
      }
    });

    this.socket.on('stream:transcription', (data: TranscriptionUpdate) => {
      console.log('[AudioStreamer] 📥 Received stream:transcription:', data.text?.substring(0, 50));
      this.notifyTranscriptionUpdate(data);
    });

    this.socket.on('stream:error', (error: { code: string; message: string }) => {
      this.notifyError({
        code: error.code,
        message: error.message,
        recoverable: this.isRecoverableError(error.code),
      });
    });

    this.socket.on('stream:complete', (result: { transcription: string; sessionId: string }) => {
      console.log('[AudioStreamer] Stream complete:', result.sessionId);
    });

    this.socket.on('categorization:started', () => {
      console.log('[AudioStreamer] Categorization started');
    });

    this.socket.on('categorization:complete', (data: { reviewId: string; categories: string[] }) => {
      console.log('[AudioStreamer] Categorization complete:', data.reviewId);
    });

    this.socket.on('categorization:error', (error: { code: string; message: string }) => {
      this.notifyError({
        code: error.code,
        message: error.message,
        recoverable: true,
      });
    });

    // Latency monitoring - pong response
    this.socket.on('pong', this.handlePong);
  }

  /**
   * Wait for connection to be established
   */
  private waitForConnection(config: StreamingSessionConfig): Promise<StreamingSession> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      if (!this.socket) {
        clearTimeout(timeout);
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        
        // Request session creation
        this.socket?.emit('stream:start', config);
        
        // Create local session object
        const session: StreamingSession = {
          sessionId: '', // Will be updated when server responds
          startedAt: new Date(),
          status: 'connected',
        };
        
        this.currentSession = session;
        resolve(session);
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Create an offline session when network is unavailable
   * Implements Requirement 5.2: Immediate offline mode without connection attempts
   */
  private createOfflineSession(config: StreamingSessionConfig): StreamingSession {
    const session: StreamingSession = {
      sessionId: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startedAt: new Date(),
      status: 'offline',
    };
    
    this.currentSession = session;
    this.setConnectionStatus('offline');
    this.notifySessionStatusChange('offline');
    
    console.log('[AudioStreamer] Created offline session:', session.sessionId);
    return session;
  }

  // ============================================================================
  // Streaming Control
  // ============================================================================

  /**
   * Start streaming audio chunks
   */
  async startStreaming(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call connect() first.');
    }

    this.isStreaming = true;
    this.isPaused = false;
    this.sequenceNumber = 0;
    this.chunkBuffer = [];

    if (this.currentSession.status !== 'offline') {
      this.currentSession.status = 'streaming';
      this.notifySessionStatusChange('streaming');
    }

    console.log('[AudioStreamer] Started streaming');
  }

  /**
   * Pause streaming (maintains connection)
   * Implements Requirement 1.5: Pause chunk transmission while maintaining connection
   */
  pauseStreaming(): void {
    if (!this.isStreaming) return;
    
    this.isPaused = true;
    
    if (this.socket?.connected) {
      this.socket.emit('stream:pause');
    }
    
    console.log('[AudioStreamer] Paused streaming');
  }

  /**
   * Resume streaming after pause
   * Implements Requirement 1.6: Resume chunk transmission seamlessly
   */
  resumeStreaming(): void {
    if (!this.isStreaming || !this.isPaused) return;
    
    this.isPaused = false;
    
    if (this.socket?.connected) {
      this.socket.emit('stream:resume');
      // Flush any chunks that were buffered during pause
      this.flushChunkBuffer();
    }
    
    console.log('[AudioStreamer] Resumed streaming');
  }

  /**
   * Stop streaming and finalize the session
   * IMPORTANT: Waits for server to send stream:complete before returning
   * This ensures all transcriptions are received before disconnecting
   */
  async stopStreaming(): Promise<StreamingResult> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.isStreaming = false;
    this.isPaused = false;

    const result: StreamingResult = {
      sessionId: this.currentSession.sessionId,
      transcription: '',
      duration: Date.now() - this.currentSession.startedAt.getTime(),
      wasOffline: this.currentSession.status === 'offline',
    };

    if (this.socket?.connected) {
      // Wait for server to finish processing and send stream:complete
      // This ensures we receive all transcriptions before disconnecting
      console.log('[AudioStreamer] Sending stream:stop, waiting for server to complete...');
      
      try {
        const serverResult = await this.waitForStreamComplete();
        result.transcription = serverResult.transcription || '';
        console.log('[AudioStreamer] Server completed, transcription received');
      } catch (error) {
        console.log('[AudioStreamer] Timeout waiting for stream:complete, continuing with local result');
      }
    }

    console.log('[AudioStreamer] Stopped streaming:', result);
    return result;
  }

  /**
   * Wait for the server to send stream:complete after stream:stop
   * Times out after 30 seconds to prevent hanging
   */
  private waitForStreamComplete(): Promise<{ transcription: string; sessionId: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('[AudioStreamer] Timeout waiting for stream:complete');
        reject(new Error('Timeout waiting for stream:complete'));
      }, 30000); // 30 second timeout for Whisper processing

      if (!this.socket) {
        clearTimeout(timeout);
        reject(new Error('Socket not connected'));
        return;
      }

      // Listen for stream:complete event
      const completeHandler = (data: { transcription: string; sessionId: string }) => {
        clearTimeout(timeout);
        console.log('[AudioStreamer] Received stream:complete:', data.sessionId);
        resolve(data);
      };

      // Also handle errors
      const errorHandler = (error: { code: string; message: string }) => {
        clearTimeout(timeout);
        console.log('[AudioStreamer] Received stream:error while waiting:', error);
        reject(new Error(error.message));
      };

      // Set up one-time listeners
      this.socket.once('stream:complete', completeHandler);
      this.socket.once('stream:error', errorHandler);

      // Send the stop signal
      this.socket.emit('stream:stop');
    });
  }

  /**
   * Send an audio chunk for processing
   * Implements chunk buffering for network resilience
   * Implements Requirement 5.4: Buffer when latency > 2 seconds
   */
  sendChunk(audioData: ArrayBuffer): void {
    if (!this.isStreaming || this.isPaused) return;

    const chunk: AudioChunk = {
      sequenceNumber: this.sequenceNumber++,
      data: audioData,
      timestamp: Date.now(),
    };

    // Buffer if: disconnected, offline, or high latency mode
    const shouldBuffer = 
      this.connectionStatus !== 'connected' || 
      !this.socket?.connected ||
      this.isHighLatencyMode;

    if (!shouldBuffer) {
      // Send immediately if connected and latency is normal
      this.socket!.emit('stream:chunk', {
        sequenceNumber: chunk.sequenceNumber,
        data: chunk.data,
      });
    } else {
      // Buffer for later transmission
      this.chunkBuffer.push(chunk);
      
      if (this.currentSession && this.currentSession.status !== 'offline') {
        this.currentSession.status = 'buffering';
        this.notifySessionStatusChange('buffering');
      }
    }
  }

  /**
   * Send a live audio chunk from react-native-live-audio-stream
   * Decodes base64 to ArrayBuffer and includes format metadata
   * Requirement 6.1: Accept live audio chunks
   * Requirement 2.1: Include format metadata
   */
  sendLiveChunk(event: LiveAudioDataEvent): void {
    if (!this.isStreaming || this.isPaused) return;

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(event.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioData = bytes.buffer;

      const chunk: AudioChunk = {
        sequenceNumber: event.sequenceNumber,
        data: audioData,
        timestamp: event.timestamp,
      };

      // Buffer if: disconnected, offline, or high latency mode
      const shouldBuffer = 
        this.connectionStatus !== 'connected' || 
        !this.socket?.connected ||
        this.isHighLatencyMode;

      if (!shouldBuffer) {
        // Send immediately with format metadata
        this.socket!.emit('stream:chunk', {
          sequenceNumber: chunk.sequenceNumber,
          data: chunk.data,
          timestamp: chunk.timestamp,
          format: this.audioFormat,
        });
      } else {
        // Buffer for later transmission
        this.chunkBuffer.push(chunk);
        
        if (this.currentSession && this.currentSession.status !== 'offline') {
          this.currentSession.status = 'buffering';
          this.notifySessionStatusChange('buffering');
        }
      }
    } catch (error) {
      console.error('[AudioStreamer] Error processing live chunk:', error);
    }
  }

  /**
   * Set the audio source type for the current session
   * Requirement 3.5: Track audio source
   */
  setAudioSource(source: AudioSourceType): void {
    this.audioSource = source;
    console.log('[AudioStreamer] Audio source set to:', source);
  }

  /**
   * Get the current audio source type
   */
  getAudioSource(): AudioSourceType {
    return this.audioSource;
  }

  /**
   * Set audio format metadata for live streaming
   */
  setAudioFormat(format: AudioFormatMetadata): void {
    this.audioFormat = { ...format };
    console.log('[AudioStreamer] Audio format set:', this.audioFormat);
  }

  /**
   * Get current audio format metadata
   */
  getAudioFormat(): AudioFormatMetadata {
    return { ...this.audioFormat };
  }

  /**
   * Flush buffered chunks when connection is restored
   */
  private flushChunkBuffer(): void {
    if (!this.socket?.connected || this.chunkBuffer.length === 0) return;

    console.log(`[AudioStreamer] Flushing ${this.chunkBuffer.length} buffered chunks`);

    // Sort by sequence number to ensure order
    this.chunkBuffer.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    for (const chunk of this.chunkBuffer) {
      this.socket.emit('stream:chunk', {
        sequenceNumber: chunk.sequenceNumber,
        data: chunk.data,
      });
    }

    this.chunkBuffer = [];

    if (this.currentSession && this.isStreaming) {
      this.currentSession.status = 'streaming';
      this.notifySessionStatusChange('streaming');
    }
  }

  // ============================================================================
  // Network Resilience - Latency Detection (Requirements 5.3, 5.4)
  // ============================================================================

  /**
   * Start monitoring network latency
   * Implements Requirement 5.3: Detect network latency
   */
  private startLatencyMonitoring(): void {
    if (this.pingInterval) return;
    
    // Send ping every 3 seconds to measure latency
    this.pingInterval = setInterval(() => {
      this.measureLatency();
    }, 3000);
    
    // Initial measurement
    this.measureLatency();
  }

  /**
   * Stop latency monitoring
   */
  private stopLatencyMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Measure current network latency using ping/pong
   */
  private measureLatency(): void {
    if (!this.socket?.connected) return;
    
    this.lastPingTime = Date.now();
    this.socket.emit('ping');
  }

  /**
   * Handle pong response and calculate latency
   */
  private handlePong = (): void => {
    const latency = Date.now() - this.lastPingTime;
    this.recordLatency(latency);
    
    // Check if we should switch modes
    this.evaluateLatencyMode();
  };

  /**
   * Record latency measurement
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    
    // Keep only recent measurements
    if (this.latencyHistory.length > this.maxLatencyHistorySize) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Get average latency from recent measurements
   */
  getAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return sum / this.latencyHistory.length;
  }

  /**
   * Evaluate if we should switch between normal and high-latency modes
   * Implements Requirement 5.4: Buffer when latency > 2 seconds
   */
  private evaluateLatencyMode(): void {
    const avgLatency = this.getAverageLatency();
    
    if (avgLatency > this.latencyThreshold && !this.isHighLatencyMode) {
      // Switch to high latency mode - buffer chunks locally
      console.log(`[AudioStreamer] High latency detected (${avgLatency}ms), switching to buffering mode`);
      this.isHighLatencyMode = true;
      
      if (this.currentSession && this.currentSession.status !== 'offline') {
        this.currentSession.status = 'buffering';
        this.notifySessionStatusChange('buffering');
      }
    } else if (avgLatency <= this.latencyThreshold && this.isHighLatencyMode) {
      // Latency normalized, resume normal transmission
      console.log(`[AudioStreamer] Latency normalized (${avgLatency}ms), resuming normal transmission`);
      this.isHighLatencyMode = false;
      
      // Flush buffered chunks
      this.flushChunkBuffer();
      
      if (this.currentSession && this.isStreaming) {
        this.currentSession.status = 'streaming';
        this.notifySessionStatusChange('streaming');
      }
    }
  }

  /**
   * Check if currently in high latency mode
   */
  isInHighLatencyMode(): boolean {
    return this.isHighLatencyMode;
  }

  // ============================================================================
  // Network Resilience
  // ============================================================================

  /**
   * Start monitoring network changes for the current session
   */
  private startNetworkMonitoring(): void {
    this.networkUnsubscribe = () => {
      networkService.offConnectivityChange(this.handleNetworkChange);
    };
    networkService.onConnectivityChange(this.handleNetworkChange);
  }

  /**
   * Stop network monitoring
   */
  private stopNetworkMonitoring(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  /**
   * Handle network connectivity changes
   */
  private handleNetworkChange = (isConnected: boolean): void => {
    if (isConnected && this.connectionStatus === 'offline' && this.isStreaming) {
      console.log('[AudioStreamer] Network restored, attempting reconnection');
      this.attemptReconnect();
    } else if (!isConnected && this.connectionStatus !== 'offline') {
      console.log('[AudioStreamer] Network lost, switching to offline mode');
      this.setConnectionStatus('offline');
      if (this.currentSession) {
        this.currentSession.status = 'offline';
        this.notifySessionStatusChange('offline');
      }
    }
  };

  /**
   * Handle unexpected disconnection during streaming
   */
  private handleUnexpectedDisconnect(): void {
    if (networkService.isConnected()) {
      // Network is available, try to reconnect
      this.attemptReconnect();
    } else {
      // Network unavailable, switch to offline mode
      this.setConnectionStatus('offline');
      if (this.currentSession) {
        this.currentSession.status = 'offline';
        this.notifySessionStatusChange('offline');
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[AudioStreamer] Max reconnect attempts reached, staying offline');
      this.setConnectionStatus('offline');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[AudioStreamer] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(async () => {
      if (this.sessionConfig && networkService.isConnected()) {
        try {
          await this.connect(this.sessionConfig);
          if (this.isStreaming) {
            await this.startStreaming();
          }
        } catch (error) {
          this.attemptReconnect();
        }
      }
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Register callback for transcription updates
   */
  onTranscriptionUpdate(callback: TranscriptionCallback): () => void {
    this.transcriptionCallbacks.push(callback);
    return () => {
      this.transcriptionCallbacks = this.transcriptionCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register callback for connection status changes
   */
  onConnectionStatusChange(callback: ConnectionStatusCallback): () => void {
    this.connectionStatusCallbacks.push(callback);
    return () => {
      this.connectionStatusCallbacks = this.connectionStatusCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register callback for errors
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register callback for session status changes
   */
  onSessionStatusChange(callback: SessionStatusCallback): () => void {
    this.sessionStatusCallbacks.push(callback);
    return () => {
      this.sessionStatusCallbacks = this.sessionStatusCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyTranscriptionUpdate(update: TranscriptionUpdate): void {
    console.log(`[AudioStreamer] 🔔 notifyTranscriptionUpdate called with ${this.transcriptionCallbacks.length} callbacks, text: "${update.text?.substring(0, 30)}..."`);
    this.transcriptionCallbacks.forEach((cb, index) => {
      try {
        console.log(`[AudioStreamer] 🔔 Calling callback ${index + 1}/${this.transcriptionCallbacks.length}`);
        cb(update);
      } catch (error) {
        console.error('[AudioStreamer] Transcription callback error:', error);
      }
    });
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.connectionStatusCallbacks.forEach(cb => {
        try {
          cb(status);
        } catch (error) {
          console.error('[AudioStreamer] Connection status callback error:', error);
        }
      });
    }
  }

  private notifyError(error: StreamingError): void {
    this.errorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (err) {
        console.error('[AudioStreamer] Error callback error:', err);
      }
    });
  }

  private notifySessionStatusChange(status: StreamingSessionStatus): void {
    this.sessionStatusCallbacks.forEach(cb => {
      try {
        cb(status);
      } catch (error) {
        console.error('[AudioStreamer] Session status callback error:', error);
      }
    });
  }

  // ============================================================================
  // State Accessors
  // ============================================================================

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if currently streaming
   */
  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Check if streaming is paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Get buffered chunk count (for network resilience monitoring)
   */
  getBufferedChunkCount(): number {
    return this.chunkBuffer.length;
  }

  /**
   * Get current session
   */
  getCurrentSession(): StreamingSession | null {
    return this.currentSession;
  }

  /**
   * Check if an error code is recoverable
   */
  private isRecoverableError(code: string): boolean {
    const recoverableCodes = [
      'STREAM_001', // Connection failed
      'STREAM_003', // Chunk transmission failed
      'STREAM_005', // Categorization failed
      'STREAM_006', // Session timeout
    ];
    return recoverableCodes.includes(code);
  }

  /**
   * Get latency history for monitoring/testing
   */
  getLatencyHistory(): number[] {
    return [...this.latencyHistory];
  }

  /**
   * Simulate latency for testing purposes (only in __DEV__ mode)
   */
  _simulateLatency(latency: number): void {
    if (__DEV__) {
      this.recordLatency(latency);
      this.evaluateLatencyMode();
    }
  }

  /**
   * Get buffered chunks for testing/verification
   * Returns chunks sorted by sequence number
   */
  getBufferedChunks(): AudioChunk[] {
    return [...this.chunkBuffer].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }
}

// Export singleton instance
export const audioStreamerService = new AudioStreamerService();
export default audioStreamerService;
