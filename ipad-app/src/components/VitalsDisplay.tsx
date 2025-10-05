import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VitalSigns } from '@types';
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
          value={vitals.systolic}
          unit="mmHg"
          color={getSystolicColor(vitals.systolic)}
        />
        <VitalCard
          label={t['vitals.diastolic']}
          value={vitals.diastolic}
          unit="mmHg"
          color={getDiastolicColor(vitals.diastolic)}
        />
        <VitalCard
          label={t['vitals.pulse']}
          value={vitals.pulse}
          unit="bpm"
          color={getPulseColor(vitals.pulse)}
        />
      </View>

      {vitals.timestamp && (
        <Text style={styles.timestamp}>
          {t['vitals.measuredAt']}: {new Date(vitals.timestamp).toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US')}
        </Text>
      )}
    </View>
  );
};

interface VitalCardProps {
  label: string;
  value: number;
  unit: string;
  color: string;
}

const VitalCard: React.FC<VitalCardProps> = ({ label, value, unit, color }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.valueContainer}>
      <Text style={[styles.value, { color }]}>{value}</Text>
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
