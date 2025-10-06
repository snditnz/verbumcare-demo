import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, VoiceRecorder } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { IncidentReport } from '@models/app';

type RootStackParamList = {
  IncidentReport: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'IncidentReport'>;
};

type IncidentType = 'fall' | 'medication-error' | 'behavioral' | 'injury' | 'other';
type Severity = 'low' | 'medium' | 'high' | 'critical';

const INCIDENT_TYPES: { key: IncidentType; ja: string; en: string; icon: string }[] = [
  { key: 'fall', ja: '転倒', en: 'Fall', icon: 'alert-circle' },
  { key: 'medication-error', ja: '服薬エラー', en: 'Medication Error', icon: 'medical' },
  { key: 'behavioral', ja: '行動上の問題', en: 'Behavioral Issue', icon: 'person' },
  { key: 'injury', ja: '負傷', en: 'Injury', icon: 'bandage' },
  { key: 'other', ja: 'その他', en: 'Other', icon: 'ellipsis-horizontal-circle' },
];

const SEVERITY_LEVELS: { key: Severity; ja: string; en: string; color: string }[] = [
  { key: 'low', ja: '低', en: 'Low', color: COLORS.status.normal },
  { key: 'medium', ja: '中', en: 'Medium', color: COLORS.status.warning },
  { key: 'high', ja: '高', en: 'High', color: COLORS.error },
  { key: 'critical', ja: '緊急', en: 'Critical', color: COLORS.status.critical },
];

export default function IncidentReportScreen({ navigation }: Props) {
  const { currentPatient, addIncident, setCurrentStep, language } = useAssessmentStore();

  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [datetime, setDatetime] = useState(new Date().toISOString());
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const t = translations[language];

  useEffect(() => {
    setCurrentStep('incident-report');
  }, []);

  const handleRecordingComplete = (uri: string, duration: number) => {
    setRecordingUri(uri);
  };

  const handleSubmit = () => {
    if (!incidentType) {
      Alert.alert(
        t['common.error'],
        language === 'ja' ? 'インシデントの種類を選択してください' : 'Please select an incident type'
      );
      return;
    }

    if (!description && !recordingUri) {
      Alert.alert(
        t['common.error'],
        language === 'ja' ? '説明を入力するか、音声を録音してください' : 'Please provide a description or voice recording'
      );
      return;
    }

    const now = new Date();
    const formattedDatetime = now.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const typeLabel = INCIDENT_TYPES.find(t => t.key === incidentType);
    const severityLabel = SEVERITY_LEVELS.find(s => s.key === severity);

    const incidentSummary = [
      `${language === 'ja' ? '種類' : 'Type'}: ${language === 'ja' ? typeLabel?.ja : typeLabel?.en}`,
      `${language === 'ja' ? '重要度' : 'Severity'}: ${language === 'ja' ? severityLabel?.ja : severityLabel?.en}`,
      `${language === 'ja' ? '日時' : 'Date/Time'}: ${formattedDatetime}`,
      recordingUri ? (language === 'ja' ? '音声記録: あり' : 'Voice Recording: Yes') : null,
      description ? `${language === 'ja' ? '説明' : 'Description'}: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}` : null,
    ].filter(Boolean).join('\n');

    Alert.alert(
      t['dialog.confirmSave'],
      incidentSummary,
      [
        { text: t['common.cancel'], style: 'cancel' },
        {
          text: t['common.confirm'],
          onPress: () => {
            const incident: IncidentReport = {
              id: `INC-${Date.now()}`,
              type: incidentType,
              severity,
              datetime: formattedDatetime,
              description,
              voiceRecordingId: recordingUri || undefined,
              photos: [],
              reportedBy: 'Demo Staff',
              timestamp: now.toISOString(),
            };

            addIncident(incident);

            Alert.alert(
              t['toast.incidentSaved'] || 'Incident Reported',
              language === 'ja' ? 'インシデント報告を保存しました' : 'Incident report has been saved',
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
    if (incidentType || description || recordingUri) {
      Alert.alert(
        t['dialog.discardChanges'],
        language === 'ja' ? '変更を破棄しますか？' : 'Discard this incident report?',
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

  const hasData = incidentType || description || recordingUri;

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
          <Text style={styles.screenTitle}>
            {language === 'ja' ? 'インシデント報告' : 'Incident Report'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={ICON_SIZES.md} color={COLORS.error} />
          <Text style={styles.warningText}>
            {language === 'ja'
              ? '重大なインシデントの場合は、直ちに責任者に報告してください'
              : 'For critical incidents, notify supervisor immediately'}
          </Text>
        </View>

        {/* Incident Type Selection */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? 'インシデントの種類' : 'Incident Type'} *
            </Text>
          </View>

          <View style={styles.typeGrid}>
            {INCIDENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.typeCard,
                  incidentType === type.key && styles.typeCardSelected,
                ]}
                onPress={() => setIncidentType(type.key)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={ICON_SIZES.lg}
                  color={incidentType === type.key ? COLORS.accent : COLORS.primary}
                />
                <Text style={[
                  styles.typeLabel,
                  incidentType === type.key && styles.typeLabelSelected,
                ]}>
                  {language === 'ja' ? type.ja : type.en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Severity Selection */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="speedometer" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '重要度' : 'Severity'} *
            </Text>
          </View>

          <View style={styles.severityButtons}>
            {SEVERITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.key}
                style={[
                  styles.severityButton,
                  severity === level.key && {
                    backgroundColor: level.color,
                    borderColor: level.color,
                  },
                ]}
                onPress={() => setSeverity(level.key)}
              >
                <Text style={[
                  styles.severityText,
                  severity === level.key && styles.severityTextSelected,
                ]}>
                  {language === 'ja' ? level.ja : level.en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Voice Recording */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="mic" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '音声記録 (任意)' : 'Voice Recording (Optional)'}
            </Text>
          </View>

          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDuration={120000}
          />
          {recordingUri && (
            <View style={styles.recordingBadge}>
              <Ionicons name="checkmark-circle" size={ICON_SIZES.sm} color={COLORS.success} />
              <Text style={styles.recordingBadgeText}>
                {language === 'ja' ? '音声記録済み' : 'Voice recorded'}
              </Text>
            </View>
          )}
        </Card>

        {/* Description */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '詳細説明' : 'Description'} *
            </Text>
          </View>

          <TextInput
            style={styles.descriptionInput}
            placeholder={
              language === 'ja'
                ? 'インシデントの詳細を入力してください...'
                : 'Provide detailed description of the incident...'
            }
            placeholderTextColor={COLORS.text.disabled}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />

          <Text style={styles.hint}>
            {language === 'ja'
              ? '何が起こったか、いつ、どこで、誰が関与したかを含めてください'
              : 'Include what happened, when, where, and who was involved'}
          </Text>
        </Card>

        {/* Date/Time Display */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.cardTitle}>
              {language === 'ja' ? '報告日時' : 'Report Date/Time'}
            </Text>
          </View>

          <Text style={styles.datetimeText}>
            {new Date(datetime).toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Card>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          variant="outline"
          onPress={handleCancel}
        >
          {t['common.cancel']}
        </Button>
        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={!hasData}
        >
          <Ionicons name="send" size={ICON_SIZES.sm} color={COLORS.accent} />
          <Text style={[styles.buttonText, { color: COLORS.accent }]}>
            {language === 'ja' ? '報告を送信' : 'Submit Report'}
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: `${COLORS.error}15`,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    marginBottom: SPACING.lg,
  },
  warningText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  typeCard: {
    width: '31%',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: SPACING.touchTarget.large,
    justifyContent: 'center',
  },
  typeCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: COLORS.accent,
  },
  severityButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  severityButton: {
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
  severityText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  severityTextSelected: {
    color: COLORS.accent,
  },
  descriptionInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 150,
    marginBottom: SPACING.sm,
  },
  hint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  datetimeText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
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
