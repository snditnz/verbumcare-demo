# Voice Categorization Database Schema

## Overview

The voice categorization feature extends the VerbumCare database with three new tables to support AI-powered voice processing, review queues, and audit logging.

## New Tables

### voice_review_queue

Stores pending voice reviews awaiting user approval.

```sql
CREATE TABLE voice_review_queue (
    review_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recording_id UUID NOT NULL REFERENCES voice_recordings(recording_id),
    user_id UUID NOT NULL REFERENCES staff(staff_id),
    
    -- Context Information
    context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('patient', 'global')),
    context_patient_id UUID REFERENCES patients(patient_id),
    
    -- AI Processing Results
    transcript TEXT NOT NULL,
    transcript_language VARCHAR(10) NOT NULL CHECK (transcript_language IN ('ja', 'en', 'zh-TW')),
    extracted_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Review State
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'confirmed', 'discarded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    
    -- Processing Metadata
    processing_time_ms INTEGER,
    model_version VARCHAR(50),
    
    -- Constraints
    CONSTRAINT valid_patient_context CHECK (
        (context_type = 'patient' AND context_patient_id IS NOT NULL) OR
        (context_type = 'global' AND context_patient_id IS NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_review_queue_user_status ON voice_review_queue(user_id, status);
CREATE INDEX idx_review_queue_created ON voice_review_queue(created_at);
CREATE INDEX idx_review_queue_patient ON voice_review_queue(context_patient_id);
CREATE INDEX idx_review_queue_status ON voice_review_queue(status);

-- JSONB indexes for extracted data queries
CREATE INDEX idx_review_queue_categories ON voice_review_queue 
    USING GIN ((extracted_data->'categories'));
```

### voice_categorization_log

Audit trail for AI categorization decisions and user corrections.

```sql
CREATE TABLE voice_categorization_log (
    log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES voice_review_queue(review_id),
    
    -- Categorization Details
    detected_categories JSONB NOT NULL,
    extraction_prompt TEXT,
    extraction_response TEXT,
    
    -- User Corrections
    user_edited_transcript BOOLEAN DEFAULT FALSE,
    user_edited_data BOOLEAN DEFAULT FALSE,
    reanalysis_count INTEGER DEFAULT 0,
    
    -- Audit Information
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    confirmed_by UUID REFERENCES staff(staff_id),
    
    -- AI Model Information
    model_version VARCHAR(50),
    model_temperature DECIMAL(3,2),
    model_context_length INTEGER
);

-- Indexes
CREATE INDEX idx_categorization_log_review ON voice_categorization_log(review_id);
CREATE INDEX idx_categorization_log_created ON voice_categorization_log(created_at);
CREATE INDEX idx_categorization_log_confirmed_by ON voice_categorization_log(confirmed_by);

-- JSONB index for category analysis
CREATE INDEX idx_categorization_log_categories ON voice_categorization_log 
    USING GIN (detected_categories);
```

### Modified voice_recordings Table

Extended to support review workflow and context tracking.

```sql
-- Add new columns to existing voice_recordings table
ALTER TABLE voice_recordings
ADD COLUMN review_status VARCHAR(20) DEFAULT 'not_reviewed' 
    CHECK (review_status IN ('not_reviewed', 'pending_review', 'reviewed', 'discarded')),
ADD COLUMN context_type VARCHAR(20) CHECK (context_type IN ('patient', 'global')),
ADD COLUMN context_patient_id UUID REFERENCES patients(patient_id);

-- Add constraint for context consistency
ALTER TABLE voice_recordings
ADD CONSTRAINT valid_voice_context CHECK (
    (context_type = 'patient' AND context_patient_id IS NOT NULL) OR
    (context_type = 'global' AND context_patient_id IS NULL) OR
    (context_type IS NULL AND context_patient_id IS NULL)
);

-- Add indexes
CREATE INDEX idx_voice_recordings_review_status ON voice_recordings(review_status);
CREATE INDEX idx_voice_recordings_context ON voice_recordings(context_type, context_patient_id);
```

## Data Types and Structures

### extracted_data JSONB Structure

The `extracted_data` column stores AI extraction results in this format:

```json
{
  "categories": [
    {
      "type": "vitals",
      "confidence": 0.92,
      "data": {
        "blood_pressure": {
          "systolic": 120,
          "diastolic": 80
        },
        "heart_rate": 72,
        "temperature": 36.8
      },
      "fieldConfidences": {
        "blood_pressure.systolic": 0.95,
        "blood_pressure.diastolic": 0.89,
        "heart_rate": 0.94,
        "temperature": 0.88
      }
    },
    {
      "type": "medication",
      "confidence": 0.87,
      "data": {
        "medication_name": "アムロジピン",
        "dose": "5mg",
        "route": "PO",
        "time": "2024-01-15T08:00:00Z"
      },
      "fieldConfidences": {
        "medication_name": 0.92,
        "dose": 0.85,
        "route": 0.89,
        "time": 0.83
      }
    }
  ],
  "overallConfidence": 0.895,
  "processingMetadata": {
    "transcriptionTime": 15000,
    "categorizationTime": 25000,
    "extractionTime": 18000,
    "totalTime": 58000
  }
}
```

### detected_categories JSONB Structure

The `detected_categories` column in the log table stores category detection results:

```json
{
  "detectedCategories": ["vitals", "medication", "clinical_note"],
  "categoryConfidences": {
    "vitals": 0.94,
    "medication": 0.87,
    "clinical_note": 0.76
  },
  "rejectedCategories": {
    "adl": 0.23,
    "incident": 0.15
  },
  "detectionThreshold": 0.6
}
```

## Relationships

### Foreign Key Relationships

```
voice_review_queue
├── recording_id → voice_recordings.recording_id
├── user_id → staff.staff_id
└── context_patient_id → patients.patient_id

voice_categorization_log
├── review_id → voice_review_queue.review_id
└── confirmed_by → staff.staff_id

voice_recordings (modified)
└── context_patient_id → patients.patient_id
```

### Data Flow Relationships

1. **Voice Recording** → `voice_recordings` table
2. **AI Processing** → Creates `voice_review_queue` entry
3. **Categorization Logging** → Creates `voice_categorization_log` entry
4. **User Review** → Updates `voice_review_queue.status`
5. **Data Confirmation** → Inserts into target tables (vital_signs, medications, etc.)

## Queries and Views

### Common Queries

#### Get User's Pending Reviews
```sql
SELECT 
    vr.review_id,
    vr.transcript,
    vr.extracted_data,
    vr.confidence_score,
    vr.created_at,
    p.family_name || ' ' || p.given_name AS patient_name,
    EXTRACT(EPOCH FROM (NOW() - vr.created_at)) / 3600 AS hours_old
FROM voice_review_queue vr
LEFT JOIN patients p ON vr.context_patient_id = p.patient_id
WHERE vr.user_id = $1 
    AND vr.status = 'pending'
ORDER BY vr.created_at ASC;
```

#### Get Review Queue Statistics
```sql
SELECT 
    user_id,
    COUNT(*) as total_pending,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > 24) as urgent_count,
    AVG(confidence_score) as avg_confidence,
    MIN(created_at) as oldest_review
FROM voice_review_queue 
WHERE status = 'pending'
GROUP BY user_id;
```

#### Category Detection Analytics
```sql
SELECT 
    jsonb_array_elements_text(vcl.detected_categories->'detectedCategories') as category,
    COUNT(*) as detection_count,
    AVG((vcl.detected_categories->'categoryConfidences'->>jsonb_array_elements_text(vcl.detected_categories->'detectedCategories'))::decimal) as avg_confidence
FROM voice_categorization_log vcl
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY category
ORDER BY detection_count DESC;
```

### Useful Views

#### review_queue_summary
```sql
CREATE VIEW review_queue_summary AS
SELECT 
    vr.review_id,
    vr.user_id,
    s.family_name || ' ' || s.given_name AS user_name,
    vr.context_type,
    CASE 
        WHEN vr.context_type = 'patient' THEN p.family_name || ' ' || p.given_name
        ELSE 'Global Recording'
    END AS context_name,
    vr.transcript,
    vr.confidence_score,
    vr.status,
    vr.created_at,
    EXTRACT(EPOCH FROM (NOW() - vr.created_at)) / 3600 AS hours_old,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - vr.created_at)) / 3600 > 24 THEN true
        ELSE false
    END AS is_urgent,
    jsonb_array_length(vr.extracted_data->'categories') AS category_count
FROM voice_review_queue vr
JOIN staff s ON vr.user_id = s.staff_id
LEFT JOIN patients p ON vr.context_patient_id = p.patient_id;
```

#### categorization_metrics
```sql
CREATE VIEW categorization_metrics AS
SELECT 
    DATE_TRUNC('day', vcl.created_at) AS date,
    COUNT(*) AS total_categorizations,
    COUNT(*) FILTER (WHERE vcl.user_edited_transcript = true) AS transcript_edits,
    COUNT(*) FILTER (WHERE vcl.user_edited_data = true) AS data_edits,
    AVG(vcl.reanalysis_count) AS avg_reanalysis_count,
    COUNT(*) FILTER (WHERE vcl.confirmed_at IS NOT NULL) AS confirmed_count
FROM voice_categorization_log vcl
GROUP BY DATE_TRUNC('day', vcl.created_at)
ORDER BY date DESC;
```

## Data Retention and Archival

### Retention Policies

1. **voice_review_queue**: 
   - Confirmed/discarded reviews: 90 days
   - Pending reviews: Auto-archive after 7 days

2. **voice_categorization_log**: 
   - Keep for 2 years for audit purposes
   - Archive to cold storage after 1 year

3. **voice_recordings**: 
   - Audio files: Delete after processing (transcript retained)
   - Metadata: Keep for 7 years (regulatory compliance)

### Archival Procedures

#### Auto-archive Old Reviews
```sql
-- Move old pending reviews to archive
INSERT INTO voice_review_queue_archive 
SELECT * FROM voice_review_queue 
WHERE status = 'pending' 
    AND created_at < NOW() - INTERVAL '7 days';

DELETE FROM voice_review_queue 
WHERE status = 'pending' 
    AND created_at < NOW() - INTERVAL '7 days';
```

#### Cleanup Confirmed Reviews
```sql
-- Archive confirmed reviews older than 90 days
INSERT INTO voice_review_queue_archive 
SELECT * FROM voice_review_queue 
WHERE status IN ('confirmed', 'discarded') 
    AND reviewed_at < NOW() - INTERVAL '90 days';

DELETE FROM voice_review_queue 
WHERE status IN ('confirmed', 'discarded') 
    AND reviewed_at < NOW() - INTERVAL '90 days';
```

## Performance Optimization

### Index Strategy

1. **Composite indexes** for common query patterns
2. **JSONB GIN indexes** for category and confidence queries
3. **Partial indexes** for active reviews only
4. **Time-based partitioning** for large datasets

### Query Optimization

1. Use `LIMIT` and `OFFSET` for pagination
2. Filter by `user_id` first in all user-specific queries
3. Use `status` index for queue filtering
4. Leverage JSONB operators for category queries

### Monitoring Queries

#### Table Sizes
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE tablename LIKE 'voice_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Index Usage
```sql
SELECT 
    indexrelname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
    AND indexrelname LIKE '%voice%'
ORDER BY idx_scan DESC;
```

---

*For migration scripts and detailed setup instructions, see the Database Migration Guide.*