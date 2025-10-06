import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { socketService } from './src/services';
import PatientListScreen from './src/screens/PatientListScreen';
import PatientScanScreen from './src/screens/PatientScanScreen';
import VitalsCaptureScreen from './src/screens/VitalsCaptureScreen';
import ADLVoiceScreen from './src/screens/ADLVoiceScreen';
import IncidentReportScreen from './src/screens/IncidentReportScreen';
import ReviewConfirmScreen from './src/screens/ReviewConfirmScreen';

export type RootStackParamList = {
  PatientList: undefined;
  PatientScan: undefined;
  VitalsCapture: undefined;
  ADLVoice: undefined;
  IncidentReport: undefined;
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
            name="IncidentReport"
            component={IncidentReportScreen}
            options={{ title: 'Incident Report' }}
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
