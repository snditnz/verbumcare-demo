import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { SESSION_CONFIG } from '@constants/config';
import { assessVitalSigns, getColorForStatus } from '@utils/vitalSignsAssessment';
import { assessPain } from '@utils/healthcareAssessments';
import type { VitalStatus } from '@utils/vitalSignsAssessment';

type RootStackParamList = {
  PatientList: undefined;
  PatientInfo: undefined;
  VitalsCapture: undefined;
  ADLVoice: undefined;
  MedicineAdmin: undefined;
  UpdatePatientInfo: undefined;
  IncidentReport: undefined;
  PainAssessment: undefined;
  FallRiskAssessment: undefined;
  KihonChecklist: undefined;
  ReviewConfirm: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PatientInfo'>;
};

export default function PatientInfoScreen({ navigation }: Props) {
  const {
    currentPatient,
    language,
    sessionVitals,
    sessionBarthelIndex,
    sessionPainAssessment,
    sessionFallRiskAssessment,
    sessionKihonChecklist,
    adlRecordingId,
    adlProcessedData,
    sessionMedications,
    sessionPatientUpdates,
    sessionIncidents,
  } = useAssessmentStore();

  const t = translations[language];

  // If no patient, navigate back to patient list
  React.useEffect(() => {
    if (!currentPatient) {
      navigation.navigate('PatientList');
    }
  }, [currentPatient, navigation]);

  if (!currentPatient) {
    return null;
  }

  // Helper: Check if timestamp is within badge timeout window
  const isDataRecent = (timestamp: Date | string | undefined): boolean => {
    if (!timestamp) return false;
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const hoursSince = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    return hoursSince <= SESSION_CONFIG.BADGE_TIMEOUT_HOURS;
  };

  // Display patient name with English version when language is 'en'
  const displayName = language === 'ja'
    ? `${currentPatient.family_name} ${currentPatient.given_name}`
    : `${currentPatient.family_name_en || currentPatient.family_name} ${currentPatient.given_name_en || currentPatient.given_name}`;

  // Get latest height and weight
  const latestHeight = sessionPatientUpdates?.height ?? currentPatient.height;
  const latestWeight = sessionVitals?.weight?.weight_kg ?? currentPatient.weight;

  // Assess current vitals with color coding (includes BMI)
  const vitalAssessments = sessionVitals ? assessVitalSigns(
    {
      age: currentPatient.age,
      gender: currentPatient.gender === 'male' ? 'male' : 'female',
    },
    {
      systolicBP: sessionVitals.blood_pressure_systolic,
      diastolicBP: sessionVitals.blood_pressure_diastolic,
      heartRate: sessionVitals.heart_rate,
      temperature: sessionVitals.temperature_celsius,
      spO2: sessionVitals.oxygen_saturation,
      respiratoryRate: sessionVitals.respiratory_rate,
      weight: latestWeight,
      height: latestHeight,
    }
  ) : null;

  // BMI assessment from vitals (uses JASSO 2022 Japanese standards)
  const bmiAssessment = vitalAssessments?.bmi;

  // Assess pain score
  const painAssessment = sessionPainAssessment || currentPatient.latest_pain_score !== undefined
    ? assessPain(sessionPainAssessment?.pain_score ?? currentPatient.latest_pain_score ?? 0)
    : null;

  // Fall risk status
  const fallRiskScore = sessionFallRiskAssessment?.risk_score ?? currentPatient.latest_fall_risk_score;
  const fallRiskLevel = sessionFallRiskAssessment?.risk_level ?? currentPatient.latest_fall_risk_level;
  const getFallRiskColor = (): string => {
    if (fallRiskLevel === 'high') return getColorForStatus('red');
    if (fallRiskLevel === 'moderate') return getColorForStatus('yellow');
    return getColorForStatus('green');
  };

  // Kihon Checklist status
  const kihonStatus = sessionKihonChecklist?.frailty_status;
  const getKihonColor = (): string => {
    if (kihonStatus === 'frail') return getColorForStatus('red');
    if (kihonStatus === 'prefrail') return getColorForStatus('yellow');
    if (kihonStatus === 'robust') return getColorForStatus('green');
    return COLORS.text.disabled;
  };

  // Parse medications
  const getMedicationsList = () => {
    if (!currentPatient.medications) return [];
    return currentPatient.medications.split(/[、,]/).filter(m => m.trim().length > 0).map(m => m.trim());
  };

  // Check if there are recent session actions
  const hasRecentActions =
    (sessionVitals && isDataRecent(sessionVitals.measured_at)) ||
    (sessionBarthelIndex && isDataRecent(sessionBarthelIndex.recorded_at)) ||
    (sessionPainAssessment && isDataRecent(sessionPainAssessment.recorded_at)) ||
    (sessionFallRiskAssessment && isDataRecent(sessionFallRiskAssessment.recorded_at)) ||
    sessionMedications.some(med => isDataRecent(med.timestamp)) ||
    (sessionPatientUpdates && isDataRecent(sessionPatientUpdates.updatedAt)) ||
    sessionIncidents.some(inc => isDataRecent(inc.timestamp));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={() => navigation.navigate('PatientList')}>
            {`← ${t['common.back']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.screenTitle}>{t['patientInfo.title']}</Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ZONE 1: Patient Header - Prominent Identity */}
        <View style={styles.patientHeader}>
          <View style={styles.portraitContainer}>
            <Image
              source={require('../../assets/avatar-placeholder.png')}
              style={styles.portrait}
            />
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{displayName}</Text>
            <Text style={styles.patientDemographics}>
              {currentPatient.age}{t['common.years']} • {currentPatient.gender === 'male' ? t['common.male'] : t['common.female']}
              {currentPatient.room && ` • ${t['patient.room']} ${currentPatient.room}`}
            </Text>
            {latestHeight && latestWeight && (
              <View style={styles.biometricsRow}>
                <Text style={styles.biometricsText}>
                  {latestHeight}cm • {latestWeight}kg
                </Text>
                {bmiAssessment && (
                  <View style={[styles.bmiBadge, { backgroundColor: getColorForStatus(bmiAssessment.status) }]}>
                    <Text style={styles.bmiBadgeText}>
                      BMI {bmiAssessment.value} • {language === 'ja' ? bmiAssessment.statusLabelJa : bmiAssessment.statusLabel}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ZONE 2: Clinical Status Dashboard - Consolidated, Color-Coded */}
        <View style={styles.statusDashboard}>
          {/* Row 1: Vitals, Pain, Fall Risk, Barthel */}
          <View style={styles.statusRow}>
            {/* Vitals Card */}
            <TouchableOpacity
              style={styles.statusCard}
              onPress={() => navigation.navigate('VitalsCapture')}
            >
              <View style={styles.statusCardHeader}>
                <Ionicons name="heart" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.statusCardTitle}>{t['review.vitals']}</Text>
              </View>
              {sessionVitals && isDataRecent(sessionVitals.measured_at) ? (
                <View style={styles.statusCardContent}>
                  {vitalAssessments?.bloodPressure && (
                    <View style={styles.vitalRow}>
                      <View style={[styles.statusDot, { backgroundColor: getColorForStatus(vitalAssessments.bloodPressure.status) }]} />
                      <Text style={styles.vitalText}>
                        BP {sessionVitals.blood_pressure_systolic}/{sessionVitals.blood_pressure_diastolic}
                      </Text>
                    </View>
                  )}
                  {vitalAssessments?.heartRate && (
                    <View style={styles.vitalRow}>
                      <View style={[styles.statusDot, { backgroundColor: getColorForStatus(vitalAssessments.heartRate.status) }]} />
                      <Text style={styles.vitalText}>
                        HR {sessionVitals.heart_rate} bpm
                      </Text>
                    </View>
                  )}
                  <Text style={styles.statusTimestamp}>
                    {new Date(sessionVitals.measured_at).toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noDataText}>{t['patientInfo.noVitalsToday']}</Text>
              )}
            </TouchableOpacity>

            {/* Pain Card */}
            <TouchableOpacity
              style={styles.statusCard}
              onPress={() => navigation.navigate('PainAssessment')}
            >
              <View style={styles.statusCardHeader}>
                <Ionicons name="pulse" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.statusCardTitle}>{t['action.painAssessment']}</Text>
              </View>
              {painAssessment ? (
                <View style={styles.statusCardContent}>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreValue}>{painAssessment.score}/10</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getColorForStatus(painAssessment.status) }]}>
                      <Text style={styles.statusBadgeText}>
                        {language === 'ja' ? painAssessment.statusLabelJa : painAssessment.statusLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.statusTimestamp}>
                    {sessionPainAssessment
                      ? new Date(sessionPainAssessment.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')
                      : currentPatient.latest_pain_date || ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.actionPrompt}>
                  <Ionicons name="add-circle-outline" size={ICON_SIZES.lg} color={COLORS.primary} />
                  <Text style={styles.actionPromptText}>{t['action.painAssessment']}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Fall Risk Card */}
            <TouchableOpacity
              style={styles.statusCard}
              onPress={() => navigation.navigate('FallRiskAssessment')}
            >
              <View style={styles.statusCardHeader}>
                <Ionicons name="body" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.statusCardTitle}>{t['action.fallRisk']}</Text>
              </View>
              {fallRiskScore !== undefined && fallRiskLevel ? (
                <View style={styles.statusCardContent}>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreValue}>{fallRiskScore}/8</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getFallRiskColor() }]}>
                      <Text style={styles.statusBadgeText}>
                        {language === 'ja'
                          ? (fallRiskLevel === 'low' ? '低リスク' : fallRiskLevel === 'moderate' ? '中等度' : '高リスク')
                          : fallRiskLevel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.statusTimestamp}>
                    {sessionFallRiskAssessment
                      ? new Date(sessionFallRiskAssessment.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')
                      : currentPatient.latest_fall_risk_date || ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.actionPrompt}>
                  <Ionicons name="add-circle-outline" size={ICON_SIZES.lg} color={COLORS.primary} />
                  <Text style={styles.actionPromptText}>{t['action.fallRisk']}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Barthel/ADL Card */}
            <TouchableOpacity
              style={styles.statusCard}
              onPress={() => navigation.navigate('ADLVoice')}
            >
              <View style={styles.statusCardHeader}>
                <Ionicons name="clipboard" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.statusCardTitle}>{t['patientInfo.latestBarthel']}</Text>
              </View>
              {sessionBarthelIndex || currentPatient.latest_barthel_index !== undefined ? (
                <View style={styles.statusCardContent}>
                  <Text style={styles.scoreValue}>
                    {sessionBarthelIndex?.total_score ?? currentPatient.latest_barthel_index}/100
                  </Text>
                  <Text style={styles.statusTimestamp}>
                    {sessionBarthelIndex
                      ? new Date(sessionBarthelIndex.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')
                      : currentPatient.latest_barthel_date || ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.actionPrompt}>
                  <Ionicons name="add-circle-outline" size={ICON_SIZES.lg} color={COLORS.primary} />
                  <Text style={styles.actionPromptText}>{t['action.adlRecording']}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Row 2: Allergies, Kihon, Medications, Notes */}
          <View style={styles.statusRow}>
            {/* Allergies Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusCardHeader}>
                <Ionicons name="alert-circle" size={ICON_SIZES.md} color={COLORS.error} />
                <Text style={styles.statusCardTitle}>{t['patientInfo.allergies']}</Text>
              </View>
              {currentPatient.allergies ? (
                <View style={styles.statusCardContent}>
                  <Text style={styles.allergyText}>🚫 {currentPatient.allergies}</Text>
                </View>
              ) : (
                <View style={styles.statusCardContent}>
                  <View style={styles.nkdaBadge}>
                    <Text style={styles.nkdaText}>✓ NKDA</Text>
                  </View>
                  <Text style={styles.nkdaSubtext}>
                    {language === 'ja' ? '薬物アレルギーなし' : 'No Known Drug Allergies'}
                  </Text>
                </View>
              )}
            </View>

            {/* Kihon Checklist Card */}
            <TouchableOpacity
              style={styles.statusCard}
              onPress={() => navigation.navigate('KihonChecklist')}
            >
              <View style={styles.statusCardHeader}>
                <Ionicons name="speedometer" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.statusCardTitle}>{t['action.kihonChecklist']}</Text>
              </View>
              {sessionKihonChecklist ? (
                <View style={styles.statusCardContent}>
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreValue}>{sessionKihonChecklist.total_score}/25</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getKihonColor() }]}>
                      <Text style={styles.statusBadgeText}>
                        {language === 'ja'
                          ? (kihonStatus === 'robust' ? '健常' : kihonStatus === 'prefrail' ? 'プレフレイル' : 'フレイル')
                          : (kihonStatus === 'robust' ? 'Robust' : kihonStatus === 'prefrail' ? 'Pre-frail' : 'Frail')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.statusTimestamp}>
                    {new Date(sessionKihonChecklist.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')}
                  </Text>
                </View>
              ) : (
                <View style={styles.actionPrompt}>
                  <Ionicons name="add-circle-outline" size={ICON_SIZES.lg} color={COLORS.primary} />
                  <Text style={styles.actionPromptText}>{language === 'ja' ? '開始' : 'Start'}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Medications Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusCardHeader}>
                <Ionicons name="medical" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.statusCardTitle}>{t['patientInfo.currentMeds']}</Text>
              </View>
              {currentPatient.medications ? (
                <View style={styles.statusCardContent}>
                  <Text style={styles.medCount}>
                    {getMedicationsList().length} {language === 'ja' ? '種類' : 'meds'}
                  </Text>
                  <TouchableOpacity>
                    <Text style={styles.viewLink}>{language === 'ja' ? '詳細表示 →' : 'View →'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.statusCardContent}>
                  <Text style={styles.noMedsText}>
                    {language === 'ja' ? '投薬なし' : 'No medications'}
                  </Text>
                </View>
              )}
            </View>

            {/* Notes Card */}
            <TouchableOpacity
              style={styles.statusCard}
              onPress={() => navigation.navigate('UpdatePatientInfo')}
            >
              <View style={styles.statusCardHeader}>
                <Ionicons name="information-circle" size={ICON_SIZES.md} color={COLORS.info} />
                <Text style={styles.statusCardTitle}>{t['patientInfo.keyNotes']}</Text>
              </View>
              {currentPatient.key_notes ? (
                <View style={styles.statusCardContent}>
                  <Text style={styles.notesText} numberOfLines={3}>
                    {currentPatient.key_notes}
                  </Text>
                </View>
              ) : (
                <View style={styles.actionPrompt}>
                  <Ionicons name="add-circle-outline" size={ICON_SIZES.lg} color={COLORS.primary} />
                  <Text style={styles.actionPromptText}>{language === 'ja' ? 'メモを追加' : 'Add Note'}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ZONE 3: Quick Actions - Large Touch Targets, Grouped by Workflow */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>{language === 'ja' ? 'クイックアクション' : 'Quick Actions'}</Text>

          {/* Row 1: Care Delivery */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('VitalsCapture')}
            >
              <Ionicons name="fitness" size={ICON_SIZES.xl} color={COLORS.primary} />
              <Text style={styles.quickActionLabel}>{t['action.vitalSigns']}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('MedicineAdmin')}
            >
              <Ionicons name="medical" size={ICON_SIZES.xl} color={COLORS.primary} />
              <Text style={styles.quickActionLabel}>{t['action.medicineAdmin']}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('ADLVoice')}
            >
              <Ionicons name="clipboard" size={ICON_SIZES.xl} color={COLORS.primary} />
              <Text style={styles.quickActionLabel}>{t['action.adlRecording']}</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Documentation & Review */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('UpdatePatientInfo')}
            >
              <Ionicons name="pencil" size={ICON_SIZES.xl} color={COLORS.primary} />
              <Text style={styles.quickActionLabel}>{t['action.updatePatientInfo']}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('IncidentReport')}
            >
              <Ionicons name="warning" size={ICON_SIZES.xl} color={COLORS.error} />
              <Text style={styles.quickActionLabel}>{t['action.reportIncident']}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickActionButton,
                hasRecentActions && styles.quickActionButtonPrimary
              ]}
              onPress={() => navigation.navigate('ReviewConfirm')}
            >
              <Ionicons
                name="checkmark-circle"
                size={ICON_SIZES.xl}
                color={hasRecentActions ? COLORS.white : COLORS.success}
              />
              <Text style={[
                styles.quickActionLabel,
                hasRecentActions && styles.quickActionLabelWhite
              ]}>
                {t['action.saveAndReview']}
              </Text>
            </TouchableOpacity>
          </View>
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

  // ZONE 1: Patient Header
  patientHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  portraitContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  patientInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  patientDemographics: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  biometricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  biometricsText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  bmiBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  bmiBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },

  // ZONE 2: Clinical Status Dashboard
  statusDashboard: {
    marginBottom: SPACING.lg,
  },
  statusRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statusCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    minHeight: 120,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  statusCardTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
  },
  statusCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vitalText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  scoreValue: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
  statusTimestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  actionPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  actionPromptText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  noDataText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  allergyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  nkdaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  nkdaText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  nkdaSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  medCount: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  viewLink: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.info,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  noMedsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  notesText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },

  // ZONE 3: Quick Actions
  quickActions: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    minHeight: SPACING.touchTarget.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  quickActionButtonPrimary: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  quickActionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  quickActionLabelWhite: {
    color: COLORS.white,
  },
});
