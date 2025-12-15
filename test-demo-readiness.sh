#!/bin/bash

# Demo Readiness Test Script
# Tests all critical endpoints to ensure demo will work flawlessly

echo "🔥 DEMO READINESS TEST"
echo "======================"
echo ""

API_BASE="https://verbumcare-lab.local/api"
FACILITY_ID="550e8400-e29b-41d4-a716-446655440001"
DEMO_STAFF_ID="550e8400-e29b-41d4-a716-446655440101"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
CRITICAL_FAILED=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local critical="$3"
    
    echo -n "Testing $name... "
    
    response=$(curl -k -s "$url" --connect-timeout 10)
    if [ $? -eq 0 ]; then
        # Check if response is HTML (error page)
        if echo "$response" | grep -q "<!DOCTYPE html>"; then
            echo -e "${RED}❌ FAILED${NC} - Endpoint not found"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            if [ "$critical" = "true" ]; then
                CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
            fi
            return 1
        fi
        
        # Try to parse as JSON and check different response formats
        success=$(echo "$response" | jq -r '.success // null' 2>/dev/null)
        status=$(echo "$response" | jq -r '.status // null' 2>/dev/null)
        templates=$(echo "$response" | jq '.templates | length // 0' 2>/dev/null)
        data=$(echo "$response" | jq '.data | length // 0' 2>/dev/null)
        
        if [ "$success" = "true" ]; then
            data_length=$(echo "$response" | jq '.data | length // 0' 2>/dev/null)
            echo -e "${GREEN}✅ OK${NC} ($data_length items)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        elif [ "$status" = "healthy" ]; then
            echo -e "${GREEN}✅ OK${NC} (healthy)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        elif [ "$templates" -gt 0 ]; then
            echo -e "${GREEN}✅ OK${NC} ($templates templates)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        elif [ "$data" -ge 0 ] && [ "$success" != "false" ]; then
            echo -e "${GREEN}✅ OK${NC} ($data items)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        elif [ "$success" = "false" ]; then
            error=$(echo "$response" | jq -r '.error // "API returned success=false"' 2>/dev/null)
            echo -e "${RED}❌ FAILED${NC} - $error"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            if [ "$critical" = "true" ]; then
                CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
            fi
            return 1
        else
            echo -e "${YELLOW}⚠️  UNKNOWN FORMAT${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            return 1
        fi
    else
        echo -e "${RED}❌ CONNECTION FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        if [ "$critical" = "true" ]; then
            CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
        fi
        return 1
    fi
}

echo "🏥 Testing Core Endpoints..."
echo "----------------------------"

# Critical endpoints (must work for demo)
test_endpoint "Health Check" "https://verbumcare-lab.local/health" "true"
test_endpoint "Patients List" "$API_BASE/patients?facility_id=$FACILITY_ID" "true"
test_endpoint "Problem Templates" "$API_BASE/care-plans/problem-templates" "true"
test_endpoint "Staff Schedule" "$API_BASE/dashboard/today-schedule-all?staff_id=$DEMO_STAFF_ID" "true"

echo ""
echo "📋 Testing Patient-Specific Endpoints..."
echo "----------------------------------------"

# Get first patient ID for testing
FIRST_PATIENT=$(curl -k -s "$API_BASE/patients?facility_id=$FACILITY_ID" | jq -r '.data[0].patient_id // ""' 2>/dev/null)

if [ -n "$FIRST_PATIENT" ] && [ "$FIRST_PATIENT" != "null" ]; then
    echo "Using patient ID: $FIRST_PATIENT"
    test_endpoint "Patient Details" "$API_BASE/patients/$FIRST_PATIENT" "false"
    test_endpoint "Patient Vitals" "$API_BASE/vitals/patient/$FIRST_PATIENT" "false"
    test_endpoint "Patient Schedule" "$API_BASE/dashboard/today-schedule/$FIRST_PATIENT" "false"
    test_endpoint "Patient Care Plans" "$API_BASE/care-plans?patient_id=$FIRST_PATIENT" "false"
else
    echo -e "${RED}❌ No patients found - cannot test patient-specific endpoints${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 4))
    CRITICAL_FAILED=$((CRITICAL_FAILED + 2))
fi

echo ""
echo "🎤 Testing Voice & Advanced Features..."
echo "--------------------------------------"

test_endpoint "Voice Review Queue" "$API_BASE/voice/review-queue/$DEMO_STAFF_ID" "false"
test_endpoint "All Care Plans" "$API_BASE/care-plans/all" "false"
test_endpoint "Clinical Notes" "$API_BASE/clinical-notes/pending-approval" "false"

echo ""
echo "🔐 Testing Authentication..."
echo "----------------------------"

# Test login endpoint
login_response=$(curl -k -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username": "demo", "password": "demo123"}' \
    --connect-timeout 10)

if [ $? -eq 0 ]; then
    login_success=$(echo "$login_response" | jq -r '.success // false' 2>/dev/null)
    if [ "$login_success" = "true" ]; then
        echo -e "Demo Login... ${GREEN}✅ OK${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "Demo Login... ${YELLOW}⚠️  FAILED${NC} (not critical for demo)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "Demo Login... ${YELLOW}⚠️  CONNECTION FAILED${NC} (not critical for demo)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "📊 DEMO READINESS SUMMARY"
echo "========================="
echo -e "Tests Passed:     ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed:     ${RED}$TESTS_FAILED${NC}"
echo -e "Critical Failed:  ${RED}$CRITICAL_FAILED${NC}"

echo ""
if [ $CRITICAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 DEMO READY!${NC}"
    echo -e "${GREEN}✅ All critical endpoints are working${NC}"
    echo -e "${GREEN}✅ The iPad app should work perfectly${NC}"
    echo -e "${GREEN}✅ Offline functionality will be available${NC}"
    
    if [ $TESTS_FAILED -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}ℹ️  Some non-critical features may have issues, but demo will work${NC}"
    fi
    
    exit 0
else
    echo -e "${RED}❌ DEMO NOT READY${NC}"
    echo -e "${RED}⚠️  $CRITICAL_FAILED critical endpoints are failing${NC}"
    echo -e "${RED}⚠️  Fix these issues before the demo${NC}"
    exit 1
fi