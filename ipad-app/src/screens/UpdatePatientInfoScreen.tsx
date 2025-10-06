import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { PatientUpdateDraft } from '@models/app';

type RootStackParamList = {
  UpdatePatientInfo: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'UpdatePatientInfo'>;
};

export default function UpdatePatientInfoScreen({ navigation }: Props) {
  const { currentPatient, sessionPatientUpdates, setPatientUpdates, setCurrentStep, language } = useAssessmentStore();

  // Form state - initialize with current patient data or session draft
  const [height, setHeight] = useState(
    sessionPatientUpdates?.height?.toString() || currentPatient?.height?.toString() || ''
  );
  const [weight, setWeight] = useState(
    sessionPatientUpdates?.weight?.toString() || currentPatient?.weight?.toString() || ''
  );
  const [allergies, setAllergies] = useState(
    sessionPatientUpdates?.allergies || currentPatient?.allergies || ''
  );
  const [medications, setMedications] = useState(
    sessionPatientUpdates?.medications || currentPatient?.medications || ''
  );
  const [keyNotes, setKeyNotes] = useState(
    sessionPatientUpdates?.keyNotes || currentPatient?.key_notes || ''
  );

  const [hasChanges, setHasChanges] = useState(false);

  const t = translations[language];

  // Note: This screen is part of hub-and-spoke navigation from PatientInfo,
  // not part of the main workflow, so we don't set currentStep

  // Reload form values when screen opens (supports reopening with saved data)
  useEffect(() => {
    // Priority: session draft > current patient data
    setHeight(sessionPatientUpdates?.height?.toString() || currentPatient?.height?.toString() || '');
    setWeight(sessionPatientUpdates?.weight?.toString() || currentPatient?.weight?.toString() || '');
    setAllergies(sessionPatientUpdates?.allergies || currentPatient?.allergies || '');
    setMedications(sessionPatientUpdates?.medications || currentPatient?.medications || '');
    setKeyNotes(sessionPatientUpdates?.keyNotes || currentPatient?.key_notes || '');
  }, [sessionPatientUpdates, currentPatient]);

  useEffect(() => {
    // Check if form has changes from original patient data
    const changed =
      height !== (currentPatient?.height?.toString() || '') ||
      weight !== (currentPatient?.weight?.toString() || '') ||
      allergies !== (currentPatient?.allergies || '') ||
      medications !== (currentPatient?.medications || '') ||
      keyNotes !== (currentPatient?.key_notes || '');

    setHasChanges(changed);
  }, [height, weight, allergies, medications, keyNotes, currentPatient]);

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
      weight: weight ? parseFloat(weight) : undefined,
      allergies: allergies || undefined,
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

    const updateSummary = [
      height && height !== (currentPatient?.height?.toString() || '')
        ? `${language === 'ja' ? '身長' : 'Height'}: ${height} cm`
        : null,
      weight && weight !== (currentPatient?.weight?.toString() || '')
        ? `${language === 'ja' ? '体重' : 'Weight'}: ${weight} kg`
        : null,
      allergies && allergies !== (currentPatient?.allergies || '')
        ? `${language === 'ja' ? 'アレルギー' : 'Allergies'}: ${allergies}`
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
              weight: weight ? parseFloat(weight) : undefined,
              allergies: allergies || undefined,
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

  const calculateBMI = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (h && w && h > 0) {
      const heightInMeters = h / 100;
      const bmi = w / (heightInMeters * heightInMeters);
      return bmi.toFixed(1);
    }
    return null;
  };

  const bmi = calculateBMI();

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
          <LanguageToggle />
        </View>
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

        {/* Physical Measurements */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="body" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '身体測定' : 'Physical Measurements'}
            </Text>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {language === 'ja' ? '身長 (cm)' : 'Height (cm)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="165"
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
                style={styles.input}
                placeholder="60"
                placeholderTextColor={COLORS.text.disabled}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
            </View>

            {bmi && (
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>BMI</Text>
                <View style={styles.bmiDisplay}>
                  <Text style={styles.bmiValue}>{bmi}</Text>
                  <Text style={styles.bmiLabel}>
                    {parseFloat(bmi) < 18.5 ? (language === 'ja' ? '低体重' : 'Underweight') :
                     parseFloat(bmi) < 25 ? (language === 'ja' ? '標準' : 'Normal') :
                     parseFloat(bmi) < 30 ? (language === 'ja' ? '肥満(1度)' : 'Overweight') :
                     (language === 'ja' ? '肥満(2度以上)' : 'Obese')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Medical Information */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="medical" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '医療情報' : 'Medical Information'}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? 'アレルギー' : 'Allergies'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={language === 'ja' ? 'アレルギー情報を入力' : 'Enter allergy information'}
              placeholderTextColor={COLORS.text.disabled}
              value={allergies}
              onChangeText={setAllergies}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {language === 'ja' ? '現在の服薬' : 'Current Medications'}
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
        </Card>

        {/* Key Notes */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="alert-circle" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '特記事項' : 'Key Notes'}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 120 }]}
              placeholder={language === 'ja' ? '特記事項を入力' : 'Enter key notes or important information'}
              placeholderTextColor={COLORS.text.disabled}
              value={keyNotes}
              onChangeText={setKeyNotes}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>
        </Card>
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
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
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
  textArea: {
    minHeight: 80,
  },
  bmiDisplay: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SPACING.touchTarget.comfortable,
  },
  bmiValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  bmiLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
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
