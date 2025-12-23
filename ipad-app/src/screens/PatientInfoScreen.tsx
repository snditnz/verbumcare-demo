import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { LanguageToggle, BLEIndicator } from '@components';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { Button, Card } from '@components/ui';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES, BORDER_RADIUS } from '@constants/theme';
import { SESSION_CONFIG, DEMO_STAFF_ID } from '@constants/config';
import apiService from '@services/api';
import bleService from '@services/ble';
import { BLEConnectionStatus, BPReading } from '@types/ble';
import { useAuthStore } from '@stores/authStore';
import { voiceService } from '@services/voice';
import { preserveNavigationContext } from '@utils/navigationContext';

const api = apiService;

type RootStackParamList = {
  Dashboard: undefined;
  PatientList: undefined;
  PatientInfo: undefined;
  VitalsCapture: undefined;
  VitalsGraph: { patientId: string; vitalType?: 'heart_rate' | 'blood_pressure' | 'temperature' | 'spo2' };
  ADLVoice: undefined;
  MedicineAdmin: undefined;
  UpdatePatientInfo: undefined;
  IncidentReport: undefined;
  PainAssessment: undefined;
  FallRiskAssessment: undefined;
  KihonChecklist: undefined;
  ReviewConfirm: undefined;
  CarePlanHub: undefined;
  ComingSoon: { feature: string };
  ReviewQueue: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PatientInfo'>;
};

export default function PatientInfoScreen({ navigation }: Props) {
  const {
    currentPatient,
    language,
    sessionVitals,
    sessionBarthelIndex,
    sessionPainAssessment,
    sessionFallRiskAssessment,
    sessionKihonChecklist,
    adlRecordingId,
    adlProcessedData,
    sessionMedications,
    sessionPatientUpdates,
    sessionIncidents,
    setVitals,
    removeLastVital,
  } = useAssessmentStore();
  const { currentUser } = useAuthStore();
  const { queueCount } = useVoiceReviewStore();

  const [scheduleData, setScheduleData] = useState<any>(null);
  const [bleStatus, setBleStatus] = useState<BLEConnectionStatus>('disconnected');
  const [bleReading, setBleReading] = useState<BPReading | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastOpacity] = useState(new Animated.Value(0));
  const t = translations[language];

  // Load patient's schedule
  useEffect(() => {
    if (currentPatient) {
      apiService.getTodaySchedule(currentPatient.patient_id)
        .then(schedule => setScheduleData(schedule))
        .catch(err => console.error('[PatientInfo] Failed to load schedule:', err));
    }
  }, [currentPatient]);

  // If no patient, navigate back to dashboard
  React.useEffect(() => {
    if (!currentPatient) {
      navigation.navigate('Dashboard' as any);
    }
  }, [currentPatient, navigation]);

  // BLE initialization and lifecycle management
  const initializeBLE = async () => {
    try {
      console.log('[PatientInfo] Initializing BLE...');

      // Ensure any previous state is cleaned up
      await bleService.stopScan();
      await bleService.disconnect();

      // Set status callback
      bleService.setStatusCallback(setBleStatus);

      // Use persistent listener instead of callback
      const unsubscribe = bleService.onReading(handleBLEReading);
      console.log('[PatientInfo] BLE persistent listener registered');

      const hasPermission = await bleService.requestPermissions();
      console.log('[PatientInfo] BLE permissions:', hasPermission);

      if (hasPermission) {
        console.log('[PatientInfo] Starting BLE scan...');
        await bleService.startScan();
      } else {
        console.error('[PatientInfo] BLE permissions denied or Bluetooth not available');
        setBleStatus('error');
      }

      // Return cleanup function
      return unsubscribe;
    } catch (error) {
      console.error('[PatientInfo] BLE initialization error:', error);
      setBleStatus('error');
      return () => {}; // Return no-op cleanup
    }
  };

  // Track last saved reading to prevent duplicates
  const lastSavedTimestamp = useRef<number>(0);

  // Handle BLE reading - auto-save immediately (no duplicate check for BLE)
  const handleBLEReading = async (reading: BPReading) => {
    console.log('[PatientInfo] ✅ BLE reading callback triggered!');
    console.log('[PatientInfo] Reading data:', reading);

    // Simple time-based deduplication to prevent multiple toasts within 5 seconds
    const readingTime = reading.timestamp.getTime();
    if (Math.abs(readingTime - lastSavedTimestamp.current) < 5000) {
      console.log('[PatientInfo] ⚠️ Duplicate reading detected within 5s, skipping');
      return;
    }
    lastSavedTimestamp.current = readingTime;

    try {
      // Save to session store
      const vitalsData = {
        blood_pressure_systolic: reading.systolic,
        blood_pressure_diastolic: reading.diastolic,
        heart_rate: reading.pulse,
        measured_at: reading.timestamp,
      };

      console.log('[PatientInfo] Saving vitals to session store...');
      setVitals(vitalsData);

      // Persist to backend immediately (BLE readings bypass duplicate check)
      if (currentPatient) {
        console.log('[PatientInfo] Persisting BLE vitals to backend...');
        try {
          // Use authenticated user ID for BLE readings (Requirement 13.6)
          const recordedBy = currentUser?.userId || DEMO_STAFF_ID;
          console.log('[PatientInfo] Recording BLE vitals with user:', recordedBy);
          
          const response = await api.recordVitals({
            patient_id: currentPatient.patient_id,
            blood_pressure_systolic: reading.systolic,
            blood_pressure_diastolic: reading.diastolic,
            heart_rate: reading.pulse,
            measured_at: reading.timestamp.toISOString(),
            input_method: 'iot_sensor',
            recorded_by: recordedBy,
          });
          console.log('[PatientInfo] ✅ BLE vitals persisted to backend successfully');

          // Update with backend metadata
          const vitalsWithMetadata = {
            ...vitalsData,
            _savedToBackend: true,
            _backendVitalId: response.vital_sign_id,
          } as any;
          setVitals(vitalsWithMetadata);
        } catch (backendError) {
          console.error('[PatientInfo] ❌ Failed to persist BLE vitals:', backendError);
        }
      }

      // Store reading for toast display
      setBleReading(reading);
      console.log('[PatientInfo] Showing toast notification...');

      // Show toast notification
      setShowToast(true);
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss toast after 10 seconds
      setTimeout(() => {
        dismissToast();
      }, 10000);
    } catch (error) {
      console.error('[PatientInfo] Error handling BLE reading:', error);
    }
  };

  // Dismiss toast with animation
  const dismissToast = () => {
    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowToast(false);
      setBleReading(null);
    });
  };

  // Initialize BLE on mount, cleanup on unmount
  useEffect(() => {
    let unsubscribeBLE: (() => void) | undefined;

    initializeBLE().then(unsubscribe => {
      unsubscribeBLE = unsubscribe;
    });

    return () => {
      console.log('[PatientInfo] Screen unmounting, cleaning up...');
      if (unsubscribeBLE) {
        unsubscribeBLE();
      }
      bleService.stopScan();
      bleService.disconnect();
    };
  }, []);

  // BLE service handles auto-reconnect internally, no need to do it here

  if (!currentPatient) {
    return null;
  }

  // Helper: Check if timestamp is within badge timeout window
  const isDataRecent = (timestamp: Date | string | undefined): boolean => {
    if (!timestamp) return false;
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const hoursSince = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    return hoursSince <= SESSION_CONFIG.BADGE_TIMEOUT_HOURS;
  };

  // Calculate action statuses for visual indicators
  const getActionStatus = (actionType: string) => {
    switch (actionType) {
      case 'vitals':
        const hasRecentVitals = sessionVitals && isDataRecent(sessionVitals.measured_at);
        const vitalCount = hasRecentVitals ? Object.keys(sessionVitals).filter(k => sessionVitals[k as keyof typeof sessionVitals]).length : 0;
        return {
          completed: vitalCount > 0,
          count: vitalCount,
          borderColor: vitalCount > 0 ? COLORS.success : COLORS.border,
        };

      case 'adl':
        const hasRecentBarthel = sessionBarthelIndex && isDataRecent(sessionBarthelIndex.recorded_at);
        const adlCompleted = hasRecentBarthel || adlRecordingId !== null || adlProcessedData !== null;
        const adlCount = hasRecentBarthel ? 1 : (adlProcessedData?.categories?.length || (adlRecordingId ? 1 : 0));
        return {
          completed: adlCompleted,
          count: adlCount,
          borderColor: adlCompleted ? COLORS.success : COLORS.border,
        };

      case 'medicine':
        const recentMeds = sessionMedications.filter(med => isDataRecent(med.timestamp));
        return {
          completed: recentMeds.length > 0,
          count: recentMeds.length,
          borderColor: recentMeds.length > 0 ? COLORS.success : COLORS.border,
        };

      case 'patientInfo':
        const hasRecentUpdates = sessionPatientUpdates && isDataRecent(sessionPatientUpdates.updatedAt);
        const isDraft = hasRecentUpdates && !sessionPatientUpdates.confirmed;
        const isConfirmed = hasRecentUpdates && sessionPatientUpdates?.confirmed === true;
        return {
          completed: hasRecentUpdates,
          badge: isDraft ? '✎' : isConfirmed ? '✓' : '',
          borderColor: isDraft ? COLORS.warning : isConfirmed ? COLORS.success : COLORS.border,
        };

      case 'pain':
        const hasRecentPain = sessionPainAssessment && isDataRecent(sessionPainAssessment.recorded_at);
        return {
          completed: hasRecentPain,
          count: hasRecentPain ? 1 : 0,
          borderColor: hasRecentPain ? COLORS.success : COLORS.border,
        };

      case 'fallRisk':
        const hasRecentFallRisk = sessionFallRiskAssessment && isDataRecent(sessionFallRiskAssessment.recorded_at);
        return {
          completed: hasRecentFallRisk,
          count: hasRecentFallRisk ? 1 : 0,
          borderColor: hasRecentFallRisk ? COLORS.success : COLORS.border,
        };

      case 'kihon':
        const hasRecentKihon = sessionKihonChecklist && isDataRecent(sessionKihonChecklist.recorded_at);
        return {
          completed: hasRecentKihon,
          count: hasRecentKihon ? 1 : 0,
          borderColor: hasRecentKihon ? COLORS.success : COLORS.border,
        };

      case 'review':
        const hasRecentVitalsForReview = sessionVitals && isDataRecent(sessionVitals.measured_at);
        const hasRecentBarthelForReview = sessionBarthelIndex && isDataRecent(sessionBarthelIndex.recorded_at);
        const hasRecentPainForReview = sessionPainAssessment && isDataRecent(sessionPainAssessment.recorded_at);
        const hasRecentFallRiskForReview = sessionFallRiskAssessment && isDataRecent(sessionFallRiskAssessment.recorded_at);
        const recentMedsForReview = sessionMedications.filter(med => isDataRecent(med.timestamp));
        const hasRecentUpdatesForReview = sessionPatientUpdates && isDataRecent(sessionPatientUpdates.updatedAt);
        const recentIncidentsForReview = sessionIncidents.filter(inc => isDataRecent(inc.timestamp));

        const totalActions =
          (hasRecentVitalsForReview ? 1 : 0) +
          (hasRecentBarthelForReview ? 1 : 0) +
          (hasRecentPainForReview ? 1 : 0) +
          (hasRecentFallRiskForReview ? 1 : 0) +
          recentMedsForReview.length +
          (hasRecentUpdatesForReview ? 1 : 0) +
          recentIncidentsForReview.length;
        return {
          completed: totalActions > 0,
          count: totalActions,
          borderColor: COLORS.primary,
        };

      default:
        return { completed: false, count: 0, borderColor: COLORS.border };
    }
  };

  // Display patient name with English version when language is 'en'
  const displayName = language === 'ja'
    ? `${currentPatient.family_name} ${currentPatient.given_name}`
    : `${currentPatient.family_name_en || currentPatient.family_name} ${currentPatient.given_name_en || currentPatient.given_name}`;

  // Handle voice recording with patient context
  const handleVoiceRecording = () => {
    // Preserve navigation context before navigating to voice recorder
    preserveNavigationContext(navigation, {
      patientId: currentPatient?.patient_id,
      patientName: currentPatient ? `${currentPatient.family_name} ${currentPatient.given_name}`.trim() : undefined,
    });
    
    // Set patient context before navigating
    const context = voiceService.detectContext(currentPatient);
    voiceService.setContext(context);
    navigation.navigate('GeneralVoiceRecorder');
  };

  // Get latest height (from session updates, historical vitals, or patient record)
  const latestHeight = sessionPatientUpdates?.height ?? currentPatient.latest_height_cm ?? currentPatient.height_cm;

  // Get latest weight (from session vitals, historical vitals, or patient record)
  const latestWeight = sessionVitals?.weight?.weight_kg ?? currentPatient.latest_weight_kg ?? currentPatient.weight_kg;

  // Calculate BMI from latest height and weight
  const calculateBMI = () => {
    if (latestHeight && latestWeight) {
      const heightInMeters = latestHeight / 100;
      return (latestWeight / (heightInMeters ** 2)).toFixed(1);
    }
    return null;
  };

  // Parse medications into array
  const getMedicationsList = () => {
    if (!currentPatient.medications) return [];
    // Split on Japanese comma or regular comma
    return currentPatient.medications.split(/[、,]/).filter(m => m.trim().length > 0).map(m => m.trim());
  };

  // Check if vitals were captured today
  const hasVitalsToday = sessionVitals && sessionVitals.measured_at
    ? new Date(sessionVitals.measured_at).toDateString() === new Date().toDateString()
    : false;

  // Toast action handlers
  const handleSubmit = () => {
    // Vitals already saved automatically in BLE handler
    dismissToast();
  };

  const handleVitalsNavigation = () => {
    // Navigate to VitalsCapture screen (BP data already saved, will auto-populate)
    dismissToast();
    navigation.navigate('VitalsCapture');
  };

  const handleDismiss = () => {
    // Remove the last BP reading from session history
    removeLastVital();
    console.log('[PatientInfo] Last BP reading removed from history');
    dismissToast();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button variant="text" onPress={() => navigation.navigate('Dashboard' as any)}>
            {`← ${t['common.back']}`}
          </Button>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.screenTitle}>{t['patientInfo.title']}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerRightContent}>
            {/* Review Queue Badge */}
            {queueCount > 0 && (
              <TouchableOpacity 
                style={styles.reviewQueueBadge}
                onPress={() => navigation.navigate('ReviewQueue' as any)}
              >
                <Ionicons name="list" size={20} color={COLORS.white} />
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{queueCount}</Text>
                </View>
              </TouchableOpacity>
            )}
            <BLEIndicator status={bleStatus} />
            <ServerStatusIndicator compact />
            <LanguageToggle />
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Top Row: Patient Identity + Barthel + Medications + Pain + Fall Risk */}
        <View style={styles.topRow}>
          {/* Tile 1: Patient Identity with Photo */}
          <Card style={styles.identityTile}>
            <View style={styles.identityContent}>
              <View style={styles.portraitContainer}>
                <Image
                  source={require('../../assets/avatar-placeholder.png')}
                  style={styles.portrait}
                />
              </View>
              <View style={styles.identityInfo}>
                <Text style={styles.patientName}>{displayName}</Text>
                <Text style={styles.demographicsText}>
                  {currentPatient.age}{t['common.years']} • {currentPatient.gender === 'male' ? t['common.male'] : t['common.female']}
                </Text>
                {currentPatient.room && (
                  <Text style={styles.demographicsText}>{t['patient.room']} {currentPatient.room}</Text>
                )}
                {latestHeight && latestWeight && (
                  <>
                    <Text style={styles.demographicsText}>{latestHeight}cm • {latestWeight}kg</Text>
                    <Text style={styles.demographicsText}>BMI: {calculateBMI()}</Text>
                  </>
                )}
              </View>
            </View>
            {/* Incident Button - Top Right Corner */}
            <TouchableOpacity
              style={styles.incidentButtonSmall}
              onPress={() => navigation.navigate('IncidentReport')}
            >
              <Ionicons name="warning-outline" size={18} color={COLORS.error} />
              <Text style={styles.incidentButtonLabel}>
                {language === 'ja' ? 'インシデント' : 'Incident'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Tile 2: Barthel Index */}
          <Card style={styles.compactTile}>
            <View style={styles.tileHeader}>
              <Ionicons name="clipboard" size={ICON_SIZES.md} color={COLORS.primary} />
              <Text style={styles.tileTitle}>{t['patientInfo.latestBarthel']}</Text>
            </View>
            {sessionBarthelIndex || currentPatient.latest_barthel_index !== undefined ? (
              <>
                <Text style={styles.tileValue}>
                  {sessionBarthelIndex?.total_score ?? currentPatient.latest_barthel_index}/100
                </Text>
                <Text style={styles.tileSubtext}>
                  {sessionBarthelIndex
                    ? new Date(sessionBarthelIndex.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')
                    : currentPatient.latest_barthel_date || 'N/A'
                  }
                </Text>
              </>
            ) : (
              <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
            )}
          </Card>

          {/* Tile 3: Current Medications - Tappable */}
          <TouchableOpacity onPress={() => navigation.navigate('UpdatePatientInfo' as any, { initialTab: 'medical' })}>
            <Card style={styles.compactTile}>
              <View style={styles.tileHeader}>
                <Ionicons name="medical" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.tileTitle}>{t['patientInfo.currentMeds']}</Text>
              </View>
              {currentPatient.medications ? (
                <ScrollView style={styles.medScrollView} showsVerticalScrollIndicator={false}>
                  {getMedicationsList().map((med, index) => (
                    <View key={index} style={styles.medItem}>
                      <Text style={styles.medBullet}>•</Text>
                      <Text style={styles.medText}>{med}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
              )}
            </Card>
          </TouchableOpacity>

          {/* Tile 4: Pain Score - Tappable */}
          <TouchableOpacity onPress={() => navigation.navigate('PainAssessment')}>
            <Card style={styles.compactTile}>
              <View style={styles.tileHeader}>
                <Ionicons name="pulse" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.tileTitle}>{t['action.painAssessment']}</Text>
              </View>
              {sessionPainAssessment || currentPatient.latest_pain_score !== undefined ? (
                <>
                  <Text style={styles.tileValue}>
                    {sessionPainAssessment?.pain_score ?? currentPatient.latest_pain_score}/10
                  </Text>
                  <Text style={styles.tileSubtext}>
                    {sessionPainAssessment
                      ? new Date(sessionPainAssessment.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')
                      : currentPatient.latest_pain_date || 'N/A'
                    }
                  </Text>
                </>
              ) : (
                <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
              )}
            </Card>
          </TouchableOpacity>

          {/* Tile 5: Fall Risk - Tappable */}
          <TouchableOpacity onPress={() => navigation.navigate('FallRiskAssessment')}>
            <Card style={styles.compactTile}>
              <View style={styles.tileHeader}>
                <Ionicons name="body" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.tileTitle}>{t['action.fallRisk']}</Text>
              </View>
              {sessionFallRiskAssessment || currentPatient.latest_fall_risk_score !== undefined ? (
                <>
                  <Text style={styles.tileValue}>
                    {sessionFallRiskAssessment?.risk_score ?? currentPatient.latest_fall_risk_score}/8
                  </Text>
                  <Text style={styles.tileSubtext}>
                    {language === 'ja'
                      ? (sessionFallRiskAssessment?.risk_level === 'low' ? '低リスク' :
                         sessionFallRiskAssessment?.risk_level === 'moderate' ? '中等度リスク' :
                         sessionFallRiskAssessment?.risk_level === 'high' ? '高リスク' :
                         currentPatient.latest_fall_risk_level === 'low' ? '低リスク' :
                         currentPatient.latest_fall_risk_level === 'moderate' ? '中等度リスク' : '高リスク')
                      : (sessionFallRiskAssessment?.risk_level ?? currentPatient.latest_fall_risk_level ?? 'N/A')
                    }
                  </Text>
                  <Text style={styles.tileSubtext}>
                    {sessionFallRiskAssessment
                      ? new Date(sessionFallRiskAssessment.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')
                      : currentPatient.latest_fall_risk_date || 'N/A'
                    }
                  </Text>
                </>
              ) : (
                <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
              )}
            </Card>
          </TouchableOpacity>
        </View>

        {/* Second Row: Vitals + Allergies + Key Notes + Kihon Checklist */}
        <View style={styles.infoRow}>
          {/* Vitals - Tappable */}
          <TouchableOpacity style={styles.infoTile} onPress={() => navigation.navigate('VitalsCapture')}>
            <Card style={styles.infoTileCard}>
              <View style={styles.tileHeader}>
                <Ionicons name="fitness" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.tileTitle}>{t['review.vitals']}</Text>
              </View>
            {(() => {
              // Prefer session vitals if captured today
              const vitals = hasVitalsToday && sessionVitals ? sessionVitals : null;
              // Fall back to historical vitals from patient record
              const hasBP = vitals?.blood_pressure_systolic || currentPatient.latest_bp_systolic;
              const hasHR = vitals?.heart_rate || currentPatient.latest_heart_rate;
              const hasTemp = vitals?.temperature_celsius || currentPatient.latest_temperature;
              const hasSpO2 = vitals?.oxygen_saturation || currentPatient.latest_oxygen_saturation;
              const hasRR = vitals?.respiratory_rate || currentPatient.latest_respiratory_rate;
              const hasAnyVitals = hasBP || hasHR || hasTemp || hasSpO2 || hasRR;

              if (!hasAnyVitals) {
                return <Text style={styles.noDataText}>{t['patientInfo.noVitalsToday']}</Text>;
              }

              return (
                <>
                  {(vitals?.blood_pressure_systolic || currentPatient.latest_bp_systolic) && (
                    <Text style={styles.infoText}>
                      BP: {vitals?.blood_pressure_systolic || currentPatient.latest_bp_systolic}/{vitals?.blood_pressure_diastolic || currentPatient.latest_bp_diastolic} mmHg
                    </Text>
                  )}
                  {(vitals?.heart_rate || currentPatient.latest_heart_rate) && (
                    <Text style={styles.infoText}>
                      HR: {vitals?.heart_rate || currentPatient.latest_heart_rate} bpm
                    </Text>
                  )}
                  {(vitals?.temperature_celsius || currentPatient.latest_temperature) && (
                    <Text style={styles.infoText}>
                      Temp: {vitals?.temperature_celsius || currentPatient.latest_temperature}°C
                    </Text>
                  )}
                  {(vitals?.oxygen_saturation || currentPatient.latest_oxygen_saturation) && (
                    <Text style={styles.infoText}>
                      SpO₂: {vitals?.oxygen_saturation || currentPatient.latest_oxygen_saturation}%
                    </Text>
                  )}
                  {(vitals?.respiratory_rate || currentPatient.latest_respiratory_rate) && (
                    <Text style={styles.infoText}>
                      RR: {vitals?.respiratory_rate || currentPatient.latest_respiratory_rate}/min
                    </Text>
                  )}
                  {vitals?.measured_at && (
                    <Text style={styles.tileTimestamp}>
                      {new Date(vitals.measured_at).toLocaleTimeString(language === 'ja' ? 'ja-JP' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                  {!vitals && currentPatient.latest_vitals_date && (
                    <Text style={styles.tileTimestamp}>
                      {new Date(currentPatient.latest_vitals_date).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')}
                    </Text>
                  )}
                </>
              );
            })()}
            </Card>
          </TouchableOpacity>

          {/* Allergies - Tappable */}
          <TouchableOpacity style={styles.infoTile} onPress={() => navigation.navigate('UpdatePatientInfo' as any, { initialTab: 'medical' })}>
            <Card style={styles.infoTileCard}>
              <View style={styles.tileHeader}>
                <Ionicons name="alert-circle" size={ICON_SIZES.md} color={COLORS.error} />
                <Text style={styles.tileTitle}>{t['patientInfo.allergies']}</Text>
              </View>
              {currentPatient.allergies && currentPatient.allergies.length > 0 ? (
                currentPatient.allergies.map((allergy, index) => (
                  <Text key={index} style={styles.infoText}>
                    🚫 {allergy}
                  </Text>
                ))
              ) : (
                <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
              )}
            </Card>
          </TouchableOpacity>

          {/* Key Notes - Tappable */}
          <TouchableOpacity style={styles.infoTile} onPress={() => navigation.navigate('UpdatePatientInfo' as any, { initialTab: 'keynotes' })}>
            <Card style={styles.infoTileCard}>
              <View style={styles.tileHeader}>
                <Ionicons name="information-circle" size={ICON_SIZES.md} color={COLORS.info} />
                <Text style={styles.tileTitle}>{t['patientInfo.keyNotes']}</Text>
              </View>
              {currentPatient.key_notes ? (
                <Text style={styles.infoText}>
                  {currentPatient.key_notes}
                </Text>
              ) : (
                <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
              )}
            </Card>
          </TouchableOpacity>

          {/* Kihon Checklist (Frailty) - Tappable */}
          <TouchableOpacity style={styles.infoTile} onPress={() => navigation.navigate('KihonChecklist')}>
            <Card style={styles.infoTileCard}>
              <View style={styles.tileHeader}>
                <Ionicons name="speedometer" size={ICON_SIZES.md} color={COLORS.primary} />
                <Text style={styles.tileTitle}>{t['action.kihonChecklist']}</Text>
              </View>
              {sessionKihonChecklist ? (
                <>
                  <Text style={styles.infoText}>
                    {language === 'ja' ? 'スコア' : 'Score'}: {sessionKihonChecklist.total_score}/25
                  </Text>
                  <Text style={[
                    styles.infoText,
                    {
                      color: sessionKihonChecklist.frailty_status === 'robust'
                        ? COLORS.success
                        : sessionKihonChecklist.frailty_status === 'prefrail'
                        ? COLORS.warning
                        : COLORS.error,
                      fontWeight: TYPOGRAPHY.fontWeight.semibold,
                    }
                  ]}>
                    {language === 'ja'
                      ? (sessionKihonChecklist.frailty_status === 'robust' ? '健常' :
                         sessionKihonChecklist.frailty_status === 'prefrail' ? 'プレフレイル' : 'フレイル')
                      : (sessionKihonChecklist.frailty_status === 'robust' ? 'Robust' :
                         sessionKihonChecklist.frailty_status === 'prefrail' ? 'Pre-frail' : 'Frail')
                    }
                  </Text>
                  <Text style={styles.tileTimestamp}>
                    {new Date(sessionKihonChecklist.recorded_at).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')}
                  </Text>
                </>
              ) : (
                <Text style={styles.noDataText}>{t['common.noData'] || 'No data'}</Text>
              )}
            </Card>
          </TouchableOpacity>
        </View>

        {/* Main Grid: Schedule (left, 3 rows) + Action Buttons (right, 3×2 grid) */}
        <View style={styles.mainGrid}>
          {/* Left Column: Today's Schedule (wider, takes 3 rows) */}
          {scheduleData && scheduleData.allItems && scheduleData.allItems.length > 0 ? (
            <TouchableOpacity
              style={styles.scheduleColumn}
              onPress={() => navigation.navigate('TodaySchedule')}
              activeOpacity={0.8}
            >
              <Card style={styles.scheduleCard}>
                <View style={styles.scheduleSectionHeader}>
                  <Ionicons name="calendar-outline" size={ICON_SIZES.md} color={COLORS.primary} />
                  <Text style={styles.scheduleSectionTitle}>
                    {language === 'ja' ? '本日の予定' : "Today's Schedule"}
                  </Text>
                  <Text style={styles.scheduleCount}>
                    {scheduleData.summary.completed}/{scheduleData.summary.total}
                  </Text>
                </View>
                <View style={styles.scheduleListGrid}>
                  {scheduleData.allItems.map((item: any) => (
                    <View key={item.id} style={styles.scheduleItemCompact}>
                      <Ionicons
                        name={item.type === 'medication' ? 'medical' : 'calendar'}
                        size={16}
                        color={item.completed ? COLORS.status.success : COLORS.primary}
                      />
                      <Text style={styles.scheduleItemTime}>{item.time?.substring(0, 5)}</Text>
                      <Text style={styles.scheduleItemTitle} numberOfLines={1}>{item.title}</Text>
                      {item.completed && (
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.status.success} />
                      )}
                      {item.isPRN && (
                        <Text style={styles.prnBadgeSmall}>PRN</Text>
                      )}
                    </View>
                  ))}
                </View>
              </Card>
            </TouchableOpacity>
          ) : (
            <View style={styles.scheduleColumn}>
              <Card style={styles.scheduleCard}>
                <View style={styles.scheduleSectionHeader}>
                  <Ionicons name="calendar-outline" size={ICON_SIZES.md} color={COLORS.primary} />
                  <Text style={styles.scheduleSectionTitle}>
                    {language === 'ja' ? '本日の予定' : "Today's Schedule"}
                  </Text>
                </View>
                <Text style={styles.noDataText}>{t['common.noData'] || 'No scheduled items today'}</Text>
              </Card>
            </View>
          )}

          {/* Right Columns: Action Buttons (3 rows × 2 columns) */}
          <View style={styles.actionsColumn}>
            {/* Row 1 */}
            <ActionButton
              icon="document-text-outline"
              label={language === 'ja' ? '看護・医師記録' : 'Clinical Notes'}
              onPress={() => {
                if (!currentPatient) return;
                const displayName = language === 'ja'
                  ? `${currentPatient.family_name || ''} ${currentPatient.given_name || ''}`.trim()
                  : `${currentPatient.family_name_en || ''} ${currentPatient.given_name_en || ''}`.trim();
                navigation.navigate('ClinicalNotes' as any, {
                  patientId: currentPatient.patient_id,
                  patientName: displayName || currentPatient.patient_id
                });
              }}
              status={{ completed: false, borderColor: COLORS.border }}
              iconColor={COLORS.secondary}
            />
            <ActionButton
              icon="clipboard"
              label={t['action.adlRecording']}
              onPress={() => navigation.navigate('ADLVoice')}
              status={getActionStatus('adl')}
            />

            {/* Row 2 */}
            <ActionButton
              icon="medical"
              label={t['action.medicineAdmin']}
              onPress={() => navigation.navigate('MedicineAdmin')}
              status={getActionStatus('medicine')}
            />
            <ActionButton
              icon="nutrition"
              label={language === 'ja' ? '栄養記録' : 'Nutrition'}
              onPress={() => navigation.navigate('ComingSoon', { feature: language === 'ja' ? '栄養記録' : 'Nutrition' })}
              status={{ completed: false, borderColor: COLORS.border }}
            />

            {/* Row 3 */}
            <ActionButton
              icon="document-text"
              label={language === 'ja' ? 'ケアプラン' : 'Care Plan'}
              onPress={() => navigation.navigate('CarePlanHub')}
              status={{ completed: false, borderColor: COLORS.border }}
            />
            <ActionButton
              icon="pencil"
              label={t['action.updatePatientInfo']}
              onPress={() => navigation.navigate('UpdatePatientInfo')}
              status={getActionStatus('patientInfo')}
            />

            {/* Row 4 */}
            <ActionButton
              icon="mic"
              label={language === 'ja' ? '記録' : 'Record'}
              onPress={handleVoiceRecording}
              status={{ completed: false, borderColor: COLORS.border }}
              iconColor={COLORS.error}
            />

            {/* Round Complete Button - Spans 2 columns */}
            <TouchableOpacity
              style={[
                styles.roundCompleteButtonInGrid,
                getActionStatus('review').completed && styles.roundCompleteButtonActive
              ]}
              onPress={() => navigation.navigate('ReviewConfirm')}
            >
              <Text style={[
                styles.roundCompleteButtonText,
                getActionStatus('review').completed && styles.roundCompleteButtonTextActive
              ]}>
                {t['action.roundComplete']}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* BLE Toast Notification */}
      {showToast && bleReading && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
          <View style={styles.toastContent}>
            <View style={styles.toastHeader}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.toastTitle}>
                {language === 'ja' ? 'バイタルデータ追加' : 'Vitals Data Added'}
              </Text>
            </View>

            <View style={styles.toastData}>
              <View style={styles.toastDataRow}>
                <Ionicons name="heart" size={20} color={COLORS.primary} />
                <Text style={styles.toastDataText}>
                  {language === 'ja' ? '血圧' : 'BP'}: {bleReading.systolic}/{bleReading.diastolic} mmHg
                </Text>
              </View>
              <View style={styles.toastDataRow}>
                <Ionicons name="pulse" size={20} color={COLORS.primary} />
                <Text style={styles.toastDataText}>
                  {language === 'ja' ? '脈拍' : 'Pulse'}: {bleReading.pulse} bpm
                </Text>
              </View>
            </View>

            <View style={styles.toastActions}>
              <TouchableOpacity style={styles.toastButton} onPress={handleSubmit}>
                <Ionicons name="checkmark-done" size={20} color={COLORS.white} />
                <Text style={styles.toastButtonText}>
                  {language === 'ja' ? '完了' : 'Submit'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toastButton, styles.toastButtonSecondary]}
                onPress={handleVitalsNavigation}
              >
                <Ionicons name="add-circle" size={20} color={COLORS.primary} />
                <Text style={[styles.toastButtonText, styles.toastButtonTextSecondary]}>
                  {language === 'ja' ? 'バイタル' : 'Vitals'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toastButton, styles.toastButtonDismiss]}
                onPress={handleDismiss}
              >
                <Ionicons name="close" size={20} color={COLORS.text.secondary} />
                <Text style={[styles.toastButtonText, styles.toastButtonTextDismiss]}>
                  {language === 'ja' ? '閉じる' : 'Dismiss'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// Action Button Component with Status Indicators
interface ActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  status: {
    completed: boolean;
    count?: number;
    badge?: string;
    borderColor: string;
  };
  iconColor?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onPress, status, iconColor }) => {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { borderLeftWidth: 4, borderLeftColor: status.borderColor }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={ICON_SIZES.xl} color={iconColor || COLORS.primary} />

      {/* Checkmark overlay */}
      {status.completed && (
        <View style={styles.checkmarkBadge}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
        </View>
      )}

      {/* Count badge */}
      {status.count !== undefined && status.count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{status.count}</Text>
        </View>
      )}

      {/* Special badge (for draft indicator) */}
      {status.badge && (
        <View style={styles.specialBadge}>
          <Text style={styles.specialBadgeText}>{status.badge}</Text>
        </View>
      )}

      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
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
  headerRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  reviewQueueBadge: {
    position: 'relative',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },

  // Top Row Layout - Compressed
  topRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  // Identity Tile (larger, with photo) - Compressed
  identityTile: {
    flex: 2,
    position: 'relative',
  },
  identityContent: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  portraitContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  identityInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  demographicsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    marginBottom: 1,
  },

  // Incident Button - Small, top-right corner
  incidentButtonSmall: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.error,
    width: 60,
    height: 60,
  },
  incidentButtonLabel: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
    marginTop: 2,
    textAlign: 'center',
  },

  // Compact Tiles - Compressed
  compactTile: {
    flex: 1,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tileTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  tileValue: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  tileSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  medScrollView: {
    maxHeight: 80,
    marginTop: SPACING.xs,
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
    paddingRight: SPACING.xs,
  },
  medBullet: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    marginRight: SPACING.xs,
    marginTop: 1,
  },
  medText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.primary,
    lineHeight: 16,
  },

  // Info Row - Compressed
  infoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  infoTile: {
    flex: 1,
    minWidth: 0,
  },
  infoTileCard: {
    flex: 1,
  },
  infoText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  tileTimestamp: {
    fontSize: 10,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  noDataText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
  },

  // Actions Grid - Compressed (3 columns, tighter spacing)
  // Main Grid Layout: Schedule (left) + Actions (right)
  mainGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  scheduleColumn: {
    flex: 0.4,
    minHeight: 300,
  },
  scheduleCard: {
    height: '100%',
  },
  actionsColumn: {
    flex: 0.6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    alignContent: 'flex-start',
  },

  // Legacy actionsGrid (kept for compatibility, but not used in new layout)
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%', // Changed from 32% for 2-column layout
    minHeight: 90,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: SPACING.xs,
  },
  actionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Status Indicators
  checkmarkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  countBadge: {
    position: 'absolute',
    top: 36,
    right: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  specialBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialBadgeText: {
    color: COLORS.surface,
    fontSize: 16,
  },

  // Round Complete Button - Reduced Height, Language-Specific Text
  roundCompleteButton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 55,
    borderWidth: 2,
    borderColor: COLORS.success,
    marginBottom: SPACING.md,
  },
  roundCompleteButtonInGrid: {
    width: '48%', // Single cell in the grid
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  roundCompleteButtonActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  roundCompleteButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  roundCompleteButtonTextActive: {
    color: COLORS.white,
  },
  scheduleSection: {
    marginBottom: SPACING.sm,
  },
  scheduleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  scheduleSectionTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 1,
  },
  scheduleCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
  },
  scheduleList: {
    gap: SPACING.xs,
  },
  scheduleListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  scheduleItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}30`,
    width: '48%', // 2 columns with gap
  },
  scheduleItemTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    width: 40,
  },
  scheduleItemTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    flex: 1,
  },
  prnBadgeSmall: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    fontSize: 10,
    color: COLORS.status.warning,
    backgroundColor: `${COLORS.status.warning}20`,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  scheduleMore: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // BLE Toast Notification Styles
  toastContainer: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: {
    padding: SPACING.md,
  },
  toastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  toastTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
  },
  toastData: {
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
  },
  toastDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  toastDataText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  manualCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  manualCheckboxLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  toastActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toastButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  toastButtonSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  toastButtonDismiss: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toastButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
  toastButtonTextSecondary: {
    color: COLORS.primary,
  },
  toastButtonTextDismiss: {
    color: COLORS.text.secondary,
  },
});
