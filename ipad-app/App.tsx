import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { socketService } from './src/services';
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
  ReviewConfirm: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Connect Socket.IO on app launch for real-time voice processing updates
    socketService.connect();

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
            name="ReviewConfirm"
            component={ReviewConfirmScreen}
            options={{
              title: 'Review & Confirm',
              gestureEnabled: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
