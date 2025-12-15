# Voice Categorization API Documentation

## Overview

The Voice Categorization API provides endpoints for processing voice recordings, managing review queues, and handling AI-powered data extraction. All endpoints support multi-language responses and follow RESTful conventions.

## Base URL

```
https://verbumcare-lab.local/api
```

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

## Content Types

- **Request**: `application/json` or `multipart/form-data` (for file uploads)
- **Response**: `application/json`
- **Language**: Specify via `Accept-Language` header (`ja`, `en`, `zh-TW`)

## Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": { /* response data */ },
  "language": "ja",
  "message": "Success message in requested language"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message in requested language",
  "language": "ja",
  "code": "ERROR_CODE"
}
```

## Voice Upload Endpoints

### POST /api/voice/upload

Upload a voice recording for processing.

**Request:**
```
Content-Type: multipart/form-data

Fields:
- audio: File (required) - Audio file (.m4a, .wav, .mp3)
- userId: String (required) - User ID
- contextType: String (optional) - "patient" or "global"
- contextPatientId: String (optional) - Patient ID if contextType is "patient"
- metadata: JSON (optional) - Additional metadata
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recordingId": "uuid",
    "status": "uploaded",
    "contextType": "patient",
    "contextPatientId": "patient-uuid",
    "duration": 45.2,
    "fileSize": 1024000,
    "uploadedAt": "2024-01-15T10:30:00Z"
  },
  "language": "ja",
  "message": "音声ファイルがアップロードされました"
}
```

**Error Codes:**
- `INVALID_FILE_FORMAT` - Unsupported audio format
- `FILE_TOO_LARGE` - File exceeds size limit (10MB)
- `INVALID_CONTEXT` - Invalid context type or patient ID
- `UPLOAD_FAILED` - File upload failed

## Voice Processing Endpoints

### POST /api/voice/categorize

Trigger AI categorization and data extraction for a recording.

**Request:**
```json
{
  "recordingId": "uuid",
  "manualCorrections": {
    "transcript": "corrected transcript text",
    "categories": ["vitals", "medication"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reviewId": "uuid",
    "status": "processing",
    "estimatedTime": 60,
    "queuePosition": 2
  },
  "language": "ja",
  "message": "AI分析を開始しました"
}
```

**Error Codes:**
- `RECORDING_NOT_FOUND` - Recording ID not found
- `ALREADY_PROCESSING` - Recording is already being processed
- `AI_SERVICE_UNAVAILABLE` - Ollama or Whisper service unavailable

### GET /api/voice/processing-status/:recordingId

Get the current processing status of a recording.

**Response:**
```json
{
  "success": true,
  "data": {
    "recordingId": "uuid",
    "status": "processing",
    "phase": "extraction",
    "progress": 75,
    "estimatedTimeRemaining": 15,
    "queuePosition": 1,
    "error": null
  },
  "language": "ja"
}
```

**Status Values:**
- `queued` - Waiting in processing queue
- `transcribing` - Converting speech to text
- `categorizing` - Detecting data categories
- `extracting` - Extracting structured data
- `completed` - Processing complete
- `failed` - Processing failed

## Review Queue Endpoints

### GET /api/voice/review-queue/:userId

Get the user's pending review queue.

**Query Parameters:**
- `limit` (optional) - Number of items to return (default: 50)
- `offset` (optional) - Pagination offset (default: 0)
- `status` (optional) - Filter by status (`pending`, `in_review`, `confirmed`, `discarded`)

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "reviewId": "uuid",
        "recordingId": "uuid",
        "userId": "uuid",
        "contextType": "patient",
        "contextPatientId": "uuid",
        "contextPatientName": "田中 太郎",
        "transcript": "血圧は120の80です",
        "transcriptLanguage": "ja",
        "extractedData": {
          "categories": [
            {
              "type": "vitals",
              "confidence": 0.92,
              "data": {
                "blood_pressure": {
                  "systolic": 120,
                  "diastolic": 80
                }
              },
              "fieldConfidences": {
                "blood_pressure.systolic": 0.95,
                "blood_pressure.diastolic": 0.89
              }
            }
          ],
          "overallConfidence": 0.92
        },
        "status": "pending",
        "createdAt": "2024-01-15T10:30:00Z",
        "processingTime": 45000,
        "modelVersion": "llama3.1:8b"
      }
    ],
    "totalCount": 5,
    "hasMore": false
  },
  "language": "ja"
}
```

### POST /api/voice/review/:reviewId/reanalyze

Re-analyze a review with edited transcript.

**Request:**
```json
{
  "editedTranscript": "血圧は130の85です",
  "preserveManualEdits": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reviewId": "uuid",
    "extractedData": {
      "categories": [
        {
          "type": "vitals",
          "confidence": 0.94,
          "data": {
            "blood_pressure": {
              "systolic": 130,
              "diastolic": 85
            }
          }
        }
      ]
    },
    "reanalysisCount": 2
  },
  "language": "ja",
  "message": "再分析が完了しました"
}
```

### POST /api/voice/review/:reviewId/confirm

Confirm and save extracted data to the database.

**Request:**
```json
{
  "extractedData": {
    "categories": [
      {
        "type": "vitals",
        "data": {
          "blood_pressure": {
            "systolic": 130,
            "diastolic": 85
          }
        }
      }
    ]
  },
  "userEdits": {
    "transcript": false,
    "data": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reviewId": "uuid",
    "insertedRecords": {
      "vital_signs": ["uuid1"],
      "medication_administrations": [],
      "clinical_notes": []
    },
    "confirmedAt": "2024-01-15T11:00:00Z"
  },
  "language": "ja",
  "message": "データを保存しました"
}
```

**Error Codes:**
- `VALIDATION_FAILED` - Extracted data failed validation
- `DATABASE_ERROR` - Database insertion failed
- `ALREADY_CONFIRMED` - Review already confirmed

### DELETE /api/voice/review/:reviewId

Discard a review (archive without saving to database).

**Response:**
```json
{
  "success": true,
  "data": {
    "reviewId": "uuid",
    "status": "discarded",
    "discardedAt": "2024-01-15T11:00:00Z"
  },
  "language": "ja",
  "message": "レビューを破棄しました"
}
```

## WebSocket Events

The system uses Socket.IO for real-time updates during voice processing.

### Connection

```javascript
const socket = io('https://verbumcare-lab.local', {
  auth: {
    token: jwt_token
  }
});
```

### Events

#### voice:processing-started
Emitted when voice processing begins.

```json
{
  "recordingId": "uuid",
  "userId": "uuid",
  "estimatedTime": 60
}
```

#### voice:processing-progress
Emitted during processing with progress updates.

```json
{
  "recordingId": "uuid",
  "phase": "extraction",
  "progress": 75,
  "estimatedTimeRemaining": 15
}
```

#### voice:processing-completed
Emitted when processing completes successfully.

```json
{
  "recordingId": "uuid",
  "reviewId": "uuid",
  "extractedCategories": ["vitals", "medication"],
  "overallConfidence": 0.87
}
```

#### voice:processing-failed
Emitted when processing fails.

```json
{
  "recordingId": "uuid",
  "error": "TRANSCRIPTION_FAILED",
  "message": "音声の文字起こしに失敗しました",
  "retryable": true
}
```

#### review-queue:updated
Emitted when the user's review queue changes.

```json
{
  "userId": "uuid",
  "queueCount": 3,
  "urgentCount": 1,
  "latestReview": {
    "reviewId": "uuid",
    "contextPatientName": "田中 太郎"
  }
}
```

## Data Validation

### Vital Signs Validation

```json
{
  "blood_pressure": {
    "systolic": {
      "min": 70,
      "max": 250,
      "unit": "mmHg"
    },
    "diastolic": {
      "min": 40,
      "max": 150,
      "unit": "mmHg"
    }
  },
  "heart_rate": {
    "min": 30,
    "max": 250,
    "unit": "bpm"
  },
  "temperature": {
    "min": 32.0,
    "max": 45.0,
    "unit": "°C"
  }
}
```

### Medication Validation

Required fields:
- `medication_name` (string, non-empty)
- `dose` (string, non-empty)
- `route` (enum: PO, IV, IM, SC, PR, SL, TOP, INH)
- `time` (ISO 8601 datetime)

### Pain Assessment Validation

```json
{
  "intensity": {
    "min": 0,
    "max": 10,
    "type": "integer"
  },
  "location": {
    "required": true,
    "type": "string"
  }
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource not found)
- `409` - Conflict (resource already exists/processed)
- `422` - Unprocessable Entity (validation failed)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable (AI services down)

### Retry Logic

For transient errors (500, 503), implement exponential backoff:

```javascript
const retryDelays = [1000, 2000, 4000, 8000]; // milliseconds

async function retryRequest(requestFn, maxRetries = 4) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (i === maxRetries - 1 || !isRetryableError(error)) {
        throw error;
      }
      await delay(retryDelays[i]);
    }
  }
}
```

## Rate Limits

- **Voice uploads**: 10 per minute per user
- **Processing requests**: 5 per minute per user
- **Review operations**: 30 per minute per user
- **Queue requests**: 60 per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642248000
```

## Security Considerations

### File Upload Security

- Maximum file size: 10MB
- Allowed formats: `.m4a`, `.wav`, `.mp3`
- Files are scanned for malware
- Temporary files are encrypted and deleted after processing

### Data Encryption

- All voice files encrypted at rest using AES-256
- Transcripts encrypted in database
- API communications use TLS 1.3

### Access Control

- Users can only access their own recordings and reviews
- Patient context validated against user permissions
- Audit logs track all data access

## Performance Considerations

### Processing Times

- **Transcription**: ~0.5x recording duration (30s audio = 15s processing)
- **Categorization**: ~20-30 seconds regardless of audio length
- **Extraction**: ~10-20 seconds per category

### Concurrent Processing

- Maximum 4 concurrent AI processing jobs
- Queue-based processing prevents resource exhaustion
- Priority given to recordings >24 hours old

### Caching

- Transcription results cached for 24 hours
- Category detection models cached in memory
- API responses cached for 5 minutes (review queue)

---

*For additional technical details, see the Database Schema Documentation and Service Architecture Guide.*