#!/bin/bash

echo "=== Testing Backend Upload Endpoint ==="
echo "Creating a test audio file and uploading to check if duration_seconds is received"
echo ""

# Create a simple test audio file (1 second of silence)
echo "Creating test audio file..."
ffmpeg -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=44100" -t 1 -f wav test_audio.wav -y 2>/dev/null

if [ ! -f test_audio.wav ]; then
    echo "❌ Could not create test audio file (ffmpeg not available)"
    echo "Please make a recording in the iPad app and check the backend logs:"
    echo "ssh verbumcare-lab.local \"docker logs --tail=20 nagare-backend | grep -E '(Voice upload|duration|🔒)'\""
    exit 1
fi

echo "✅ Test audio file created"
echo ""

# Upload to backend
echo "Uploading test file with duration_seconds=5..."
curl -k -X POST "https://verbumcare-lab.local/api/voice/upload" \
  -F "audio=@test_audio.wav" \
  -F "recorded_by=550e8400-e29b-41d4-a716-446655440105" \
  -F "context_type=global" \
  -F "duration_seconds=5" \
  -H "Accept: application/json" 2>/dev/null | jq '.'

echo ""
echo "Checking backend logs for our test upload..."
ssh verbumcare-lab.local "docker logs --tail=10 nagare-backend | grep -E '(Voice upload|duration|🔒)'"

# Cleanup
rm -f test_audio.wav

echo ""
echo "=== Next Steps ==="
echo "1. Check if 'duration_seconds: 5' appears in the backend logs above"
echo "2. Check if '🔒 Skipping audio file encryption for debugging...' appears"
echo "3. If both appear, the backend is working correctly"
echo "4. Then test with iPad app recording"