import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useCarePlanStore } from '@stores/carePlanStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import Slider from '@react-native-community/slider';
import { ProgressNote } from '@types/app';

type RootStackParamList = {
  QuickProgressUpdate: undefined;
  CarePlanHub: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'QuickProgressUpdate'>;
};

export default function QuickProgressUpdateScreen({ navigation }: Props) {
  const { currentPatient, language } = useAssessmentStore();
  const { getCarePlanByPatientId, updateCarePlanItem } = useCarePlanStore();

  const t = translations[language];
  const carePlan = currentPatient ? getCarePlanByPatientId(currentPatient.patient_id) : undefined;

  // State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [longTermProgress, setLongTermProgress] = useState<number>(0);
  const [shortTermProgress, setShortTermProgress] = useState<number>(0);
  const [noteText, setNoteText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  const activeItems = carePlan.carePlanItems.filter(item => item.problem.status === 'active');
  const selectedItem = activeItems.find(item => item.id === selectedItemId);

  // Initialize sliders when item is selected
  const handleSelectItem = (itemId: string) => {
    const item = activeItems.find(i => i.id === itemId);
    if (item) {
      setSelectedItemId(itemId);
      setLongTermProgress(item.longTermGoal.achievementStatus);
      setShortTermProgress(item.shortTermGoal.achievementStatus);
      setNoteText('');
    }
  };

  const handleSave = async () => {
    if (!selectedItem) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? 'ケアプラン項目を選択してください' : 'Please select a care plan item'
      );
      return;
    }

    setIsSaving(true);

    try {
      // Create progress note if text is provided
      const newNote: ProgressNote | null = noteText.trim() ? {
        id: `note_${Date.now()}`,
        carePlanItemId: selectedItem.id,
        date: new Date(),
        note: noteText.trim(),
        author: 'current_user', // TODO: Get from auth context
        authorName: language === 'ja' ? '担当者' : 'Staff Member',
      } : null;

      // Update the care plan item
      const updatedItem = {
        ...selectedItem,
        longTermGoal: {
          ...selectedItem.longTermGoal,
          achievementStatus: longTermProgress,
        },
        shortTermGoal: {
          ...selectedItem.shortTermGoal,
          achievementStatus: shortTermProgress,
        },
        progressNotes: newNote
          ? [...selectedItem.progressNotes, newNote]
          : selectedItem.progressNotes,
        lastUpdated: new Date(),
        updatedBy: 'current_user', // TODO: Get from auth context
      };

      await updateCarePlanItem(carePlan.id, updatedItem);

      Alert.alert(
        language === 'ja' ? '保存完了' : 'Saved',
        language === 'ja' ? '進捗が更新されました' : 'Progress updated successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? '保存に失敗しました' : 'Failed to save progress'
      );
    } finally {
      setIsSaving(false);
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
            {currentPatient.family_name} {currentPatient.given_name}
          </Text>
          <Text style={styles.screenTitle}>
            {language === 'ja' ? '進捗クイック更新' : 'Quick Progress Update'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Item Selector */}
        <Card>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {language === 'ja' ? 'ケアプラン項目を選択' : 'Select Care Plan Item'}
            </Text>
          </View>

          {activeItems.map((item) => (
            <Button
              key={item.id}
              variant={selectedItemId === item.id ? 'primary' : 'outline'}
              onPress={() => handleSelectItem(item.id)}
              style={{ marginBottom: SPACING.sm }}
            >
              <View style={styles.itemButton}>
                <View style={styles.itemButtonLeft}>
                  <Text style={styles.itemCategory}>
                    {t[`carePlan.category.${item.problem.category}`]}
                  </Text>
                  <Text
                    style={[
                      styles.itemDescription,
                      selectedItemId === item.id && styles.itemDescriptionSelected
                    ]}
                    numberOfLines={1}
                  >
                    {item.problem.description}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemProgress,
                    selectedItemId === item.id && styles.itemProgressSelected
                  ]}
                >
                  {item.shortTermGoal.achievementStatus}%
                </Text>
              </View>
            </Button>
          ))}
        </Card>

        {/* Progress Sliders */}
        {selectedItem && (
          <Card>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={ICON_SIZES.lg} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>
                {language === 'ja' ? '目標の進捗' : 'Goal Progress'}
              </Text>
            </View>

            {/* Long-term Goal */}
            <View style={styles.goalSection}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>{t['carePlan.longTermGoal']}</Text>
                <Text style={styles.goalPercent}>{longTermProgress}%</Text>
              </View>
              <Text style={styles.goalDescription} numberOfLines={2}>
                {selectedItem.longTermGoal.description}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={longTermProgress}
                onValueChange={setLongTermProgress}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.accent}
              />
            </View>

            {/* Short-term Goal */}
            <View style={styles.goalSection}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>{t['carePlan.shortTermGoal']}</Text>
                <Text style={styles.goalPercent}>{shortTermProgress}%</Text>
              </View>
              <Text style={styles.goalDescription} numberOfLines={2}>
                {selectedItem.shortTermGoal.description}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={shortTermProgress}
                onValueChange={setShortTermProgress}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.accent}
              />
            </View>
          </Card>
        )}

        {/* Progress Note */}
        {selectedItem && (
          <Card>
            <View style={styles.sectionHeader}>
              <Ionicons name="create" size={ICON_SIZES.lg} color={COLORS.status.normal} />
              <Text style={styles.sectionTitle}>
                {language === 'ja' ? '進捗ノート（任意）' : 'Progress Note (Optional)'}
              </Text>
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder={language === 'ja' ? '進捗の詳細を入力してください...' : 'Enter progress details...'}
              placeholderTextColor={COLORS.text.disabled}
              multiline
              numberOfLines={4}
              value={noteText}
              onChangeText={setNoteText}
              textAlignVertical="top"
            />
          </Card>
        )}

        {/* Save Button */}
        {selectedItem && (
          <View style={styles.actions}>
            <Button
              variant="primary"
              onPress={handleSave}
              disabled={isSaving}
              style={{ flex: 1 }}
            >
              {isSaving
                ? (language === 'ja' ? '保存中...' : 'Saving...')
                : (language === 'ja' ? '進捗を保存' : 'Save Progress')}
            </Button>
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
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.disabled,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  itemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  itemButtonLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  itemCategory: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  itemDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  itemDescriptionSelected: {
    color: COLORS.surface,
  },
  itemProgress: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
    marginLeft: SPACING.md,
  },
  itemProgressSelected: {
    color: COLORS.surface,
  },
  goalSection: {
    marginBottom: SPACING.xl,
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
  goalPercent: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
  },
  goalDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  noteInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
});
