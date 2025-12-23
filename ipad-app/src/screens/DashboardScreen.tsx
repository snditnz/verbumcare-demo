import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, getRoleDisplayName } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { LanguageToggle, NetworkStatusIndicator } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button, Card } from '@components/ui';
import { clearNavigationContext } from '@utils/navigationContext';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { apiService } from '@services/api';
import { cacheService } from '@services/cacheService';
import { clearUserCache, warmAllDataForDemo } from '@services/cacheWarmer';
import { Patient } from '@models';
import { DEMO_STAFF_ID } from '@constants/config';

const logoMark = require('../../VerbumCare-Logo-Mark.png');

type RootStackParamList = {
  Dashboard: undefined;
  Login: undefined;
  PatientList: undefined;
  PatientScan: undefined;
  PatientInfo: undefined;
  GeneralVoiceRecorder: undefined;
  CarePlanHub: undefined;
  ReviewQueue: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

export default function DashboardScreen({ navigation }: Props) {
  const { currentUser, logout, isAuthenticated } = useAuthStore();
  const { language, currentPatient, setCurrentPatient } = useAssessmentStore();
  const { carePlans, loadCarePlan, clearStore } = useCarePlanStore();
  const { queueCount, loadQueue } = useVoiceReviewStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleData, setScheduleData] = useState<any>(null); // TodaySchedule for selected patient
  const [warmingCache, setWarmingCache] = useState(false);

  const t = translations[language];

  // Clear current patient when returning to Dashboard (global context)
  useEffect(() => {
    console.log('[Dashboard] 🏠 Dashboard mounted - clearing current patient to establish global context');
    console.log('[Dashboard] 🏠 Previous currentPatient:', currentPatient?.patient_id, currentPatient?.family_name);
    setCurrentPatient(null);
    console.log('[Dashboard] 🏠 Current patient cleared for global context');
  }, []); // Run once on mount

  // Also clear current patient when Dashboard comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[Dashboard] 🏠 Dashboard focused - ensuring global context');
      console.log('[Dashboard] 🏠 Current patient on focus:', currentPatient?.patient_id, currentPatient?.family_name);
      if (currentPatient) {
        console.log('[Dashboard] 🏠 Clearing patient on focus to ensure global context');
        setCurrentPatient(null);
      }
    });

    return unsubscribe;
  }, [navigation, currentPatient]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      navigation.replace('Login' as any);
    }
  }, [isAuthenticated, currentUser]);

  // Load patients and review queue on mount
  useEffect(() => {
    loadPatients();
    if (currentUser) {
      loadQueue(currentUser.userId);
    }
  }, [currentUser]);

  // Refresh review queue when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (currentUser) {
        loadQueue(currentUser.userId);
      }
    });

    return unsubscribe;
  }, [navigation, currentUser]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPatients(true);
      setPatients(data);

      // UI is responsive now, load care plans in background
      setLoading(false);

      // Load care plans for all patients (for dashboard alerts/statistics)
      await loadAllCarePlans(data);
    } catch (error) {
      console.error('Error loading patients:', error);
      setLoading(false);
    }
  };

  const loadAllCarePlans = async (patientList: Patient[]) => {
    console.log(`[Dashboard] Loading care plans for ${patientList.length} patients...`);

    // Load care plans for each patient in parallel
    // Silently fails if patient has no care plan (404 is expected)
    const results = await Promise.allSettled(
      patientList.map(patient => {
        console.log(`[Dashboard] Loading care plan for patient: ${patient.patient_id}`);
        return loadCarePlan(patient.patient_id);
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[Dashboard] ✅ Loaded care plans: ${successful} successful, ${failed} failed/none, total in store: ${carePlans.size}`);

    // Load today's schedule for first patient as sample
    if (patientList.length > 0) {
      loadTodaySchedule(patientList[0].patient_id);
    }
  };

  const loadTodaySchedule = async (patientId: string) => {
    try {
      const schedule = await apiService.getTodaySchedule(patientId);
      setScheduleData(schedule);
      console.log(`[Dashboard] Loaded today's schedule:`, schedule.summary);
    } catch (error) {
      console.error('[Dashboard] Failed to load schedule:', error);
      setScheduleData(null);
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

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // Clear all caches
      await clearUserCache();
      clearStore();
      // Reload patients and care plans
      await loadPatients();
      setRefreshing(false);
    } catch (error) {
      console.error('Error refreshing:', error);
      setRefreshing(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setLoading(true);
      // Clear all caches (AsyncStorage + Zustand store)
      await cacheService.clearCache();
      clearStore(); // Clear Zustand in-memory state
      if (currentUser) {
        await clearUserCache(currentUser.userId);
      }
      console.log('✅ All cache cleared (AsyncStorage + Zustand)');

      // Force reload patients from server (bypass cache)
      const freshData = await apiService.getPatients(false); // false = skip cache
      setPatients(freshData);
      console.log(`✅ Loaded ${freshData.length} patients from server`);

      // Reload care plans for dashboard alerts/statistics
      await loadAllCarePlans(freshData);

      alert(language === 'ja'
        ? 'キャッシュをクリアしました。サーバーから最新データを読み込みます。'
        : 'Cache cleared. Loading fresh data from server.');
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert(language === 'ja'
        ? 'キャッシュのクリアに失敗しました'
        : 'Failed to clear cache');
    } finally {
      setLoading(false);
    }
  };

  const handleWarmCache = async () => {
    try {
      setWarmingCache(true);
      console.log('🔥 Starting cache warming for offline demo...');

      // Warm all data: patients, schedules, care plans, templates
      const result = await warmAllDataForDemo(DEMO_STAFF_ID);

      console.log('Cache warming result:', result);

      if (result.success) {
        const msg = language === 'ja'
          ? `✅ キャッシュ準備完了！\n\n患者: ${result.details.patients}\nスケジュール: ${result.details.schedules}\nテンプレート: ${result.details.templates}\n\nオフラインでデモできます！`
          : `✅ Cache warmed!\n\nPatients: ${result.details.patients}\nSchedules: ${result.details.schedules}\nTemplates: ${result.details.templates}\n\nReady for offline demo!`;

        alert(msg);

        // Reload dashboard to show cached data
        await loadPatients();
      } else {
        const errorMsg = result.errors.join('\n');
        alert(language === 'ja'
          ? `⚠️ キャッシュ準備中にエラー:\n${errorMsg}`
          : `⚠️ Cache warming errors:\n${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Error warming cache:', error);
      alert(language === 'ja'
        ? `❌ キャッシュ準備失敗: ${error.message}`
        : `❌ Failed to warm cache: ${error.message}`);
    } finally {
      setWarmingCache(false);
    }
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
          <NetworkStatusIndicator compact />
          <ServerStatusIndicator compact showServerName tapToOpenSettings />
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
          {/* Review Queue Button - Always visible */}
          <TouchableOpacity 
            style={styles.reviewQueueButton}
            onPress={() => navigation.navigate('ReviewQueue' as any)}
          >
            <Ionicons name="list" size={24} color={COLORS.white} />
            {queueCount() > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{queueCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleWarmCache}
            style={[styles.clearCacheButton, warmingCache && { opacity: 0.5 }]}
            disabled={warmingCache}
          >
            {warmingCache ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="cloud-download-outline" size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearCache} style={styles.clearCacheButton}>
            <Ionicons name="refresh-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Settings' as any)} 
            style={styles.clearCacheButton}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
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

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            title={language === 'ja' ? '更新中...' : 'Refreshing...'}
            titleColor={COLORS.text.secondary}
          />
        }
      >
        {/* Top Grid: Quick Actions & Stats - 2 rows x 5 columns (including 2-col Recent) */}
        <View style={styles.gridContainer}>
            {/* Recent Patients - Right side, spans 2 rows */}
            <View style={styles.gridCellDouble}>
              <Card style={{ flex: 1, padding: SPACING.md }}>
                <View style={styles.recentPatientsHeader}>
                  <Ionicons name="time-outline" size={ICON_SIZES.md} color={COLORS.accent} />
                  <Text style={styles.recentPatientsTitle}>
                    {language === 'ja' ? '最近の患者' : 'Recent Patients'}
                  </Text>
                  <Button
                    variant="text"
                    onPress={() => navigation.navigate('PatientList' as any)}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Text style={styles.viewAllTextSmall}>
                      {language === 'ja' ? '全て' : 'All'} →
                    </Text>
                  </Button>
                </View>

                {patients.slice(0, 4).map((patient) => (
                  <TouchableOpacity
                    key={patient.patient_id}
                    style={styles.recentPatientItem}
                    onPress={() => handlePatientSelect(patient)}
                  >
                    <Text style={styles.recentPatientName}>
                      {patient.family_name} {patient.given_name}
                    </Text>
                    {patient.room && (
                      <Text style={styles.recentPatientRoom}>
                        {language === 'ja' ? '室' : 'Room'} {patient.room}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </Card>
            </View>

            {/* Left side - 2 rows x 3 columns */}
            <View style={styles.gridLeftSide}>
              {/* Row 1 */}
              <View style={styles.gridRow}>
                {/* 1. Scan Button */}
                <TouchableOpacity
                  style={styles.gridCell}
                  onPress={() => navigation.navigate('PatientScan' as any)}
                >
                  <Card style={styles.gridCellInner}>
                    <View style={[styles.quickActionIconSmall, { backgroundColor: `${COLORS.primary}15` }]}>
                      <Ionicons name="scan" size={ICON_SIZES.lg} color={COLORS.primary} />
                    </View>
                    <Text style={styles.gridCellTitle}>
                      {language === 'ja' ? 'スキャン' : 'Scan'}
                    </Text>
                  </Card>
                </TouchableOpacity>

                {/* 2. Total Patients */}
                <TouchableOpacity
                  style={styles.gridCell}
                  onPress={() => navigation.navigate('PatientList' as any)}
                >
                  <Card style={styles.gridCellInner}>
                    <Ionicons name="people" size={ICON_SIZES.xl} color={COLORS.primary} />
                    <Text style={styles.statValue}>{patients.length}</Text>
                    <Text style={styles.statLabel}>
                      {language === 'ja' ? '総患者数' : 'Total Patients'}
                    </Text>
                  </Card>
                </TouchableOpacity>

                {/* 3. Care Plans */}
                <TouchableOpacity
                  style={styles.gridCell}
                  onPress={() => navigation.navigate('AllCarePlans' as any)}
                >
                  <Card style={styles.gridCellInner}>
                    <Ionicons name="document-text" size={ICON_SIZES.xl} color={COLORS.accent} />
                    <Text style={styles.statValue}>{totalCarePlans}</Text>
                    <Text style={styles.statLabel}>
                      {language === 'ja' ? 'ケアプラン' : 'Care Plans'}
                    </Text>
                  </Card>
                </TouchableOpacity>
              </View>

              {/* Row 2 */}
              <View style={styles.gridRow}>
                {/* 5. Record Button */}
                <TouchableOpacity
                  style={styles.gridCell}
                  onPress={() => {
                    // Clear any existing patient context when navigating from Dashboard
                    console.log('[Dashboard] 🎤 Record button pressed - ensuring global context');
                    console.log('[Dashboard] 🎤 Current patient before navigation:', currentPatient?.patient_id);
                    
                    // Clear any stale navigation context
                    clearNavigationContext();
                    
                    // Ensure current patient is null for global context
                    if (currentPatient) {
                      console.log('[Dashboard] 🎤 Clearing current patient before voice recorder');
                      setCurrentPatient(null);
                    }
                    
                    // Navigate to voice recorder (should detect global context)
                    navigation.navigate('GeneralVoiceRecorder' as any);
                  }}
                >
                  <Card style={styles.gridCellInner}>
                    <View style={[styles.quickActionIconSmall, { backgroundColor: `${COLORS.error}15` }]}>
                      <Ionicons name="mic" size={ICON_SIZES.lg} color={COLORS.error} />
                    </View>
                    <Text style={styles.gridCellTitle}>
                      {language === 'ja' ? '記録' : 'Record'}
                    </Text>
                  </Card>
                </TouchableOpacity>

                {/* 6. High Priority */}
                <Card style={[styles.gridCell, styles.gridCellInner]}>
                  <Ionicons name="warning" size={ICON_SIZES.xl} color={COLORS.status.warning} />
                  <Text style={styles.statValue}>{highPriorityProblems.length}</Text>
                  <Text style={styles.statLabel}>
                    {language === 'ja' ? '高優先度' : 'High Priority'}
                  </Text>
                </Card>

                {/* 7. Overdue */}
                <Card style={[styles.gridCell, styles.gridCellInner]}>
                  <Ionicons name="alert-circle" size={ICON_SIZES.xl} color={COLORS.error} />
                  <Text style={styles.statValue}>{overdueMonitoring.length}</Text>
                  <Text style={styles.statLabel}>
                    {language === 'ja' ? '期限切れ' : 'Overdue'}
                  </Text>
                </Card>
              </View>
            </View>
          </View>

        {/* Bottom Row: 3 equal sections */}
        <View style={styles.bottomRow}>
          {/* Section 1: Alerts & Notifications */}
          <View style={styles.bottomSection}>
            <View style={styles.sectionHeaderCompact}>
              <Ionicons name="notifications" size={ICON_SIZES.md} color={COLORS.error} />
              <Text style={styles.sectionTitleSmall}>
                {language === 'ja' ? 'アラート' : 'Alerts'}
              </Text>
            </View>

          {highPriorityProblems.length === 0 && stuckGoals.length === 0 && overdueMonitoring.length === 0 ? (
            <Text style={styles.emptyMessage}>
              {language === 'ja' ? 'アラートはありません' : 'No alerts'}
            </Text>
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
                  {highPriorityProblems.slice(0, 4).map((alert, idx) => {
                    const patient = patients.find(p => p.patient_id === alert.patientId);
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.alertItem}
                        onPress={() => {
                          if (patient) {
                            setCurrentPatient(patient);
                            navigation.navigate('FullCarePlanView' as any);
                          }
                        }}
                      >
                        <Text style={styles.alertPatient} numberOfLines={1}>
                          {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                        </Text>
                        <Text style={styles.alertDescription} numberOfLines={1}>
                          {alert.problem}
                        </Text>
                      </TouchableOpacity>
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
                  {stuckGoals.slice(0, 4).map((alert, idx) => {
                    const patient = patients.find(p => p.patient_id === alert.patientId);
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.alertItem}
                        onPress={() => {
                          if (patient) {
                            setCurrentPatient(patient);
                            navigation.navigate('MonitoringForm' as any);
                          }
                        }}
                      >
                        <Text style={styles.alertPatient} numberOfLines={1}>
                          {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                        </Text>
                        <Text style={styles.alertDescription} numberOfLines={1}>
                          {alert.goal} ({alert.progress}%)
                        </Text>
                      </TouchableOpacity>
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
                  {overdueMonitoring.slice(0, 4).map((alert, idx) => {
                    const patient = patients.find(p => p.patient_id === alert.patientId);
                    const daysOverdue = Math.floor(
                      (Date.now() - new Date(alert.nextReview).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.alertItem}
                        onPress={() => {
                          if (patient) {
                            setCurrentPatient(patient);
                            navigation.navigate('MonitoringForm' as any);
                          }
                        }}
                      >
                        <Text style={styles.alertPatient} numberOfLines={1}>
                          {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                        </Text>
                        <Text style={styles.alertDescription} numberOfLines={1}>
                          {language === 'ja' ? `${daysOverdue}日遅延` : `${daysOverdue} days overdue`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </Card>
              )}
            </View>
          )}
          </View>

          {/* Section 2: Today's Schedule */}
          <View style={styles.bottomSection}>
            <View style={styles.sectionHeaderCompact}>
              <Ionicons name="calendar-outline" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.sectionTitleSmall}>
                {language === 'ja' ? '本日予定' : "Today's Schedule"}
              </Text>
              {scheduleData && (
                <Text style={{ fontSize: 12, color: COLORS.text.secondary, marginLeft: SPACING.sm }}>
                  {scheduleData.summary.pending}/{scheduleData.summary.total}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => navigation.navigate('TodaySchedule' as any)}
                style={{ marginLeft: 'auto' }}
              >
                <Text style={styles.viewAllTextSmall}>
                  {language === 'ja' ? '詳細' : 'View All'} →
                </Text>
              </TouchableOpacity>
            </View>
            {!scheduleData ? (
              <Text style={styles.emptyMessage}>
                {language === 'ja' ? '読み込み中...' : 'Loading...'}
              </Text>
            ) : scheduleData.allItems.length === 0 ? (
              <Text style={styles.emptyMessage}>
                {language === 'ja' ? '予定なし' : 'No schedule'}
              </Text>
            ) : (
              <View>
                {scheduleData.allItems.slice(0, 5).map((item: any) => (
                  <View key={item.id} style={styles.scheduleItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={
                          item.type === 'medication' ? 'medical' :
                          item.type === 'vitals' ? 'fitness' :
                          item.type === 'assessment' ? 'clipboard' :
                          'calendar'
                        }
                        size={16}
                        color={item.completed ? COLORS.status.success : COLORS.primary}
                      />
                      <Text style={{ fontSize: 12, color: COLORS.text.secondary }}>
                        {item.time?.substring(0, 5) || item.timeSlot}
                      </Text>
                      <Text style={{ fontSize: 14, flex: 1 }}>{item.title}</Text>
                      {item.completed && (
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.status.success} />
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: COLORS.text.secondary, marginLeft: 24 }}>
                      {item.details}
                    </Text>
                  </View>
                ))}
                {scheduleData.allItems.length > 5 && (
                  <Text style={{ fontSize: 12, color: COLORS.text.secondary, marginTop: 8 }}>
                    +{scheduleData.allItems.length - 5} {language === 'ja' ? 'more' : 'more'}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Section 3: Care Plans Overview */}
          <View style={styles.bottomSection}>
            <View style={styles.sectionHeaderCompact}>
              <Ionicons name="list-outline" size={ICON_SIZES.md} color={COLORS.accent} />
              <Text style={styles.sectionTitleSmall}>
                {language === 'ja' ? 'ケアプラン' : 'Care Plans'}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AllCarePlans' as any)}
                style={{ marginLeft: 'auto' }}
              >
                <Text style={styles.viewAllTextSmall}>
                  {language === 'ja' ? '全て' : 'All'} →
                </Text>
              </TouchableOpacity>
            </View>

          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : patientsWithCarePlans.length === 0 ? (
            <Text style={styles.emptyMessage}>
              {language === 'ja' ? 'ケアプランなし' : 'No care plans'}
            </Text>
          ) : (
            <View style={styles.carePlansGrid}>
              {patientsWithCarePlans.slice(0, 7).map((carePlan) => {
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
                    onPress={() => {
                      setCurrentPatient(patient!);
                      navigation.navigate('CarePlanHub' as any);
                    }}
                  >
                    <Card style={{ flex: 1, padding: SPACING.xs, marginBottom: 0 }}>
                      <View style={styles.carePlanHeader}>
                        <View style={styles.carePlanPatientInfo}>
                          <Text style={styles.carePlanPatientName}>
                            {patient ? `${patient.family_name} ${patient.given_name}` : 'Unknown'}
                            {patient?.room && (
                              <Text style={styles.carePlanRoom}>
                                {' • '}{language === 'ja' ? '室' : 'Room'} {patient.room}
                              </Text>
                            )}
                          </Text>
                        </View>
                        <View style={styles.carePlanStatsInline}>
                          <Text style={styles.carePlanStatInlineText}>
                            {activeItems.length} {language === 'ja' ? '課題' : 'items'} • {avgProgress}%
                          </Text>
                        </View>
                        <View style={[styles.careLevelBadge, { backgroundColor: `${COLORS.primary}20` }]}>
                          <Text style={[styles.careLevelText, { color: COLORS.primary }]}>
                            {carePlan.careLevel}
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
        </View>

        {/* Voice Review Queue Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={ICON_SIZES.md} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {language === 'ja' ? '音声レビューキュー' : 'Voice Review Queue'}
            </Text>
            {queueCount() > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{queueCount()}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.reviewQueueCard}
            onPress={() => navigation.navigate('ReviewQueue' as any)}
          >
            <Card style={[styles.reviewQueueCardInner, queueCount() > 0 && { borderLeftWidth: 4, borderLeftColor: COLORS.primary }]}>
              <View style={styles.reviewQueueContent}>
                <View style={styles.reviewQueueIcon}>
                  <Ionicons name="mic" size={ICON_SIZES.lg} color={COLORS.primary} />
                </View>
                <View style={styles.reviewQueueText}>
                  <Text style={styles.reviewQueueTitle}>
                    {queueCount() > 0 
                      ? (language === 'ja' ? `${queueCount()}件の音声記録が待機中` : `${queueCount()} voice recordings pending`)
                      : (language === 'ja' ? '音声記録の待機なし' : 'No voice recordings pending')
                    }
                  </Text>
                  <Text style={styles.reviewQueueSubtitle}>
                    {language === 'ja' ? 'タップしてレビューキューを開く' : 'Tap to open review queue'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={ICON_SIZES.md} color={COLORS.text.secondary} />
              </View>
            </Card>
          </TouchableOpacity>
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
  reviewQueueButton: {
    position: 'relative',
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  queueBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  queueBadgeText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  clearCacheButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
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
  gridContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  gridLeftSide: {
    flex: 3,
    gap: SPACING.md,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    flex: 1,
  },
  bottomSection: {
    flex: 1,
  },
  sectionHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    minHeight: 32,
  },
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  gridCellInner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    minHeight: 140,
  },
  gridCellDouble: {
    flex: 2,
    minWidth: 0,
  },
  gridCellTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginTop: SPACING.xs,
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
    marginBottom: SPACING.md,
  },
  sectionCompact: {
    marginBottom: SPACING.sm,
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
  sectionTitleSmall: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  emptyMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
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
    padding: SPACING.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  alertBadge: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 1,
  },
  alertCount: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 20,
    alignItems: 'center',
  },
  alertCountText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.xs,
  },
  alertPatient: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 0,
    flexShrink: 0,
    minWidth: 80,
  },
  alertDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  carePlansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  carePlanCard: {
    width: '100%',
  },
  carePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  carePlanPatientInfo: {
    flex: 1,
  },
  carePlanPatientName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  carePlanRoom: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.normal,
  },
  carePlanStatsInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carePlanStatInlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  careLevelBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  careLevelText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  carePlanStats: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  carePlanStat: {
    alignItems: 'center',
  },
  carePlanStatValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
  },
  carePlanStatLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginTop: SPACING.xs,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  quickActionIconSmall: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  recentPatientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentPatientsTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  viewAllTextSmall: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  recentPatientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
    backgroundColor: `${COLORS.primary}05`,
  },
  recentPatientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  recentPatientRoom: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  scheduleItem: {
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.text.disabled}20`,
  },
  miniQueueBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  miniQueueBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  gridCellSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  reviewQueueCard: {
    marginBottom: SPACING.sm,
  },
  reviewQueueCardInner: {
    padding: SPACING.md,
  },
  reviewQueueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  reviewQueueIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewQueueText: {
    flex: 1,
  },
  reviewQueueTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  reviewQueueSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
});
