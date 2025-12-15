#!/bin/bash

echo "=== Voice Upload Debug Test ==="
echo "Testing what the backend receives from iPad app uploads"
echo ""

echo "1. Checking recent backend logs for upload requests..."
ssh verbumcare-lab.local "docker logs --tail=20 nagare-backend | grep -E '(Voice upload|duration|POST.*voice)'"

echo ""
echo "2. Checking if encryption is still happening..."
ssh verbumcare-lab.local "docker logs --tail=20 nagare-backend | grep -E '(Encrypt|encrypt)'"

echo ""
echo "3. Current review queue status..."
curl -s -k "https://verbumcare-lab.local/api/voice/review-queue/550e8400-e29b-41d4-a716-446655440105" \
  -H "Accept: application/json" | jq '.data.queue[] | {review_id, duration_seconds, transcript: .transcript[0:50]}' 2>/dev/null || echo "No review items or API error"

echo ""
echo "=== Next Steps ==="
echo "1. Make a new voice recording in the iPad app"
echo "2. Check if duration_seconds appears in the backend logs"
echo "3. Check if encryption is disabled (should see 'Skipping audio file encryption')"
echo "4. Check if Whisper transcription works without encryption"