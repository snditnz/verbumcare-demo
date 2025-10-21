import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, getRoleDisplayName } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { apiService } from '@services/api';
import { Patient } from '@models';

const logoMark = require('../../VerbumCare-Logo-Mark.png');

type RootStackParamList = {
  Dashboard: undefined;
  Login: undefined;
  PatientList: undefined;
  PatientInfo: undefined;
  CarePlanHub: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

export default function DashboardScreen({ navigation }: Props) {
  const { currentUser, logout, isAuthenticated } = useAuthStore();
  const { language, setCurrentPatient } = useAssessmentStore();
  const { carePlans } = useCarePlanStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const t = translations[language];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      navigation.replace('Login' as any);
    }
  }, [isAuthenticated, currentUser]);

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPatients(true);
      setPatients(data);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login' as any);
  };

  const handlePatientSelect = (patient: Patient) => {
    setCurrentPatient(patient);
    navigation.navigate('PatientInfo' as any);
  };

  if (!currentUser) {
    return null;
  }

  // Calculate alerts and statistics
  const patientsWithCarePlans = Array.from(carePlans.values());
  const totalCarePlans = patientsWithCarePlans.length;

  // High priority problems
  const highPriorityProblems = patientsWithCarePlans.flatMap(cp =>
    cp.carePlanItems.filter(item =>
      item.problem.status === 'active' &&
      (item.problem.priority === 'urgent' || item.problem.priority === 'high')
    ).map(item => ({
      patientId: cp.patientId,
      problem: item.problem.description,
      priority: item.problem.priority,
    }))
  );

  // Goals not progressing (< 30% achievement)
  const stuckGoals = patientsWithCarePlans.flatMap(cp =>
    cp.carePlanItems.filter(item =>
      item.problem.status === 'active' &&
      item.shortTermGoal.achievementStatus < 30
    ).map(item => ({
      patientId: cp.patientId,
      goal: item.shortTermGoal.description,
      progress: item.shortTermGoal.achievementStatus,
    }))
  );

  // Overdue monitoring
  const overdueMonitoring = patientsWithCarePlans.filter(cp => {
    const nextReview = new Date(cp.nextMonitoringDate);
    return nextReview < new Date();
  }).map(cp => ({
    patientId: cp.patientId,
    nextReview: cp.nextMonitoringDate,
  }));

  const displayName = language === 'ja'
    ? (currentUser.fullNameJa || currentUser.fullName)
    : currentUser.fullName;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={logoMark} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.logo}>VerbumCare</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.welcomeText}>
            {language === 'ja' ? `${displayName} さん` : displayName}
          </Text>
          <Text style={styles.roleText}>
            {getRoleDisplayName(currentUser.role, language)}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
          <Button
            variant="text"
            onPress={handleLogout}
            style={{ marginLeft: SPACING.md }}
          >
            <View style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
              <Text style={styles.logoutText}>
                {language === 'ja' ? 'ログアウト' : 'Logout'}
              </Text>
            </View>
          </Button>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Statistics Row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Ionicons name="people" size={ICON_SIZES.xl} color={COLORS.primary} />
            <Text style={styles.statValue}>{patients.length}</Text>
            <Text style={styles.statLabel}>
              {language === 'ja' ? '総患者数' : 'Total Patients'}
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="document-text" size={ICON_SIZES.xl} color={COLORS.accent} />
            <Text style={styles.statValue}>{totalCarePlans}</Text>
            <Text style={styles.statLabel}>
              {language === 'ja' ? 'ケアプラン' : 'Care Plans'}
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="warning" size={ICON_SIZES.xl} color={COLORS.status.warning} />
            <Text style={styles.statValue}>{highPriorityProblems.length}</Text>
            <Text style={styles.statLabel}>
              {language === 'ja' ? '高優先度課題' : 'High Priority'}
            </Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="alert-circle" size={ICON_SIZES.xl} color={COLORS.error} />
            <Text style={styles.statValue}>{overdueMonitoring.length}</Text>
            <Text style={styles.statLabel}>
              {language === 'ja' ? '期限切れ' : 'Overdue'}
            </Text>
          </Card>
        </View>

        {/* Section 1: Alerts & Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={ICON_SIZES.lg} color={COLORS.error} />
            <Text style={styles.sectionTitle}>
              {language === 'ja' ? 'アラート＆通知' : 'Alerts & Notifications'}
            </Text>
          </View>

          {highPriorityProblems.length === 0 && stuckGoals.length === 0 && overdueMonitoring.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.emptyStateText}>
                  {language === 'ja' ? 'アラートはありません' : 'No alerts at this time'}
                </Text>
              </View>
            </Card>
          ) : (
            <View style={styles.alertsGrid}>
              {/* High Priority Problems */}
              {highPriorityProblems.length > 0 && (
                <Card style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <View style={[styles.alertBadge, { backgroundColor: COLORS.error }]}>
                      <Ionicons name="warning" size={ICON_SIZES.md} color={COLORS.white} />
                    </View>
                    <Text style={styles.alertTitle}>
                      {language === 'ja' ? '高優先度課題' : 'High Priority Problems'}
                    </Text>
                    <View style={styles.alertCount}>
                      <Text style={styles.alertCountText}>{highPriorityProblems.length}</Text>
                    </View>
                  </View>
                  {highPriorityProblems.slice(0, 3).map((alert, idx) => {
                    const patient = patients.find(p => p.patient_id === alert.patientId);
                    return (
                      <View key={idx} style={styles.alertItem}>
                        <Text style={styles.alertPatient}>
                          {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                        </Text>
                        <Text style={styles.alertDescription} numberOfLines={1}>
                          {alert.problem}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              )}

              {/* Goals Not Progressing */}
              {stuckGoals.length > 0 && (
                <Card style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <View style={[styles.alertBadge, { backgroundColor: COLORS.status.warning }]}>
                      <Ionicons name="trending-down" size={ICON_SIZES.md} color={COLORS.white} />
                    </View>
                    <Text style={styles.alertTitle}>
                      {language === 'ja' ? '進捗不良の目標' : 'Goals Not Progressing'}
                    </Text>
                    <View style={styles.alertCount}>
                      <Text style={styles.alertCountText}>{stuckGoals.length}</Text>
                    </View>
                  </View>
                  {stuckGoals.slice(0, 3).map((alert, idx) => {
                    const patient = patients.find(p => p.patient_id === alert.patientId);
                    return (
                      <View key={idx} style={styles.alertItem}>
                        <Text style={styles.alertPatient}>
                          {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                        </Text>
                        <Text style={styles.alertDescription} numberOfLines={1}>
                          {alert.goal} ({alert.progress}%)
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              )}

              {/* Overdue Monitoring */}
              {overdueMonitoring.length > 0 && (
                <Card style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <View style={[styles.alertBadge, { backgroundColor: COLORS.error }]}>
                      <Ionicons name="time" size={ICON_SIZES.md} color={COLORS.white} />
                    </View>
                    <Text style={styles.alertTitle}>
                      {language === 'ja' ? '期限切れモニタリング' : 'Overdue Monitoring'}
                    </Text>
                    <View style={styles.alertCount}>
                      <Text style={styles.alertCountText}>{overdueMonitoring.length}</Text>
                    </View>
                  </View>
                  {overdueMonitoring.slice(0, 3).map((alert, idx) => {
                    const patient = patients.find(p => p.patient_id === alert.patientId);
                    const daysOverdue = Math.floor(
                      (Date.now() - new Date(alert.nextReview).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <View key={idx} style={styles.alertItem}>
                        <Text style={styles.alertPatient}>
                          {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                        </Text>
                        <Text style={styles.alertDescription}>
                          {language === 'ja' ? `${daysOverdue}日遅延` : `${daysOverdue} days overdue`}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              )}
            </View>
          )}
        </View>

        {/* Section 2: Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {language === 'ja' ? '本日の予定' : "Today's Schedule"}
            </Text>
          </View>

          <Card>
            <View style={styles.emptyState}>
              <Ionicons name="calendar" size={48} color={COLORS.text.disabled} />
              <Text style={styles.emptyStateText}>
                {language === 'ja'
                  ? '本日の予定はスケジュール機能実装後に表示されます'
                  : 'Schedule will appear here when implemented'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {language === 'ja'
                  ? 'バイタル測定、服薬、評価などの予定が表示されます'
                  : 'Vitals, medications, assessments, and care conferences'}
              </Text>
            </View>
          </Card>
        </View>

        {/* Section 3: Care Plans Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={ICON_SIZES.lg} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>
              {language === 'ja' ? 'ケアプラン一覧' : 'Care Plans Overview'}
            </Text>
            <Button
              variant="text"
              onPress={() => navigation.navigate('PatientList' as any)}
              style={{ marginLeft: 'auto' }}
            >
              <Text style={styles.viewAllText}>
                {language === 'ja' ? '全患者' : 'All Patients'} →
              </Text>
            </Button>
          </View>

          {loading ? (
            <Card>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </Card>
          ) : patientsWithCarePlans.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={COLORS.text.disabled} />
                <Text style={styles.emptyStateText}>
                  {language === 'ja' ? 'ケアプランはまだ作成されていません' : 'No care plans created yet'}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {language === 'ja'
                    ? '患者を選択してケアプランを作成してください'
                    : 'Select a patient to create their care plan'}
                </Text>
              </View>
            </Card>
          ) : (
            <View style={styles.carePlansGrid}>
              {patientsWithCarePlans.slice(0, 6).map((carePlan) => {
                const patient = patients.find(p => p.patient_id === carePlan.patientId);
                const activeItems = carePlan.carePlanItems.filter(i => i.problem.status === 'active');
                const avgProgress = activeItems.length > 0
                  ? Math.round(
                      activeItems.reduce((sum, i) => sum + i.shortTermGoal.achievementStatus, 0) /
                        activeItems.length
                    )
                  : 0;

                return (
                  <TouchableOpacity
                    key={carePlan.id}
                    style={styles.carePlanCard}
                    onPress={() => handlePatientSelect(patient!)}
                  >
                    <Card style={{ flex: 1 }}>
                      <View style={styles.carePlanHeader}>
                        <View style={styles.carePlanPatientInfo}>
                          <Text style={styles.carePlanPatientName}>
                            {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                          </Text>
                          {patient?.room && (
                            <Text style={styles.carePlanRoom}>
                              {language === 'ja' ? '室' : 'Room'} {patient.room}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.careLevelBadge, { backgroundColor: `${COLORS.primary}20` }]}>
                          <Text style={[styles.careLevelText, { color: COLORS.primary }]}>
                            {carePlan.careLevel}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.carePlanStats}>
                        <View style={styles.carePlanStat}>
                          <Text style={styles.carePlanStatValue}>{activeItems.length}</Text>
                          <Text style={styles.carePlanStatLabel}>
                            {language === 'ja' ? '課題' : 'Items'}
                          </Text>
                        </View>
                        <View style={styles.carePlanStat}>
                          <Text style={styles.carePlanStatValue}>{avgProgress}%</Text>
                          <Text style={styles.carePlanStatLabel}>
                            {language === 'ja' ? '進捗' : 'Progress'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${avgProgress}%` }]} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
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
    backgroundColor: COLORS.primary,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  logo: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
  roleText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white,
    opacity: 0.9,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  logoutText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.white,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  viewAllText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyStateText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  alertsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  alertCard: {
    flex: 1,
    minWidth: 300,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  alertBadge: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 1,
  },
  alertCount: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 24,
    alignItems: 'center',
  },
  alertCountText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  alertItem: {
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  alertPatient: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  alertDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  carePlansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  carePlanCard: {
    width: '32%',
    minWidth: 250,
  },
  carePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  carePlanPatientInfo: {
    flex: 1,
  },
  carePlanPatientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  carePlanRoom: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  careLevelBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  careLevelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  carePlanStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  carePlanStat: {
    alignItems: 'center',
  },
  carePlanStatValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
  },
  carePlanStatLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
});
