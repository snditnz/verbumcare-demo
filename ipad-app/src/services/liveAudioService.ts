/**
 * LiveAudioService
 * 
 * Wrapper service for react-native-live-audio-stream that provides real-time
 * audio capture with data events for streaming transcription.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.2, 2.3
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface LiveAudioConfig {
  sampleRate: number;      // 32000 recommended for voice
  channels: number;        // 1 for mono
  bitsPerSample: number;   // 16 for adequate quality
  bufferSize: number;      // 4096 recommended
  audioSource?: number;    // Android only: 6 = VOICE_RECOGNITION
}

export interface AudioDataEvent {
  data: string;            // Base64-encoded audio chunk
  timestamp: number;       // Capture timestamp
  sequenceNumber: number;  // For ordering
}

export interface AudioErrorEvent {
  code: string;
  message: string;
  recoverable: boolean;
}

type DataCallback = (event: AudioDataEvent) => void;
type ErrorCallback = (error: AudioErrorEvent) => void;

/**
 * Recovery action types for error handling
 * Requirement 8.3: Define recovery strategies
 */
export type RecoveryAction = 
  | { type: 'retry'; delay: number }
  | { type: 'fallback' }
  | { type: 'queue-offline' }
  | { type: 'notify-user'; message: string };

// Default configuration optimized for voice recognition
export const DEFAULT_LIVE_AUDIO_CONFIG: LiveAudioConfig = {
  sampleRate: 32000,
  channels: 1,
  bitsPerSample: 16,
  bufferSize: 4096,
  audioSource: 6,  // VOICE_RECOGNITION on Android
};

// ============================================================================
// LiveAudioService Class
// ============================================================================

class LiveAudioService {
  private nativeModule: any = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private dataSubscription: any = null;
  private config: LiveAudioConfig = DEFAULT_LIVE_AUDIO_CONFIG;
  private recording: boolean = false;
  private sequenceNumber: number = 0;
  private startTimestamp: number = 0;
  
  // Callbacks
  private dataCallbacks: DataCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  
  // Error recovery
  private preservedChunks: AudioDataEvent[] = [];
  private maxPreservedChunks: number = 100;
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 3;

  constructor() {
    this.initializeNativeModule();
  }

  /**
   * Initialize the native module reference
   */
  private initializeNativeModule(): void {
    try {
      // The native module is named RNLiveAudioStream (from react-native-live-audio-stream)
      const { RNLiveAudioStream } = NativeModules;
      if (RNLiveAudioStream) {
        this.nativeModule = RNLiveAudioStream;
        this.eventEmitter = new NativeEventEmitter(RNLiveAudioStream);
        console.log('[LiveAudioService] Native module initialized successfully');
      } else {
        console.log('[LiveAudioService] Native module RNLiveAudioStream not available');
        console.log('[LiveAudioService] Available NativeModules:', Object.keys(NativeModules).join(', '));
      }
    } catch (error) {
      console.log('[LiveAudioService] Failed to initialize native module:', error);
    }
  }

  /**
   * Check if the native module is available
   * Requirement 3.2: Check module availability
   */
  isAvailable(): boolean {
    return this.nativeModule !== null && this.eventEmitter !== null;
  }

  /**
   * Initialize the audio capture with configuration
   * Requirement 1.1: Initialize audio capture
   */
  init(config?: Partial<LiveAudioConfig>): void {
    if (!this.isAvailable()) {
      console.log('[LiveAudioService] Cannot init - native module not available');
      return;
    }

    this.config = { ...DEFAULT_LIVE_AUDIO_CONFIG, ...config };
    
    try {
      this.nativeModule.init({
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        bitsPerSample: this.config.bitsPerSample,
        audioSource: this.config.audioSource,
        bufferSize: this.config.bufferSize,
      });
      console.log('[LiveAudioService] Initialized with config:', this.config);
    } catch (error) {
      console.error('[LiveAudioService] Init error:', error);
      this.notifyError({
        code: 'INIT_FAILED',
        message: 'Failed to initialize audio capture',
        recoverable: true,
      });
    }
  }

  /**
   * Start audio capture
   * Requirement 1.2: Start real-time audio capture
   */
  async start(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Native module not available');
    }

    if (this.recording) {
      console.log('[LiveAudioService] Already recording, ignoring start request');
      return;
    }

    try {
      // Reset state
      this.sequenceNumber = 0;
      this.startTimestamp = Date.now();
      this.preservedChunks = [];

      // Set up data listener
      this.setupDataListener();

      // Start native recording
      this.nativeModule.start();
      this.recording = true;
      
      console.log('[LiveAudioService] Started recording');
    } catch (error: any) {
      console.error('[LiveAudioService] Start error:', error);
      this.notifyError({
        code: 'START_FAILED',
        message: error.message || 'Failed to start audio capture',
        recoverable: true,
      });
      throw error;
    }
  }

  /**
   * Stop audio capture
   * Requirement 1.5: Stop and release resources
   */
  async stop(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    if (!this.recording) {
      console.log('[LiveAudioService] Not recording, ignoring stop request');
      return;
    }

    try {
      // Stop native recording
      this.nativeModule.stop();
      
      // Clean up listener
      this.removeDataListener();
      
      this.recording = false;
      console.log('[LiveAudioService] Stopped recording');
    } catch (error: any) {
      console.error('[LiveAudioService] Stop error:', error);
      this.recording = false;
      this.removeDataListener();
    }
  }

  /**
   * Set up the native data event listener
   */
  private setupDataListener(): void {
    if (!this.eventEmitter) return;

    this.removeDataListener();

    this.dataSubscription = this.eventEmitter.addListener('data', (base64Data: string) => {
      const event: AudioDataEvent = {
        data: base64Data,
        timestamp: Date.now() - this.startTimestamp,
        sequenceNumber: this.sequenceNumber++,
      };

      // Preserve chunk for error recovery
      this.preserveChunk(event);

      // Notify all callbacks
      this.notifyData(event);
    });
  }

  /**
   * Remove the native data event listener
   */
  private removeDataListener(): void {
    if (this.dataSubscription) {
      this.dataSubscription.remove();
      this.dataSubscription = null;
    }
  }

  /**
   * Preserve audio chunk for error recovery
   * Requirement 8.2: Preserve audio data on error
   */
  private preserveChunk(event: AudioDataEvent): void {
    this.preservedChunks.push(event);
    
    // Keep only recent chunks to prevent memory issues
    if (this.preservedChunks.length > this.maxPreservedChunks) {
      this.preservedChunks.shift();
    }
  }

  /**
   * Get preserved chunks for recovery
   */
  getPreservedChunks(): AudioDataEvent[] {
    return [...this.preservedChunks];
  }

  /**
   * Clear preserved chunks
   */
  clearPreservedChunks(): void {
    this.preservedChunks = [];
  }

  // ============================================================================
  // Error Recovery (Requirements 8.1, 8.2, 8.3, 8.4, 8.5)
  // ============================================================================

  /**
   * Attempt to recover from an error
   * Requirement 8.1: Handle errors gracefully
   */
  async attemptRecovery(error: AudioErrorEvent): Promise<RecoveryAction> {
    console.log('[LiveAudioService] Attempting recovery from:', error.code);
    
    // Check if we've exceeded max recovery attempts
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.log('[LiveAudioService] Max recovery attempts reached, falling back');
      this.recoveryAttempts = 0;
      return { type: 'fallback' };
    }
    
    this.recoveryAttempts++;
    
    // Determine recovery action based on error type
    switch (error.code) {
      case 'INIT_FAILED':
      case 'MODULE_NOT_AVAILABLE':
        // Cannot recover from module issues - use fallback
        return { type: 'fallback' };
        
      case 'START_FAILED':
        // Try to restart after a delay
        return { type: 'retry', delay: 500 };
        
      case 'CAPTURE_STOPPED':
        // Audio capture stopped unexpectedly - try to restart
        if (this.recording) {
          return { type: 'retry', delay: 200 };
        }
        return { type: 'fallback' };
        
      case 'PERMISSION_DENIED':
        // Cannot recover from permission issues
        return { type: 'notify-user', message: 'Microphone permission required' };
        
      case 'NETWORK_ERROR':
        // Queue for offline processing
        return { type: 'queue-offline' };
        
      default:
        // Unknown error - try retry first, then fallback
        if (this.recoveryAttempts < 2) {
          return { type: 'retry', delay: 300 };
        }
        return { type: 'fallback' };
    }
  }

  /**
   * Execute a recovery action
   * Requirement 8.3: Implement recovery strategies
   */
  async executeRecovery(action: RecoveryAction): Promise<boolean> {
    switch (action.type) {
      case 'retry':
        await new Promise(resolve => setTimeout(resolve, action.delay));
        try {
          await this.start();
          this.recoveryAttempts = 0; // Reset on successful recovery
          return true;
        } catch {
          return false;
        }
        
      case 'fallback':
        // Signal that fallback mode should be used
        this.recoveryAttempts = 0;
        return false;
        
      case 'queue-offline':
        // Preserve data for later upload
        console.log('[LiveAudioService] Queuing for offline processing');
        return false;
        
      case 'notify-user':
        // Error requires user action
        console.log('[LiveAudioService] User notification required:', action.message);
        return false;
        
      default:
        return false;
    }
  }

  /**
   * Preserve audio data for recovery
   * Requirement 8.2: Preserve audio data on error
   */
  async preserveAudioData(): Promise<string | null> {
    if (this.preservedChunks.length === 0) {
      return null;
    }
    
    try {
      // Combine all preserved chunks into a single data blob
      const combinedData = this.preservedChunks
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
        .map(chunk => chunk.data)
        .join('');
      
      // Generate a unique ID for this preserved data
      const preservedId = `preserved-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      console.log(`[LiveAudioService] Preserved ${this.preservedChunks.length} chunks as ${preservedId}`);
      
      // In a real implementation, this would save to AsyncStorage or file system
      // For now, we return the ID for tracking
      return preservedId;
    } catch (error) {
      console.error('[LiveAudioService] Failed to preserve audio data:', error);
      return null;
    }
  }

  /**
   * Reset recovery state
   */
  resetRecoveryState(): void {
    this.recoveryAttempts = 0;
    this.preservedChunks = [];
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Register callback for audio data events
   * Requirement 2.1: Provide data events
   */
  onData(callback: DataCallback): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      this.dataCallbacks = this.dataCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register callback for error events
   * Requirement 8.1: Handle errors gracefully
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyData(event: AudioDataEvent): void {
    this.dataCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error('[LiveAudioService] Data callback error:', error);
      }
    });
  }

  private notifyError(error: AudioErrorEvent): void {
    this.errorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (err) {
        console.error('[LiveAudioService] Error callback error:', err);
      }
    });
  }

  // ============================================================================
  // State Accessors
  // ============================================================================

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Get current configuration
   */
  getConfig(): LiveAudioConfig {
    return { ...this.config };
  }

  /**
   * Get current sequence number
   */
  getCurrentSequenceNumber(): number {
    return this.sequenceNumber;
  }

  /**
   * Get recording duration in milliseconds
   */
  getDuration(): number {
    if (!this.recording) return 0;
    return Date.now() - this.startTimestamp;
  }
}

// Export singleton instance
export const liveAudioService = new LiveAudioService();
export default liveAudioService;
