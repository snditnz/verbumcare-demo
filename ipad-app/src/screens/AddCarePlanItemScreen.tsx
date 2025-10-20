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
import { CarePlanItem, ProblemCategory, ProblemPriority, GoalDuration, InterventionType } from '@models/app';

type RootStackParamList = {
  CarePlanHub: undefined;
  AddCarePlanItem: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddCarePlanItem'>;
};

type Step = 'template' | 'problem' | 'longGoal' | 'shortGoal' | 'interventions' | 'confirm';

const PROBLEM_PRIORITIES: ProblemPriority[] = ['urgent', 'high', 'medium', 'low'];
const GOAL_DURATIONS: GoalDuration[] = ['1_month', '3_months', '6_months', '12_months'];

export default function AddCarePlanItemScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { getCarePlanByPatientId, addCarePlanItem, problemTemplates } = useCarePlanStore();

  const t = translations[language];
  const carePlan = currentPatient ? getCarePlanByPatientId(currentPatient.patient_id) : undefined;

  // Ensure problemTemplates is always an array
  const templates = problemTemplates || [];

  // Form state
  const [currentStep, setCurrentStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  // Problem
  const [problemCategory, setProblemCategory] = useState<ProblemCategory>('ADL');
  const [problemDescription, setProblemDescription] = useState('');
  const [problemPriority, setProblemPriority] = useState<ProblemPriority>('medium');

  // Long-term goal
  const [longTermGoal, setLongTermGoal] = useState('');
  const [longTermDuration, setLongTermDuration] = useState<GoalDuration>('6_months');

  // Short-term goal
  const [shortTermGoal, setShortTermGoal] = useState('');
  const [shortTermDuration, setShortTermDuration] = useState<GoalDuration>('3_months');
  const [achievementCriteria, setAchievementCriteria] = useState('');

  // Interventions
  const [observationNotes, setObservationNotes] = useState('');
  const [careNotes, setCareNotes] = useState('');
  const [educationNotes, setEducationNotes] = useState('');

  if (!currentPatient || !carePlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'ケアプランが見つかりません' : 'Care plan not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleCreate = async () => {
    const now = new Date();
    const longTermTargetDate = new Date(now);
    const shortTermTargetDate = new Date(now);

    // Calculate target dates
    switch (longTermDuration) {
      case '1_month': longTermTargetDate.setMonth(longTermTargetDate.getMonth() + 1); break;
      case '3_months': longTermTargetDate.setMonth(longTermTargetDate.getMonth() + 3); break;
      case '6_months': longTermTargetDate.setMonth(longTermTargetDate.getMonth() + 6); break;
      case '12_months': longTermTargetDate.setMonth(longTermTargetDate.getMonth() + 12); break;
    }

    switch (shortTermDuration) {
      case '1_month': shortTermTargetDate.setMonth(shortTermTargetDate.getMonth() + 1); break;
      case '3_months': shortTermTargetDate.setMonth(shortTermTargetDate.getMonth() + 3); break;
      case '6_months': shortTermTargetDate.setMonth(shortTermTargetDate.getMonth() + 6); break;
      case '12_months': shortTermTargetDate.setMonth(shortTermTargetDate.getMonth() + 12); break;
    }

    const newItem: CarePlanItem = {
      id: `cpi-${Date.now()}`,
      carePlanId: carePlan.id,
      problem: {
        category: problemCategory,
        description: problemDescription,
        priority: problemPriority,
        identifiedDate: now,
        status: 'active'
      },
      longTermGoal: {
        description: longTermGoal,
        targetDate: longTermTargetDate,
        duration: longTermDuration,
        achievementStatus: 0
      },
      shortTermGoal: {
        description: shortTermGoal,
        targetDate: shortTermTargetDate,
        duration: shortTermDuration,
        achievementStatus: 0,
        measurableCriteria: achievementCriteria
      },
      interventions: [],
      linkedAssessments: {},
      progressNotes: [],
      lastUpdated: now,
      updatedBy: 'current-user'
    };

    // Add interventions if provided
    if (observationNotes.trim()) {
      newItem.interventions.push({
        id: `int-obs-${Date.now()}`,
        carePlanItemId: newItem.id,
        type: 'observation',
        observationPlan: {
          whatToMonitor: [observationNotes],
          frequency: 'daily',
          responsibleRole: 'nurse'
        },
        createdDate: now,
        createdBy: 'current-user'
      });
    }

    if (careNotes.trim()) {
      newItem.interventions.push({
        id: `int-care-${Date.now()}`,
        carePlanItemId: newItem.id,
        type: 'care',
        carePlan: {
          serviceType: t['carePlan.care'],
          specificActions: [careNotes],
          frequency: language === 'ja' ? '毎日' : 'Daily',
          duration: '15分',
          equipment: [],
          provider: language === 'ja' ? '介護職員' : 'Care Worker',
          responsibleRole: 'care_worker'
        },
        createdDate: now,
        createdBy: 'current-user'
      });
    }

    if (educationNotes.trim()) {
      newItem.interventions.push({
        id: `int-edu-${Date.now()}`,
        carePlanItemId: newItem.id,
        type: 'education',
        educationPlan: {
          targetAudience: 'both',
          educationGoals: [educationNotes],
          methods: [language === 'ja' ? '口頭指導' : 'Verbal instruction'],
          materials: []
        },
        createdDate: now,
        createdBy: 'current-user'
      });
    }

    await addCarePlanItem(currentPatient.patient_id, newItem);
    navigation.navigate('CarePlanHub');
  };

  const useTemplate = (templateIndex: number) => {
    const template = templates[templateIndex];
    setProblemCategory(template.category);

    // Handle multilingual problem description
    if (language === 'ja') {
      setProblemDescription(template.japanese);
    } else if (language === 'en') {
      setProblemDescription(template.english);
    } else {
      setProblemDescription(template.chinese || template.english);
    }

    // Handle multilingual goals - check if new format (object with language keys) or old format (array)
    const longTermGoals = template.suggestedLongTermGoals;
    const shortTermGoals = template.suggestedShortTermGoals;
    const interventions = template.suggestedInterventions;

    // Long-term goals
    if (Array.isArray(longTermGoals)) {
      // Old format: direct array (for backward compatibility)
      setLongTermGoal(longTermGoals[0]);
    } else if (typeof longTermGoals === 'object' && longTermGoals !== null) {
      // New multilingual format: {ja: [], en: [], zh: []}
      const langKey = language === 'ja' ? 'ja' : language === 'en' ? 'en' : 'zh';
      const goalsArray = (longTermGoals as any)[langKey] || (longTermGoals as any).en || [];
      if (goalsArray.length > 0) {
        setLongTermGoal(goalsArray[0]);
      }
    }

    // Short-term goals
    if (Array.isArray(shortTermGoals)) {
      // Old format: direct array (for backward compatibility)
      setShortTermGoal(shortTermGoals[0]);
    } else if (typeof shortTermGoals === 'object' && shortTermGoals !== null) {
      // New multilingual format: {ja: [], en: [], zh: []}
      const langKey = language === 'ja' ? 'ja' : language === 'en' ? 'en' : 'zh';
      const goalsArray = (shortTermGoals as any)[langKey] || (shortTermGoals as any).en || [];
      if (goalsArray.length > 0) {
        setShortTermGoal(goalsArray[0]);
      }
    }

    // Set intervention suggestions
    let interventionsArray: any[] = [];
    if (Array.isArray(interventions)) {
      // Old format: direct array (for backward compatibility)
      interventionsArray = interventions;
    } else if (typeof interventions === 'object' && interventions !== null) {
      // New multilingual format: {ja: [], en: [], zh: []}
      const langKey = language === 'ja' ? 'ja' : language === 'en' ? 'en' : 'zh';
      interventionsArray = (interventions as any)[langKey] || (interventions as any).en || [];
    }

    const obsIntervention = interventionsArray.find(i => i.type === 'observation');
    if (obsIntervention) setObservationNotes(obsIntervention.description);

    const careIntervention = interventionsArray.find(i => i.type === 'care');
    if (careIntervention) setCareNotes(careIntervention.description);

    const eduIntervention = interventionsArray.find(i => i.type === 'education');
    if (eduIntervention) setEducationNotes(eduIntervention.description);

    setSelectedTemplate(templateIndex);
    setCurrentStep('problem');
  };

  const renderProgressIndicator = () => {
    const steps: Step[] = ['template', 'problem', 'longGoal', 'shortGoal', 'interventions', 'confirm'];
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
                {step === 'template' && (language === 'ja' ? 'テンプレート' : 'Template')}
                {step === 'problem' && (language === 'ja' ? '課題' : 'Problem')}
                {step === 'longGoal' && (language === 'ja' ? '長期目標' : 'Long Goal')}
                {step === 'shortGoal' && (language === 'ja' ? '短期目標' : 'Short Goal')}
                {step === 'interventions' && (language === 'ja' ? '援助' : 'Care')}
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

  const renderTemplateStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {language === 'ja' ? '課題テンプレートを選択（オプション）' : 'Select Problem Template (Optional)'}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? 'よくある課題のテンプレートを使用できます。または「スキップ」を押して独自の課題を作成できます。'
          : 'You can use a common problem template or skip to create your own.'}
      </Text>

      <View style={styles.templateGrid}>
        {templates.map((template, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.templateCard,
              selectedTemplate === index && styles.templateCardActive
            ]}
            onPress={() => useTemplate(index)}
          >
            <View style={styles.templateHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(template.category) }]}>
                <Text style={styles.categoryBadgeText}>{t[`carePlan.category.${template.category}`]}</Text>
              </View>
            </View>
            <Text style={styles.templateTitle}>
              {language === 'ja' ? template.japanese : language === 'en' ? template.english : (template.chinese || template.english)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        variant="outline"
        onPress={() => setCurrentStep('problem')}
        style={{ marginTop: SPACING.lg }}
      >
        {language === 'ja' ? 'スキップして独自の課題を作成' : 'Skip and create custom problem'}
      </Button>
    </View>
  );

  const renderProblemStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {t['carePlan.problem']}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja' ? '患者の課題やニーズを記載してください' : 'Describe the patient\'s problem or need'}
      </Text>

      <Text style={styles.label}>{t['carePlan.category.ADL']}</Text>
      <View style={styles.categoryGrid}>
        {(['ADL', 'fall_prevention', 'pain_management', 'nutrition', 'cognition', 'psychosocial'] as ProblemCategory[]).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryButton,
              problemCategory === cat && styles.categoryButtonActive
            ]}
            onPress={() => setProblemCategory(cat)}
          >
            <Text style={[
              styles.categoryButtonText,
              problemCategory === cat && styles.categoryButtonTextActive
            ]}>
              {t[`carePlan.category.${cat}`]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>
        {language === 'ja' ? '課題の説明' : 'Problem Description'}
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder={language === 'ja' ? '例: トイレ動作時にふらつきがあり、転倒の危険性がある' : 'e.g., Unsteady gait during toileting with risk of falling'}
        value={problemDescription}
        onChangeText={setProblemDescription}
        placeholderTextColor={COLORS.text.disabled}
      />

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>{t['carePlan.priority']}</Text>
      <View style={styles.priorityGrid}>
        {PROBLEM_PRIORITIES.map((priority) => (
          <TouchableOpacity
            key={priority}
            style={[
              styles.priorityButton,
              problemPriority === priority && styles.priorityButtonActive
            ]}
            onPress={() => setProblemPriority(priority)}
          >
            <Text style={[
              styles.priorityButtonText,
              problemPriority === priority && styles.priorityButtonTextActive
            ]}>
              {t[`carePlan.${priority}`]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderLongGoalStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {t['carePlan.longTermGoal']}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? '患者が達成すべき長期的な目標を設定してください'
          : 'Set the long-term goal for the patient to achieve'}
      </Text>

      <Text style={styles.label}>
        {language === 'ja' ? '目標の内容' : 'Goal Description'}
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder={language === 'ja' ? '例: 日中、見守りのみでトイレ動作ができる' : 'e.g., Able to toilet independently with supervision during daytime'}
        value={longTermGoal}
        onChangeText={setLongTermGoal}
        placeholderTextColor={COLORS.text.disabled}
      />

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>
        {language === 'ja' ? '達成期間' : 'Duration'}
      </Text>
      <View style={styles.durationGrid}>
        {GOAL_DURATIONS.map((duration) => (
          <TouchableOpacity
            key={duration}
            style={[
              styles.durationButton,
              longTermDuration === duration && styles.durationButtonActive
            ]}
            onPress={() => setLongTermDuration(duration)}
          >
            <Text style={[
              styles.durationButtonText,
              longTermDuration === duration && styles.durationButtonTextActive
            ]}>
              {formatDuration(duration, language)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderShortGoalStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {t['carePlan.shortTermGoal']}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? '長期目標達成のための短期的なステップを設定してください'
          : 'Set a short-term step towards achieving the long-term goal'}
      </Text>

      <Text style={styles.label}>
        {language === 'ja' ? '目標の内容' : 'Goal Description'}
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder={language === 'ja' ? '例: 手すりを使用してトイレまで歩行できる' : 'e.g., Able to walk to toilet using handrails'}
        value={shortTermGoal}
        onChangeText={setShortTermGoal}
        placeholderTextColor={COLORS.text.disabled}
      />

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>
        {language === 'ja' ? '達成期間' : 'Duration'}
      </Text>
      <View style={styles.durationGrid}>
        {GOAL_DURATIONS.map((duration) => (
          <TouchableOpacity
            key={duration}
            style={[
              styles.durationButton,
              shortTermDuration === duration && styles.durationButtonActive
            ]}
            onPress={() => setShortTermDuration(duration)}
          >
            <Text style={[
              styles.durationButtonText,
              shortTermDuration === duration && styles.durationButtonTextActive
            ]}>
              {formatDuration(duration, language)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>
        {t['carePlan.achievementCriteria']}
      </Text>
      <TextInput
        style={styles.textInput}
        placeholder={language === 'ja' ? '例: 10m歩行可能、転倒なし' : 'e.g., Walk 10m without falling'}
        value={achievementCriteria}
        onChangeText={setAchievementCriteria}
        placeholderTextColor={COLORS.text.disabled}
      />
    </View>
  );

  const renderInterventionsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.sectionTitle}>
        {t['carePlan.interventions']}
      </Text>
      <Text style={styles.sectionDescription}>
        {language === 'ja'
          ? '目標達成のための援助内容を記載してください（オプション）'
          : 'Describe interventions to achieve the goals (optional)'}
      </Text>

      <Text style={styles.label}>
        {t['carePlan.observation']} ({language === 'ja' ? '観察計画' : 'Observation Plan'})
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        placeholder={language === 'ja' ? '例: トイレ動作時の様子、転倒リスクを毎回観察' : 'e.g., Monitor toileting and fall risk at each instance'}
        value={observationNotes}
        onChangeText={setObservationNotes}
        placeholderTextColor={COLORS.text.disabled}
      />

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>
        {t['carePlan.care']} ({language === 'ja' ? 'ケア計画' : 'Care Plan'})
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        placeholder={language === 'ja' ? '例: 歩行器使用指導、手すり活用支援' : 'e.g., Assist with walker use and handrail guidance'}
        value={careNotes}
        onChangeText={setCareNotes}
        placeholderTextColor={COLORS.text.disabled}
      />

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>
        {t['carePlan.education']} ({language === 'ja' ? '指導計画' : 'Education Plan'})
      </Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        placeholder={language === 'ja' ? '例: 安全なトイレ動作の指導' : 'e.g., Teach safe toileting techniques'}
        value={educationNotes}
        onChangeText={setEducationNotes}
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
        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionTitle}>{t['carePlan.problem']}</Text>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{language === 'ja' ? 'カテゴリー' : 'Category'}</Text>
            <Text style={styles.confirmValue}>{t[`carePlan.category.${problemCategory}`]}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{language === 'ja' ? '説明' : 'Description'}</Text>
            <Text style={styles.confirmValue}>{problemDescription}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t['carePlan.priority']}</Text>
            <Text style={styles.confirmValue}>{t[`carePlan.${problemPriority}`]}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionTitle}>{t['carePlan.longTermGoal']}</Text>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmValue}>{longTermGoal}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{language === 'ja' ? '期間' : 'Duration'}</Text>
            <Text style={styles.confirmValue}>{formatDuration(longTermDuration, language)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionTitle}>{t['carePlan.shortTermGoal']}</Text>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmValue}>{shortTermGoal}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{language === 'ja' ? '期間' : 'Duration'}</Text>
            <Text style={styles.confirmValue}>{formatDuration(shortTermDuration, language)}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t['carePlan.achievementCriteria']}</Text>
            <Text style={styles.confirmValue}>{achievementCriteria || '-'}</Text>
          </View>
        </View>

        {(observationNotes || careNotes || educationNotes) && (
          <>
            <View style={styles.divider} />
            <View style={styles.confirmSection}>
              <Text style={styles.confirmSectionTitle}>{t['carePlan.interventions']}</Text>
              {observationNotes && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t['carePlan.observation']}</Text>
                  <Text style={styles.confirmValue}>{observationNotes}</Text>
                </View>
              )}
              {careNotes && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t['carePlan.care']}</Text>
                  <Text style={styles.confirmValue}>{careNotes}</Text>
                </View>
              )}
              {educationNotes && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t['carePlan.education']}</Text>
                  <Text style={styles.confirmValue}>{educationNotes}</Text>
                </View>
              )}
            </View>
          </>
        )}
      </Card>
    </View>
  );

  const canProceed = () => {
    switch (currentStep) {
      case 'template':
        return true; // Can always skip
      case 'problem':
        return problemDescription.trim() !== '';
      case 'longGoal':
        return longTermGoal.trim() !== '';
      case 'shortGoal':
        return shortTermGoal.trim() !== '' && achievementCriteria.trim() !== '';
      case 'interventions':
        return true; // Interventions are optional
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const steps: Step[] = ['template', 'problem', 'longGoal', 'shortGoal', 'interventions', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      handleCreate();
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['template', 'problem', 'longGoal', 'shortGoal', 'interventions', 'confirm'];
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
            {t['carePlan.addNewProblem']}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      {/* Progress Indicator */}
      {renderProgressIndicator()}

      <ScrollView style={styles.content}>
        {currentStep === 'template' && renderTemplateStep()}
        {currentStep === 'problem' && renderProblemStep()}
        {currentStep === 'longGoal' && renderLongGoalStep()}
        {currentStep === 'shortGoal' && renderShortGoalStep()}
        {currentStep === 'interventions' && renderInterventionsStep()}
        {currentStep === 'confirm' && renderConfirmStep()}
      </ScrollView>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <Button
          variant="outline"
          onPress={handleBack}
          style={{ flex: 1, marginRight: SPACING.sm }}
        >
          {currentStep === 'template'
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
            ? (language === 'ja' ? '追加' : 'Add')
            : (language === 'ja' ? '次へ' : 'Next')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

// Helper functions
function formatDuration(duration: GoalDuration, language: 'ja' | 'en'): string {
  const durations = {
    '1_month': { ja: '1ヶ月', en: '1 Month' },
    '3_months': { ja: '3ヶ月', en: '3 Months' },
    '6_months': { ja: '6ヶ月', en: '6 Months' },
    '12_months': { ja: '12ヶ月', en: '12 Months' },
  };
  return durations[duration][language];
}

function getCategoryColor(category: ProblemCategory): string {
  const colors: Record<ProblemCategory, string> = {
    ADL: `${COLORS.primary}20`,
    fall_prevention: `${COLORS.status.warning}20`,
    pain_management: `${COLORS.status.error}20`,
    nutrition: `${COLORS.accent}20`,
    skin_integrity: `${COLORS.status.normal}20`,
    cognition: `${COLORS.primary}20`,
    psychosocial: `${COLORS.accent}20`,
    medical: `${COLORS.status.error}20`,
    other: `${COLORS.text.secondary}20`,
  };
  return colors[category];
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
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  stepIndicator: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
  },
  stepNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.disabled,
  },
  stepNumberActive: {
    color: COLORS.surface,
  },
  stepLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  stepConnector: {
    height: 2,
    width: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
    marginBottom: 20,
  },
  stepConnectorActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  stepContent: {
    maxWidth: 900,
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
  label: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
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
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  templateCard: {
    width: `calc(50% - ${SPACING.sm}px)`,
    minWidth: 280,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  templateCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}05`,
  },
  templateHeader: {
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  templateTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  categoryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  categoryButtonTextActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  priorityGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  priorityButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  priorityButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  priorityButtonTextActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  durationGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  durationButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  durationButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  durationButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  durationButtonTextActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  confirmSection: {
    marginBottom: SPACING.md,
  },
  confirmSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  confirmRow: {
    marginBottom: SPACING.sm,
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
