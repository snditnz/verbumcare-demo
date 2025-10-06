import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { WorkflowProgress, LanguageToggle, PatientCard, VitalsDisplay } from '@components';
import { socketService, apiService } from '@services';
import { VoiceProcessingProgress } from '@types/api';
import { translations } from '@constants/translations';
import { UI_COLORS } from '@constants/config';
import { DEMO_STAFF_ID } from '@constants/config';

type RootStackParamList = {
  PatientList: undefined;
  ReviewConfirm: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReviewConfirm'>;
};

export default function ReviewConfirmScreen({ navigation }: Props) {
  const {
    currentPatient,
    vitals,
    adlRecordingId,
    adlProcessedData,
    setADLProcessedData,
    resetAssessment,
    setCurrentStep,
    language,
  } = useAssessmentStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('review-confirm');

    const handleVoiceProgress = (data: VoiceProcessingProgress) => {
      if (data.recording_id === adlRecordingId) {
        setIsProcessing(data.status === 'processing');
        setProcessingPhase(data.phase);
        setProcessingProgress(data.progress || 0);

        if (data.status === 'completed' && data.data) {
          const structuredData = data.data.structured_data?.[language] || data.data.structured_data;
          setADLProcessedData(structuredData);
          setIsProcessing(false);
        }

        if (data.status === 'failed') {
          setIsProcessing(false);
          alert(t['voice.processingFailed']);
        }
      }
    };

    socketService.on('voice-processing-progress', handleVoiceProgress);

    // Check if we're waiting for processing
    if (adlRecordingId && !adlProcessedData) {
      setIsProcessing(true);

      // Fallback: Poll API if Socket.IO doesn't deliver results (after 10 seconds)
      const fallbackTimer = setTimeout(async () => {
        console.log('⚠️  Socket.IO timeout - fetching via API fallback');
        try {
          const response = await apiService.getVoiceStatus(adlRecordingId);
          console.log('📥 API fallback response:', response);
          if (response.status === 'completed' && response.structured_data) {
            const structuredData = response.structured_data[language] || response.structured_data;
            setADLProcessedData(structuredData);
            setIsProcessing(false);
          } else if (response.status === 'processing') {
            // Still processing, poll again in 5 seconds
            setTimeout(async () => {
              try {
                const retryResponse = await apiService.getVoiceStatus(adlRecordingId);
                if (retryResponse.status === 'completed' && retryResponse.structured_data) {
                  const structuredData = retryResponse.structured_data[language] || retryResponse.structured_data;
                  setADLProcessedData(structuredData);
                  setIsProcessing(false);
                }
              } catch (e) {
                console.error('Retry failed:', e);
                setIsProcessing(false);
              }
            }, 5000);
          }
        } catch (error) {
          console.error('Fallback fetch failed:', error);
          setIsProcessing(false);
        }
      }, 10000);

      return () => {
        clearTimeout(fallbackTimer);
        socketService.off('voice-processing-progress', handleVoiceProgress);
      };
    }

    return () => {
      socketService.off('voice-processing-progress', handleVoiceProgress);
    };
  }, [adlRecordingId, language]);

  const handleSubmit = async () => {
    if (!currentPatient) return;

    setIsSubmitting(true);

    try {
      // In a real app, submit the complete assessment here
      // For now, just reset and go back to patient list

      alert(t['review.submitSuccess']);
      resetAssessment();
      navigation.navigate('PatientList');
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      alert(t['review.submitFailed']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPhaseText = (phase: string) => {
    const phaseMap: Record<string, string> = {
      'transcription': t['voice.phaseTranscription'],
      'extraction': t['voice.phaseExtraction'],
      'translation': t['voice.phaseTranslation'],
      'saving': t['voice.phaseSaving'],
      'done': t['voice.phaseDone'],
    };
    return phaseMap[phase] || phase;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <WorkflowProgress />
        <LanguageToggle />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>{t['review.title']}</Text>
        <Text style={styles.subtitle}>{t['review.instruction']}</Text>

        {currentPatient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t['patient.information']}</Text>
            <PatientCard patient={currentPatient} />
          </View>
        )}

        {vitals && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t['vitals.title']}</Text>
            <VitalsDisplay vitals={vitals} />
          </View>
        )}

        {adlRecordingId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t['voice.adlData']}</Text>

            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={UI_COLORS.primary} />
                <Text style={styles.processingText}>
                  {getPhaseText(processingPhase)}
                </Text>
                {processingProgress > 0 && (
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${processingProgress}%` },
                      ]}
                    />
                  </View>
                )}
              </View>
            ) : adlProcessedData ? (
              <View style={styles.adlDataContainer}>
                <Text style={styles.adlText}>
                  {JSON.stringify(adlProcessedData, null, 2)}
                </Text>
              </View>
            ) : (
              <Text style={styles.noData}>{t['voice.noData']}</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            {t['common.back']}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            (isProcessing || isSubmitting) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isProcessing || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{t['review.submit']}</Text>
          )}
        </TouchableOpacity>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 12,
  },
  processingContainer: {
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: UI_COLORS.text,
    fontWeight: '600',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: UI_COLORS.border,
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: UI_COLORS.primary,
  },
  adlDataContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  adlText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: UI_COLORS.text,
  },
  noData: {
    padding: 24,
    fontSize: 16,
    color: UI_COLORS.textSecondary,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: UI_COLORS.border,
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
  buttonDisabled: {
    backgroundColor: UI_COLORS.textSecondary,
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
