#!/bin/bash

# Adaptive Remote Pre-Implementation Data Verification and Backup Script
# VerbumCare - Code Consistency, Security & Offline Capability
# 
# This script adapts to the actual database schema and documents what exists
#
# CRITICAL: No implementation work should proceed until this script
# completes successfully and the backup is verified.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REMOTE_HOST="verbumcare-lab.local"
BACKUP_DIR=".kiro/specs/code-consistency-security-offline/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pre_implementation_backup_${TIMESTAMP}.sql"
VERIFICATION_FILE="${BACKUP_DIR}/data_verification_${TIMESTAMP}.txt"
SCHEMA_FILE="${BACKUP_DIR}/schema_documentation_${TIMESTAMP}.txt"

# Database connection details
DB_CONTAINER="nagare-postgres"
DB_NAME="nagare_db"
DB_USER="nagare"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VerbumCare Pre-Implementation Verification${NC}"
echo -e "${BLUE}Remote Server: ${REMOTE_HOST}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Function to run command on remote server
run_remote() {
    ssh ${REMOTE_HOST} "$@"
}

# Function to run SQL query on remote server and get result
run_query() {
    local query="$1"
    run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -A -c \"${query}\""
}

# Function to run SQL query on remote server and format output
run_query_formatted() {
    local query="$1"
    run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c \"${query}\""
}

# Function to check if table exists
table_exists() {
    local table="$1"
    local result=$(run_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}');")
    [ "$result" = "t" ]
}

# Function to check if column exists in table
column_exists() {
    local table="$1"
    local column="$2"
    local result=$(run_query "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}');")
    [ "$result" = "t" ]
}

# Function to get row count for a table
get_count() {
    local table="$1"
    if table_exists "$table"; then
        run_query "SELECT COUNT(*) FROM ${table};"
    else
        echo "0"
    fi
}

echo -e "${YELLOW}Step 1: Checking SSH connectivity to ${REMOTE_HOST}...${NC}"
if ssh -o ConnectTimeout=5 ${REMOTE_HOST} "echo 'SSH connection successful'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH connection successful${NC}"
else
    echo -e "${RED}✗ Failed to connect to ${REMOTE_HOST} via SSH${NC}"
    echo -e "${RED}Please ensure SSH keys are configured and the server is accessible${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 2: Checking database connectivity on remote server...${NC}"
if run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c 'SELECT 1;'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Failed to connect to database on ${REMOTE_HOST}${NC}"
    echo -e "${RED}Please ensure Docker containers are running on the remote server${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 3: Documenting database schema...${NC}"
{
    echo "========================================="
    echo "VerbumCare Database Schema Documentation"
    echo "Remote Server: ${REMOTE_HOST}"
    echo "Generated: $(date)"
    echo "========================================="
    echo ""
    
    echo "--- Database Information ---"
    run_query_formatted "SELECT version();"
    echo ""
    run_query_formatted "SELECT pg_size_pretty(pg_database_size('${DB_NAME}')) as database_size;"
    echo ""
    
    echo "--- All Tables ---"
    run_query_formatted "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    echo ""
    
    echo "--- Table Schemas ---"
    for table in $(run_query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"); do
        echo "=== Table: ${table} ==="
        run_query_formatted "SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position;"
        echo ""
    done
    
    echo "--- Indexes ---"
    run_query_formatted "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;"
    echo ""
    
    echo "--- Foreign Keys ---"
    run_query_formatted "SELECT conname as constraint_name, conrelid::regclass as table_name, confrelid::regclass as referenced_table FROM pg_constraint WHERE contype = 'f' ORDER BY conrelid::regclass::text;"
    echo ""
    
} > "${SCHEMA_FILE}"
echo -e "${GREEN}✓ Schema documented: ${SCHEMA_FILE}${NC}"
echo ""

echo -e "${YELLOW}Step 4: Documenting existing data...${NC}"
{
    echo "========================================="
    echo "VerbumCare Data Verification Report"
    echo "Remote Server: ${REMOTE_HOST}"
    echo "Generated: $(date)"
    echo "========================================="
    echo ""
    
    # Get all tables
    TABLES=$(run_query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
    
    echo "--- DATA COUNTS BY TABLE ---"
    echo ""
    for table in $TABLES; do
        count=$(get_count "$table")
        echo "${table}: ${count} records"
    done
    echo ""
    
    # Staff/Users
    if table_exists "staff"; then
        echo "--- STAFF/USER ACCOUNTS ---"
        STAFF_COUNT=$(get_count "staff")
        echo "Total staff accounts: ${STAFF_COUNT}"
        echo ""
        
        if [ "${STAFF_COUNT}" -gt 0 ]; then
            echo "Staff by role:"
            run_query_formatted "SELECT role, COUNT(*) as count FROM staff GROUP BY role ORDER BY role;"
            echo ""
            
            echo "Sample staff accounts (first 5):"
            run_query_formatted "SELECT staff_id, username, family_name, given_name, role FROM staff LIMIT 5;"
            echo ""
        fi
    fi
    
    # Patients
    if table_exists "patients"; then
        echo "--- PATIENT RECORDS ---"
        PATIENT_COUNT=$(get_count "patients")
        echo "Total patients: ${PATIENT_COUNT}"
        echo ""
        
        if [ "${PATIENT_COUNT}" -gt 0 ]; then
            if column_exists "patients" "status"; then
                echo "Patients by status:"
                run_query_formatted "SELECT status, COUNT(*) as count FROM patients GROUP BY status ORDER BY status;"
                echo ""
            fi
            
            echo "Sample patients (first 5):"
            run_query_formatted "SELECT patient_id, mrn, family_name, given_name, date_of_birth, gender FROM patients LIMIT 5;"
            echo ""
        fi
    fi
    
    # Care Plans
    if table_exists "care_plans"; then
        echo "--- CARE PLANS ---"
        CARE_PLAN_COUNT=$(get_count "care_plans")
        echo "Total care plans: ${CARE_PLAN_COUNT}"
        echo ""
        
        if [ "${CARE_PLAN_COUNT}" -gt 0 ]; then
            if column_exists "care_plans" "status"; then
                echo "Care plans by status:"
                run_query_formatted "SELECT status, COUNT(*) as count FROM care_plans GROUP BY status ORDER BY status;"
                echo ""
            fi
            
            if column_exists "care_plans" "version"; then
                echo "Care plans with version information:"
                run_query_formatted "SELECT version, COUNT(*) as count FROM care_plans GROUP BY version ORDER BY version;"
                echo ""
            else
                echo "NOTE: Version column does not exist yet (will be added during implementation)"
                echo ""
            fi
            
            echo "Sample care plans (first 5):"
            run_query_formatted "SELECT care_plan_id, patient_id, status, created_date FROM care_plans LIMIT 5;"
            echo ""
        fi
    fi
    
    # Care Plan Items
    if table_exists "care_plan_items"; then
        CARE_PLAN_ITEM_COUNT=$(get_count "care_plan_items")
        echo "Total care plan items: ${CARE_PLAN_ITEM_COUNT}"
        echo ""
    fi
    
    # Clinical Notes
    if table_exists "clinical_notes"; then
        echo "--- CLINICAL NOTES ---"
        CLINICAL_NOTE_COUNT=$(get_count "clinical_notes")
        echo "Total clinical notes: ${CLINICAL_NOTE_COUNT}"
        echo ""
        
        if [ "${CLINICAL_NOTE_COUNT}" -gt 0 ]; then
            if column_exists "clinical_notes" "note_type"; then
                echo "Clinical notes by type:"
                run_query_formatted "SELECT note_type, COUNT(*) as count FROM clinical_notes GROUP BY note_type ORDER BY note_type;"
                echo ""
            fi
            
            echo "Clinical notes date range:"
            run_query_formatted "SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM clinical_notes;"
            echo ""
            
            echo "Sample clinical notes (first 5):"
            run_query_formatted "SELECT note_id, patient_id, created_at FROM clinical_notes ORDER BY created_at DESC LIMIT 5;"
            echo ""
        fi
    fi
    
    # Medication Records
    if table_exists "medication_orders"; then
        echo "--- MEDICATION ORDERS ---"
        MED_ORDER_COUNT=$(get_count "medication_orders")
        echo "Total medication orders: ${MED_ORDER_COUNT}"
        echo ""
    fi
    
    if table_exists "medication_administrations"; then
        echo "--- MEDICATION ADMINISTRATIONS ---"
        MED_ADMIN_COUNT=$(get_count "medication_administrations")
        echo "Total medication administrations: ${MED_ADMIN_COUNT}"
        echo ""
        
        if [ "${MED_ADMIN_COUNT}" -gt 0 ]; then
            if column_exists "medication_administrations" "record_hash"; then
                echo "Hash chain status:"
                run_query_formatted "SELECT COUNT(*) as total, COUNT(record_hash) as with_hash, COUNT(previous_hash) as with_prev_hash FROM medication_administrations;"
                echo ""
            else
                echo "NOTE: Hash chain columns do not exist yet (will be added during implementation)"
                echo ""
            fi
            
            echo "Sample medication administrations (first 5):"
            run_query_formatted "SELECT administration_id, patient_id, administered_datetime FROM medication_administrations ORDER BY administered_datetime DESC LIMIT 5;"
            echo ""
        fi
    fi
    
    # Vital Signs
    if table_exists "vital_signs"; then
        echo "--- VITAL SIGNS ---"
        VITAL_SIGNS_COUNT=$(get_count "vital_signs")
        echo "Total vital sign records: ${VITAL_SIGNS_COUNT}"
        echo ""
        
        if [ "${VITAL_SIGNS_COUNT}" -gt 0 ]; then
            echo "Vital signs date range:"
            run_query_formatted "SELECT MIN(measured_at) as earliest, MAX(measured_at) as latest FROM vital_signs;"
            echo ""
            
            echo "Sample vital signs (first 5):"
            run_query_formatted "SELECT vital_sign_id, patient_id, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, measured_at FROM vital_signs ORDER BY measured_at DESC LIMIT 5;"
            echo ""
        fi
    fi
    
    # Assessments
    if table_exists "nursing_assessments"; then
        NURSING_ASSESSMENT_COUNT=$(get_count "nursing_assessments")
        echo "--- NURSING ASSESSMENTS ---"
        echo "Total nursing assessments: ${NURSING_ASSESSMENT_COUNT}"
        echo ""
    fi
    
    # Voice Recordings
    if table_exists "voice_recordings"; then
        VOICE_COUNT=$(get_count "voice_recordings")
        echo "--- VOICE RECORDINGS ---"
        echo "Total voice recordings: ${VOICE_COUNT}"
        echo ""
        
        if [ "${VOICE_COUNT}" -gt 0 ] && column_exists "voice_recordings" "processing_status"; then
            echo "Processing status:"
            run_query_formatted "SELECT processing_status, COUNT(*) as count FROM voice_recordings GROUP BY processing_status;"
            echo ""
        fi
    fi
    
    # Session Data
    if table_exists "patient_session_data"; then
        SESSION_COUNT=$(get_count "patient_session_data")
        echo "--- SESSION DATA ---"
        echo "Total session data records: ${SESSION_COUNT}"
        echo ""
    fi
    
    # Audit Logs
    if table_exists "auth_audit_log"; then
        AUTH_AUDIT_COUNT=$(get_count "auth_audit_log")
        echo "--- AUTHENTICATION AUDIT LOG ---"
        echo "Total auth audit log entries: ${AUTH_AUDIT_COUNT}"
        echo ""
    fi
    
    if table_exists "care_plan_audit_log"; then
        CARE_PLAN_AUDIT_COUNT=$(get_count "care_plan_audit_log")
        echo "--- CARE PLAN AUDIT LOG ---"
        echo "Total care plan audit log entries: ${CARE_PLAN_AUDIT_COUNT}"
        echo ""
    fi
    
    # Summary
    echo "========================================="
    echo "SUMMARY"
    echo "========================================="
    echo "Remote Server: ${REMOTE_HOST}"
    echo "Database: ${DB_NAME}"
    echo "Total tables: $(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")"
    echo "Database size: $(run_query "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));")"
    echo ""
    echo "Core Data Counts:"
    for table in $TABLES; do
        count=$(get_count "$table")
        echo "  - ${table}: ${count}"
    done
    echo ""
    
} > "${VERIFICATION_FILE}"
echo -e "${GREEN}✓ Data documented: ${VERIFICATION_FILE}${NC}"
echo ""

echo -e "${YELLOW}Step 5: Creating database backup on remote server...${NC}"
run_remote "docker exec ${DB_CONTAINER} pg_dump -U ${DB_USER} ${DB_NAME}" > "${BACKUP_FILE}"
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✓ Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})${NC}"
else
    echo -e "${RED}✗ Backup failed or is empty${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 6: Verifying backup integrity...${NC}"
# Create a test database to verify restore
TEST_DB="nagare_test_restore_${TIMESTAMP}"
echo "Creating test database on remote server: ${TEST_DB}"
run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE IF EXISTS ${TEST_DB};'" > /dev/null 2>&1
run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'CREATE DATABASE ${TEST_DB};'" > /dev/null 2>&1

echo "Restoring backup to test database..."
cat "${BACKUP_FILE}" | run_remote "docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${TEST_DB}" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "Verifying restored data..."
    if table_exists "patients"; then
        ORIGINAL_COUNT=$(run_query "SELECT COUNT(*) FROM patients;")
        RESTORED_COUNT=$(run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${TEST_DB} -t -A -c 'SELECT COUNT(*) FROM patients;'")
        
        if [ "${ORIGINAL_COUNT}" == "${RESTORED_COUNT}" ]; then
            echo -e "${GREEN}✓ Backup verification successful (patient count matches: ${ORIGINAL_COUNT})${NC}"
        else
            echo -e "${RED}✗ Backup verification failed (original: ${ORIGINAL_COUNT}, restored: ${RESTORED_COUNT})${NC}"
            run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE ${TEST_DB};'" > /dev/null 2>&1
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠ No patients table found, skipping count verification${NC}"
    fi
    
    echo "Cleaning up test database..."
    run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE ${TEST_DB};'" > /dev/null 2>&1
    echo -e "${GREEN}✓ Test database cleaned up${NC}"
else
    echo -e "${RED}✗ Backup restoration failed${NC}"
    run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE IF EXISTS ${TEST_DB};'" > /dev/null 2>&1
    exit 1
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PRE-IMPLEMENTATION VERIFICATION COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Generated Files:${NC}"
echo -e "  📄 Schema: ${SCHEMA_FILE}"
echo -e "  📄 Data Verification: ${VERIFICATION_FILE}"
echo -e "  💾 Backup: ${BACKUP_FILE}"
echo ""
echo -e "${BLUE}Summary:${NC}"
cat "${VERIFICATION_FILE}" | grep -A 50 "SUMMARY"
echo ""
echo -e "${GREEN}✓ All verification steps completed successfully${NC}"
echo -e "${GREEN}✓ Backup verified and ready for implementation${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo -e "  - Review the verification report: ${VERIFICATION_FILE}"
echo -e "  - Keep the backup safe: ${BACKUP_FILE}"
echo -e "  - Implementation can now proceed safely"
echo ""
