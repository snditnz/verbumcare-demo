import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@constants/theme';
import { DEMO_PATIENTS } from '@constants/demoPatients';
import { Patient } from '@models';

type RootStackParamList = {
  PatientList: undefined;
  PatientScan: undefined;
  VitalsCapture: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PatientScan'>;
};

export default function PatientScanScreen({ navigation }: Props) {
  const { setCurrentPatient, setCurrentStep, language } = useAssessmentStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [patients] = useState<Patient[]>(DEMO_PATIENTS);
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('patient-scan');
  }, []);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;

    setScanned(true);

    // Expected format: PAT-P001
    if (data.startsWith('PAT-')) {
      const mrn = data.substring(4); // Remove 'PAT-' prefix

      // Find patient in the list by MRN
      const foundPatient = patients.find(p => p.mrn === mrn);

      if (foundPatient) {
        setCurrentPatient(foundPatient);

        // Navigate immediately with a brief success toast-style alert
        Alert.alert(
          t['scan.success'],
          `${foundPatient.family_name} ${foundPatient.given_name}`,
          [
            {
              text: t['common.continue'],
              onPress: () => navigation.navigate('PatientInfo' as any),
            },
          ],
          { cancelable: false } // Prevent dismissing by tapping outside
        );

        // Auto-navigate after 1 second if user doesn't tap
        setTimeout(() => {
          navigation.navigate('PatientInfo' as any);
        }, 1000);
      } else {
        Alert.alert(
          t['scan.mismatch'],
          language === 'ja'
            ? `患者が見つかりません: ${mrn}`
            : `Patient not found: ${mrn}`,
          [
            {
              text: t['common.tryAgain'],
              onPress: () => setScanned(false),
            },
          ]
        );
      }
    } else {
      // Silently ignore invalid barcodes - just reset to scan again
      // (prevents annoying popups when camera picks up random codes)
      setScanned(false);
    }
  };

  const handleCancel = () => {
    navigation.navigate('PatientList');
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Button variant="text" onPress={handleCancel}>
            {`← ${t['common.cancel']}`}
          </Button>
          <LanguageToggle />
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>{t['scan.cameraPermission']}</Text>
          <Button onPress={requestPermission}>
            {t['common.grantPermission']}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={handleCancel}>
            {`← ${t['common.cancel']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.screenTitle}>
            {language === 'ja' ? 'バーコードスキャン' : 'Scan Barcode'}
          </Text>
        </View>
        <LanguageToggle />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          {language === 'ja'
            ? '患者IDバーコードをスキャンしてください'
            : 'Scan patient ID barcode'}
        </Text>

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'code128', 'code39'],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
            </View>
          </CameraView>
        </View>

        {scanned && (
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => setScanned(false)}>
              {t['scan.scanAgain']}
            </Button>
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  instruction: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 4,
    borderColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.md,
  },
  actions: {
    alignItems: 'center',
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
