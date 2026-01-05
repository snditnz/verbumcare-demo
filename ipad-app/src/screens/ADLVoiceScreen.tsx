import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, VoiceRecorder, HeaderNav, ServerStatusIndicator } from '@components';
import { Button, Card } from '@components/ui';
import { apiService } from '@services';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { DEMO_STAFF_ID } from '@constants/config';

type RootStackParamList = {
  ADLVoice: undefined;
  IncidentReport: undefined;
  ReviewConfirm: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ADLVoice'>;
};

// Japanese Barthel Index categories - organized by priority (critical daily activities first)
const BARTHEL_INDEX_PAGE1 = [
  { key: 'eating', ja: '食事', en: 'Eating', scores: [{ value: 10, ja: '自立', en: 'Independent' }, { value: 5, ja: '一部介助', en: 'Needs help' }, { value: 0, ja: '全介助', en: 'Dependent' }] },
  { key: 'transfer', ja: '移乗', en: 'Transfer', scores: [{ value: 15, ja: '自立', en: 'Independent' }, { value: 10, ja: '軽介助', en: 'Minor help' }, { value: 5, ja: '要介助', en: 'Major help' }, { value: 0, ja: '全介助', en: 'Dependent' }] },
  { key: 'toileting', ja: 'トイレ動作', en: 'Toileting', scores: [{ value: 10, ja: '自立', en: 'Independent' }, { value: 5, ja: '一部介助', en: 'Needs help' }, { value: 0, ja: '全介助', en: 'Dependent' }] },
  { key: 'walking', ja: '歩行', en: 'Walking', scores: [{ value: 15, ja: '自立', en: 'Independent' }, { value: 10, ja: '軽介助', en: 'Minor help' }, { value: 5, ja: '車椅子', en: 'Wheelchair' }, { value: 0, ja: '不可', en: 'Immobile' }] },
];

const BARTHEL_INDEX_PAGE2 = [
  { key: 'grooming', ja: '整容', en: 'Grooming', scores: [{ value: 5, ja: '自立', en: 'Independent' }, { value: 0, ja: '要介助', en: 'Needs help' }] },
  { key: 'bathing', ja: '入浴', en: 'Bathing', scores: [{ value: 5, ja: '自立', en: 'Independent' }, { value: 0, ja: '要介助', en: 'Needs help' }] },
  { key: 'stairs', ja: '階段昇降', en: 'Stairs', scores: [{ value: 10, ja: '自立', en: 'Independent' }, { value: 5, ja: '要介助', en: 'Needs help' }, { value: 0, ja: '不可', en: 'Unable' }] },
  { key: 'dressing', ja: '着替え', en: 'Dressing', scores: [{ value: 10, ja: '自立', en: 'Independent' }, { value: 5, ja: '一部介助', en: 'Needs help' }, { value: 0, ja: '全介助', en: 'Dependent' }] },
];

const BARTHEL_INDEX_PAGE3 = [
  { key: 'bowel', ja: '排便管理', en: 'Bowel Control', scores: [{ value: 10, ja: '自立', en: 'Continent' }, { value: 5, ja: '時々失禁', en: 'Occasional' }, { value: 0, ja: '失禁', en: 'Incontinent' }] },
  { key: 'bladder', ja: '排尿管理', en: 'Bladder Control', scores: [{ value: 10, ja: '自立', en: 'Continent' }, { value: 5, ja: '時々失禁', en: 'Occasional' }, { value: 0, ja: '失禁', en: 'Incontinent' }] },
];

export default function ADLVoiceScreen({ navigation }: Props) {
  const { currentPatient, setADLRecordingId, setBarthelIndex, setCurrentStep, language } = useAssessmentStore();
  const [isUploading, setIsUploading] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [barthelScores, setBarthelScores] = useState<Record<string, number | null>>({});
  const [additionalNotes, setAdditionalNotes] = useState('');
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('adl-voice');
  }, []);

  const handleRecordingComplete = async (uri: string, duration: number) => {
    setRecordingUri(uri);

    Alert.alert(
      t['voice.uploadConfirm'],
      t['voice.uploadConfirmMessage'],
      [
        {
          text: t['common.cancel'],
          style: 'cancel',
        },
        {
          text: t['voice.upload'],
          onPress: () => uploadRecording(uri),
        },
      ]
    );
  };

  const uploadRecording = async (uri: string) => {
    if (!currentPatient) {
      Alert.alert(t['common.error'], t['voice.noPatient']);
      return;
    }

    try {
      setIsUploading(true);

      // Upload voice recording
      const uploadResponse = await apiService.uploadVoiceRecording(
        uri,
        currentPatient.patient_id,
        DEMO_STAFF_ID
      );

      setADLRecordingId(uploadResponse.recording_id);

      // Trigger async processing
      await apiService.processVoiceRecording(uploadResponse.recording_id);

      Alert.alert(
        t['voice.uploadSuccess'],
        t['voice.processingStarted'],
        [
          {
            text: t['common.ok'],
            onPress: () => navigation.navigate('PatientInfo' as any),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to upload recording:', error);
      Alert.alert(
        t['common.error'],
        t['voice.uploadFailed'],
        [
          {
            text: t['common.retry'],
            onPress: () => uploadRecording(uri),
          },
          {
            text: t['common.cancel'],
            style: 'cancel',
          },
        ]
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      t['voice.skipWarning'],
      t['voice.skipWarningMessage'],
      [
        {
          text: t['common.cancel'],
          style: 'cancel',
        },
        {
          text: t['common.skip'],
          onPress: () => navigation.navigate('PatientInfo' as any),
        },
      ]
    );
  };

  const handleContinue = () => {
    if (!hasData) return;

    // Create ADL summary for confirmation dialog
    const scoredCategories = Object.entries(barthelScores)
      .filter(([_, score]) => score !== null)
      .map(([key, score]) => {
        const category = [...BARTHEL_INDEX_PAGE1, ...BARTHEL_INDEX_PAGE2, ...BARTHEL_INDEX_PAGE3]
          .find(c => c.key === key);
        const categoryName = language === 'ja' ? category?.ja : category?.en;
        return `${categoryName}: ${score}`;
      });

    const adlSummary = [
      language === 'ja' ? `合計スコア: ${totalScore}/100` : `Total Score: ${totalScore}/100`,
      recordingUri ? (language === 'ja' ? '音声記録: あり' : 'Voice Recording: Yes') : null,
      scoredCategories.length > 0 ? `\n${scoredCategories.join('\n')}` : null,
      additionalNotes ? `\n${language === 'ja' ? 'メモ' : 'Notes'}: ${additionalNotes}` : null,
    ].filter(Boolean).join('\n');

    Alert.alert(
      t['dialog.confirmSave'],
      adlSummary,
      [
        {
          text: t['common.cancel'],
          style: 'cancel',
        },
        {
          text: t['common.save'],
          onPress: () => {
            // Save ADL data to store
            setBarthelIndex({
              total_score: totalScore,
              scores: barthelScores as Record<string, number>,
              additional_notes: additionalNotes || undefined,
              recorded_at: new Date(),
            });
            // Navigate back to Patient Info hub
            navigation.navigate('PatientInfo' as any);
          },
        },
      ]
    );
  };

  const totalScore: number = Object.values(barthelScores).reduce((sum: number, score) => sum + (score || 0), 0);
  const hasData = recordingUri || Object.keys(barthelScores).length > 0 || additionalNotes;
  const currentCategories = currentPage === 1 ? BARTHEL_INDEX_PAGE1 : currentPage === 2 ? BARTHEL_INDEX_PAGE2 : BARTHEL_INDEX_PAGE3;

  return (
    <SafeAreaView style={styles.container}>
      {/* Patient Context Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <HeaderNav />
        </View>
        <View style={styles.headerCenter}>
          {currentPatient && (
            <Text style={styles.patientName}>
              {currentPatient.family_name} {currentPatient.given_name}
            </Text>
          )}
          <Text style={styles.screenTitle}>
            {language === 'ja' ? 'ADL記録' : 'ADL Recording'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Compact Voice Recorder - Top Left */}
        <View style={styles.voiceRecorderCompact}>
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
          />
          {recordingUri && (
            <View style={styles.recordingBadge}>
              <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.success} />
              <Text style={styles.recordingBadgeText}>
                {t['voice.recorded'] || 'Recorded'}
              </Text>
            </View>
          )}
        </View>

        {/* Page Header with Score */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>
            {language === 'ja' ? 'バーセル指数' : 'Barthel Index'}
          </Text>
          <View style={styles.pageInfo}>
            <Text style={styles.totalScoreText}>
              {totalScore}/100{t['common.points'] || 'pts'}
            </Text>
            <Text style={styles.pageIndicator}>
              {language === 'ja' ? `ページ ${currentPage}/3` : `Page ${currentPage}/3`}
            </Text>
          </View>
        </View>

        {/* ADL Category Cards - 2-Column Grid for iPad */}
        <View style={styles.categoriesGrid}>
          {currentCategories.map((category) => {
            const currentScore = barthelScores[category.key];

            return (
              <Card key={category.key} style={styles.categoryCard}>
                <Text style={styles.categoryTitle}>
                  {language === 'ja' ? category.ja : category.en}
                </Text>
                <View style={styles.scoreButtons}>
                  {category.scores.map((scoreOption) => (
                    <TouchableOpacity
                      key={scoreOption.value}
                      style={[
                        styles.scoreButton,
                        currentScore === scoreOption.value && styles.scoreButtonSelected,
                      ]}
                      onPress={() => setBarthelScores({ ...barthelScores, [category.key]: scoreOption.value })}
                    >
                      <Text
                        style={[
                          styles.scoreButtonValue,
                          currentScore === scoreOption.value && styles.scoreButtonValueSelected,
                        ]}
                      >
                        {scoreOption.value}
                      </Text>
                      <Text
                        style={[
                          styles.scoreButtonLabel,
                          currentScore === scoreOption.value && styles.scoreButtonLabelSelected,
                        ]}
                      >
                        {language === 'ja' ? scoreOption.ja : scoreOption.en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>

        {/* Additional Notes - Page 3 */}
        {currentPage === 3 && (
          <Card style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <Ionicons name="document-text" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>
                {language === 'ja' ? '追加メモ' : 'Additional Notes'}
              </Text>
            </View>
            <TextInput
              style={styles.notesInput}
              multiline
              placeholder={language === 'ja' ? 'その他の観察事項を記入...' : 'Enter additional observations...'}
              placeholderTextColor={COLORS.text.disabled}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              textAlignVertical="top"
            />
          </Card>
        )}
      </ScrollView>

      {/* Bottom Actions with Page Navigation */}
      <View style={styles.bottomActions}>
        {currentPage > 1 ? (
          <Button variant="outline" onPress={() => setCurrentPage(currentPage - 1)}>
            {`← ${t['common.back']}`}
          </Button>
        ) : (
          <Button variant="text" onPress={handleSkip}>
            {t['common.skip']}
          </Button>
        )}

        {currentPage < 3 ? (
          <Button variant="primary" onPress={() => setCurrentPage(currentPage + 1)}>
            {language === 'ja' ? '次のページ →' : 'Next Page →'}
          </Button>
        ) : (
          <Button
            variant="primary"
            onPress={handleContinue}
            disabled={!hasData}
          >
            {t['common.save']}
          </Button>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.md,
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
  voiceRecorderCompact: {
    marginBottom: 0,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: `${COLORS.success}15`,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  recordingBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  pageInfo: {
    alignItems: 'flex-end',
  },
  totalScoreText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  pageIndicator: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  categoryCard: {
    width: '48.5%', // 2 columns for iPad landscape
  },
  categoryTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  scoreButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  scoreButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    minHeight: SPACING.touchTarget.comfortable,
    justifyContent: 'center',
  },
  scoreButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  scoreButtonValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  scoreButtonValueSelected: {
    color: COLORS.accent,
  },
  scoreButtonLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  scoreButtonLabelSelected: {
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  notesCard: {
    marginTop: SPACING.md,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  notesInput: {
    height: 120,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
});
