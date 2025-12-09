# API Reference

## Overview

VerbumCare Backend API provides RESTful endpoints for patient management, care planning, medication administration, vital signs monitoring, and clinical documentation.

**Base URL**: `https://verbumcare-lab.local/api`

**Authentication**: Bearer token in Authorization header

**Response Format**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "language": "ja",
  "message": "Success message"
}
```

**Error Format**:
```json
{
  "success": false,
  "error": "Error message in requested language",
  "language": "ja"
}
```

## Authentication

### POST /auth/login

Authenticate user and receive access tokens.

**Request:**
```json
{
  "username": "nurse01",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid",
      "staffId": "uuid",
      "username": "nurse01",
      "fullName": "Tanaka Yuki",
      "fullNameJa": "田中 由紀",
      "role": "nurse",
      "facilityId": "uuid"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresAt": "2024-01-01T12:00:00Z"
    }
  }
}
```

### POST /auth/refresh

Refresh expired access token.

**Request:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-token",
    "expiresAt": "2024-01-01T13:00:00Z"
  }
}
```

### POST /auth/logout

Invalidate user session.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Patients

### GET /patients

Get list of all patients.

**Headers:**
```
Authorization: Bearer {accessToken}
Accept-Language: ja
```

**Query Parameters:**
- `facility_id` (optional): Filter by facility
- `care_level` (optional): Filter by care level
- `page` (optional): Page number for pagination
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "patient_id": "uuid",
      "mrn": "P001",
      "family_name": "田中",
      "given_name": "太郎",
      "family_name_en": "Tanaka",
      "given_name_en": "Taro",
      "date_of_birth": "1950-01-01",
      "age": 74,
      "gender": "male",
      "room_number": "101",
      "care_level": "要介護3",
      "admission_date": "2023-01-01",
      "primary_diagnosis": "Dementia",
      "allergies": ["Penicillin"],
      "emergency_contact": {
        "name": "田中 花子",
        "relationship": "Daughter",
        "phone": "090-1234-5678"
      }
    }
  ]
}
```

### GET /patients/:id

Get patient details by ID.

**Headers:**
```
Authorization: Bearer {accessToken}
Accept-Language: ja
```

**Response:**
```json
{
  "success": true,
  "data": {
    "patient_id": "uuid",
    "mrn": "P001",
    "family_name": "田中",
    "given_name": "太郎",
    /* ... full patient details ... */
  }
}
```

### PUT /patients/:id

Update patient information.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "room_number": "102",
  "care_level": "要介護4",
  "primary_diagnosis": "Dementia, Hypertension"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "patient_id": "uuid",
    /* ... updated patient data ... */
  }
}
```

## Care Plans

### GET /care-plans/:patientId

Get care plans for a patient.

**Headers:**
```
Authorization: Bearer {accessToken}
Accept-Language: ja
```

**Query Parameters:**
- `status` (optional): Filter by status (active, draft, archived)
- `include_history` (optional): Include version history (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patient_id": "uuid",
      "care_level": "要介護3",
      "status": "active",
      "version": 2.0,
      "created_date": "2024-01-01",
      "last_review_date": "2024-01-15",
      "next_review_date": "2024-04-15",
      "problems": [
        {
          "id": "uuid",
          "problem": "転倒リスク",
          "problem_en": "Fall Risk",
          "goals": ["安全な移動", "転倒予防"],
          "interventions": ["見守り強化", "環境整備"],
          "monitoring": {
            "frequency": "daily",
            "indicators": ["転倒回数", "移動状況"]
          }
        }
      ],
      "audit_log": [
        {
          "version": 2.0,
          "modified_by": "uuid",
          "modified_at": "2024-01-15T10:00:00Z",
          "changes": "Updated fall risk interventions"
        }
      ]
    }
  ]
}
```

### POST /care-plans

Create new care plan.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "patient_id": "uuid",
  "care_level": "要介護3",
  "status": "draft",
  "problems": [
    {
      "problem": "転倒リスク",
      "problem_en": "Fall Risk",
      "goals": ["安全な移動"],
      "interventions": ["見守り強化"],
      "monitoring": {
        "frequency": "daily",
        "indicators": ["転倒回数"]
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "version": 1.0,
    /* ... care plan data ... */
  }
}
```

### PUT /care-plans/:id

Update care plan (creates new version).

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "status": "active",
  "problems": [
    /* ... updated problems ... */
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "version": 2.0,
    /* ... updated care plan ... */
  }
}
```

### GET /care-plans/:id/history

Get version history for care plan.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "version": 2.0,
      "modified_by": "uuid",
      "modified_by_name": "田中 由紀",
      "modified_at": "2024-01-15T10:00:00Z",
      "changes": "Updated fall risk interventions",
      "snapshot": {
        /* ... care plan state at this version ... */
      }
    },
    {
      "version": 1.0,
      "created_by": "uuid",
      "created_at": "2024-01-01T09:00:00Z",
      "changes": "Initial creation"
    }
  ]
}
```

### POST /care-plans/:id/revert

Revert care plan to previous version.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "target_version": 1.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "version": 3.0,
    "reverted_from": 1.0,
    /* ... reverted care plan ... */
  }
}
```

## Medications

### GET /medications/orders/:patientId

Get medication orders for patient.

**Headers:**
```
Authorization: Bearer {accessToken}
Accept-Language: ja
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "order_id": "uuid",
      "patient_id": "uuid",
      "medication_name": "アムロジピン",
      "medication_name_en": "Amlodipine",
      "dosage": "5mg",
      "route": "oral",
      "frequency": "once_daily",
      "start_date": "2024-01-01",
      "end_date": null,
      "prescribing_doctor": "Dr. Yamada",
      "special_instructions": "Take in the morning"
    }
  ]
}
```

### POST /medications/administer

Record medication administration.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "patient_id": "uuid",
  "order_id": "uuid",
  "administered_by": "uuid",
  "administered_at": "2024-01-01T09:00:00Z",
  "dose_given": "5mg",
  "route": "oral",
  "patient_barcode": "scanned-barcode",
  "medication_barcode": "scanned-barcode"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "admin_id": "uuid",
    "record_hash": "sha256-hash",
    "previous_hash": "previous-sha256-hash",
    "verification_status": "verified",
    /* ... administration details ... */
  }
}
```

### GET /medications/verify/:patientId

Verify medication hash chain integrity.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "total_records": 150,
    "verified_records": 150,
    "violations": []
  }
}
```

**If violations detected:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "total_records": 150,
    "verified_records": 148,
    "violations": [
      {
        "admin_id": "uuid",
        "error": "Hash chain broken",
        "expected_hash": "expected-hash",
        "actual_hash": "actual-hash",
        "administered_at": "2024-01-15T10:00:00Z"
      }
    ]
  }
}
```

## Vital Signs

### GET /vitals/:patientId

Get vital signs history for patient.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `start_date` (optional): Filter from date (ISO 8601)
- `end_date` (optional): Filter to date (ISO 8601)
- `type` (optional): Filter by type (blood_pressure, temperature, pulse, etc.)
- `limit` (optional): Number of records (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vital_id": "uuid",
      "patient_id": "uuid",
      "recorded_by": "uuid",
      "recorded_by_name": "田中 由紀",
      "recorded_at": "2024-01-01T09:00:00Z",
      "systolic": 130,
      "diastolic": 80,
      "pulse": 72,
      "temperature": 36.5,
      "respiratory_rate": 16,
      "oxygen_saturation": 98,
      "device_id": "A&D-UA-656BLE-12345",
      "device_model": "A&D UA-656BLE",
      "notes": "Patient resting, no concerns"
    }
  ]
}
```

### POST /vitals

Record vital signs.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "patient_id": "uuid",
  "recorded_by": "uuid",
  "recorded_at": "2024-01-01T09:00:00Z",
  "systolic": 130,
  "diastolic": 80,
  "pulse": 72,
  "temperature": 36.5,
  "device_id": "A&D-UA-656BLE-12345",
  "device_model": "A&D UA-656BLE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vital_id": "uuid",
    /* ... vital signs data ... */
  }
}
```

## Clinical Notes

### GET /clinical-notes/:patientId

Get clinical notes for patient.

**Headers:**
```
Authorization: Bearer {accessToken}
Accept-Language: ja
```

**Query Parameters:**
- `start_date` (optional): Filter from date
- `end_date` (optional): Filter to date
- `note_type` (optional): Filter by type (soap, progress, incident, etc.)
- `created_by` (optional): Filter by author
- `limit` (optional): Number of records (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "note_id": "uuid",
      "patient_id": "uuid",
      "note_type": "soap",
      "created_by": "uuid",
      "created_by_name": "田中 由紀",
      "created_at": "2024-01-01T10:00:00Z",
      "subjective": "患者は頭痛を訴えている",
      "objective": "血圧 140/90, 体温 37.2°C",
      "assessment": "軽度の高血圧と微熱",
      "plan": "血圧モニタリング継続、水分摂取促進",
      "voice_recording_id": "uuid",
      "transcription": "Full transcription text..."
    }
  ]
}
```

### POST /clinical-notes

Create clinical note.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "patient_id": "uuid",
  "note_type": "soap",
  "created_by": "uuid",
  "subjective": "患者は頭痛を訴えている",
  "objective": "血圧 140/90, 体温 37.2°C",
  "assessment": "軽度の高血圧と微熱",
  "plan": "血圧モニタリング継続、水分摂取促進"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "note_id": "uuid",
    /* ... clinical note data ... */
  }
}
```

## Voice Processing

### POST /voice/upload

Upload voice recording for processing.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Request:**
```
audio: (binary file)
patient_id: uuid
recorded_by: uuid
language: ja
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recording_id": "uuid",
    "status": "processing",
    "estimated_time": 30
  }
}
```

### GET /voice/status/:recordingId

Get processing status for voice recording.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recording_id": "uuid",
    "status": "completed",
    "transcription": "患者は頭痛を訴えている...",
    "extracted_data": {
      "subjective": "患者は頭痛を訴えている",
      "objective": "血圧 140/90",
      "assessment": "軽度の高血圧",
      "plan": "血圧モニタリング継続"
    },
    "processing_time": 28
  }
}
```

## Audit Logs

### GET /audit-logs

Query audit logs (admin only).

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `user_id` (optional): Filter by user
- `patient_id` (optional): Filter by patient
- `action` (optional): Filter by action (VIEW, MODIFY, DELETE, etc.)
- `resource_type` (optional): Filter by resource type
- `start_date` (optional): Filter from date
- `end_date` (optional): Filter to date
- `page` (optional): Page number
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "log_id": "uuid",
        "user_id": "uuid",
        "user_name": "田中 由紀",
        "action": "VIEW",
        "resource_type": "patient",
        "resource_id": "uuid",
        "timestamp": "2024-01-01T10:00:00Z",
        "ip_address": "192.168.1.100",
        "user_agent": "VerbumCare iPad App/1.0",
        "details": {},
        "previous_hash": "previous-hash",
        "log_hash": "current-hash"
      }
    ],
    "total": 1500,
    "page": 1,
    "pages": 30
  }
}
```

### GET /audit-logs/verify

Verify audit log integrity (admin only).

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "total_logs": 1500,
    "verified_logs": 1500,
    "violations": []
  }
}
```

## Schedules

### GET /dashboard/today-schedule/:patientId

Get today's schedule for patient.

**Headers:**
```
Authorization: Bearer {accessToken}
Accept-Language: ja
```

**Response:**
```json
{
  "success": true,
  "data": {
    "patient_id": "uuid",
    "date": "2024-01-01",
    "medications": [
      {
        "time": "09:00",
        "medication_name": "アムロジピン",
        "dosage": "5mg",
        "status": "completed"
      }
    ],
    "vitals": [
      {
        "time": "08:00",
        "type": "blood_pressure",
        "status": "pending"
      }
    ],
    "assessments": [
      {
        "time": "10:00",
        "type": "barthel_index",
        "status": "pending"
      }
    ],
    "care_activities": [
      {
        "time": "07:00",
        "activity": "Morning care",
        "status": "completed"
      }
    ]
  }
}
```

### GET /dashboard/staff-schedule/:staffId

Get schedule for staff member (all patients).

**Headers:**
```
Authorization: Bearer {accessToken}
Accept-Language: ja
```

**Response:**
```json
{
  "success": true,
  "data": {
    "staff_id": "uuid",
    "date": "2024-01-01",
    "patients": [
      {
        "patient_id": "uuid",
        "patient_name": "田中 太郎",
        "room_number": "101",
        "tasks": [
          {
            "time": "09:00",
            "type": "medication",
            "description": "アムロジピン 5mg",
            "status": "pending"
          }
        ]
      }
    ]
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or expired token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 409 | Conflict - Resource conflict (e.g., version mismatch) |
| 422 | Unprocessable Entity - Validation failed |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service temporarily unavailable |

## Rate Limiting

- **Rate Limit**: 100 requests per minute per user
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Time when rate limit resets (Unix timestamp)

## Pagination

For endpoints that support pagination:

**Query Parameters:**
- `page`: Page number (1-indexed)
- `limit`: Items per page (default: 50, max: 100)

**Response Headers:**
- `X-Total-Count`: Total number of items
- `X-Page`: Current page number
- `X-Per-Page`: Items per page
- `X-Total-Pages`: Total number of pages

## Multi-Language Support

**Request Header:**
```
Accept-Language: ja
```

**Supported Languages:**
- `ja`: Japanese (default)
- `en`: English
- `zh-TW`: Traditional Chinese

**Response:**
All responses include a `language` field indicating the language used.

## WebSocket Events (Socket.IO)

**Connection:**
```javascript
const socket = io('https://verbumcare-lab.local', {
  auth: {
    token: accessToken
  }
});
```

**Events:**

### voice:processing
Voice recording processing status update.
```json
{
  "recording_id": "uuid",
  "status": "processing",
  "progress": 50
}
```

### voice:completed
Voice recording processing completed.
```json
{
  "recording_id": "uuid",
  "status": "completed",
  "transcription": "...",
  "extracted_data": {}
}
```

### care-plan:updated
Care plan updated by another user.
```json
{
  "care_plan_id": "uuid",
  "patient_id": "uuid",
  "version": 2.0,
  "modified_by": "uuid"
}
```

### vital-signs:new
New vital signs recorded.
```json
{
  "vital_id": "uuid",
  "patient_id": "uuid",
  "recorded_by": "uuid",
  "values": {}
}
```
