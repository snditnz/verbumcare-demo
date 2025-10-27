import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
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
  const { language } = useAssessmentStore();
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

  const renderScheduleItem = (item: any) => {
    const iconColor = getColorForType(item.type);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.scheduleCard}
        onPress={() => {
          // TODO: Navigate to relevant screen based on type
          console.log('Navigate to:', item.type, item.id);
        }}
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
});
