import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { WeeklyScheduleItem } from '@types/app';

type RootStackParamList = {
  WeeklySchedule: undefined;
  CarePlanHub: undefined;
  AddScheduleItem: { dayOfWeek?: number };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WeeklySchedule'>;
};

const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土']; // Japanese
const DAYS_OF_WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night'] as const;

export default function WeeklyScheduleScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { getCarePlanByPatientId } = useCarePlanStore();

  const t = translations[language];
  const carePlan = currentPatient ? getCarePlanByPatientId(currentPatient.patient_id) : undefined;
  const daysLabels = language === 'ja' ? DAYS_OF_WEEK : DAYS_OF_WEEK_EN;

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
              {language === 'ja' ? '週間サービス計画表' : 'Weekly Schedule'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <LanguageToggle />
          </View>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'ケアプランが見つかりません' : 'Care plan not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const weeklySchedule = carePlan.weeklySchedule || [];

  const getScheduleForDay = (dayOfWeek: number) => {
    return weeklySchedule.filter(item => item.dayOfWeek === dayOfWeek);
  };

  const getTimeSlotLabel = (timeSlot: string): string => {
    const labels: Record<string, { ja: string; en: string }> = {
      morning: { ja: '朝', en: 'Morning' },
      afternoon: { ja: '昼', en: 'Afternoon' },
      evening: { ja: '夕', en: 'Evening' },
      night: { ja: '夜', en: 'Night' },
      specific_time: { ja: '指定時刻', en: 'Specific Time' },
    };
    return language === 'ja' ? labels[timeSlot]?.ja || timeSlot : labels[timeSlot]?.en || timeSlot;
  };

  const getServiceTypeIcon = (serviceType: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      vital_signs: 'heart-outline',
      medication: 'medical-outline',
      bathing: 'water-outline',
      meals: 'restaurant-outline',
      rehabilitation: 'fitness-outline',
      recreation: 'game-controller-outline',
      doctor_visit: 'medkit-outline',
      family_visit: 'people-outline',
      other: 'ellipsis-horizontal-outline',
    };
    return icons[serviceType] || 'ellipsis-horizontal-outline';
  };

  const getServiceTypeLabel = (serviceType: string): string => {
    const labels: Record<string, { ja: string; en: string }> = {
      vital_signs: { ja: 'バイタルサイン', en: 'Vital Signs' },
      medication: { ja: '服薬', en: 'Medication' },
      bathing: { ja: '入浴', en: 'Bathing' },
      meals: { ja: '食事', en: 'Meals' },
      rehabilitation: { ja: 'リハビリ', en: 'Rehabilitation' },
      recreation: { ja: 'レクリエーション', en: 'Recreation' },
      doctor_visit: { ja: '診察', en: 'Doctor Visit' },
      family_visit: { ja: '家族訪問', en: 'Family Visit' },
      other: { ja: 'その他', en: 'Other' },
    };
    return language === 'ja' ? labels[serviceType]?.ja || serviceType : labels[serviceType]?.en || serviceType;
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
            {language === 'ja' ? '週間サービス計画表' : 'Weekly Schedule'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Weekly Grid */}
        <View style={styles.weekGrid}>
          {[0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => {
            const daySchedule = getScheduleForDay(dayOfWeek);

            return (
              <View key={dayOfWeek} style={styles.dayColumn}>
                {/* Day Header */}
                <View style={[styles.dayHeader, dayOfWeek === 0 && styles.sundayHeader]}>
                  <Text style={[styles.dayHeaderText, dayOfWeek === 0 && styles.sundayText]}>
                    {daysLabels[dayOfWeek]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AddScheduleItem' as any, { dayOfWeek })}
                    style={styles.addButton}
                  >
                    <Ionicons name="add-circle" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {/* Schedule Items */}
                <ScrollView style={styles.dayContent}>
                  {daySchedule.length === 0 ? (
                    <View style={styles.emptyDay}>
                      <Text style={styles.emptyDayText}>
                        {language === 'ja' ? '予定なし' : 'No schedule'}
                      </Text>
                    </View>
                  ) : (
                    daySchedule.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.scheduleItem}
                        onPress={() => {
                          // TODO: Navigate to edit screen
                          Alert.alert(
                            language === 'ja' ? 'スケジュール項目' : 'Schedule Item',
                            item.service.description
                          );
                        }}
                      >
                        <View style={styles.scheduleItemHeader}>
                          <Ionicons
                            name={getServiceTypeIcon(item.service.type)}
                            size={ICON_SIZES.sm}
                            color={COLORS.primary}
                          />
                          <Text style={styles.scheduleItemTime}>
                            {item.specificTime || getTimeSlotLabel(item.timeSlot)}
                          </Text>
                        </View>
                        <Text style={styles.scheduleItemTitle} numberOfLines={1}>
                          {getServiceTypeLabel(item.service.type)}
                        </Text>
                        <Text style={styles.scheduleItemDescription} numberOfLines={2}>
                          {item.service.description}
                        </Text>
                        <View style={styles.scheduleItemFooter}>
                          <Text style={styles.scheduleItemDuration}>
                            {item.service.duration}{language === 'ja' ? '分' : 'min'}
                          </Text>
                          <Text style={styles.scheduleItemProvider} numberOfLines={1}>
                            {item.service.provider}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <Card style={{ marginTop: SPACING.lg }}>
          <Text style={styles.legendTitle}>
            {language === 'ja' ? 'サービス種別' : 'Service Types'}
          </Text>
          <View style={styles.legendGrid}>
            {[
              'vital_signs',
              'medication',
              'bathing',
              'meals',
              'rehabilitation',
              'recreation',
              'doctor_visit',
              'family_visit',
            ].map(type => (
              <View key={type} style={styles.legendItem}>
                <Ionicons
                  name={getServiceTypeIcon(type)}
                  size={ICON_SIZES.sm}
                  color={COLORS.primary}
                />
                <Text style={styles.legendText}>{getServiceTypeLabel(type)}</Text>
              </View>
            ))}
          </View>
        </Card>
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
    marginTop: SPACING.md,
  },
  weekGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dayColumn: {
    flex: 1,
    minWidth: 140,
  },
  dayHeader: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderTopRightRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sundayHeader: {
    backgroundColor: COLORS.error,
  },
  dayHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  sundayText: {
    color: COLORS.white,
  },
  addButton: {
    padding: SPACING.xs,
  },
  dayContent: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.border,
    borderBottomLeftRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
    minHeight: 400,
    maxHeight: 600,
  },
  emptyDay: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
  },
  scheduleItem: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    margin: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  scheduleItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  scheduleItemTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  scheduleItemTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  scheduleItemDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  scheduleItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleItemDuration: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  scheduleItemProvider: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  legendTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    minWidth: '30%',
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
});
