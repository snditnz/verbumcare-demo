/**
 * General Voice Recorder Screen
 *
 * "Tell me anything" - Like Siri for the EHR
 * General purpose voice recording for any clinical documentation
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useAuthStore } from '@stores/authStore';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { LanguageToggle, VoiceRecorder } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { voiceService } from '@services/voice';
import { voiceReviewService } from '@services/voiceReviewService';
import { navigateToOrigin, getCurrentNavigationContext, clearNavigationContext } from '@utils/navigationContext';

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
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [context, setContext] = useState<{ type: 'patient' | 'global'; patientName?: string } | null>(null);
  const t = translations[language];

  // Detect and set context on mount
  useEffect(() => {
    console.log('[GeneralVoiceRecorder] === Context Detection Start ===');
    console.log('[GeneralVoiceRecorder] currentPatient:', currentPatient?.patient_id, currentPatient?.family_name);
    
    // Check if we have preserved navigation context (from patient screen) FIRST
    const navigationContext = getCurrentNavigationContext();
    console.log('[GeneralVoiceRecorder] navigationContext:', navigationContext);
    
    let detectedContext;
    
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
      patientName: detectedContext.patientName
    });
    
    console.log('[GeneralVoiceRecorder] === Context Detection Complete ===');
  }, [currentPatient]);

  const handleRecordingComplete = (uri: string, duration: number) => {
    setRecordingUri(uri);
    setRecordingDuration(duration);
    console.log('[GeneralVoiceRecorder] Recording saved:', uri, 'Duration:', duration, 'ms');
  };

  const handleCancel = () => {
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

        {/* Voice Recorder - Main Focus */}
        <View style={styles.recorderContainer}>
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDuration={300}
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
  // Recorder - Main focus
  recorderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
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
