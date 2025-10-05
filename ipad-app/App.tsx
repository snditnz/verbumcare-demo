import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { socketService } from '@services';
import {
  PatientListScreen,
  PatientScanScreen,
  VitalsCaptureScreen,
  ADLVoiceScreen,
  IncidentReportScreen,
  ReviewConfirmScreen,
} from '@screens';

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
            headerShown: false, // Custom headers in each screen
            orientation: 'landscape', // iPad landscape only
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="PatientList"
            component={PatientListScreen}
            options={{
              title: 'VerbumCare - Patient Selection',
            }}
          />

          <Stack.Screen
            name="PatientScan"
            component={PatientScanScreen}
            options={{
              title: 'Patient Barcode Scan',
            }}
          />

          <Stack.Screen
            name="VitalsCapture"
            component={VitalsCaptureScreen}
            options={{
              title: 'Vital Signs',
            }}
          />

          <Stack.Screen
            name="ADLVoice"
            component={ADLVoiceScreen}
            options={{
              title: 'ADL Voice Recording',
            }}
          />

          <Stack.Screen
            name="IncidentReport"
            component={IncidentReportScreen}
            options={{
              title: 'Incident Report',
            }}
          />

          <Stack.Screen
            name="ReviewConfirm"
            component={ReviewConfirmScreen}
            options={{
              title: 'Review & Confirm',
              gestureEnabled: false, // Prevent swipe back from final screen
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
