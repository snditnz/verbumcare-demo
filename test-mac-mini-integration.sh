#!/bin/bash

# Test Mac Mini AI Integration for VerbumCare
# Validates that Mac Mini AI services are working correctly with the backend

set -e

echo "🧪 Testing Mac Mini AI Integration for VerbumCare"
echo "================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

MAC_MINI_HOST="verbumcaremac-mini"
MAC_MINI_USER="vcadmin"
OLLAMA_PORT=11434
WHISPER_PORT=8080
OLLAMA_MODEL="llama3.1:8b"

echo "📋 Configuration:"
echo "  Mac Mini: ${MAC_MINI_USER}@${MAC_MINI_HOST}"
echo "  Ollama: http://${MAC_MINI_HOST}:${OLLAMA_PORT}"
echo "  Whisper: http://${MAC_MINI_HOST}:${WHISPER_PORT}"
echo ""

# Test 1: SSH connectivity
echo "1️⃣ Testing SSH connectivity to Mac Mini..."
if ssh -o ConnectTimeout=5 ${MAC_MINI_USER}@${MAC_MINI_HOST} "echo 'SSH OK'" 2>/dev/null | grep -q "SSH OK"; then
    echo -e "${GREEN}✅ SSH connection successful${NC}"
else
    echo -e "${RED}❌ SSH connection failed${NC}"
    echo "Cannot connect to Mac Mini. Please check:"
    echo "  1. Mac Mini is powered on"
    echo "  2. Network connectivity"
    echo "  3. SSH access: ssh ${MAC_MINI_USER}@${MAC_MINI_HOST}"
    exit 1
fi

# Test 2: Ollama service on Mac Mini
echo ""
echo "2️⃣ Testing Ollama service on Mac Mini..."
OLLAMA_STATUS=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s --max-time 5 http://localhost:${OLLAMA_PORT}/api/tags" 2>/dev/null || echo "")
if echo "$OLLAMA_STATUS" | grep -q "models"; then
    echo -e "${GREEN}✅ Ollama service is running on Mac Mini${NC}"
    MODELS=$(echo "$OLLAMA_STATUS" | jq -r '.models | length' 2>/dev/null || echo "unknown")
    echo "  Models available: $MODELS"
else
    echo -e "${RED}❌ Ollama service not accessible on Mac Mini${NC}"
    echo "Try starting it: ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} 'ollama serve'"
fi

# Test 3: Whisper service on Mac Mini
echo ""
echo "3️⃣ Testing Whisper service on Mac Mini..."
WHISPER_STATUS=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s --max-time 5 http://localhost:${WHISPER_PORT}/health" 2>/dev/null || echo "")
if echo "$WHISPER_STATUS" | grep -q -E "(healthy|ok|running)"; then
    echo -e "${GREEN}✅ Whisper service is running on Mac Mini${NC}"
else
    echo -e "${YELLOW}⚠️  Whisper service status unclear on Mac Mini${NC}"
    echo "  Response: $WHISPER_STATUS"
    echo "  You may need to start the Whisper service"
fi

# Test 4: Network connectivity from local machine
echo ""
echo "4️⃣ Testing network connectivity from local machine..."
if curl -s --max-time 5 "http://${MAC_MINI_HOST}:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Can reach Mac Mini Ollama from local machine${NC}"
else
    echo -e "${YELLOW}⚠️  Cannot reach Mac Mini Ollama from local machine${NC}"
    echo "  This is normal if you're not on the same network as Mac Mini"
    echo "  The backend server should still be able to reach it"
fi

# Test 5: Ollama model availability
echo ""
echo "5️⃣ Testing Ollama model availability..."
MODELS_LIST=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s http://localhost:${OLLAMA_PORT}/api/tags" 2>/dev/null || echo "")
if echo "$MODELS_LIST" | grep -q "llama3.1:8b"; then
    echo -e "${GREEN}✅ Target model llama3.1:8b found${NC}"
elif echo "$MODELS_LIST" | grep -q "llama3"; then
    echo -e "${YELLOW}⚠️  Llama3 model found (may need exact version)${NC}"
    echo "Available models:"
    echo "$MODELS_LIST" | jq -r '.models[]?.name // empty' 2>/dev/null | sed 's/^/  - /' || echo "  (Unable to parse)"
else
    echo -e "${RED}❌ No Llama models found${NC}"
    echo "Install with: ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} 'ollama pull ${OLLAMA_MODEL}'"
fi

# Test 6: Ollama generation test
echo ""
echo "6️⃣ Testing Ollama text generation..."
if echo "$MODELS_LIST" | grep -q "llama3"; then
    echo "Running generation test on Mac Mini..."
    GEN_TEST=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s -X POST http://localhost:${OLLAMA_PORT}/api/generate \
        -H 'Content-Type: application/json' \
        -d '{
            \"model\": \"${OLLAMA_MODEL}\",
            \"prompt\": \"Say hello in one word:\",
            \"stream\": false,
            \"options\": {
                \"num_ctx\": 512,
                \"temperature\": 0.1
            }
        }'" 2>/dev/null || echo "")
    
    if echo "$GEN_TEST" | jq -e '.response' >/dev/null 2>&1; then
        RESPONSE=$(echo "$GEN_TEST" | jq -r '.response' 2>/dev/null | head -1)
        echo -e "${GREEN}✅ Text generation working${NC}"
        echo "  Response: $RESPONSE"
    else
        echo -e "${RED}❌ Text generation failed${NC}"
        echo "  Error: $(echo "$GEN_TEST" | jq -r '.error // .' 2>/dev/null || echo "$GEN_TEST")"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping generation test (no models available)${NC}"
fi

# Test 7: Backend configuration check
echo ""
echo "7️⃣ Testing backend configuration..."
if [ -f "backend/.env" ]; then
    BACKEND_OLLAMA_URL=$(grep "OLLAMA_URL" backend/.env | cut -d'=' -f2 || echo "")
    BACKEND_WHISPER_URL=$(grep "WHISPER_URL" backend/.env | cut -d'=' -f2 || echo "")
    
    if echo "$BACKEND_OLLAMA_URL" | grep -q "${MAC_MINI_HOST}"; then
        echo -e "${GREEN}✅ Backend configured to use Mac Mini for Ollama${NC}"
        echo "  OLLAMA_URL: $BACKEND_OLLAMA_URL"
    else
        echo -e "${YELLOW}⚠️  Backend not configured for Mac Mini Ollama${NC}"
        echo "  Current: $BACKEND_OLLAMA_URL"
        echo "  Expected: http://${MAC_MINI_HOST}:${OLLAMA_PORT}"
    fi
    
    if echo "$BACKEND_WHISPER_URL" | grep -q "${MAC_MINI_HOST}"; then
        echo -e "${GREEN}✅ Backend configured to use Mac Mini for Whisper${NC}"
        echo "  WHISPER_URL: $BACKEND_WHISPER_URL"
    else
        echo -e "${YELLOW}⚠️  Backend not configured for Mac Mini Whisper${NC}"
        echo "  Current: $BACKEND_WHISPER_URL"
        echo "  Expected: http://${MAC_MINI_HOST}:${WHISPER_PORT}"
    fi
else
    echo -e "${RED}❌ Backend .env file not found${NC}"
fi

# Test 8: Backend service integration (if running)
echo ""
echo "8️⃣ Testing backend integration..."
if curl -s --max-time 3 http://localhost:3000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running locally${NC}"
    
    # Test AI health endpoints if they exist
    AI_HEALTH=$(curl -s http://localhost:3000/api/ai/health 2>/dev/null || echo "")
    if echo "$AI_HEALTH" | grep -q "ollama"; then
        echo -e "${GREEN}✅ Backend AI integration responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend AI integration not tested${NC}"
        echo "  AI health endpoint may not be implemented"
    fi
else
    echo -e "${YELLOW}⚠️  Backend not running locally${NC}"
    echo "  Start with: cd backend && npm start"
fi

# Performance test
echo ""
echo "9️⃣ Testing Mac Mini performance..."
if echo "$MODELS_LIST" | grep -q "llama3"; then
    echo "Measuring Mac Mini Ollama response time..."
    START_TIME=$(date +%s%N)
    PERF_TEST=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s -X POST http://localhost:${OLLAMA_PORT}/api/generate \
        -H 'Content-Type: application/json' \
        -d '{
            \"model\": \"${OLLAMA_MODEL}\",
            \"prompt\": \"Hello\",
            \"stream\": false,
            \"options\": {
                \"num_ctx\": 512,
                \"temperature\": 0.1
            }
        }'" 2>/dev/null || echo "")
    END_TIME=$(date +%s%N)
    DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ $DURATION -lt 5000 ]; then
        echo -e "${GREEN}✅ Mac Mini performance excellent: ${DURATION}ms${NC}"
    elif [ $DURATION -lt 15000 ]; then
        echo -e "${GREEN}✅ Mac Mini performance good: ${DURATION}ms${NC}"
    elif [ $DURATION -lt 30000 ]; then
        echo -e "${YELLOW}⚠️  Mac Mini performance acceptable: ${DURATION}ms${NC}"
    else
        echo -e "${RED}❌ Mac Mini performance slow: ${DURATION}ms${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping performance test (no models available)${NC}"
fi

echo ""
echo "🎯 Mac Mini Integration Test Summary"
echo "==================================="
echo "✅ = Working correctly"
echo "⚠️  = Working with issues or needs attention"
echo "❌ = Not working"
echo ""
echo "If you see any ❌ or ⚠️, check:"
echo "1. Mac Mini is powered on and accessible"
echo "2. AI services are running on Mac Mini:"
echo "   ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} '~/ollama-service.sh status'"
echo "3. Backend configuration points to Mac Mini:"
echo "   cat backend/.env | grep -E 'OLLAMA_URL|WHISPER_URL'"
echo "4. Network connectivity between servers"
echo ""
echo "For setup help, run: ./setup-mac-mini-ollama.sh"