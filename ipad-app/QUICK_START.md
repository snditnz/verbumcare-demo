# VerbumCare iPad App - Quick Start Guide

## 🎉 What's Been Built

### ✅ Complete Foundation (1,072 lines of production code)

**14 TypeScript files** covering:
- Type definitions for all API responses and app state
- Configuration constants and demo data
- Full-featured API, Socket.IO, BLE, and Voice services  
- Zustand state management store
- Japanese/English translations

### 🏗️ Architecture

```
📱 iPad App (Landscape, React Native)
    ↓
📡 Services Layer
    ├── API Service (Axios) → https://verbumcare-lab.local/api
    ├── Socket.IO → Real-time voice processing updates
    ├── BLE Service → A&D UA-656BLE BP Monitor
    └── Voice Service → Expo AV (m4a recording)
    ↓
🗃️ State Management (Zustand)
    └── Assessment workflow state
    ↓
🎨 UI Layer (NEEDS IMPLEMENTATION)
    ├── 6 Components (WorkflowProgress, PatientCard, etc.)
    └── 6 Screens (PatientList → Review workflow)
```

## 🚀 Next Steps (4-6 hours)

### 1. Install Dependencies (5 min)
```bash
cd ipad-app
npm install
```

### 2. Create Components (2 hours)

#### Priority Order:
1. **LanguageToggle.tsx** (30 min) - JA/EN switch
2. **PatientCard.tsx** (30 min) - Display patient info
3. **WorkflowProgress.tsx** (30 min) - Step indicator
4. **BLEStatusIndicator.tsx** (20 min) - Connection status
5. **VitalsDisplay.tsx** (30 min) - Show BP readings
6. **VoiceRecorder.tsx** (40 min) - Record UI with timer

### 3. Create Screens (2-3 hours)

#### Workflow Order:
1. **PatientListScreen.tsx** (30 min)
   ```typescript
   import { DEMO_PATIENTS } from '@constants';
   // Map patients to PatientCard components
   // OnPress → setCurrentPatient() → navigate
   ```

2. **PatientScanScreen.tsx** (30 min)
   ```typescript
   import { BarCodeScanner } from 'expo-barcode-scanner';
   // Scan PAT-P001 → verify via API → navigate
   ```

3. **VitalsCaptureScreen.tsx** (45 min)
   ```typescript
   import { bleService } from '@services';
   // Auto-connect on mount → show readings → save
   ```

4. **ADLVoiceScreen.tsx** (45 min)
   ```typescript
   import { voiceService, apiService } from '@services';
   // Record → upload → process → navigate
   ```

5. **ReviewConfirmScreen.tsx** (60 min)
   ```typescript
   import { socketService } from '@services';
   // Listen for voice-processing-progress
   // Display results when complete
   ```

6. **IncidentReportScreen.tsx** (30 min - optional)
   ```typescript
   // Skip button → ReviewConfirm for demo
   ```

### 4. Wire Navigation (30 min)

**App.tsx:**
```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { socketService } from '@services';

// Import all screens...

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="PatientList">
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

### 5. Build & Test (30 min)

```bash
# Prebuild native modules
npm run prebuild

# Build development client
eas build --platform ios --profile development

# Or for simulator
eas build --platform ios --profile development --local

# Start dev server
npm start --dev-client
```

## 📋 Demo Workflow (3-5 minutes)

1. **Select Patient** → Tap 山田花子 (82yo, dementia)
2. **Scan Barcode** → Scan PAT-P001 (or skip)
3. **Connect BLE** → A&D UA-656BLE auto-connects
4. **Take BP** → 140/90, pulse 78
5. **Record Voice** → 30-60s Japanese ADL assessment
6. **Wait for AI** → 60s processing (Socket.IO updates)
7. **Review Data** → All info displayed
8. **Submit** → Assessment complete

## 🔑 Key Integration Points

### API Calls
```typescript
import { apiService } from '@services';

// Get patients
const patients = await apiService.getPatients();

// Upload voice
const result = await apiService.uploadVoiceRecording(uri, patientId, staffId);

// Start processing
await apiService.processVoiceRecording(result.recording_id);
```

### Socket.IO Events
```typescript
import { socketService } from '@services';

socketService.on('voice-processing-progress', (data) => {
  console.log('Phase:', data.phase); // transcription, extraction, translation
  console.log('Progress:', data.progress); // 0-100
  
  if (data.status === 'completed') {
    const structured = data.data.structured_data[language]; // ja or en
    // Display results
  }
});
```

### BLE Connection
```typescript
import { bleService } from '@services';

bleService.setStatusCallback((status) => {
  // 'scanning', 'connecting', 'connected', 'disconnected', 'error'
});

bleService.setReadingCallback((reading) => {
  // { systolic: 140, diastolic: 90, pulse: 78, timestamp: Date }
});

await bleService.startScan();
```

### State Management
```typescript
import { useAssessmentStore } from '@stores/assessmentStore';

const {
  currentPatient,
  setCurrentPatient,
  vitals,
  setVitals,
  language,
  setLanguage,
  nextStep,
} = useAssessmentStore();
```

## 🎨 UI Guidelines

- **Orientation**: Landscape only (iPad Pro 11")
- **Touch Targets**: Minimum 48x48 points
- **Colors**: 
  - Primary: #667eea
  - Success: #4CAF50
  - Warning: #FFA726
  - Error: #EF5350
- **Status Colors**:
  - 🟢 Green: No issues
  - 🟡 Yellow: Pending meds
  - 🔴 Red: Vital alerts
- **Language**: Japanese-first, EN toggle in header
- **Layout**: Cards with 12px radius, 16px padding

## 🐛 Troubleshooting

### BLE Not Connecting
- Check Bluetooth is ON
- A&D device is powered and in pairing mode
- Check console for: `Found A&D BP monitor: UA-656BLE`

### Socket.IO Not Working
- Check server is running: `https://verbumcare-lab.local/health`
- Check console: `Socket.IO connected: {id}`
- Verify same WiFi network

### Voice Upload Failing
- Check microphone permission granted
- Check file size < 50MB
- Verify backend endpoint: `/api/voice/upload`

## 📚 Resources

- **Backend API Docs**: See backend/README.md
- **Component Examples**: See README.md
- **Type Definitions**: See src/types/
- **Demo Data**: src/constants/demoPatients.ts
- **Translations**: src/constants/translations.ts

## ✅ Checklist

- [ ] npm install completed
- [ ] 6 components created
- [ ] 6 screens created
- [ ] App.tsx navigation wired
- [ ] BLE permissions working
- [ ] Camera/Mic permissions working
- [ ] Backend connection verified
- [ ] Socket.IO events flowing
- [ ] Full workflow tested
- [ ] Built development client
- [ ] Deployed to iPad

---

**Current Status**: ~60% complete
**Remaining Work**: UI layer (components + screens)
**Time Estimate**: 4-6 hours
**Ready to build!** 🚀
