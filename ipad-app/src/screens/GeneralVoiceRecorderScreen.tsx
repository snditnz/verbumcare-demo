/**
 * General Voice Recorder Screen
 *
 * "Tell me anything" - Like Siri for the EHR
 * General purpose voice recording for any clinical documentation
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useAuthStore } from '@stores/authStore';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { LanguageToggle, VoiceRecorder, VoiceProcessingNotification } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { voiceService } from '@services/voice';
import { voiceReviewService } from '@services/voiceReviewService';

const logoMark = require('../../VerbumCare-Logo-Mark.png');

type RootStackParamList = {
  Dashboard: undefined;
  GeneralVoiceRecorder: undefined;
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
    const detectedContext = voiceService.detectContext(currentPatient || undefined);
    voiceService.setContext(detectedContext);
    
    setContext({
      type: detectedContext.type,
      patientName: detectedContext.patientName
    });
    
    console.log('[GeneralVoiceRecorder] Context detected:', detectedContext);
  }, [currentPatient]);

  const handleRecordingComplete = (uri: string, duration: number) => {
    setRecordingUri(uri);
    setRecordingDuration(duration);
    console.log('[GeneralVoiceRecorder] Recording saved:', uri, 'Duration:', duration, 'ms');
  };

  const handleCancel = () => {
    voiceService.clearContext();
    navigation.navigate('Dashboard' as any);
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
        
        // Navigate back to dashboard so user can see the updated review queue
        navigation.navigate('Dashboard' as any);
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={handleCancel} style={styles.backButtonContainer}>
            <Text style={styles.backButton}>{`← ${t['common.back']}`}</Text>
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Image source={logoMark} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.screenTitle}>
            {language === 'ja' ? '音声記録' : 'Voice Recording'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Context Indicator */}
        {context && (
          <Card style={styles.contextCard}>
            <View style={styles.contextHeader}>
              <Ionicons 
                name={context.type === 'patient' ? 'person' : 'globe'} 
                size={ICON_SIZES.md} 
                color={context.type === 'patient' ? COLORS.primary : COLORS.accent} 
              />
              <Text style={styles.contextTitle}>
                {context.type === 'patient' 
                  ? (language === 'ja' ? '患者コンテキスト' : 'Patient Context')
                  : (language === 'ja' ? 'グローバルコンテキスト' : 'Global Context')
                }
              </Text>
            </View>
            {context.patientName && (
              <Text style={styles.contextPatientName}>
                {context.patientName}
              </Text>
            )}
            <Text style={styles.contextDescription}>
              {context.type === 'patient'
                ? (language === 'ja' 
                    ? 'この録音は患者に自動的に関連付けられます' 
                    : 'This recording will be automatically linked to the patient')
                : (language === 'ja'
                    ? 'この録音は施設全体の記録として保存されます'
                    : 'This recording will be saved as a facility-wide note')
              }
            </Text>
          </Card>
        )}

        {/* Instructions */}
        <Card style={styles.instructionCard}>
          <View style={styles.instructionHeader}>
            <Ionicons name="mic-circle" size={ICON_SIZES.xl} color={COLORS.error} />
            <Text style={styles.instructionTitle}>
              {language === 'ja' ? '音声で記録' : 'Record by Voice'}
            </Text>
          </View>
          <Text style={styles.instructionText}>
            {language === 'ja'
              ? '以下の録音ボタンをタップして、何でも話してください。患者の状態、観察事項、ケアの詳細など、あなたが記録したいことを自由に話すことができます。'
              : 'Tap the record button below and tell me anything. You can speak freely about patient status, observations, care details, or anything you want to document.'}
          </Text>
          <View style={styles.examplesContainer}>
            <Text style={styles.examplesTitle}>
              {language === 'ja' ? '例：' : 'Examples:'}
            </Text>
            <Text style={styles.exampleItem}>
              • {language === 'ja' ? '患者の状態変化' : 'Patient status changes'}
            </Text>
            <Text style={styles.exampleItem}>
              • {language === 'ja' ? '観察記録' : 'Observation notes'}
            </Text>
            <Text style={styles.exampleItem}>
              • {language === 'ja' ? 'ケア実施内容' : 'Care activities performed'}
            </Text>
            <Text style={styles.exampleItem}>
              • {language === 'ja' ? '申し送り事項' : 'Handoff information'}
            </Text>
          </View>
        </Card>

        {/* Voice Recorder */}
        <Card style={styles.recorderCard}>
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDuration={300} // 5 minutes max
          />
        </Card>

        {/* Status */}
        {recordingUri && !isProcessing && (
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="checkmark-circle" size={ICON_SIZES.md} color={COLORS.success} />
              <Text style={styles.statusText}>
                {language === 'ja' ? '録音完了' : 'Recording Complete'}
              </Text>
            </View>
            <Text style={styles.statusSubtext}>
              {language === 'ja'
                ? '保存ボタンをタップして記録を保存してください。'
                : 'Tap save to store your recording.'}
            </Text>
          </Card>
        )}

        {/* Processing Notification */}
        {isProcessing && (
          <VoiceProcessingNotification
            status={{
              recordingId: 'temp',
              status: processingStatus.includes('完了') || processingStatus.includes('Complete') ? 'completed' : 'processing',
              phase: processingStatus.includes('アップロード') || processingStatus.includes('Uploading') ? 'transcription' : 'extraction',
              message: processingStatus
            }}
            language={language}
            onDismiss={() => {}}
          />
        )}

        {/* Actions */}
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

      </ScrollView>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'space-between',
  },
  headerLeft: {
    // No flex - size to content
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  headerRight: {
    // No flex - size to content
    alignItems: 'flex-end',
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  backButton: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  backButtonContainer: {
    paddingHorizontal: 0,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  contextCard: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  contextTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  contextPatientName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  contextDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  instructionCard: {
    marginBottom: SPACING.lg,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  instructionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  instructionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  examplesContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  examplesTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  exampleItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  recorderCard: {
    marginBottom: SPACING.lg,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  statusCard: {
    marginBottom: SPACING.lg,
    backgroundColor: `${COLORS.success}10`,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.success,
  },
  statusSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  actionButton: {
    flex: 1,
  },
});
