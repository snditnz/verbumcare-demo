/**
 * General Voice Recorder Screen
 *
 * "Tell me anything" - Like Siri for the EHR
 * General purpose voice recording for any clinical documentation
 * 
 * Supports both streaming (real-time transcription) and upload (batch) workflows.
 * Implements offline-first architecture with graceful degradation.
 * 
 * Task 8.1: Integrated new recording flow with RecordingModeSelector
 * Requirements: 3.1, 3.2, 6.1, 6.3
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useAuthStore } from '@stores/authStore';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { useSettingsStore } from '@stores/settingsStore';
import { LanguageToggle, VoiceRecorder } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import ProgressiveTranscript, { TranscriptSegment } from '@components/ProgressiveTranscript';
import { Button } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { voiceService } from '@services/voice';
import { voiceReviewService } from '@services/voiceReviewService';
import { audioStreamerService, ConnectionStatus, TranscriptionUpdate } from '@services/audioStreamerService';
import { offlineQueueService } from '@services/offlineQueueService';
import { networkService } from '@services/networkService';
import { recordingModeSelector, RecordingMode } from '@services/recordingModeSelector';
import { useStreamingNavigationGuard } from '@hooks';
import { navigateToOrigin, getCurrentNavigationContext } from '@utils/navigationContext';

type RootStackParamList = {
  Dashboard: undefined;
  GeneralVoiceRecorder: undefined;
  PatientInfo: { patientId: string; patientName: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GeneralVoiceRecorder'>;
};

export default function GeneralVoiceRecorderScreen({ navigation }: Props) {
  const { language, currentPatient } = useAssessmentStore();
  const { currentUser } = useAuthStore();
  const { loadQueue } = useVoiceReviewStore();
  const { preferences, updatePreferences } = useSettingsStore();
  
  // Recording state
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [context, setContext] = useState<{ type: 'patient' | 'global'; patientId?: string; patientName?: string } | null>(null);
  
  // Recording mode state (Task 8.1 - RecordingModeSelector integration)
  const [currentRecordingMode, setCurrentRecordingMode] = useState<RecordingMode>('fallback-upload');
  const [isStreamingEnabled, setIsStreamingEnabled] = useState(preferences.enableStreamingTranscription);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  
  // Offline queue state (Task 10.2)
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Refs for cleanup
  const unsubscribeRefs = useRef<(() => void)[]>([]);
  const segmentIdCounter = useRef(0);
  
  const t = translations[language];

  // Sync streaming preference with persisted settings (Task 11.2)
  useEffect(() => {
    setIsStreamingEnabled(preferences.enableStreamingTranscription);
  }, [preferences.enableStreamingTranscription]);

  // Handle streaming toggle change - persist to settings (Task 11.2)
  const handleStreamingToggle = useCallback(async (enabled: boolean) => {
    setIsStreamingEnabled(enabled);
    
    // Persist the preference
    try {
      await updatePreferences({ enableStreamingTranscription: enabled });
    } catch (error) {
      console.error('[GeneralVoiceRecorder] Failed to persist streaming preference:', error);
    }
  }, [updatePreferences]);

  // Handle recording mode changes from VoiceRecorder (Task 8.1)
  const handleModeChange = useCallback((mode: RecordingMode) => {
    console.log('[GeneralVoiceRecorder] Recording mode changed:', mode);
    setCurrentRecordingMode(mode);
    
    // Update offline mode based on selected mode
    setIsOfflineMode(mode === 'offline-queue');
  }, []);

  // Handle transcription updates from VoiceRecorder (Task 8.1)
  const handleTranscriptionUpdate = useCallback((update: TranscriptionUpdate) => {
    setTranscriptSegments(prev => {
      // If this is a final segment or new segment, add it
      if (update.isFinal || !update.segmentId) {
        const newSegment: TranscriptSegment = {
          id: update.segmentId || `segment-${++segmentIdCounter.current}`,
          text: update.text,
          confidence: update.confidence,
          isFinal: update.isFinal,
          isUncertain: update.confidence < 0.7,
          timestamp: Date.now(),
        };
        
        // Check if we're updating an existing segment
        const existingIndex = prev.findIndex(s => s.id === update.segmentId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newSegment;
          return updated;
        }
        
        return [...prev, newSegment];
      }
      
      // Update existing non-final segment
      const existingIndex = prev.findIndex(s => s.id === update.segmentId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          text: update.text,
          confidence: update.confidence,
          isUncertain: update.confidence < 0.7,
        };
        return updated;
      }
      
      return prev;
    });
  }, []);

  // Navigation guard for active recording sessions (Requirement 8.5)
  useStreamingNavigationGuard({
    enabled: isRecordingActive,
    title: language === 'ja' ? '録音中です' : 'Recording in Progress',
    message: language === 'ja' 
      ? '録音を中断してこの画面を離れますか？録音データは保存されます。'
      : 'Stop recording and leave this screen? Your recording will be saved.',
    cancelText: language === 'ja' ? 'キャンセル' : 'Cancel',
    confirmText: language === 'ja' ? '離れる' : 'Leave',
    onConfirmNavigation: () => {
      // Recording will be stopped by VoiceRecorder component
      setIsRecordingActive(false);
    },
  });

  // Detect and set context on mount
  useEffect(() => {
    console.log('[GeneralVoiceRecorder] === Context Detection Start ===');
    console.log('[GeneralVoiceRecorder] currentPatient:', currentPatient?.patient_id, currentPatient?.family_name);
    
    // Check if we have preserved navigation context (from patient screen) FIRST
    const navigationContext = getCurrentNavigationContext();
    console.log('[GeneralVoiceRecorder] navigationContext:', navigationContext);
    
    let detectedContext: { type: 'patient' | 'global'; patientId?: string; patientName?: string };
    
    // Check if navigation context is recent (within last 10 seconds)
    const isNavigationContextRecent = navigationContext && 
      (Date.now() - navigationContext.timestamp) < 10000;
    
    if (navigationContext && navigationContext.patientContext && isNavigationContextRecent) {
      // Use navigation context if available and recent (more reliable)
      console.log('[GeneralVoiceRecorder] ✅ Using RECENT navigation context for patient:', navigationContext.patientContext.patientName);
      detectedContext = {
        type: 'patient' as const,
        patientId: navigationContext.patientContext.patientId,
        patientName: navigationContext.patientContext.patientName,
      };
    } else if (navigationContext && !navigationContext.patientContext && isNavigationContextRecent) {
      // Navigation context exists but has no patient context (came from Dashboard)
      console.log('[GeneralVoiceRecorder] ✅ Using RECENT navigation context for global (from Dashboard)');
      detectedContext = voiceService.detectContext(undefined);
    } else if (currentPatient) {
      // Fallback to current patient detection only if we have a current patient
      console.log('[GeneralVoiceRecorder] ⚠️ Using currentPatient fallback (stale/no navigation context):', currentPatient.family_name);
      detectedContext = voiceService.detectContext(currentPatient);
    } else {
      // Global context - no patient
      console.log('[GeneralVoiceRecorder] ✅ Using global context (no patient, no navigation context)');
      detectedContext = voiceService.detectContext(undefined);
    }
    
    console.log('[GeneralVoiceRecorder] detectedContext:', detectedContext);
    
    voiceService.setContext(detectedContext);
    
    setContext({
      type: detectedContext.type,
      patientId: detectedContext.patientId,
      patientName: detectedContext.patientName
    });
    
    console.log('[GeneralVoiceRecorder] === Context Detection Complete ===');
  }, [currentPatient]);

  // Initialize connection status listener (Task 8.1)
  useEffect(() => {
    // Subscribe to connection status changes
    const unsubConnection = audioStreamerService.onConnectionStatusChange((status) => {
      console.log('[GeneralVoiceRecorder] Connection status:', status);
      setConnectionStatus(status);
    });
    unsubscribeRefs.current.push(unsubConnection);

    // Subscribe to errors (silent handling per Requirement 5.10)
    const unsubError = audioStreamerService.onError((error) => {
      console.log('[GeneralVoiceRecorder] Streaming error (silent):', error.code, error.message);
      // Don't show error dialogs - just log and continue
      // VoiceRecorder handles fallback automatically
    });
    unsubscribeRefs.current.push(unsubError);

    // Check initial network status
    setIsOfflineMode(!networkService.isConnected());

    // Cleanup on unmount
    return () => {
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
      
      // Disconnect streaming if active
      if (audioStreamerService.getIsStreaming()) {
        audioStreamerService.disconnect();
      }
    };
  }, []);

  // Load offline queue count (Task 10.2)
  useEffect(() => {
    const loadQueueCount = async () => {
      const count = await offlineQueueService.getPendingCount();
      setPendingQueueCount(count);
    };
    
    loadQueueCount();
    
    // Subscribe to queue changes
    const unsubQueue = offlineQueueService.onQueueChange((queue) => {
      setPendingQueueCount(queue.filter(r => r.status === 'pending').length);
    });
    
    return () => unsubQueue();
  }, []);

  // Handle transcription updates from streaming (moved to handleTranscriptionUpdate callback above)

  // Handle recording start (Task 8.1 - VoiceRecorder now handles mode selection)
  const handleRecordingStart = useCallback(() => {
    console.log('[GeneralVoiceRecorder] Recording started');
    setIsRecordingActive(true);
    setTranscriptSegments([]); // Clear previous transcript
    
    // Get the recommended mode for logging
    const modeResult = recordingModeSelector.getRecommendedMode();
    console.log('[GeneralVoiceRecorder] Recommended mode:', modeResult.mode, '-', modeResult.reason);
  }, []);

  // Process offline queue manually (Task 10.2)
  const handleProcessQueue = useCallback(async () => {
    if (pendingQueueCount === 0) return;
    
    setProcessingStatus(language === 'ja' ? 'キューを処理中...' : 'Processing queue...');
    
    try {
      const results = await offlineQueueService.processQueue();
      const successCount = results.filter(r => r.success).length;
      
      setProcessingStatus(
        language === 'ja' 
          ? `${successCount}/${results.length}件を処理しました` 
          : `Processed ${successCount}/${results.length} recordings`
      );
      
      // Refresh review queue
      if (currentUser?.userId) {
        await loadQueue(currentUser.userId);
      }
      
      setTimeout(() => setProcessingStatus(''), 3000);
    } catch (error: any) {
      console.error('[GeneralVoiceRecorder] Queue processing error:', error);
      setProcessingStatus('');
    }
  }, [pendingQueueCount, language, currentUser, loadQueue]);

  const handleRecordingComplete = async (uri: string, duration: number) => {
    setRecordingUri(uri);
    setRecordingDuration(duration);
    setIsRecordingActive(false);
    console.log('[GeneralVoiceRecorder] Recording saved:', uri, 'Duration:', duration, 'ms', 'Mode:', currentRecordingMode);
  };

  const handleCancel = async () => {
    // Recording cleanup is handled by VoiceRecorder component
    setIsRecordingActive(false);
    
    // Disconnect from streaming service
    audioStreamerService.disconnect();
    
    voiceService.clearContext();
    
    // Get the current navigation context to see where we came from
    const navigationContext = getCurrentNavigationContext();
    
    if (navigationContext) {
      console.log('[GeneralVoiceRecorder] Navigating back to preserved context:', {
        originScreen: navigationContext.originScreen,
        hasPatientContext: !!navigationContext.patientContext,
        patientName: navigationContext.patientContext?.patientName,
      });
      
      // Navigate back to the preserved origin
      navigateToOrigin(navigation, 'Dashboard');
    } else {
      console.log('[GeneralVoiceRecorder] No navigation context found, checking current patient context');
      
      // Fallback: if we have a current patient, try to go to PatientInfo
      if (currentPatient) {
        console.log('[GeneralVoiceRecorder] Navigating to PatientInfo for current patient:', currentPatient.family_name);
        navigation.navigate('PatientInfo', { 
          patientId: currentPatient.patient_id,
          patientName: `${currentPatient.family_name} ${currentPatient.given_name}`.trim()
        });
      } else {
        console.log('[GeneralVoiceRecorder] No patient context, navigating to Dashboard');
        navigation.navigate('Dashboard');
      }
    }
  };

  const handleSave = async () => {
    if (!recordingUri) return;

    setIsProcessing(true);
    
    // Check if we're offline - if so, add to queue instead of uploading
    if (isOfflineMode || !networkService.isConnected()) {
      setProcessingStatus(language === 'ja' ? 'オフラインキューに保存中...' : 'Saving to offline queue...');
      
      try {
        await offlineQueueService.addToQueue({
          audioUri: recordingUri,
          duration: recordingDuration,
          recordedAt: new Date(),
          patientId: context?.patientId,
          contextType: context?.type || 'global',
          language: language,
          userId: currentUser?.userId || 'unknown',
        });
        
        setProcessingStatus(language === 'ja' ? '保存しました！オンライン時に処理されます' : 'Saved! Will process when online');
        
        // Update queue count
        const count = await offlineQueueService.getPendingCount();
        setPendingQueueCount(count);
        
        setTimeout(() => {
          voiceService.clearContext();
          audioStreamerService.disconnect();
          
          const navigationContext = getCurrentNavigationContext();
          if (navigationContext) {
            navigateToOrigin(navigation, 'Dashboard');
          } else if (currentPatient) {
            navigation.navigate('PatientInfo', { 
              patientId: currentPatient.patient_id,
              patientName: `${currentPatient.family_name} ${currentPatient.given_name}`.trim()
            });
          } else {
            navigation.navigate('Dashboard');
          }
        }, 2000);
        
        return;
      } catch (error: any) {
        console.error('[GeneralVoiceRecorder] Error saving to offline queue:', error);
        setProcessingStatus(language === 'ja' ? `エラー: ${error.message}` : `Error: ${error.message}`);
        setTimeout(() => {
          setIsProcessing(false);
          setProcessingStatus('');
        }, 3000);
        return;
      }
    }
    
    // Online mode - upload directly
    setProcessingStatus(language === 'ja' ? 'アップロード中...' : 'Uploading...');
    
    try {
      console.log('[GeneralVoiceRecorder] Uploading recording:', recordingUri);
      
      // Get current context
      const currentContext = voiceService.getCurrentContext();
      
      // Upload recording with context and duration
      const uploadResult = await voiceReviewService.uploadRecording(recordingUri, currentContext, recordingDuration);
      
      console.log('[GeneralVoiceRecorder] Upload successful:', uploadResult.recording_id);
      
      // Trigger categorization
      setProcessingStatus(language === 'ja' ? 'AI処理中...' : 'Processing with AI...');
      await voiceReviewService.triggerCategorization(uploadResult.recording_id);
      
      console.log('[GeneralVoiceRecorder] Categorization triggered');
      
      // Show success message and wait longer for user to see it
      setProcessingStatus(language === 'ja' ? '完了！レビューキューを確認してください' : 'Complete! Check review queue');
      
      // Refresh the review queue immediately
      if (currentUser?.userId) {
        await loadQueue(currentUser.userId);
      }
      
      // Wait longer before navigation to let user see the success message
      setTimeout(() => {
        // Clear context
        voiceService.clearContext();
        audioStreamerService.disconnect();
        
        // Navigate back using improved context preservation
        const navigationContext = getCurrentNavigationContext();
        
        if (navigationContext) {
          console.log('[GeneralVoiceRecorder] Save complete, navigating back to preserved context:', {
            originScreen: navigationContext.originScreen,
            hasPatientContext: !!navigationContext.patientContext,
          });
          navigateToOrigin(navigation, 'Dashboard');
        } else if (currentPatient) {
          console.log('[GeneralVoiceRecorder] Save complete, navigating to PatientInfo for current patient');
          navigation.navigate('PatientInfo', { 
            patientId: currentPatient.patient_id,
            patientName: `${currentPatient.family_name} ${currentPatient.given_name}`.trim()
          });
        } else {
          console.log('[GeneralVoiceRecorder] Save complete, navigating to Dashboard');
          navigation.navigate('Dashboard');
        }
      }, 3000); // Increased from 1.5s to 3s
      
    } catch (error: any) {
      console.error('[GeneralVoiceRecorder] Error processing:', error);
      
      // Show more user-friendly error messages
      let errorMessage = error.message;
      if (errorMessage.includes('Whisper service error')) {
        errorMessage = language === 'ja' 
          ? '音声の処理に失敗しました。もう一度お試しください。'
          : 'Voice processing failed. Please try again.';
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        errorMessage = language === 'ja'
          ? 'ネットワークエラーです。接続を確認してください。'
          : 'Network error. Please check your connection.';
      }
      
      setProcessingStatus(language === 'ja' ? `エラー: ${errorMessage}` : `Error: ${errorMessage}`);
      
      // Clear error after longer delay and reset form
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
        setRecordingUri(null); // Reset to allow re-recording
      }, 5000); // Increased from 3s to 5s
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Compact Header */}
      <View style={styles.header}>
        <Button variant="text" onPress={handleCancel} style={styles.backButton}>
          <Text style={styles.backButtonText}>{`← ${t['common.back']}`}</Text>
        </Button>
        <Text style={styles.title}>
          {language === 'ja' ? '音声記録' : 'Voice Recording'}
        </Text>
        <View style={styles.headerRight}>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>
      </View>

      {/* Main Content - Single Column */}
      <View style={styles.content}>
        {/* Context - Inline */}
        {context && (
          <View style={styles.contextRow}>
            <Ionicons 
              name={context.type === 'patient' ? 'person' : 'globe'} 
              size={ICON_SIZES.sm} 
              color={context.type === 'patient' ? COLORS.primary : COLORS.accent} 
            />
            <Text style={styles.contextText}>
              {context.type === 'patient' 
                ? (context.patientName || (language === 'ja' ? '患者' : 'Patient'))
                : (language === 'ja' ? 'グローバル記録' : 'Global Note')
              }
            </Text>
          </View>
        )}

        {/* Offline Mode Indicator (Task 10.2) - Not error-styled per requirements */}
        {isOfflineMode && (
          <View style={styles.offlineIndicator}>
            <Ionicons name="cloud-offline-outline" size={ICON_SIZES.sm} color={COLORS.text.secondary} />
            <Text style={styles.offlineText}>
              {language === 'ja' ? 'ローカル録音中' : 'Recording locally'}
            </Text>
            {pendingQueueCount > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{pendingQueueCount}</Text>
              </View>
            )}
          </View>
        )}

        {/* Streaming Mode Toggle (Task 8.1) */}
        {!isRecordingActive && !recordingUri && (
          <View style={styles.streamingToggleRow}>
            <Text style={styles.streamingToggleLabel}>
              {language === 'ja' ? 'リアルタイム文字起こし' : 'Real-time transcription'}
            </Text>
            <Switch
              value={isStreamingEnabled}
              onValueChange={handleStreamingToggle}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
              thumbColor={isStreamingEnabled ? COLORS.primary : COLORS.text.secondary}
            />
          </View>
        )}

        {/* Recording Mode Indicator (Task 8.1) */}
        {isRecordingActive && (
          <View style={styles.modeIndicator}>
            <View style={[
              styles.modeIndicatorDot,
              { backgroundColor: currentRecordingMode === 'live-streaming' ? COLORS.success : COLORS.primary }
            ]} />
            <Text style={styles.modeIndicatorText}>
              {currentRecordingMode === 'live-streaming' 
                ? (language === 'ja' ? 'ストリーミング中' : 'Streaming')
                : currentRecordingMode === 'offline-queue'
                  ? (language === 'ja' ? 'オフライン録音' : 'Offline Recording')
                  : (language === 'ja' ? '録音中' : 'Recording')}
            </Text>
            {currentRecordingMode === 'live-streaming' && (
              <Text style={[
                styles.connectionStatusText,
                { color: connectionStatus === 'connected' ? COLORS.success : COLORS.warning }
              ]}>
                {connectionStatus === 'connected' ? '● Connected' : 
                 connectionStatus === 'connecting' ? '○ Connecting...' : '○ Disconnected'}
              </Text>
            )}
          </View>
        )}

        {/* Progressive Transcript (Task 8.1) - Show when streaming is active or has segments */}
        {isStreamingEnabled && currentRecordingMode === 'live-streaming' && (isRecordingActive || transcriptSegments.length > 0) && (
          <View style={styles.transcriptContainer}>
            <ProgressiveTranscript
              segments={transcriptSegments}
              isStreaming={isRecordingActive}
              showConfidence={true}
              autoScroll={true}
              language={language}
            />
          </View>
        )}

        {/* Voice Recorder - Main Focus (Task 8.1) */}
        <View style={[
          styles.recorderContainer,
          (isStreamingEnabled && currentRecordingMode === 'live-streaming' && (isRecordingActive || transcriptSegments.length > 0)) && styles.recorderContainerCompact
        ]}>
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onRecordingStart={handleRecordingStart}
            onTranscriptionUpdate={handleTranscriptionUpdate}
            onModeChange={handleModeChange}
            maxDuration={600000}
            patientId={context?.patientId}
            contextType={context?.type || 'global'}
          />
        </View>

        {/* Status - Inline */}
        {recordingUri && !isProcessing && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.success} />
            <Text style={styles.statusText}>
              {language === 'ja' ? '録音完了 - 保存してください' : 'Recording Complete - Tap Save'}
            </Text>
          </View>
        )}

        {/* Processing - Inline */}
        {isProcessing && (
          <View style={styles.statusRow}>
            <Text style={styles.processingText}>{processingStatus}</Text>
          </View>
        )}

        {/* Offline Queue Processing Button (Task 10.2) */}
        {pendingQueueCount > 0 && !isOfflineMode && !isProcessing && (
          <Button
            variant="outline"
            onPress={handleProcessQueue}
            style={styles.queueButton}
          >
            <View style={styles.queueButtonContent}>
              <Ionicons name="cloud-upload-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
              <Text style={styles.queueButtonText}>
                {language === 'ja' 
                  ? `${pendingQueueCount}件の録音をアップロード` 
                  : `Upload ${pendingQueueCount} recording${pendingQueueCount > 1 ? 's' : ''}`}
              </Text>
            </View>
          </Button>
        )}

        {/* Instructions - Minimal */}
        <Text style={styles.instructions}>
          {language === 'ja'
            ? 'マイクボタンをタップして録音開始。患者情報やケア内容を話してください。'
            : 'Tap the mic to start recording. Speak about patient info or care details.'}
        </Text>
      </View>

      {/* Fixed Bottom Actions */}
      <View style={styles.actions}>
        <Button
          variant="outline"
          onPress={handleCancel}
          style={styles.actionButton}
        >
          {t['common.cancel']}
        </Button>
        <Button
          variant="primary"
          onPress={handleSave}
          disabled={!recordingUri || isProcessing}
          loading={isProcessing}
          style={styles.actionButton}
        >
          {language === 'ja' ? '保存' : 'Save'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    height: 60, // Compact header
  },
  backButton: {
    paddingHorizontal: 0,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    justifyContent: 'space-between',
  },
  // Context - Single line
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  contextText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  // Offline indicator (Task 10.2) - Not error-styled
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.text.secondary,
  },
  offlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    flex: 1,
  },
  queueBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  queueBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  // Mode indicator (Task 8.1)
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
  },
  modeIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modeIndicatorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  connectionStatusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.sm,
  },
  // Streaming toggle (Task 10.3)
  streamingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
  },
  streamingToggleLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
  },
  // Progressive transcript container (Task 10.1)
  transcriptContainer: {
    flex: 1,
    maxHeight: 200,
    marginVertical: SPACING.sm,
  },
  // Recorder - Main focus
  recorderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  recorderContainerCompact: {
    flex: 0,
    paddingVertical: SPACING.md,
  },
  // Status - Single line
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: `${COLORS.success}10`,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
    flex: 1,
  },
  processingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    textAlign: 'center',
    flex: 1,
  },
  // Queue processing button (Task 10.2)
  queueButton: {
    marginVertical: SPACING.sm,
  },
  queueButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  queueButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
  },
  // Instructions - Minimal
  instructions: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  // Actions - Fixed bottom
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
});
