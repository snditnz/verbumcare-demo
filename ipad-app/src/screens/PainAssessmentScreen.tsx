import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, HeaderNav } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { assessPain } from '@utils/healthcareAssessments';
import { PainAssessment, PainLocation } from '@models/app';

type RootStackParamList = {
  PainAssessment: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PainAssessment'>;
};

type PainLocationType = 'head' | 'neck' | 'shoulder' | 'back' | 'chest' | 'abdomen' | 'hip' | 'leg' | 'arm' | 'multiple';
type PainType = 'rest' | 'movement' | 'both';

const PAIN_LOCATIONS: { key: PainLocationType; ja: string; en: string; icon: string }[] = [
  { key: 'head', ja: '頭部・顔面', en: 'Head/Face', icon: 'body' },
  { key: 'neck', ja: '首', en: 'Neck', icon: 'body' },
  { key: 'shoulder', ja: '肩', en: 'Shoulder', icon: 'body' },
  { key: 'back', ja: '背中', en: 'Back', icon: 'body' },
  { key: 'chest', ja: '胸部', en: 'Chest', icon: 'heart' },
  { key: 'abdomen', ja: '腹部', en: 'Abdomen', icon: 'body' },
  { key: 'hip', ja: '腰・臀部', en: 'Hip/Lower Back', icon: 'body' },
  { key: 'leg', ja: '下肢', en: 'Leg', icon: 'walk' },
  { key: 'arm', ja: '上肢', en: 'Arm', icon: 'hand-left' },
  { key: 'multiple', ja: 'その他', en: 'Other', icon: 'ellipsis-horizontal-circle' },
];

const PAIN_TYPES: { key: PainType; ja: string; en: string }[] = [
  { key: 'rest', ja: '安静時', en: 'At Rest' },
  { key: 'movement', ja: '動作時', en: 'During Movement' },
  { key: 'both', ja: '両方', en: 'Both' },
];

interface LocationPainData {
  location: PainLocationType;
  intensity: number | null;
  painType: PainType | null;
  notes: string;
}

export default function PainAssessmentScreen({ navigation }: Props) {
  const { currentPatient, setPainAssessment, setCurrentStep, language } = useAssessmentStore();

  // Multi-location pain tracking
  const [selectedLocations, setSelectedLocations] = useState<PainLocationType[]>([]);
  const [locationPainData, setLocationPainData] = useState<Record<PainLocationType, LocationPainData>>({} as any);
  const [generalNotes, setGeneralNotes] = useState('');

  const t = translations[language];

  useEffect(() => {
    setCurrentStep('pain-assessment');
  }, []);

  // Get previous pain score for trend analysis
  const previousPainScore = currentPatient?.latest_pain_score;

  // Calculate highest pain score across all locations
  const highestPainScore = useMemo(() => {
    const scores = selectedLocations
      .map(loc => locationPainData[loc]?.intensity)
      .filter((score): score is number => score !== null && score !== undefined);
    return scores.length > 0 ? Math.max(...scores) : null;
  }, [selectedLocations, locationPainData]);

  // Calculate pain assessment for highest score
  const painAssessment = useMemo(() => {
    if (highestPainScore === null) return null;
    return assessPain(highestPainScore);
  }, [highestPainScore]);

  // Calculate trend
  const trend = useMemo(() => {
    if (highestPainScore === null || previousPainScore === undefined) return null;

    if (highestPainScore < previousPainScore) {
      return { direction: 'improved' as const, label: t['pain.improved'], color: COLORS.success };
    } else if (highestPainScore > previousPainScore) {
      return { direction: 'worsened' as const, label: t['pain.worsened'], color: COLORS.error };
    } else {
      return { direction: 'unchanged' as const, label: t['pain.unchanged'], color: COLORS.text.secondary };
    }
  }, [highestPainScore, previousPainScore, t]);

  const toggleLocation = (location: PainLocationType) => {
    if (selectedLocations.includes(location)) {
      // Remove location
      setSelectedLocations(selectedLocations.filter(loc => loc !== location));
      const newData = { ...locationPainData };
      delete newData[location];
      setLocationPainData(newData);
    } else {
      // Add location
      setSelectedLocations([...selectedLocations, location]);
      setLocationPainData({
        ...locationPainData,
        [location]: {
          location,
          intensity: null,
          painType: null,
          notes: '',
        },
      });
    }
  };

  const updateLocationData = (location: PainLocationType, field: keyof LocationPainData, value: any) => {
    setLocationPainData({
      ...locationPainData,
      [location]: {
        ...locationPainData[location],
        [field]: value,
      },
    });
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

  const handleSave = () => {
    if (selectedLocations.length === 0) {
      Alert.alert(
        t['common.error'],
        language === 'ja' ? '少なくとも1つの痛みの場所を選択してください' : 'Please select at least one pain location'
      );
      return;
    }

    // Validate that all selected locations have intensity scores
    const missingIntensity = selectedLocations.filter(loc => locationPainData[loc]?.intensity === null);
    if (missingIntensity.length > 0) {
      Alert.alert(
        t['common.error'],
        language === 'ja' ? 'すべての選択された場所に痛みの強さを入力してください' : 'Please set pain intensity for all selected locations'
      );
      return;
    }

    // Convert to PainLocation array
    const locations: PainLocation[] = selectedLocations.map(loc => {
      const data = locationPainData[loc];
      const locationLabel = language === 'ja'
        ? PAIN_LOCATIONS.find(l => l.key === loc)?.ja
        : PAIN_LOCATIONS.find(l => l.key === loc)?.en;

      return {
        location: locationLabel || loc,
        intensity: data.intensity!,
        pain_type: data.painType || undefined,
        notes: data.notes || undefined,
      };
    });

    const assessment: PainAssessment = {
      pain_score: highestPainScore!,
      locations,
      general_notes: generalNotes || undefined,
      previous_score: previousPainScore,
      recorded_at: new Date(),
    };

    // Show confirmation with summary
    const locationsSummary = locations
      .map(loc => `${loc.location}: ${loc.intensity}/10`)
      .join('\n');

    const summary = [
      `${t['pain.score']} (${language === 'ja' ? '最高' : 'Highest'}): ${highestPainScore}/10`,
      painAssessment ? `${language === 'ja' ? painAssessment.statusLabelJa : painAssessment.statusLabel}` : '',
      `\n${language === 'ja' ? '痛みの場所' : 'Pain Locations'}:`,
      locationsSummary,
      trend ? `\n${t['pain.trend']}: ${trend.label}` : '',
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
    if (selectedLocations.length > 0 || generalNotes) {
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
          <HeaderNav 
            onBack={handleCancel}
            backLabel={`← ${t['common.cancel']}`}
          />
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
          <ServerStatusIndicator compact />
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

        {/* Highest Pain Score Display */}
        {highestPainScore !== null && (
          <Card statusColor={painAssessment ? getColorForStatus(painAssessment.status) : COLORS.status.neutral}>
            <View style={styles.scoreHeader}>
              <Ionicons name="pulse" size={ICON_SIZES.lg} color={getColorForStatus(painAssessment?.status || 'green')} />
              <Text style={styles.scoreTitle}>{language === 'ja' ? '最高痛みスコア' : 'Highest Pain Score'}</Text>
              <Text style={[styles.scoreValue, { color: getColorForStatus(painAssessment?.status || 'green') }]}>
                {highestPainScore}/10
              </Text>
            </View>

            {painAssessment && (
              <View style={[styles.assessmentBadge, { backgroundColor: `${getColorForStatus(painAssessment.status)}20` }]}>
                <Text style={styles.assessmentEmoji}>{painAssessment.emoji}</Text>
                <Text style={[styles.assessmentLabel, { color: getColorForStatus(painAssessment.status) }]}>
                  {language === 'ja' ? painAssessment.statusLabelJa : painAssessment.statusLabel}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Pain Locations (Multi-select) */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="body" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '痛みの場所 (複数選択可)' : 'Pain Locations (Select Multiple)'} *
            </Text>
          </View>

          <View style={styles.locationGrid}>
            {PAIN_LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc.key}
                style={[
                  styles.locationCard,
                  selectedLocations.includes(loc.key) && styles.locationCardSelected,
                ]}
                onPress={() => toggleLocation(loc.key)}
              >
                <Ionicons
                  name={loc.icon as any}
                  size={ICON_SIZES.md}
                  color={selectedLocations.includes(loc.key) ? COLORS.accent : COLORS.primary}
                />
                <Text style={[
                  styles.locationLabel,
                  selectedLocations.includes(loc.key) && styles.locationLabelSelected,
                ]}>
                  {language === 'ja' ? loc.ja : loc.en}
                </Text>
                {selectedLocations.includes(loc.key) && locationPainData[loc.key]?.intensity !== null && (
                  <View style={styles.intensityBadge}>
                    <Text style={styles.intensityBadgeText}>{locationPainData[loc.key].intensity}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Individual Location Details */}
        {selectedLocations.map((locKey) => {
          const loc = PAIN_LOCATIONS.find(l => l.key === locKey);
          const data = locationPainData[locKey];
          const locAssessment = data?.intensity !== null ? assessPain(data.intensity) : null;

          return (
            <Card key={locKey} statusColor={locAssessment ? getColorForStatus(locAssessment.status) : undefined}>
              <View style={styles.locationDetailHeader}>
                <Ionicons name={loc?.icon as any} size={ICON_SIZES.lg} color={COLORS.primary} />
                <Text style={styles.locationDetailTitle}>
                  {language === 'ja' ? loc?.ja : loc?.en}
                </Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => toggleLocation(locKey)}
                >
                  <Ionicons name="close-circle" size={ICON_SIZES.md} color={COLORS.error} />
                </TouchableOpacity>
              </View>

              {/* Pain Intensity for this location */}
              <Text style={styles.sectionLabel}>
                {language === 'ja' ? '痛みの強さ' : 'Pain Intensity'} *
              </Text>
              <View style={styles.nrsScale}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.nrsButton,
                      data?.intensity === score && styles.nrsButtonSelected,
                      score === 0 && styles.nrsButtonGreen,
                      score >= 1 && score <= 3 && styles.nrsButtonGreen,
                      score >= 4 && score <= 6 && styles.nrsButtonYellow,
                      score >= 7 && styles.nrsButtonRed,
                      data?.intensity === score && score >= 7 && { borderColor: COLORS.status.critical },
                    ]}
                    onPress={() => updateLocationData(locKey, 'intensity', score)}
                  >
                    <Text style={[
                      styles.nrsButtonText,
                      data?.intensity === score && styles.nrsButtonTextSelected,
                    ]}>
                      {score}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pain Type */}
              <Text style={styles.sectionLabel}>{t['pain.type']}</Text>
              <View style={styles.painTypeButtons}>
                {PAIN_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.painTypeButton,
                      data?.painType === type.key && styles.painTypeButtonSelected,
                    ]}
                    onPress={() => updateLocationData(locKey, 'painType', type.key)}
                  >
                    <Text style={[
                      styles.painTypeText,
                      data?.painType === type.key && styles.painTypeTextSelected,
                    ]}>
                      {language === 'ja' ? type.ja : type.en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location-specific Notes */}
              <Text style={styles.sectionLabel}>
                {language === 'ja' ? 'メモ (この場所の詳細)' : 'Notes (Details for this location)'}
              </Text>
              <TextInput
                style={styles.locationNotesInput}
                placeholder={
                  language === 'ja'
                    ? '痛みの特徴、誘因などを記録...'
                    : 'Record pain characteristics, triggers, etc...'
                }
                placeholderTextColor={COLORS.text.disabled}
                value={data?.notes || ''}
                onChangeText={(text) => updateLocationData(locKey, 'notes', text)}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </Card>
          );
        })}

        {/* General Notes */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '全体メモ' : 'General Notes'}
            </Text>
          </View>

          <TextInput
            style={styles.notesInput}
            placeholder={
              language === 'ja'
                ? '全体的な痛みの状況、その他の観察事項...'
                : 'Overall pain situation, other observations...'
            }
            placeholderTextColor={COLORS.text.disabled}
            value={generalNotes}
            onChangeText={setGeneralNotes}
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
          disabled={selectedLocations.length === 0}
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
    position: 'relative',
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
  intensityBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  intensityBadgeText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  locationDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  locationDetailTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    flex: 1,
  },
  removeButton: {
    padding: SPACING.xs,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  nrsScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
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
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  nrsButtonTextSelected: {
    color: COLORS.primary,
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
  painTypeButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  painTypeButton: {
    flex: 1,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  painTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  painTypeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  painTypeTextSelected: {
    color: COLORS.accent,
  },
  locationNotesInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 60,
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
