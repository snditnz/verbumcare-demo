# Implementation Plan: Live Audio Streaming Integration

## Overview

This implementation plan integrates `react-native-live-audio-stream` into VerbumCare to enable true real-time audio streaming. The plan follows a phased approach: first adding the native module and wrapper service, then integrating with existing streaming infrastructure, and finally updating the UI components.

## Tasks

- [x] 1. Add native module dependency and configuration
  - [x] 1.1 Install react-native-live-audio-stream package
    - Run `npm install react-native-live-audio-stream`
    - Verify package is added to package.json
    - _Requirements: 7.1, 7.2_
    - _File: ipad-app/package.json_

  - [x] 1.2 Configure iOS native project
    - Run `cd ios && pod install` to install native dependencies
    - Verify NSMicrophoneUsageDescription is in Info.plist (should already exist)
    - _Requirements: 7.3_
    - _File: ipad-app/ios/Podfile.lock_

  - [x] 1.3 Configure Android native project
    - Verify RECORD_AUDIO permission in AndroidManifest.xml (should already exist)
    - _Requirements: 7.4_
    - _File: ipad-app/android/app/src/main/AndroidManifest.xml_

- [x] 2. Create LiveAudioService wrapper
  - [x] 2.1 Implement LiveAudioService with native module wrapper
    - Create service that wraps react-native-live-audio-stream
    - Implement isAvailable() to check if native module exists
    - Implement init(), start(), stop() lifecycle methods
    - Implement onData() and onError() event handlers
    - Add sequence numbering and timestamp tracking
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.2, 2.3_
    - _File: ipad-app/src/services/liveAudioService.ts_

  - [x] 2.2 Write property test for base64 round-trip
    - **Property 1: Base64 Audio Data Round-Trip**
    - **Validates: Requirements 1.3, 2.1**
    - _File: ipad-app/src/services/__tests__/liveAudioService.base64.property.test.ts_

  - [x] 2.3 Write property test for chunk metadata completeness
    - **Property 2: Chunk Metadata Completeness**
    - **Validates: Requirements 2.2, 2.3**
    - _File: ipad-app/src/services/__tests__/liveAudioService.metadata.property.test.ts_

  - [x] 2.4 Write property test for stop releases resources
    - **Property 3: Stop Releases Resources**
    - **Validates: Requirements 1.5**
    - _File: ipad-app/src/services/__tests__/liveAudioService.lifecycle.property.test.ts_

- [x] 3. Implement RecordingModeSelector
  - [x] 3.1 Create RecordingModeSelector service
    - Implement selectMode() to determine best recording mode
    - Check streaming settings, network status, module availability
    - Return 'live-streaming', 'fallback-upload', or 'offline-queue'
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
    - _File: ipad-app/src/services/recordingModeSelector.ts_

  - [x] 3.2 Write property test for mode selection based on settings
    - **Property 4: Mode Selection Based on Settings**
    - **Validates: Requirements 3.1, 3.4**
    - _File: ipad-app/src/services/__tests__/recordingModeSelector.settings.property.test.ts_

  - [x] 3.3 Write property test for network-based fallback
    - **Property 5: Network-Based Fallback**
    - **Validates: Requirements 3.3**
    - _File: ipad-app/src/services/__tests__/recordingModeSelector.network.property.test.ts_

- [x] 4. Checkpoint - Ensure core services tests pass
  - All 56 property tests pass
  - LiveAudioService can be imported (module availability check)
  - RecordingModeSelector correctly selects modes

- [x] 5. Integrate with AudioStreamerService
  - [x] 5.1 Add live audio chunk handling to AudioStreamerService
    - Add sendLiveChunk() method to accept AudioDataEvent
    - Decode base64 to ArrayBuffer for transmission
    - Include format metadata in transmitted chunks
    - _Requirements: 6.1, 2.1_
    - _File: ipad-app/src/services/audioStreamerService.ts_

  - [x] 5.2 Add audio source selection to AudioStreamerService
    - Add setAudioSource() method for 'live' or 'fallback' modes
    - Track current audio source in service state
    - _Requirements: 3.5_
    - _File: ipad-app/src/services/audioStreamerService.ts_

  - [x] 5.3 Write property test for concurrent recording prevention
    - **Property 6: Concurrent Recording Prevention**
    - **Validates: Requirements 5.5**
    - _File: ipad-app/src/services/__tests__/liveAudioService.concurrent.property.test.ts_

- [x] 6. Implement error handling and recovery
  - [x] 6.1 Add error recovery logic to LiveAudioService
    - Implement attemptRecovery() for different error types
    - Add preserveAudioData() to save chunks on error
    - Implement silent fallback when module unavailable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
    - _File: ipad-app/src/services/liveAudioService.ts_

  - [x] 6.2 Write property test for error handling with data preservation
    - **Property 7: Error Handling with Data Preservation**
    - **Validates: Requirements 5.4, 8.2, 8.4, 8.5**
    - _File: ipad-app/src/services/__tests__/liveAudioService.errorHandling.property.test.ts_

- [x] 7. Update VoiceRecorder component
  - [x] 7.1 Integrate LiveAudioService into VoiceRecorder
    - Import and use RecordingModeSelector to choose mode
    - Use LiveAudioService for live-streaming mode
    - Use existing VoiceService for fallback mode
    - Wire up data events to AudioStreamerService
    - _Requirements: 1.2, 1.3, 1.4, 3.1, 3.2_
    - _File: ipad-app/src/components/VoiceRecorder.tsx_

  - [x] 7.2 Add streaming mode indicator to VoiceRecorder
    - Show "Streaming" indicator when using live mode
    - Show "Recording" indicator when using fallback mode
    - Display connection status during streaming
    - _Requirements: 7.1, 7.2, 7.3_
    - _File: ipad-app/src/components/VoiceRecorder.tsx_

- [x] 8. Update GeneralVoiceRecorderScreen
  - [x] 8.1 Integrate new recording flow into GeneralVoiceRecorderScreen
    - Use RecordingModeSelector to determine mode
    - Handle live streaming with progressive transcription
    - Handle fallback mode with existing upload flow
    - _Requirements: 3.1, 3.2, 6.1, 6.3_
    - _File: ipad-app/src/screens/GeneralVoiceRecorderScreen.tsx_

  - [x] 8.2 Write property test for fallback mode equivalence
    - **Property 8: Fallback Mode Equivalence**
    - **Validates: Requirements 10.2, 10.3**
    - _File: ipad-app/src/screens/__tests__/GeneralVoiceRecorderScreen.fallback.property.test.ts_

- [x] 9. Add streaming settings
  - [x] 9.1 Add streaming configuration to settings store
    - Add enableStreaming boolean setting
    - Add showProgressiveTranscript setting
    - Add audioConfig settings (sampleRate, channels, etc.)
    - Default enableStreaming to true
    - _Requirements: 3.1, 3.4, 9.1, 9.2, 9.3, 9.4_
    - _File: ipad-app/src/stores/settingsStore.ts_

  - [x] 9.2 Add streaming toggle to Settings screen
    - Add toggle for enabling/disabling streaming mode
    - Add toggle for progressive transcript display
    - Show current mode status
    - _Requirements: 3.4, 11.2_
    - _File: ipad-app/src/screens/SettingsScreen.tsx_

- [x] 10. Checkpoint - Ensure all tests pass
  - Run all property tests
  - Verify streaming mode selection works correctly
  - Verify fallback mode works when streaming disabled
  - Ask the user if questions arise

- [-] 11. Native rebuild and device testing
  - [x] 11.1 Rebuild iOS app with native module
    - Run `npx expo prebuild --clean`
    - Run `cd ios && pod install`
    - Run `npx expo run:ios --device`
    - Verify app launches and native module is available
    - _Requirements: 7.1, 7.3, 7.5_

  - [x] 11.2 Test live streaming on device
    - Start a recording with streaming enabled
    - **DUAL-MODE IMPLEMENTED**: Local backup always active + streaming when connected
    - **UI UPDATES**: Shows "● Streaming + Backup" when connected, "○ Disconnected (Backup Active)" when not
    - **TOGGLE COLOR**: Settings toggle now shows green when enabled
    - **TIMING FIX APPLIED**: Client now waits for `stream:complete` before disconnecting
    - **CATEGORIZATION FIX APPLIED**: Fixed `categorizeAndExtract` to use correct API (`detectCategories` + `extractDataForCategory`)
    - Verify audio chunks are being transmitted ✅
    - Verify progressive transcription appears ✅
    - Verify recording completes successfully (uses streaming result if successful, local backup otherwise) ✅
    - _Requirements: 1.2, 1.3, 1.4, 2.1_

  - [ ] 11.3 Test fallback mode on device
    - Disable streaming in settings
    - Start a recording
    - Verify expo-av recording works
    - Verify upload-after-recording flow works
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 12. Final checkpoint - Complete integration testing
  - Test streaming mode end-to-end
  - Test fallback mode end-to-end
  - Test offline mode with queue
  - Test error recovery scenarios
  - Verify all property tests pass
  - Ask the user if questions arise

## Notes

- All tasks including property-based tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check for comprehensive input coverage
- Native rebuild is required after adding react-native-live-audio-stream
- The implementation preserves backward compatibility with existing expo-av workflow
- TypeScript is used for all new code in the iPad app
