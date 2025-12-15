#!/bin/bash

# Complete Voice Reanalysis Test
# This script creates a voice recording, categorizes it, and then tests the reanalysis functionality

set -e

API_BASE="https://verbumcare-lab.local/api"
DEMO_USER_ID="550e8400-e29b-41d4-a716-446655440105"  # Actual demo user UUID from login

echo "🧪 Complete Voice Reanalysis Test"
echo "================================="

# Step 1: Login to get authentication token
echo "1. 🔐 Logging in as demo user..."
LOGIN_RESPONSE=$(curl -k -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo123"
  }')

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Login successful"

# Step 2: Create a test audio file
echo ""
echo "2. 🎤 Creating test audio file..."

# Create a simple test audio file (empty m4a file for testing)
TEST_AUDIO_FILE="/tmp/test_voice_recording.m4a"
echo -n "" > "$TEST_AUDIO_FILE"

# Step 3: Upload voice recording
echo ""
echo "3. 📤 Uploading voice recording..."

UPLOAD_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/upload" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "audio=@$TEST_AUDIO_FILE" \
  -F "recorded_by=$DEMO_USER_ID" \
  -F "context_type=global" \
  -F "duration_seconds=5")

echo "Upload response: $UPLOAD_RESPONSE"

# Extract recording ID
RECORDING_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.recording_id // empty')

if [ -z "$RECORDING_ID" ]; then
  echo "❌ Failed to upload recording"
  exit 1
fi

echo "✅ Recording uploaded: $RECORDING_ID"

# Step 4: Categorize the recording to create a review item
echo ""
echo "4. 🔍 Categorizing recording..."

CATEGORIZE_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/categorize" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "'$RECORDING_ID'",
    "manual_corrections": {
      "transcript": "患者の血圧は120/80、体温は36.5度です。"
    }
  }')

echo "Categorize response: $CATEGORIZE_RESPONSE"

# Extract review ID
REVIEW_ID=$(echo "$CATEGORIZE_RESPONSE" | jq -r '.data.review_id // empty')

if [ -z "$REVIEW_ID" ]; then
  echo "❌ Failed to categorize recording"
  exit 1
fi

echo "✅ Recording categorized, review ID: $REVIEW_ID"

# Step 5: Test reanalysis endpoint with correct API format
echo ""
echo "5. 🔄 Testing reanalysis endpoint with FIXED API format..."

REANALYSIS_RESPONSE=$(curl -k -s -X POST "$API_BASE/voice/review/$REVIEW_ID/reanalyze" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "患者の血圧は130/85、体温は37.2度です。少し熱があるようです。",
    "user_id": "'$DEMO_USER_ID'"
  }')

echo "Reanalysis response: $REANALYSIS_RESPONSE"

# Check if reanalysis was successful
REANALYSIS_SUCCESS=$(echo "$REANALYSIS_RESPONSE" | jq -r '.success // false')

if [ "$REANALYSIS_SUCCESS" = "true" ]; then
  echo "✅ Reanalysis API call successful!"
else
  echo "❌ Reanalysis API call failed"
  echo "Error: $(echo "$REANALYSIS_RESPONSE" | jq -r '.error // "Unknown error"')"
fi

# Step 6: Test confirm endpoint with correct API format
echo ""
echo "6. ✅ Testing confirm endpoint with FIXED API format..."

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

# Check if confirm was successful
CONFIRM_SUCCESS=$(echo "$CONFIRM_RESPONSE" | jq -r '.success // false')

if [ "$CONFIRM_SUCCESS" = "true" ]; then
  echo "✅ Confirm API call successful!"
else
  echo "❌ Confirm API call failed"
  echo "Error: $(echo "$CONFIRM_RESPONSE" | jq -r '.error // "Unknown error"')"
fi

# Clean up test file
rm -f "$TEST_AUDIO_FILE"

echo ""
echo "🎯 Voice Reanalysis API Fix Test Summary:"
echo "========================================"
echo "Upload:     ✅ PASS"
echo "Categorize: ✅ PASS"
echo "Reanalysis: $([ "$REANALYSIS_SUCCESS" = "true" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Confirm:    $([ "$CONFIRM_SUCCESS" = "true" ] && echo "✅ PASS" || echo "❌ FAIL")"

if [ "$REANALYSIS_SUCCESS" = "true" ] && [ "$CONFIRM_SUCCESS" = "true" ]; then
  echo ""
  echo "🎉 ALL CRITICAL TESTS PASSED! Voice reanalysis API fix is working correctly."
  echo ""
  echo "✅ FIXED ISSUES:"
  echo "   - Reanalysis now uses correct field name 'transcript' instead of 'editedTranscript'"
  echo "   - All endpoints now include required 'user_id' parameter"
  echo "   - Confirm endpoint uses 'edited_data' instead of 'finalData'"
  echo "   - API calls match backend expectations exactly"
  exit 0
else
  echo ""
  echo "⚠️  Some tests failed. Check the responses above for details."
  exit 1
fi