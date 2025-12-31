/**
 * VoiceRecorder Component
 * 
 * Enhanced voice recorder with DUAL-MODE recording for data safety:
 * - ALWAYS records locally using expo-av as backup (NO DATA LOSS)
 * - SIMULTANEOUSLY streams via WebSocket when enabled and connected
 * - Falls back to local recording upload if streaming fails/disconnects
 * 
 * Requirements: 1.2, 1.3, 1.4, 3.1, 3.2, 7.1, 7.2, 7.3
 * CRITICAL: Audio data must NEVER be lost - local backup is always active
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { voiceService } from '@services';
import { liveAudioService, AudioDataEvent } from '../services/liveAudioService';
import { recordingModeSelector, RecordingMode } from '../services/recordingModeSelector';
import { audioStreamerService, ConnectionStatus, TranscriptionUpdate } from '../services/audioStreamerService';
import { UI_COLORS, VOICE_CONFIG } from '@constants/config';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface VoiceRecorderProps {
  onRecordingComplete?: (uri: string, duration: number) => void;
  onRecordingStart?: () => void;
  onTranscriptionUpdate?: (update: TranscriptionUpdate) => void;
  onModeChange?: (mode: RecordingMode) => void;
  maxDuration?: number; // in milliseconds
  patientId?: string;
  contextType?: 'patient' | 'global';
}

type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping';

// ============================================================================
// VoiceRecorder Component
// ============================================================================

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onTranscriptionUpdate,
  onModeChange,
  maxDuration = VOICE_CONFIG.MAX_DURATION,
  patientId,
  contextType = 'global',
}) => {
  const { language } = useAssessmentStore();
  const t = translations[language];

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [currentMode, setCurrentMode] = useState<RecordingMode>('fallback-upload');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  
  // DUAL-MODE: Track if streaming is active (local backup is ALWAYS active when recording)
  const [streamingActive, setStreamingActive] = useState(false);
  const [streamingSucceeded, setStreamingSucceeded] = useState(false);
  
  // Refs for cleanup
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveAudioUnsubscribeRef = useRef<(() => void) | null>(null);
  const connectionUnsubscribeRef = useRef<(() => void) | null>(null);
  const transcriptionUnsubscribeRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // DUAL-MODE: Track local recording URI for fallback
  const localRecordingUriRef = useRef<string | null>(null);

  // Derived state
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'starting' || recordingState === 'stopping';

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Unsubscribe from live audio events
    if (liveAudioUnsubscribeRef.current) {
      liveAudioUnsubscribeRef.current();
      liveAudioUnsubscribeRef.current = null;
    }

    // Unsubscribe from connection status
    if (connectionUnsubscribeRef.current) {
      connectionUnsubscribeRef.current();
      connectionUnsubscribeRef.current = null;
    }

    // Unsubscribe from transcription updates
    if (transcriptionUnsubscribeRef.current) {
      transcriptionUnsubscribeRef.current();
      transcriptionUnsubscribeRef.current = null;
    }
    
    // Reset dual-mode state
    localRecordingUriRef.current = null;
  }, []);

  // ============================================================================
  // Mode Selection (Requirement 3.1, 3.2)
  // ============================================================================

  const selectRecordingMode = useCallback((): RecordingMode => {
    const result = recordingModeSelector.getRecommendedMode();
    console.log('[VoiceRecorder] Selected mode:', result.mode, '-', result.reason);
    return result.mode;
  }, []);

  // ============================================================================
  // DUAL-MODE: Local Recording (expo-av) - ALWAYS runs as backup
  // ============================================================================

  const startLocalRecording = async (): Promise<void> => {
    console.log('[VoiceRecorder] Starting local backup recording (expo-av)');
    await voiceService.startRecording(
      (newDuration) => {
        // Duration is tracked separately, but we can use this for validation
      },
      (uri, recordedDuration) => {
        // Auto-stop callback - save the URI for fallback
        console.log('[VoiceRecorder] Local recording auto-stopped:', uri);
        localRecordingUriRef.current = uri;
      }
    );
  };

  const stopLocalRecording = async (): Promise<string | null> => {
    console.log('[VoiceRecorder] Stopping local backup recording');
    const uri = await voiceService.stopRecording();
    localRecordingUriRef.current = uri;
    return uri;
  };

  // ============================================================================
  // Live Streaming Mode Handlers (runs IN ADDITION to local recording)
  // ============================================================================

  const startLiveStreaming = async (): Promise<boolean> => {
    try {
      console.log('[VoiceRecorder] Attempting to start live streaming...');
      
      // Initialize live audio service
      liveAudioService.init();

      // Connect to streaming server
      const session = await audioStreamerService.connect({
        patientId,
        contextType,
        language,
        userId: 'current-user', // TODO: Get from auth store
      });

      // Set audio source to live
      audioStreamerService.setAudioSource('live');

      // Get initial connection status immediately after connect
      const initialStatus = audioStreamerService.getConnectionStatus();
      console.log('[VoiceRecorder] Initial connection status:', initialStatus);
      setConnectionStatus(initialStatus);

      // Subscribe to connection status changes
      connectionUnsubscribeRef.current = audioStreamerService.onConnectionStatusChange(
        (status) => {
          console.log('[VoiceRecorder] Connection status changed:', status);
          setConnectionStatus(status);
          
          // If we disconnect mid-recording, mark streaming as failed
          // Local recording continues as backup
          if (status === 'disconnected' || status === 'offline') {
            console.log('[VoiceRecorder] Streaming disconnected - local backup continues');
            setStreamingActive(false);
            setStreamingSucceeded(false);
          }
        }
      );

      // Subscribe to transcription updates
      if (onTranscriptionUpdate) {
        console.log('[VoiceRecorder] 🔔 Subscribing to transcription updates');
        transcriptionUnsubscribeRef.current = audioStreamerService.onTranscriptionUpdate(
          (update) => {
            console.log('[VoiceRecorder] 📥 Received transcription update:', update.text?.substring(0, 30));
            onTranscriptionUpdate(update);
          }
        );
      } else {
        console.log('[VoiceRecorder] ⚠️ No onTranscriptionUpdate callback provided');
      }

      // Subscribe to live audio data events
      liveAudioUnsubscribeRef.current = liveAudioService.onData(
        (event: AudioDataEvent) => {
          // Send chunk to streaming service
          audioStreamerService.sendLiveChunk(event);
        }
      );

      // Start streaming session
      await audioStreamerService.startStreaming();

      // Start live audio capture
      await liveAudioService.start();

      console.log('[VoiceRecorder] Live streaming started, session:', session.sessionId);
      
      // Check if we're actually connected (not offline fallback)
      const finalStatus = audioStreamerService.getConnectionStatus();
      const isActuallyConnected = finalStatus === 'connected';
      
      setStreamingActive(isActuallyConnected);
      setStreamingSucceeded(isActuallyConnected);
      setConnectionStatus(finalStatus);
      
      console.log('[VoiceRecorder] Final streaming state - active:', isActuallyConnected, 'status:', finalStatus);
      return isActuallyConnected;
    } catch (error) {
      console.error('[VoiceRecorder] Failed to start live streaming:', error);
      setStreamingActive(false);
      setStreamingSucceeded(false);
      return false;
    }
  };

  const stopLiveStreaming = async (): Promise<{ uri: string; duration: number } | null> => {
    try {
      // Stop live audio capture
      await liveAudioService.stop();

      // Stop streaming and get result
      const result = await audioStreamerService.stopStreaming();

      // Disconnect from server
      audioStreamerService.disconnect();

      // Clean up subscriptions
      if (liveAudioUnsubscribeRef.current) {
        liveAudioUnsubscribeRef.current();
        liveAudioUnsubscribeRef.current = null;
      }

      console.log('[VoiceRecorder] Live streaming stopped');
      setStreamingActive(false);

      return {
        uri: result.audioUri || '',
        duration: result.duration,
      };
    } catch (error) {
      console.error('[VoiceRecorder] Failed to stop live streaming:', error);
      setStreamingActive(false);
      return null;
    }
  };

  // ============================================================================
  // Fallback Mode Handlers (expo-av only - no streaming)
  // ============================================================================

  const startFallbackRecording = async (): Promise<void> => {
    await voiceService.startRecording(
      (newDuration) => {
        setDuration(newDuration);
      },
      (uri, recordedDuration) => {
        // Auto-stop callback
        setRecordingState('idle');
        setDuration(recordedDuration);
        if (onRecordingComplete) {
          onRecordingComplete(uri, recordedDuration);
        }
      }
    );
  };

  const stopFallbackRecording = async (): Promise<{ uri: string; duration: number }> => {
    const uri = await voiceService.stopRecording();
    return {
      uri: uri || '',
      duration,
    };
  };

  // ============================================================================
  // Main Recording Handlers - DUAL-MODE IMPLEMENTATION
  // ============================================================================

  const handleStart = async () => {
    try {
      setRecordingState('starting');
      setStreamingActive(false);
      setStreamingSucceeded(false);
      localRecordingUriRef.current = null;

      // Check permissions first
      const hasPermission = await voiceService.requestPermissions();
      if (!hasPermission) {
        alert(t['voice.permissionDenied']);
        setRecordingState('idle');
        return;
      }

      // Select recording mode
      const mode = selectRecordingMode();
      setCurrentMode(mode);
      onModeChange?.(mode);

      // DUAL-MODE: For live-streaming mode, we run BOTH local and streaming
      if (mode === 'live-streaming') {
        console.log('[VoiceRecorder] DUAL-MODE: Starting local backup + streaming');
        
        // STEP 1: ALWAYS start local recording first (backup - NEVER loses data)
        await startLocalRecording();
        console.log('[VoiceRecorder] Local backup recording started');
        
        // STEP 2: Attempt to start streaming (non-blocking - if it fails, local continues)
        const streamingStarted = await startLiveStreaming();
        if (!streamingStarted) {
          console.log('[VoiceRecorder] Streaming failed to start - local backup continues');
          // Update mode to show we're in fallback
          setCurrentMode('fallback-upload');
          onModeChange?.('fallback-upload');
        }
      } else {
        // fallback-upload or offline-queue: just use expo-av
        console.log('[VoiceRecorder] Fallback mode: Starting local recording only');
        await startFallbackRecording();
      }

      // Start duration tracking
      startTimeRef.current = Date.now();
      setDuration(0);
      
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          handleStop();
        }
      }, 100); // Update more frequently for smoother display

      setRecordingState('recording');

      // Notify parent
      onRecordingStart?.();

    } catch (error) {
      console.error('[VoiceRecorder] Failed to start recording:', error);
      alert(t['voice.recordingFailed']);
      setRecordingState('idle');
    }
  };

  const handleStop = async () => {
    if (recordingState !== 'recording') return;

    try {
      setRecordingState('stopping');

      // Clear duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      let result: { uri: string; duration: number };
      
      // DUAL-MODE: Handle based on what was running
      if (currentMode === 'live-streaming' || streamingActive) {
        console.log('[VoiceRecorder] DUAL-MODE: Stopping both local and streaming');
        
        // STEP 1: Stop streaming (if it was active)
        let streamingResult: { uri: string; duration: number } | null = null;
        if (streamingActive || streamingSucceeded) {
          streamingResult = await stopLiveStreaming();
        }
        
        // STEP 2: ALWAYS stop local recording (backup)
        const localUri = await stopLocalRecording();
        
        // STEP 3: Decide which result to use
        if (streamingSucceeded && streamingResult && streamingResult.uri) {
          // Streaming worked - use streaming result
          console.log('[VoiceRecorder] Using streaming result');
          result = streamingResult;
        } else {
          // Streaming failed or disconnected - use local backup
          console.log('[VoiceRecorder] Using local backup (streaming failed/disconnected)');
          result = {
            uri: localUri || '',
            duration,
          };
        }
      } else {
        // Pure fallback mode
        result = await stopFallbackRecording();
      }

      setRecordingState('idle');
      setStreamingActive(false);
      setStreamingSucceeded(false);

      // Notify parent with the result (either streaming or local backup)
      if (onRecordingComplete && result.uri) {
        onRecordingComplete(result.uri, result.duration);
      } else if (!result.uri) {
        console.error('[VoiceRecorder] No recording URI available - this should never happen!');
        alert(t['voice.recordingFailed']);
      }

    } catch (error) {
      console.error('[VoiceRecorder] Failed to stop recording:', error);
      
      // EMERGENCY FALLBACK: Try to get local recording even if everything else failed
      try {
        const emergencyUri = await voiceService.stopRecording();
        if (emergencyUri && onRecordingComplete) {
          console.log('[VoiceRecorder] Emergency fallback: using local recording');
          onRecordingComplete(emergencyUri, duration);
        } else {
          alert(t['voice.recordingFailed']);
        }
      } catch (emergencyError) {
        console.error('[VoiceRecorder] Emergency fallback also failed:', emergencyError);
        alert(t['voice.recordingFailed']);
      }
      
      setRecordingState('idle');
      setStreamingActive(false);
      setStreamingSucceeded(false);
    } finally {
      setDuration(0);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (duration / maxDuration) * 100;

  const getModeIndicatorText = (): string => {
    if (streamingActive && connectionStatus === 'connected') {
      return t['voice.streaming'] || 'Streaming';
    }
    if (currentMode === 'live-streaming' && !streamingActive) {
      // Streaming was attempted but failed - show we're using backup
      return t['voice.recording'] || 'Recording (Backup)';
    }
    return t['voice.recording'] || 'Recording';
  };

  const getModeIndicatorColor = (): string => {
    if (streamingActive && connectionStatus === 'connected') {
      return UI_COLORS.successLight;
    }
    if (streamingActive && connectionStatus === 'connecting') {
      return UI_COLORS.warning;
    }
    // Local recording is always active - show success
    return UI_COLORS.successLight;
  };

  const getConnectionStatusText = (): string => {
    if (streamingActive) {
      if (connectionStatus === 'connected') return '● Streaming + Backup';
      if (connectionStatus === 'connecting') return '○ Connecting... (Backup Active)';
      if (connectionStatus === 'offline') return '○ Offline (Backup Active)';
      return '○ Disconnected (Backup Active)';
    }
    // Not streaming - just local recording
    return '● Local Recording';
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <View style={styles.container}>
      {isRecording && (
        <View style={styles.durationContainer}>
          {/* Mode indicator (Requirement 7.1, 7.2) */}
          <View style={styles.recordingIndicator}>
            <View style={[styles.recordingDot, { backgroundColor: getModeIndicatorColor() }]} />
            <Text style={[styles.recordingText, { color: getModeIndicatorColor() }]}>
              {getModeIndicatorText()}
            </Text>
          </View>

          <Text style={styles.duration}>{formatDuration(duration)}</Text>
          <Text style={styles.maxDuration}>/ {formatDuration(maxDuration)}</Text>
        </View>
      )}

      {/* Connection status - always show when recording (Requirement 7.3) */}
      {isRecording && (
        <View style={styles.connectionStatusContainer}>
          <Text style={[
            styles.connectionStatusText,
            { color: streamingActive && connectionStatus === 'connected' ? UI_COLORS.successLight : UI_COLORS.primary }
          ]}>
            {getConnectionStatusText()}
          </Text>
        </View>
      )}

      {isRecording && (
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { 
                width: `${Math.min(progressPercentage, 100)}%`,
                backgroundColor: getModeIndicatorColor(),
              },
            ]}
          />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          isRecording ? styles.buttonStop : styles.buttonStart,
        ]}
        onPress={isRecording ? handleStop : handleStart}
        disabled={isProcessing}
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" size="large" />
        ) : (
          <>
            <View
              style={[
                styles.buttonIcon,
                isRecording ? styles.buttonIconStop : styles.buttonIconStart,
              ]}
            />
            <Text style={styles.buttonText}>
              {isRecording ? t['voice.stop'] : t['voice.start']}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {!isRecording && recordingState === 'idle' && (
        <Text style={styles.hint}>{t['voice.hint']}</Text>
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  duration: {
    fontSize: 24,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  maxDuration: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
  },
  connectionStatusContainer: {
    marginBottom: 8,
  },
  connectionStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: UI_COLORS.border,
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonStart: {
    backgroundColor: UI_COLORS.primary,
  },
  buttonStop: {
    backgroundColor: UI_COLORS.error,
  },
  buttonIcon: {
    borderRadius: 4,
  },
  buttonIconStart: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  buttonIconStop: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default VoiceRecorder;
