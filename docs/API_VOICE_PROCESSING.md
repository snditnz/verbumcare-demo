# Voice Processing API - End-to-End Documentation

Complete guide for the VerbumCare Nagare voice-to-text medical documentation system.

---

## Overview

The Voice Processing API converts audio recordings of nursing handoffs into structured medical data using:
- **Whisper** (faster-whisper) - Japanese speech-to-text transcription
- **Ollama** (llama3.1:8b) - Structured data extraction with custom medical prompt
- **Async processing** - Background jobs for long-running AI operations (no timeouts)

**Processing Time**: ~2-3 minutes for typical recordings (depends on audio length and model)

---

## Architecture

```
┌─────────────┐
│   Client    │
│  (iPad/Web) │
└──────┬──────┘
       │
       │ HTTPS (SSL)
       ▼
┌─────────────────────────────────────────────┐
│          nginx (api.nagare.local)           │
│  - SSL termination                          │
│  - Reverse proxy                            │
│  - WebSocket support                        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Backend API (Node.js)               │
│  - Express REST API                         │
│  - Socket.IO (real-time updates)            │
│  - Background job processor                 │
└──────┬──────────────────────────────────────┘
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌─────────────┐          ┌─────────────┐
│  PostgreSQL │          │ AI Services │
│  - Metadata │          │ (Host)      │
│  - Results  │          │             │
└─────────────┘          │ • Whisper   │
                         │   :8080     │
                         │ • Ollama    │
                         │   :11434    │
                         └─────────────┘
```

---

## API Endpoints

Base URL: `https://api.nagare.local`

### 1. Upload Audio File

Upload an audio recording for processing.

**Endpoint**: `POST /api/voice/upload`

**Content-Type**: `multipart/form-data`

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | File | Yes | Audio file (mp3, wav, m4a, ogg, webm) |
| `patient_id` | UUID | Yes | Patient UUID from database |
| `recorded_by` | UUID | Yes | Staff UUID (nurse/physician) |
| `duration_seconds` | Integer | No | Recording duration in seconds |

**Example Request**:

```bash
curl -k -X POST https://api.nagare.local/api/voice/upload \
  -F "audio=@/path/to/recording.mp3" \
  -F "patient_id=550e8400-e29b-41d4-a716-446655440201" \
  -F "recorded_by=550e8400-e29b-41d4-a716-446655440101" \
  -F "duration_seconds=120"
```

**Success Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
    "file_path": "uploads/voice/ab721937-5ecd-4a98-8069-d57f98b30ea1-1759475579933.mp3",
    "patient_id": "550e8400-e29b-41d4-a716-446655440201",
    "recorded_at": "2025-10-03T07:12:59.942Z",
    "processing_status": "pending",
    "recorded_by": "550e8400-e29b-41d4-a716-446655440101",
    "created_at": "2025-10-03T07:12:59.943Z"
  },
  "language": "en",
  "message": "Voice recording uploaded successfully"
}
```

**Error Responses**:

```json
// 400 Bad Request - Missing required fields
{
  "success": false,
  "error": "No audio file provided",
  "language": "en"
}

// 400 Bad Request - Invalid file type
{
  "success": false,
  "error": "Invalid file type. Only audio files are allowed.",
  "language": "en"
}

// 400 Bad Request - Invalid patient_id (not UUID)
{
  "success": false,
  "error": "Error",
  "language": "en"
}
```

**Important Notes**:
- Maximum file size: 50MB
- Supported formats: MP3, WAV, M4A, OGG, WebM
- `patient_id` and `recorded_by` must be valid UUIDs from the database
- Save the `recording_id` from the response for the next step

---

### 2. Start Processing (Async)

Start AI processing of the uploaded recording. Returns immediately.

**Endpoint**: `POST /api/voice/process`

**Content-Type**: `application/json`

**Request Body**:

```json
{
  "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
  "async": true,
  "manual_corrections": null
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `recording_id` | UUID | Yes | - | Recording UUID from upload |
| `async` | Boolean | No | `true` | Use async processing (recommended) |
| `manual_corrections` | Object | No | `null` | Manual edits to merge with AI results |

**Example Request**:

```bash
curl -k -X POST https://api.nagare.local/api/voice/process \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3"
  }'
```

**Success Response** (202 Accepted):

```json
{
  "success": true,
  "message": "Processing started",
  "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
  "processing_status": "processing",
  "language": "en",
  "status_url": "/api/voice/status/6e6a51ee-c2ef-40e1-80c4-d0198db4fad3"
}
```

**HTTP Status**: `202 Accepted` (processing started, not yet complete)

**Error Responses**:

```json
// 404 Not Found - Recording doesn't exist
{
  "success": false,
  "error": "Recording not found",
  "language": "en"
}

// 400 Bad Request - Already processed
{
  "success": false,
  "error": "Recording already processed",
  "language": "en"
}

// 409 Conflict - Currently processing
{
  "success": false,
  "error": "Recording is already being processed",
  "processing_status": "processing",
  "language": "en"
}

// 404 Not Found - Audio file missing
{
  "success": false,
  "error": "Audio file not found",
  "language": "en"
}
```

**Processing Phases**:
1. **Transcription** (~60-90 seconds) - Whisper converts audio to text
2. **Extraction** (~60-90 seconds) - Ollama extracts structured data
3. **Saving** - Results written to database

**Total time**: 2-3 minutes for typical recordings

---

### 3. Check Processing Status (Polling)

Poll for processing status and results.

**Endpoint**: `GET /api/voice/status/:recording_id`

**Example Request**:

```bash
curl -k https://api.nagare.local/api/voice/status/6e6a51ee-c2ef-40e1-80c4-d0198db4fad3
```

**Response While Processing**:

```json
{
  "success": true,
  "data": {
    "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
    "status": "processing",
    "started_at": "2025-10-03T07:13:58.605Z",
    "completed_at": null,
    "error": null
  },
  "language": "en"
}
```

**Response When Completed**:

```json
{
  "success": true,
  "data": {
    "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
    "status": "completed",
    "started_at": "2025-10-03T07:13:58.605Z",
    "completed_at": "2025-10-03T07:16:23.917Z",
    "error": null,
    "transcription": "はい、宮本と申します。よろしくお願いします。...",
    "structured_data": {
      "patients": [
        {
          "name": "",
          "room": "",
          "status": ""
        }
      ],
      "vital_signs": [],
      "observations": ["咳、鼻水", "微熱"],
      "actions_taken": [
        "コロナとインフルエンザの検査は陰性",
        "お胸の音を聞きました"
      ],
      "follow_up_needed": [
        "保育園とか幼稚園とか、また通訳してっていう感じになりますね"
      ]
    },
    "confidence": "0.92"
  },
  "language": "en"
}
```

**Response When Failed**:

```json
{
  "success": true,
  "data": {
    "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
    "status": "failed",
    "started_at": "2025-10-03T07:13:58.605Z",
    "completed_at": "2025-10-03T07:14:30.123Z",
    "error": "Whisper service unavailable"
  },
  "language": "en"
}
```

**Status Values**:

| Status | Description |
|--------|-------------|
| `pending` | Uploaded, not yet started processing |
| `processing` | Currently being processed by AI services |
| `completed` | Successfully processed, results available |
| `failed` | Processing failed, check `error` field |

**Polling Recommendations**:
- Poll every 5-10 seconds while `status === "processing"`
- Stop polling when `status === "completed"` or `status === "failed"`
- Use exponential backoff for production systems
- Consider using WebSocket (Socket.IO) for real-time updates instead

---

### 4. Get Recording Details

Retrieve complete recording information including patient details.

**Endpoint**: `GET /api/voice/recording/:recording_id`

**Example Request**:

```bash
curl -k https://api.nagare.local/api/voice/recording/6e6a51ee-c2ef-40e1-80c4-d0198db4fad3
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "recording_id": "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
    "patient_id": "550e8400-e29b-41d4-a716-446655440201",
    "family_name": "山田",
    "given_name": "太郎",
    "room": "305",
    "bed": "A",
    "recorded_at": "2025-10-03T07:12:59.942Z",
    "audio_file_path": "uploads/voice/ab721937-5ecd-4a98-8069-d57f98b30ea1-1759475579933.mp3",
    "transcription_text": "はい、宮本と申します。...",
    "transcription_language": "ja",
    "ai_structured_extraction": { ... },
    "ai_confidence_score": "0.92",
    "processing_status": "completed",
    "processing_started_at": "2025-10-03T07:13:58.605Z",
    "processing_completed_at": "2025-10-03T07:16:23.917Z",
    "processing_error": null,
    "recorded_by": "550e8400-e29b-41d4-a716-446655440101",
    "created_at": "2025-10-03T07:12:59.943Z"
  },
  "language": "en",
  "message": "Success"
}
```

---

### 5. Delete Recording

Delete a recording and its associated audio file.

**Endpoint**: `DELETE /api/voice/recording/:recording_id`

**Example Request**:

```bash
curl -k -X DELETE https://api.nagare.local/api/voice/recording/6e6a51ee-c2ef-40e1-80c4-d0198db4fad3
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": { ... },
  "language": "en",
  "message": "Recording deleted successfully"
}
```

---

## Complete Workflow Example

### Scenario: Process a nursing handoff recording

**Step 1: Upload the recording**

```bash
RESPONSE=$(curl -k -X POST https://api.nagare.local/api/voice/upload \
  -F "audio=@nursing-handoff.mp3" \
  -F "patient_id=550e8400-e29b-41d4-a716-446655440201" \
  -F "recorded_by=550e8400-e29b-41d4-a716-446655440101")

# Extract recording_id from response
RECORDING_ID=$(echo $RESPONSE | jq -r '.data.recording_id')
echo "Recording ID: $RECORDING_ID"
```

**Step 2: Start processing**

```bash
curl -k -X POST https://api.nagare.local/api/voice/process \
  -H "Content-Type: application/json" \
  -d "{\"recording_id\": \"$RECORDING_ID\"}"
```

**Step 3: Poll for completion**

```bash
# Poll every 10 seconds
while true; do
  STATUS=$(curl -sk https://api.nagare.local/api/voice/status/$RECORDING_ID | jq -r '.data.status')
  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  sleep 10
done

# Get final results
curl -k https://api.nagare.local/api/voice/status/$RECORDING_ID | jq '.'
```

**Step 4: Retrieve full details**

```bash
curl -k https://api.nagare.local/api/voice/recording/$RECORDING_ID | jq '.'
```

---

## WebSocket Real-Time Updates (Socket.IO)

For real-time progress updates instead of polling, connect to Socket.IO.

**Connection**:

```javascript
import io from 'socket.io-client';

const socket = io('https://api.nagare.local', {
  rejectUnauthorized: false, // For self-signed certs
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to server');
});
```

**Listen for progress events**:

```javascript
socket.on('voice-processing-progress', (data) => {
  console.log('Progress update:', data);

  /*
  Example data:
  {
    recording_id: "6e6a51ee-c2ef-40e1-80c4-d0198db4fad3",
    status: "processing",
    phase: "transcription",
    message: "Transcribing audio with Whisper...",
    progress: 50
  }
  */

  if (data.status === 'completed') {
    console.log('Processing complete!');
    console.log('Transcription:', data.data.transcription);
    console.log('Structured data:', data.data.structured_data);
  }

  if (data.status === 'failed') {
    console.error('Processing failed:', data.error);
  }
});
```

**Event phases**:

| Phase | Description | Progress |
|-------|-------------|----------|
| `starting` | Job initialized | 0% |
| `transcription` | Whisper processing audio | 10-50% |
| `extraction` | Ollama extracting structured data | 50-90% |
| `saving` | Writing results to database | 90% |
| `done` | Complete | 100% |
| `error` | Failed | - |

**Complete Socket.IO example**:

```javascript
// Start processing
const response = await fetch('https://api.nagare.local/api/voice/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ recording_id: recordingId })
});

const { recording_id } = await response.json();

// Listen for updates
socket.on('voice-processing-progress', (data) => {
  if (data.recording_id === recording_id) {
    updateUI(data); // Update progress bar, show messages, etc.

    if (data.status === 'completed') {
      displayResults(data.data);
    }
  }
});
```

---

## Data Structures

### Structured Data Format

The AI extraction returns a custom nursing handoff format:

```json
{
  "patients": [
    {
      "name": "山田 太郎",
      "room": "305-A",
      "status": "stable"
    }
  ],
  "vital_signs": [
    {
      "type": "blood_pressure",
      "value": "120/80",
      "time": "08:00"
    },
    {
      "type": "temperature",
      "value": "36.5°C",
      "time": "08:00"
    }
  ],
  "observations": [
    "咳、鼻水",
    "微熱",
    "食欲良好"
  ],
  "actions_taken": [
    "コロナとインフルエンザの検査は陰性",
    "お胸の音を聞きました",
    "症状に対するお薬をお出ししました"
  ],
  "follow_up_needed": [
    "症状が良くなったら、保育園復帰可能"
  ]
}
```

**Note**: This format is defined by your custom Ollama prompt. Fields may vary based on the medical terminology and structure you've configured.

---

## Error Handling

### Common Error Scenarios

**1. Patient/Staff UUID Not Found**

```json
{
  "success": false,
  "error": "Error",
  "language": "en"
}
```

**Solution**: Verify UUIDs exist in database:

```sql
SELECT patient_id, family_name, given_name FROM patients;
SELECT staff_id, family_name, given_name FROM staff;
```

**2. Processing Timeout (Should not happen with async)**

If using synchronous mode (`async: false`), you may get 504 errors for long recordings.

**Solution**: Always use async mode (default).

**3. AI Services Unavailable**

```json
{
  "success": true,
  "data": {
    "status": "failed",
    "error": "Whisper service unavailable"
  }
}
```

**Solution**: Check AI services are running:

```bash
# Check Whisper
curl http://172.18.0.1:8080/health

# Check Ollama
curl http://172.18.0.1:11434/api/tags

# Check backend logs
docker logs nagare-backend --tail 100
```

**4. File Upload Size Exceeded**

```json
{
  "success": false,
  "error": "File too large",
  "language": "en"
}
```

**Solution**: Maximum file size is 50MB. Compress audio or reduce quality.

---

## Performance Considerations

### Expected Processing Times

| Audio Duration | Whisper Time | Ollama Time | Total |
|----------------|--------------|-------------|-------|
| 30 seconds | ~20s | ~30s | ~50s |
| 1 minute | ~40s | ~60s | ~100s |
| 2 minutes | ~70s | ~80s | ~150s |
| 5 minutes | ~180s | ~120s | ~300s |

**Factors affecting speed**:
- CPU cores (Ollama uses `OLLAMA_NUM_THREAD`)
- Model size (`medium` vs `large-v3` for Whisper)
- System memory and I/O
- Concurrent processing (sequential model loading to save RAM)

### Optimization Tips

**1. Adjust Whisper model size** (`.env`):

```bash
WHISPER_MODEL=base     # Fastest, less accurate
WHISPER_MODEL=medium   # Balanced (current)
WHISPER_MODEL=large-v3 # Most accurate, slowest
```

**2. Tune Ollama threads** (systemd override):

```ini
Environment="OLLAMA_NUM_THREAD=8"  # Match CPU cores
```

**3. Use WebSocket instead of polling**:
- Reduces server load
- Instant updates
- Better UX

---

## Security Considerations

### SSL/TLS

All API endpoints use HTTPS with local CA certificates:

- **Certificate**: `/opt/verbumcare/ssl/certs/nginx.crt`
- **CA Certificate**: `/opt/verbumcare/ssl/certs/ca.crt` (install on clients)

### CORS

Backend only accepts requests from configured domains:

```bash
CLIENT_URLS=https://admin.nagare.local,https://api.nagare.local
```

### Authentication

**Current**: No authentication (LAN-only deployment)

**Production TODO**:
- Add JWT authentication
- Implement role-based access control (RBAC)
- Add audit logging for HIPAA compliance

### File Security

- Audio files stored in `/app/uploads/voice/`
- UUIDs prevent filename guessing
- Files deleted when recording is deleted
- No direct file access via URL (served through API only)

---

## Database Schema

### voice_recordings Table

```sql
CREATE TABLE voice_recordings (
    recording_id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(patient_id),
    recorded_at TIMESTAMP NOT NULL,
    duration_seconds INTEGER,
    audio_file_path TEXT,
    transcription_text TEXT,
    transcription_language VARCHAR(10),
    ai_structured_extraction JSONB,
    ai_confidence_score DECIMAL(3,2),

    -- Async processing columns
    processing_status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_error TEXT,

    recorded_by UUID REFERENCES staff(staff_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_voice_recordings_status ON voice_recordings(processing_status);
CREATE INDEX idx_voice_recordings_patient_status ON voice_recordings(patient_id, processing_status);
```

---

## Troubleshooting

### Check System Status

```bash
# All containers healthy?
docker ps

# Backend logs
docker logs nagare-backend --tail 50 -f

# nginx logs
docker logs nagare-nginx --tail 50

# Database connection
docker exec nagare-postgres psql -U nagare -d nagare_db -c "SELECT COUNT(*) FROM voice_recordings;"

# AI services
curl http://172.18.0.1:8080/health
curl http://172.18.0.1:11434/api/tags
```

### Common Issues

**Issue**: "Recording is already being processed"

**Cause**: Duplicate request or previous request didn't complete

**Solution**: Wait for completion or check status, then retry

---

**Issue**: Slow processing (>5 minutes)

**Cause**: System overloaded or large audio file

**Solution**:
- Check CPU usage: `htop`
- Reduce concurrent jobs
- Upgrade to faster Whisper model

---

**Issue**: "Whisper service unavailable"

**Cause**: faster-whisper systemd service not running

**Solution**:

```bash
sudo systemctl status whisper-api
sudo systemctl restart whisper-api
sudo journalctl -u whisper-api -f
```

---

## Testing with Sample Data

### Demo Patient UUIDs

From seed data (`backend/src/db/seed.sql`):

```bash
# Patient: 山田太郎 (Yamada Taro) - Room 305-A
PATIENT_ID="550e8400-e29b-41d4-a716-446655440201"

# Nurse: 佐藤美咲 (Sato Misaki)
NURSE_ID="550e8400-e29b-41d4-a716-446655440101"
```

### Quick Test Script

```bash
#!/bin/bash

PATIENT_ID="550e8400-e29b-41d4-a716-446655440201"
NURSE_ID="550e8400-e29b-41d4-a716-446655440101"

# 1. Upload
echo "Uploading recording..."
RESPONSE=$(curl -sk -X POST https://api.nagare.local/api/voice/upload \
  -F "audio=@test-recording.mp3" \
  -F "patient_id=$PATIENT_ID" \
  -F "recorded_by=$NURSE_ID")

RECORDING_ID=$(echo $RESPONSE | jq -r '.data.recording_id')
echo "Recording ID: $RECORDING_ID"

# 2. Process
echo "Starting processing..."
curl -sk -X POST https://api.nagare.local/api/voice/process \
  -H "Content-Type: application/json" \
  -d "{\"recording_id\": \"$RECORDING_ID\"}" | jq '.'

# 3. Poll
echo "Polling for completion..."
while true; do
  STATUS=$(curl -sk https://api.nagare.local/api/voice/status/$RECORDING_ID | jq -r '.data.status')
  echo "  Status: $STATUS ($(date +%H:%M:%S))"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  sleep 10
done

# 4. Results
echo "Final results:"
curl -sk https://api.nagare.local/api/voice/status/$RECORDING_ID | jq '.data'
```

---

## Next Steps

1. **Build admin portal** to consume this API
2. **Implement authentication** (JWT tokens)
3. **Add batch processing** endpoint for multiple recordings
4. **Create webhook notifications** for integration with external systems
5. **Add cloud sync** (when `CLOUD_SYNC_ENABLED=true`)

---

## Support

**Documentation**:
- `/docs/SYSTEMD_SERVICES.md` - AI service configuration
- `/backend/.env.nagare` - Backend configuration
- `/.env.example` - Docker environment variables

**Logs**:
```bash
# Backend
docker logs nagare-backend -f

# nginx
docker logs nagare-nginx -f

# Database
docker logs nagare-postgres -f
```

**Health Checks**:
```bash
curl -k https://api.nagare.local/health
```

---

**Last Updated**: 2025-10-03
**Version**: 1.0.0 (Async processing)
**Product**: Verbumcare Nagare (流れ) - Japan Edge Server
