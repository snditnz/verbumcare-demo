import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { WorkflowProgress, LanguageToggle, BLEStatusIndicator, VitalsDisplay } from '@components';
import { bleService } from '@services';
import { BLEConnectionStatus, BPReading } from '@types/ble';
import { translations } from '@constants/translations';
import { UI_COLORS } from '@constants/config';

type RootStackParamList = {
  VitalsCapture: undefined;
  ADLVoice: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VitalsCapture'>;
};

export default function VitalsCaptureScreen({ navigation }: Props) {
  const { setVitals, setCurrentStep, language } = useAssessmentStore();
  const [bleStatus, setBleStatus] = useState<BLEConnectionStatus>('disconnected');
  const [reading, setReading] = useState<BPReading | null>(null);
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('vitals-capture');
    initializeBLE();

    return () => {
      bleService.disconnect();
    };
  }, []);

  const initializeBLE = async () => {
    bleService.setStatusCallback(setBleStatus);
    bleService.setReadingCallback((newReading) => {
      setReading(newReading);
      Alert.alert(
        t['vitals.readingComplete'],
        `${newReading.systolic}/${newReading.diastolic} mmHg, ${newReading.pulse} bpm`,
        [
          {
            text: t['common.ok'],
          },
        ]
      );
    });

    const hasPermission = await bleService.requestPermissions();
    if (hasPermission) {
      await bleService.startScan();
    } else {
      Alert.alert(
        t['ble.permissionDenied'],
        t['ble.permissionDeniedMessage']
      );
    }
  };

  const handleRetry = async () => {
    setBleStatus('disconnected');
    setReading(null);
    await bleService.startScan();
  };

  const handleContinue = () => {
    if (reading) {
      setVitals({
        systolic: reading.systolic,
        diastolic: reading.diastolic,
        pulse: reading.pulse,
        timestamp: reading.timestamp,
      });
      navigation.navigate('ADLVoice');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      t['vitals.skipWarning'],
      t['vitals.skipWarningMessage'],
      [
        {
          text: t['common.cancel'],
          style: 'cancel',
        },
        {
          text: t['common.skip'],
          onPress: () => navigation.navigate('ADLVoice'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <WorkflowProgress />
        <LanguageToggle />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t['vitals.title']}</Text>
        <Text style={styles.subtitle}>{t['vitals.instruction']}</Text>

        <View style={styles.statusContainer}>
          <BLEStatusIndicator status={bleStatus} />
        </View>

        {bleStatus === 'connected' && (
          <Text style={styles.instruction}>{t['vitals.takeReading']}</Text>
        )}

        {reading && (
          <VitalsDisplay vitals={{
            systolic: reading.systolic,
            diastolic: reading.diastolic,
            pulse: reading.pulse,
            timestamp: reading.timestamp,
          }} />
        )}

        {bleStatus === 'error' && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t['ble.connectionFailed']}</Text>
            <TouchableOpacity style={styles.button} onPress={handleRetry}>
              <Text style={styles.buttonText}>{t['common.retry']}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleSkip}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              {t['common.skip']}
            </Text>
          </TouchableOpacity>

          {reading && (
            <TouchableOpacity
              style={styles.button}
              onPress={handleContinue}
            >
              <Text style={styles.buttonText}>{t['common.continue']}</Text>
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
  statusContainer: {
    marginBottom: 24,
  },
  instruction: {
    fontSize: 18,
    color: UI_COLORS.text,
    textAlign: 'center',
    marginVertical: 24,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 24,
    backgroundColor: UI_COLORS.errorLight,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 24,
  },
  errorText: {
    fontSize: 16,
    color: UI_COLORS.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 'auto',
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
});
