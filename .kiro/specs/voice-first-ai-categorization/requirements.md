# Requirements Document - Voice-First AI Categorization

## Introduction

This feature enables intelligent voice-driven data entry where the AI model automatically categorizes spoken content and updates appropriate database fields. The system must handle both patient-specific context (when a patient is open) and global context (no patient selected).

## Glossary

- **VerbumCare System**: The healthcare documentation platform
- **AI Categorization Engine**: The Ollama-based LLM that analyzes transcribed speech and extracts structured data
- **Patient Context**: The state where a specific patient is selected in the application
- **Global Context**: The state where no patient is selected
- **Voice Recording**: Audio captured from the user via the iPad microphone
- **Transcription**: Text output from the Whisper speech-to-text service
- **Structured Data**: Categorized information extracted from transcription (vitals, medications, notes, etc.)
- **Field Mapping**: The process of matching extracted data to database fields

## Requirements

### Requirement 1

**User Story:** As a nurse, I want to record voice notes while viewing a patient, so that all extracted data is automatically associated with that patient.

#### Acceptance Criteria

1. WHEN a user initiates voice recording with a patient context active THEN the system SHALL capture the patient ID for data association
2. WHEN the AI extracts structured data from patient-context recording THEN the system SHALL automatically link all extracted data to the active patient
3. WHEN multiple data types are extracted from a single recording THEN the system SHALL create separate database entries for each data type while maintaining patient association
4. WHEN the recording completes THEN the system SHALL display a summary of extracted data with patient name confirmation
5. WHEN extracted data includes vital signs THEN the system SHALL validate values against clinical ranges before database insertion

### Requirement 2

**User Story:** As a nurse, I want to record voice notes without a patient selected, so that I can capture facility-wide observations or general notes.

#### Acceptance Criteria

1. WHEN a user initiates voice recording without patient context THEN the system SHALL process the recording in global mode
2. WHEN the AI extracts patient-identifiable information from global recording THEN the system SHALL prompt the user to confirm patient association
3. WHEN global recording contains facility-wide observations THEN the system SHALL store data without patient linkage
4. WHEN global recording mentions multiple patients THEN the system SHALL extract and associate data separately for each identified patient
5. WHEN patient identification is ambiguous THEN the system SHALL present disambiguation options to the user

### Requirement 3

**User Story:** As a care worker, I want the AI to automatically categorize my voice input into appropriate data types, so that I don't need to manually select forms or fields.

#### Acceptance Criteria

1. WHEN transcription contains vital sign measurements THEN the system SHALL extract values and units and categorize as vital_signs data type
2. WHEN transcription contains medication information THEN the system SHALL extract drug name, dosage, route, and timing and categorize as medication data type
3. WHEN transcription contains clinical observations THEN the system SHALL categorize as clinical_note data type with appropriate SOAP section
4. WHEN transcription contains ADL information THEN the system SHALL extract activity scores and categorize as assessment data type
5. WHEN transcription contains incident description THEN the system SHALL categorize as incident_report data type with severity classification
6. WHEN transcription contains care plan updates THEN the system SHALL extract problem, goal, and intervention data and categorize as care_plan data type
7. WHEN transcription contains multiple data types THEN the system SHALL extract and categorize each type independently

### Requirement 4

**User Story:** As a system administrator, I want the AI categorization to be accurate and auditable, so that I can trust the automated data entry.

#### Acceptance Criteria

1. WHEN the AI extracts structured data THEN the system SHALL store the original transcription alongside extracted data for audit purposes
2. WHEN the AI categorization confidence is below threshold THEN the system SHALL flag the entry for manual review
3. WHEN extracted data is saved THEN the system SHALL log the AI model version, extraction timestamp, and confidence scores
4. WHEN the user reviews AI-extracted data THEN the system SHALL display confidence indicators for each extracted field
5. WHEN the user corrects AI-extracted data THEN the system SHALL store corrections as training feedback for model improvement

### Requirement 5

**User Story:** As a nurse, I want to review and edit both the transcript and extracted data before it's saved, so that I can ensure accuracy and catch any errors.

#### Acceptance Criteria

1. WHEN voice processing completes THEN the system SHALL display a review screen with both the original transcript and extracted structured data
2. WHEN the review screen displays the transcript THEN the system SHALL allow the user to edit the transcript text
3. WHEN the user edits the transcript THEN the system SHALL provide a "Re-analyze" button to re-extract data from the edited transcript
4. WHEN the review screen displays extracted data THEN the system SHALL show each data category (vitals, medications, notes) in separate editable sections
5. WHEN the review screen displays extracted data THEN the system SHALL highlight fields with low confidence scores in yellow or orange
6. WHEN the user edits extracted data fields THEN the system SHALL update the values in real-time before database insertion
7. WHEN the user confirms the review THEN the system SHALL require explicit acceptance (e.g., "Confirm & Save" button) before database insertion
8. WHEN the user cancels the review THEN the system SHALL discard extracted data but retain the original recording and transcription for later review

### Requirement 6

**User Story:** As a developer, I want the AI categorization to handle Japanese, English, and Traditional Chinese, so that the system works for all users.

#### Acceptance Criteria

1. WHEN transcription is in Japanese THEN the system SHALL extract structured data with Japanese field values
2. WHEN transcription is in English THEN the system SHALL extract structured data with English field values
3. WHEN transcription is in Traditional Chinese THEN the system SHALL extract structured data with Traditional Chinese field values
4. WHEN transcription contains mixed languages THEN the system SHALL extract data preserving the original language for each field
5. WHEN storing multilingual data THEN the system SHALL populate appropriate language-specific database columns

### Requirement 7

**User Story:** As a nurse, I want the voice categorization to work offline, so that I can document care even without network connectivity.

#### Acceptance Criteria

1. WHEN the device is offline THEN the system SHALL queue voice recordings for processing when connectivity returns
2. WHEN offline recordings are queued THEN the system SHALL display pending status to the user
3. WHEN connectivity is restored THEN the system SHALL automatically process queued recordings in chronological order
4. WHEN processing queued recordings THEN the system SHALL maintain patient context from the time of recording
5. WHEN queued processing completes THEN the system SHALL notify the user of successful data extraction

### Requirement 8

**User Story:** As a nurse, I want pending voice recordings to be queued when I can't review them immediately, so that I can process them when I have time.

#### Acceptance Criteria

1. WHEN AI processing completes while the user is busy THEN the system SHALL add the processed recording to a review queue
2. WHEN recordings are in the review queue THEN the system SHALL display a notification badge showing the count of pending reviews
3. WHEN the user opens the review queue THEN the system SHALL display a list of pending recordings with timestamp, patient name (if applicable), and recording duration
4. WHEN the user selects a queued recording THEN the system SHALL open the review screen with transcript and extracted data
5. WHEN multiple recordings are queued THEN the system SHALL maintain chronological order (oldest first)
6. WHEN a queued recording is older than 24 hours THEN the system SHALL highlight it as requiring urgent review
7. WHEN the user confirms a queued recording THEN the system SHALL remove it from the queue and save data to the database
8. WHEN the user discards a queued recording THEN the system SHALL remove it from the queue and archive the recording for audit purposes

### Requirement 9

**User Story:** As a nurse, I want to be notified when AI processing is delayed, so that I know my recording is still being processed.

#### Acceptance Criteria

1. WHEN AI processing takes longer than 30 seconds THEN the system SHALL display a progress indicator with estimated time remaining
2. WHEN multiple recordings are being processed simultaneously THEN the system SHALL display queue position (e.g., "Processing... 2 recordings ahead")
3. WHEN AI processing fails THEN the system SHALL notify the user with error details and option to retry
4. WHEN AI processing completes THEN the system SHALL display a notification prompting the user to review extracted data
5. WHEN the user is in a different screen during processing THEN the system SHALL show a persistent notification that can be tapped to open the review screen

### Requirement 10

**User Story:** As a care manager, I want to see what data types the AI can extract, so that I can train staff on effective voice documentation.

#### Acceptance Criteria

1. WHEN the system is configured THEN the system SHALL support extraction of vital signs (BP, HR, temp, SpO2, RR, weight, height)
2. WHEN the system is configured THEN the system SHALL support extraction of medication administration records (drug, dose, route, time, response)
3. WHEN the system is configured THEN the system SHALL support extraction of clinical notes (SOAP format: subjective, objective, assessment, plan)
4. WHEN the system is configured THEN the system SHALL support extraction of ADL assessments (eating, bathing, dressing, toileting, mobility scores)
5. WHEN the system is configured THEN the system SHALL support extraction of incident reports (type, severity, description, actions taken)
6. WHEN the system is configured THEN the system SHALL support extraction of care plan items (problem, goal, interventions, evaluation)
7. WHEN the system is configured THEN the system SHALL support extraction of pain assessments (location, intensity, character, duration)

### Requirement 11

**User Story:** As a system administrator, I want no data to be saved to the database without explicit user approval, so that we maintain data integrity and accountability.

#### Acceptance Criteria

1. WHEN AI extraction completes THEN the system SHALL NOT automatically save any data to the database
2. WHEN the review screen is displayed THEN the system SHALL clearly indicate that data is pending approval with "Draft" or "Pending Review" status
3. WHEN the user clicks "Confirm & Save" THEN the system SHALL save all approved data to the database in a single atomic transaction
4. WHEN database insertion fails THEN the system SHALL retain the approved data in the queue for retry
5. WHEN the user logs out with pending reviews THEN the system SHALL preserve the review queue for the next session
6. WHEN another user logs in THEN the system SHALL NOT display the previous user's pending reviews
7. WHEN a recording has been in pending state for more than 7 days THEN the system SHALL archive it and notify administrators
