import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { LanguageToggle, BLEIndicator } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button, Card, Input, StatusIndicator } from '@components/ui';
import { bleService } from '@services';
import { enhancedBleService } from '@services/enhancedBle';
import apiService from '@services/api';
import { BLEConnectionStatus, BPReading, DeviceReading, TemperatureReading } from '@models/ble';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { DEMO_STAFF_ID } from '@constants/config';
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
  const [reading, setReading] = useState<DeviceReading | null>(null);
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

  // Manual entry flags for duplicate detection control (per vital type)
  const [isManualBP, setIsManualBP] = useState(false);
  const [isManualPulse, setIsManualPulse] = useState(false);
  const [isManualTemp, setIsManualTemp] = useState(false);
  const [isManualSpO2, setIsManualSpO2] = useState(false);
  const [isManualRR, setIsManualRR] = useState(false);
  const [isManualGlucose, setIsManualGlucose] = useState(false);
  const [isManualWeight, setIsManualWeight] = useState(false);

  // Track original values loaded from session to detect changes
  const [originalValues, setOriginalValues] = useState<{
    systolic?: number;
    diastolic?: number;
    pulse?: number;
    temperature?: number;
    spo2?: number;
    respiratoryRate?: number;
    bloodGlucose?: number;
    weight?: number;
    jcsLevel?: number;
  }>({});

  const t = translations[language];

  // Wrapper functions to auto-check Manual checkbox when user types
  const handleSystolicChange = (value: string) => {
    setSystolic(value);
    setIsManualBP(true);
  };

  const handleDiastolicChange = (value: string) => {
    setDiastolic(value);
    setIsManualBP(true);
  };

  const handlePulseChange = (value: string) => {
    setPulse(value);
    setIsManualPulse(true);
  };

  const handleTemperatureChange = (value: string) => {
    setTemperature(value);
    setIsManualTemp(true);
  };

  const handleSpo2Change = (value: string) => {
    setSpo2(value);
    setIsManualSpO2(true);
  };

  const handleRespiratoryRateChange = (value: string) => {
    setRespiratoryRate(value);
    setIsManualRR(true);
  };

  const handleBloodGlucoseChange = (value: string) => {
    setBloodGlucose(value);
    setIsManualGlucose(true);
  };

  const handleWeightChange = (value: string) => {
    setWeight(value);
    setIsManualWeight(true);
  };

  // Get latest height (from patient updates if available, otherwise from patient record)
  const latestHeight = sessionPatientUpdates?.height ?? currentPatient?.height;

  // Use ref to track if we've loaded initial vitals (persists across re-renders)
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    console.log('[VitalsCapture] Screen mounted, hasLoadedRef:', hasLoadedRef.current);
    console.log('[VitalsCapture] currentPatient:', currentPatient?.patient_id);

    setCurrentStep('vitals-capture');

    // Only load from database ONCE on initial mount
    if (hasLoadedRef.current) {
      console.log('[VitalsCapture] Already loaded vitals, skipping');
      return;
    }

    const loadLatestVitals = async () => {
      if (!currentPatient?.patient_id) return;

      try {
        const history = await apiService.getVitalsHistory(
          currentPatient.patient_id,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString()
        );

        console.log('[VitalsCapture] Loaded vitals history:', history.length, 'entries');

        const latestBP = history.find(v => v.blood_pressure_systolic != null && v.blood_pressure_diastolic != null && v.input_method !== 'manual');
        const latestHR = history.find(v => v.heart_rate != null && v.input_method !== 'manual');
        const latestTemp = history.find(v => v.temperature_celsius != null);
        const latestSpO2 = history.find(v => v.oxygen_saturation != null);
        const latestRR = history.find(v => v.respiratory_rate != null);
        const latestGlucose = history.find(v => v.blood_glucose_mg_dl != null);
        const latestWeight = history.find(v => v.weight_kg != null);

        if (latestBP) {
          setSystolic(latestBP.blood_pressure_systolic!.toString());
          setDiastolic(latestBP.blood_pressure_diastolic!.toString());
        }
        if (latestHR) setPulse(latestHR.heart_rate!.toString());
        if (latestTemp) setTemperature(latestTemp.temperature_celsius!.toString());
        if (latestSpO2) setSpo2(latestSpO2.oxygen_saturation!.toString());
        if (latestRR) setRespiratoryRate(latestRR.respiratory_rate!.toString());
        if (latestGlucose) setBloodGlucose(latestGlucose.blood_glucose_mg_dl!.toString());
        if (latestWeight) setWeight(latestWeight.weight_kg!.toString());

        setOriginalValues({
          systolic: latestBP?.blood_pressure_systolic,
          diastolic: latestBP?.blood_pressure_diastolic,
          pulse: latestHR?.heart_rate,
          temperature: latestTemp?.temperature_celsius,
          spo2: latestSpO2?.oxygen_saturation,
          respiratoryRate: latestRR?.respiratory_rate,
          bloodGlucose: latestGlucose?.blood_glucose_mg_dl,
          weight: latestWeight?.weight_kg,
        });

        hasLoadedRef.current = true;
      } catch (error) {
        console.error('[VitalsCapture] Error loading vitals:', error);
      }
    };

    loadLatestVitals();

    let unsubscribeBLE: (() => void) | undefined;

    initializeBLE().then(unsubscribe => {
      unsubscribeBLE = unsubscribe;
    });

    return () => {
      console.log('[VitalsCapture] Screen unmounting, cleaning up...');
      if (unsubscribeBLE) {
        unsubscribeBLE();
      }
      enhancedBleService.stopScan();
      enhancedBleService.disconnect();
    };
  }, []);

  useEffect(() => {
    // Auto-populate from BLE reading
    if (reading) {
      console.log('[VitalsCapture] 📥 BLE reading received:', reading);
      
      // Handle different reading types
      if (reading.type === 'blood_pressure') {
        const bpReading = reading as BPReading;
        console.log('[VitalsCapture] Processing BP reading:', bpReading.data);
        
        setSystolic(bpReading.data.systolic.toString());
        setDiastolic(bpReading.data.diastolic.toString());
        setPulse(bpReading.data.pulse.toString());

        console.log('[VitalsCapture] Saving BP to store via setVitals');
        // Save to store so PatientInfo tile updates
        setVitals({
          blood_pressure_systolic: bpReading.data.systolic,
          blood_pressure_diastolic: bpReading.data.diastolic,
          heart_rate: bpReading.data.pulse,
          measured_at: bpReading.timestamp,
        });

        console.log('[VitalsCapture] Updating originalValues for BP');
        // Update originalValues so these are treated as NEW values (not duplicates)
        setOriginalValues(prev => ({
          ...prev,
          systolic: bpReading.data.systolic,
          diastolic: bpReading.data.diastolic,
          pulse: bpReading.data.pulse,
        }));
      } else if (reading.type === 'temperature') {
        const tempReading = reading as TemperatureReading;
        console.log('[VitalsCapture] Processing temperature reading:', tempReading.data);
        
        setTemperature(tempReading.data.temperature_celsius.toString());

        console.log('[VitalsCapture] Saving temperature to store via setVitals');
        // Save to store so PatientInfo tile updates
        setVitals({
          temperature_celsius: tempReading.data.temperature_celsius,
          measured_at: tempReading.timestamp,
        });

        console.log('[VitalsCapture] Updating originalValues for temperature');
        // Update originalValues so these are treated as NEW values (not duplicates)
        setOriginalValues(prev => ({
          ...prev,
          temperature: tempReading.data.temperature_celsius,
        }));
      }

      // Flash the BLE indicator during data transmission
      setIsTransmitting(true);
      const timer = setTimeout(() => {
        setIsTransmitting(false);
      }, 2000); // Flash for 2 seconds

      return () => clearTimeout(timer);
    }
  }, [reading, setVitals]);

  const initializeBLE = async () => {
    // Use enhanced BLE service for multi-device support
    enhancedBleService.setStatusCallback(setBleStatus);

    // Use persistent listener instead of callback
    const unsubscribe = enhancedBleService.onReading((newReading) => {
      console.log('[VitalsCapture] 📥 Received BLE reading:', newReading);
      setReading(newReading);
    });

    const hasPermission = await enhancedBleService.requestPermissions();
    if (hasPermission) {
      await enhancedBleService.startScan();
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

  const handleContinue = async () => {
    const hasData = systolic || diastolic || pulse || temperature || spo2 || respiratoryRate || bloodGlucose || weight || jcsLevel !== null;

    if (hasData) {
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

              // Filter out vitals that haven't changed from the original values
              let filteredVitalsData = { ...vitalsData };

              console.log('[VitalsCapture] Checking for unchanged vitals...');
              console.log('[VitalsCapture] Original values:', originalValues);

              // BP check (only if manual flag is not checked)
              if (!isManualBP && filteredVitalsData.blood_pressure_systolic && filteredVitalsData.blood_pressure_diastolic) {
                if (originalValues.systolic === filteredVitalsData.blood_pressure_systolic &&
                    originalValues.diastolic === filteredVitalsData.blood_pressure_diastolic) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged BP');
                  delete filteredVitalsData.blood_pressure_systolic;
                  delete filteredVitalsData.blood_pressure_diastolic;
                }
              }

              // Heart rate check
              if (!isManualPulse && filteredVitalsData.heart_rate) {
                if (originalValues.pulse === filteredVitalsData.heart_rate) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged Heart Rate');
                  delete filteredVitalsData.heart_rate;
                }
              }

              // Temperature check
              if (!isManualTemp && filteredVitalsData.temperature_celsius) {
                if (originalValues.temperature === filteredVitalsData.temperature_celsius) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged Temperature');
                  delete filteredVitalsData.temperature_celsius;
                }
              }

              // SpO2 check
              if (!isManualSpO2 && filteredVitalsData.oxygen_saturation) {
                if (originalValues.spo2 === filteredVitalsData.oxygen_saturation) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged SpO2');
                  delete filteredVitalsData.oxygen_saturation;
                }
              }

              // Respiratory rate check
              if (!isManualRR && filteredVitalsData.respiratory_rate) {
                if (originalValues.respiratoryRate === filteredVitalsData.respiratory_rate) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged RR');
                  delete filteredVitalsData.respiratory_rate;
                }
              }

              // Blood glucose check
              if (!isManualGlucose && filteredVitalsData.blood_glucose) {
                if (originalValues.bloodGlucose === filteredVitalsData.blood_glucose.value) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged Blood Glucose');
                  delete filteredVitalsData.blood_glucose;
                }
              }

              // Weight check
              if (!isManualWeight && filteredVitalsData.weight) {
                if (originalValues.weight === filteredVitalsData.weight.weight_kg) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged Weight');
                  delete filteredVitalsData.weight;
                }
              }

              // JCS check - always check if unchanged (no manual flag for consciousness)
              if (filteredVitalsData.consciousness) {
                if (originalValues.jcsLevel === filteredVitalsData.consciousness.jcs_level) {
                  console.log('[VitalsCapture] 🔇 Silently skipping unchanged JCS');
                  delete filteredVitalsData.consciousness;
                }
              }

              // Check if there are any vitals left to save after filtering
              const hasVitalsToSave =
                filteredVitalsData.blood_pressure_systolic ||
                filteredVitalsData.heart_rate ||
                filteredVitalsData.temperature_celsius ||
                filteredVitalsData.oxygen_saturation ||
                filteredVitalsData.respiratory_rate ||
                filteredVitalsData.blood_glucose ||
                filteredVitalsData.weight ||
                filteredVitalsData.consciousness;

              if (!hasVitalsToSave) {
                console.log('[VitalsCapture] 🔇 All vitals were duplicates, nothing to save');
                navigation.goBack();
                return;
              }

              // Save to session store (only non-duplicate vitals)
              setVitals(filteredVitalsData);

              // Save to backend immediately
              if (currentPatient) {
                try {
                  console.log('[VitalsCapture] Saving vitals to backend...');
                  const response = await apiService.recordVitals({
                    patient_id: currentPatient.patient_id,
                    ...filteredVitalsData,
                    measured_at: filteredVitalsData.measured_at.toISOString(),
                    input_method: 'manual',
                    recorded_by: DEMO_STAFF_ID,
                  });
                  console.log('[VitalsCapture] ✅ Vitals saved to backend successfully');

                  // Update session with backend metadata
                  const vitalsWithMetadata = {
                    ...filteredVitalsData,
                    _savedToBackend: true,
                    _backendVitalId: response.vital_sign_id,
                  };
                  setVitals(vitalsWithMetadata);
                } catch (error) {
                  console.error('[VitalsCapture] ❌ Failed to save vitals to backend:', error);
                  // Continue navigation even if backend save fails
                }
              }

      // Wait a moment for persist middleware to write to AsyncStorage
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate back to previous screen (PatientInfo)
      navigation.goBack();
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
          <ServerStatusIndicator compact />
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
              <TouchableOpacity
                style={styles.manualCheckboxInCard}
                onPress={() => setIsManualBP(!isManualBP)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxSmall, isManualBP && styles.checkboxSmallChecked]}>
                  {isManualBP && (
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.manualLabelSmall}>
                  {language === 'ja' ? '手動' : 'Manual'}
                </Text>
              </TouchableOpacity>
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
                onChangeText={handleSystolicChange}
                style={styles.bpInput}
                placeholderTextColor={COLORS.text.disabled}
              />
              <Text style={styles.separator}>/</Text>
              <TextInput
                keyboardType="numeric"
                placeholder="80"
                value={diastolic}
                onChangeText={handleDiastolicChange}
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
              <TouchableOpacity
                style={styles.manualCheckboxInCard}
                onPress={() => setIsManualPulse(!isManualPulse)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxSmall, isManualPulse && styles.checkboxSmallChecked]}>
                  {isManualPulse && (
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.manualLabelSmall}>
                  {language === 'ja' ? '手動' : 'Manual'}
                </Text>
              </TouchableOpacity>
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
              onChangeText={handlePulseChange}
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
              <TouchableOpacity
                style={styles.manualCheckboxInCard}
                onPress={() => setIsManualTemp(!isManualTemp)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxSmall, isManualTemp && styles.checkboxSmallChecked]}>
                  {isManualTemp && (
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.manualLabelSmall}>
                  {language === 'ja' ? '手動' : 'Manual'}
                </Text>
              </TouchableOpacity>
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
              onChangeText={handleTemperatureChange}
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
              <TouchableOpacity
                style={styles.manualCheckboxInCard}
                onPress={() => setIsManualSpO2(!isManualSpO2)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxSmall, isManualSpO2 && styles.checkboxSmallChecked]}>
                  {isManualSpO2 && (
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.manualLabelSmall}>
                  {language === 'ja' ? '手動' : 'Manual'}
                </Text>
              </TouchableOpacity>
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
              onChangeText={handleSpo2Change}
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
              <TouchableOpacity
                style={styles.manualCheckboxInCard}
                onPress={() => setIsManualRR(!isManualRR)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxSmall, isManualRR && styles.checkboxSmallChecked]}>
                  {isManualRR && (
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.manualLabelSmall}>
                  {language === 'ja' ? '手動' : 'Manual'}
                </Text>
              </TouchableOpacity>
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
              onChangeText={handleRespiratoryRateChange}
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
              <TouchableOpacity
                style={styles.manualCheckboxInCard}
                onPress={() => setIsManualGlucose(!isManualGlucose)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxSmall, isManualGlucose && styles.checkboxSmallChecked]}>
                  {isManualGlucose && (
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.manualLabelSmall}>
                  {language === 'ja' ? '手動' : 'Manual'}
                </Text>
              </TouchableOpacity>
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
              onChangeText={handleBloodGlucoseChange}
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
              <TouchableOpacity
                style={styles.manualCheckboxInCard}
                onPress={() => setIsManualWeight(!isManualWeight)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxSmall, isManualWeight && styles.checkboxSmallChecked]}>
                  {isManualWeight && (
                    <Ionicons name="checkmark" size={12} color={COLORS.white} />
                  )}
                </View>
                <Text style={styles.manualLabelSmall}>
                  {language === 'ja' ? '手動' : 'Manual'}
                </Text>
              </TouchableOpacity>
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
              onChangeText={handleWeightChange}
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
  // Manual Entry Checkbox Styles (per-vital)
  manualCheckboxInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    marginRight: SPACING.xs,
  },
  checkboxSmall: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSmallChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  manualLabelSmall: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
