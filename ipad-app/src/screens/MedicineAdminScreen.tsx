import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { MedicationAdmin } from '@models/app';

type RootStackParamList = {
  MedicineAdmin: undefined;
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MedicineAdmin'>;
};

// Mock medication schedule
const MOCK_MEDICATION_SCHEDULE = [
  { id: 'MED001', name: 'Lisinopril', dosage: '10mg', route: 'PO', scheduledTime: '08:00', status: 'pending' },
  { id: 'MED002', name: 'Metformin', dosage: '500mg', route: 'PO', scheduledTime: '08:00', status: 'pending' },
  { id: 'MED003', name: 'Atorvastatin', dosage: '20mg', route: 'PO', scheduledTime: '20:00', status: 'scheduled' },
  { id: 'MED004', name: 'Aspirin', dosage: '81mg', route: 'PO', scheduledTime: '08:00', status: 'pending' },
];

export default function MedicineAdminScreen({ navigation }: Props) {
  const { currentPatient, addMedication, setCurrentStep, language } = useAssessmentStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [selectedMed, setSelectedMed] = useState<typeof MOCK_MEDICATION_SCHEDULE[0] | null>(null);

  // Manual entry state
  const [manualMode, setManualMode] = useState(false);
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('PO');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [lotNumber, setLotNumber] = useState('');

  const t = translations[language];

  // Note: This screen is part of hub-and-spoke navigation from PatientInfo,
  // not part of the main workflow, so we don't set currentStep

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Expected format: MED-MED001
    if (data.startsWith('MED-')) {
      const medId = data.substring(4);
      const foundMed = MOCK_MEDICATION_SCHEDULE.find(m => m.id === medId);

      if (foundMed) {
        setSelectedMed(foundMed);
        setShowScanner(false);
        setScanned(false);
      } else {
        Alert.alert(
          t['scan.mismatch'],
          language === 'ja' ? `薬剤が見つかりません: ${medId}` : `Medication not found: ${medId}`,
          [{ text: t['common.tryAgain'], onPress: () => setScanned(false) }]
        );
      }
    } else {
      setScanned(false);
    }
  };

  const handleAdminister = (med: typeof MOCK_MEDICATION_SCHEDULE[0]) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    Alert.alert(
      t['dialog.confirmSave'],
      `${med.name} ${med.dosage} ${med.route}\n${language === 'ja' ? '投薬時刻' : 'Time'}: ${timestamp}`,
      [
        { text: t['common.cancel'], style: 'cancel' },
        {
          text: t['common.confirm'],
          onPress: () => {
            const medication: MedicationAdmin = {
              medicationId: med.id,
              medicationName: med.name,
              dosage: med.dosage,
              route: med.route,
              time: timestamp,
              notes: notes || undefined,
              lot: lotNumber || undefined,
              administeredBy: 'Demo Staff',
              timestamp: now.toISOString(),
            };

            addMedication(medication);
            setSelectedMed(null);
            setNotes('');
            setLotNumber('');

            Alert.alert(
              t['toast.medicationSaved'],
              language === 'ja' ? '投薬記録を保存しました' : 'Medication administration recorded',
              [{ text: t['common.ok'] }]
            );
          },
        },
      ]
    );
  };

  const handleManualSubmit = () => {
    if (!medName || !dosage || !route) {
      Alert.alert(
        t['common.error'],
        language === 'ja' ? '必須項目を入力してください' : 'Please fill in all required fields'
      );
      return;
    }

    const now = new Date();
    const timestamp = time || now.toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    Alert.alert(
      t['dialog.confirmSave'],
      `${medName} ${dosage} ${route}\n${language === 'ja' ? '投薬時刻' : 'Time'}: ${timestamp}`,
      [
        { text: t['common.cancel'], style: 'cancel' },
        {
          text: t['common.confirm'],
          onPress: () => {
            const medication: MedicationAdmin = {
              medicationId: `MANUAL-${Date.now()}`,
              medicationName: medName,
              dosage,
              route,
              time: timestamp,
              notes: notes || undefined,
              lot: lotNumber || undefined,
              administeredBy: 'Demo Staff',
              timestamp: now.toISOString(),
            };

            addMedication(medication);

            // Reset form
            setMedName('');
            setDosage('');
            setRoute('PO');
            setTime('');
            setNotes('');
            setLotNumber('');
            setManualMode(false);

            Alert.alert(
              t['toast.medicationSaved'],
              language === 'ja' ? '投薬記録を保存しました' : 'Medication administration recorded',
              [{ text: t['common.ok'] }]
            );
          },
        },
      ]
    );
  };

  if (showScanner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Button variant="text" onPress={() => setShowScanner(false)}>
              {`← ${t['common.cancel']}`}
            </Button>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.screenTitle}>
              {language === 'ja' ? '薬剤バーコードスキャン' : 'Scan Medication Barcode'}
            </Text>
          </View>
          <LanguageToggle />
        </View>

        {permission?.granted ? (
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39'],
              }}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanInstruction}>
                  {language === 'ja' ? '薬剤バーコードをスキャンしてください' : 'Scan medication barcode'}
                </Text>
              </View>
            </CameraView>
          </View>
        ) : (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>{t['scan.cameraPermission']}</Text>
            <Button onPress={requestPermission}>
              {t['common.grantPermission']}
            </Button>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={() => navigation.navigate('PatientInfo' as any)}>
            {`← ${t['common.back']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          {currentPatient && (
            <Text style={styles.patientName}>
              {currentPatient.family_name} {currentPatient.given_name}
            </Text>
          )}
          <Text style={styles.screenTitle}>
            {language === 'ja' ? '服薬管理 (eMar)' : 'Medicine Administration (eMar)'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            variant="primary"
            onPress={() => {
              requestPermission().then(() => setShowScanner(true));
            }}
            style={styles.actionButton}
          >
            <Ionicons name="barcode-outline" size={ICON_SIZES.md} color={COLORS.accent} />
            <Text style={styles.actionButtonText}>
              {language === 'ja' ? 'バーコードスキャン' : 'Scan Barcode'}
            </Text>
          </Button>
          <Button
            variant="outline"
            onPress={() => setManualMode(!manualMode)}
            style={styles.actionButton}
          >
            <Ionicons name="create-outline" size={ICON_SIZES.md} color={COLORS.primary} />
            <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
              {language === 'ja' ? '手動入力' : 'Manual Entry'}
            </Text>
          </Button>
        </View>

        {/* Manual Entry Form */}
        {manualMode && (
          <Card style={styles.manualForm}>
            <View style={styles.formHeader}>
              <Ionicons name="create" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.formTitle}>
                {language === 'ja' ? '手動入力' : 'Manual Entry'}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {language === 'ja' ? '薬剤名' : 'Medication Name'} *
              </Text>
              <TextInput
                style={styles.input}
                placeholder={language === 'ja' ? '薬剤名を入力' : 'Enter medication name'}
                placeholderTextColor={COLORS.text.disabled}
                value={medName}
                onChangeText={setMedName}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  {language === 'ja' ? '用量' : 'Dosage'} *
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="10mg"
                  placeholderTextColor={COLORS.text.disabled}
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  {language === 'ja' ? '投与経路' : 'Route'} *
                </Text>
                <View style={styles.routeButtons}>
                  {['PO', 'IV', 'IM', 'SC'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.routeButton, route === r && styles.routeButtonActive]}
                      onPress={() => setRoute(r)}
                    >
                      <Text style={[styles.routeButtonText, route === r && styles.routeButtonTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  {language === 'ja' ? 'ロット番号' : 'Lot Number'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="LOT123456"
                  placeholderTextColor={COLORS.text.disabled}
                  value={lotNumber}
                  onChangeText={setLotNumber}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  {language === 'ja' ? '投薬時刻' : 'Time'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="08:00"
                  placeholderTextColor={COLORS.text.disabled}
                  value={time}
                  onChangeText={setTime}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {language === 'ja' ? 'メモ' : 'Notes'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={language === 'ja' ? 'メモを入力' : 'Enter notes'}
                placeholderTextColor={COLORS.text.disabled}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <Button variant="primary" onPress={handleManualSubmit}>
              {t['common.save']}
            </Button>
          </Card>
        )}

        {/* Medication Schedule */}
        <Card>
          <View style={styles.scheduleHeader}>
            <Ionicons name="time" size={ICON_SIZES.lg} color={COLORS.primary} />
            <Text style={styles.scheduleTitle}>
              {language === 'ja' ? "今日の予定" : "Today's Schedule"}
            </Text>
          </View>

          {MOCK_MEDICATION_SCHEDULE.map((med) => (
            <View key={med.id} style={styles.medItem}>
              <View style={styles.medInfo}>
                <View style={styles.medHeader}>
                  <Text style={styles.medName}>{med.name}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: med.status === 'pending' ? COLORS.status.warning : COLORS.surface }
                  ]}>
                    <Text style={styles.statusText}>
                      {med.scheduledTime}
                    </Text>
                  </View>
                </View>
                <Text style={styles.medDetails}>
                  {med.dosage} • {med.route}
                </Text>
              </View>

              {med.status === 'pending' && (
                <Button
                  variant="primary"
                  size="small"
                  onPress={() => handleAdminister(med)}
                >
                  {language === 'ja' ? '投薬' : 'Give'}
                </Button>
              )}
            </View>
          ))}
        </Card>

        {/* Selected Medication Detail */}
        {selectedMed && (
          <Card style={styles.selectedMedCard}>
            <View style={styles.selectedHeader}>
              <Ionicons name="checkmark-circle" size={ICON_SIZES.lg} color={COLORS.success} />
              <Text style={styles.selectedTitle}>
                {language === 'ja' ? 'スキャン完了' : 'Scanned Successfully'}
              </Text>
            </View>

            <View style={styles.selectedInfo}>
              <Text style={styles.selectedMedName}>{selectedMed.name}</Text>
              <Text style={styles.selectedMedDetails}>
                {selectedMed.dosage} • {selectedMed.route} • {selectedMed.scheduledTime}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {language === 'ja' ? 'ロット番号' : 'Lot Number'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="LOT123456"
                placeholderTextColor={COLORS.text.disabled}
                value={lotNumber}
                onChangeText={setLotNumber}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                {language === 'ja' ? 'メモ' : 'Notes'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={language === 'ja' ? 'メモを入力' : 'Enter notes'}
                placeholderTextColor={COLORS.text.disabled}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.selectedActions}>
              <Button variant="outline" onPress={() => setSelectedMed(null)}>
                {t['common.cancel']}
              </Button>
              <Button variant="primary" onPress={() => handleAdminister(selectedMed)}>
                {t['common.confirm']}
              </Button>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button variant="primary" onPress={() => navigation.navigate('PatientInfo' as any)}>
          {t['common.done']}
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
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.accent,
  },
  manualForm: {
    marginBottom: SPACING.lg,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  formTitle: {
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
  routeButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  routeButton: {
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
  routeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  routeButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  routeButtonTextActive: {
    color: COLORS.accent,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  scheduleTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  medInfo: {
    flex: 1,
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  medName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  medDetails: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  selectedMedCard: {
    marginTop: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  selectedTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  selectedInfo: {
    marginBottom: SPACING.lg,
  },
  selectedMedName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  selectedMedDetails: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  selectedActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  bottomActions: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scannerContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xl,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 4,
    borderColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.md,
  },
  scanInstruction: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.accent,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['3xl'],
    gap: SPACING.xl,
  },
  permissionText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
});
