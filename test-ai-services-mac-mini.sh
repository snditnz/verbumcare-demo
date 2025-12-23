#!/bin/bash

# Test AI Services on Mac Mini
# This script tests both Ollama and Whisper services to verify they're working correctly

echo "🔍 Testing AI Services on Mac Mini..."
echo "=================================="

# Test 1: Check Ollama service
echo ""
echo "1. Testing Ollama service..."
echo "   URL: http://verbumcarenomac-mini.local:11434"

OLLAMA_RESPONSE=$(ssh vcadmin@verbumcarenomac-mini.local "curl -s http://localhost:11434/api/tags" 2>/dev/null)
if [[ $? -eq 0 && "$OLLAMA_RESPONSE" == *"llama3.1:8b"* ]]; then
    echo "   ✅ Ollama service is running and has llama3.1:8b model"
    echo "   📊 Models available:"
    echo "$OLLAMA_RESPONSE" | jq -r '.models[].name' 2>/dev/null | sed 's/^/      - /'
else
    echo "   ❌ Ollama service not responding or model not available"
    echo "   Response: $OLLAMA_RESPONSE"
fi

# Test 2: Check Whisper service
echo ""
echo "2. Testing Whisper service..."
echo "   URL: http://verbumcarenomac-mini.local:8080"

WHISPER_RESPONSE=$(ssh vcadmin@verbumcarenomac-mini.local "curl -s http://localhost:8080/health" 2>/dev/null)
if [[ $? -eq 0 && "$WHISPER_RESPONSE" == *"ok"* ]]; then
    echo "   ✅ Whisper service is running"
    echo "   📊 Service info:"
    echo "$WHISPER_RESPONSE" | jq '.' 2>/dev/null | sed 's/^/      /'
else
    echo "   ❌ Whisper service not responding"
    echo "   Response: $WHISPER_RESPONSE"
fi

# Test 3: Test Ollama generation
echo ""
echo "3. Testing Ollama generation..."

OLLAMA_TEST=$(ssh vcadmin@verbumcarenomac-mini.local 'curl -s http://localhost:11434/api/generate -d '"'"'{
  "model": "llama3.1:8b",
  "prompt": "Hello, respond with just: AI service working",
  "stream": false,
  "options": {
    "num_ctx": 512,
    "temperature": 0.1
  }
}'"'"'' 2>/dev/null)

if [[ $? -eq 0 && "$OLLAMA_TEST" == *"response"* ]]; then
    echo "   ✅ Ollama generation test successful"
    RESPONSE_TEXT=$(echo "$OLLAMA_TEST" | jq -r '.response' 2>/dev/null | head -1)
    echo "   📝 Response: $RESPONSE_TEXT"
else
    echo "   ❌ Ollama generation test failed"
    echo "   Response: $OLLAMA_TEST"
fi

# Test 4: Check backend configuration
echo ""
echo "4. Testing backend AI configuration..."

BACKEND_CONFIG=$(ssh vcadmin@verbumcarenomac-mini.local "cd ~/verbumcare-demo && grep -E '(OLLAMA_URL|WHISPER_URL)' backend/.env")
echo "   📋 Backend configuration:"
echo "$BACKEND_CONFIG" | sed 's/^/      /'

# Test 5: Test backend AI endpoints through API
echo ""
echo "5. Testing backend API health..."

API_HEALTH=$(curl -k -s "https://verbumcarenomac-mini.local/health" 2>/dev/null)
if [[ $? -eq 0 && "$API_HEALTH" == *"healthy"* ]]; then
    echo "   ✅ Backend API is healthy"
    echo "   📊 API response:"
    echo "$API_HEALTH" | jq '.' 2>/dev/null | sed 's/^/      /'
else
    echo "   ❌ Backend API not responding"
    echo "   Response: $API_HEALTH"
fi

# Test 6: Compare with pn51 (legacy) services
echo ""
echo "6. Comparing with pn51 (legacy) services..."

echo "   pn51 Ollama:"
PN51_OLLAMA=$(ssh verbumcare-lab.local "curl -s http://localhost:11434/api/tags" 2>/dev/null)
if [[ $? -eq 0 && "$PN51_OLLAMA" == *"llama3.1:8b"* ]]; then
    echo "      ✅ pn51 Ollama is also running"
else
    echo "      ❌ pn51 Ollama not responding"
fi

echo "   pn51 Whisper:"
PN51_WHISPER=$(ssh verbumcare-lab.local "curl -s http://localhost:8080/health" 2>/dev/null)
if [[ $? -eq 0 && "$PN51_WHISPER" == *"ok"* ]]; then
    echo "      ✅ pn51 Whisper is also running"
else
    echo "      ❌ pn51 Whisper not responding"
fi

echo ""
echo "=================================="
echo "🎯 Summary:"
echo "   - Mac Mini should be used for AI services (configured in backend/.env)"
echo "   - pn51 services are available as fallback"
echo "   - Backend should point to verbumcarenomac-mini.local, not verbumcare-lab.local"
echo ""