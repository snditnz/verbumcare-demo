import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle } from '@components';
import { Button } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@constants/theme';
import { Patient } from '@models';
import { apiService } from '@services/api';

const logoMark = require('../../VerbumCare-Logo-Mark.png');

type RootStackParamList = {
  Dashboard: undefined;
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
  const [patients, setPatients] = useState<Patient[]>([]);
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('patient-scan');
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await apiService.getPatients(true);
      setPatients(data);
    } catch (error) {
      console.error('Error loading patients for scan:', error);
    }
  };

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
    navigation.navigate('Dashboard' as any);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Button variant="text" onPress={handleCancel} style={styles.backButtonContainer}>
            <Text style={styles.backButton}>{`← ${t['common.cancel']}`}</Text>
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
          <Button variant="text" onPress={handleCancel} style={styles.backButtonContainer}>
            <Text style={styles.backButton}>{`← ${t['common.back']}`}</Text>
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Image source={logoMark} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.screenTitle}>
            {language === 'ja' ? 'バーコードスキャン' : 'Scan Barcode'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
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

        <View style={styles.actions}>
          {scanned && (
            <Button variant="outline" onPress={() => setScanned(false)}>
              {t['scan.scanAgain']}
            </Button>
          )}
          <Button
            variant="text"
            onPress={() => navigation.navigate('PatientList' as any)}
            style={{ marginTop: SPACING.md }}
          >
            {language === 'ja' ? '患者を検索' : 'Browse/Search Patients'}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  headerLeft: {
    // No flex - size to content
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    // No flex - size to content
    alignItems: 'flex-end',
  },
  logoImage: {
    width: 32,
    height: 32,
    marginBottom: SPACING.xs,
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
  backButton: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  backButtonContainer: {
    paddingHorizontal: 0,
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
