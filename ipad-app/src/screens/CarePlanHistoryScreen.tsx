import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { AuditLogEntry, MonitoringRecord } from '@types/app';

type RootStackParamList = {
  CarePlanHistory: undefined;
  CarePlanHub: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CarePlanHistory'>;
};

type FilterType = 'all' | 'monitoring' | 'changes' | 'items';

export default function CarePlanHistoryScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { getCarePlanByPatientId } = useCarePlanStore();

  const [filter, setFilter] = useState<FilterType>('all');

  const t = translations[language];
  const carePlan = currentPatient ? getCarePlanByPatientId(currentPatient.patient_id) : undefined;

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
              {language === 'ja' ? 'ケアプラン履歴' : 'Care Plan History'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <LanguageToggle />
          </View>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color={COLORS.text.disabled} />
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'ケアプランが見つかりません' : 'Care plan not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const auditLog = carePlan.auditLog || [];
  const monitoringRecords = carePlan.monitoringRecords || [];

  // Combine and sort all history items
  type HistoryItem =
    | { type: 'audit'; data: AuditLogEntry }
    | { type: 'monitoring'; data: MonitoringRecord };

  const allHistory: HistoryItem[] = [
    ...auditLog.map(entry => ({ type: 'audit' as const, data: entry })),
    ...monitoringRecords.map(record => ({ type: 'monitoring' as const, data: record })),
  ].sort((a, b) => {
    const timeA = a.type === 'audit' ? a.data.timestamp.getTime() : a.data.monitoringDate.getTime();
    const timeB = b.type === 'audit' ? b.data.timestamp.getTime() : b.data.monitoringDate.getTime();
    return timeB - timeA; // Newest first
  });

  // Filter history
  const filteredHistory = allHistory.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'monitoring') return item.type === 'monitoring';
    if (filter === 'changes') return item.type === 'audit' && item.data.action.includes('updated');
    if (filter === 'items') return item.type === 'audit' && (item.data.action.includes('added') || item.data.action.includes('removed'));
    return true;
  });

  const formatDate = (date: Date): string => {
    return language === 'ja'
      ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
      : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, { ja: string; en: string }> = {
      created: { ja: '作成', en: 'Created' },
      updated: { ja: '更新', en: 'Updated' },
      monitoring_completed: { ja: 'モニタリング完了', en: 'Monitoring Completed' },
      item_added: { ja: '項目追加', en: 'Item Added' },
      item_updated: { ja: '項目更新', en: 'Item Updated' },
      item_removed: { ja: '項目削除', en: 'Item Removed' },
      goal_updated: { ja: '目標更新', en: 'Goal Updated' },
    };
    return language === 'ja' ? labels[action]?.ja || action : labels[action]?.en || action;
  };

  const getActionIcon = (action: string): keyof typeof Ionicons.glyphMap => {
    if (action.includes('created')) return 'add-circle';
    if (action.includes('updated')) return 'pencil';
    if (action.includes('monitoring')) return 'clipboard';
    if (action.includes('removed')) return 'trash';
    if (action.includes('added')) return 'add-circle-outline';
    return 'ellipsis-horizontal-circle';
  };

  const getActionColor = (action: string): string => {
    if (action.includes('created') || action.includes('added')) return COLORS.success;
    if (action.includes('updated')) return COLORS.primary;
    if (action.includes('monitoring')) return COLORS.accent;
    if (action.includes('removed')) return COLORS.error;
    return COLORS.text.secondary;
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
            {language === 'ja' ? 'ケアプラン履歴' : 'Care Plan History'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Filters */}
        <View style={styles.filters}>
          {(['all', 'monitoring', 'changes', 'items'] as FilterType[]).map(filterType => (
            <Button
              key={filterType}
              variant={filter === filterType ? 'primary' : 'outline'}
              onPress={() => setFilter(filterType)}
              style={styles.filterButton}
            >
              {language === 'ja'
                ? {
                    all: '全て',
                    monitoring: 'モニタリング',
                    changes: '変更',
                    items: '項目',
                  }[filterType]
                : {
                    all: 'All',
                    monitoring: 'Monitoring',
                    changes: 'Changes',
                    items: 'Items',
                  }[filterType]}
            </Button>
          ))}
        </View>

        {/* Timeline */}
        {filteredHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color={COLORS.text.disabled} />
            <Text style={styles.emptyText}>
              {language === 'ja' ? '履歴がありません' : 'No history'}
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {filteredHistory.map((item, index) => {
              if (item.type === 'monitoring') {
                const record = item.data;
                return (
                  <View key={`monitoring-${record.id}`} style={styles.timelineItem}>
                    <View style={styles.timelineDot}>
                      <View style={[styles.dot, { backgroundColor: COLORS.accent }]} />
                      {index < filteredHistory.length - 1 && <View style={styles.line} />}
                    </View>

                    <Card style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyIcon}>
                          <Ionicons name="clipboard" size={ICON_SIZES.md} color={COLORS.accent} />
                        </View>
                        <View style={styles.historyHeaderContent}>
                          <Text style={styles.historyAction}>
                            {language === 'ja' ? 'モニタリング実施' : 'Monitoring Conducted'}
                          </Text>
                          <Text style={styles.historyUser}>{record.conductedByName}</Text>
                        </View>
                        <View style={styles.historyTimestamp}>
                          <Text style={styles.historyDate}>{formatDate(record.monitoringDate)}</Text>
                          <Text style={styles.historyTime}>{formatTime(record.monitoringDate)}</Text>
                        </View>
                      </View>

                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDetailLabel}>
                          {language === 'ja' ? '種類:' : 'Type:'}
                        </Text>
                        <Text style={styles.historyDetailValue}>
                          {record.monitoringType === 'routine_3month'
                            ? language === 'ja'
                              ? '定期（3ヶ月）'
                              : '3-Month Routine'
                            : record.monitoringType === 'formal_6month'
                            ? language === 'ja'
                              ? '公式（6ヶ月）'
                              : '6-Month Formal'
                            : language === 'ja'
                            ? '状態変化時'
                            : 'Condition Change'}
                        </Text>
                      </View>

                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDetailLabel}>
                          {language === 'ja' ? '全体評価:' : 'Overall Status:'}
                        </Text>
                        <Text style={styles.historyDetailValue} numberOfLines={2}>
                          {record.overallStatus}
                        </Text>
                      </View>

                      <View style={styles.historyDetails}>
                        <Text style={styles.historyDetailLabel}>
                          {language === 'ja' ? 'レビュー項目数:' : 'Items Reviewed:'}
                        </Text>
                        <Text style={styles.historyDetailValue}>{record.itemReviews.length}</Text>
                      </View>
                    </Card>
                  </View>
                );
              } else {
                const entry = item.data;
                const actionColor = getActionColor(entry.action);

                return (
                  <View key={`audit-${entry.id}`} style={styles.timelineItem}>
                    <View style={styles.timelineDot}>
                      <View style={[styles.dot, { backgroundColor: actionColor }]} />
                      {index < filteredHistory.length - 1 && <View style={styles.line} />}
                    </View>

                    <Card style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyIcon}>
                          <Ionicons
                            name={getActionIcon(entry.action)}
                            size={ICON_SIZES.md}
                            color={actionColor}
                          />
                        </View>
                        <View style={styles.historyHeaderContent}>
                          <Text style={styles.historyAction}>{getActionLabel(entry.action)}</Text>
                          <Text style={styles.historyUser}>{entry.userName}</Text>
                        </View>
                        <View style={styles.historyTimestamp}>
                          <Text style={styles.historyDate}>{formatDate(entry.timestamp)}</Text>
                          <Text style={styles.historyTime}>{formatTime(entry.timestamp)}</Text>
                        </View>
                      </View>

                      {entry.changes && (
                        <View style={styles.historyChanges}>
                          <Text style={styles.historyChangesText}>
                            {JSON.stringify(entry.changes, null, 2)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.historyFooter}>
                        <Text style={styles.historyVersion}>
                          {language === 'ja' ? 'バージョン' : 'Version'} {entry.version}
                        </Text>
                      </View>
                    </Card>
                  </View>
                );
              }
            })}
          </View>
        )}
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
    paddingVertical: SPACING['3xl'],
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.disabled,
    marginTop: SPACING.md,
  },
  filters: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  filterButton: {
    flex: 1,
  },
  timeline: {
    paddingBottom: SPACING.xl,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  timelineDot: {
    alignItems: 'center',
    marginRight: SPACING.md,
    paddingTop: SPACING.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  historyCard: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  historyIcon: {
    marginRight: SPACING.sm,
  },
  historyHeaderContent: {
    flex: 1,
  },
  historyAction: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  historyUser: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  historyTimestamp: {
    alignItems: 'flex-end',
  },
  historyDate: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  historyTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  historyDetails: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  historyDetailLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginRight: SPACING.sm,
    minWidth: 100,
  },
  historyDetailValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    flex: 1,
  },
  historyChanges: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  historyChangesText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontFamily: 'monospace',
  },
  historyFooter: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  historyVersion: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.disabled,
  },
});
