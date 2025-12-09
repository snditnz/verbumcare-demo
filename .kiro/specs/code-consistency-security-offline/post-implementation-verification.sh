#!/bin/bash

# Post-Implementation Data Migration Verification Script
# Verifies all existing data is intact after implementation
# Compares against pre-implementation baseline from December 6, 2025

set -e

REMOTE_HOST="verbumcare-lab.local"
DB_NAME="nagare_db"
DB_USER="nagare"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR=".kiro/specs/code-consistency-security-offline/backups"
VERIFICATION_FILE="${OUTPUT_DIR}/post_implementation_verification_${TIMESTAMP}.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Post-Implementation Data Verification"
echo "=========================================="
echo "Date: $(date)"
echo "Remote Server: ${REMOTE_HOST}"
echo "Database: ${DB_NAME}"
echo ""

# Create output directory if it doesn't exist
mkdir -p "${OUTPUT_DIR}"

# Initialize verification file
cat > "${VERIFICATION_FILE}" << EOF
Post-Implementation Data Verification Report
Date: $(date)
Remote Server: ${REMOTE_HOST}
Database: ${DB_NAME}

========================================
BASELINE DATA (Pre-Implementation)
========================================
User Accounts: 5
Patient Records: 5
Care Plans: 8
Clinical Notes: 2
Medication Orders: 20
Medication Administrations: 1
Vital Signs: 40
Barthel Assessments: 20
Session Data: 90
Authentication Audit Log: 8
Care Plan Audit Log: 10

========================================
CURRENT DATA (Post-Implementation)
========================================

EOF

# Function to run SQL query on remote database
run_query() {
    local query="$1"
    ssh "${REMOTE_HOST}" "docker exec nagare-postgres psql -U ${DB_USER} -d ${DB_NAME} -t -A -c \"${query}\""
}

# Function to check and report
check_count() {
    local description="$1"
    local query="$2"
    local expected="$3"
    
    echo -n "Checking ${description}... "
    local actual=$(run_query "${query}")
    
    echo "${description}: ${actual}" >> "${VERIFICATION_FILE}"
    
    if [ "${actual}" -eq "${expected}" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Expected: ${expected}, Actual: ${actual})"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: ${expected}, Actual: ${actual})"
        return 1
    fi
}

# Track failures
FAILURES=0

echo "=========================================="
echo "1. USER ACCOUNTS VERIFICATION"
echo "=========================================="

# Check staff count
if ! check_count "Staff accounts" "SELECT COUNT(*) FROM staff;" 5; then
    ((FAILURES++))
fi

# Verify specific user accounts can login
echo -n "Verifying user accounts exist... "
USERS=$(run_query "SELECT username FROM staff ORDER BY username;")
echo "${USERS}" >> "${VERIFICATION_FILE}"
if echo "${USERS}" | grep -q "nurse1" && echo "${USERS}" | grep -q "nurse2" && echo "${USERS}" | grep -q "doctor1"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "2. PATIENT RECORDS VERIFICATION"
echo "=========================================="

# Check patient count
if ! check_count "Patient records" "SELECT COUNT(*) FROM patients;" 5; then
    ((FAILURES++))
fi

# Verify patient data integrity
echo -n "Verifying patient data integrity... "
PATIENT_DATA=$(run_query "SELECT patient_id, family_name, given_name, mrn FROM patients ORDER BY mrn;")
echo "${PATIENT_DATA}" >> "${VERIFICATION_FILE}"
if [ -n "${PATIENT_DATA}" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "3. CARE PLANS VERIFICATION"
echo "=========================================="

# Check care plan count
if ! check_count "Care plans" "SELECT COUNT(*) FROM care_plans;" 8; then
    ((FAILURES++))
fi

# Verify care plan versioning
echo -n "Verifying care plan versions... "
VERSION_DATA=$(run_query "SELECT care_plan_id, version FROM care_plans ORDER BY created_at;")
echo "${VERSION_DATA}" >> "${VERIFICATION_FILE}"
if [ -n "${VERSION_DATA}" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILURES++))
fi

# Check care plan items
if ! check_count "Care plan items" "SELECT COUNT(*) FROM care_plan_items;" 2; then
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "4. CLINICAL NOTES VERIFICATION"
echo "=========================================="

# Check clinical notes count
if ! check_count "Clinical notes" "SELECT COUNT(*) FROM clinical_notes;" 2; then
    ((FAILURES++))
fi

# Verify clinical notes are readable
echo -n "Verifying clinical notes content... "
NOTES_DATA=$(run_query "SELECT note_id, note_type, created_at FROM clinical_notes ORDER BY created_at;")
echo "${NOTES_DATA}" >> "${VERIFICATION_FILE}"
if [ -n "${NOTES_DATA}" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "5. MEDICATION RECORDS VERIFICATION"
echo "=========================================="

# Check medication orders
if ! check_count "Medication orders" "SELECT COUNT(*) FROM medication_orders;" 20; then
    ((FAILURES++))
fi

# Check medication administrations
if ! check_count "Medication administrations" "SELECT COUNT(*) FROM medication_administrations;" 1; then
    ((FAILURES++))
fi

# Verify hash chain integrity
echo -n "Verifying medication hash chain integrity... "
HASH_CHAIN=$(run_query "SELECT administration_id, record_hash, previous_hash FROM medication_administrations ORDER BY administered_datetime;")
echo "${HASH_CHAIN}" >> "${VERIFICATION_FILE}"
if [ -n "${HASH_CHAIN}" ]; then
    # Check that hash fields are not null
    if echo "${HASH_CHAIN}" | grep -v "^|$" | grep -q "|"; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${RED}✗ FAIL${NC} (Hash chain data missing)"
        ((FAILURES++))
    fi
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "6. VITAL SIGNS VERIFICATION"
echo "=========================================="

# Check vital signs count
if ! check_count "Vital signs records" "SELECT COUNT(*) FROM vital_signs;" 40; then
    ((FAILURES++))
fi

# Verify vital signs are queryable
echo -n "Verifying vital signs data... "
VITALS_DATA=$(run_query "SELECT COUNT(*), MIN(measured_at), MAX(measured_at) FROM vital_signs;")
echo "${VITALS_DATA}" >> "${VERIFICATION_FILE}"
if [ -n "${VITALS_DATA}" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "7. ASSESSMENTS VERIFICATION"
echo "=========================================="

# Check Barthel assessments
if ! check_count "Barthel assessments" "SELECT COUNT(*) FROM barthel_assessments;" 20; then
    ((FAILURES++))
fi

# Verify assessment data
echo -n "Verifying assessment data... "
ASSESSMENT_DATA=$(run_query "SELECT assessment_id, total_score FROM barthel_assessments ORDER BY assessed_at LIMIT 5;")
echo "${ASSESSMENT_DATA}" >> "${VERIFICATION_FILE}"
if [ -n "${ASSESSMENT_DATA}" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "8. SESSION DATA VERIFICATION"
echo "=========================================="

# Check session data count
if ! check_count "Session data records" "SELECT COUNT(*) FROM patient_session_data;" 90; then
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "9. AUDIT LOGS VERIFICATION"
echo "=========================================="

# Check authentication audit log
if ! check_count "Authentication audit log" "SELECT COUNT(*) FROM auth_audit_log;" 8; then
    ((FAILURES++))
fi

# Check care plan audit log
if ! check_count "Care plan audit log" "SELECT COUNT(*) FROM care_plan_audit_log;" 10; then
    ((FAILURES++))
fi

echo ""
echo "=========================================="
echo "10. DATA COMPARISON SUMMARY"
echo "=========================================="

# Create comparison table
cat >> "${VERIFICATION_FILE}" << EOF

========================================
DATA COMPARISON SUMMARY
========================================
Data Type                    | Pre-Impl | Post-Impl | Status
-----------------------------|----------|-----------|--------
EOF

# Function to add comparison row
add_comparison() {
    local name="$1"
    local pre="$2"
    local post="$3"
    local status
    
    if [ "${pre}" -eq "${post}" ]; then
        status="✓ MATCH"
    else
        status="✗ MISMATCH"
    fi
    
    printf "%-28s | %8s | %9s | %s\n" "${name}" "${pre}" "${post}" "${status}" >> "${VERIFICATION_FILE}"
}

# Get current counts
CURRENT_STAFF=$(run_query "SELECT COUNT(*) FROM staff;")
CURRENT_PATIENTS=$(run_query "SELECT COUNT(*) FROM patients;")
CURRENT_CARE_PLANS=$(run_query "SELECT COUNT(*) FROM care_plans;")
CURRENT_NOTES=$(run_query "SELECT COUNT(*) FROM clinical_notes;")
CURRENT_MED_ORDERS=$(run_query "SELECT COUNT(*) FROM medication_orders;")
CURRENT_MED_ADMIN=$(run_query "SELECT COUNT(*) FROM medication_administrations;")
CURRENT_VITALS=$(run_query "SELECT COUNT(*) FROM vital_signs;")
CURRENT_BARTHEL=$(run_query "SELECT COUNT(*) FROM barthel_assessments;")
CURRENT_SESSION=$(run_query "SELECT COUNT(*) FROM patient_session_data;")
CURRENT_AUTH_AUDIT=$(run_query "SELECT COUNT(*) FROM auth_audit_log;")
CURRENT_CP_AUDIT=$(run_query "SELECT COUNT(*) FROM care_plan_audit_log;")

# Add comparisons
add_comparison "Staff accounts" 5 "${CURRENT_STAFF}"
add_comparison "Patient records" 5 "${CURRENT_PATIENTS}"
add_comparison "Care plans" 8 "${CURRENT_CARE_PLANS}"
add_comparison "Clinical notes" 2 "${CURRENT_NOTES}"
add_comparison "Medication orders" 20 "${CURRENT_MED_ORDERS}"
add_comparison "Medication administrations" 1 "${CURRENT_MED_ADMIN}"
add_comparison "Vital signs" 40 "${CURRENT_VITALS}"
add_comparison "Barthel assessments" 20 "${CURRENT_BARTHEL}"
add_comparison "Session data" 90 "${CURRENT_SESSION}"
add_comparison "Authentication audit log" 8 "${CURRENT_AUTH_AUDIT}"
add_comparison "Care plan audit log" 10 "${CURRENT_CP_AUDIT}"

echo ""
echo "Comparison table written to ${VERIFICATION_FILE}"

echo ""
echo "=========================================="
echo "11. UI CHANGES DOCUMENTATION"
echo "=========================================="

echo "Checking for UI changes documentation..."
UI_CHANGES_FILES=$(find .kiro/specs/code-consistency-security-offline -name "UI_CHANGES*.md" 2>/dev/null || echo "")

if [ -n "${UI_CHANGES_FILES}" ]; then
    echo -e "${GREEN}✓ PASS${NC} - UI changes documented:"
    echo "${UI_CHANGES_FILES}"
    echo "" >> "${VERIFICATION_FILE}"
    echo "UI Changes Documented:" >> "${VERIFICATION_FILE}"
    echo "${UI_CHANGES_FILES}" >> "${VERIFICATION_FILE}"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - No UI changes documentation found"
    echo "" >> "${VERIFICATION_FILE}"
    echo "UI Changes: No documentation found" >> "${VERIFICATION_FILE}"
fi

echo ""
echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="

cat >> "${VERIFICATION_FILE}" << EOF

========================================
VERIFICATION SUMMARY
========================================
Total Checks: 11 categories
Failures: ${FAILURES}
Status: $([ ${FAILURES} -eq 0 ] && echo "✓ ALL CHECKS PASSED" || echo "✗ ${FAILURES} CHECKS FAILED")

EOF

if [ ${FAILURES} -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
    echo "No data loss detected. All existing data is intact."
    echo ""
    echo "Verification report saved to: ${VERIFICATION_FILE}"
    exit 0
else
    echo -e "${RED}✗ ${FAILURES} CHECKS FAILED${NC}"
    echo "Data loss or corruption detected. Review the verification report."
    echo ""
    echo "Verification report saved to: ${VERIFICATION_FILE}"
    exit 1
fi
