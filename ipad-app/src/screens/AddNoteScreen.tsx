import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { NoteBadge } from '@components/ui/NoteBadge';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { useClinicalNotesStore, NoteCategory } from '@stores/clinicalNotesStore';
import { useAuthStore, getCurrentStaffId } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { apiService } from '@services/api';

type RootStackParamList = {
  AddNote: { patientId: string; patientName: string };
  ClinicalNotes: { patientId: string; patientName: string };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddNote'>;
  route: RouteProp<RootStackParamList, 'AddNote'>;
};

interface CategoryOption {
  key: NoteCategory;
  ja: string;
  en: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'symptom_observation', ja: '症状観察', en: 'Symptom Observation', icon: '👁️' },
  { key: 'treatment', ja: '処置', en: 'Treatment', icon: '💉' },
  { key: 'consultation', ja: '相談', en: 'Consultation', icon: '💬' },
  { key: 'fall_incident', ja: '転倒', en: 'Fall Incident', icon: '⚠️' },
  { key: 'medication', ja: '投薬', en: 'Medication', icon: '💊' },
  { key: 'vital_signs', ja: 'バイタルサイン', en: 'Vital Signs', icon: '📊' },
  { key: 'behavioral', ja: '行動観察', en: 'Behavioral', icon: '👀' },
  { key: 'other', ja: 'その他', en: 'Other', icon: '📝' },
];

export default function AddNoteScreen({ navigation, route }: Props) {
  const { patientId, patientName } = route.params;
  const { currentUser } = useAuthStore();
  const { addNote } = useClinicalNotesStore();
  const { language } = useAssessmentStore();

  const [noteText, setNoteText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory>('other');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Determine note type based on user role
  const noteType = useMemo(() => {
    if (currentUser?.role === 'doctor') return 'doctor_note';
    if (currentUser?.role === 'nurse') return 'nurse_note';
    return 'care_note';
  }, [currentUser]);

  const handleVoiceRecord = async () => {
    // TODO: Implement voice recording functionality
    // This would integrate with the existing voice recording infrastructure
    Alert.alert(
      language === 'ja' ? '音声記録' : 'Voice Recording',
      language === 'ja'
        ? '音声記録機能は現在開発中です。\n既存の音声記録システムと統合予定です。'
        : 'Voice recording feature is currently in development.\nWill be integrated with the existing voice recording system.',
      [{ text: 'OK' }]
    );
  };

  const handleSave = async () => {
    // Validation
    if (!noteText.trim()) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '記録内容を入力してください。' : 'Please enter note content.'
      );
      return;
    }

    if (followUpRequired && !followUpDate) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? 'フォローアップが必要な場合は、日付を入力してください。' : 'Please enter a follow-up date when follow-up is required.'
      );
      return;
    }

    if (!currentUser) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? 'ログインしてください。' : 'Please log in.'
      );
      return;
    }

    setIsSaving(true);

    try {
      const noteData = {
        patient_id: patientId,
        note_type: noteType,
        note_category: selectedCategory,
        note_text: noteText.trim(),
        // Use authenticated user's real staff_id from database
        authored_by: getCurrentStaffId(),
        author_role: currentUser.role,
        author_name: currentUser.fullNameJa || currentUser.fullName,
        follow_up_required: followUpRequired,
        follow_up_date: followUpRequired && followUpDate ? followUpDate : undefined,
        follow_up_notes: followUpRequired && followUpNotes ? followUpNotes : undefined,
        status: 'submitted',
        requires_approval: requiresApproval,
      };

      const createdNote = await apiService.createClinicalNote(noteData);

      // Add note to local store
      addNote(createdNote);

      Alert.alert(
        language === 'ja' ? '成功' : 'Success',
        language === 'ja' ? '記録を保存しました。' : 'Note saved successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '記録の保存に失敗しました。' : 'Failed to save note.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (noteText.trim()) {
      Alert.alert(
        language === 'ja' ? '確認' : 'Confirm',
        language === 'ja' ? '入力した内容が破棄されます。よろしいですか？' : 'Your input will be discarded. Are you sure?',
        [
          { text: language === 'ja' ? 'キャンセル' : 'Cancel', style: 'cancel' },
          { text: language === 'ja' ? '破棄' : 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const renderHeader = () => {
    const noteTypeTitle = language === 'ja'
      ? (noteType === 'nurse_note' ? '看護記録を追加' : noteType === 'doctor_note' ? '医師記録を追加' : '記録を追加')
      : (noteType === 'nurse_note' ? 'Add Nurse Note' : noteType === 'doctor_note' ? 'Add Doctor Note' : 'Add Note');

    return (
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
            <Ionicons name="close" size={ICON_SIZES.lg} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{noteTypeTitle}</Text>
            <Text style={styles.patientName}>{patientName}</Text>
          </View>
          <LanguageToggle />
        </View>
        <View style={styles.badgeContainer}>
          <NoteBadge noteType={noteType} size="medium" />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Category Selection */}
        <Card variant="outlined" padding="md">
          <Text style={styles.sectionTitle}>{language === 'ja' ? 'カテゴリー' : 'Category'}</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.key && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category.key)}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category.key && styles.categoryTextActive,
                  ]}
                >
                  {language === 'ja' ? category.ja : category.en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Note Text Input */}
        <Card variant="outlined" padding="md">
          <View style={styles.noteInputHeader}>
            <Text style={styles.sectionTitle}>{language === 'ja' ? '記録内容' : 'Note Content'}</Text>
            <TouchableOpacity
              style={styles.voiceButton}
              onPress={handleVoiceRecord}
              disabled={isRecording}
            >
              <Ionicons
                name={isRecording ? 'mic' : 'mic-outline'}
                size={ICON_SIZES.md}
                color={isRecording ? COLORS.error : COLORS.primary}
              />
              <Text style={[styles.voiceButtonText, isRecording && { color: COLORS.error }]}>
                {language === 'ja'
                  ? (isRecording ? '録音中...' : '音声入力')
                  : (isRecording ? 'Recording...' : 'Voice Input')}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={8}
            placeholder={language === 'ja'
              ? '患者の状態、実施した処置、観察内容などを記録してください...'
              : 'Record patient status, treatments performed, observations, etc...'}
            placeholderTextColor={COLORS.textSecondary}
            value={noteText}
            onChangeText={setNoteText}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>
            {language === 'ja' ? `${noteText.length}文字` : `${noteText.length} characters`}
          </Text>
        </Card>

        {/* Follow-up Section */}
        <Card variant="outlined" padding="md">
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>
                {language === 'ja' ? '📌 フォローアップが必要' : '📌 Follow-up Required'}
              </Text>
              <Text style={styles.switchSubtext}>
                {language === 'ja'
                  ? 'この記録に対するフォローアップアクションが必要な場合'
                  : 'When follow-up action is needed for this note'}
              </Text>
            </View>
            <Switch
              value={followUpRequired}
              onValueChange={setFollowUpRequired}
              trackColor={{ false: COLORS.neutral, true: COLORS.accent }}
              thumbColor={followUpRequired ? COLORS.primary : COLORS.white}
            />
          </View>

          {followUpRequired && (
            <View style={styles.followUpDetails}>
              <Text style={styles.inputLabel}>
                {language === 'ja' ? 'フォローアップ日' : 'Follow-up Date'}
              </Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => {
                  Alert.alert(
                    language === 'ja' ? 'フォローアップ日を選択' : 'Select Follow-up Date',
                    language === 'ja' ? '日付を選択してください' : 'Choose a date',
                    [
                      { text: language === 'ja' ? 'キャンセル' : 'Cancel', style: 'cancel' },
                      {
                        text: language === 'ja' ? '明日' : 'Tomorrow',
                        onPress: () => {
                          const date = new Date();
                          date.setDate(date.getDate() + 1);
                          setFollowUpDate(date.toISOString().split('T')[0]);
                        }
                      },
                      {
                        text: language === 'ja' ? '3日後' : '3 Days',
                        onPress: () => {
                          const date = new Date();
                          date.setDate(date.getDate() + 3);
                          setFollowUpDate(date.toISOString().split('T')[0]);
                        }
                      },
                      {
                        text: language === 'ja' ? '1週間' : '1 Week',
                        onPress: () => {
                          const date = new Date();
                          date.setDate(date.getDate() + 7);
                          setFollowUpDate(date.toISOString().split('T')[0]);
                        }
                      },
                      {
                        text: language === 'ja' ? '2週間' : '2 Weeks',
                        onPress: () => {
                          const date = new Date();
                          date.setDate(date.getDate() + 14);
                          setFollowUpDate(date.toISOString().split('T')[0]);
                        }
                      },
                      {
                        text: language === 'ja' ? '1ヶ月' : '1 Month',
                        onPress: () => {
                          const date = new Date();
                          date.setMonth(date.getMonth() + 1);
                          setFollowUpDate(date.toISOString().split('T')[0]);
                        }
                      },
                      {
                        text: language === 'ja' ? 'カスタム...' : 'Custom...',
                        onPress: () => {
                          Alert.prompt(
                            language === 'ja' ? '日付を入力' : 'Enter Date',
                            language === 'ja'
                              ? 'YYYY-MM-DD形式で入力してください\n(例: 2025-12-31)'
                              : 'Enter in YYYY-MM-DD format\n(e.g., 2025-12-31)',
                            (text) => {
                              if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
                                setFollowUpDate(text);
                              } else if (text) {
                                Alert.alert(
                                  language === 'ja' ? 'エラー' : 'Error',
                                  language === 'ja'
                                    ? '正しい形式で入力してください (YYYY-MM-DD)'
                                    : 'Please enter in correct format (YYYY-MM-DD)'
                                );
                              }
                            },
                            'plain-text',
                            followUpDate || ''
                          );
                        }
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="calendar-outline" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.datePickerText}>
                  {followUpDate || (language === 'ja' ? '日付を選択' : 'Select date')}
                </Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>
                {language === 'ja' ? 'フォローアップメモ' : 'Follow-up Notes'}
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={3}
                placeholder={language === 'ja'
                  ? 'フォローアップ内容や注意事項を記入...'
                  : 'Enter follow-up details and notes...'}
                placeholderTextColor={COLORS.textSecondary}
                value={followUpNotes}
                onChangeText={setFollowUpNotes}
                textAlignVertical="top"
              />
            </View>
          )}
        </Card>

        {/* Approval Required (for nurse notes) */}
        {noteType === 'nurse_note' && (
          <Card variant="outlined" padding="md">
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>
                  {language === 'ja' ? '✅ 医師の承認が必要' : '✅ Doctor Approval Required'}
                </Text>
                <Text style={styles.switchSubtext}>
                  {language === 'ja'
                    ? '重要な観察や処置など、医師の確認が必要な場合'
                    : 'For important observations or treatments that need doctor verification'}
                </Text>
              </View>
              <Switch
                value={requiresApproval}
                onValueChange={setRequiresApproval}
                trackColor={{ false: COLORS.neutral, true: COLORS.accent }}
                thumbColor={requiresApproval ? COLORS.primary : COLORS.white}
              />
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <Button
            onPress={handleCancel}
            variant="outline"
            style={styles.cancelButton}
            disabled={isSaving}
          >
            {language === 'ja' ? 'キャンセル' : 'Cancel'}
          </Button>
          <Button
            onPress={handleSave}
            variant="primary"
            style={styles.saveButton}
            loading={isSaving}
            disabled={isSaving}
          >
            {language === 'ja' ? '保存' : 'Save'}
          </Button>
        </View>
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
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  backButton: {
    padding: SPACING.sm,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  badgeContainer: {
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    minWidth: '30%',
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryIcon: {
    fontSize: TYPOGRAPHY.fontSize.base,
    marginRight: SPACING.xs,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  categoryTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  noteInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.accent + '20',
  },
  voiceButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.xs,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 150,
  },
  characterCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  switchLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  switchSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },
  followUpDetails: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
  },
  datePickerText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 80,
  },
  footer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});
