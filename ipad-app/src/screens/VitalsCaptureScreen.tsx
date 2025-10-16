import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, BLEIndicator } from '@components';
import { Button, Card, Input, StatusIndicator } from '@components/ui';
import { bleService } from '@services';
import { BLEConnectionStatus, BPReading } from '@models/ble';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { assessVitalSigns, PatientDemographics, VitalSigns, getColorForStatus } from '@utils';

type RootStackParamList = {
  VitalsCapture: undefined;
  ADLVoice: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VitalsCapture'>;
};

export default function VitalsCaptureScreen({ navigation }: Props) {
  const { currentPatient, sessionVitals, setVitals, setCurrentStep, language } = useAssessmentStore();
  const [bleStatus, setBleStatus] = useState<BLEConnectionStatus>('disconnected');
  const [reading, setReading] = useState<BPReading | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  // Manual input state
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [spo2, setSpo2] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');

  const t = translations[language];

  useEffect(() => {
    console.log('[VitalsCapture] Screen mounted');
    console.log('[VitalsCapture] currentPatient:', currentPatient?.patient_id);
    console.log('[VitalsCapture] sessionVitals:', sessionVitals);

    setCurrentStep('vitals-capture');

    // Load existing vitals if they exist
    if (sessionVitals) {
      console.log('[VitalsCapture] Loading existing vitals into form');
      if (sessionVitals.blood_pressure_systolic) setSystolic(sessionVitals.blood_pressure_systolic.toString());
      if (sessionVitals.blood_pressure_diastolic) setDiastolic(sessionVitals.blood_pressure_diastolic.toString());
      if (sessionVitals.heart_rate) setPulse(sessionVitals.heart_rate.toString());
      if (sessionVitals.temperature_celsius) setTemperature(sessionVitals.temperature_celsius.toString());
      if (sessionVitals.oxygen_saturation) setSpo2(sessionVitals.oxygen_saturation.toString());
      if (sessionVitals.respiratory_rate) setRespiratoryRate(sessionVitals.respiratory_rate.toString());
    } else {
      console.log('[VitalsCapture] No existing vitals found');
    }

    initializeBLE();

    return () => {
      console.log('[VitalsCapture] Screen unmounting, stopping BLE scan...');
      bleService.stopScan();
      bleService.disconnect();
    };
  }, []);

  useEffect(() => {
    // Auto-populate from BLE reading
    if (reading) {
      setSystolic(reading.systolic.toString());
      setDiastolic(reading.diastolic.toString());
      setPulse(reading.pulse.toString());

      // Flash the BLE indicator during data transmission
      setIsTransmitting(true);
      const timer = setTimeout(() => {
        setIsTransmitting(false);
      }, 2000); // Flash for 2 seconds

      return () => clearTimeout(timer);
    }
  }, [reading]);

  const initializeBLE = async () => {
    bleService.setStatusCallback(setBleStatus);
    bleService.setReadingCallback((newReading) => {
      setReading(newReading);
    });

    const hasPermission = await bleService.requestPermissions();
    if (hasPermission) {
      await bleService.startScan();
    }
  };

  // Create patient demographics for assessment
  const patientDemographics: PatientDemographics | null = useMemo(() => {
    if (!currentPatient) return null;

    // Default demographics if age/gender not available
    return {
      age: currentPatient.age || 40, // Default to 40 if age not available
      gender: currentPatient.gender === 'other' ? 'male' : currentPatient.gender,
      // Add optional flags here if needed:
      // isAthlete: false,
      // hasCOPD: false,
      // personalBaselineTemp: undefined,
    };
  }, [currentPatient]);

  // Assess all vitals using the new system
  const vitalAssessment = useMemo(() => {
    if (!patientDemographics) return null;

    const vitalsToAssess: VitalSigns = {
      systolicBP: systolic ? parseInt(systolic) : undefined,
      heartRate: pulse ? parseInt(pulse) : undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      spO2: spo2 ? parseInt(spo2) : undefined,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
      weight: currentPatient?.weight,
      height: currentPatient?.height,
    };

    return assessVitalSigns(patientDemographics, vitalsToAssess);
  }, [patientDemographics, systolic, pulse, temperature, spo2, respiratoryRate, currentPatient?.weight, currentPatient?.height]);

  // Helper to get color for a specific vital
  const getVitalColor = (vitalKey: 'bloodPressure' | 'heartRate' | 'temperature' | 'spO2' | 'respiratoryRate' | 'bmi'): string => {
    if (!vitalAssessment || !vitalAssessment[vitalKey]) {
      return COLORS.status.neutral;
    }
    const vital = vitalAssessment[vitalKey];
    if (!vital) return COLORS.status.neutral;
    return getColorForStatus(vital.status);
  };

  const handleContinue = () => {
    const hasData = systolic || diastolic || pulse || temperature || spo2 || respiratoryRate;

    if (hasData) {
      // Show confirmation dialog with summary of entered vitals
      const vitalsSummary = [
        systolic && diastolic ? `BP: ${systolic}/${diastolic} mmHg` : null,
        pulse ? `${t['vitals.pulse']}: ${pulse} bpm` : null,
        temperature ? `${language === 'ja' ? '体温' : 'Temp'}: ${temperature}°C` : null,
        spo2 ? `SpO₂: ${spo2}%` : null,
        respiratoryRate ? `${language === 'ja' ? '呼吸数' : 'RR'}: ${respiratoryRate}/min` : null,
      ].filter(Boolean).join('\n');

      Alert.alert(
        t['dialog.confirmSave'],
        vitalsSummary,
        [
          {
            text: t['common.cancel'],
            style: 'cancel',
          },
          {
            text: t['common.save'],
            onPress: async () => {
              setVitals({
                blood_pressure_systolic: parseInt(systolic) || undefined,
                blood_pressure_diastolic: parseInt(diastolic) || undefined,
                heart_rate: parseInt(pulse) || undefined,
                temperature_celsius: parseFloat(temperature) || undefined,
                oxygen_saturation: parseInt(spo2) || undefined,
                respiratory_rate: parseInt(respiratoryRate) || undefined,
                measured_at: new Date(),
              });

              // Wait a moment for persist middleware to write to AsyncStorage
              await new Promise(resolve => setTimeout(resolve, 100));

              // Navigate back to Patient Info hub
              navigation.navigate('PatientInfo' as any);
            },
          },
        ]
      );
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
          onPress: () => navigation.navigate('PatientInfo' as any),
        },
      ]
    );
  };

  const hasData = systolic || diastolic || pulse || temperature || spo2 || respiratoryRate;

  return (
    <SafeAreaView style={styles.container}>
      {/* Patient Context Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={() => navigation.goBack()}>
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
            {language === 'ja' ? 'バイタルサイン' : 'Vital Signs'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <BLEIndicator status={bleStatus} isTransmitting={isTransmitting} />
          <LanguageToggle />
        </View>
      </View>

      <View style={styles.content}>
        {/* Vitals Dashboard Grid - 3/2 layout */}
        <View style={styles.dashboardGrid}>
          {/* Blood Pressure Card */}
          <Card statusColor={getVitalColor('bloodPressure')} style={styles.dashboardCard3}>
            <View style={styles.cardHeader}>
              <Ionicons name="heart" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>
                {language === 'ja' ? '血圧' : 'BP'}
              </Text>
            </View>
            <View style={styles.bpRow}>
              <TextInput
                keyboardType="numeric"
                placeholder="120"
                value={systolic}
                onChangeText={setSystolic}
                style={styles.bpInput}
                placeholderTextColor={COLORS.text.disabled}
              />
              <Text style={styles.separator}>/</Text>
              <TextInput
                keyboardType="numeric"
                placeholder="80"
                value={diastolic}
                onChangeText={setDiastolic}
                style={styles.bpInput}
                placeholderTextColor={COLORS.text.disabled}
              />
            </View>
            <Text style={styles.unitLabel}>mmHg</Text>
          </Card>

          {/* Pulse */}
          <Card statusColor={getVitalColor('heartRate')} style={styles.dashboardCard3}>
            <View style={styles.cardHeader}>
              <Ionicons name="pulse" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>
                {language === 'ja' ? '脈拍' : 'Pulse'}
              </Text>
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="72"
              value={pulse}
              onChangeText={setPulse}
              style={styles.vitalInput}
              placeholderTextColor={COLORS.text.disabled}
            />
            <Text style={styles.unitLabel}>bpm</Text>
          </Card>

          {/* Temperature */}
          <Card statusColor={getVitalColor('temperature')} style={styles.dashboardCard3}>
            <View style={styles.cardHeader}>
              <Ionicons name="thermometer" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>
                {language === 'ja' ? '体温' : 'Temp'}
              </Text>
            </View>
            <TextInput
              keyboardType="decimal-pad"
              placeholder="36.5"
              value={temperature}
              onChangeText={setTemperature}
              style={styles.vitalInput}
              placeholderTextColor={COLORS.text.disabled}
            />
            <Text style={styles.unitLabel}>°C</Text>
          </Card>

          {/* SpO2 */}
          <Card statusColor={getVitalColor('spO2')} style={styles.dashboardCard2}>
            <View style={styles.cardHeader}>
              <Ionicons name="water" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>SpO₂</Text>
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="98"
              value={spo2}
              onChangeText={setSpo2}
              style={styles.vitalInput}
              placeholderTextColor={COLORS.text.disabled}
            />
            <Text style={styles.unitLabel}>%</Text>
          </Card>

          {/* Respiratory Rate */}
          <Card statusColor={getVitalColor('respiratoryRate')} style={styles.dashboardCard2}>
            <View style={styles.cardHeader}>
              <Ionicons name="fitness" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>
                {language === 'ja' ? '呼吸数' : 'RR'}
              </Text>
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="16"
              value={respiratoryRate}
              onChangeText={setRespiratoryRate}
              style={styles.vitalInput}
              placeholderTextColor={COLORS.text.disabled}
            />
            <Text style={styles.unitLabel}>/min</Text>
          </Card>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button variant="text" onPress={handleSkip}>
          {t['common.skip']}
        </Button>
        <Button
          variant="primary"
          onPress={handleContinue}
          disabled={!hasData}
        >
          {t['common.next']}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    padding: SPACING.xl,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
  },
  dashboardCard3: {
    width: '31.5%', // 3 columns on iPad landscape (top row)
  },
  dashboardCard2: {
    width: '48%', // 2 columns on iPad landscape (bottom row)
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardLabel: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  bpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  separator: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.secondary,
  },
  bpInput: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    flex: 1,
  },
  vitalInput: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  unitLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
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
});
