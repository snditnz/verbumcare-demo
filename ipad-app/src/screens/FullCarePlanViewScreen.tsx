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
import { CarePlanItem } from '@models/app';

type RootStackParamList = {
  FullCarePlanView: undefined;
  CarePlanHub: undefined;
  AddCarePlanItem: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FullCarePlanView'>;
};

export default function FullCarePlanViewScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { getCarePlanByPatientId, problemTemplates } = useCarePlanStore();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const t = translations[language];
  const carePlan = currentPatient ? getCarePlanByPatientId(currentPatient.patient_id) : undefined;

  if (!currentPatient || !carePlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {language === 'ja' ? 'ケアプランが見つかりません' : 'Care plan not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const translateCareLevel = (careLevel: string) => {
    if (language === 'ja') return careLevel;

    const careLevelMap: Record<string, string> = {
      '要支援1': 'Support Level 1',
      '要支援2': 'Support Level 2',
      '要介護1': 'Care Level 1',
      '要介護2': 'Care Level 2',
      '要介護3': 'Care Level 3',
      '要介護4': 'Care Level 4',
      '要介護5': 'Care Level 5',
    };

    return careLevelMap[careLevel] || careLevel;
  };

  // Translate text if it matches a template
  const getTranslatedText = (text: string): string => {
    if (!text || !problemTemplates || problemTemplates.length === 0) return text;

    // Search through templates to find a match
    for (const template of problemTemplates) {
      // Check if text matches the template text (in any language)
      if (text === template.japanese || text === template.english || text === template.chinese) {
        // If current language is available, return it; otherwise return the original text
        if (language === 'ja' && template.japanese) return template.japanese;
        if (language === 'en' && template.english) return template.english;
        if (language === 'zh' && template.chinese) return template.chinese;
        return text; // fallback to original text
      }
    }

    return text; // No match found, return original
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return COLORS.error;
      case 'high':
        return COLORS.status.warning;
      case 'medium':
        return COLORS.status.normal;
      default:
        return COLORS.text.secondary;
    }
  };

  const ProblemCard = ({ item }: { item: CarePlanItem }) => {
    const isExpanded = expandedItems.has(item.id);
    const priorityColor = getPriorityColor(item.problem.priority);

    return (
      <Card statusColor={priorityColor}>
        <TouchableOpacity onPress={() => toggleExpanded(item.id)}>
          <View style={styles.problemHeader}>
            <View style={styles.problemHeaderLeft}>
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                size={ICON_SIZES.md}
                color={COLORS.text.secondary}
              />
              <Text style={styles.problemTitle}>
                {t['carePlan.problem']} {carePlan.carePlanItems.indexOf(item) + 1}: {getTranslatedText(item.problem.description)}
              </Text>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20`, borderColor: priorityColor }]}>
              <Text style={[styles.priorityText, { color: priorityColor }]}>
                {t[`carePlan.${item.problem.priority}`]}
              </Text>
            </View>
          </View>

          <View style={styles.problemMeta}>
            <Text style={styles.categoryBadge}>
              {t[`carePlan.category.${item.problem.category}`]}
            </Text>
            <Text style={styles.statusText}>
              {t[`carePlan.status.${item.problem.status}`]}
            </Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Long-term Goal */}
            <View style={styles.goalSection}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>{t['carePlan.longTermGoal']}</Text>
                <Text style={styles.progressPercent}>{item.longTermGoal.achievementStatus}%</Text>
              </View>
              <Text style={styles.goalDescription}>{item.longTermGoal.description}</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${item.longTermGoal.achievementStatus}%` }]}
                />
              </View>
              <Text style={styles.deadlineText}>
                {t['carePlan.deadline']}: {formatDate(item.longTermGoal.targetDate)}
              </Text>
            </View>

            {/* Short-term Goal */}
            <View style={styles.goalSection}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>{t['carePlan.shortTermGoal']}</Text>
                <Text style={styles.progressPercent}>{item.shortTermGoal.achievementStatus}%</Text>
              </View>
              <Text style={styles.goalDescription}>{item.shortTermGoal.description}</Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${item.shortTermGoal.achievementStatus}%` }]}
                />
              </View>
              <Text style={styles.deadlineText}>
                {t['carePlan.deadline']}: {formatDate(item.shortTermGoal.targetDate)}
              </Text>
              {item.shortTermGoal.measurableCriteria && (
                <Text style={styles.criteriaText}>
                  {t['carePlan.achievementCriteria']}: {item.shortTermGoal.measurableCriteria}
                </Text>
              )}
            </View>

            {/* Interventions */}
            {item.interventions.length > 0 && (
              <View style={styles.interventionsSection}>
                <Text style={styles.sectionTitle}>{t['carePlan.interventions']}:</Text>
                {item.interventions.map((intervention) => (
                  <View key={intervention.id} style={styles.interventionItem}>
                    <View style={styles.interventionHeader}>
                      <View style={[styles.interventionTypeBadge, { backgroundColor: getInterventionColor(intervention.type) }]}>
                        <Text style={styles.interventionTypeText}>
                          {t[`carePlan.${intervention.type}`]}
                        </Text>
                      </View>
                    </View>
                    {intervention.observationPlan && (
                      <View style={styles.interventionDetails}>
                        {intervention.observationPlan.whatToMonitor.map((item, idx) => (
                          <Text key={idx} style={styles.interventionDetailText}>• {item}</Text>
                        ))}
                        <Text style={styles.interventionMeta}>
                          {language === 'ja' ? '頻度' : 'Frequency'}: {intervention.observationPlan.frequency}
                        </Text>
                      </View>
                    )}
                    {intervention.carePlan && (
                      <View style={styles.interventionDetails}>
                        {intervention.carePlan.specificActions.map((action, idx) => (
                          <Text key={idx} style={styles.interventionDetailText}>• {action}</Text>
                        ))}
                        <Text style={styles.interventionMeta}>
                          {intervention.carePlan.frequency} | {intervention.carePlan.duration}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Linked Records */}
            {(item.linkedAssessments.adlId || item.linkedAssessments.fallRiskId || item.linkedAssessments.painAssessmentId) && (
              <View style={styles.linkedSection}>
                <Text style={styles.sectionTitle}>{t['carePlan.linkedRecords']}:</Text>
                <View style={styles.linkedBadges}>
                  {item.linkedAssessments.adlId && (
                    <View style={styles.linkedBadge}>
                      <Ionicons name="fitness" size={ICON_SIZES.sm} color={COLORS.primary} />
                      <Text style={styles.linkedText}>{language === 'ja' ? 'ADL記録' : 'ADL'}</Text>
                    </View>
                  )}
                  {item.linkedAssessments.fallRiskId && (
                    <View style={styles.linkedBadge}>
                      <Ionicons name="warning" size={ICON_SIZES.sm} color={COLORS.status.warning} />
                      <Text style={styles.linkedText}>{language === 'ja' ? '転倒リスク評価' : 'Fall Risk'}</Text>
                    </View>
                  )}
                  {item.linkedAssessments.painAssessmentId && (
                    <View style={styles.linkedBadge}>
                      <Ionicons name="alert-circle" size={ICON_SIZES.sm} color={COLORS.error} />
                      <Text style={styles.linkedText}>{language === 'ja' ? '痛み評価' : 'Pain'}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Progress Notes */}
            {item.progressNotes.length > 0 && (
              <View style={styles.notesSection}>
                <Text style={styles.sectionTitle}>
                  {t['carePlan.progressNotes']} ({item.progressNotes.length})
                </Text>
                {item.progressNotes.slice(0, 2).map((note) => (
                  <View key={note.id} style={styles.noteItem}>
                    <Text style={styles.noteDate}>{formatDate(note.date)}</Text>
                    <Text style={styles.noteText}>{note.note}</Text>
                    <Text style={styles.noteAuthor}>— {note.authorName}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.updateInfo}>
              <Text style={styles.updateText}>
                {t['carePlan.lastUpdated']}: {formatDate(item.lastUpdated)}
              </Text>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const getInterventionColor = (type: string) => {
    switch (type) {
      case 'observation':
        return `${COLORS.primary}20`;
      case 'care':
        return `${COLORS.accent}20`;
      case 'education':
        return `${COLORS.status.normal}20`;
      default:
        return `${COLORS.text.secondary}20`;
    }
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
            {currentPatient.family_name} {currentPatient.given_name} {t['carePlan.title']}
          </Text>
          <Text style={styles.screenTitle}>
            {translateCareLevel(carePlan.careLevel)} | {t['carePlan.version']} {carePlan.version}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Intent Section */}
        <Card>
          <View style={styles.intentSection}>
            <Text style={styles.intentLabel}>{t['carePlan.patientIntent']}:</Text>
            <Text style={styles.intentText}>「{carePlan.patientIntent}」</Text>
          </View>
          <View style={styles.intentSection}>
            <Text style={styles.intentLabel}>{t['carePlan.familyIntent']}:</Text>
            <Text style={styles.intentText}>「{carePlan.familyIntent}」</Text>
          </View>
        </Card>

        {/* Comprehensive Policy */}
        <Card>
          <Text style={styles.policyLabel}>{t['carePlan.comprehensivePolicy']}:</Text>
          <Text style={styles.policyText}>{carePlan.comprehensivePolicy}</Text>
        </Card>

        {/* Problems Section Header */}
        <View style={styles.problemsSectionHeader}>
          <Text style={styles.problemsSectionTitle}>{t['carePlan.problemsGoalsInterventions']}</Text>
          <Text style={styles.problemsCount}>
            {carePlan.carePlanItems.length} {t['carePlan.problems']}
          </Text>
        </View>

        {/* Problem Cards */}
        {carePlan.carePlanItems.map((item) => (
          <ProblemCard key={item.id} item={item} />
        ))}

        {/* Add Problem Button */}
        <TouchableOpacity
          style={styles.addProblemButton}
          onPress={() => navigation.navigate('AddCarePlanItem')}
        >
          <Ionicons name="add-circle" size={ICON_SIZES.lg} color={COLORS.accent} />
          <Text style={styles.addProblemText}>{t['carePlan.addNewProblem']}</Text>
        </TouchableOpacity>
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
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
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
  intentSection: {
    marginBottom: SPACING.md,
  },
  intentLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  intentText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    fontStyle: 'italic',
  },
  policyLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  policyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  problemsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  problemsSectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  problemsCount: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  problemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  problemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: SPACING.sm,
  },
  problemTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 1,
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
  problemMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
    paddingLeft: SPACING.xl + SPACING.sm,
  },
  categoryBadge: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  expandedContent: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  goalSection: {
    marginBottom: SPACING.lg,
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
  progressPercent: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
  },
  goalDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  deadlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  criteriaText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  interventionsSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  interventionItem: {
    marginBottom: SPACING.md,
  },
  interventionHeader: {
    marginBottom: SPACING.xs,
  },
  interventionTypeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  interventionTypeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  interventionDetails: {
    marginTop: SPACING.xs,
  },
  interventionDetailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  interventionMeta: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  linkedSection: {
    marginBottom: SPACING.lg,
  },
  linkedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  linkedText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
  },
  notesSection: {
    marginBottom: SPACING.lg,
  },
  noteItem: {
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  noteDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  noteText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  noteAuthor: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  updateInfo: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  updateText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  addProblemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  addProblemText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.accent,
  },
});
