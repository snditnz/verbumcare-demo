import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { WorkflowProgress, LanguageToggle, VoiceRecorder } from '@components';
import { apiService } from '@services';
import { translations } from '@constants/translations';
import { UI_COLORS } from '@constants/config';
import { DEMO_STAFF_ID } from '@constants/config';

type RootStackParamList = {
  ADLVoice: undefined;
  IncidentReport: undefined;
  ReviewConfirm: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ADLVoice'>;
};

export default function ADLVoiceScreen({ navigation }: Props) {
  const { currentPatient, setADLRecordingId, setCurrentStep, language } = useAssessmentStore();
  const [isUploading, setIsUploading] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('adl-voice');
  }, []);

  const handleRecordingComplete = async (uri: string, duration: number) => {
    setRecordingUri(uri);

    Alert.alert(
      t['voice.uploadConfirm'],
      t['voice.uploadConfirmMessage'],
      [
        {
          text: t['common.cancel'],
          style: 'cancel',
        },
        {
          text: t['voice.upload'],
          onPress: () => uploadRecording(uri),
        },
      ]
    );
  };

  const uploadRecording = async (uri: string) => {
    if (!currentPatient) {
      Alert.alert(t['common.error'], t['voice.noPatient']);
      return;
    }

    try {
      setIsUploading(true);

      // Upload voice recording
      const uploadResponse = await apiService.uploadVoiceRecording(
        uri,
        currentPatient.patient_id,
        DEMO_STAFF_ID
      );

      setADLRecordingId(uploadResponse.recording_id);

      // Trigger async processing
      await apiService.processVoiceRecording(uploadResponse.recording_id);

      Alert.alert(
        t['voice.uploadSuccess'],
        t['voice.processingStarted'],
        [
          {
            text: t['common.ok'],
            onPress: () => navigation.navigate('ReviewConfirm'),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to upload recording:', error);
      Alert.alert(
        t['common.error'],
        t['voice.uploadFailed'],
        [
          {
            text: t['common.retry'],
            onPress: () => uploadRecording(uri),
          },
          {
            text: t['common.cancel'],
            style: 'cancel',
          },
        ]
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      t['voice.skipWarning'],
      t['voice.skipWarningMessage'],
      [
        {
          text: t['common.cancel'],
          style: 'cancel',
        },
        {
          text: t['common.skip'],
          onPress: () => navigation.navigate('ReviewConfirm'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <WorkflowProgress />
        <LanguageToggle />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t['voice.title']}</Text>
        <Text style={styles.subtitle}>{t['voice.instruction']}</Text>

        <View style={styles.recorderContainer}>
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDuration={120000}
          />
        </View>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>{t['voice.tips']}</Text>
          <Text style={styles.tipText}>• {t['voice.tip1']}</Text>
          <Text style={styles.tipText}>• {t['voice.tip2']}</Text>
          <Text style={styles.tipText}>• {t['voice.tip3']}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleSkip}
            disabled={isUploading}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              {t['common.skip']}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.border,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
    marginBottom: 24,
  },
  recorderContainer: {
    marginVertical: 32,
  },
  tips: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 'auto',
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: UI_COLORS.primary,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: UI_COLORS.text,
  },
});
