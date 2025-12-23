import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { PatientUpdateDraft } from '@models/app';
import { getEditedFields } from '@utils/patientDiff';

type RootStackParamList = {
  UpdatePatientInfo: { initialTab?: TabKey } | undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'UpdatePatientInfo'>;
  route: any; // Route params to accept initialTab
};

// Tab definitions
type TabKey = 'basic' | 'physical' | 'contact' | 'medical' | 'keynotes' | 'admission' | 'insurance';

interface Tab {
  key: TabKey;
  titleJa: string;
  titleEn: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function UpdatePatientInfoScreen({ navigation, route }: Props) {
  const { currentPatient, sessionPatientUpdates, setPatientUpdates, language, getOriginalPatient } = useAssessmentStore();

  // Tab state - start with basic demographics or provided initialTab
  const [activeTab, setActiveTab] = useState<TabKey>(route?.params?.initialTab || 'basic');

  // Define tabs
  const tabs: Tab[] = [
    { key: 'basic', titleJa: '基本情報', titleEn: 'Basic', icon: 'person' },
    { key: 'physical', titleJa: '身体測定', titleEn: 'Physical', icon: 'body' },
    { key: 'medical', titleJa: '医療情報', titleEn: 'Medical', icon: 'medical' },
    { key: 'keynotes', titleJa: '特記事項', titleEn: 'Key Notes', icon: 'information-circle' },
    { key: 'contact', titleJa: '連絡先', titleEn: 'Contact', icon: 'call' },
    { key: 'admission', titleJa: '入院', titleEn: 'Admission', icon: 'bed' },
    { key: 'insurance', titleJa: '保険', titleEn: 'Insurance', icon: 'card' },
  ];

  // Form state
  const [height, setHeight] = useState(
    sessionPatientUpdates?.height?.toString() || currentPatient?.height?.toString() || ''
  );
  const [allergies, setAllergies] = useState<string[]>(
    sessionPatientUpdates?.allergies || currentPatient?.allergies || []
  );
  const [newAllergy, setNewAllergy] = useState('');
  const [medications, setMedications] = useState(
    sessionPatientUpdates?.medications || currentPatient?.medications || ''
  );
  const [keyNotes, setKeyNotes] = useState(
    sessionPatientUpdates?.keyNotes || currentPatient?.key_notes || ''
  );

  const [hasChanges, setHasChanges] = useState(false);

  const t = translations[language];

  // Get original patient data
  const originalPatient = useMemo(() => {
    if (!currentPatient) return null;
    return getOriginalPatient(currentPatient.patient_id);
  }, [currentPatient, getOriginalPatient]);

  // Calculate edited fields
  const editedFields = useMemo(() => {
    return getEditedFields(originalPatient, sessionPatientUpdates);
  }, [originalPatient, sessionPatientUpdates]);

  // Reload form values
  useEffect(() => {
    setHeight(sessionPatientUpdates?.height?.toString() || currentPatient?.height?.toString() || '');
    setAllergies(sessionPatientUpdates?.allergies || currentPatient?.allergies || []);
    setMedications(sessionPatientUpdates?.medications || currentPatient?.medications || '');
    setKeyNotes(sessionPatientUpdates?.keyNotes || currentPatient?.key_notes || '');
  }, [sessionPatientUpdates, currentPatient]);

  useEffect(() => {
    const allergiesChanged = JSON.stringify(allergies) !== JSON.stringify(currentPatient?.allergies || []);
    const changed =
      height !== (currentPatient?.height?.toString() || '') ||
      allergiesChanged ||
      medications !== (currentPatient?.medications || '') ||
      keyNotes !== (currentPatient?.key_notes || '');

    setHasChanges(changed);
  }, [height, allergies, medications, keyNotes, currentPatient]);

  const handleAddAllergy = () => {
    const trimmed = (newAllergy || '').trim();
    if (!trimmed) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? 'アレルギー名を入力してください' : 'Please enter an allergy name'
      );
      return;
    }
    if (allergies.includes(trimmed)) {
      Alert.alert(
        language === 'ja' ? 'エラー' : 'Error',
        language === 'ja' ? 'このアレルギーは既に追加されています' : 'This allergy is already added'
      );
      return;
    }
    setAllergies([...allergies, trimmed]);
    setNewAllergy('');
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies(allergies.filter((_, i) => i !== index));
  };

  const handleSaveDraft = () => {
    if (!hasChanges) {
      Alert.alert(
        t['common.info'] || 'Info',
        language === 'ja' ? '変更はありません' : 'No changes to save'
      );
      return;
    }

    const draft: PatientUpdateDraft = {
      height: height ? parseFloat(height) : undefined,
      allergies: allergies.length > 0 ? allergies : undefined,
      medications: medications || undefined,
      keyNotes: keyNotes || undefined,
      confirmed: false,
      updatedAt: new Date().toISOString(),
    };

    setPatientUpdates(draft);

    Alert.alert(
      t['toast.updatesSaved'] || 'Draft Saved',
      language === 'ja' ? '下書きを保存しました' : 'Changes saved as draft',
      [
        {
          text: t['common.ok'],
          onPress: () => navigation.navigate('PatientInfo' as any),
        },
      ]
    );
  };

  const handleConfirm = () => {
    if (!hasChanges) {
      Alert.alert(
        t['common.info'] || 'Info',
        language === 'ja' ? '変更はありません' : 'No changes to save'
      );
      return;
    }

    const allergiesChanged = JSON.stringify(allergies) !== JSON.stringify(currentPatient?.allergies || []);
    const updateSummary = [
      height && height !== (currentPatient?.height?.toString() || '')
        ? `${language === 'ja' ? '身長' : 'Height'}: ${height} cm`
        : null,
      allergiesChanged && allergies.length > 0
        ? `${language === 'ja' ? 'アレルギー' : 'Allergies'}: ${allergies.join(', ')}`
        : null,
      medications && medications !== (currentPatient?.medications || '')
        ? `${language === 'ja' ? '服薬' : 'Medications'}: ${medications}`
        : null,
      keyNotes && keyNotes !== (currentPatient?.key_notes || '')
        ? `${language === 'ja' ? '特記事項' : 'Key Notes'}: ${keyNotes}`
        : null,
    ].filter(Boolean).join('\n');

    Alert.alert(
      t['dialog.confirmSave'],
      updateSummary || (language === 'ja' ? '患者情報を更新します' : 'Update patient information'),
      [
        { text: t['common.cancel'], style: 'cancel' },
        {
          text: t['common.confirm'],
          onPress: () => {
            const update: PatientUpdateDraft = {
              height: height ? parseFloat(height) : undefined,
              allergies: allergies.length > 0 ? allergies : undefined,
              medications: medications || undefined,
              keyNotes: keyNotes || undefined,
              confirmed: true,
              updatedAt: new Date().toISOString(),
            };

            setPatientUpdates(update);

            Alert.alert(
              t['toast.updatesSaved'] || 'Updates Saved',
              language === 'ja' ? '患者情報を更新しました' : 'Patient information updated',
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

  const handleDiscard = () => {
    if (!hasChanges) {
      navigation.navigate('PatientInfo' as any);
      return;
    }

    Alert.alert(
      t['dialog.discardChanges'],
      language === 'ja' ? '変更を破棄しますか？' : 'Discard unsaved changes?',
      [
        { text: t['common.cancel'], style: 'cancel' },
        {
          text: t['common.discard'],
          style: 'destructive',
          onPress: () => navigation.navigate('PatientInfo' as any),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={handleDiscard}>
            {`← ${t['common.cancel']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          {currentPatient && (
            <Text style={styles.patientName}>
              {currentPatient.family_name} {currentPatient.given_name}
            </Text>
          )}
          <Text style={styles.screenTitle}>
            {language === 'ja' ? '患者情報更新' : 'Update Patient Information'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={ICON_SIZES.md}
                color={activeTab === tab.key ? COLORS.primary : COLORS.text.secondary}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {language === 'ja' ? tab.titleJa : tab.titleEn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content}>
        {/* Draft Status Banner */}
        {sessionPatientUpdates && !sessionPatientUpdates.confirmed && (
          <View style={styles.draftBanner}>
            <Ionicons name="create" size={ICON_SIZES.md} color={COLORS.status.warning} />
            <Text style={styles.draftText}>
              {language === 'ja' ? '下書きあり' : 'Draft saved'}
              {sessionPatientUpdates.updatedAt && (
                <Text style={styles.draftTime}>
                  {' '}• {new Date(sessionPatientUpdates.updatedAt).toLocaleTimeString(
                    language === 'ja' ? 'ja-JP' : 'en-US',
                    { hour: '2-digit', minute: '2-digit' }
                  )}
                </Text>
              )}
            </Text>
          </View>
        )}

        {/* 1. BASIC DEMOGRAPHICS TAB */}
        {activeTab === 'basic' && (
          <View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? '氏名' : 'Full Name'} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={`${currentPatient?.family_name} ${currentPatient?.given_name}`}
              editable={false}
            />
            <Text style={styles.helperText}>
              {language === 'ja' ? '※ 氏名の変更はシステム管理者にお問い合わせください' : '※ Contact system administrator to change name'}
            </Text>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 2 }]}>
              <Text style={styles.label}>
                {language === 'ja' ? '生年月日' : 'Date of Birth'} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={currentPatient?.date_of_birth ? currentPatient.date_of_birth.split('T')[0] : ''}
                editable={false}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {language === 'ja' ? '年齢' : 'Age'}
              </Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={`${currentPatient?.age || ''}${language === 'ja' ? '歳' : ' yrs'}`}
                editable={false}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {language === 'ja' ? '性別' : 'Gender'} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={currentPatient?.gender === 'male' ? (language === 'ja' ? '男性' : 'Male') : (language === 'ja' ? '女性' : 'Female')}
                editable={false}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {language === 'ja' ? '血液型' : 'Blood Type'} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={currentPatient?.blood_type || (language === 'ja' ? '不明' : 'Unknown')}
                editable={false}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.helperText}>
              {language === 'ja' ? '※ 年齢は生年月日から自動計算されます' : '※ Age is auto-calculated from date of birth'}
            </Text>
          </View>
          </View>
        )}

        {/* 2. PHYSICAL MEASUREMENTS TAB */}
        {activeTab === 'physical' && (
          <View>
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {language === 'ja' ? '身長 (cm)' : 'Height (cm)'} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="193"
                placeholderTextColor={COLORS.text.disabled}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {language === 'ja' ? '体重 (kg)' : 'Weight (kg)'}
              </Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={currentPatient?.weight?.toString() || ''}
                editable={false}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>BMI</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={currentPatient?.weight && height
                  ? (parseFloat(height) ? (currentPatient.weight / Math.pow(parseFloat(height) / 100, 2)).toFixed(1) : '')
                  : ''}
                editable={false}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.helperText}>
              {language === 'ja'
                ? '※ 体重はバイタル測定で記録できます　※ BMIは自動計算'
                : '※ Weight is recorded in Vitals Capture　※ BMI is auto-calculated'}
            </Text>
          </View>
          </View>
        )}

        {/* 3. CONTACT INFORMATION TAB */}
        {activeTab === 'contact' && (
          <View>
            <Text style={styles.comingSoonText}>
              {language === 'ja' ? '連絡先情報機能は開発中です' : 'Contact information features coming soon'}
            </Text>
          </View>
        )}

        {/* 4. MEDICAL INFORMATION TAB */}
        {activeTab === 'medical' && (
          <View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? 'アレルギー' : 'Allergies'}
            </Text>

            {/* Existing allergies list */}
            {allergies.length > 0 && (
              <View style={styles.allergiesList}>
                {allergies.map((allergy, index) => (
                  <View key={index} style={styles.allergyItem}>
                    <Text style={styles.allergyText}>🚫 {allergy}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveAllergy(index)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close-circle" size={ICON_SIZES.md} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add new allergy */}
            <View style={styles.addAllergyRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={language === 'ja' ? 'アレルギーを追加' : 'Add allergy'}
                placeholderTextColor={COLORS.text.disabled}
                value={newAllergy}
                onChangeText={setNewAllergy}
                onSubmitEditing={handleAddAllergy}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleAddAllergy}
                style={styles.addButton}
              >
                <Ionicons name="add-circle" size={ICON_SIZES.lg} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {allergies.length === 0 && (
              <Text style={styles.helperText}>
                {language === 'ja' ? 'アレルギーなし (NKDA)' : 'No known drug allergies (NKDA)'}
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? '感染症情報' : 'Infectious Disease Status'}
            </Text>
            <Text style={styles.comingSoonText}>
              {language === 'ja' ? '感染症情報機能は開発中です' : 'Infectious disease tracking coming soon'}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? '現在の投薬' : 'Current Medications'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={language === 'ja' ? '服薬情報を入力' : 'Enter current medications'}
              placeholderTextColor={COLORS.text.disabled}
              value={medications}
              onChangeText={setMedications}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? '慢性疾患' : 'Chronic Conditions'}
            </Text>
            <Text style={styles.comingSoonText}>
              {language === 'ja' ? '開発中' : 'Coming soon'}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? '手術歴' : 'Past Surgeries'}
            </Text>
            <Text style={styles.comingSoonText}>
              {language === 'ja' ? '開発中' : 'Coming soon'}
            </Text>
          </View>

          </View>
        )}

        {/* 5. KEY NOTES TAB */}
        {activeTab === 'keynotes' && (
          <View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {language === 'ja' ? '特記事項' : 'Key Notes'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, { minHeight: 200 }]}
                placeholder={language === 'ja' ? '特記事項を入力（重要な情報、ケアの注意点、患者の状態など）' : 'Enter key notes (important information, care considerations, patient status, etc.)'}
                placeholderTextColor={COLORS.text.disabled}
                value={keyNotes}
                onChangeText={setKeyNotes}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                {language === 'ja'
                  ? '※ 患者ケアに重要な情報を記録してください。この情報は患者情報画面で表示されます。'
                  : '※ Record important information for patient care. This will be displayed on the patient information screen.'}
              </Text>
            </View>
          </View>
        )}

        {/* 6. ADMISSION INFORMATION TAB */}
        {activeTab === 'admission' && (
          <View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {language === 'ja' ? '病室番号' : 'Room Number'}
              </Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={currentPatient?.room || ''}
                editable={false}
              />
            </View>
            <Text style={styles.comingSoonText}>
              {language === 'ja' ? '入院情報の詳細機能は開発中です' : 'Detailed admission features coming soon'}
            </Text>
          </View>
        )}

        {/* 7. INSURANCE INFORMATION TAB */}
        {activeTab === 'insurance' && (
          <View>
            <Text style={styles.comingSoonText}>
              {language === 'ja' ? '保険情報機能は開発中です' : 'Insurance information features coming soon'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          variant="outline"
          onPress={handleSaveDraft}
          disabled={!hasChanges}
        >
          <Ionicons name="save-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
          <Text style={[styles.buttonText, { color: COLORS.primary }]}>
            {language === 'ja' ? '下書き保存' : 'Save Draft'}
          </Text>
        </Button>
        <Button
          variant="primary"
          onPress={handleConfirm}
          disabled={!hasChanges}
        >
          <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.accent} />
          <Text style={[styles.buttonText, { color: COLORS.accent }]}>
            {t['common.confirm']}
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
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: `${COLORS.status.warning}15`,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.status.warning,
    marginBottom: SPACING.lg,
  },
  draftText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  draftTime: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
  },
  // Tab Bar styles
  tabBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBarContent: {
    paddingHorizontal: SPACING.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: 0,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.error,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: SPACING.touchTarget.comfortable,
  },
  inputDisabled: {
    backgroundColor: COLORS.background,
    color: COLORS.text.disabled,
  },
  textArea: {
    minHeight: 80,
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  comingSoonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: SPACING.md,
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
  editedInput: {
    backgroundColor: '#FFF9C4',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  allergiesList: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  allergyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    minHeight: SPACING.touchTarget.comfortable,
  },
  allergyText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  removeButton: {
    padding: SPACING.xs,
  },
  addAllergyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  addButton: {
    padding: SPACING.xs,
  },
});
