#!/bin/bash

# Test Confirm Endpoint to Debug 500 Error
set -e

API_BASE="https://verbumcare-lab.local/api"
DEMO_USER_ID="550e8400-e29b-41d4-a716-446655440105"

echo "🧪 Testing Confirm Endpoint - Debug 500 Error"
echo "============================================="

# Step 1: Login
echo "1. 🔐 Logging in..."
LOGIN_RESPONSE=$(curl -k -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo123"
  }')

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Login successful"

# Step 2: Create a test recording and get review ID
echo ""
echo "2. 🎤 Creating test recording..."

TEST_AUDIO_FILE="/tmp/test_confirm.m4a"
echo -n "" > "$TEST_AUDIO_FILE"

UPLOAD_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/upload" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "audio=@$TEST_AUDIO_FILE" \
  -F "recorded_by=$DEMO_USER_ID" \
  -F "context_type=patient" \
  -F "context_patient_id=550e8400-e29b-41d4-a716-446655440201" \
  -F "duration_seconds=5")

RECORDING_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.recording_id // empty')

if [ -z "$RECORDING_ID" ]; then
  echo "❌ Failed to upload recording"
  echo "Upload response: $UPLOAD_RESPONSE"
  exit 1
fi

echo "✅ Recording uploaded: $RECORDING_ID"

# Step 3: Categorize to create review item
echo ""
echo "3. 🔍 Categorizing..."

CATEGORIZE_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/categorize" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "'$RECORDING_ID'",
    "manual_corrections": {
      "transcript": "患者の血圧は120/80、体温は36.5度です。"
    }
  }')

REVIEW_ID=$(echo "$CATEGORIZE_RESPONSE" | jq -r '.data.review_id // empty')

if [ -z "$REVIEW_ID" ]; then
  echo "❌ Failed to categorize"
  echo "Categorize response: $CATEGORIZE_RESPONSE"
  exit 1
fi

echo "✅ Categorized, review ID: $REVIEW_ID"

# Step 4: Test confirm endpoint with detailed error logging
echo ""
echo "4. ✅ Testing confirm endpoint..."

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
            "blood_pressure": "120/80",
            "temperature": "36.5"
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
            "blood_pressure": "120/80",
            "temperature": "36.5"
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

echo ""
echo "HTTP Status Code: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "500" ]; then
  echo "❌ 500 Internal Server Error detected!"
  echo ""
  echo "🔍 Checking backend logs for error details..."
  ssh verbumcare-lab.local "docker logs nagare-backend --tail 20"
else
  echo "✅ Request successful (status: $HTTP_STATUS)"
fi

# Clean up
rm -f "$TEST_AUDIO_FILE"