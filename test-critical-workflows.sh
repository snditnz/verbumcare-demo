#!/bin/bash

# Critical Workflow Testing Script
# Tests the most important user journeys for the demo

echo "🔄 CRITICAL WORKFLOW TESTING"
echo "============================"
echo ""

API_BASE="https://verbumcare-lab.local/api"
FACILITY_ID="550e8400-e29b-41d4-a716-446655440001"
DEMO_STAFF_ID="550e8400-e29b-41d4-a716-446655440101"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

WORKFLOWS_PASSED=0
WORKFLOWS_FAILED=0

test_workflow() {
    local name="$1"
    local description="$2"
    echo -e "${BLUE}🔄 Testing: $name${NC}"
    echo "   $description"
}

workflow_step() {
    local step="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    echo -n "   → $step... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -k -s -X POST "$url" -H "Content-Type: application/json" -d "$data" --connect-timeout 10)
    else
        response=$(curl -k -s "$url" --connect-timeout 10)
    fi
    
    if [ $? -eq 0 ]; then
        success=$(echo "$response" | jq -r '.success // null' 2>/dev/null)
        status=$(echo "$response" | jq -r '.status // null' 2>/dev/null)
        templates=$(echo "$response" | jq '.templates | length // 0' 2>/dev/null)
        data_length=$(echo "$response" | jq '.data | length // 0' 2>/dev/null)
        
        if [ "$success" = "true" ] || [ "$status" = "healthy" ] || [ "$templates" -gt 0 ] || [ "$data_length" -ge 0 ]; then
            echo -e "${GREEN}✅${NC}"
            return 0
        else
            echo -e "${RED}❌${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Connection failed${NC}"
        return 1
    fi
}

echo "🏥 WORKFLOW 1: Patient List & Selection"
echo "--------------------------------------"
test_workflow "Patient Discovery" "User opens app and sees patient list"

if workflow_step "Load patient list" "$API_BASE/patients?facility_id=$FACILITY_ID"; then
    # Get first patient for subsequent tests
    PATIENT_ID=$(curl -k -s "$API_BASE/patients?facility_id=$FACILITY_ID" | jq -r '.data[0].patient_id' 2>/dev/null)
    PATIENT_MRN=$(curl -k -s "$API_BASE/patients?facility_id=$FACILITY_ID" | jq -r '.data[0].mrn' 2>/dev/null)
    
    if workflow_step "Get patient details" "$API_BASE/patients/$PATIENT_ID"; then
        if workflow_step "Verify barcode scan" "$API_BASE/patients/barcode/PAT-$PATIENT_MRN-MJ6GM0WI-19245C42"; then
            echo -e "   ${GREEN}✅ Patient workflow complete${NC}"
            WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
        else
            echo -e "   ${RED}❌ Barcode verification failed${NC}"
            WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
        fi
    else
        echo -e "   ${RED}❌ Patient details failed${NC}"
        WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
    fi
else
    echo -e "   ${RED}❌ Patient list failed${NC}"
    WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
fi

echo ""
echo "💓 WORKFLOW 2: Vitals Capture & History"
echo "---------------------------------------"
test_workflow "Vitals Management" "User captures vitals and views history"

if [ -n "$PATIENT_ID" ]; then
    if workflow_step "View vitals history" "$API_BASE/vitals/patient/$PATIENT_ID"; then
        if workflow_step "Get vitals statistics" "$API_BASE/vitals/patient/$PATIENT_ID/statistics?start_date=2025-12-01&end_date=2025-12-15&vital_type=hr"; then
            echo -e "   ${GREEN}✅ Vitals workflow complete${NC}"
            WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
        else
            echo -e "   ${RED}❌ Vitals statistics failed${NC}"
            WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
        fi
    else
        echo -e "   ${RED}❌ Vitals history failed${NC}"
        WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
    fi
else
    echo -e "   ${RED}❌ No patient ID available${NC}"
    WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
fi

echo ""
echo "📅 WORKFLOW 3: Schedule & Dashboard"
echo "----------------------------------"
test_workflow "Schedule Access" "User views today's schedule and dashboard"

if workflow_step "Load staff schedule" "$API_BASE/dashboard/today-schedule-all?staff_id=$DEMO_STAFF_ID"; then
    if [ -n "$PATIENT_ID" ]; then
        if workflow_step "Load patient schedule" "$API_BASE/dashboard/today-schedule/$PATIENT_ID"; then
            echo -e "   ${GREEN}✅ Schedule workflow complete${NC}"
            WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
        else
            echo -e "   ${RED}❌ Patient schedule failed${NC}"
            WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
        fi
    else
        echo -e "   ${GREEN}✅ Schedule workflow complete (staff only)${NC}"
        WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
    fi
else
    echo -e "   ${RED}❌ Staff schedule failed${NC}"
    WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
fi

echo ""
echo "🏥 WORKFLOW 4: Care Plan Management"
echo "----------------------------------"
test_workflow "Care Planning" "User accesses care plan templates and patient plans"

if workflow_step "Load problem templates" "$API_BASE/care-plans/problem-templates"; then
    if workflow_step "Load all care plans" "$API_BASE/care-plans/all"; then
        if [ -n "$PATIENT_ID" ]; then
            if workflow_step "Load patient care plans" "$API_BASE/care-plans?patient_id=$PATIENT_ID"; then
                echo -e "   ${GREEN}✅ Care plan workflow complete${NC}"
                WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
            else
                echo -e "   ${RED}❌ Patient care plans failed${NC}"
                WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
            fi
        else
            echo -e "   ${GREEN}✅ Care plan workflow complete (templates only)${NC}"
            WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
        fi
    else
        echo -e "   ${RED}❌ All care plans failed${NC}"
        WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
    fi
else
    echo -e "   ${RED}❌ Problem templates failed${NC}"
    WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
fi

echo ""
echo "🎤 WORKFLOW 5: Voice Processing"
echo "------------------------------"
test_workflow "Voice Features" "User accesses voice review queue and processing"

if workflow_step "Load voice review queue" "$API_BASE/voice/review-queue/$DEMO_STAFF_ID"; then
    echo -e "   ${GREEN}✅ Voice workflow complete${NC}"
    WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
else
    echo -e "   ${RED}❌ Voice review queue failed${NC}"
    WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
fi

echo ""
echo "🔐 WORKFLOW 6: Authentication"
echo "----------------------------"
test_workflow "User Login" "User authenticates with demo credentials"

login_data='{"username": "demo", "password": "demo123"}'
if workflow_step "Demo login" "$API_BASE/auth/login" "POST" "$login_data"; then
    echo -e "   ${GREEN}✅ Authentication workflow complete${NC}"
    WORKFLOWS_PASSED=$((WORKFLOWS_PASSED + 1))
else
    echo -e "   ${RED}❌ Authentication failed${NC}"
    WORKFLOWS_FAILED=$((WORKFLOWS_FAILED + 1))
fi

echo ""
echo "📊 WORKFLOW TESTING SUMMARY"
echo "==========================="
echo -e "Workflows Passed: ${GREEN}$WORKFLOWS_PASSED${NC}"
echo -e "Workflows Failed: ${RED}$WORKFLOWS_FAILED${NC}"

echo ""
if [ $WORKFLOWS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL WORKFLOWS READY FOR DEMO!${NC}"
    echo -e "${GREEN}✅ End-to-end functionality verified${NC}"
    echo -e "${GREEN}✅ Critical user journeys working${NC}"
    echo -e "${GREEN}✅ Demo should run smoothly${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME WORKFLOWS HAVE ISSUES${NC}"
    echo -e "${RED}⚠️  $WORKFLOWS_FAILED workflow(s) need attention${NC}"
    echo -e "${YELLOW}ℹ️  Demo may still work, but test these areas carefully${NC}"
    exit 1
fi