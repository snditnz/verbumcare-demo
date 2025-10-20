import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { socketService } from './src/services';
import { useCarePlanStore } from './src/stores/carePlanStore';
import PatientListScreen from './src/screens/PatientListScreen';
import PatientScanScreen from './src/screens/PatientScanScreen';
import PatientInfoScreen from './src/screens/PatientInfoScreen';
import VitalsCaptureScreen from './src/screens/VitalsCaptureScreen';
import ADLVoiceScreen from './src/screens/ADLVoiceScreen';
import MedicineAdminScreen from './src/screens/MedicineAdminScreen';
import UpdatePatientInfoScreen from './src/screens/UpdatePatientInfoScreen';
import IncidentReportScreen from './src/screens/IncidentReportScreen';
import ReviewConfirmScreen from './src/screens/ReviewConfirmScreen';
import PainAssessmentScreen from './src/screens/PainAssessmentScreen';
import FallRiskAssessmentScreen from './src/screens/FallRiskAssessmentScreen';
import KihonChecklistScreen from './src/screens/KihonChecklistScreen';
import CarePlanHubScreen from './src/screens/CarePlanHubScreen';
import FullCarePlanViewScreen from './src/screens/FullCarePlanViewScreen';
import CreateCarePlanScreen from './src/screens/CreateCarePlanScreen';
import AddCarePlanItemScreen from './src/screens/AddCarePlanItemScreen';
import QuickProgressUpdateScreen from './src/screens/QuickProgressUpdateScreen';
import MonitoringFormScreen from './src/screens/MonitoringFormScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';

export type RootStackParamList = {
  PatientList: undefined;
  PatientScan: undefined;
  PatientInfo: undefined;
  VitalsCapture: undefined;
  ADLVoice: undefined;
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
  ReviewConfirm: undefined;
  ComingSoon: { feature: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Connect Socket.IO on app launch for real-time voice processing updates
    socketService.connect();

    // Load problem templates from backend on app start
    // This ensures templates are available when creating care plans
    const loadTemplates = async () => {
      try {
        await useCarePlanStore.getState().loadProblemTemplates();
      } catch (error) {
        console.error('Failed to load problem templates on app start:', error);
        // App will continue with fallback templates
      }
    };
    loadTemplates();

    return () => {
      // Cleanup Socket.IO connection when app unmounts
      socketService.disconnect();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="PatientList"
          screenOptions={{
            headerShown: false,
            orientation: 'landscape',
            animation: 'slide_from_right',
          }}
        >
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
