#!/bin/bash

# Test Ollama Integration for VerbumCare
# Validates that Ollama is working correctly with the backend

set -e

echo "🧪 Testing Ollama Integration for VerbumCare"
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.1:8b"

# Test 1: Basic connectivity
echo "1️⃣ Testing basic connectivity..."
if curl -s --max-time 5 "${OLLAMA_URL}/api/tags" > /dev/null; then
    echo -e "${GREEN}✅ Ollama API is accessible${NC}"
else
    echo -e "${RED}❌ Ollama API not accessible${NC}"
    echo "Make sure Ollama is running: ./ollama-service.sh start"
    exit 1
fi

# Test 2: Model availability
echo ""
echo "2️⃣ Testing model availability..."
MODELS_RESPONSE=$(curl -s "${OLLAMA_URL}/api/tags")
if echo "$MODELS_RESPONSE" | grep -q "llama3"; then
    echo -e "${GREEN}✅ Llama model found${NC}"
    echo "Available models:"
    echo "$MODELS_RESPONSE" | jq -r '.models[]?.name // empty' 2>/dev/null | sed 's/^/  - /'
else
    echo -e "${YELLOW}⚠️  Llama model not found${NC}"
    echo "Available models:"
    echo "$MODELS_RESPONSE" | jq -r '.models[]?.name // empty' 2>/dev/null | sed 's/^/  - /' || echo "  (none)"
    echo ""
    echo "To install the model: ollama pull ${OLLAMA_MODEL}"
fi

# Test 3: Simple generation
echo ""
echo "3️⃣ Testing simple text generation..."
SIMPLE_TEST=$(curl -s -X POST "${OLLAMA_URL}/api/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'${OLLAMA_MODEL}'",
        "prompt": "Say hello in one word:",
        "stream": false,
        "options": {
            "num_ctx": 512,
            "temperature": 0.1
        }
    }')

if echo "$SIMPLE_TEST" | jq -e '.response' > /dev/null 2>&1; then
    RESPONSE=$(echo "$SIMPLE_TEST" | jq -r '.response')
    echo -e "${GREEN}✅ Text generation working${NC}"
    echo "  Response: $RESPONSE"
else
    echo -e "${RED}❌ Text generation failed${NC}"
    echo "  Error: $(echo "$SIMPLE_TEST" | jq -r '.error // .' 2>/dev/null || echo "$SIMPLE_TEST")"
fi

# Test 4: JSON format generation
echo ""
echo "4️⃣ Testing JSON format generation..."
JSON_TEST=$(curl -s -X POST "${OLLAMA_URL}/api/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'${OLLAMA_MODEL}'",
        "prompt": "Return a JSON object with one field called \"test\" with value \"success\":",
        "stream": false,
        "format": "json",
        "options": {
            "num_ctx": 512,
            "temperature": 0.1
        }
    }')

if echo "$JSON_TEST" | jq -e '.response' > /dev/null 2>&1; then
    JSON_RESPONSE=$(echo "$JSON_TEST" | jq -r '.response')
    if echo "$JSON_RESPONSE" | jq -e '.test' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ JSON generation working${NC}"
        echo "  Response: $JSON_RESPONSE"
    else
        echo -e "${YELLOW}⚠️  JSON generation partial${NC}"
        echo "  Response: $JSON_RESPONSE"
    fi
else
    echo -e "${RED}❌ JSON generation failed${NC}"
    echo "  Error: $(echo "$JSON_TEST" | jq -r '.error // .' 2>/dev/null || echo "$JSON_TEST")"
fi

# Test 5: Medical extraction simulation
echo ""
echo "5️⃣ Testing medical extraction simulation..."
MEDICAL_TEST=$(curl -s -X POST "${OLLAMA_URL}/api/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'${OLLAMA_MODEL}'",
        "prompt": "Extract structured data from this nursing note: \"Patient in room 502, temperature 37.2C, oxygen saturation 95%\". Return JSON with fields: room, temperature, oxygen_saturation.",
        "stream": false,
        "format": "json",
        "options": {
            "num_ctx": 1024,
            "temperature": 0.1
        }
    }')

if echo "$MEDICAL_TEST" | jq -e '.response' > /dev/null 2>&1; then
    MEDICAL_RESPONSE=$(echo "$MEDICAL_TEST" | jq -r '.response')
    if echo "$MEDICAL_RESPONSE" | jq -e '.room' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Medical extraction working${NC}"
        echo "  Response: $MEDICAL_RESPONSE"
    else
        echo -e "${YELLOW}⚠️  Medical extraction partial${NC}"
        echo "  Response: $MEDICAL_RESPONSE"
    fi
else
    echo -e "${RED}❌ Medical extraction failed${NC}"
    echo "  Error: $(echo "$MEDICAL_TEST" | jq -r '.error // .' 2>/dev/null || echo "$MEDICAL_TEST")"
fi

# Test 6: Backend service integration (if backend is running)
echo ""
echo "6️⃣ Testing backend integration..."
if curl -s --max-time 3 http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"
    
    # Test Ollama health endpoint
    OLLAMA_HEALTH=$(curl -s http://localhost:3000/api/ai/ollama/health 2>/dev/null || echo "")
    if echo "$OLLAMA_HEALTH" | grep -q "available"; then
        echo -e "${GREEN}✅ Backend Ollama integration working${NC}"
        echo "  Health check passed"
    else
        echo -e "${YELLOW}⚠️  Backend Ollama integration not tested${NC}"
        echo "  Health endpoint may not be implemented yet"
    fi
else
    echo -e "${YELLOW}⚠️  Backend not running${NC}"
    echo "  Start with: cd backend && npm start"
fi

# Performance test
echo ""
echo "7️⃣ Testing performance..."
echo "Measuring response time for simple query..."
START_TIME=$(date +%s%N)
PERF_TEST=$(curl -s -X POST "${OLLAMA_URL}/api/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'${OLLAMA_MODEL}'",
        "prompt": "Hello",
        "stream": false,
        "options": {
            "num_ctx": 512,
            "temperature": 0.1
        }
    }')
END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $DURATION -lt 10000 ]; then
    echo -e "${GREEN}✅ Performance good: ${DURATION}ms${NC}"
elif [ $DURATION -lt 30000 ]; then
    echo -e "${YELLOW}⚠️  Performance acceptable: ${DURATION}ms${NC}"
else
    echo -e "${RED}❌ Performance slow: ${DURATION}ms${NC}"
fi

echo ""
echo "🎯 Test Summary"
echo "==============="
echo "✅ = Working correctly"
echo "⚠️  = Working with issues"
echo "❌ = Not working"
echo ""
echo "If you see any ❌ or ⚠️, check:"
echo "1. Ollama service is running: ./ollama-service.sh status"
echo "2. Model is installed: ollama list"
echo "3. Backend configuration: cat backend/.env | grep OLLAMA"
echo ""
echo "For more help, see: OFFLINE_AI_SETUP.md"