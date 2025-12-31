/**
 * RecordingModeSelector
 * 
 * Determines the best recording mode based on settings, network status,
 * and module availability. Implements graceful degradation.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { liveAudioService } from './liveAudioService';
import { networkService } from './networkService';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RecordingContext {
  streamingEnabled: boolean;       // User preference from settings
  networkAvailable: boolean;       // Current network status
  liveAudioAvailable: boolean;     // Native module available
  backendSupportsStreaming: boolean; // Backend has streaming endpoint
}

export type RecordingMode = 'live-streaming' | 'fallback-upload' | 'offline-queue';

export interface ModeSelectionResult {
  mode: RecordingMode;
  reason: string;
}

// ============================================================================
// RecordingModeSelector Class
// ============================================================================

class RecordingModeSelector {
  /**
   * Select the best recording mode based on current context
   * Requirement 3.1: Determine best recording mode
   */
  selectMode(context: RecordingContext): ModeSelectionResult {
    // Priority 1: If network is unavailable, use offline queue
    // Requirement 3.3: Network-based fallback
    if (!context.networkAvailable) {
      return {
        mode: 'offline-queue',
        reason: 'Network unavailable - queuing for later upload',
      };
    }

    // Priority 2: If streaming is disabled by user, use fallback
    // Requirement 3.4: Respect user settings
    if (!context.streamingEnabled) {
      return {
        mode: 'fallback-upload',
        reason: 'Streaming disabled in settings',
      };
    }

    // Priority 3: If native module is not available, use fallback
    // Requirement 3.2: Check module availability
    if (!context.liveAudioAvailable) {
      return {
        mode: 'fallback-upload',
        reason: 'Live audio module not available',
      };
    }

    // Priority 4: If backend doesn't support streaming, use fallback
    if (!context.backendSupportsStreaming) {
      return {
        mode: 'fallback-upload',
        reason: 'Backend does not support streaming',
      };
    }

    // All conditions met - use live streaming
    return {
      mode: 'live-streaming',
      reason: 'All conditions met for live streaming',
    };
  }

  /**
   * Check if live streaming is available with current system state
   * Convenience method that builds context automatically
   */
  canUseLiveStreaming(): boolean {
    const context = this.buildCurrentContext();
    const result = this.selectMode(context);
    return result.mode === 'live-streaming';
  }

  /**
   * Get the recommended mode with current system state
   * Convenience method that builds context automatically
   */
  getRecommendedMode(): ModeSelectionResult {
    const context = this.buildCurrentContext();
    return this.selectMode(context);
  }

  /**
   * Build recording context from current system state
   */
  buildCurrentContext(overrides?: Partial<RecordingContext>): RecordingContext {
    const streamingEnabled = this.getStreamingEnabledSetting();
    const networkAvailable = networkService.isConnected();
    const liveAudioAvailable = liveAudioService.isAvailable();
    
    const context = {
      streamingEnabled,
      networkAvailable,
      liveAudioAvailable,
      backendSupportsStreaming: true, // Assume backend supports streaming
      ...overrides,
    };
    
    console.log('[RecordingModeSelector] buildCurrentContext:', context);
    
    return context;
  }

  /**
   * Get streaming enabled setting from store
   * Default to TRUE for streaming-first approach (with local backup always active)
   */
  private getStreamingEnabledSetting(): boolean {
    try {
      // Dynamic import to avoid circular dependencies
      const { useSettingsStore } = require('../stores/settingsStore');
      const state = useSettingsStore.getState();
      const enabled = state.preferences?.enableStreamingTranscription;
      
      // Log for debugging
      console.log('[RecordingModeSelector] getStreamingEnabledSetting:', {
        hasPreferences: !!state.preferences,
        enableStreamingTranscription: enabled,
        result: enabled ?? true
      });
      
      // Default to TRUE - streaming is the primary mode, with local backup always active
      return enabled ?? true;
    } catch (error) {
      console.warn('[RecordingModeSelector] Failed to read streaming setting, defaulting to true:', error);
      return true; // Default to streaming enabled
    }
  }

  /**
   * Get progressive transcript setting from store
   * Default to true when streaming is enabled
   */
  getShowProgressiveTranscript(): boolean {
    try {
      const { useSettingsStore } = require('../stores/settingsStore');
      const state = useSettingsStore.getState();
      return state.preferences?.showProgressiveTranscript ?? true;
    } catch {
      return true;
    }
  }

  /**
   * Get human-readable description of a mode
   */
  getModeDescription(mode: RecordingMode): string {
    switch (mode) {
      case 'live-streaming':
        return 'Real-time streaming with progressive transcription';
      case 'fallback-upload':
        return 'Record and upload after completion';
      case 'offline-queue':
        return 'Record locally, upload when online';
    }
  }

  /**
   * Check if a mode supports progressive transcription
   */
  supportsProgressiveTranscription(mode: RecordingMode): boolean {
    return mode === 'live-streaming';
  }

  /**
   * Get the audio service to use for a given mode
   */
  getAudioServiceType(mode: RecordingMode): 'live' | 'expo-av' {
    return mode === 'live-streaming' ? 'live' : 'expo-av';
  }
}

// Export singleton instance
export const recordingModeSelector = new RecordingModeSelector();
export default recordingModeSelector;
