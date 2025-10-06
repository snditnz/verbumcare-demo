import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WorkflowStep } from '@models';
import { UI_COLORS } from '@constants/config';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';

const WORKFLOW_STEPS: WorkflowStep[] = [
  'patient-list',
  'patient-scan',
  'vitals-capture',
  'adl-voice',
  'incident-report',
  'review-confirm',
];

export const WorkflowProgress: React.FC = () => {
  const { currentStep, language } = useAssessmentStore();
  const t = translations[language];

  const currentIndex = WORKFLOW_STEPS.indexOf(currentStep);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t[`workflow.${currentStep}`]}
      </Text>

      <View style={styles.progressContainer}>
        {WORKFLOW_STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isFuture = index > currentIndex;

          return (
            <View key={step} style={styles.stepContainer}>
              <View
                style={[
                  styles.stepDot,
                  isCompleted && styles.stepDotCompleted,
                  isActive && styles.stepDotActive,
                  isFuture && styles.stepDotFuture,
                ]}
              >
                {isCompleted && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
                {(isActive || isFuture) && (
                  <Text style={[styles.stepNumber, isActive && styles.stepNumberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>

              {index < WORKFLOW_STEPS.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    isCompleted && styles.connectorCompleted,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      <Text style={styles.stepCounter}>
        {currentIndex + 1} / {WORKFLOW_STEPS.length}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stepDotCompleted: {
    backgroundColor: UI_COLORS.success,
    borderColor: UI_COLORS.success,
  },
  stepDotActive: {
    backgroundColor: UI_COLORS.primary,
    borderColor: UI_COLORS.primary,
  },
  stepDotFuture: {
    backgroundColor: '#FFFFFF',
    borderColor: UI_COLORS.border,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepNumber: {
    color: UI_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: UI_COLORS.border,
    marginHorizontal: 4,
  },
  connectorCompleted: {
    backgroundColor: UI_COLORS.success,
  },
  stepCounter: {
    fontSize: 14,
    color: UI_COLORS.textSecondary,
    textAlign: 'right',
  },
});
