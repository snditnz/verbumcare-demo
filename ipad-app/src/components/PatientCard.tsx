import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Patient } from '@models';
import { Card } from '@components/ui';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES } from '@constants/theme';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';

interface PatientCardProps {
  patient: Patient;
  onPress?: () => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({ patient, onPress }) => {
  const { language } = useAssessmentStore();
  const t = translations[language];

  // Determine status based on risk factors
  const getStatus = () => {
    const riskCount = patient.risk_factors?.length || 0;
    if (riskCount >= 3) return { color: COLORS.status.critical, icon: 'alert-circle' as const, label: t['common.highRisk'] || 'High Risk' };
    if (riskCount >= 1) return { color: COLORS.status.warning, icon: 'warning' as const, label: t['common.caution'] || 'Caution' };
    return { color: COLORS.status.normal, icon: 'checkmark-circle' as const, label: t['common.stable'] || 'Stable' };
  };

  const status = getStatus();

  // Display name in English when language is 'en'
  const displayName = language === 'ja'
    ? `${patient.family_name} ${patient.given_name}`
    : `${patient.family_name_en || patient.family_name} ${patient.given_name_en || patient.given_name}`;

  return (
    <Card
      onPress={onPress}
      style={styles.card}
      padding="lg"
    >
      <View style={styles.topRow}>
        <Text style={styles.name}>
          {displayName}
        </Text>
        {patient.room && (
          <Text style={styles.roomNumber}>{patient.room}</Text>
        )}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.info}>
          {patient.age}{t['common.years']}
        </Text>
        <Text style={styles.info}>•</Text>
        <Text style={styles.info}>
          {patient.gender === 'male' ? (t['common.male'] || 'Male') :
           patient.gender === 'female' ? (t['common.female'] || 'Female') :
           (t['common.other'] || 'Other')}
        </Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Ionicons name={status.icon} size={ICON_SIZES.sm} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {patient.risk_factors && patient.risk_factors.length > 0 && (
        <View style={styles.riskFactors}>
          {patient.risk_factors.map((risk, index) => (
            <View key={index} style={[styles.riskChip, { backgroundColor: `${status.color}15` }]}>
              <Text style={[styles.riskText, { color: status.color }]}>{risk}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.timestamp}>
        {t['common.lastAssessment'] || 'Last assessment'}: {t['common.notAvailable'] || 'N/A'}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: SPACING.touchTarget.xl,
    marginBottom: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  name: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    flex: 1,
  },
  roomNumber: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  info: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  riskFactors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  riskChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  riskText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    marginTop: SPACING.xs,
  },
});
