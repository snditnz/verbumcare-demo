#!/bin/bash

echo "=== Voice Duration Fix Test ==="
echo "Testing if duration is now properly captured and displayed"
echo ""

# Test the review queue API to see if duration_seconds is included
echo "1. Testing review queue API response format..."
curl -s -k "https://verbumcare-lab.local/api/voice/review-queue/550e8400-e29b-41d4-a716-446655440105" \
  -H "Accept: application/json" | jq '.data.queue[0] | {review_id, duration_seconds, transcript}' 2>/dev/null || echo "No review items or API error"

echo ""
echo "2. Current backend status:"
ssh verbumcare-lab.local "docker logs --tail=5 nagare-backend | grep -E '(duration|Duration)'" || echo "No duration logs found"

echo ""
echo "=== Instructions for User ==="
echo "1. RESTART your iPad app completely (close from app switcher and reopen)"
echo "2. Make a new voice recording"
echo "3. Check if duration shows actual time instead of 0:00"
echo "4. Check if transcript shows your actual words instead of dummy Japanese text"
echo ""
echo "If duration is still 0:00 after restart, there may be a frontend issue."
echo "If transcript is still dummy data, the Whisper service needs investigation."