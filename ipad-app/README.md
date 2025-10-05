# VerbumCare iPad App

React Native Expo app for aged care assessment demos, connecting to VerbumCare Nagare backend.

## ✅ Completed Setup

### Project Configuration
- ✅ Expo SDK 52 with TypeScript
- ✅ React Navigation setup
- ✅ Development client configuration (eas.json)
- ✅ Path aliases configured (@screens, @components, @services, etc.)
- ✅ iOS iPad-specific permissions (BLE, Camera, Microphone)
- ✅ Landscape orientation enforced

### Dependencies Installed
```json
- expo-router, expo-camera, expo-barcode-scanner, expo-av
- react-native-ble-plx (A&D BP monitor)
- @shopify/react-native-skia (photo annotation)
- socket.io-client (real-time updates)
- zustand (state management)
- @tanstack/react-query (API calls)
- react-native-paper (UI components)
```

### Core Infrastructure

#### Types (`src/types/`)
- ✅ `api.ts` - Backend API types matching our server
- ✅ `app.ts` - App-specific types (workflow, session, etc.)
- ✅ `ble.ts` - BLE device types and A&D UA-656BLE constants

#### Constants (`src/constants/`)
- ✅ `config.ts` - API URLs, BLE settings, UI colors
- ✅ `demoPatients.ts` - 5 Japanese aged care residents
- ✅ `translations.ts` - Full Japanese/English translations

#### Services (`src/services/`)
- ✅ `api.ts` - Axios HTTP client with backend integration
- ✅ `socket.ts` - Socket.IO real-time event handling
- ✅ `ble.ts` - A&D UA-656BLE blood pressure monitor integration
- ✅ `voice.ts` - Audio recording with Expo AV

#### State Management (`src/stores/`)
- ✅ `assessmentStore.ts` - Zustand store for workflow state

## 📋 Remaining Work

### 1. Install Dependencies
```bash
cd ipad-app
npm install
```

### 2. Create Components (`src/components/`)

#### Required Components:
```typescript
// src/components/WorkflowProgress.tsx
- Shows current step in workflow
- Progress indicator with step names
- Props: currentStep, totalSteps

// src/components/PatientCard.tsx  
- Display patient info with status color
- Risk factors badges
- Large touch target (min 48x48)

// src/components/VitalsDisplay.tsx
- Show BP readings in real-time
- Systolic/Diastolic/Pulse with units
- Color-coded alerts

// src/components/LanguageToggle.tsx
- JA/EN switch button in header
- Updates Zustand store language

// src/components/BLEStatusIndicator.tsx
- Visual BLE connection status
- Scanning/Connecting/Connected states

// src/components/VoiceRecorder.tsx
- Record button with timer
- Waveform visualization
- Max 60s duration enforcement
```

### 3. Create Screens (`src/screens/`)

#### PatientListScreen
```typescript
// src/screens/PatientListScreen.tsx
- Display DEMO_PATIENTS in cards
- OnPress: setCurrentPatient() → navigate to patient-scan
- Header: LanguageToggle + WorkflowProgress
- Show patient status colors (green/yellow/red)
```

#### PatientScanScreen
```typescript
// src/screens/PatientScanScreen.tsx
- BarCodeScanner to scan PAT-P001 format
- OnScan: verify barcode via API → navigate to vitals
- Manual skip button (demo mode)
- Show scanned patient name for confirmation
```

#### VitalsCaptureScreen
```typescript
// src/screens/VitalsCaptureScreen.tsx
- Auto-connect to A&D UA-656BLE on mount
- Display BLE status (BLEStatusIndicator)
- Show live BP readings (VitalsDisplay)
- "Continue" button → save vitals to store → next step
- Retry connection button if failed
```

#### ADLVoiceScreen
```typescript
// src/screens/ADLVoiceScreen.tsx
- VoiceRecorder component
- Instructions: "60秒以内でADL状況を記録"
- OnStop: upload via apiService.uploadVoiceRecording()
- OnUpload: call apiService.processVoiceRecording()
- Show processing state, navigate to review when done
```

#### IncidentReportScreen (Optional)
```typescript
// src/screens/IncidentReportScreen.tsx
- Camera to take photos
- Skia canvas for annotations (circles, arrows, text)
- Save to incidentPhotos array in store
- Skip button to go directly to review
```

#### ReviewConfirmScreen
```typescript
// src/screens/ReviewConfirmScreen.tsx
- Display patient info (PatientCard)
- Display vitals (VitalsDisplay)
- Display ADL data when processed
- Listen to Socket.IO for voice-processing-progress
- Show processing spinner during AI extraction
- Submit button → resetAssessment() → navigate home
```

### 4. Create Navigation (`App.tsx`)

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { socketService } from '@services';
import { useEffect } from 'react';

// Import all screens
import PatientListScreen from '@screens/PatientListScreen';
import PatientScanScreen from '@screens/PatientScanScreen';
import VitalsCaptureScreen from '@screens/VitalsCaptureScreen';
import ADLVoiceScreen from '@screens/ADLVoiceScreen';
import IncidentReportScreen from '@screens/IncidentReportScreen';
import ReviewConfirmScreen from '@screens/ReviewConfirmScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // Connect Socket.IO on app launch
    socketService.connect();
    
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="PatientList"
        screenOptions={{
          headerShown: true,
          orientation: 'landscape',
        }}
      >
        <Stack.Screen name="PatientList" component={PatientListScreen} />
        <Stack.Screen name="PatientScan" component={PatientScanScreen} />
        <Stack.Screen name="VitalsCapture" component={VitalsCaptureScreen} />
        <Stack.Screen name="ADLVoice" component={ADLVoiceScreen} />
        <Stack.Screen name="IncidentReport" component={IncidentReportScreen} />
        <Stack.Screen name="ReviewConfirm" component={ReviewConfirmScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### 5. Socket.IO Integration Example

```typescript
// In ReviewConfirmScreen
import { useEffect } from 'react';
import { socketService } from '@services';
import { useAssessmentStore } from '@stores/assessmentStore';

const ReviewConfirmScreen = () => {
  const { adlRecordingId, setADLProcessedData, language } = useAssessmentStore();
  
  useEffect(() => {
    const handleVoiceProgress = (data: VoiceProcessingProgress) => {
      if (data.recording_id === adlRecordingId) {
        if (data.status === 'completed' && data.data) {
          // Get data in user's language
          const structuredData = data.data.structured_data[language];
          setADLProcessedData(structuredData);
        }
      }
    };

    socketService.on('voice-processing-progress', handleVoiceProgress);

    return () => {
      socketService.off('voice-processing-progress', handleVoiceProgress);
    };
  }, [adlRecordingId, language]);

  // ... rest of component
};
```

### 6. BLE Integration Example

```typescript
// In VitalsCaptureScreen
import { useEffect, useState } from 'react';
import { bleService } from '@services';
import { BPReading, BLEConnectionStatus } from '@types/ble';

const VitalsCaptureScreen = () => {
  const [status, setStatus] = useState<BLEConnectionStatus>('disconnected');
  const [reading, setReading] = useState<BPReading | null>(null);

  useEffect(() => {
    bleService.setStatusCallback(setStatus);
    bleService.setReadingCallback(setReading);
    
    const connect = async () => {
      const hasPermission = await bleService.requestPermissions();
      if (hasPermission) {
        await bleService.startScan();
      }
    };
    
    connect();

    return () => {
      bleService.disconnect();
    };
  }, []);

  // ... rest of component
};
```

## 🚀 Build & Run

### Development Build
```bash
# Install dependencies
npm install

# Prebuild native modules
npm run prebuild

# Build development client for iOS
eas build --platform ios --profile development

# Or build for simulator
eas build --platform ios --profile development --local

# Start dev server
npm start --dev-client
```

### Testing Workflow
1. Launch app on iPad
2. Select patient from list (山田花子)
3. Scan barcode (or skip in demo)
4. Connect to A&D UA-656BLE BP monitor
5. Take BP reading
6. Record 30-60s Japanese voice note about ADL
7. Wait for AI processing (~60s)
8. Review all data on final screen
9. Submit assessment

## 🔧 Configuration

### Backend Connection
- Default: `https://verbumcare-lab.local`
- Fallback: `https://192.168.0.208`
- Auto-retry on mDNS failure

### Demo Data
- 5 patients in `DEMO_PATIENTS` constant
- Staff ID: `550e8400-e29b-41d4-a716-446655440101`
- Facility ID: `550e8400-e29b-41d4-a716-446655440001`

### BLE Device
- A&D UA-656BLE Blood Pressure Monitor
- Service UUID: `233BF000-5A34-1B6D-975C-000D5690ABE4`
- BP Characteristic: `233BF001-5A34-1B6D-975C-000D5690ABE4`

## 📱 UI Guidelines

- Landscape orientation only (iPad Pro 11")
- Minimum touch target: 48x48 points
- Japanese-first with EN toggle
- Material Design 3 colors
- Status colors: 🟢 Green, 🟡 Yellow, 🔴 Red
- Large, clear text for standing use
- Card-based layouts with 12px border radius

## 🐛 Debugging

```bash
# View logs
npx react-native log-ios

# Check BLE
# Go to VitalsCaptureScreen → check console for scan results

# Check Socket.IO
# ReviewConfirmScreen → should show "Socket connected: {id}"

# Check API
# PatientListScreen → should load 5 demo patients
```

## 📝 Next Steps

1. ✅ Project structure created
2. ✅ Dependencies configured
3. ✅ Services implemented
4. ✅ State management ready
5. ⏳ Create components (6 files)
6. ⏳ Create screens (6 files)
7. ⏳ Wire up navigation in App.tsx
8. ⏳ Test full workflow end-to-end
9. ⏳ Build development client
10. ⏳ Deploy to iPad for demo

## 🎯 Critical Features Checklist

- [ ] BLE auto-connect with retry logic
- [ ] Voice recording with 60s limit
- [ ] Socket.IO real-time progress updates
- [ ] Bilingual data display (ja/en toggle)
- [ ] Workflow navigation with progress indicator
- [ ] Patient barcode scanning
- [ ] Session persistence if app backgrounded

---

**Target Demo Duration**: 3-5 minutes total
**Processing Time**: ~60 seconds for voice AI extraction
**Network**: Same WiFi as server (192.168.0.x)
