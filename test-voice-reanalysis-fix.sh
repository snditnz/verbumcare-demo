#!/bin/bash

# Test Voice Reanalysis API Fix
# This script tests the fixed API endpoints for voice reanalysis functionality

set -e

API_BASE="https://verbumcare-lab.local/api"
DEMO_USER_ID="550e8400-e29b-41d4-a716-446655440000"  # Demo user UUID

echo "🧪 Testing Voice Reanalysis API Fix"
echo "=================================="

# Step 1: Login to get authentication token
echo "1. 🔐 Logging in as demo user..."
LOGIN_RESPONSE=$(curl -k -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo123"
  }')

echo "Login response: $LOGIN_RESPONSE"

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Login successful, got access token"

# Step 2: Get review queue to find a review item
echo ""
echo "2. 📋 Fetching review queue..."
QUEUE_RESPONSE=$(curl -k -s -X GET "$API_BASE/voice/review-queue/$DEMO_USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Queue response: $QUEUE_RESPONSE"

# Extract first review ID
REVIEW_ID=$(echo "$QUEUE_RESPONSE" | jq -r '.data.queue[0].review_id // empty')

if [ -z "$REVIEW_ID" ]; then
  echo "⚠️  No review items found in queue. Creating a test recording first..."
  
  # Create a test recording (simplified - would normally upload audio file)
  echo "Creating test voice recording..."
  
  # For now, let's just test with a mock review ID
  REVIEW_ID="test-review-id-123"
  echo "Using mock review ID: $REVIEW_ID"
else
  echo "✅ Found review item: $REVIEW_ID"
fi

# Step 3: Test reanalysis endpoint with correct API format
echo ""
echo "3. 🔄 Testing reanalysis endpoint with FIXED API format..."

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

# Step 4: Test confirm endpoint with correct API format
echo ""
echo "4. ✅ Testing confirm endpoint with FIXED API format..."

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

# Step 5: Test discard endpoint with correct API format
echo ""
echo "5. 🗑️  Testing discard endpoint with FIXED API format..."

DISCARD_RESPONSE=$(curl -k -s -X DELETE "$API_BASE/voice/review/$REVIEW_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$DEMO_USER_ID'"
  }')

echo "Discard response: $DISCARD_RESPONSE"

# Check if discard was successful
DISCARD_SUCCESS=$(echo "$DISCARD_RESPONSE" | jq -r '.success // false')

if [ "$DISCARD_SUCCESS" = "true" ]; then
  echo "✅ Discard API call successful!"
else
  echo "❌ Discard API call failed"
  echo "Error: $(echo "$DISCARD_RESPONSE" | jq -r '.error // "Unknown error"')"
fi

echo ""
echo "🎯 Voice Reanalysis API Fix Test Summary:"
echo "========================================"
echo "Reanalysis: $([ "$REANALYSIS_SUCCESS" = "true" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Confirm:    $([ "$CONFIRM_SUCCESS" = "true" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "Discard:    $([ "$DISCARD_SUCCESS" = "true" ] && echo "✅ PASS" || echo "❌ FAIL")"

if [ "$REANALYSIS_SUCCESS" = "true" ] && [ "$CONFIRM_SUCCESS" = "true" ] && [ "$DISCARD_SUCCESS" = "true" ]; then
  echo ""
  echo "🎉 ALL TESTS PASSED! Voice reanalysis API fix is working correctly."
  exit 0
else
  echo ""
  echo "⚠️  Some tests failed. Check the responses above for details."
  exit 1
fi