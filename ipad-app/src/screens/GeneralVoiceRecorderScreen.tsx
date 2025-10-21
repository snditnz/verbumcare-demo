/**
 * General Voice Recorder Screen
 *
 * "Tell me anything" - Like Siri for the EHR
 * General purpose voice recording for any clinical documentation
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, VoiceRecorder } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';

const logoMark = require('../../VerbumCare-Logo-Mark.png');

type RootStackParamList = {
  Dashboard: undefined;
  GeneralVoiceRecorder: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GeneralVoiceRecorder'>;
};

export default function GeneralVoiceRecorderScreen({ navigation }: Props) {
  const { language } = useAssessmentStore();
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const t = translations[language];

  const handleRecordingComplete = (uri: string) => {
    setRecordingUri(uri);
    console.log('[GeneralVoiceRecorder] Recording saved:', uri);
    // TODO: Process recording with AI when backend is ready
  };

  const handleCancel = () => {
    navigation.navigate('Dashboard' as any);
  };

  const handleSave = async () => {
    if (!recordingUri) return;

    setIsProcessing(true);
    try {
      // TODO: Upload and process recording
      console.log('[GeneralVoiceRecorder] Processing recording:', recordingUri);

      // For now, just go back to dashboard
      navigation.navigate('Dashboard' as any);
    } catch (error) {
      console.error('[GeneralVoiceRecorder] Error processing:', error);
    } finally {
      setIsProcessing(false);
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
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
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
        {recordingUri && (
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

        {/* Future Features Note */}
        <View style={styles.futureNote}>
          <Ionicons name="information-circle-outline" size={ICON_SIZES.sm} color={COLORS.text.secondary} />
          <Text style={styles.futureNoteText}>
            {language === 'ja'
              ? '今後、AIが音声を自動的に文字起こしし、構造化データに変換します。'
              : 'In the future, AI will automatically transcribe and structure your recording.'}
          </Text>
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
  futureNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
  },
  futureNoteText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
});
