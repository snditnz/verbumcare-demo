import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { assessPain } from '@utils/healthcareAssessments';
import { PainAssessment } from '@models/app';

type RootStackParamList = {
  PainAssessment: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PainAssessment'>;
};

type PainLocation = 'head' | 'neck' | 'shoulder' | 'back' | 'chest' | 'abdomen' | 'hip' | 'leg' | 'arm' | 'multiple';
type PainType = 'rest' | 'movement' | 'both';

const PAIN_LOCATIONS: { key: PainLocation; ja: string; en: string; icon: string }[] = [
  { key: 'head', ja: '頭部・顔面', en: 'Head/Face', icon: 'body' },
  { key: 'neck', ja: '首', en: 'Neck', icon: 'body' },
  { key: 'shoulder', ja: '肩', en: 'Shoulder', icon: 'body' },
  { key: 'back', ja: '背中', en: 'Back', icon: 'body' },
  { key: 'chest', ja: '胸部', en: 'Chest', icon: 'heart' },
  { key: 'abdomen', ja: '腹部', en: 'Abdomen', icon: 'body' },
  { key: 'hip', ja: '腰・臀部', en: 'Hip/Lower Back', icon: 'body' },
  { key: 'leg', ja: '下肢', en: 'Leg', icon: 'walk' },
  { key: 'arm', ja: '上肢', en: 'Arm', icon: 'hand-left' },
  { key: 'multiple', ja: '複数箇所', en: 'Multiple Areas', icon: 'location' },
];

const PAIN_TYPES: { key: PainType; ja: string; en: string }[] = [
  { key: 'rest', ja: '安静時', en: 'At Rest' },
  { key: 'movement', ja: '動作時', en: 'During Movement' },
  { key: 'both', ja: '両方', en: 'Both' },
];

export default function PainAssessmentScreen({ navigation }: Props) {
  const { currentPatient, setPainAssessment, setCurrentStep, language } = useAssessmentStore();

  const [painScore, setPainScore] = useState<number | null>(null);
  const [location, setLocation] = useState<PainLocation | null>(null);
  const [painType, setPainType] = useState<PainType | null>(null);
  const [notes, setNotes] = useState('');

  const t = translations[language];

  useEffect(() => {
    setCurrentStep('pain-assessment');
  }, []);

  // Get previous pain score for trend analysis
  const previousPainScore = currentPatient?.latest_pain_score;

  // Calculate pain assessment
  const painAssessment = useMemo(() => {
    if (painScore === null) return null;
    return assessPain(painScore);
  }, [painScore]);

  // Calculate trend
  const trend = useMemo(() => {
    if (painScore === null || previousPainScore === undefined) return null;

    if (painScore < previousPainScore) {
      return { direction: 'improved' as const, label: t['pain.improved'], color: COLORS.success };
    } else if (painScore > previousPainScore) {
      return { direction: 'worsened' as const, label: t['pain.worsened'], color: COLORS.error };
    } else {
      return { direction: 'unchanged' as const, label: t['pain.unchanged'], color: COLORS.text.secondary };
    }
  }, [painScore, previousPainScore, t]);

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

  const handleSave = () => {
    if (painScore === null) {
      Alert.alert(
        t['common.error'],
        language === 'ja' ? '痛みのスコアを選択してください' : 'Please select a pain score'
      );
      return;
    }

    const assessment: PainAssessment = {
      pain_score: painScore,
      location: location ? t[`pain.${location}`] : undefined,
      pain_type: painType || undefined,
      notes: notes || undefined,
      previous_score: previousPainScore,
      recorded_at: new Date(),
    };

    // Show confirmation with summary
    const summary = [
      `${t['pain.score']}: ${painScore}/10`,
      painAssessment ? `${language === 'ja' ? painAssessment.statusLabelJa : painAssessment.statusLabel}` : '',
      location ? `${t['pain.location']}: ${language === 'ja' ? PAIN_LOCATIONS.find(l => l.key === location)?.ja : PAIN_LOCATIONS.find(l => l.key === location)?.en}` : '',
      painType ? `${t['pain.type']}: ${language === 'ja' ? PAIN_TYPES.find(p => p.key === painType)?.ja : PAIN_TYPES.find(p => p.key === painType)?.en}` : '',
      trend ? `${t['pain.trend']}: ${trend.label}` : '',
    ].filter(Boolean).join('\n');

    Alert.alert(
      t['dialog.confirmSave'],
      summary,
      [
        { text: t['common.cancel'], style: 'cancel' },
        {
          text: t['common.confirm'],
          onPress: () => {
            // Save to store
            setPainAssessment(assessment);

            Alert.alert(
              t['common.success'],
              language === 'ja' ? '痛みの評価を保存しました' : 'Pain assessment saved',
              [
                {
                  text: t['common.ok'],
                  onPress: () => navigation.navigate('PatientInfo' as any),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    if (painScore !== null || location || painType || notes) {
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
          <Text style={styles.screenTitle}>{t['pain.title']}</Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Previous Score & Trend */}
        {previousPainScore !== undefined && (
          <Card style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Ionicons name="trending-up" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.trendTitle}>{t['pain.previousScore']}</Text>
              <Text style={styles.previousScore}>{previousPainScore}/10</Text>
              {trend && (
                <View style={[styles.trendBadge, { backgroundColor: `${trend.color}20` }]}>
                  <Text style={[styles.trendText, { color: trend.color }]}>
                    {trend.label}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Pain Score (NRS 0-10) */}
        <Card
          statusColor={painAssessment ? getColorForStatus(painAssessment.status) : COLORS.status.neutral}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="pulse" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t['pain.nrsScale']} *</Text>
          </View>

          <View style={styles.nrsScale}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <TouchableOpacity
                key={score}
                style={[
                  styles.nrsButton,
                  painScore === score && styles.nrsButtonSelected,
                  score === 0 && styles.nrsButtonGreen,
                  score >= 1 && score <= 3 && styles.nrsButtonGreen,
                  score >= 4 && score <= 6 && styles.nrsButtonYellow,
                  score >= 7 && styles.nrsButtonRed,
                  painScore === score && score >= 7 && { borderColor: COLORS.status.critical },
                ]}
                onPress={() => setPainScore(score)}
              >
                <Text style={[
                  styles.nrsButtonText,
                  painScore === score && styles.nrsButtonTextSelected,
                ]}>
                  {score}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.nrsLabels}>
            <Text style={styles.nrsLabelLeft}>{t['pain.noPain']}</Text>
            <Text style={styles.nrsLabelRight}>{t['pain.severePain']}</Text>
          </View>

          {painAssessment && (
            <View style={[styles.assessmentBadge, { backgroundColor: `${getColorForStatus(painAssessment.status)}20` }]}>
              <Text style={styles.assessmentEmoji}>{painAssessment.emoji}</Text>
              <Text style={[styles.assessmentLabel, { color: getColorForStatus(painAssessment.status) }]}>
                {language === 'ja' ? painAssessment.statusLabelJa : painAssessment.statusLabel}
              </Text>
            </View>
          )}

          {painAssessment?.clinicalNote && (
            <View style={styles.clinicalNote}>
              <Ionicons name="alert-circle" size={ICON_SIZES.sm} color={getColorForStatus(painAssessment.status)} />
              <Text style={[styles.clinicalNoteText, { color: getColorForStatus(painAssessment.status) }]}>
                {language === 'ja' ? painAssessment.clinicalNoteJa : painAssessment.clinicalNote}
              </Text>
            </View>
          )}
        </Card>

        {/* Pain Location */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="body" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t['pain.location']}</Text>
          </View>

          <View style={styles.locationGrid}>
            {PAIN_LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc.key}
                style={[
                  styles.locationCard,
                  location === loc.key && styles.locationCardSelected,
                ]}
                onPress={() => setLocation(loc.key)}
              >
                <Ionicons
                  name={loc.icon as any}
                  size={ICON_SIZES.md}
                  color={location === loc.key ? COLORS.accent : COLORS.primary}
                />
                <Text style={[
                  styles.locationLabel,
                  location === loc.key && styles.locationLabelSelected,
                ]}>
                  {language === 'ja' ? loc.ja : loc.en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Pain Type */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t['pain.type']}</Text>
          </View>

          <View style={styles.painTypeButtons}>
            {PAIN_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.painTypeButton,
                  painType === type.key && styles.painTypeButtonSelected,
                ]}
                onPress={() => setPainType(type.key)}
              >
                <Text style={[
                  styles.painTypeText,
                  painType === type.key && styles.painTypeTextSelected,
                ]}>
                  {language === 'ja' ? type.ja : type.en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Additional Notes */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t['pain.notes']}</Text>
          </View>

          <TextInput
            style={styles.notesInput}
            placeholder={
              language === 'ja'
                ? '痛みの詳細、特徴、誘因などを記録...'
                : 'Record pain characteristics, triggers, etc...'
            }
            placeholderTextColor={COLORS.text.disabled}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button variant="outline" onPress={handleCancel}>
          {t['common.cancel']}
        </Button>
        <Button
          variant="primary"
          onPress={handleSave}
          disabled={painScore === null}
        >
          <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.accent} />
          <Text style={[styles.buttonText, { color: COLORS.accent }]}>
            {t['common.save']}
          </Text>
        </Button>
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
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  trendCard: {
    marginBottom: SPACING.lg,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  trendTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  previousScore: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  trendBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    marginLeft: 'auto',
  },
  trendText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
  nrsScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  nrsButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nrsButtonSelected: {
    borderWidth: 3,
  },
  nrsButtonGreen: {
    borderColor: COLORS.status.normal,
  },
  nrsButtonYellow: {
    borderColor: COLORS.status.warning,
  },
  nrsButtonRed: {
    borderColor: COLORS.status.critical,
  },
  nrsButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  nrsButtonTextSelected: {
    color: COLORS.primary,
  },
  nrsLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  nrsLabelLeft: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  nrsLabelRight: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  assessmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  assessmentEmoji: {
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  assessmentLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  clinicalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: `${COLORS.error}10`,
    borderRadius: BORDER_RADIUS.md,
  },
  clinicalNoteText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  locationCard: {
    width: '30%',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: SPACING.touchTarget.comfortable,
  },
  locationCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  locationLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  locationLabelSelected: {
    color: COLORS.accent,
  },
  painTypeButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  painTypeButton: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    minHeight: SPACING.touchTarget.comfortable,
    justifyContent: 'center',
  },
  painTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  painTypeText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  painTypeTextSelected: {
    color: COLORS.accent,
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
  },
});
