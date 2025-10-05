import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Patient } from '@types';
import { UI_COLORS } from '@constants/config';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';

interface PatientCardProps {
  patient: Patient;
  onPress?: () => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({ patient, onPress }) => {
  const { language } = useAssessmentStore();
  const t = translations[language];

  // Determine status color based on risk factors
  const getStatusColor = () => {
    const riskCount = patient.risk_factors.length;
    if (riskCount >= 3) return UI_COLORS.error;
    if (riskCount >= 1) return UI_COLORS.warning;
    return UI_COLORS.success;
  };

  const statusColor = getStatusColor();

  const CardContent = (
    <View style={[styles.card, onPress && styles.cardTouchable]}>
      <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>
            {patient.family_name} {patient.given_name}
          </Text>
          <Text style={styles.mrn}>MRN: {patient.mrn}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.age}>{patient.age}{t['common.years']}</Text>
          {patient.room && (
            <Text style={styles.room}>{t['patient.room']}: {patient.room}</Text>
          )}
        </View>

        {patient.risk_factors.length > 0 && (
          <View style={styles.riskFactors}>
            {patient.risk_factors.map((risk, index) => (
              <View key={index} style={styles.riskChip}>
                <Text style={styles.riskText}>{risk}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} accessibilityLabel={`Select patient ${patient.family_name} ${patient.given_name}`}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTouchable: {
    minHeight: 48,
  },
  statusIndicator: {
    width: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  mrn: {
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    fontWeight: '500',
  },
  info: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  age: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
  },
  room: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
  },
  riskFactors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  riskChip: {
    backgroundColor: UI_COLORS.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 12,
    color: UI_COLORS.error,
    fontWeight: '600',
  },
});
