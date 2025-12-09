import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { socketService } from './src/services';
import { networkService } from './src/services/networkService';
import { sessionPersistenceService } from './src/services/sessionPersistence';
import { useCarePlanStore } from './src/stores/carePlanStore';
import { useAuthStore } from './src/stores/authStore';
import { warmAllCaches, WarmCacheResult } from './src/services/cacheWarmer';
import { COLORS } from './src/constants/theme';

// Auth screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

// Patient screens
import PatientListScreen from './src/screens/PatientListScreen';
import PatientScanScreen from './src/screens/PatientScanScreen';
import PatientInfoScreen from './src/screens/PatientInfoScreen';

// Assessment screens
import VitalsCaptureScreen from './src/screens/VitalsCaptureScreen';
import { VitalsGraphScreen } from './src/screens/VitalsGraphScreen';
import ADLVoiceScreen from './src/screens/ADLVoiceScreen';
import GeneralVoiceRecorderScreen from './src/screens/GeneralVoiceRecorderScreen';
import MedicineAdminScreen from './src/screens/MedicineAdminScreen';
import UpdatePatientInfoScreen from './src/screens/UpdatePatientInfoScreen';
import IncidentReportScreen from './src/screens/IncidentReportScreen';
import ReviewConfirmScreen from './src/screens/ReviewConfirmScreen';
import PainAssessmentScreen from './src/screens/PainAssessmentScreen';
import FallRiskAssessmentScreen from './src/screens/FallRiskAssessmentScreen';
import KihonChecklistScreen from './src/screens/KihonChecklistScreen';

// Care Plan screens
import CarePlanHubScreen from './src/screens/CarePlanHubScreen';
import FullCarePlanViewScreen from './src/screens/FullCarePlanViewScreen';
import CreateCarePlanScreen from './src/screens/CreateCarePlanScreen';
import AddCarePlanItemScreen from './src/screens/AddCarePlanItemScreen';
import QuickProgressUpdateScreen from './src/screens/QuickProgressUpdateScreen';
import MonitoringFormScreen from './src/screens/MonitoringFormScreen';
import WeeklyScheduleScreen from './src/screens/WeeklyScheduleScreen';
import CarePlanHistoryScreen from './src/screens/CarePlanHistoryScreen';
import AllCarePlansScreen from './src/screens/AllCarePlansScreen';

// Utility screens
import ComingSoonScreen from './src/screens/ComingSoonScreen';
import TodayScheduleScreen from './src/screens/TodayScheduleScreen';

// Clinical Notes screens
import ClinicalNotesScreen from './src/screens/ClinicalNotesScreen';
import AddNoteScreen from './src/screens/AddNoteScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  TodaySchedule: undefined;
  PatientList: undefined;
  PatientScan: undefined;
  PatientInfo: undefined;
  VitalsCapture: undefined;
  VitalsGraph: { patientId: string; vitalType?: 'heart_rate' | 'blood_pressure' | 'temperature' | 'spo2' };
  ADLVoice: undefined;
  GeneralVoiceRecorder: undefined;
  MedicineAdmin: undefined;
  UpdatePatientInfo: undefined;
  IncidentReport: undefined;
  PainAssessment: undefined;
  FallRiskAssessment: undefined;
  KihonChecklist: undefined;
  CarePlanHub: undefined;
  FullCarePlanView: undefined;
  CreateCarePlan: undefined;
  AddCarePlanItem: undefined;
  QuickProgressUpdate: undefined;
  MonitoringForm: undefined;
  WeeklySchedule: undefined;
  CarePlanHistory: undefined;
  AllCarePlans: undefined;
  ReviewConfirm: undefined;
  ComingSoon: { feature: string };
  ClinicalNotes: { patientId: string; patientName: string };
  AddNote: { patientId: string; patientName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { isAuthenticated, isLoading, checkAuth, currentUser } = useAuthStore();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Login');
  const [isCacheWarming, setIsCacheWarming] = useState(false);
  const [cacheWarmingProgress, setCacheWarmingProgress] = useState<string>('');
  const [previousAuthState, setPreviousAuthState] = useState(false);

  useEffect(() => {
    // Check authentication status on app launch
    checkAuth();

    // Initialize network monitoring first
    const initializeServices = async () => {
      try {
        // Add timeout to prevent hanging
        await Promise.race([
          networkService.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Network init timeout')), 5000))
        ]);
      } catch (error) {
        console.warn('Network initialization failed or timed out:', error);
        // Continue anyway - app can work offline
      }

      try {
        // Initialize session persistence service
        // Handles auto-save, background persistence, and restoration
        await Promise.race([
          sessionPersistenceService.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Session init timeout')), 3000))
        ]);
      } catch (error) {
        console.warn('Session persistence initialization failed or timed out:', error);
        // Continue anyway
      }

      // Initialize Socket.IO with network-aware connection
      // Will only connect when network is available
      try {
        socketService.initialize();
      } catch (error) {
        console.warn('Socket initialization failed:', error);
      }

      // Load problem templates from backend on app start
      // This ensures templates are available when creating care plans
      try {
        await Promise.race([
          useCarePlanStore.getState().loadProblemTemplates(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Template load timeout')), 5000))
        ]);
      } catch (error) {
        console.error('Failed to load problem templates on app start:', error);
        // App will continue with fallback templates
      }
    };

    initializeServices();

    return () => {
      // Cleanup on app unmount
      socketService.disconnect();
      networkService.cleanup();
      sessionPersistenceService.cleanup();
    };
  }, []);

  // Trigger cache warming when user logs in (authentication state changes from false to true)
  useEffect(() => {
    const performCacheWarming = async () => {
      // Only warm cache when transitioning from unauthenticated to authenticated
      // This handles both fresh login and session restoration
      if (isAuthenticated && !previousAuthState && currentUser && !isLoading) {
        console.log('[App] User authenticated, starting cache warming...');
        setIsCacheWarming(true);
        setCacheWarmingProgress('Preparing offline data...');

        try {
          // Warm all caches for offline operation
          const result: WarmCacheResult = await warmAllCaches(currentUser.userId);

          if (result.success && result.recordCounts) {
            console.log('[App] ✅ Cache warming successful:', result.recordCounts);
            setCacheWarmingProgress(
              `Cached: ${result.recordCounts.patients} patients, ${result.recordCounts.templates} templates`
            );
            
            // Show success message briefly before hiding
            setTimeout(() => {
              setIsCacheWarming(false);
              setCacheWarmingProgress('');
            }, 1500);
          } else {
            console.warn('[App] ⚠️ Cache warming completed with errors:', result.error);
            setCacheWarmingProgress('Cache warming completed with some errors');
            
            // Hide after showing error briefly
            setTimeout(() => {
              setIsCacheWarming(false);
              setCacheWarmingProgress('');
            }, 2000);
          }
        } catch (error: any) {
          console.error('[App] ❌ Cache warming failed:', error);
          setCacheWarmingProgress('Cache warming failed - continuing anyway');
          
          // Hide error after brief display
          // CRITICAL: App continues to work even if cache warming fails
          setTimeout(() => {
            setIsCacheWarming(false);
            setCacheWarmingProgress('');
          }, 2000);
        }
      }

      // Update previous auth state for next comparison
      setPreviousAuthState(isAuthenticated);
    };

    performCacheWarming();
  }, [isAuthenticated, currentUser, isLoading, previousAuthState]);

  // Update initial route based on authentication
  useEffect(() => {
    if (!isLoading) {
      setInitialRoute(isAuthenticated ? 'Dashboard' : 'Login');
    }
  }, [isAuthenticated, isLoading]);

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.white} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            orientation: 'landscape',
            animation: 'slide_from_right',
          }}
        >
          {/* Auth & Home Screens */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'VerbumCare Login' }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'VerbumCare Dashboard' }}
          />
          <Stack.Screen
            name="TodaySchedule"
            component={TodayScheduleScreen}
            options={{ title: "Today's Schedule" }}
          />
          <Stack.Screen
            name="PatientList"
            component={PatientListScreen}
            options={{ title: 'VerbumCare - Patient Selection' }}
          />
          <Stack.Screen
            name="PatientScan"
            component={PatientScanScreen}
            options={{ title: 'Patient Barcode Scan' }}
          />
          <Stack.Screen
            name="PatientInfo"
            component={PatientInfoScreen}
            options={{ title: 'Patient Information' }}
          />
          <Stack.Screen
            name="VitalsCapture"
            component={VitalsCaptureScreen}
            options={{ title: 'Vital Signs' }}
          />
          <Stack.Screen
            name="VitalsGraph"
            component={VitalsGraphScreen}
            options={{ title: 'Vitals History' }}
          />
          <Stack.Screen
            name="ADLVoice"
            component={ADLVoiceScreen}
            options={{ title: 'ADL Voice Recording' }}
          />
          <Stack.Screen
            name="GeneralVoiceRecorder"
            component={GeneralVoiceRecorderScreen}
            options={{ title: 'Voice Recording' }}
          />
          <Stack.Screen
            name="MedicineAdmin"
            component={MedicineAdminScreen}
            options={{ title: 'Medicine Administration' }}
          />
          <Stack.Screen
            name="UpdatePatientInfo"
            component={UpdatePatientInfoScreen}
            options={{ title: 'Update Patient Info' }}
          />
          <Stack.Screen
            name="IncidentReport"
            component={IncidentReportScreen}
            options={{ title: 'Incident Report' }}
          />
          <Stack.Screen
            name="PainAssessment"
            component={PainAssessmentScreen}
            options={{ title: 'Pain Assessment' }}
          />
          <Stack.Screen
            name="FallRiskAssessment"
            component={FallRiskAssessmentScreen}
            options={{ title: 'Fall Risk Assessment' }}
          />
          <Stack.Screen
            name="KihonChecklist"
            component={KihonChecklistScreen}
            options={{ title: 'Kihon Checklist' }}
          />
          <Stack.Screen
            name="CarePlanHub"
            component={CarePlanHubScreen}
            options={{ title: 'Care Plan' }}
          />
          <Stack.Screen
            name="FullCarePlanView"
            component={FullCarePlanViewScreen}
            options={{ title: 'Care Plan Details' }}
          />
          <Stack.Screen
            name="CreateCarePlan"
            component={CreateCarePlanScreen}
            options={{ title: 'Create Care Plan' }}
          />
          <Stack.Screen
            name="AddCarePlanItem"
            component={AddCarePlanItemScreen}
            options={{ title: 'Add Problem/Goal' }}
          />
          <Stack.Screen
            name="QuickProgressUpdate"
            component={QuickProgressUpdateScreen}
            options={{ title: 'Quick Progress Update' }}
          />
          <Stack.Screen
            name="MonitoringForm"
            component={MonitoringFormScreen}
            options={{ title: 'Monitoring Record' }}
          />
          <Stack.Screen
            name="WeeklySchedule"
            component={WeeklyScheduleScreen}
            options={{ title: 'Weekly Schedule' }}
          />
          <Stack.Screen
            name="CarePlanHistory"
            component={CarePlanHistoryScreen}
            options={{ title: 'Care Plan History' }}
          />
          <Stack.Screen
            name="AllCarePlans"
            component={AllCarePlansScreen}
            options={{ title: 'All Care Plans' }}
          />
          <Stack.Screen
            name="ReviewConfirm"
            component={ReviewConfirmScreen}
            options={{
              title: 'Review & Confirm',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="ComingSoon"
            component={ComingSoonScreen}
            options={{ title: 'Coming Soon' }}
          />
          <Stack.Screen
            name="ClinicalNotes"
            component={ClinicalNotesScreen}
            options={{ title: 'Clinical Notes' }}
          />
          <Stack.Screen
            name="AddNote"
            component={AddNoteScreen}
            options={{ title: 'Add Note' }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Cache Warming Overlay - Minimal UI Addition */}
      {isCacheWarming && (
        <View style={styles.cacheWarmingOverlay}>
          <View style={styles.cacheWarmingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.cacheWarmingText}>{cacheWarmingProgress}</Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  cacheWarmingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  cacheWarmingContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  cacheWarmingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
});
