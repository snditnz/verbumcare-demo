import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { SESSION_CONFIG } from '@constants/config';

type RootStackParamList = {
  PatientList: undefined;
  PatientInfo: undefined;
  VitalsCapture: undefined;
  ADLVoice: undefined;
  MedicineAdmin: undefined;
  UpdatePatientInfo: undefined;
  IncidentReport: undefined;
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

  // Calculate action statuses for visual indicators
  const getActionStatus = (actionType: string) => {
    switch (actionType) {
      case 'vitals':
        const hasRecentVitals = sessionVitals && isDataRecent(sessionVitals.measured_at);
        const vitalCount = hasRecentVitals ? Object.keys(sessionVitals).filter(k => sessionVitals[k as keyof typeof sessionVitals]).length : 0;
        return {
          completed: vitalCount > 0,
          count: vitalCount,
          borderColor: vitalCount > 0 ? COLORS.success : COLORS.border,
        };

      case 'adl':
        const hasRecentBarthel = sessionBarthelIndex && isDataRecent(sessionBarthelIndex.recorded_at);
        const adlCompleted = hasRecentBarthel || adlRecordingId !== null || adlProcessedData !== null;
        const adlCount = hasRecentBarthel ? 1 : (adlProcessedData?.categories?.length || (adlRecordingId ? 1 : 0));
        return {
          completed: adlCompleted,
          count: adlCount,
          borderColor: adlCompleted ? COLORS.success : COLORS.border,
        };

      case 'medicine':
        const recentMeds = sessionMedications.filter(med => isDataRecent(med.timestamp));
        return {
          completed: recentMeds.length > 0,
          count: recentMeds.length,
          borderColor: recentMeds.length > 0 ? COLORS.success : COLORS.border,
        };

      case 'patientInfo':
        const hasRecentUpdates = sessionPatientUpdates && isDataRecent(sessionPatientUpdates.updatedAt);
        const isDraft = hasRecentUpdates && !sessionPatientUpdates.confirmed;
        const isConfirmed = hasRecentUpdates && sessionPatientUpdates?.confirmed === true;
        return {
          completed: hasRecentUpdates,
          badge: isDraft ? '✎' : isConfirmed ? '✓' : '',
          borderColor: isDraft ? COLORS.warning : isConfirmed ? COLORS.success : COLORS.border,
        };

      case 'incident':
        const recentIncidents = sessionIncidents.filter(inc => isDataRecent(inc.timestamp));
        return {
          completed: recentIncidents.length > 0,
          count: recentIncidents.length,
          borderColor: recentIncidents.length > 0 ? COLORS.error : COLORS.border,
        };

      case 'review':
        const hasRecentVitalsForReview = sessionVitals && isDataRecent(sessionVitals.measured_at);
        const hasRecentBarthelForReview = sessionBarthelIndex && isDataRecent(sessionBarthelIndex.recorded_at);
        const recentMedsForReview = sessionMedications.filter(med => isDataRecent(med.timestamp));
        const hasRecentUpdatesForReview = sessionPatientUpdates && isDataRecent(sessionPatientUpdates.updatedAt);
        const recentIncidentsForReview = sessionIncidents.filter(inc => isDataRecent(inc.timestamp));

        const totalActions =
          (hasRecentVitalsForReview ? 1 : 0) +
          (hasRecentBarthelForReview ? 1 : 0) +
          recentMedsForReview.length +
          (hasRecentUpdatesForReview ? 1 : 0) +
          recentIncidentsForReview.length;
        return {
          completed: totalActions > 0,
          count: totalActions,
          borderColor: COLORS.primary,
        };

      default:
        return { completed: false, count: 0, borderColor: COLORS.border };
    }
  };

  // Display patient name with English version when language is 'en'
  const displayName = language === 'ja'
    ? `${currentPatient.family_name} ${currentPatient.given_name}`
    : `${currentPatient.family_name_en || currentPatient.family_name} ${currentPatient.given_name_en || currentPatient.given_name}`;

  // Calculate BMI from patient data
  const calculateBMI = () => {
    if (currentPatient.height && currentPatient.weight) {
      const heightInMeters = currentPatient.height / 100;
      return (currentPatient.weight / (heightInMeters ** 2)).toFixed(1);
    }
    return null;
  };

  // Parse medications into array
  const getMedicationsList = () => {
    if (!currentPatient.medications) return [];
    // Split on Japanese comma or regular comma
    return currentPatient.medications.split(/[、,]/).filter(m => m.trim().length > 0).map(m => m.trim());
  };

  // Check if vitals were captured today
  const hasVitalsToday = sessionVitals && sessionVitals.measured_at
    ? new Date(sessionVitals.measured_at).toDateString() === new Date().toDateString()
    : false;

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

      <ScrollView style={styles.content}>
        {/* Top Row: Patient Identity + Barthel + Medications */}
        <View style={styles.topRow}>
          {/* Tile 1: Patient Identity with Photo */}
          <Card style={styles.identityTile}>
            <View style={styles.identityContent}>
              <View style={styles.portraitContainer}>
                <Image
                  source={require('../../assets/avatar-placeholder.png')}
                  style={styles.portrait}
                />
              </View>
              <View style={styles.identityInfo}>
                <Text style={styles.patientName}>{displayName}</Text>
                <Text style={styles.demographicsText}>
                  {currentPatient.age}{t['common.years']} • {currentPatient.gender === 'male' ? t['common.male'] : t['common.female']}
                </Text>
                {currentPatient.room && (
                  <Text style={styles.demographicsText}>{t['patient.room']} {currentPatient.room}</Text>
                )}
                {currentPatient.height && currentPatient.weight && (
                  <>
                    <Text style={styles.demographicsText}>{currentPatient.height}cm • {currentPatient.weight}kg</Text>
                    <Text style={styles.demographicsText}>BMI: {calculateBMI()}</Text>
                  </>
                )}
              </View>
            </View>
          </Card>

          {/* Tile 2: Barthel Index */}
          <Card style={styles.compactTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="clipboard" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.tileTitle}>{t['patientInfo.latestBarthel']}</Text>
            </View>
            {currentPatient.latest_barthel_index !== undefined ? (
              <>
                <Text style={styles.tileValue}>{currentPatient.latest_barthel_index}/100</Text>
                <Text style={styles.tileSubtext}>{currentPatient.latest_barthel_date || 'N/A'}</Text>
              </>
            ) : (
              <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
            )}
          </Card>

          {/* Tile 3: Current Medications */}
          <Card style={styles.compactTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="medical" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.tileTitle}>{t['patientInfo.currentMeds']}</Text>
            </View>
            {currentPatient.medications ? (
              <ScrollView style={styles.medScrollView} showsVerticalScrollIndicator={false}>
                {getMedicationsList().map((med, index) => (
                  <View key={index} style={styles.medItem}>
                    <Text style={styles.medBullet}>•</Text>
                    <Text style={styles.medText}>{med}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
            )}
          </Card>
        </View>

        {/* Second Row: Vitals + Allergies + Key Notes */}
        <View style={styles.infoRow}>
          {/* Vitals */}
          <Card style={styles.infoTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="heart" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.tileTitle}>{t['review.vitals']}</Text>
            </View>
            {hasVitalsToday && sessionVitals ? (
              <>
                {sessionVitals.blood_pressure_systolic && sessionVitals.blood_pressure_diastolic && (
                  <Text style={styles.infoText}>
                    BP: {sessionVitals.blood_pressure_systolic}/{sessionVitals.blood_pressure_diastolic} mmHg
                  </Text>
                )}
                {sessionVitals.heart_rate && (
                  <Text style={styles.infoText}>
                    HR: {sessionVitals.heart_rate} bpm
                  </Text>
                )}
                {sessionVitals.temperature_celsius && (
                  <Text style={styles.infoText}>
                    Temp: {sessionVitals.temperature_celsius}°C
                  </Text>
                )}
                {sessionVitals.oxygen_saturation && (
                  <Text style={styles.infoText}>
                    SpO₂: {sessionVitals.oxygen_saturation}%
                  </Text>
                )}
                {sessionVitals.respiratory_rate && (
                  <Text style={styles.infoText}>
                    RR: {sessionVitals.respiratory_rate}/min
                  </Text>
                )}
                <Text style={styles.tileTimestamp}>
                  {new Date(sessionVitals.measured_at).toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </>
            ) : (
              <Text style={styles.noDataText}>{t['patientInfo.noVitalsToday']}</Text>
            )}
          </Card>

          {/* Allergies */}
          <Card style={styles.infoTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="alert-circle" size={ICON_SIZES.md} color={COLORS.error} />
              <Text style={styles.tileTitle}>{t['patientInfo.allergies']}</Text>
            </View>
            {currentPatient.allergies ? (
              <Text style={styles.infoText}>
                🚫 {currentPatient.allergies}
              </Text>
            ) : (
              <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
            )}
          </Card>

          {/* Key Notes */}
          <Card style={styles.infoTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="information-circle" size={ICON_SIZES.md} color={COLORS.info} />
              <Text style={styles.tileTitle}>{t['patientInfo.keyNotes']}</Text>
            </View>
            {currentPatient.key_notes ? (
              <Text style={styles.infoText}>
                {currentPatient.key_notes}
              </Text>
            ) : (
              <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
            )}
          </Card>
        </View>

        {/* Action Buttons Grid */}
        <View style={styles.actionsGrid}>
          {/* Vital Signs */}
          <ActionButton
            icon="fitness"
            label={t['action.vitalSigns']}
            sublabel="Vital Signs"
            onPress={() => navigation.navigate('VitalsCapture')}
            status={getActionStatus('vitals')}
          />

          {/* ADL Recording */}
          <ActionButton
            icon="clipboard"
            label={t['action.adlRecording']}
            sublabel="ADL Recording"
            onPress={() => navigation.navigate('ADLVoice')}
            status={getActionStatus('adl')}
          />

          {/* Medicine Admin */}
          <ActionButton
            icon="medical"
            label={t['action.medicineAdmin']}
            sublabel="Medicine Admin"
            onPress={() => navigation.navigate('MedicineAdmin')}
            status={getActionStatus('medicine')}
          />

          {/* Update Patient Info */}
          <ActionButton
            icon="pencil"
            label={t['action.updatePatientInfo']}
            sublabel="Update Info"
            onPress={() => navigation.navigate('UpdatePatientInfo')}
            status={getActionStatus('patientInfo')}
          />

          {/* Incident Report */}
          <ActionButton
            icon="warning"
            label={t['action.reportIncident']}
            sublabel="Report Incident"
            onPress={() => navigation.navigate('IncidentReport')}
            status={getActionStatus('incident')}
          />

          {/* Save & Review */}
          <ActionButton
            icon="save"
            label={t['action.saveAndReview']}
            sublabel="Save & Review"
            onPress={() => navigation.navigate('ReviewConfirm')}
            status={getActionStatus('review')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Action Button Component with Status Indicators
interface ActionButtonProps {
  icon: string;
  label: string;
  sublabel: string;
  onPress: () => void;
  status: {
    completed: boolean;
    count?: number;
    badge?: string;
    borderColor: string;
  };
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, sublabel, onPress, status }) => {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { borderLeftWidth: 4, borderLeftColor: status.borderColor }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={ICON_SIZES.xl} color={COLORS.primary} />

      {/* Checkmark overlay */}
      {status.completed && (
        <View style={styles.checkmarkBadge}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
        </View>
      )}

      {/* Count badge */}
      {status.count !== undefined && status.count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{status.count}</Text>
        </View>
      )}

      {/* Special badge (for draft indicator) */}
      {status.badge && (
        <View style={styles.specialBadge}>
          <Text style={styles.specialBadgeText}>{status.badge}</Text>
        </View>
      )}

      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSublabel}>{sublabel}</Text>
    </TouchableOpacity>
  );
};

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

  // Top Row Layout
  topRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },

  // Identity Tile (larger, with photo)
  identityTile: {
    flex: 2,
  },
  identityContent: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  portraitContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  identityInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  demographicsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },

  // Compact Tiles (Barthel & Medications)
  compactTile: {
    flex: 1,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  tileTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  tileValue: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  tileSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  medScrollView: {
    maxHeight: 120,
    marginTop: SPACING.xs,
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
    paddingRight: SPACING.sm,
  },
  medBullet: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.primary,
    marginRight: SPACING.xs,
    marginTop: 2,
  },
  medText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
  },

  // Info Row (Vitals, Allergies, Key Notes)
  infoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoTile: {
    flex: 1,
  },
  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  tileTimestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  noDataText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
  },

  // Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  actionButton: {
    width: '31.5%',
    minHeight: 120,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  actionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  actionSublabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },

  // Status Indicators
  checkmarkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  countBadge: {
    position: 'absolute',
    top: 36,
    right: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  specialBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialBadgeText: {
    color: COLORS.surface,
    fontSize: 16,
  },
});
