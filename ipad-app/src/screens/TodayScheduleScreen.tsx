import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Card } from '@components/ui';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { TodaySchedule, ScheduleItem } from '@models/app';
import apiService from '@services/api';

type RootStackParamList = {
  TodaySchedule: undefined;
  Dashboard: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TodaySchedule'>;
};

export default function TodayScheduleScreen({ navigation }: Props) {
  const { language, setCurrentPatient } = useAssessmentStore();
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const schedule = await apiService.getAllTodaySchedule();
      setScheduleData(schedule);
      console.log('[TodaySchedule] Loaded staff schedule:', schedule.summary);
    } catch (error) {
      console.error('[TodaySchedule] Failed to load schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleItemPress = async (item: any) => {
    console.log('[TodaySchedule] Item pressed:', item.type, item.id, item.patientId);

    // Skip if already completed
    if (item.completed) {
      console.log('[TodaySchedule] Item already completed, showing details only');
      // TODO: Could show a detail modal or confirmation screen
      return;
    }

    try {
      // Fetch patient data
      const patient = await apiService.getPatient(item.patientId);
      console.log('[TodaySchedule] Fetched patient:', patient?.family_name, patient?.given_name);

      // Set current patient in store
      setCurrentPatient(patient);

      // Navigate based on item type
      switch (item.type) {
        case 'medication':
          navigation.navigate('MedicineAdmin' as any);
          break;

        case 'vitals':
          navigation.navigate('VitalsCapture' as any);
          break;

        case 'assessment':
          // For assessments, go to Patient Info hub where they can select specific assessment
          navigation.navigate('PatientInfo' as any);
          break;

        case 'service':
          // For services, go to Patient Info hub
          navigation.navigate('PatientInfo' as any);
          break;

        default:
          console.warn('[TodaySchedule] Unknown item type:', item.type);
          // Default to Patient Info hub
          navigation.navigate('PatientInfo' as any);
      }
    } catch (error) {
      console.error('[TodaySchedule] Failed to navigate:', error);
      // TODO: Show error toast/alert to user
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'medication':
        return 'medical';
      case 'service':
        return 'calendar';
      case 'vitals':
        return 'heart';
      case 'assessment':
        return 'clipboard';
      default:
        return 'time';
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'medication':
        return COLORS.primary;
      case 'service':
        return COLORS.status.info;
      case 'vitals':
        return COLORS.error;
      case 'assessment':
        return COLORS.status.warning;
      default:
        return COLORS.text.secondary;
    }
  };

  const isItemOverdue = (item: any) => {
    // If already completed or PRN, not overdue
    if (item.completed || item.isPRN || item.status === 'prn') {
      return false;
    }

    // Check if scheduled time has passed
    if (item.time) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      const [hours, minutes] = item.time.split(':').map(Number);
      const scheduledTimeInMinutes = hours * 60 + minutes;

      // Consider overdue if more than 30 minutes past scheduled time
      const OVERDUE_THRESHOLD_MINUTES = 30;
      return currentTimeInMinutes > scheduledTimeInMinutes + OVERDUE_THRESHOLD_MINUTES;
    }

    return false;
  };

  const renderScheduleItem = (item: any) => {
    const iconColor = getColorForType(item.type);
    const overdue = isItemOverdue(item);

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.scheduleCard,
          overdue && styles.scheduleCardOverdue
        ]}
        onPress={() => handleScheduleItemPress(item)}
      >
        <View style={styles.scheduleCardHeader}>
          <View style={styles.scheduleCardLeft}>
            <Ionicons name={getIconForType(item.type)} size={20} color={iconColor} />
            <View style={styles.scheduleCardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.scheduleTime}>{item.time}</Text>
                {item.room && (
                  <Text style={styles.roomBadge}>{item.room}</Text>
                )}
                {overdue && (
                  <View style={styles.overdueBadge}>
                    <Ionicons name="alert-circle" size={14} color={COLORS.white} />
                    <Text style={styles.overdueText}>
                      {language === 'ja' ? '遅延' : 'LATE'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.scheduleTitle}>{item.title}</Text>
              {item.patientName && (
                <Text style={styles.patientName}>{item.patientName}</Text>
              )}
            </View>
          </View>
          <View style={styles.scheduleCardRight}>
            {item.completed ? (
              <Ionicons name="checkmark-circle" size={24} color={COLORS.status.success} />
            ) : item.status === 'prn' ? (
              <Text style={styles.prnBadge}>PRN</Text>
            ) : overdue ? (
              <Ionicons name="alert-circle" size={24} color={COLORS.error} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={COLORS.text.disabled} />
            )}
          </View>
        </View>
        {item.details && (
          <Text style={styles.scheduleDetails}>{item.details}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderTimeSlot = (slotName: string, items: ScheduleItem[]) => {
    if (items.length === 0) return null;

    const slotLabels: Record<string, { ja: string; en: string }> = {
      morning: { ja: '午前', en: 'Morning' },
      afternoon: { ja: '午後', en: 'Afternoon' },
      evening: { ja: '夕方', en: 'Evening' },
      night: { ja: '夜間', en: 'Night' },
    };

    const label = slotLabels[slotName]?.[language] || slotName;

    return (
      <View style={styles.timeSlotSection} key={slotName}>
        <View style={styles.timeSlotHeader}>
          <Text style={styles.timeSlotTitle}>{label}</Text>
          <Text style={styles.timeSlotCount}>
            {items.filter(i => i.completed).length}/{items.length}
          </Text>
        </View>
        {items.map(renderScheduleItem)}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>
            {language === 'ja' ? 'マイスケジュール' : "My Schedule"}
          </Text>
          {scheduleData && (
            <Text style={styles.subtitle}>
              {language === 'ja'
                ? `${scheduleData.totalPatients}名の利用者`
                : `${scheduleData.totalPatients} patients`}
            </Text>
          )}
        </View>
        <ServerStatusIndicator compact />
        <LanguageToggle />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : scheduleData ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary Card */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>
                  {language === 'ja' ? '合計' : 'Total'}
                </Text>
                <Text style={styles.summaryValue}>{scheduleData.summary.total}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>
                  {language === 'ja' ? '完了' : 'Completed'}
                </Text>
                <Text style={[styles.summaryValue, { color: COLORS.status.success }]}>
                  {scheduleData.summary.completed}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>
                  {language === 'ja' ? '未完了' : 'Pending'}
                </Text>
                <Text style={[styles.summaryValue, { color: COLORS.status.warning }]}>
                  {scheduleData.summary.pending}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryBadge}>
                <Ionicons name="medical" size={16} color={COLORS.primary} />
                <Text style={styles.summaryBadgeText}>{scheduleData.summary.medications}</Text>
              </View>
              <View style={styles.summaryBadge}>
                <Ionicons name="calendar" size={16} color={COLORS.status.info} />
                <Text style={styles.summaryBadgeText}>{scheduleData.summary.services}</Text>
              </View>
              <View style={styles.summaryBadge}>
                <Ionicons name="heart" size={16} color={COLORS.error} />
                <Text style={styles.summaryBadgeText}>{scheduleData.summary.vitals}</Text>
              </View>
              <View style={styles.summaryBadge}>
                <Ionicons name="clipboard" size={16} color={COLORS.status.warning} />
                <Text style={styles.summaryBadgeText}>{scheduleData.summary.assessments}</Text>
              </View>
            </View>
          </Card>

          {/* Time Slots in Columns */}
          <View style={styles.columnsContainer}>
            <View style={styles.column}>
              {renderTimeSlot('morning', scheduleData.grouped.morning)}
            </View>
            <View style={styles.column}>
              {renderTimeSlot('afternoon', scheduleData.grouped.afternoon)}
            </View>
            <View style={styles.column}>
              {renderTimeSlot('evening', scheduleData.grouped.evening)}
            </View>
            <View style={styles.column}>
              {renderTimeSlot('night', scheduleData.grouped.night)}
            </View>
          </View>

          <View style={{ height: SPACING.xl }} />
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? '予定がありません' : 'No schedule available'}
          </Text>
        </View>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 2,
  },
  patientName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  roomBadge: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  summaryCard: {
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text.primary,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  summaryBadgeText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    marginLeft: SPACING.xs,
    color: COLORS.text.primary,
  },
  timeSlotSection: {
    marginBottom: SPACING.lg,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  timeSlotTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
  },
  timeSlotCount: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  scheduleCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scheduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scheduleCardInfo: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  scheduleTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  scheduleTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  scheduleCardRight: {
    marginLeft: SPACING.sm,
  },
  prnBadge: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.status.warning,
    backgroundColor: `${COLORS.status.warning}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  scheduleDetails: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
    paddingLeft: 28, // Align with title (icon size + margin)
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    minWidth: 250,
  },
  scheduleCardOverdue: {
    borderColor: COLORS.error,
    borderWidth: 2,
    backgroundColor: `${COLORS.error}08`, // Very light red tint
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  overdueText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },
});
