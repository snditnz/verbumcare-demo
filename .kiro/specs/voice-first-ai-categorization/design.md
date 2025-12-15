# Design Document - Voice-First AI Categorization

## Overview

The Voice-First AI Categorization feature transforms VerbumCare into an intelligent voice-driven documentation system. Users can speak naturally about patient care, and the AI automatically categorizes the content into appropriate data types (vitals, medications, clinical notes, ADLs, incidents, care plans, pain assessments) and extracts structured data for database insertion.

### Key Design Principles

1. **Explicit User Approval**: No data is saved to the database without explicit user confirmation via "Confirm & Save" button
2. **Transparent AI Processing**: Users see both the original transcript and extracted data, with confidence scores
3. **Editable at Every Step**: Users can edit transcripts and re-analyze, or directly edit extracted data fields
4. **Queue-Based Workflow**: Pending reviews are queued when users are busy, with notification badges and chronological ordering
5. **Offline-First**: All processing happens locally using Whisper + Ollama, with queue persistence across sessions
6. **Context-Aware**: System handles both patient-specific context (patient open) and global context (no patient selected)

## Architecture

### High-Level Data Flow

```
User Voice Input
    ↓
Audio Recording (iPad)
    ↓
Upload to Backend (encrypted)
    ↓
Background Processing Queue
    ↓
Whisper Transcription (20-30s)
    ↓
Ollama Extraction (20-30s)
    ↓
Review Queue (pending user approval)
    ↓
Review Screen (transcript + extracted data)
    ↓
User Edits & Confirms
    ↓
Database Insertion (atomic transaction)
```

### Component Architecture


#### Frontend (iPad App)

**New Components:**
- `VoiceReviewScreen.tsx` - Main review interface showing transcript and extracted data
- `ReviewQueueScreen.tsx` - List of pending reviews with notification badge
- `VoiceReviewCard.tsx` - Individual review item in queue
- `ExtractedDataEditor.tsx` - Editable form for extracted structured data
- `TranscriptEditor.tsx` - Editable text area for transcript with re-analyze button
- `ConfidenceIndicator.tsx` - Visual indicator for AI confidence scores
- `VoiceProcessingNotification.tsx` - Toast/banner for processing status

**Modified Components:**
- `GeneralVoiceRecorderScreen.tsx` - Add context detection (patient vs global)
- `PatientInfoScreen.tsx` - Add voice recording button with patient context
- `DashboardScreen.tsx` - Add review queue notification badge

**New Services:**
- `voiceReviewService.ts` - Manage review queue, persistence, and state
- `voiceCategorization.ts` - Handle AI categorization and data extraction

**New Stores:**
- `voiceReviewStore.ts` - Zustand store for review queue state

#### Backend (Node.js/Express)

**New Database Tables:**
- `voice_review_queue` - Pending reviews awaiting user approval
- `voice_categorization_log` - Audit trail of AI categorization decisions

**Modified Tables:**
- `voice_recordings` - Add `review_status`, `context_type`, `context_patient_id` columns

**New Routes:**
- `POST /api/voice/categorize` - Trigger AI categorization
- `GET /api/voice/review-queue/:userId` - Get user's pending reviews
- `POST /api/voice/review/:reviewId/reanalyze` - Re-analyze with edited transcript
- `POST /api/voice/review/:reviewId/confirm` - Confirm and save to database
- `DELETE /api/voice/review/:reviewId` - Discard review

**Modified Routes:**
- `POST /api/voice/upload` - Add context detection and queue creation
- `POST /api/voice/process` - Enhanced to support categorization

**New Services:**
- `categorizationService.js` - AI-powered data categorization logic
- `reviewQueueService.js` - Queue management and persistence


## Components and Interfaces

### Frontend Interfaces

#### VoiceReviewItem

```typescript
interface VoiceReviewItem {
  reviewId: string;
  recordingId: string;
  userId: string;
  contextType: 'patient' | 'global';
  contextPatientId?: string;
  contextPatientName?: string;
  
  // Original data
  audioUri: string;
  duration: number;
  recordedAt: Date;
  
  // AI processing results
  transcript: string;
  transcriptLanguage: 'ja' | 'en' | 'zh-TW';
  extractedData: ExtractedData;
  confidence: number;
  
  // Review state
  status: 'pending' | 'in_review' | 'confirmed' | 'discarded';
  createdAt: Date;
  reviewedAt?: Date;
  
  // Metadata
  processingTime: number;
  modelVersion: string;
}
```

#### ExtractedData

```typescript
interface ExtractedData {
  categories: DataCategory[];
  overallConfidence: number;
}

interface DataCategory {
  type: 'vitals' | 'medication' | 'clinical_note' | 'adl' | 'incident' | 'care_plan' | 'pain';
  confidence: number;
  data: any; // Type-specific structured data
  fieldConfidences: Record<string, number>; // Per-field confidence scores
}

// Type-specific data structures
interface VitalsData {
  blood_pressure?: { systolic: number; diastolic: number };
  heart_rate?: number;
  temperature?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight_kg?: number;
  height_cm?: number;
}

interface MedicationData {
  medication_name: string;
  dose: string;
  route: string;
  time: string;
  response?: string;
}

interface ClinicalNoteData {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  category?: string;
}

interface ADLData {
  activity: string;
  score: number;
  assistance_required: boolean;
  notes?: string;
}

interface IncidentData {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  actions_taken?: string;
  follow_up_required: boolean;
}

interface CarePlanData {
  problem: string;
  goal: string;
  interventions: string[];
  evaluation?: string;
}

interface PainData {
  location: string;
  intensity: number; // 0-10
  character: string;
  duration: string;
  aggravating_factors?: string;
  relieving_factors?: string;
}
```


### Backend Interfaces

#### Database Schema

**voice_review_queue table:**
```sql
CREATE TABLE voice_review_queue (
    review_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recording_id UUID NOT NULL REFERENCES voice_recordings(recording_id),
    user_id UUID NOT NULL REFERENCES staff(staff_id),
    
    -- Context
    context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('patient', 'global')),
    context_patient_id UUID REFERENCES patients(patient_id),
    
    -- AI Results
    transcript TEXT NOT NULL,
    transcript_language VARCHAR(10) NOT NULL,
    extracted_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    
    -- Review State
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'confirmed', 'discarded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    
    -- Metadata
    processing_time_ms INTEGER,
    model_version VARCHAR(50),
    
    -- Indexes
    INDEX idx_review_queue_user_status (user_id, status),
    INDEX idx_review_queue_created (created_at),
    INDEX idx_review_queue_patient (context_patient_id)
);
```

**voice_categorization_log table:**
```sql
CREATE TABLE voice_categorization_log (
    log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES voice_review_queue(review_id),
    
    -- Categorization Details
    detected_categories JSONB NOT NULL, -- Array of category types with confidences
    extraction_prompt TEXT,
    extraction_response TEXT,
    
    -- User Corrections
    user_edited_transcript BOOLEAN DEFAULT FALSE,
    user_edited_data BOOLEAN DEFAULT FALSE,
    reanalysis_count INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    confirmed_by UUID REFERENCES staff(staff_id),
    
    INDEX idx_categorization_log_review (review_id)
);
```

**Modified voice_recordings table:**
```sql
ALTER TABLE voice_recordings
ADD COLUMN review_status VARCHAR(20) DEFAULT 'not_reviewed' 
    CHECK (review_status IN ('not_reviewed', 'pending_review', 'reviewed', 'discarded')),
ADD COLUMN context_type VARCHAR(20) CHECK (context_type IN ('patient', 'global')),
ADD COLUMN context_patient_id UUID REFERENCES patients(patient_id);

CREATE INDEX idx_voice_recordings_review_status ON voice_recordings(review_status);
CREATE INDEX idx_voice_recordings_context ON voice_recordings(context_type, context_patient_id);
```


## Data Models

### Review Queue State Machine

```
[Recording Complete]
        ↓
   [Processing]
        ↓
  [Pending Review] ← Initial state in queue
        ↓
   [In Review] ← User opened review screen
        ↓
    ┌───┴───┐
    ↓       ↓
[Confirmed] [Discarded]
    ↓       ↓
[Archived] [Archived]
```

### Context Detection Logic

```typescript
function detectContext(currentScreen: string, selectedPatient?: Patient): VoiceContext {
  if (selectedPatient && selectedPatient.patient_id) {
    return {
      type: 'patient',
      patientId: selectedPatient.patient_id,
      patientName: `${selectedPatient.family_name} ${selectedPatient.given_name}`,
      room: selectedPatient.room,
      bed: selectedPatient.bed
    };
  }
  
  return {
    type: 'global'
  };
}
```

### AI Categorization Prompt Engineering

The categorization service uses a multi-stage prompt strategy:

**Stage 1: Category Detection**
```
Analyze the following medical transcription and identify ALL data categories present.
Categories: vitals, medication, clinical_note, adl, incident, care_plan, pain

Transcription: [USER_TRANSCRIPT]

Output JSON format:
{
  "categories": ["category1", "category2", ...],
  "confidence": 0.0-1.0
}
```

**Stage 2: Data Extraction (per category)**
```
Extract structured [CATEGORY] data from the transcription.

Transcription: [USER_TRANSCRIPT]

Output JSON format:
{
  "data": { [CATEGORY_SPECIFIC_FIELDS] },
  "field_confidences": {
    "field1": 0.0-1.0,
    "field2": 0.0-1.0
  }
}
```

**Stage 3: Validation**
- Clinical range validation (e.g., BP 70-250 mmHg)
- Required field checking
- Cross-field consistency (e.g., systolic > diastolic)
- Language-specific validation


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Patient Context Properties

**Property 1: Patient context capture**
*For any* voice recording initiated with an active patient context, the recording SHALL capture and store the patient ID
**Validates: Requirements 1.1**

**Property 2: Patient data association**
*For any* extracted data from a patient-context recording, all data categories SHALL be linked to the active patient ID
**Validates: Requirements 1.2**

**Property 3: Multi-category patient association**
*For any* recording that extracts multiple data types, each database entry SHALL maintain the same patient association
**Validates: Requirements 1.3**

**Property 4: Vital signs validation**
*For any* extracted vital signs data, values SHALL pass clinical range validation before database insertion
**Validates: Requirements 1.5**

### Global Context Properties

**Property 5: Global mode processing**
*For any* voice recording initiated without patient context, the system SHALL mark the recording as global mode
**Validates: Requirements 2.1**

**Property 6: Global data storage**
*For any* global recording containing facility-wide observations, the stored data SHALL have null patient_id
**Validates: Requirements 2.3**

**Property 7: Multi-patient extraction**
*For any* global recording mentioning multiple patients, the system SHALL create separate data entries for each identified patient
**Validates: Requirements 2.4**

### Categorization Properties

**Property 8: Vitals categorization**
*For any* transcription containing vital sign measurements, the system SHALL categorize it as vital_signs data type
**Validates: Requirements 3.1**

**Property 9: Medication categorization**
*For any* transcription containing medication information, the system SHALL categorize it as medication data type and extract drug name, dosage, route, and timing
**Validates: Requirements 3.2**

**Property 10: Clinical note categorization**
*For any* transcription containing clinical observations, the system SHALL categorize it as clinical_note data type
**Validates: Requirements 3.3**

**Property 11: ADL categorization**
*For any* transcription containing ADL information, the system SHALL categorize it as assessment data type and extract activity scores
**Validates: Requirements 3.4**

**Property 12: Incident categorization**
*For any* transcription containing incident descriptions, the system SHALL categorize it as incident_report data type with severity classification
**Validates: Requirements 3.5**

**Property 13: Care plan categorization**
*For any* transcription containing care plan updates, the system SHALL categorize it as care_plan data type and extract problem, goal, and intervention data
**Validates: Requirements 3.6**

**Property 14: Multi-category extraction**
*For any* transcription containing multiple data types, the system SHALL extract and categorize each type independently
**Validates: Requirements 3.7**


### Audit and Confidence Properties

**Property 15: Transcript preservation**
*For any* AI extraction, the system SHALL store the original transcription alongside the extracted data
**Validates: Requirements 4.1**

**Property 16: Low confidence flagging**
*For any* AI categorization with confidence below threshold, the system SHALL flag the entry for manual review
**Validates: Requirements 4.2**

**Property 17: Audit metadata logging**
*For any* saved extracted data, the system SHALL log AI model version, extraction timestamp, and confidence scores
**Validates: Requirements 4.3**

**Property 18: Correction logging**
*For any* user correction to AI-extracted data, the system SHALL store the correction in the categorization log
**Validates: Requirements 4.5**

### Review Workflow Properties

**Property 19: Data edit reflection**
*For any* user edit to extracted data fields, the values SHALL be updated in the data structure before database insertion
**Validates: Requirements 5.6**

**Property 20: No auto-save**
*For any* completed AI extraction, the system SHALL NOT save data to the database until explicit user confirmation
**Validates: Requirements 5.7, 11.1**

**Property 21: Cancellation preservation**
*For any* cancelled review, the system SHALL discard extracted data but retain the original recording and transcription
**Validates: Requirements 5.8**

### Multi-Language Properties

**Property 22: Japanese language preservation**
*For any* transcription in Japanese, the extracted structured data SHALL contain Japanese field values
**Validates: Requirements 6.1**

**Property 23: English language preservation**
*For any* transcription in English, the extracted structured data SHALL contain English field values
**Validates: Requirements 6.2**

**Property 24: Chinese language preservation**
*For any* transcription in Traditional Chinese, the extracted structured data SHALL contain Traditional Chinese field values
**Validates: Requirements 6.3**

**Property 25: Mixed language preservation**
*For any* transcription containing mixed languages, the system SHALL preserve the original language for each extracted field
**Validates: Requirements 6.4**

**Property 26: Language-specific storage**
*For any* multilingual data, the system SHALL populate appropriate language-specific database columns
**Validates: Requirements 6.5**

### Offline and Queue Properties

**Property 27: Offline queuing**
*For any* voice recording made while offline, the system SHALL queue the recording for processing when connectivity returns
**Validates: Requirements 7.1**

**Property 28: Chronological processing**
*For any* set of queued recordings, the system SHALL process them in chronological order (oldest first)
**Validates: Requirements 7.3**

**Property 29: Context preservation in queue**
*For any* queued recording, the system SHALL maintain the patient context from the time of recording
**Validates: Requirements 7.4**

**Property 30: Queue addition on completion**
*For any* completed AI processing, the system SHALL add the processed recording to the review queue
**Validates: Requirements 8.1**

**Property 31: Queue count accuracy**
*For any* review queue, the notification badge count SHALL equal the number of pending reviews
**Validates: Requirements 8.2**

**Property 32: Chronological queue ordering**
*For any* review queue with multiple recordings, the system SHALL maintain chronological order (oldest first)
**Validates: Requirements 8.5**

**Property 33: Urgency highlighting**
*For any* queued recording older than 24 hours, the system SHALL highlight it as requiring urgent review
**Validates: Requirements 8.6**

**Property 34: Queue removal on confirmation**
*For any* confirmed queued recording, the system SHALL remove it from the queue and save data to the database
**Validates: Requirements 8.7**

**Property 35: Archive on discard**
*For any* discarded queued recording, the system SHALL remove it from the queue and archive the recording
**Validates: Requirements 8.8**

### Error Handling Properties

**Property 36: Error notification**
*For any* AI processing failure, the system SHALL notify the user with error details and retry option
**Validates: Requirements 9.3**

### Transaction and Persistence Properties

**Property 37: Atomic transaction**
*For any* user confirmation, the system SHALL save all approved data in a single atomic transaction (all or nothing)
**Validates: Requirements 11.3**

**Property 38: Failure recovery**
*For any* database insertion failure, the system SHALL retain the approved data in the queue for retry
**Validates: Requirements 11.4**

**Property 39: Queue persistence across sessions**
*For any* user logout with pending reviews, the system SHALL preserve the review queue for the next session
**Validates: Requirements 11.5**

**Property 40: User queue isolation**
*For any* user login, the system SHALL NOT display other users' pending reviews
**Validates: Requirements 11.6**

**Property 41: Automatic archival**
*For any* recording in pending state for more than 7 days, the system SHALL archive it and notify administrators
**Validates: Requirements 11.7**


## Error Handling

### Error Categories

1. **Recording Errors**
   - Microphone permission denied → Show permission request dialog
   - Audio recording failure → Display error message, allow retry
   - File system errors → Queue for retry, notify user

2. **Processing Errors**
   - Whisper service unavailable → Queue for retry when service returns
   - Ollama service unavailable → Queue for retry when service returns
   - Transcription timeout (>2 min) → Notify user, offer retry
   - Extraction timeout (>2 min) → Notify user, offer retry
   - Invalid JSON from LLM → Log error, flag for manual review

3. **Validation Errors**
   - Out-of-range vital signs → Highlight in review screen, require user confirmation
   - Missing required fields → Highlight in review screen, prevent save until filled
   - Invalid data types → Show validation error, prevent save

4. **Database Errors**
   - Connection failure → Retain in queue, retry automatically
   - Transaction failure → Rollback, retain in queue, notify user
   - Constraint violation → Show specific error, allow user to fix

5. **Queue Errors**
   - Queue persistence failure → Log error, attempt recovery on next app start
   - Queue corruption → Rebuild from database, notify administrators

### Error Recovery Strategies

**Automatic Retry:**
- Network failures: Retry with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Service unavailable: Retry every 30s for up to 5 minutes
- Database deadlocks: Retry immediately up to 3 times

**Manual Retry:**
- User-initiated retry button for failed processing
- "Retry All" button in queue for multiple failures

**Graceful Degradation:**
- If Whisper unavailable: Show "Transcription service offline" message, queue for later
- If Ollama unavailable: Show "AI extraction service offline" message, queue for later
- If both unavailable: Allow recording, queue everything for later processing

**Data Preservation:**
- All recordings are encrypted and stored permanently
- All transcriptions are encrypted and stored permanently
- Failed extractions are logged with error details
- Queue state is persisted to AsyncStorage every 5 seconds


## Testing Strategy

### Unit Testing

**Frontend Unit Tests:**
- `voiceReviewService.test.ts` - Queue management, persistence, state transitions
- `voiceCategorization.test.ts` - Category detection logic, data extraction
- `VoiceReviewScreen.test.tsx` - Component rendering, user interactions
- `ExtractedDataEditor.test.tsx` - Data editing, validation
- `TranscriptEditor.test.tsx` - Transcript editing, re-analysis trigger

**Backend Unit Tests:**
- `categorizationService.test.js` - AI prompt generation, response parsing
- `reviewQueueService.test.js` - Queue operations, database interactions
- `voiceRoutes.test.js` - API endpoint behavior, request/response handling

### Property-Based Testing

Property-based tests will use **fast-check** (frontend) and **fast-check** (backend) to verify universal properties across randomly generated inputs. Each test will run a minimum of 100 iterations.

**Frontend Property Tests:**
- `voiceReview.property.test.ts`:
  - Property 1: Patient context capture (Req 1.1)
  - Property 2: Patient data association (Req 1.2)
  - Property 3: Multi-category patient association (Req 1.3)
  - Property 20: No auto-save (Req 5.7, 11.1)
  - Property 31: Queue count accuracy (Req 8.2)
  - Property 32: Chronological queue ordering (Req 8.5)
  - Property 39: Queue persistence across sessions (Req 11.5)
  - Property 40: User queue isolation (Req 11.6)

- `categorization.property.test.ts`:
  - Property 8-14: Category detection for all data types (Req 3.1-3.7)
  - Property 22-26: Language preservation (Req 6.1-6.5)

- `validation.property.test.ts`:
  - Property 4: Vital signs validation (Req 1.5)
  - Property 16: Low confidence flagging (Req 4.2)

**Backend Property Tests:**
- `categorizationService.property.test.js`:
  - Property 8-14: Category detection (Req 3.1-3.7)
  - Property 15: Transcript preservation (Req 4.1)
  - Property 17: Audit metadata logging (Req 4.3)
  - Property 18: Correction logging (Req 4.5)

- `reviewQueueService.property.test.js`:
  - Property 27: Offline queuing (Req 7.1)
  - Property 28: Chronological processing (Req 7.3)
  - Property 29: Context preservation (Req 7.4)
  - Property 30: Queue addition (Req 8.1)
  - Property 34: Queue removal on confirmation (Req 8.7)
  - Property 35: Archive on discard (Req 8.8)
  - Property 37: Atomic transaction (Req 11.3)
  - Property 38: Failure recovery (Req 11.4)
  - Property 41: Automatic archival (Req 11.7)

### Integration Testing

**End-to-End Workflows:**
1. **Patient Context Recording Flow:**
   - Select patient → Record voice → Process → Review → Confirm → Verify database

2. **Global Context Recording Flow:**
   - No patient selected → Record voice → Process → Review → Confirm → Verify database

3. **Multi-Category Extraction Flow:**
   - Record voice with multiple data types → Verify all categories extracted → Confirm → Verify separate database entries

4. **Transcript Editing Flow:**
   - Record voice → Edit transcript → Re-analyze → Verify new extraction → Confirm

5. **Queue Management Flow:**
   - Record multiple voices → Verify queue order → Review oldest first → Confirm → Verify queue updates

6. **Offline Flow:**
   - Go offline → Record voice → Verify queued → Go online → Verify automatic processing

7. **Error Recovery Flow:**
   - Simulate database failure → Verify data retained in queue → Retry → Verify success

### Test Data Generators

**For Property-Based Tests:**

```typescript
// Generate random patient context
const patientContextArb = fc.record({
  patientId: fc.uuid(),
  patientName: fc.string({ minLength: 5, maxLength: 50 }),
  room: fc.string({ minLength: 1, maxLength: 10 }),
  bed: fc.string({ minLength: 1, maxLength: 5 })
});

// Generate random transcription with specific category
const vitalsTranscriptionArb = fc.record({
  text: fc.string({ minLength: 50, maxLength: 500 }),
  containsVitals: fc.constant(true),
  bp_systolic: fc.integer({ min: 70, max: 250 }),
  bp_diastolic: fc.integer({ min: 40, max: 150 }),
  heart_rate: fc.integer({ min: 30, max: 250 })
});

// Generate random extracted data
const extractedDataArb = fc.record({
  categories: fc.array(fc.constantFrom('vitals', 'medication', 'clinical_note', 'adl', 'incident', 'care_plan', 'pain'), { minLength: 1, maxLength: 3 }),
  confidence: fc.double({ min: 0.6, max: 0.95 }),
  data: fc.anything()
});

// Generate random review queue item
const reviewQueueItemArb = fc.record({
  reviewId: fc.uuid(),
  userId: fc.uuid(),
  contextType: fc.constantFrom('patient', 'global'),
  status: fc.constantFrom('pending', 'in_review', 'confirmed', 'discarded'),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date() })
});
```

### Test Coverage Goals

- **Unit Test Coverage:** 80% minimum
- **Property Test Coverage:** All 41 correctness properties
- **Integration Test Coverage:** All 7 end-to-end workflows
- **Edge Case Coverage:** Offline scenarios, error conditions, boundary values


## Implementation Notes

### Security Considerations

1. **Audio Encryption:**
   - All audio files encrypted at rest using AES-256
   - Encryption keys derived from user credentials
   - Secure deletion of unencrypted temporary files

2. **Transcription Encryption:**
   - Transcriptions encrypted before database storage
   - Base64 encoding for database compatibility
   - Decryption only when displaying to authorized users

3. **Access Control:**
   - Review queues are user-specific (filtered by user_id)
   - Patient context validated against user permissions
   - Audit log tracks all access to voice recordings

4. **Data Retention:**
   - Recordings retained for 7 years (regulatory compliance)
   - Automatic archival after 7 days in pending state
   - Secure deletion after retention period

### Performance Considerations

1. **AI Processing:**
   - Whisper transcription: 20-30 seconds for 60-second audio
   - Ollama extraction: 20-30 seconds per category
   - Total processing time: 40-90 seconds depending on complexity
   - Sequential model loading to manage memory (8GB RAM limit)

2. **Queue Management:**
   - AsyncStorage persistence every 5 seconds
   - Maximum queue size: 100 items per user
   - Automatic cleanup of completed items after 24 hours

3. **Database Optimization:**
   - Indexes on review_queue(user_id, status)
   - Indexes on review_queue(created_at) for chronological queries
   - JSONB indexes on extracted_data for category filtering

4. **Network Optimization:**
   - Audio compression before upload (m4a format)
   - Chunked upload for large files (>10MB)
   - Background sync with exponential backoff

### Scalability Considerations

1. **Concurrent Processing:**
   - Backend supports up to 4 concurrent AI processing jobs
   - Queue-based processing prevents memory exhaustion
   - Priority queue for urgent reviews (>24 hours old)

2. **Multi-User Support:**
   - User-specific review queues prevent cross-contamination
   - Database connection pooling (max 20 connections)
   - Socket.IO rooms for user-specific notifications

3. **Storage Management:**
   - Audio files stored in user-specific directories
   - Automatic cleanup of temporary files
   - Database partitioning by date for large deployments

### Monitoring and Observability

1. **Metrics to Track:**
   - Average processing time per recording
   - AI confidence score distribution
   - Category detection accuracy
   - Queue length per user
   - Error rate by error type
   - User confirmation rate (vs. discard rate)

2. **Logging:**
   - All AI processing logged with timestamps
   - All user actions logged (edit, confirm, discard)
   - All errors logged with stack traces
   - Performance metrics logged for slow operations

3. **Alerts:**
   - Alert when queue length exceeds 50 items
   - Alert when processing time exceeds 2 minutes
   - Alert when error rate exceeds 10%
   - Alert when AI services are unavailable for >5 minutes

### Future Enhancements

1. **AI Model Improvements:**
   - Fine-tuning Llama on medical terminology
   - Custom Whisper model for Japanese medical speech
   - Confidence calibration based on user corrections

2. **User Experience:**
   - Voice command for hands-free confirmation
   - Batch review mode for multiple recordings
   - Smart suggestions based on patient history

3. **Advanced Features:**
   - Multi-speaker detection for handoff recordings
   - Automatic patient identification from voice
   - Real-time transcription during recording

