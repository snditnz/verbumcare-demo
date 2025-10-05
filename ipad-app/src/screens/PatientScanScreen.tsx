import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAssessmentStore } from '@stores/assessmentStore';
import { WorkflowProgress, LanguageToggle } from '@components';
import { translations } from '@constants/translations';
import { UI_COLORS } from '@constants/config';
import { apiService } from '@services';

type RootStackParamList = {
  PatientList: undefined;
  PatientScan: undefined;
  VitalsCapture: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PatientScan'>;
};

export default function PatientScanScreen({ navigation }: Props) {
  const { currentPatient, setCurrentStep, language } = useAssessmentStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
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

      if (currentPatient?.mrn === mrn) {
        Alert.alert(
          t['scan.success'],
          `${currentPatient.family_name} ${currentPatient.given_name}`,
          [
            {
              text: t['common.continue'],
              onPress: () => navigation.navigate('VitalsCapture'),
            },
          ]
        );
      } else {
        Alert.alert(
          t['scan.mismatch'],
          t['scan.mismatchMessage'],
          [
            {
              text: t['common.tryAgain'],
              onPress: () => setScanned(false),
            },
          ]
        );
      }
    } else {
      Alert.alert(
        t['scan.invalidFormat'],
        t['scan.invalidFormatMessage'],
        [
          {
            text: t['common.tryAgain'],
            onPress: () => setScanned(false),
          },
        ]
      );
    }
  };

  const handleSkip = () => {
    navigation.navigate('VitalsCapture');
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>{t['scan.cameraPermission']}</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>{t['common.grantPermission']}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <WorkflowProgress />
        <LanguageToggle />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t['scan.title']}</Text>
        <Text style={styles.subtitle}>
          {t['scan.instruction']}: {currentPatient?.family_name} {currentPatient?.given_name}
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
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleSkip}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              {t['common.skip']}
            </Text>
          </TouchableOpacity>

          {scanned && (
            <TouchableOpacity
              style={styles.button}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.buttonText}>{t['scan.scanAgain']}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.border,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
    marginBottom: 24,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
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
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: UI_COLORS.primary,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: UI_COLORS.text,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    fontSize: 18,
    color: UI_COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
});
