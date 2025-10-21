import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { DEMO_STAFF_ID } from '@constants/config';
import { CareLevel, CarePlan } from '@models/app';

type RootStackParamList = {
  CarePlanHub: undefined;
  CreateCarePlan: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateCarePlan'>;
};

type Step = 'basic' | 'intents' | 'policy' | 'confirm';

const CARE_LEVELS: CareLevel[] = ['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'];

const CARE_LEVEL_TRANSLATIONS: Record<CareLevel, { ja: string; en: string }> = {
  '要支援1': { ja: '要支援1', en: 'Support Level 1' },
  '要支援2': { ja: '要支援2', en: 'Support Level 2' },
  '要介護1': { ja: '要介護1', en: 'Care Level 1' },
  '要介護2': { ja: '要介護2', en: 'Care Level 2' },
  '要介護3': { ja: '要介護3', en: 'Care Level 3' },
  '要介護4': { ja: '要介護4', en: 'Care Level 4' },
  '要介護5': { ja: '要介護5', en: 'Care Level 5' },
};

export default function CreateCarePlanScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { createCarePlan } = useCarePlanStore();

  const t = translations[language];

  // Form state
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [careLevel, setCareLevel] = useState<CareLevel>('要介護3');
  const [patientIntent, setPatientIntent] = useState('');
  const [familyIntent, setFamilyIntent] = useState('');
  const [comprehensivePolicy, setComprehensivePolicy] = useState('');

  if (!currentPatient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyText}>{language === 'ja' ? '患者が選択されていません' : 'No patient selected'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleCreate = async () => {
    try {
      // Calculate dates
      const now = new Date();
      const sixMonthsLater = new Date(now);
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      const threeMonthsLater = new Date(now);
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      // Create the new care plan (without id and auditLog - backend generates these)
      const newCarePlan = {
        patientId: currentPatient.patient_id,
        careLevel,
        status: 'active' as const,
        version: 1,
        createdDate: now,
        lastReviewDate: now,
        nextReviewDate: sixMonthsLater,
        createdBy: 'current-user',

        patientIntent,
        familyIntent,
        comprehensivePolicy,

        carePlanItems: [],
        weeklySchedule: [],

        careManagerId: DEMO_STAFF_ID,
        teamMembers: [
          { userId: DEMO_STAFF_ID, name: '田中 ケアマネジャー', role: 'care_manager' as const, assigned: true }
        ],

        lastMonitoringDate: undefined,
        nextMonitoringDate: threeMonthsLater,
        monitoringRecords: [],
      };

      await createCarePlan(newCarePlan);
      navigation.navigate('CarePlanHub');
    } catch (error) {
      console.error('Failed to create care plan:', error);
      // Error is handled in the store and will show in UI
    }
  };

  const renderProgressIndicator = () => {
    const steps: Step[] = ['basic', 'intents', 'policy', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);

    return (
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <View style={styles.stepIndicator}>
              <View style={[
                styles.stepCircle,
                index <= currentIndex && styles.stepCircleActive
              ]}>
                <Text style={[
                  styles.stepNumber,
                  index <= currentIndex && styles.stepNumberActive
                ]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.stepLabel}>
                {step === 'basic' && (language === 'ja' ? '基本情報' : 'Basic Info')}
                {step === 'intents' && (language === 'ja' ? '意向' : 'Intents')}
                {step === 'policy' && (language === 'ja' ? '援助方針' : 'Policy')}
                {step === 'confirm' && (language === 'ja' ? '確認' : 'Confirm')}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View style={[
                styles.stepConnector,
                index < currentIndex && styles.stepConnectorActive
              ]} />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderBasicStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {language === 'ja' ? '介護度を選択' : 'Select Care Level'}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? '患者さんの介護保険認定を選択してください'
          : 'Select the patient\'s long-term care insurance level'}
      </Text>

      <View style={styles.careLevelGrid}>
        {CARE_LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.careLevelButton,
              careLevel === level && styles.careLevelButtonActive
            ]}
            onPress={() => setCareLevel(level)}
          >
            <Text style={[
              styles.careLevelText,
              careLevel === level && styles.careLevelTextActive
            ]}>
              {CARE_LEVEL_TRANSLATIONS[level][language]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderIntentsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {t['carePlan.patientIntent']}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? '患者さんの希望や意向を記録してください'
          : 'Record the patient\'s wishes and intentions'}
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder={language === 'ja' ? '例: できるだけ自分でトイレに行きたい。家族に迷惑をかけたくない' : 'e.g., I want to use the bathroom independently as much as possible'}
        value={patientIntent}
        onChangeText={setPatientIntent}
        placeholderTextColor={COLORS.text.disabled}
      />

      <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>
        {t['carePlan.familyIntent']}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? 'ご家族の希望や意向を記録してください'
          : 'Record the family\'s wishes and intentions'}
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder={language === 'ja' ? '例: 母が安全に生活できるようサポートしてほしい（長女）' : 'e.g., We want support for our mother to live safely'}
        value={familyIntent}
        onChangeText={setFamilyIntent}
        placeholderTextColor={COLORS.text.disabled}
      />
    </View>
  );

  const renderPolicyStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {t['carePlan.comprehensivePolicy']}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? '総合的な援助の方針を記載してください。患者・家族の意向を踏まえ、どのようなケアを提供するか説明します。'
          : 'Describe the comprehensive care policy. Explain what care will be provided based on patient and family intentions.'}
      </Text>
      <TextInput
        style={[styles.textArea, { minHeight: 150 }]}
        multiline
        numberOfLines={6}
        placeholder={language === 'ja' ? '例: トイレ動作の自立支援を中心に、転倒リスクを軽減しながらADL維持を図る。家族との良好な関係を保ちながら施設生活への適応を支援する。' : 'e.g., Focus on supporting independent toileting while reducing fall risk and maintaining ADL'}
        value={comprehensivePolicy}
        onChangeText={setComprehensivePolicy}
        placeholderTextColor={COLORS.text.disabled}
      />
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {language === 'ja' ? '内容を確認' : 'Confirm Details'}
      </Text>

      <Card style={{ marginTop: SPACING.md }}>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>{language === 'ja' ? '患者' : 'Patient'}</Text>
          <Text style={styles.confirmValue}>
            {currentPatient.family_name} {currentPatient.given_name}
          </Text>
        </View>

        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>{t['carePlan.careLevel']}</Text>
          <Text style={styles.confirmValue}>{CARE_LEVEL_TRANSLATIONS[careLevel][language]}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>{t['carePlan.patientIntent']}</Text>
          <Text style={styles.confirmValue}>{patientIntent || '-'}</Text>
        </View>

        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>{t['carePlan.familyIntent']}</Text>
          <Text style={styles.confirmValue}>{familyIntent || '-'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>{t['carePlan.comprehensivePolicy']}</Text>
          <Text style={styles.confirmValue}>{comprehensivePolicy || '-'}</Text>
        </View>
      </Card>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={ICON_SIZES.md} color={COLORS.primary} />
        <Text style={styles.infoText}>
          {language === 'ja'
            ? 'ケアプラン作成後、課題・目標・援助内容を追加できます'
            : 'After creating the care plan, you can add problems, goals, and interventions'}
        </Text>
      </View>
    </View>
  );

  const canProceed = () => {
    switch (currentStep) {
      case 'basic':
        return careLevel !== null;
      case 'intents':
        return patientIntent.trim() !== '' && familyIntent.trim() !== '';
      case 'policy':
        return comprehensivePolicy.trim() !== '';
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const steps: Step[] = ['basic', 'intents', 'policy', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      handleCreate();
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['basic', 'intents', 'policy', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={handleBack}>
            {`← ${t['common.back']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.patientName}>
            {currentPatient.family_name} {currentPatient.given_name}
          </Text>
          <Text style={styles.screenTitle}>
            {language === 'ja' ? 'ケアプラン作成' : 'Create Care Plan'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      {/* Progress Indicator */}
      {renderProgressIndicator()}

      <ScrollView style={styles.content}>
        {currentStep === 'basic' && renderBasicStep()}
        {currentStep === 'intents' && renderIntentsStep()}
        {currentStep === 'policy' && renderPolicyStep()}
        {currentStep === 'confirm' && renderConfirmStep()}
      </ScrollView>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <Button
          variant="outline"
          onPress={handleBack}
          style={{ flex: 1, marginRight: SPACING.sm }}
        >
          {currentStep === 'basic'
            ? t['common.cancel']
            : (language === 'ja' ? '戻る' : 'Back')}
        </Button>
        <Button
          variant="primary"
          onPress={handleNext}
          disabled={!canProceed()}
          style={{ flex: 1, marginLeft: SPACING.sm }}
        >
          {currentStep === 'confirm'
            ? (language === 'ja' ? '作成' : 'Create')
            : (language === 'ja' ? '次へ' : 'Next')}
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.surface,
  },
  stepIndicator: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
  },
  stepNumber: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.disabled,
  },
  stepNumberActive: {
    color: COLORS.surface,
  },
  stepLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  stepConnector: {
    height: 2,
    width: 60,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
    marginBottom: 24,
  },
  stepConnectorActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  stepContent: {
    maxWidth: 800,
    marginHorizontal: 'auto',
    width: '100%',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  sectionDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  careLevelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  careLevelButton: {
    minWidth: 120,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  careLevelButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  careLevelText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
  },
  careLevelTextActive: {
    color: COLORS.primary,
  },
  textArea: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  confirmRow: {
    marginBottom: SPACING.md,
  },
  confirmLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  confirmValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginTop: SPACING.lg,
  },
  infoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.disabled,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
});
