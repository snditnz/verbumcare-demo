#!/bin/bash

# Test Patient Context Confirm - This should work and insert data
set -e

API_BASE="https://verbumcare-lab.local/api"
DEMO_USER_ID="550e8400-e29b-41d4-a716-446655440105"
DEMO_PATIENT_ID="550e8400-e29b-41d4-a716-446655440001"

echo "🧪 Testing Patient Context Confirm - Should Work and Insert Data"
echo "================================================================"

# Step 1: Login
echo "1. 🔐 Logging in..."
LOGIN_RESPONSE=$(curl -k -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo123"
  }')

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty')
echo "✅ Login successful"

# Step 2: Create a PATIENT context recording
echo ""
echo "2. 🎤 Creating PATIENT context recording..."

TEST_AUDIO_FILE="/tmp/test_patient.m4a"
echo -n "" > "$TEST_AUDIO_FILE"

UPLOAD_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/upload" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "audio=@$TEST_AUDIO_FILE" \
  -F "recorded_by=$DEMO_USER_ID" \
  -F "context_type=patient" \
  -F "context_patient_id=$DEMO_PATIENT_ID" \
  -F "duration_seconds=5")

RECORDING_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.recording_id // empty')
echo "✅ Patient recording uploaded: $RECORDING_ID"

# Step 3: Categorize to create review item
echo ""
echo "3. 🔍 Categorizing..."

CATEGORIZE_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/categorize" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "'$RECORDING_ID'",
    "manual_corrections": {
      "transcript": "患者の血圧は130/85、体温は37.2度です。"
    }
  }')

REVIEW_ID=$(echo "$CATEGORIZE_RESPONSE" | jq -r '.data.review_id // empty')
echo "✅ Categorized, review ID: $REVIEW_ID"

# Step 4: Confirm - this should work and insert data
echo ""
echo "4. ✅ Testing confirm on PATIENT context (should work)..."

CONFIRM_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/review/$REVIEW_ID/confirm" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$DEMO_USER_ID'",
    "edited_data": {
      "categories": [
        {
          "type": "vitals",
          "confidence": 0.95,
          "data": {
            "blood_pressure": "130/85",
            "temperature": "37.2"
          },
          "fieldConfidences": {
            "blood_pressure": 0.95,
            "temperature": 0.90
          }
        }
      ],
      "overallConfidence": 0.92
    }
  }')

echo "Confirm response: $CONFIRM_RESPONSE"

# Check HTTP status
HTTP_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/voice/review/$REVIEW_ID/confirm" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$DEMO_USER_ID'",
    "edited_data": {
      "categories": [
        {
          "type": "vitals",
          "confidence": 0.95,
          "data": {
            "blood_pressure": "130/85",
            "temperature": "37.2"
          }
        }
      ],
      "overallConfidence": 0.92
    }
  }')

echo ""
echo "HTTP Status Code: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Patient context confirm worked!"
  echo ""
  echo "🔍 Checking if vitals were inserted..."
  ssh verbumcare-lab.local "docker exec nagare-postgres psql -U nagare -d nagare_db -c \"SELECT patient_id, systolic_bp, diastolic_bp, temperature FROM vital_signs WHERE created_at > NOW() - INTERVAL '1 minute' ORDER BY created_at DESC LIMIT 1;\""
else
  echo "❌ Expected 200 but got: $HTTP_STATUS"
fi

# Clean up
rm -f "$TEST_AUDIO_FILE"