# Requirements Document - Streaming Voice Transcription

## Introduction

This feature optimizes the voice recording workflow by implementing real-time audio streaming and progressive transcription. Currently, the workflow requires users to complete a recording before any processing begins, resulting in a clunky experience with long wait times. This feature enables audio to be streamed to the backend as it's recorded, with transcription appearing progressively on screen, followed by automatic categorization when transcription completes.

## Glossary

- **VerbumCare_System**: The healthcare documentation platform
- **Audio_Streamer**: The client-side component that captures and transmits audio chunks in real-time
- **Transcription_Service**: The Whisper-based speech-to-text service that processes audio
- **Categorization_Engine**: The Ollama-based LLM that analyzes transcribed speech and extracts structured data
- **Progressive_Transcription**: Real-time display of transcribed text as audio is processed
- **Audio_Chunk**: A segment of audio data (typically 1-5 seconds) sent for processing
- **WebSocket_Connection**: Persistent bidirectional connection for real-time data exchange
- **Transcription_Buffer**: Server-side accumulator for partial transcription results
- **Recording_Session**: The complete lifecycle from recording start to categorization complete

## Requirements

### Requirement 1: Real-Time Audio Streaming

**User Story:** As a nurse, I want my voice to be processed as I speak, so that I don't have to wait for the entire recording to finish before seeing results.

#### Acceptance Criteria

1. WHEN a user starts a voice recording THEN the Audio_Streamer SHALL establish a WebSocket connection to the backend
2. WHEN audio is being captured THEN the Audio_Streamer SHALL transmit audio chunks every 2-3 seconds to the backend
3. WHEN audio chunks are received THEN the Transcription_Service SHALL process them incrementally
4. WHEN the WebSocket connection fails THEN the Audio_Streamer SHALL fall back to the existing upload-after-recording workflow
5. WHEN the user pauses recording THEN the Audio_Streamer SHALL pause chunk transmission while maintaining the connection
6. WHEN the user resumes recording THEN the Audio_Streamer SHALL resume chunk transmission seamlessly

### Requirement 2: Progressive Transcription Display

**User Story:** As a nurse, I want to see my words appear on screen as I speak, so that I can verify the system is capturing my documentation correctly.

#### Acceptance Criteria

1. WHEN the Transcription_Service produces partial results THEN the VerbumCare_System SHALL display them in the UI within 500ms
2. WHEN new transcription text arrives THEN the VerbumCare_System SHALL append it to the existing display without flickering
3. WHEN transcription confidence is below 0.7 THEN the VerbumCare_System SHALL display the uncertain text with visual distinction (e.g., lighter color or italic)
4. WHEN the user is viewing the transcription THEN the VerbumCare_System SHALL auto-scroll to show the latest text
5. WHEN the recording ends THEN the VerbumCare_System SHALL display the complete finalized transcription
6. WHEN transcription errors occur THEN the VerbumCare_System SHALL display an error indicator without losing previously transcribed text

### Requirement 3: Automatic Categorization Trigger

**User Story:** As a nurse, I want the AI categorization to start automatically when I finish speaking, so that I can review extracted data without additional button presses.

#### Acceptance Criteria

1. WHEN the recording stops THEN the Categorization_Engine SHALL automatically begin processing the complete transcription
2. WHEN categorization starts THEN the VerbumCare_System SHALL display a processing indicator showing "Analyzing..."
3. WHEN categorization completes THEN the VerbumCare_System SHALL transition to the review screen with extracted data
4. WHEN categorization fails THEN the VerbumCare_System SHALL display the transcription with an option to retry categorization
5. WHEN the user cancels during categorization THEN the VerbumCare_System SHALL stop processing and retain the transcription for later review

### Requirement 4: Streaming Session Management

**User Story:** As a system administrator, I want streaming sessions to be properly managed, so that server resources are used efficiently.

#### Acceptance Criteria

1. WHEN a streaming session starts THEN the VerbumCare_System SHALL create a unique session identifier
2. WHEN a streaming session is idle for more than 60 seconds THEN the VerbumCare_System SHALL automatically close the connection
3. WHEN a client disconnects unexpectedly THEN the VerbumCare_System SHALL preserve any partial transcription for recovery
4. WHEN multiple streaming sessions exist THEN the VerbumCare_System SHALL process them concurrently up to a configurable limit
5. WHEN the session limit is reached THEN the VerbumCare_System SHALL queue new sessions and notify the user of the wait

### Requirement 5: Network Resilience and Offline Recording

**User Story:** As a nurse, I want the system to handle network issues gracefully and work offline, so that I don't lose my documentation or see timeout errors regardless of connectivity.

#### Acceptance Criteria

1. WHEN the app starts a recording THEN the Audio_Streamer SHALL first check network availability before attempting streaming
2. WHEN network is unavailable at recording start THEN the Audio_Streamer SHALL immediately use offline recording mode without attempting connection
3. WHEN network latency exceeds 2 seconds during streaming THEN the Audio_Streamer SHALL silently buffer audio locally and continue recording
4. WHEN the connection is restored during recording THEN the Audio_Streamer SHALL transmit buffered audio in order without user intervention
5. WHEN the connection cannot be established or restored THEN the Audio_Streamer SHALL complete the recording locally without showing timeout errors
6. WHEN in offline mode THEN the VerbumCare_System SHALL display "Recording locally" with a subtle offline indicator (no error styling)
7. WHEN an offline recording completes THEN the VerbumCare_System SHALL queue it for processing and display "Queued for processing when connected"
8. WHEN connectivity is restored THEN the VerbumCare_System SHALL automatically upload and process queued recordings in the background
9. WHEN background processing completes THEN the VerbumCare_System SHALL add the result to the review queue and show a notification badge
10. IF network errors occur THEN the VerbumCare_System SHALL NOT display error dialogs or timeout messages to the user

### Requirement 6: Audio Quality and Format

**User Story:** As a developer, I want audio to be transmitted efficiently, so that the system performs well on the local network.

#### Acceptance Criteria

1. WHEN audio chunks are created THEN the Audio_Streamer SHALL encode them in a format compatible with Whisper (WAV or M4A)
2. WHEN transmitting audio THEN the Audio_Streamer SHALL use compression to minimize bandwidth usage
3. WHEN audio quality is insufficient for transcription THEN the Transcription_Service SHALL notify the client with specific feedback
4. WHEN the recording environment is noisy THEN the Transcription_Service SHALL apply noise reduction before transcription
5. WHEN audio chunks arrive out of order THEN the Transcription_Service SHALL reorder them using sequence numbers

### Requirement 7: UI Feedback During Streaming

**User Story:** As a nurse, I want clear visual feedback during recording, so that I know the system is working correctly.

#### Acceptance Criteria

1. WHEN streaming is active THEN the VerbumCare_System SHALL display a real-time audio waveform or level indicator
2. WHEN transcription is being received THEN the VerbumCare_System SHALL display a "Transcribing..." indicator
3. WHEN the connection status changes THEN the VerbumCare_System SHALL update the status indicator within 1 second
4. WHEN recording duration exceeds 30 seconds THEN the VerbumCare_System SHALL display the elapsed time prominently
5. WHEN the maximum recording duration approaches THEN the VerbumCare_System SHALL warn the user 30 seconds before auto-stop

### Requirement 8: Context Preservation During Streaming

**User Story:** As a nurse, I want patient context to be maintained throughout the streaming session, so that extracted data is correctly associated.

#### Acceptance Criteria

1. WHEN a streaming session starts with patient context THEN the VerbumCare_System SHALL include the patient ID in all transmitted data
2. WHEN a streaming session starts without patient context THEN the VerbumCare_System SHALL mark the session as global
3. WHEN the session context is established THEN the VerbumCare_System SHALL maintain it throughout the entire recording and categorization process
4. WHEN categorization extracts patient-identifiable information in global mode THEN the VerbumCare_System SHALL prompt for patient association during review
5. WHEN the user navigates away during streaming THEN the VerbumCare_System SHALL warn about losing the current session

### Requirement 9: Performance Optimization

**User Story:** As a system administrator, I want the streaming system to be performant, so that it doesn't impact other system operations.

#### Acceptance Criteria

1. WHEN processing streaming audio THEN the Transcription_Service SHALL return partial results within 3 seconds of receiving a chunk
2. WHEN the Whisper model is processing THEN the VerbumCare_System SHALL not block other API requests
3. WHEN memory usage exceeds 80% THEN the VerbumCare_System SHALL reject new streaming sessions until resources are available
4. WHEN a streaming session completes THEN the VerbumCare_System SHALL release all associated resources within 5 seconds
5. WHEN the system is under load THEN the VerbumCare_System SHALL prioritize completing active sessions over starting new ones

### Requirement 10: Offline Recording Queue Management

**User Story:** As a nurse, I want my offline recordings to be reliably queued and processed, so that I can continue documenting care without worrying about connectivity.

#### Acceptance Criteria

1. WHEN a recording is saved offline THEN the VerbumCare_System SHALL store it in a persistent local queue with metadata (timestamp, patient context, duration)
2. WHEN the app launches THEN the VerbumCare_System SHALL check for pending offline recordings and display a badge if any exist
3. WHEN connectivity is detected THEN the VerbumCare_System SHALL process offline queue items in chronological order (oldest first)
4. WHEN processing an offline recording THEN the VerbumCare_System SHALL show progress in a non-intrusive notification area
5. WHEN an offline recording fails to process THEN the VerbumCare_System SHALL retry up to 3 times before marking it for manual review
6. WHEN the offline queue contains items older than 24 hours THEN the VerbumCare_System SHALL highlight them as requiring attention
7. WHEN the user views the offline queue THEN the VerbumCare_System SHALL display each item with status (pending, processing, failed, completed)
8. WHEN the user manually triggers processing THEN the VerbumCare_System SHALL attempt to process all pending items immediately

### Requirement 11: Backward Compatibility

**User Story:** As a developer, I want the streaming feature to coexist with the existing workflow, so that users can fall back if needed.

#### Acceptance Criteria

1. WHEN streaming is not supported by the client THEN the VerbumCare_System SHALL use the existing upload-after-recording workflow
2. WHEN the user prefers the traditional workflow THEN the VerbumCare_System SHALL provide a setting to disable streaming
3. WHEN the backend streaming endpoint is unavailable THEN the client SHALL automatically fall back to the upload endpoint
4. WHEN using the fallback workflow THEN the VerbumCare_System SHALL maintain all existing functionality without degradation
5. WHEN streaming is disabled THEN the VerbumCare_System SHALL not establish WebSocket connections for voice recording

