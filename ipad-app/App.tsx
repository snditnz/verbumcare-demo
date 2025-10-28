import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { socketService } from './src/services';
import { networkService } from './src/services/networkService';
import { useCarePlanStore } from './src/stores/carePlanStore';
import { useAuthStore } from './src/stores/authStore';
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

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  TodaySchedule: undefined;
  PatientList: undefined;
  PatientScan: undefined;
  PatientInfo: undefined;
  VitalsCapture: undefined;
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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Login');

  useEffect(() => {
    // Check authentication status on app launch
    checkAuth();

    // Initialize network monitoring first
    const initializeServices = async () => {
      await networkService.initialize();

      // Initialize Socket.IO with network-aware connection
      // Will only connect when network is available
      socketService.initialize();

      // Load problem templates from backend on app start
      // This ensures templates are available when creating care plans
      try {
        await useCarePlanStore.getState().loadProblemTemplates();
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
    };
  }, []);

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
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
