import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { socketService, apiService } from '@services';
import { VoiceProcessingProgress } from '@models/api';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { DEMO_STAFF_ID } from '@constants/config';
import { getTimeAgo } from '@utils/timeAgo';

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
    sessionVitals,
    sessionBarthelIndex,
    sessionPainAssessment,
    adlRecordingId,
    adlProcessedData,
    setADLProcessedData,
    sessionMedications,
    sessionPatientUpdates,
    sessionIncidents,
    resetAssessment,
    clearPatientSession,
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
      // Submit all session data to backend
      await apiService.submitAllSessionData(currentPatient.patient_id, {
        vitals: sessionVitals ?? undefined,
        barthelIndex: sessionBarthelIndex ?? undefined,
        painAssessment: sessionPainAssessment ?? undefined,
        medications: sessionMedications,
        patientUpdates: sessionPatientUpdates ?? undefined,
        incidents: sessionIncidents,
      });

      // Update currentPatient with newly saved Barthel score and Pain score
      // This ensures the tiles show the latest data after submission
      let updatedPatient = { ...currentPatient };

      if (sessionBarthelIndex) {
        updatedPatient.latest_barthel_index = sessionBarthelIndex.total_score;
        updatedPatient.latest_barthel_date = new Date().toISOString().split('T')[0];
      }

      if (sessionPainAssessment) {
        updatedPatient.latest_pain_score = sessionPainAssessment.pain_score;
        updatedPatient.latest_pain_date = new Date().toISOString().split('T')[0];
      }

      // Update the patient in store
      useAssessmentStore.getState().setCurrentPatient(updatedPatient);

      // DON'T clear session immediately - let time-based badge hiding handle it
      // This allows vitals and other data tiles to still show the just-saved data
      // After 4 hours, badges will automatically hide due to SESSION_CONFIG.BADGE_TIMEOUT_HOURS
      // The session will be cleared when user navigates away from this patient

      Alert.alert(
        t['review.submitSuccess'] || 'Success',
        t['review.submitSuccessMessage'] || 'Assessment data has been saved successfully.',
        [
          {
            text: t['common.ok'] || 'OK',
            onPress: () => {
              // Navigate back to PatientInfo to show updated data
              // Don't call resetAssessment() yet - patient is still selected
              navigation.navigate('PatientInfo' as any);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Failed to submit assessment:', error);
      Alert.alert(
        t['review.submitFailed'] || 'Submission Failed',
        error.message || t['review.submitFailedMessage'] || 'Failed to save assessment data. Please try again.',
        [
          { text: t['common.ok'] || 'OK', style: 'cancel' },
        ]
      );
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

  const getVitalStatus = (value: number | undefined, normalRange: [number, number]) => {
    if (!value) return COLORS.status.neutral;
    if (value < normalRange[0] * 0.85 || value > normalRange[1] * 1.15) return COLORS.status.critical;
    if (value < normalRange[0] || value > normalRange[1]) return COLORS.status.warning;
    return COLORS.status.normal;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={() => navigation.navigate('PatientInfo' as any)}>
            {`← ${t['common.back']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.screenTitle}>
            {language === 'ja' ? '確認・送信' : 'Review & Submit'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Patient Summary Card */}
        {currentPatient && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="person-circle" size={ICON_SIZES.lg} color={COLORS.primary} />
              <Text style={styles.cardTitle}>{t['patient.information']}</Text>
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>
                {currentPatient.family_name} {currentPatient.given_name}
              </Text>
              <View style={styles.patientDetails}>
                <Text style={styles.detailText}>
                  {currentPatient.age}{t['common.years']} • {
                    currentPatient.gender === 'male' ? t['common.male'] :
                    currentPatient.gender === 'female' ? t['common.female'] :
                    t['common.other']
                  }
                </Text>
                {currentPatient.room && (
                  <Text style={styles.detailText}>{t['patient.room']}: {currentPatient.room}</Text>
                )}
              </View>
              <Text style={styles.timestamp}>
                {new Date().toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US')}
              </Text>
            </View>
          </Card>
        )}

        {/* Vitals Summary Card */}
        {sessionVitals && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="heart" size={ICON_SIZES.lg} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {language === 'ja' ? 'バイタルサイン' : 'Vital Signs'}
                </Text>
                {sessionVitals.measured_at && (
                  <Text style={styles.timeAgo}>
                    {getTimeAgo(sessionVitals.measured_at, language)}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.vitalsGrid}>
              {sessionVitals.blood_pressure_systolic && sessionVitals.blood_pressure_diastolic && (
                <View style={styles.vitalItem}>
                  <View style={[styles.vitalIndicator, { backgroundColor: getVitalStatus(sessionVitals.blood_pressure_systolic, [90, 140]) }]} />
                  <Text style={styles.vitalLabel}>{language === 'ja' ? '血圧' : 'BP'}</Text>
                  <Text style={styles.vitalValue}>{sessionVitals.blood_pressure_systolic}/{sessionVitals.blood_pressure_diastolic}</Text>
                  <Text style={styles.vitalUnit}>mmHg</Text>
                </View>
              )}
              {sessionVitals.heart_rate && (
                <View style={styles.vitalItem}>
                  <View style={[styles.vitalIndicator, { backgroundColor: getVitalStatus(sessionVitals.heart_rate, [60, 100]) }]} />
                  <Text style={styles.vitalLabel}>{language === 'ja' ? '脈拍' : 'Pulse'}</Text>
                  <Text style={styles.vitalValue}>{sessionVitals.heart_rate}</Text>
                  <Text style={styles.vitalUnit}>bpm</Text>
                </View>
              )}
              {sessionVitals.temperature_celsius && (
                <View style={styles.vitalItem}>
                  <View style={[styles.vitalIndicator, { backgroundColor: getVitalStatus(sessionVitals.temperature_celsius, [36.0, 37.5]) }]} />
                  <Text style={styles.vitalLabel}>{language === 'ja' ? '体温' : 'Temp'}</Text>
                  <Text style={styles.vitalValue}>{sessionVitals.temperature_celsius.toFixed(1)}</Text>
                  <Text style={styles.vitalUnit}>°C</Text>
                </View>
              )}
              {sessionVitals.oxygen_saturation && (
                <View style={styles.vitalItem}>
                  <View style={[styles.vitalIndicator, { backgroundColor: getVitalStatus(sessionVitals.oxygen_saturation, [95, 100]) }]} />
                  <Text style={styles.vitalLabel}>SpO₂</Text>
                  <Text style={styles.vitalValue}>{sessionVitals.oxygen_saturation}</Text>
                  <Text style={styles.vitalUnit}>%</Text>
                </View>
              )}
              {sessionVitals.respiratory_rate && (
                <View style={styles.vitalItem}>
                  <View style={[styles.vitalIndicator, { backgroundColor: getVitalStatus(sessionVitals.respiratory_rate, [12, 20]) }]} />
                  <Text style={styles.vitalLabel}>{language === 'ja' ? '呼吸数' : 'RR'}</Text>
                  <Text style={styles.vitalValue}>{sessionVitals.respiratory_rate}</Text>
                  <Text style={styles.vitalUnit}>/min</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Pain Assessment Card */}
        {sessionPainAssessment && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="pulse" size={ICON_SIZES.lg} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {language === 'ja' ? '痛みの評価' : 'Pain Assessment'}
                </Text>
                {sessionPainAssessment.recorded_at && (
                  <Text style={styles.timeAgo}>
                    {getTimeAgo(sessionPainAssessment.recorded_at, language)}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.painContainer}>
              <View style={styles.painScoreRow}>
                <Text style={styles.painLabel}>
                  {language === 'ja' ? '痛みスコア:' : 'Pain Score:'}
                </Text>
                <Text style={[styles.painScore, {
                  color: sessionPainAssessment.pain_score >= 7 ? COLORS.status.critical :
                         sessionPainAssessment.pain_score >= 4 ? COLORS.status.warning :
                         COLORS.status.normal
                }]}>
                  {sessionPainAssessment.pain_score}/10
                </Text>
              </View>
              {sessionPainAssessment.location && (
                <Text style={styles.painDetail}>
                  {language === 'ja' ? '部位: ' : 'Location: '}{sessionPainAssessment.location}
                </Text>
              )}
              {sessionPainAssessment.pain_type && (
                <Text style={styles.painDetail}>
                  {language === 'ja' ? '性質: ' : 'Type: '}{
                    sessionPainAssessment.pain_type === 'rest' ? (language === 'ja' ? '安静時' : 'At Rest') :
                    sessionPainAssessment.pain_type === 'movement' ? (language === 'ja' ? '動作時' : 'During Movement') :
                    (language === 'ja' ? '両方' : 'Both')
                  }
                </Text>
              )}
              {sessionPainAssessment.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>
                    {language === 'ja' ? 'メモ:' : 'Notes:'}
                  </Text>
                  <Text style={styles.notesText}>{sessionPainAssessment.notes}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Barthel Index / ADL Assessment Card */}
        {(sessionBarthelIndex || adlRecordingId) && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="clipboard" size={ICON_SIZES.lg} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {language === 'ja' ? 'ADL評価' : 'ADL Assessment'}
                </Text>
                {sessionBarthelIndex?.recorded_at && (
                  <Text style={styles.timeAgo}>
                    {getTimeAgo(sessionBarthelIndex.recorded_at, language)}
                  </Text>
                )}
              </View>
            </View>

            {sessionBarthelIndex && (
              <View style={styles.barthelContainer}>
                <View style={styles.barthelHeader}>
                  <Text style={styles.barthelScore}>
                    {language === 'ja' ? 'バーセル指数: ' : 'Barthel Index: '}
                    <Text style={styles.barthelScoreValue}>{sessionBarthelIndex.total_score}/100</Text>
                  </Text>
                </View>
                {sessionBarthelIndex.additional_notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>
                      {language === 'ja' ? '追加メモ:' : 'Additional Notes:'}
                    </Text>
                    <Text style={styles.notesText}>{sessionBarthelIndex.additional_notes}</Text>
                  </View>
                )}
              </View>
            )}

            {adlRecordingId && (
              <>
                {isProcessing ? (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
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
                    <Text style={styles.adlSummary}>
                      {typeof adlProcessedData === 'string'
                        ? adlProcessedData
                        : adlProcessedData.summary || JSON.stringify(adlProcessedData, null, 2)}
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            {!sessionBarthelIndex && !adlRecordingId && (
              <View style={styles.noDataContainer}>
                <Ionicons name="information-circle-outline" size={ICON_SIZES.lg} color={COLORS.text.disabled} />
                <Text style={styles.noData}>{t['voice.noData']}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Session Medications */}
        {sessionMedications.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="medical" size={ICON_SIZES.lg} color={COLORS.primary} />
              <Text style={styles.cardTitle}>
                {language === 'ja' ? '服薬管理' : 'Medications Administered'}
              </Text>
            </View>
            <View style={styles.medicationsContainer}>
              {sessionMedications.map((med, index) => (
                <View key={index} style={styles.medicationItem}>
                  <Text style={styles.medicationName}>{med.medicationName}</Text>
                  <Text style={styles.medicationDetails}>
                    {med.dosage} • {med.route} • {med.time}
                  </Text>
                  {med.notes && (
                    <Text style={styles.medicationNotes}>{med.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Patient Updates */}
        {sessionPatientUpdates && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="person" size={ICON_SIZES.lg} color={COLORS.primary} />
              <Text style={styles.cardTitle}>
                {language === 'ja' ? '患者情報更新' : 'Patient Information Updates'}
              </Text>
            </View>
            <View style={styles.updatesContainer}>
              {sessionPatientUpdates.height && (
                <Text style={styles.updateItem}>
                  {language === 'ja' ? '身長: ' : 'Height: '}{sessionPatientUpdates.height} cm
                </Text>
              )}
              {sessionPatientUpdates.weight && (
                <Text style={styles.updateItem}>
                  {language === 'ja' ? '体重: ' : 'Weight: '}{sessionPatientUpdates.weight} kg
                </Text>
              )}
              {sessionPatientUpdates.allergies && (
                <Text style={styles.updateItem}>
                  {language === 'ja' ? 'アレルギー: ' : 'Allergies: '}{sessionPatientUpdates.allergies}
                </Text>
              )}
              {sessionPatientUpdates.medications && (
                <Text style={styles.updateItem}>
                  {language === 'ja' ? '服薬: ' : 'Medications: '}{sessionPatientUpdates.medications}
                </Text>
              )}
              {sessionPatientUpdates.keyNotes && (
                <Text style={styles.updateItem}>
                  {language === 'ja' ? '特記事項: ' : 'Key Notes: '}{sessionPatientUpdates.keyNotes}
                </Text>
              )}
            </View>
          </Card>
        )}

        {/* Incident Reports */}
        {sessionIncidents.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="warning" size={ICON_SIZES.lg} color={COLORS.error} />
              <Text style={styles.cardTitle}>
                {language === 'ja' ? 'インシデント報告' : 'Incident Reports'}
              </Text>
            </View>
            <View style={styles.incidentsContainer}>
              {sessionIncidents.map((incident, index) => (
                <View key={incident.id} style={styles.incidentItem}>
                  <View style={styles.incidentHeader}>
                    <Text style={[styles.incidentType, { color:
                      incident.severity === 'critical' ? COLORS.status.critical :
                      incident.severity === 'high' ? COLORS.error :
                      incident.severity === 'medium' ? COLORS.status.warning :
                      COLORS.status.normal
                    }]}>
                      {incident.type.toUpperCase()}
                    </Text>
                    <Text style={styles.incidentTime}>{incident.datetime}</Text>
                  </View>
                  <Text style={styles.incidentDescription}>{incident.description}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          variant="outline"
          onPress={() => navigation.navigate('PatientInfo' as any)}
          disabled={isSubmitting}
        >
          {t['common.back']}
        </Button>
        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={isProcessing || isSubmitting}
          loading={isSubmitting}
        >
          {t['review.submit']}
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  timeAgo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  patientInfo: {
    gap: SPACING.sm,
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  patientDetails: {
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    marginTop: SPACING.sm,
  },
  vitalsGrid: {
    gap: SPACING.md,
  },
  vitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  vitalIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: SPACING.md,
  },
  vitalLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    flex: 1,
  },
  vitalValue: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginRight: SPACING.xs,
  },
  vitalUnit: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.secondary,
    minWidth: 60,
  },
  processingContainer: {
    padding: SPACING['2xl'],
    alignItems: 'center',
    gap: SPACING.lg,
  },
  processingText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.divider,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  adlDataContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
  },
  adlSummary: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: SPACING['2xl'],
    gap: SPACING.md,
  },
  noData: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.disabled,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.lg,
  },
  barthelContainer: {
    gap: SPACING.md,
  },
  barthelHeader: {
    marginBottom: SPACING.sm,
  },
  barthelScore: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.primary,
  },
  barthelScoreValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  notesSection: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  notesLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
  },
  notesText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  medicationsContainer: {
    gap: SPACING.md,
  },
  medicationItem: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.xs,
  },
  medicationName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  medicationDetails: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  medicationNotes: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  updatesContainer: {
    gap: SPACING.md,
  },
  updateItem: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    paddingVertical: SPACING.sm,
  },
  incidentsContainer: {
    gap: SPACING.md,
  },
  incidentItem: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    gap: SPACING.sm,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incidentType: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  incidentTime: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  incidentDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  painContainer: {
    gap: SPACING.md,
  },
  painScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  painLabel: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  painScore: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  painDetail: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    paddingVertical: SPACING.xs,
  },
});
