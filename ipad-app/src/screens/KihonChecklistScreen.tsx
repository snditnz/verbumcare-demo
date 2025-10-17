import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { assessKihonChecklist, KihonChecklistScores } from '@utils/healthcareAssessments';
import { KihonChecklist } from '@models/app';

type RootStackParamList = {
  KihonChecklist: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'KihonChecklist'>;
};

// Question configuration
const DOMAINS = [
  { key: 'iadl', questionCount: 5, startQ: 1 },
  { key: 'physical', questionCount: 5, startQ: 6 },
  { key: 'nutrition', questionCount: 2, startQ: 11 },
  { key: 'oral', questionCount: 3, startQ: 13 },
  { key: 'housebound', questionCount: 2, startQ: 16 },
  { key: 'cognitive', questionCount: 3, startQ: 18 },
  { key: 'depressive', questionCount: 5, startQ: 21 },
];

export default function KihonChecklistScreen({ navigation }: Props) {
  const { currentPatient, setCurrentStep, setKihonChecklist, language } = useAssessmentStore();

  // Current section (0-6 for domains, 7 for results)
  const [currentSection, setCurrentSection] = useState(0);

  // Answers: true = Yes, false = No, null = not answered
  const [answers, setAnswers] = useState<Record<number, boolean | null>>({});

  // Notes
  const [notes, setNotes] = useState('');

  const t = translations[language];

  useEffect(() => {
    setCurrentStep('kihon-checklist');
  }, []);

  // Calculate domain scores based on answers
  const domainScores = useMemo((): KihonChecklistScores => {
    const scores = {
      iadl: 0,
      physical: 0,
      nutrition: 0,
      oral: 0,
      housebound: 0,
      cognitive: 0,
      depressive: 0,
    };

    // Domain 1: IADL (Q1-5) - "No" = at risk
    for (let q = 1; q <= 5; q++) {
      if (answers[q] === false) scores.iadl++;
    }

    // Domain 2: Physical (Q6-10) - Q6-8: "No" = at risk, Q9-10: "Yes" = at risk
    if (answers[6] === false) scores.physical++;
    if (answers[7] === false) scores.physical++;
    if (answers[8] === false) scores.physical++;
    if (answers[9] === true) scores.physical++;
    if (answers[10] === true) scores.physical++;

    // Domain 3: Nutrition (Q11-12) - "Yes" = at risk
    if (answers[11] === true) scores.nutrition++;
    if (answers[12] === true) scores.nutrition++;

    // Domain 4: Oral (Q13-15) - "Yes" = at risk
    if (answers[13] === true) scores.oral++;
    if (answers[14] === true) scores.oral++;
    if (answers[15] === true) scores.oral++;

    // Domain 5: Housebound (Q16-17) - Q16: "No" = at risk, Q17: "Yes" = at risk
    if (answers[16] === false) scores.housebound++;
    if (answers[17] === true) scores.housebound++;

    // Domain 6: Cognitive (Q18-20) - Q18,Q20: "Yes" = at risk, Q19: "No" = at risk
    if (answers[18] === true) scores.cognitive++;
    if (answers[19] === false) scores.cognitive++;
    if (answers[20] === true) scores.cognitive++;

    // Domain 7: Depressive (Q21-25) - "Yes" = at risk
    for (let q = 21; q <= 25; q++) {
      if (answers[q] === true) scores.depressive++;
    }

    return scores;
  }, [answers]);

  // Get assessment result
  const assessmentResult = useMemo(() => {
    return assessKihonChecklist(domainScores);
  }, [domainScores]);

  // Check if current section is completed
  const isSectionComplete = (sectionIndex: number): boolean => {
    if (sectionIndex === 7) return true; // Results screen

    const domain = DOMAINS[sectionIndex];
    for (let q = domain.startQ; q < domain.startQ + domain.questionCount; q++) {
      if (answers[q] === null || answers[q] === undefined) return false;
    }
    return true;
  };

  // Check if all questions answered
  const isComplete = useMemo(() => {
    for (let q = 1; q <= 25; q++) {
      if (answers[q] === null || answers[q] === undefined) return false;
    }
    return true;
  }, [answers]);

  const handleNext = () => {
    if (currentSection < 6) {
      if (!isSectionComplete(currentSection)) {
        Alert.alert(
          language === 'ja' ? '未回答の質問' : 'Unanswered Questions',
          language === 'ja' ? 'すべての質問に回答してください' : 'Please answer all questions in this section'
        );
        return;
      }
      setCurrentSection(currentSection + 1);
    } else if (currentSection === 6) {
      // Move to results
      if (!isComplete) {
        Alert.alert(
          language === 'ja' ? '未完了' : 'Incomplete',
          language === 'ja' ? 'すべての質問に回答してください' : 'Please complete all questions before viewing results'
        );
        return;
      }
      setCurrentSection(7);
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSave = () => {
    if (!isComplete) {
      Alert.alert(
        language === 'ja' ? '未完了' : 'Incomplete',
        language === 'ja' ? 'すべての質問に回答してください' : 'Please complete all sections before saving'
      );
      return;
    }

    const kihonData: KihonChecklist = {
      iadl_score: domainScores.iadl,
      physical_score: domainScores.physical,
      nutrition_score: domainScores.nutrition,
      oral_score: domainScores.oral,
      housebound_score: domainScores.housebound,
      cognitive_score: domainScores.cognitive,
      depressive_score: domainScores.depressive,
      questions: Object.fromEntries(
        Object.entries(answers).map(([q, ans]) => [`q${q}`, ans === true])
      ),
      total_score: assessmentResult.totalScore,
      frailty_status: assessmentResult.frailtyStatus,
      iadl_risk: assessmentResult.riskFlags.iadl,
      physical_risk: assessmentResult.riskFlags.physical,
      nutrition_risk: assessmentResult.riskFlags.nutrition,
      oral_risk: assessmentResult.riskFlags.oral,
      housebound_risk: assessmentResult.riskFlags.housebound,
      cognitive_risk: assessmentResult.riskFlags.cognitive,
      depressive_risk: assessmentResult.riskFlags.depressive,
      notes: notes || undefined,
      recorded_at: new Date(),
    };

    // Save to store
    setKihonChecklist(kihonData);

    Alert.alert(
      t['common.success'],
      language === 'ja' ? '基本チェックリストを保存しました' : 'Kihon Checklist saved',
      [
        {
          text: t['common.ok'],
          onPress: () => navigation.navigate('PatientInfo' as any),
        },
      ]
    );
  };

  const handleCancel = () => {
    const hasAnswers = Object.keys(answers).length > 0;
    if (hasAnswers || notes) {
      Alert.alert(
        t['dialog.discardChanges'],
        language === 'ja' ? '変更を破棄しますか？' : 'Discard this assessment?',
        [
          { text: t['common.no'], style: 'cancel' },
          {
            text: t['common.discard'],
            style: 'destructive',
            onPress: () => navigation.navigate('PatientInfo' as any),
          },
        ]
      );
    } else {
      navigation.navigate('PatientInfo' as any);
    }
  };

  const getColorForStatus = (status: string): string => {
    switch (status) {
      case 'green':
        return COLORS.status.normal;
      case 'yellow':
        return COLORS.status.warning;
      case 'red':
        return COLORS.status.critical;
      default:
        return COLORS.status.neutral;
    }
  };

  // Render question domain
  const renderDomainQuestions = (domainIndex: number) => {
    const domain = DOMAINS[domainIndex];
    const questions = [];

    for (let i = 0; i < domain.questionCount; i++) {
      const questionNum = domain.startQ + i;
      questions.push(
        <View key={questionNum} style={styles.questionContainer}>
          <Text style={styles.questionNumber}>Q{questionNum}</Text>
          <Text style={styles.questionText}>{t[`kihon.q${questionNum}`]}</Text>

          <View style={styles.answerButtons}>
            <TouchableOpacity
              style={[
                styles.answerButton,
                answers[questionNum] === true && styles.answerButtonSelected,
              ]}
              onPress={() => setAnswers({ ...answers, [questionNum]: true })}
            >
              <Text
                style={[
                  styles.answerButtonText,
                  answers[questionNum] === true && styles.answerButtonTextSelected,
                ]}
              >
                {language === 'ja' ? 'はい' : 'Yes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.answerButton,
                answers[questionNum] === false && styles.answerButtonSelected,
              ]}
              onPress={() => setAnswers({ ...answers, [questionNum]: false })}
            >
              <Text
                style={[
                  styles.answerButtonText,
                  answers[questionNum] === false && styles.answerButtonTextSelected,
                ]}
              >
                {language === 'ja' ? 'いいえ' : 'No'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return questions;
  };

  // Render results screen
  const renderResults = () => (
    <View>
      {/* Overall Frailty Status */}
      <Card statusColor={getColorForStatus(assessmentResult.status)}>
        <View style={styles.scoreHeader}>
          <Ionicons
            name="fitness"
            size={ICON_SIZES.xl}
            color={getColorForStatus(assessmentResult.status)}
          />
          <Text style={styles.scoreTitle}>{t['kihon.totalScore']}</Text>
          <Text style={[styles.scoreValue, { color: getColorForStatus(assessmentResult.status) }]}>
            {assessmentResult.totalScore}/25
          </Text>
        </View>

        <View style={[styles.frailtyBadge, { backgroundColor: `${getColorForStatus(assessmentResult.status)}20` }]}>
          <Text style={styles.frailtyEmoji}>{assessmentResult.emoji}</Text>
          <Text style={[styles.frailtyLabel, { color: getColorForStatus(assessmentResult.status) }]}>
            {language === 'ja' ? assessmentResult.frailtyLabelJa : assessmentResult.frailtyLabel}
          </Text>
        </View>
      </Card>

      {/* Domain Scores */}
      <Card>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart" size={ICON_SIZES.lg} color={COLORS.primary} />
          <Text style={styles.cardTitle}>{t['kihon.domainScores']}</Text>
        </View>

        <View style={styles.domainScoresList}>
          {DOMAINS.map((domain, index) => {
            const score = domainScores[domain.key as keyof KihonChecklistScores];
            const maxScore = domain.questionCount;
            const isAtRisk = assessmentResult.riskFlags[domain.key as keyof typeof assessmentResult.riskFlags];

            return (
              <View key={domain.key} style={styles.domainScoreItem}>
                <Text style={styles.domainName}>{t[`kihon.domain${index + 1}`]}</Text>
                <View style={styles.domainScoreRight}>
                  <Text style={styles.domainScore}>{score}/{maxScore}</Text>
                  {isAtRisk && (
                    <Ionicons name="warning" size={ICON_SIZES.sm} color={COLORS.status.warning} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Recommendations */}
      {assessmentResult.recommendations.length > 0 && (
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="clipboard" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t['kihon.recommendations']}</Text>
          </View>

          <View style={styles.recommendationsList}>
            {(language === 'ja' ? assessmentResult.recommendationsJa : assessmentResult.recommendations).map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.primary} />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text" size={ICON_SIZES.lg} color={COLORS.primary} />
          <Text style={styles.cardTitle}>{t['pain.notes']}</Text>
        </View>

        <TextInput
          style={styles.notesInput}
          placeholder={
            language === 'ja'
              ? '追加のコメントや観察事項を記録...'
              : 'Record additional comments or observations...'
          }
          placeholderTextColor={COLORS.text.disabled}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={handleCancel}>
            {`← ${t['common.cancel']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          {currentPatient && (
            <Text style={styles.patientName}>
              {currentPatient.family_name} {currentPatient.given_name}
            </Text>
          )}
          <Text style={styles.screenTitle}>{t['kihon.title']}</Text>
          <Text style={styles.screenSubtitle}>{t['kihon.subtitle']}</Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      {/* Progress Indicator */}
      {currentSection < 7 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {t['kihon.section']} {currentSection + 1} {t['kihon.of']} 7
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentSection + 1) / 7) * 100}%` }
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView style={styles.content}>
        {currentSection < 7 ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="list" size={ICON_SIZES.lg} color={COLORS.primary} />
              <Text style={styles.cardTitle}>
                {t[`kihon.domain${currentSection + 1}`]}
              </Text>
            </View>

            {renderDomainQuestions(currentSection)}
          </Card>
        ) : (
          renderResults()
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {currentSection > 0 && currentSection < 7 && (
          <Button variant="outline" onPress={handlePrevious}>
            <Ionicons name="arrow-back" size={ICON_SIZES.sm} color={COLORS.primary} />
            <Text style={[styles.buttonText, { color: COLORS.primary }]}>
              {t['kihon.previousSection']}
            </Text>
          </Button>
        )}

        {currentSection < 6 ? (
          <Button
            variant="primary"
            onPress={handleNext}
            style={{ marginLeft: 'auto' }}
          >
            <Text style={[styles.buttonText, { color: COLORS.accent }]}>
              {t['kihon.nextSection']}
            </Text>
            <Ionicons name="arrow-forward" size={ICON_SIZES.sm} color={COLORS.accent} />
          </Button>
        ) : currentSection === 6 ? (
          <Button
            variant="primary"
            onPress={handleNext}
            disabled={!isComplete}
            style={{ marginLeft: 'auto' }}
          >
            <Text style={[styles.buttonText, { color: COLORS.accent }]}>
              {t['kihon.viewResults']}
            </Text>
            <Ionicons name="bar-chart" size={ICON_SIZES.sm} color={COLORS.accent} />
          </Button>
        ) : (
          <>
            <Button variant="outline" onPress={() => setCurrentSection(0)}>
              {language === 'ja' ? '質問に戻る' : 'Back to Questions'}
            </Button>
            <Button
              variant="primary"
              onPress={handleSave}
            >
              <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.accent} />
              <Text style={[styles.buttonText, { color: COLORS.accent }]}>
                {t['common.save']}
              </Text>
            </Button>
          </>
        )}
      </View>
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
  screenSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  progressContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  questionContainer: {
    marginBottom: SPACING.xl,
  },
  questionNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },
  questionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  answerButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  answerButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    minHeight: SPACING.touchTarget.comfortable,
  },
  answerButtonSelected: {
    backgroundColor: `${COLORS.primary}10`,
    borderColor: COLORS.primary,
  },
  answerButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  answerButtonTextSelected: {
    color: COLORS.primary,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  scoreTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  scoreValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginLeft: 'auto',
  },
  frailtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  frailtyEmoji: {
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  frailtyLabel: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  domainScoresList: {
    gap: SPACING.md,
  },
  domainScoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  domainName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    flex: 1,
  },
  domainScoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  domainScore: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
  },
  recommendationsList: {
    gap: SPACING.md,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  recommendationText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 100,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.lg,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginLeft: SPACING.xs,
    marginRight: SPACING.xs,
  },
});
