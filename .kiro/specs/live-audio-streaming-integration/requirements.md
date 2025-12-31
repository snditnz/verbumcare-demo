# Requirements Document - Live Audio Streaming Integration

## Introduction

This feature integrates `react-native-live-audio-stream` into VerbumCare to enable true real-time audio streaming during voice recording. Currently, the app uses `expo-av` which records to a file and doesn't provide real-time access to audio chunks. This integration will enable audio data to be streamed to the backend as it's captured, enabling progressive transcription with minimal latency.

## Glossary

- **VerbumCare_System**: The healthcare documentation platform
- **Live_Audio_Stream**: The native module that captures audio and emits real-time data events
- **Audio_Chunk**: A segment of base64-encoded audio data emitted during recording
- **Audio_Streamer_Service**: The existing service that manages WebSocket streaming sessions
- **Voice_Service**: The existing service that manages audio recording using expo-av
- **Streaming_Mode**: Recording mode where audio is streamed in real-time to the backend
- **Fallback_Mode**: Recording mode using expo-av when streaming is unavailable or disabled
- **Native_Rebuild**: The process of rebuilding the iOS/Android native app to include new native modules

## Requirements

### Requirement 1: Live Audio Capture Integration

**User Story:** As a nurse, I want my voice to be captured and streamed in real-time, so that transcription can begin immediately without waiting for the recording to finish.

#### Acceptance Criteria

1. WHEN the app is built THEN the VerbumCare_System SHALL include the react-native-live-audio-stream native module
2. WHEN a user starts a streaming recording THEN the Live_Audio_Stream SHALL initialize with healthcare-optimized settings (32kHz sample rate, mono channel, 16-bit depth)
3. WHEN audio is being captured THEN the Live_Audio_Stream SHALL emit data events containing base64-encoded audio chunks
4. WHEN audio chunks are emitted THEN the Audio_Streamer_Service SHALL receive them within 100ms of capture
5. WHEN the user stops recording THEN the Live_Audio_Stream SHALL stop emitting data events and release audio resources
6. WHEN the app goes to background during recording THEN the Live_Audio_Stream SHALL continue capturing audio

### Requirement 2: Audio Chunk Processing

**User Story:** As a developer, I want audio chunks to be properly formatted and sequenced, so that the backend can reconstruct and transcribe the audio accurately.

#### Acceptance Criteria

1. WHEN an audio chunk is received THEN the Audio_Streamer_Service SHALL decode it from base64 to binary format
2. WHEN audio chunks are transmitted THEN the Audio_Streamer_Service SHALL include sequence numbers for ordering
3. WHEN audio chunks are transmitted THEN the Audio_Streamer_Service SHALL include timestamps for synchronization
4. WHEN the audio format is configured THEN the VerbumCare_System SHALL use settings compatible with Whisper (16kHz or 32kHz, mono, 16-bit PCM)
5. WHEN chunk size is configured THEN the VerbumCare_System SHALL use a buffer size that balances latency and efficiency (4096 samples recommended)

### Requirement 3: Streaming Mode Selection

**User Story:** As a nurse, I want the app to automatically choose the best recording mode, so that I always get the optimal experience based on my situation.

#### Acceptance Criteria

1. WHEN the user has streaming enabled in settings THEN the VerbumCare_System SHALL attempt to use Live_Audio_Stream
2. WHEN Live_Audio_Stream is unavailable THEN the VerbumCare_System SHALL fall back to expo-av recording
3. WHEN network is unavailable at recording start THEN the VerbumCare_System SHALL use Fallback_Mode with offline queue
4. WHEN the user disables streaming in settings THEN the VerbumCare_System SHALL use Fallback_Mode exclusively
5. WHEN switching between modes THEN the VerbumCare_System SHALL maintain consistent user experience and data handling

### Requirement 4: Microphone Permission Handling

**User Story:** As a user, I want clear permission requests for microphone access, so that I understand why the app needs this permission.

#### Acceptance Criteria

1. WHEN the app first attempts to record THEN the VerbumCare_System SHALL request microphone permission with a clear explanation
2. WHEN microphone permission is denied THEN the VerbumCare_System SHALL display a helpful message explaining how to enable it
3. WHEN microphone permission is granted THEN the VerbumCare_System SHALL proceed with recording without additional prompts
4. WHEN checking permissions THEN the VerbumCare_System SHALL use the existing permission flow from Voice_Service

### Requirement 5: Resource Management

**User Story:** As a system administrator, I want audio resources to be properly managed, so that the app doesn't drain battery or cause memory issues.

#### Acceptance Criteria

1. WHEN recording starts THEN the Live_Audio_Stream SHALL acquire audio resources exclusively
2. WHEN recording stops THEN the Live_Audio_Stream SHALL release all audio resources within 1 second
3. WHEN the app is terminated during recording THEN the Live_Audio_Stream SHALL clean up resources gracefully
4. WHEN an error occurs during recording THEN the Live_Audio_Stream SHALL release resources and notify the user
5. WHEN multiple recording attempts occur THEN the VerbumCare_System SHALL prevent concurrent recordings

### Requirement 6: Integration with Existing Streaming Infrastructure

**User Story:** As a developer, I want the live audio capture to integrate seamlessly with the existing streaming infrastructure, so that we can reuse the WebSocket handlers and transcription services.

#### Acceptance Criteria

1. WHEN live audio chunks are captured THEN the Audio_Streamer_Service SHALL transmit them using the existing WebSocket connection
2. WHEN the WebSocket connection is established THEN the VerbumCare_System SHALL use the existing session management from streaming-voice-transcription spec
3. WHEN transcription results are received THEN the VerbumCare_System SHALL display them using the existing ProgressiveTranscript component
4. WHEN categorization is triggered THEN the VerbumCare_System SHALL use the existing categorization flow
5. WHEN offline mode is active THEN the VerbumCare_System SHALL use the existing OfflineQueueService

### Requirement 7: Native Build Configuration

**User Story:** As a developer, I want clear build configuration, so that the native module is properly included in the app.

#### Acceptance Criteria

1. WHEN building for iOS THEN the VerbumCare_System SHALL include the Live_Audio_Stream pod dependency
2. WHEN building for Android THEN the VerbumCare_System SHALL include the Live_Audio_Stream gradle dependency
3. WHEN the iOS Info.plist is configured THEN the VerbumCare_System SHALL include microphone usage description
4. WHEN the Android manifest is configured THEN the VerbumCare_System SHALL include RECORD_AUDIO permission
5. WHEN running expo prebuild THEN the VerbumCare_System SHALL generate native projects with correct configurations

### Requirement 8: Error Handling and Recovery

**User Story:** As a nurse, I want the app to handle errors gracefully, so that I don't lose my documentation if something goes wrong.

#### Acceptance Criteria

1. IF the Live_Audio_Stream fails to initialize THEN the VerbumCare_System SHALL fall back to expo-av recording
2. IF audio capture stops unexpectedly THEN the VerbumCare_System SHALL attempt to recover or notify the user
3. IF the native module is not available THEN the VerbumCare_System SHALL use Fallback_Mode without showing errors
4. WHEN an error occurs THEN the VerbumCare_System SHALL log it for debugging without disrupting the user
5. WHEN recovery is not possible THEN the VerbumCare_System SHALL preserve any captured audio for later processing

### Requirement 9: Audio Quality Optimization

**User Story:** As a nurse, I want my voice recordings to be clear and accurate, so that transcription quality is high.

#### Acceptance Criteria

1. WHEN configuring audio capture THEN the Live_Audio_Stream SHALL use VOICE_RECOGNITION audio source on Android
2. WHEN configuring sample rate THEN the VerbumCare_System SHALL use 32kHz for optimal voice recognition quality
3. WHEN configuring channels THEN the VerbumCare_System SHALL use mono (1 channel) to reduce bandwidth
4. WHEN configuring bit depth THEN the VerbumCare_System SHALL use 16-bit for adequate quality
5. WHEN the recording environment is noisy THEN the backend Transcription_Service SHALL apply noise reduction

### Requirement 10: Backward Compatibility

**User Story:** As a user with an older app version, I want the app to continue working, so that I'm not forced to update immediately.

#### Acceptance Criteria

1. WHEN the native module is not present THEN the VerbumCare_System SHALL detect this and use Fallback_Mode
2. WHEN using Fallback_Mode THEN the VerbumCare_System SHALL maintain all existing functionality
3. WHEN the streaming toggle is disabled THEN the VerbumCare_System SHALL behave identically to the current app
4. WHEN upgrading from a previous version THEN the VerbumCare_System SHALL preserve user settings and data
5. WHEN the backend doesn't support streaming THEN the VerbumCare_System SHALL use the upload-after-recording workflow
