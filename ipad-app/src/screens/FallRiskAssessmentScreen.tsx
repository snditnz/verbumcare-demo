import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, HeaderNav, ServerStatusIndicator } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { assessFallRisk, FallRiskFactors } from '@utils/healthcareAssessments';
import { FallRiskAssessment } from '@models/app';

type RootStackParamList = {
  FallRiskAssessment: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FallRiskAssessment'>;
};

export default function FallRiskAssessmentScreen({ navigation }: Props) {
  const { currentPatient, setFallRiskAssessment, setCurrentStep, language } = useAssessmentStore();

  // Risk factors state
  const [historyOfFalls, setHistoryOfFalls] = useState(false);
  const [usesAssistiveDevice, setUsesAssistiveDevice] = useState(false);
  const [unsteadyGait, setUnsteadyGait] = useState(false);
  const [cognitiveImpairment, setCognitiveImpairment] = useState(false);
  const [highRiskMedications, setHighRiskMedications] = useState(false);
  const [visionProblems, setVisionProblems] = useState(false);
  const [environmentalHazards, setEnvironmentalHazards] = useState(false);
  const [urinaryIncontinence, setUrinaryIncontinence] = useState(false);
  const [notes, setNotes] = useState('');

  const t = translations[language];

  useEffect(() => {
    setCurrentStep('fall-risk-assessment');
  }, []);

  // Calculate fall risk assessment
  const riskFactors: FallRiskFactors = useMemo(() => ({
    historyOfFalls,
    usesAssistiveDevice,
    unsteadyGait,
    cognitiveImpairment,
    highRiskMedications,
    visionProblems,
    environmentalHazards,
    urinaryIncontinence,
  }), [historyOfFalls, usesAssistiveDevice, unsteadyGait, cognitiveImpairment, highRiskMedications, visionProblems, environmentalHazards, urinaryIncontinence]);

  const fallRiskResult = useMemo(() => {
    return assessFallRisk(riskFactors);
  }, [riskFactors]);

  const getColorForStatus = (status: string): string => {
    switch (status) {
      case 'green':
        return COLORS.status.normal;
      case 'yellow':
        return COLORS.status.warning;
      case 'red':
        return COLORS.status.critical;
      default:
        return COLORS.status.neutral;
    }
  };

  const handleSave = () => {
    const assessment: FallRiskAssessment = {
      history_of_falls: historyOfFalls,
      uses_assistive_device: usesAssistiveDevice,
      unsteady_gait: unsteadyGait,
      cognitive_impairment: cognitiveImpairment,
      high_risk_medications: highRiskMedications,
      vision_problems: visionProblems,
      environmental_hazards: environmentalHazards,
      urinary_incontinence: urinaryIncontinence,
      risk_score: fallRiskResult.score,
      risk_level: fallRiskResult.riskLevel,
      interventions_recommended: language === 'ja' ? fallRiskResult.interventionsJa : fallRiskResult.interventions,
      notes: notes || undefined,
      recorded_at: new Date(),
    };

    // Show confirmation with summary
    const summary = [
      `${t['fallRisk.score']}: ${fallRiskResult.score}/8`,
      `${t['fallRisk.riskFactors']}: ${fallRiskResult.score}`,
      `${language === 'ja' ? fallRiskResult.statusLabelJa : fallRiskResult.statusLabel}`,
    ].filter(Boolean).join('\n');

    Alert.alert(
      t['dialog.confirmSave'],
      summary,
      [
        { text: t['common.cancel'], style: 'cancel' },
        {
          text: t['common.confirm'],
          onPress: () => {
            // Save to store
            setFallRiskAssessment(assessment);

            Alert.alert(
              t['common.success'],
              language === 'ja' ? '転倒リスク評価を保存しました' : 'Fall risk assessment saved',
              [
                {
                  text: t['common.ok'],
                  onPress: () => navigation.navigate('PatientInfo' as any),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    if (historyOfFalls || usesAssistiveDevice || unsteadyGait || cognitiveImpairment || highRiskMedications || visionProblems || environmentalHazards || urinaryIncontinence || notes) {
      Alert.alert(
        t['dialog.discardChanges'],
        language === 'ja' ? '変更を破棄しますか？' : 'Discard this assessment?',
        [
          { text: t['common.no'], style: 'cancel' },
          {
            text: t['common.discard'],
            style: 'destructive',
            onPress: () => navigation.navigate('PatientInfo' as any),
          },
        ]
      );
    } else {
      navigation.navigate('PatientInfo' as any);
    }
  };

  const RiskFactorCheckbox = ({
    label,
    value,
    onToggle,
    example
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
    example?: string;
  }) => (
    <TouchableOpacity
      style={[styles.checkboxItem, value && styles.checkboxItemSelected]}
      onPress={onToggle}
    >
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value && <Ionicons name="checkmark" size={ICON_SIZES.md} color={COLORS.accent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.checkboxLabel, value && styles.checkboxLabelSelected]}>{label}</Text>
        {example && (
          <Text style={styles.checkboxExample}>{example}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <HeaderNav 
            onBack={handleCancel}
            backLabel={`← ${t['common.cancel']}`}
          />
        </View>
        <View style={styles.headerCenter}>
          {currentPatient && (
            <Text style={styles.patientName}>
              {currentPatient.family_name} {currentPatient.given_name}
            </Text>
          )}
          <Text style={styles.screenTitle}>{t['fallRisk.title']}</Text>
        </View>
        <View style={styles.headerRight}>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Risk Score Display */}
        <Card
          statusColor={getColorForStatus(fallRiskResult.status)}
        >
          <View style={styles.scoreHeader}>
            <Ionicons name="warning" size={ICON_SIZES.lg} color={getColorForStatus(fallRiskResult.status)} />
            <Text style={styles.scoreTitle}>{t['fallRisk.score']}</Text>
            <Text style={[styles.scoreValue, { color: getColorForStatus(fallRiskResult.status) }]}>
              {fallRiskResult.score}/8
            </Text>
          </View>

          <View style={[styles.riskBadge, { backgroundColor: `${getColorForStatus(fallRiskResult.status)}20` }]}>
            <Text style={styles.riskEmoji}>{fallRiskResult.emoji}</Text>
            <Text style={[styles.riskLabel, { color: getColorForStatus(fallRiskResult.status) }]}>
              {language === 'ja' ? fallRiskResult.statusLabelJa : fallRiskResult.statusLabel}
            </Text>
          </View>
        </Card>

        {/* Risk Factors Checklist */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t['fallRisk.riskFactors']}</Text>
          </View>

          <View style={styles.checkboxGrid}>
            <View style={styles.checkboxColumn}>
              <RiskFactorCheckbox
                label={t['fallRisk.historyOfFalls']}
                value={historyOfFalls}
                onToggle={() => setHistoryOfFalls(!historyOfFalls)}
              />
              <RiskFactorCheckbox
                label={t['fallRisk.assistiveDevice']}
                value={usesAssistiveDevice}
                onToggle={() => setUsesAssistiveDevice(!usesAssistiveDevice)}
              />
              <RiskFactorCheckbox
                label={t['fallRisk.unsteadyGait']}
                value={unsteadyGait}
                onToggle={() => setUnsteadyGait(!unsteadyGait)}
              />
              <RiskFactorCheckbox
                label={t['fallRisk.cognitiveImpairment']}
                value={cognitiveImpairment}
                onToggle={() => setCognitiveImpairment(!cognitiveImpairment)}
              />
            </View>

            <View style={styles.checkboxColumn}>
              <RiskFactorCheckbox
                label={t['fallRisk.highRiskMeds']}
                value={highRiskMedications}
                onToggle={() => setHighRiskMedications(!highRiskMedications)}
                example={language === 'ja' ? '例：睡眠薬、抗不安薬、降圧剤' : 'e.g., Sedatives, anxiolytics, antihypertensives'}
              />
              <RiskFactorCheckbox
                label={t['fallRisk.visionProblems']}
                value={visionProblems}
                onToggle={() => setVisionProblems(!visionProblems)}
              />
              <RiskFactorCheckbox
                label={t['fallRisk.environmentalHazards']}
                value={environmentalHazards}
                onToggle={() => setEnvironmentalHazards(!environmentalHazards)}
                example={language === 'ja' ? '例：段差、滑りやすい床、照明不足' : 'e.g., Steps, slippery floors, poor lighting'}
              />
              <RiskFactorCheckbox
                label={t['fallRisk.urinaryIncontinence']}
                value={urinaryIncontinence}
                onToggle={() => setUrinaryIncontinence(!urinaryIncontinence)}
              />
            </View>
          </View>
        </Card>

        {/* Additional Notes */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t['pain.notes']}</Text>
          </View>

          <TextInput
            style={styles.notesInput}
            placeholder={
              language === 'ja'
                ? 'リスク要因の詳細、観察事項などを記録...'
                : 'Record details about risk factors, observations, etc...'
            }
            placeholderTextColor={COLORS.text.disabled}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button variant="outline" onPress={handleCancel}>
          {t['common.cancel']}
        </Button>
        <Button
          variant="primary"
          onPress={handleSave}
        >
          <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.accent} />
          <Text style={[styles.buttonText, { color: COLORS.accent }]}>
            {t['common.save']}
          </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  scoreTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  scoreValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginLeft: 'auto',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  riskEmoji: {
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  riskLabel: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
  checkboxGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  checkboxColumn: {
    flex: 1,
    gap: SPACING.md,
  },
  checkboxList: {
    gap: SPACING.md,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    minHeight: SPACING.touchTarget.comfortable,
  },
  checkboxItemSelected: {
    backgroundColor: `${COLORS.primary}10`,
    borderColor: COLORS.primary,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    flex: 1,
  },
  checkboxLabelSelected: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  checkboxExample: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  interventionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  interventionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    width: '48%',
  },
  interventionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 100,
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
  buttonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginLeft: SPACING.xs,
  },
});
