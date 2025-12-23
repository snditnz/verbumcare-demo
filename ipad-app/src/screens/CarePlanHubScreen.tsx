import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';

type RootStackParamList = {
  CarePlanHub: undefined;
  FullCarePlanView: undefined;
  CreateCarePlan: undefined;
  AddCarePlanItem: undefined;
  QuickProgressUpdate: undefined;
  MonitoringForm: undefined;
  PatientInfo: undefined;
  WeeklySchedule: undefined;
  CarePlanHistory: undefined;
  ComingSoon: { feature: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CarePlanHub'>;
};

export default function CarePlanHubScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { getCarePlanByPatientId, loadCarePlan, isLoading, error } = useCarePlanStore();

  const t = translations[language];
  const carePlan = currentPatient ? getCarePlanByPatientId(currentPatient.patient_id) : undefined;

  // Load care plan when patient changes
  useEffect(() => {
    if (currentPatient) {
      loadCarePlan(currentPatient.patient_id);
    }
  }, [currentPatient?.patient_id]);

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

  // Show loading state
  if (isLoading) {
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
            <Text style={styles.screenTitle}>{t['carePlan.hub.title']}</Text>
          </View>
          <View style={styles.headerRight}>
            <ServerStatusIndicator compact />
            <LanguageToggle />
          </View>
        </View>

        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'ケアプランを読み込んでいます...' : 'Loading care plan...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!carePlan) {
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
            <Text style={styles.screenTitle}>{t['carePlan.hub.title']}</Text>
          </View>
          <View style={styles.headerRight}>
            <ServerStatusIndicator compact />
            <LanguageToggle />
          </View>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'ケアプランがまだ作成されていません' : 'No care plan exists for this patient'}
          </Text>
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          <Button variant="primary" onPress={() => navigation.navigate('CreateCarePlan')}>
            {language === 'ja' ? 'ケアプラン作成' : 'Create Care Plan'}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Count active problems
  const activeProblems = carePlan.carePlanItems.filter(item => item.problem.status === 'active');
  const highPriorityProblems = activeProblems.filter(item => item.problem.priority === 'urgent' || item.problem.priority === 'high');

  // Calculate average progress
  const avgProgress = activeProblems.length > 0
    ? Math.round(activeProblems.reduce((sum, item) => sum + item.shortTermGoal.achievementStatus, 0) / activeProblems.length)
    : 0;

  // Format next review date
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const ActionCard = ({ icon, title, subtitle, onPress, color = COLORS.primary }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={ICON_SIZES.xl} color={color} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );

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
          <Text style={styles.screenTitle}>{t['carePlan.hub.title']}</Text>
        </View>
        <View style={styles.headerRight}>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Overview Card */}
        <Card>
          <View style={styles.overviewHeader}>
            <View style={styles.careLevelBadge}>
              <Text style={styles.careLevelText}>{carePlan.careLevel}</Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>
                {t['carePlan.version']} {carePlan.version}
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeProblems.length}</Text>
              <Text style={styles.statLabel}>{t['carePlan.activeProblems']}</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{avgProgress}%</Text>
              <Text style={styles.statLabel}>{t['carePlan.progress']}</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDate(carePlan.nextReviewDate)}</Text>
              <Text style={styles.statLabel}>{t['carePlan.nextReview']}</Text>
            </View>
          </View>

          {highPriorityProblems.length > 0 && (
            <View style={styles.alertBox}>
              <Ionicons name="warning" size={ICON_SIZES.md} color={COLORS.status.warning} />
              <Text style={styles.alertText}>
                {highPriorityProblems.length} {language === 'ja' ? '件の高優先度課題' : 'high-priority problems'}
              </Text>
            </View>
          )}
        </Card>

        {/* Progress Indicators */}
        <Card>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>{language === 'ja' ? '主要目標の進捗' : 'Key Goals Progress'}</Text>
          </View>

          {activeProblems.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.progressItem}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressCategory}>
                  {t[`carePlan.category.${item.problem.category}`]}
                </Text>
                <Text style={styles.progressPercent}>{item.shortTermGoal.achievementStatus}%</Text>
              </View>
              <Text style={styles.progressGoal} numberOfLines={1}>
                {item.shortTermGoal.description}
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${item.shortTermGoal.achievementStatus}%` }
                  ]}
                />
              </View>
            </View>
          ))}
        </Card>

        {/* Action Cards */}
        <View style={styles.actionsGrid}>
          <ActionCard
            icon="document-text"
            title={t['carePlan.viewDetails']}
            subtitle={language === 'ja' ? `${activeProblems.length}${t['carePlan.problems']}` : `${activeProblems.length} ${t['carePlan.problems']}`}
            onPress={() => navigation.navigate('FullCarePlanView')}
            color={COLORS.primary}
          />

          <ActionCard
            icon="add-circle"
            title={t['carePlan.addProblem']}
            subtitle={language === 'ja' ? '新しい課題を追加' : 'Add new problem'}
            onPress={() => navigation.navigate('AddCarePlanItem')}
            color={COLORS.accent}
          />

          <ActionCard
            icon="create"
            title={language === 'ja' ? '進捗クイック更新' : 'Quick Progress'}
            subtitle={language === 'ja' ? '達成度を素早く更新' : 'Update achievement'}
            onPress={() => navigation.navigate('QuickProgressUpdate')}
            color={COLORS.status.normal}
          />

          <ActionCard
            icon="analytics"
            title={t['carePlan.monitoring']}
            subtitle={language === 'ja' ? '3ヶ月モニタリング' : '3-month monitoring'}
            onPress={() => navigation.navigate('MonitoringForm')}
            color={COLORS.status.warning}
          />

          <ActionCard
            icon="people"
            title={t['carePlan.conference']}
            subtitle={language === 'ja' ? 'サービス担当者会議' : 'Care conference'}
            onPress={() => navigation.navigate('ComingSoon', { feature: t['carePlan.conference'] })}
            color={COLORS.status.warning}
          />

          <ActionCard
            icon="calendar"
            title={t['carePlan.weeklySchedule']}
            subtitle={language === 'ja' ? '週間サービス計画' : 'Weekly services'}
            onPress={() => navigation.navigate('WeeklySchedule')}
            color={COLORS.primary}
          />

          <ActionCard
            icon="time"
            title={t['carePlan.history']}
            subtitle={language === 'ja' ? `${carePlan.version}バージョン` : `${carePlan.version} versions`}
            onPress={() => navigation.navigate('CarePlanHistory')}
            color={COLORS.text.secondary}
          />
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
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.disabled,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.status.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  careLevelBadge: {
    backgroundColor: `${COLORS.primary}20`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  careLevelText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  versionBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  versionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: `${COLORS.status.warning}15`,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.status.warning,
  },
  alertText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.status.warning,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  progressItem: {
    marginBottom: SPACING.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressCategory: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  progressPercent: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
  },
  progressGoal: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  actionCard: {
    width: `calc(33.333% - ${SPACING.md}px)`,
    minWidth: 200,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});
