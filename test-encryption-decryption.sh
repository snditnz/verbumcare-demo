#!/bin/bash

echo "=== Testing Encryption + Decryption + Transcription Flow ==="
echo "This tests the complete flow: Upload -> Encrypt -> Categorize -> Decrypt -> Transcribe"
echo ""

# Create a simple test audio file (1 second of silence)
echo "Creating test audio file..."
ffmpeg -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=44100" -t 1 -f wav test_audio.wav -y 2>/dev/null

if [ ! -f test_audio.wav ]; then
    echo "❌ Could not create test audio file (ffmpeg not available)"
    echo "Please make a recording in the iPad app and check the results"
    exit 1
fi

echo "✅ Test audio file created"
echo ""

# Step 1: Upload (should encrypt)
echo "Step 1: Uploading and encrypting..."
UPLOAD_RESPONSE=$(curl -s -k -X POST "https://verbumcare-lab.local/api/voice/upload" \
  -F "audio=@test_audio.wav" \
  -F "recorded_by=550e8400-e29b-41d4-a716-446655440105" \
  -F "context_type=global" \
  -F "duration_seconds=5")

RECORDING_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.recording_id')
echo "Recording ID: $RECORDING_ID"

# Check upload logs
echo ""
echo "Upload logs:"
ssh verbumcare-lab.local "docker logs --tail=5 nagare-backend | grep -E '(🔒|Encrypt)'"

# Step 2: Categorize (should decrypt for transcription)
echo ""
echo "Step 2: Categorizing (should decrypt for Whisper)..."
CATEGORIZE_RESPONSE=$(curl -s -k -X POST "https://verbumcare-lab.local/api/voice/categorize" \
  -H "Content-Type: application/json" \
  -d "{\"recording_id\": \"$RECORDING_ID\"}")

echo "Categorization result:"
echo "$CATEGORIZE_RESPONSE" | jq '.success, .data.status'

# Check categorization logs
echo ""
echo "Categorization logs:"
ssh verbumcare-lab.local "docker logs --tail=10 nagare-backend | grep -E '(🔓|Decrypt|🎤|Whisper|transcript)'"

# Cleanup
rm -f test_audio.wav

echo ""
echo "=== Expected Results ==="
echo "✅ Upload should show: '🔒 Encrypting uploaded audio file...'"
echo "✅ Categorize should show: '🔓 Decrypting audio file for transcription...'"
echo "✅ Should NOT show Whisper errors about invalid data"
echo "✅ Should show actual transcription instead of dummy data"