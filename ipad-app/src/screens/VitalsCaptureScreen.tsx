import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, BLEIndicator } from '@components';
import { Button, Card, Input, StatusIndicator } from '@components/ui';
import { bleService } from '@services';
import { BLEConnectionStatus, BPReading } from '@models/ble';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import {
  assessVitalSigns,
  PatientDemographics,
  VitalSigns,
  getColorForStatus,
  assessBloodGlucose,
  assessWeight,
  assessConsciousness,
  GlucoseTestType,
  JCSLevel
} from '@utils';

type RootStackParamList = {
  VitalsCapture: undefined;
  ADLVoice: undefined;
  VitalsGraph: {
    patientId: string;
    vitalType: 'heart_rate' | 'blood_pressure' | 'temperature' | 'spo2' | 'respiratory_rate' | 'blood_glucose' | 'weight' | 'consciousness';
  };
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VitalsCapture'>;
};

export default function VitalsCaptureScreen({ navigation }: Props) {
  const { currentPatient, sessionVitals, sessionPatientUpdates, setVitals, setCurrentStep, language } = useAssessmentStore();
  const [bleStatus, setBleStatus] = useState<BLEConnectionStatus>('disconnected');
  const [reading, setReading] = useState<BPReading | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  // Manual input state - Original vitals
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [spo2, setSpo2] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');

  // New extended vitals
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [glucoseTestType, setGlucoseTestType] = useState<GlucoseTestType>('random');
  const [weight, setWeight] = useState('');
  const [jcsLevel, setJcsLevel] = useState<JCSLevel | null>(null);
  const [jcsInfoVisible, setJcsInfoVisible] = useState(false);

  const t = translations[language];

  // Get latest height (from patient updates if available, otherwise from patient record)
  const latestHeight = sessionPatientUpdates?.height ?? currentPatient?.height;

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

      // Load extended vitals
      if (sessionVitals.blood_glucose) {
        setBloodGlucose(sessionVitals.blood_glucose.value.toString());
        setGlucoseTestType(sessionVitals.blood_glucose.test_type);
      }
      if (sessionVitals.weight) {
        setWeight(sessionVitals.weight.weight_kg.toString());
      }
      if (sessionVitals.consciousness) {
        setJcsLevel(sessionVitals.consciousness.jcs_level);
      }
    } else {
      console.log('[VitalsCapture] No existing vitals found');
      // Pre-fill weight from patient record if available
      if (currentPatient?.weight) {
        setWeight(currentPatient.weight.toString());
      }
    }

    let unsubscribeBLE: (() => void) | undefined;

    initializeBLE().then(unsubscribe => {
      unsubscribeBLE = unsubscribe;
    });

    return () => {
      console.log('[VitalsCapture] Screen unmounting, cleaning up...');
      if (unsubscribeBLE) {
        unsubscribeBLE();
      }
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

    // Use persistent listener instead of callback
    const unsubscribe = bleService.onReading((newReading) => {
      console.log('[VitalsCapture] 📥 Received BLE reading:', newReading);
      setReading(newReading);
    });

    const hasPermission = await bleService.requestPermissions();
    if (hasPermission) {
      await bleService.startScan();
    }

    // Return cleanup function
    return unsubscribe;
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
      height: latestHeight,
    };

    return assessVitalSigns(patientDemographics, vitalsToAssess);
  }, [patientDemographics, systolic, pulse, temperature, spo2, respiratoryRate, currentPatient?.weight, latestHeight]);

  // Assess blood glucose
  const glucoseAssessment = useMemo(() => {
    if (!bloodGlucose) return null;
    const value = parseFloat(bloodGlucose);
    if (isNaN(value)) return null;
    return assessBloodGlucose(value, 'mg/dL', glucoseTestType);
  }, [bloodGlucose, glucoseTestType]);

  // Assess weight and BMI
  const weightAssessment = useMemo(() => {
    if (!weight) return null;
    const weightKg = parseFloat(weight);
    if (isNaN(weightKg)) return null;

    const previousWeight = sessionVitals?.weight?.weight_kg;
    return assessWeight(weightKg, latestHeight, previousWeight);
  }, [weight, latestHeight, sessionVitals?.weight?.weight_kg]);

  // Assess consciousness (JCS)
  const consciousnessAssessment = useMemo(() => {
    if (jcsLevel === null) return null;
    return assessConsciousness(jcsLevel);
  }, [jcsLevel]);

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
    const hasData = systolic || diastolic || pulse || temperature || spo2 || respiratoryRate || bloodGlucose || weight || jcsLevel !== null;

    if (hasData) {
      // Show confirmation dialog with summary of entered vitals
      const vitalsSummary = [
        systolic && diastolic ? `BP: ${systolic}/${diastolic} mmHg` : null,
        pulse ? `${t['vitals.pulse']}: ${pulse} bpm` : null,
        temperature ? `${language === 'ja' ? '体温' : 'Temp'}: ${temperature}°C` : null,
        spo2 ? `SpO₂: ${spo2}%` : null,
        respiratoryRate ? `${language === 'ja' ? '呼吸数' : 'RR'}: ${respiratoryRate}/min` : null,
        bloodGlucose ? `${t['vitals.bloodGlucose']}: ${bloodGlucose} mg/dL (${t[`vitals.${glucoseTestType}`]})` : null,
        weight ? `${t['vitals.weight']}: ${weight} kg` : null,
        jcsLevel !== null ? `${t['vitals.consciousness']}: JCS ${jcsLevel}` : null,
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
              const vitalsData: any = {
                blood_pressure_systolic: parseInt(systolic) || undefined,
                blood_pressure_diastolic: parseInt(diastolic) || undefined,
                heart_rate: parseInt(pulse) || undefined,
                temperature_celsius: parseFloat(temperature) || undefined,
                oxygen_saturation: parseInt(spo2) || undefined,
                respiratory_rate: parseInt(respiratoryRate) || undefined,
                measured_at: new Date(),
              };

              // Add blood glucose if entered
              if (bloodGlucose) {
                vitalsData.blood_glucose = {
                  value: parseFloat(bloodGlucose),
                  unit: 'mg/dL' as const,
                  test_type: glucoseTestType,
                };
              }

              // Add weight if entered
              if (weight) {
                const weightKg = parseFloat(weight);
                const previousWeight = sessionVitals?.weight?.weight_kg;
                vitalsData.weight = {
                  weight_kg: weightKg,
                  previous_weight_kg: previousWeight,
                  percentage_change: previousWeight
                    ? ((weightKg - previousWeight) / previousWeight) * 100
                    : undefined,
                  bmi: latestHeight
                    ? weightKg / Math.pow(latestHeight / 100, 2)
                    : undefined,
                };
              }

              // Add consciousness if entered
              if (jcsLevel !== null) {
                let jcsCategory: 'alert' | 'awake' | 'arousable' | 'coma';
                if (jcsLevel === 0) jcsCategory = 'alert';
                else if (jcsLevel >= 1 && jcsLevel <= 3) jcsCategory = 'awake';
                else if (jcsLevel >= 10 && jcsLevel <= 30) jcsCategory = 'arousable';
                else jcsCategory = 'coma';

                vitalsData.consciousness = {
                  jcs_level: jcsLevel,
                  jcs_category: jcsCategory,
                };
              }

              setVitals(vitalsData);

              // Wait a moment for persist middleware to write to AsyncStorage
              await new Promise(resolve => setTimeout(resolve, 100));

              // Navigate back to previous screen (PatientInfo)
              navigation.goBack();
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
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const hasData = systolic || diastolic || pulse || temperature || spo2 || respiratoryRate || bloodGlucose || weight || jcsLevel !== null;

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
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'blood_pressure',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
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
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'heart_rate',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
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
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'temperature',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
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
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'spo2',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
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
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'respiratory_rate',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
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

          {/* Blood Glucose */}
          <Card
            statusColor={glucoseAssessment ? getColorForStatus(glucoseAssessment.status) : COLORS.status.neutral}
            style={styles.dashboardCard3}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="water-outline" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>
                {t['vitals.bloodGlucose']}
              </Text>
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'blood_glucose',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="100"
              value={bloodGlucose}
              onChangeText={setBloodGlucose}
              style={styles.vitalInput}
              placeholderTextColor={COLORS.text.disabled}
            />
            <Text style={styles.unitLabel}>{t['vitals.mgdl']}</Text>
            <View style={styles.testTypeButtons}>
              {(['fasting', 'random', 'postprandial', 'bedtime'] as GlucoseTestType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.testTypeButton,
                    glucoseTestType === type && styles.testTypeButtonSelected,
                  ]}
                  onPress={() => setGlucoseTestType(type)}
                >
                  <Text style={[
                    styles.testTypeButtonText,
                    glucoseTestType === type && styles.testTypeButtonTextSelected,
                  ]}>
                    {t[`vitals.${type}`]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Weight & BMI */}
          <Card
            statusColor={weightAssessment?.bmiStatus ? getColorForStatus(weightAssessment.bmiStatus) : COLORS.status.neutral}
            style={styles.dashboardCard3}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="scale-outline" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>
                {t['vitals.weight']}
              </Text>
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'weight',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              keyboardType="numeric"
              placeholder="65"
              value={weight}
              onChangeText={setWeight}
              style={styles.vitalInput}
              placeholderTextColor={COLORS.text.disabled}
            />
            <Text style={styles.unitLabel}>{t['vitals.kg']}</Text>
            {weightAssessment?.bmi && (
              <Text style={styles.bmiLabel}>
                BMI: {weightAssessment.bmi.toFixed(1)} ({weightAssessment.bmiLabel})
              </Text>
            )}
            {weightAssessment?.weightChange && (
              <Text style={[styles.changeLabel, { color: getColorForStatus(weightAssessment.weightChange.status) }]}>
                {weightAssessment.weightChange.percentage > 0 ? '↑' : '↓'}
                {Math.abs(weightAssessment.weightChange.percentage).toFixed(1)}%
              </Text>
            )}
          </Card>

          {/* Consciousness (JCS) */}
          <Card
            statusColor={consciousnessAssessment ? getColorForStatus(consciousnessAssessment.status) : COLORS.status.neutral}
            style={styles.dashboardCard3}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="eye-outline" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.cardLabel}>
                {t['vitals.consciousness']}
              </Text>
              <TouchableOpacity
                style={styles.infoIcon}
                onPress={() => setJcsInfoVisible(true)}
              >
                <Ionicons name="information-circle-outline" size={ICON_SIZES.sm} color={COLORS.text.secondary} />
              </TouchableOpacity>
              {currentPatient && (
                <TouchableOpacity
                  style={styles.historyIcon}
                  onPress={() => navigation.navigate('VitalsGraph', {
                    patientId: currentPatient.patient_id,
                    vitalType: 'consciousness',
                  })}
                >
                  <Ionicons name="stats-chart-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.jcsButtonsContainer}>
              {/* Row 1: 0 (Alert) */}
              <View style={styles.jcsRow}>
                <TouchableOpacity
                  style={[
                    styles.jcsButton,
                    styles.jcsButtonFull,
                    jcsLevel === 0 && styles.jcsButtonSelected,
                  ]}
                  onPress={() => setJcsLevel(0)}
                >
                  <Text style={[
                    styles.jcsButtonText,
                    jcsLevel === 0 && styles.jcsButtonTextSelected,
                  ]}>
                    0
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: 1- (Stimulated) */}
              <View style={styles.jcsRow}>
                <Text style={styles.jcsCategory}>1-</Text>
                {[1, 2, 3].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.jcsButton,
                      jcsLevel === level && styles.jcsButtonSelected,
                    ]}
                    onPress={() => setJcsLevel(level as JCSLevel)}
                  >
                    <Text style={[
                      styles.jcsButtonText,
                      jcsLevel === level && styles.jcsButtonTextSelected,
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Row 3: 2- (Pain response) */}
              <View style={styles.jcsRow}>
                <Text style={styles.jcsCategory}>2-</Text>
                {[10, 20, 30].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.jcsButton,
                      jcsLevel === level && styles.jcsButtonSelected,
                    ]}
                    onPress={() => setJcsLevel(level as JCSLevel)}
                  >
                    <Text style={[
                      styles.jcsButtonText,
                      jcsLevel === level && styles.jcsButtonTextSelected,
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Row 4: 3- (Unresponsive) */}
              <View style={styles.jcsRow}>
                <Text style={styles.jcsCategory}>3-</Text>
                {[100, 200, 300].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.jcsButton,
                      jcsLevel === level && styles.jcsButtonSelected,
                    ]}
                    onPress={() => setJcsLevel(level as JCSLevel)}
                  >
                    <Text style={[
                      styles.jcsButtonText,
                      jcsLevel === level && styles.jcsButtonTextSelected,
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {consciousnessAssessment && (
              <Text style={styles.jcsLabel}>
                {language === 'ja' ? consciousnessAssessment.statusLabelJa : consciousnessAssessment.statusLabel}
              </Text>
            )}
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

      {/* JCS Info Modal */}
      <Modal
        visible={jcsInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJcsInfoVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setJcsInfoVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === 'ja' ? 'Japan Coma Scale (JCS)' : 'Japan Coma Scale (JCS)'}
              </Text>
              <TouchableOpacity onPress={() => setJcsInfoVisible(false)}>
                <Ionicons name="close" size={ICON_SIZES.lg} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.jcsInfoSection}>
                <Text style={styles.jcsInfoCategory}>0 - {language === 'ja' ? '覚醒している' : 'Alert'}</Text>
                <Text style={styles.jcsInfoDescription}>
                  {language === 'ja' ? '意識清明' : 'Fully conscious, alert, and oriented'}
                </Text>
              </View>

              <View style={styles.jcsInfoSection}>
                <Text style={styles.jcsInfoCategory}>1 (1-3) - {language === 'ja' ? '刺激に応じて覚醒する' : 'Stimulated'}</Text>
                <Text style={styles.jcsInfoDescription}>
                  {language === 'ja' ? '刺激しないでも覚醒している状態' : 'Awake without stimulation, but consciousness impaired'}
                </Text>
                <Text style={styles.jcsInfoItem}>1: {language === 'ja' ? 'だいたい意識清明だが今ひとつはっきりしない' : 'Almost fully conscious but not quite clear'}</Text>
                <Text style={styles.jcsInfoItem}>2: {language === 'ja' ? '見当識障害がある' : 'Disoriented'}</Text>
                <Text style={styles.jcsInfoItem}>3: {language === 'ja' ? '自分の名前、生年月日が言えない' : 'Cannot recall own name or birthdate'}</Text>
              </View>

              <View style={styles.jcsInfoSection}>
                <Text style={styles.jcsInfoCategory}>2 (10-30) - {language === 'ja' ? '痛み刺激で覚醒する' : 'Pain Response'}</Text>
                <Text style={styles.jcsInfoDescription}>
                  {language === 'ja' ? '刺激すると覚醒する状態' : 'Aroused by stimulation'}
                </Text>
                <Text style={styles.jcsInfoItem}>10: {language === 'ja' ? '普通の呼びかけで容易に開眼する' : 'Easily opens eyes to normal voice'}</Text>
                <Text style={styles.jcsInfoItem}>20: {language === 'ja' ? '大きな声または体を揺さぶることにより開眼する' : 'Opens eyes to loud voice or shaking'}</Text>
                <Text style={styles.jcsInfoItem}>30: {language === 'ja' ? '痛み刺激を加えつつ呼びかけを繰り返すと辛うじて開眼する' : 'Opens eyes only with repeated painful stimulation'}</Text>
              </View>

              <View style={styles.jcsInfoSection}>
                <Text style={styles.jcsInfoCategory}>3 (100-300) - {language === 'ja' ? '痛み刺激にも覚醒しない' : 'Unresponsive'}</Text>
                <Text style={styles.jcsInfoDescription}>
                  {language === 'ja' ? '刺激をしても覚醒しない状態' : 'Does not wake up with stimulation'}
                </Text>
                <Text style={styles.jcsInfoItem}>100: {language === 'ja' ? '痛みに対し払いのける動作をする' : 'Responds to pain with movement'}</Text>
                <Text style={styles.jcsInfoItem}>200: {language === 'ja' ? '痛み刺激で少し手足を動かしたり顔をしかめる' : 'Slight movement or grimaces to pain'}</Text>
                <Text style={styles.jcsInfoItem}>300: {language === 'ja' ? '痛み刺激に全く反応しない' : 'No response to pain'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    position: 'relative',
  },
  historyIcon: {
    marginLeft: 'auto',
    padding: SPACING.xs,
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
  testTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  testTypeButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
    minWidth: 60,
  },
  testTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  testTypeButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  testTypeButtonTextSelected: {
    color: COLORS.surface,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  bmiLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  changeLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  infoIcon: {
    padding: SPACING.xs,
  },
  jcsButtonsContainer: {
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  jcsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  jcsCategory: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    minWidth: 24,
  },
  jcsButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  jcsButtonFull: {
    flex: 1,
  },
  jcsButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  jcsButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  jcsButtonTextSelected: {
    color: COLORS.surface,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  jcsLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    maxWidth: 600,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  modalBody: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  jcsInfoSection: {
    gap: SPACING.xs,
  },
  jcsInfoCategory: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  jcsInfoDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  jcsInfoItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    paddingLeft: SPACING.md,
  },
});
