import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import Slider from '@react-native-community/slider';
import { MonitoringRecord, MonitoringType, InterventionEffectiveness, ItemReview } from '@types/app';

type RootStackParamList = {
  MonitoringForm: undefined;
  CarePlanHub: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MonitoringForm'>;
};

type ReviewState = {
  [itemId: string]: {
    longTermStatus: number;
    shortTermStatus: number;
    effectiveness: InterventionEffectiveness;
    needsModification: boolean;
    modifications: string;
    comments: string;
  };
};

export default function MonitoringFormScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { getCarePlanByPatientId, createMonitoringRecord } = useCarePlanStore();

  const t = translations[language];
  const carePlan = currentPatient ? getCarePlanByPatientId(currentPatient.patient_id) : undefined;

  // State
  const [monitoringType, setMonitoringType] = useState<MonitoringType>('routine_3month');
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [reviews, setReviews] = useState<ReviewState>({});
  const [overallStatus, setOverallStatus] = useState<string>('');
  const [patientFeedback, setPatientFeedback] = useState<string>('');
  const [familyFeedback, setFamilyFeedback] = useState<string>('');
  const [staffObservations, setStaffObservations] = useState<string>('');
  const [actionItems, setActionItems] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showOverallSection, setShowOverallSection] = useState<boolean>(false);

  if (!currentPatient || !carePlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Button variant="text" onPress={() => navigation.goBack()}>
              {`← ${t['common.back']}`}
            </Button>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.screenTitle}>
              {language === 'ja' ? 'モニタリング記録' : 'Monitoring Record'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <LanguageToggle />
          </View>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'ケアプランが見つかりません' : 'Care plan not found'}
          </Text>
          <Text style={[styles.emptyText, { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.sm }]}>
            {language === 'ja'
              ? '患者のケアプランを先に作成してください'
              : 'Please create a care plan for this patient first'}
          </Text>
          <Button variant="primary" onPress={() => navigation.goBack()} style={{ marginTop: SPACING.xl }}>
            {language === 'ja' ? '戻る' : 'Go Back'}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const activeItems = carePlan.carePlanItems.filter(item => item.problem.status === 'active');

  // Show empty state if no active items
  if (activeItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Button variant="text" onPress={() => navigation.goBack()}>
              {`← ${t['common.back']}`}
            </Button>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.patientName}>
              {currentPatient.family_name} {currentPatient.given_name}
            </Text>
            <Text style={styles.screenTitle}>
              {language === 'ja' ? 'モニタリング記録' : 'Monitoring Record'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <LanguageToggle />
          </View>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={64} color={COLORS.success} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'アクティブなケアプラン項目がありません' : 'No active care plan items'}
          </Text>
          <Text style={[styles.emptyText, { fontSize: TYPOGRAPHY.fontSize.sm, marginTop: SPACING.sm }]}>
            {language === 'ja'
              ? 'モニタリングを実施するには、ケアプランにアクティブな項目が必要です'
              : 'Active care plan items are required to conduct monitoring'}
          </Text>
          <Button variant="primary" onPress={() => navigation.goBack()} style={{ marginTop: SPACING.xl }}>
            {language === 'ja' ? 'ケアプランに戻る' : 'Back to Care Plan'}
          </Button>
        </View>
      </SafeAreaView>
    );
  }
  const currentItem = activeItems[currentItemIndex];
  const currentReview = reviews[currentItem?.id] || {
    longTermStatus: currentItem?.longTermGoal.achievementStatus || 0,
    shortTermStatus: currentItem?.shortTermGoal.achievementStatus || 0,
    effectiveness: 'effective' as InterventionEffectiveness,
    needsModification: false,
    modifications: '',
    comments: '',
  };

  const updateReview = (itemId: string, updates: Partial<typeof currentReview>) => {
    setReviews(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || currentReview),
        ...updates,
      },
    }));
  };

  const handleNextItem = () => {
    if (currentItemIndex < activeItems.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      // All items reviewed, show overall section
      setShowOverallSection(true);
    }
  };

  const handlePreviousItem = () => {
    if (showOverallSection) {
      setShowOverallSection(false);
    } else if (currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate overall section
    if (!overallStatus.trim()) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '全体評価を入力してください' : 'Please enter overall status'
      );
      return;
    }

    setIsSaving(true);

    try {
      // Convert reviews to ItemReview format
      const itemReviews: ItemReview[] = activeItems.map(item => ({
        carePlanItemId: item.id,
        goalProgress: {
          longTermStatus: reviews[item.id]?.longTermStatus || item.longTermGoal.achievementStatus,
          shortTermStatus: reviews[item.id]?.shortTermStatus || item.shortTermGoal.achievementStatus,
          comments: reviews[item.id]?.comments || '',
        },
        interventionEffectiveness: reviews[item.id]?.effectiveness || 'effective',
        needsModification: reviews[item.id]?.needsModification || false,
        modifications: reviews[item.id]?.modifications || '',
      }));

      // Calculate next monitoring date (3 months from now)
      const nextMonitoringDate = new Date();
      nextMonitoringDate.setMonth(nextMonitoringDate.getMonth() + 3);

      // Create monitoring record
      const monitoringRecord: MonitoringRecord = {
        id: `monitoring_${Date.now()}`,
        carePlanId: carePlan.id,
        monitoringDate: new Date(),
        monitoringType,
        conductedBy: 'current_user', // TODO: Get from auth context
        conductedByName: language === 'ja' ? '担当者' : 'Staff Member',
        itemReviews,
        overallStatus: overallStatus.trim(),
        patientFeedback: patientFeedback.trim(),
        familyFeedback: familyFeedback.trim(),
        staffObservations: staffObservations.trim(),
        proposedChanges: {
          newProblems: [],
          resolvedProblems: [],
          goalAdjustments: [],
          interventionChanges: [],
        },
        nextMonitoringDate,
        actionItems: actionItems.trim().split('\n').filter(item => item.trim()),
      };

      await createMonitoringRecord(carePlan.id, monitoringRecord);

      Alert.alert(
        language === 'ja' ? '保存完了' : 'Saved',
        language === 'ja' ? 'モニタリング記録が保存されました' : 'Monitoring record saved successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '保存に失敗しました' : 'Failed to save monitoring record'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getMonitoringTypeLabel = (type: MonitoringType): string => {
    const labels: Record<MonitoringType, { ja: string; en: string }> = {
      routine_3month: { ja: '定期モニタリング（3ヶ月）', en: '3-Month Routine Monitoring' },
      formal_6month: { ja: '公式評価（6ヶ月）', en: '6-Month Formal Review' },
      condition_change: { ja: '状態変化時', en: 'Condition Change Review' },
    };
    return language === 'ja' ? labels[type].ja : labels[type].en;
  };

  const getEffectivenessLabel = (effectiveness: InterventionEffectiveness): string => {
    const labels: Record<InterventionEffectiveness, { ja: string; en: string }> = {
      very_effective: { ja: '非常に効果的', en: 'Very Effective' },
      effective: { ja: '効果的', en: 'Effective' },
      somewhat_effective: { ja: 'やや効果的', en: 'Somewhat Effective' },
      not_effective: { ja: '効果なし', en: 'Not Effective' },
    };
    return language === 'ja' ? labels[effectiveness].ja : labels[effectiveness].en;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={() => navigation.goBack()}>
            {`← ${t['common.back']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.patientName}>
            {currentPatient.family_name} {currentPatient.given_name}
          </Text>
          <Text style={styles.screenTitle}>
            {language === 'ja' ? 'モニタリング記録' : 'Monitoring Record'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Progress Indicator */}
        {!showOverallSection && (
          <Card>
            <View style={styles.progressIndicator}>
              <Text style={styles.progressText}>
                {language === 'ja' ? '項目' : 'Item'} {currentItemIndex + 1} / {activeItems.length}
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${((currentItemIndex + 1) / activeItems.length) * 100}%` }
                  ]}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Monitoring Type Selector (only on first item) */}
        {currentItemIndex === 0 && !showOverallSection && (
          <Card>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={ICON_SIZES.lg} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>
                {language === 'ja' ? 'モニタリング種類' : 'Monitoring Type'}
              </Text>
            </View>

            {(['routine_3month', 'formal_6month', 'condition_change'] as MonitoringType[]).map(type => (
              <Button
                key={type}
                variant={monitoringType === type ? 'primary' : 'outline'}
                onPress={() => setMonitoringType(type)}
                style={{ marginBottom: SPACING.sm }}
              >
                {getMonitoringTypeLabel(type)}
              </Button>
            ))}
          </Card>
        )}

        {/* Item Review Section */}
        {!showOverallSection && currentItem && (
          <>
            <Card>
              <View style={styles.itemHeader}>
                <View style={styles.itemHeaderLeft}>
                  <Text style={styles.itemCategory}>
                    {t[`carePlan.category.${currentItem.problem.category}`]}
                  </Text>
                  <Text style={styles.itemDescription}>{currentItem.problem.description}</Text>
                </View>
                <View style={[styles.priorityBadge, { borderColor: COLORS.status.warning }]}>
                  <Text style={[styles.priorityText, { color: COLORS.status.warning }]}>
                    {t[`carePlan.${currentItem.problem.priority}`]}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Goal Progress */}
            <Card>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={ICON_SIZES.lg} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>
                  {language === 'ja' ? '目標達成状況' : 'Goal Achievement'}
                </Text>
              </View>

              {/* Long-term Goal */}
              <View style={styles.goalSection}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalLabel}>{t['carePlan.longTermGoal']}</Text>
                  <Text style={styles.goalPercent}>{currentReview.longTermStatus}%</Text>
                </View>
                <Text style={styles.goalDescription}>{currentItem.longTermGoal.description}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  value={currentReview.longTermStatus}
                  onValueChange={(value) => updateReview(currentItem.id, { longTermStatus: value })}
                  minimumTrackTintColor={COLORS.accent}
                  maximumTrackTintColor={COLORS.border}
                  thumbTintColor={COLORS.accent}
                />
              </View>

              {/* Short-term Goal */}
              <View style={styles.goalSection}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalLabel}>{t['carePlan.shortTermGoal']}</Text>
                  <Text style={styles.goalPercent}>{currentReview.shortTermStatus}%</Text>
                </View>
                <Text style={styles.goalDescription}>{currentItem.shortTermGoal.description}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  value={currentReview.shortTermStatus}
                  onValueChange={(value) => updateReview(currentItem.id, { shortTermStatus: value })}
                  minimumTrackTintColor={COLORS.accent}
                  maximumTrackTintColor={COLORS.border}
                  thumbTintColor={COLORS.accent}
                />
              </View>
            </Card>

            {/* Intervention Effectiveness */}
            <Card>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle" size={ICON_SIZES.lg} color={COLORS.status.normal} />
                <Text style={styles.sectionTitle}>
                  {language === 'ja' ? '介入の効果' : 'Intervention Effectiveness'}
                </Text>
              </View>

              {(['very_effective', 'effective', 'somewhat_effective', 'not_effective'] as InterventionEffectiveness[]).map(
                effectiveness => (
                  <Button
                    key={effectiveness}
                    variant={currentReview.effectiveness === effectiveness ? 'primary' : 'outline'}
                    onPress={() => updateReview(currentItem.id, { effectiveness })}
                    style={{ marginBottom: SPACING.sm }}
                  >
                    {getEffectivenessLabel(effectiveness)}
                  </Button>
                )
              )}
            </Card>

            {/* Modifications */}
            <Card>
              <View style={styles.sectionHeader}>
                <Ionicons name="create" size={ICON_SIZES.lg} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>
                  {language === 'ja' ? '変更・コメント' : 'Modifications & Comments'}
                </Text>
              </View>

              <TextInput
                style={styles.textInput}
                placeholder={language === 'ja' ? 'この項目に関するコメントを入力...' : 'Enter comments about this item...'}
                placeholderTextColor={COLORS.text.disabled}
                multiline
                numberOfLines={4}
                value={currentReview.comments}
                onChangeText={(text) => updateReview(currentItem.id, { comments: text })}
                textAlignVertical="top"
              />

              <View style={styles.checkboxContainer}>
                <Button
                  variant={currentReview.needsModification ? 'primary' : 'outline'}
                  onPress={() => updateReview(currentItem.id, { needsModification: !currentReview.needsModification })}
                >
                  {currentReview.needsModification ? '✓ ' : ''}
                  {language === 'ja' ? '変更が必要' : 'Needs Modification'}
                </Button>
              </View>

              {currentReview.needsModification && (
                <TextInput
                  style={[styles.textInput, { marginTop: SPACING.md }]}
                  placeholder={language === 'ja' ? '必要な変更内容を入力...' : 'Describe needed modifications...'}
                  placeholderTextColor={COLORS.text.disabled}
                  multiline
                  numberOfLines={3}
                  value={currentReview.modifications}
                  onChangeText={(text) => updateReview(currentItem.id, { modifications: text })}
                  textAlignVertical="top"
                />
              )}
            </Card>
          </>
        )}

        {/* Overall Assessment Section */}
        {showOverallSection && (
          <>
            <Card>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text" size={ICON_SIZES.lg} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>
                  {language === 'ja' ? '全体評価' : 'Overall Assessment'}
                </Text>
              </View>

              <Text style={styles.inputLabel}>
                {language === 'ja' ? '全体的な状況' : 'Overall Status'} *
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={language === 'ja' ? '全体的な状況を記入...' : 'Enter overall status...'}
                placeholderTextColor={COLORS.text.disabled}
                multiline
                numberOfLines={4}
                value={overallStatus}
                onChangeText={setOverallStatus}
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, { marginTop: SPACING.lg }]}>
                {language === 'ja' ? '利用者の意見' : 'Patient Feedback'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={language === 'ja' ? '利用者の意見を記入...' : 'Enter patient feedback...'}
                placeholderTextColor={COLORS.text.disabled}
                multiline
                numberOfLines={3}
                value={patientFeedback}
                onChangeText={setPatientFeedback}
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, { marginTop: SPACING.lg }]}>
                {language === 'ja' ? '家族の意見' : 'Family Feedback'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={language === 'ja' ? '家族の意見を記入...' : 'Enter family feedback...'}
                placeholderTextColor={COLORS.text.disabled}
                multiline
                numberOfLines={3}
                value={familyFeedback}
                onChangeText={setFamilyFeedback}
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, { marginTop: SPACING.lg }]}>
                {language === 'ja' ? '職員の観察' : 'Staff Observations'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={language === 'ja' ? '職員の観察を記入...' : 'Enter staff observations...'}
                placeholderTextColor={COLORS.text.disabled}
                multiline
                numberOfLines={3}
                value={staffObservations}
                onChangeText={setStaffObservations}
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, { marginTop: SPACING.lg }]}>
                {language === 'ja' ? 'アクションアイテム（1行に1つ）' : 'Action Items (one per line)'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={language === 'ja' ? 'アクションアイテムを入力...' : 'Enter action items...'}
                placeholderTextColor={COLORS.text.disabled}
                multiline
                numberOfLines={4}
                value={actionItems}
                onChangeText={setActionItems}
                textAlignVertical="top"
              />
            </Card>
          </>
        )}

        {/* Navigation Buttons */}
        <View style={styles.actions}>
          {currentItemIndex > 0 || showOverallSection ? (
            <Button variant="outline" onPress={handlePreviousItem} style={{ flex: 1 }}>
              {language === 'ja' ? '← 前へ' : '← Previous'}
            </Button>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {showOverallSection ? (
            <Button variant="primary" onPress={handleSubmit} disabled={isSaving} style={{ flex: 1 }}>
              {isSaving
                ? (language === 'ja' ? '保存中...' : 'Saving...')
                : (language === 'ja' ? '保存' : 'Submit')}
            </Button>
          ) : (
            <Button variant="primary" onPress={handleNextItem} style={{ flex: 1 }}>
              {currentItemIndex < activeItems.length - 1
                ? (language === 'ja' ? '次へ →' : 'Next →')
                : (language === 'ja' ? '全体評価へ →' : 'Overall Assessment →')}
            </Button>
          )}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.disabled,
  },
  progressIndicator: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemHeaderLeft: {
    flex: 1,
  },
  itemCategory: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  itemDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  goalSection: {
    marginBottom: SPACING.xl,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  goalLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  goalPercent: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
  },
  goalDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 100,
  },
  checkboxContainer: {
    marginTop: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
});
