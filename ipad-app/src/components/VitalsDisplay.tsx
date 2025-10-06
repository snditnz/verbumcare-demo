import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VitalSigns } from '@models';
import { UI_COLORS } from '@constants/config';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';

interface VitalsDisplayProps {
  vitals: VitalSigns | null;
}

export const VitalsDisplay: React.FC<VitalsDisplayProps> = ({ vitals }) => {
  const { language } = useAssessmentStore();
  const t = translations[language];

  if (!vitals) {
    return (
      <View style={styles.container}>
        <Text style={styles.noData}>{t['vitals.noData']}</Text>
      </View>
    );
  }

  const getSystolicColor = (value: number) => {
    if (value >= 140) return UI_COLORS.error;
    if (value >= 130) return UI_COLORS.warning;
    return UI_COLORS.success;
  };

  const getDiastolicColor = (value: number) => {
    if (value >= 90) return UI_COLORS.error;
    if (value >= 80) return UI_COLORS.warning;
    return UI_COLORS.success;
  };

  const getPulseColor = (value: number) => {
    if (value >= 100 || value <= 60) return UI_COLORS.warning;
    return UI_COLORS.success;
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <VitalCard
          label={t['vitals.systolic']}
          value={vitals.blood_pressure_systolic}
          unit="mmHg"
          color={vitals.blood_pressure_systolic ? getSystolicColor(vitals.blood_pressure_systolic) : undefined}
        />
        <VitalCard
          label={t['vitals.diastolic']}
          value={vitals.blood_pressure_diastolic}
          unit="mmHg"
          color={vitals.blood_pressure_diastolic ? getDiastolicColor(vitals.blood_pressure_diastolic) : undefined}
        />
        <VitalCard
          label={t['vitals.pulse']}
          value={vitals.heart_rate}
          unit="bpm"
          color={vitals.heart_rate ? getPulseColor(vitals.heart_rate) : undefined}
        />
      </View>

      {vitals.measured_at && (
        <Text style={styles.timestamp}>
          {t['vitals.measuredAt']}: {new Date(vitals.measured_at).toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US')}
        </Text>
      )}
    </View>
  );
};

interface VitalCardProps {
  label: string;
  value?: number;
  unit: string;
  color?: string;
}

const VitalCard: React.FC<VitalCardProps> = ({ label, value, unit, color }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.valueContainer}>
      <Text style={[styles.value, color ? { color } : undefined]}>
        {value !== undefined ? value : '-'}
      </Text>
      <Text style={styles.unit}>{unit}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
  },
  unit: {
    fontSize: 14,
    color: UI_COLORS.textSecondary,
  },
  timestamp: {
    fontSize: 12,
    color: UI_COLORS.textSecondary,
    textAlign: 'center',
  },
  noData: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
    textAlign: 'center',
    padding: 24,
  },
});
