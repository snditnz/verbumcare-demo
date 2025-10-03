#!/bin/bash

# VerbumCare Ubuntu Server API Test Script
# Tests all endpoints and AI services

set -e

# Configuration
SERVER_HOST="${SERVER_HOST:-localhost}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
API_URL="http://${SERVER_HOST}:${BACKEND_PORT}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🧪 VerbumCare Ubuntu Server API Tests"
echo "======================================"
echo "Testing: ${API_URL}"
echo ""

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_code=${4:-200}

    echo -n "Testing ${name}... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/test_response.json "${API_URL}${endpoint}")
    else
        response=$(curl -s -w "%{http_code}" -o /tmp/test_response.json -X ${method} "${API_URL}${endpoint}")
    fi

    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ Pass (${response})${NC}"
        return 0
    else
        echo -e "${RED}✗ Fail (got ${response}, expected ${expected_code})${NC}"
        return 1
    fi
}

# Test counters
PASS=0
FAIL=0

echo "📋 1. Core API Tests"
echo "--------------------"

# Health check
if test_endpoint "Health Check" "GET" "/health"; then
    ((PASS++))
else
    ((FAIL++))
fi

# Patients API
if test_endpoint "List Patients" "GET" "/api/patients"; then
    ((PASS++))
else
    ((FAIL++))
fi

# Get first patient
PATIENT_ID=$(curl -s "${API_URL}/api/patients" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$PATIENT_ID" ]; then
    if test_endpoint "Get Patient Details" "GET" "/api/patients/${PATIENT_ID}"; then
        ((PASS++))
    else
        ((FAIL++))
    fi
fi

# Medications API
if test_endpoint "List Medications" "GET" "/api/medications/patient/${PATIENT_ID}"; then
    ((PASS++))
else
    ((FAIL++))
fi

# Dashboard API
if test_endpoint "Dashboard Metrics" "GET" "/api/dashboard/metrics"; then
    ((PASS++))
else
    ((FAIL++))
fi

if test_endpoint "Patient Status" "GET" "/api/dashboard/patients/status"; then
    ((PASS++))
else
    ((FAIL++))
fi

echo ""
echo "🤖 2. AI Services Tests"
echo "--------------------"

# Check Ollama service
echo -n "Ollama Service... "
if curl -s --max-time 5 http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    ((PASS++))

    # List models
    echo -n "  Models available... "
    MODELS=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | wc -l)
    if [ "$MODELS" -gt 0 ]; then
        echo -e "${GREEN}${MODELS} model(s)${NC}"
    else
        echo -e "${YELLOW}⚠ No models${NC}"
    fi
else
    echo -e "${RED}✗ Not running${NC}"
    ((FAIL++))
fi

# Check Whisper service
echo -n "Whisper Service... "
if curl -s --max-time 5 http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    ((PASS++))
elif curl -s --max-time 5 http://localhost:8080/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ Not running (optional)${NC}"
fi

# Test AI config endpoint
if test_endpoint "AI Config" "GET" "/api/config"; then
    ((PASS++))
else
    ((FAIL++))
fi

echo ""
echo "🔐 3. Data Integrity Tests"
echo "--------------------"

# Check database connection
echo -n "Database Connection... "
if docker-compose -f docker-compose.ubuntu.yml exec -T postgres pg_isready -U demo -d verbumcare_demo > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connected${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ Failed${NC}"
    ((FAIL++))
fi

# Check patient count
echo -n "Demo Patients... "
PATIENT_COUNT=$(curl -s "${API_URL}/api/patients" | grep -o '"id":"[^"]*"' | wc -l)
if [ "$PATIENT_COUNT" -ge 5 ]; then
    echo -e "${GREEN}✓ ${PATIENT_COUNT} patients loaded${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ Only ${PATIENT_COUNT} patients${NC}"
fi

echo ""
echo "📊 4. Performance Tests"
echo "--------------------"

# Response time test
echo -n "API Response Time... "
START=$(date +%s%N)
curl -s "${API_URL}/health" > /dev/null
END=$(date +%s%N)
ELAPSED=$(( (END - START) / 1000000 ))

if [ "$ELAPSED" -lt 100 ]; then
    echo -e "${GREEN}✓ ${ELAPSED}ms (excellent)${NC}"
    ((PASS++))
elif [ "$ELAPSED" -lt 500 ]; then
    echo -e "${GREEN}✓ ${ELAPSED}ms (good)${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ ${ELAPSED}ms (slow)${NC}"
fi

echo ""
echo "======================================"
echo "Test Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "System is ready for use:"
    echo "  API: ${BLUE}${API_URL}${NC}"
    echo "  Admin: ${BLUE}http://${SERVER_HOST}:5173${NC}"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    echo ""
    echo "Check logs:"
    echo "  docker-compose -f docker-compose.ubuntu.yml logs backend"
    echo ""
    exit 1
fi
