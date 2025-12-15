#!/bin/bash

echo "=== Debugging Duration Issue ==="
echo "Checking why duration_seconds is null in API response but exists in database"
echo ""

echo "1. Direct database query (should show duration):"
ssh verbumcare-lab.local "docker exec nagare-postgres psql -U nagare -d nagare_db -c \"
SELECT 
  vrq.review_id,
  vrq.recording_id,
  vr.duration_seconds,
  COALESCE(vr.duration_seconds, 0) as coalesced_duration
FROM voice_review_queue vrq
LEFT JOIN voice_recordings vr ON vrq.recording_id = vr.recording_id
WHERE vrq.user_id = '550e8400-e29b-41d4-a716-446655440105'
  AND vrq.status = 'pending'
ORDER BY vrq.created_at ASC
LIMIT 2;
\""

echo ""
echo "2. API response (should show duration but currently shows null):"
curl -s -k "https://verbumcare-lab.local/api/voice/review-queue/550e8400-e29b-41d4-a716-446655440105" | jq '.data.queue[] | {review_id, duration_seconds}' | head -4

echo ""
echo "3. Checking if field exists in raw API response:"
curl -s -k "https://verbumcare-lab.local/api/voice/review-queue/550e8400-e29b-41d4-a716-446655440105" | jq '.data.queue[0]' | grep -i duration || echo "No duration field found"

echo ""
echo "4. Backend logs (looking for debug info):"
ssh verbumcare-lab.local "docker logs --tail=20 nagare-backend | grep -E '(🔍|Debug|duration)'" || echo "No debug logs found"

echo ""
echo "=== Analysis ==="
echo "If step 1 shows duration but step 2 shows null, there's an issue in the Node.js query execution or response processing."
echo "If step 3 shows no duration field, the field is being filtered out somewhere."