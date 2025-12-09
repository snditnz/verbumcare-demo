#!/bin/bash

# Remote Pre-Implementation Data Verification and Backup Script
# VerbumCare - Code Consistency, Security & Offline Capability
# 
# This script connects to the remote server (verbumcare-lab.local) via SSH
# and performs all verification and backup operations remotely.
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

# Database connection details (from docker-compose)
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
    
    # User Accounts
    echo "--- USER ACCOUNTS ---"
    echo "Total user accounts:"
    run_query "SELECT COUNT(*) FROM staff;"
    echo ""
    echo "User accounts by role:"
    run_query_formatted "SELECT role, COUNT(*) as count FROM staff GROUP BY role ORDER BY role;"
    echo ""
    echo "User accounts by facility:"
    run_query_formatted "SELECT facility_id, COUNT(*) as count FROM staff GROUP BY facility_id ORDER BY facility_id;"
    echo ""
    echo "Sample user accounts (first 5):"
    run_query_formatted "SELECT staff_id, username, family_name, given_name, role, facility_id FROM staff LIMIT 5;"
    echo ""
    
    # Patient Records
    echo "--- PATIENT RECORDS ---"
    echo "Total patient records:"
    run_query "SELECT COUNT(*) FROM patients;"
    echo ""
    echo "Patients by care level:"
    run_query_formatted "SELECT care_level, COUNT(*) as count FROM patients GROUP BY care_level ORDER BY care_level;"
    echo ""
    echo "Patients by facility:"
    run_query_formatted "SELECT facility_id, COUNT(*) as count FROM patients GROUP BY facility_id ORDER BY facility_id;"
    echo ""
    echo "Sample patient records (first 5):"
    run_query_formatted "SELECT patient_id, mrn, family_name, given_name, age, care_level FROM patients LIMIT 5;"
    echo ""
    
    # Care Plans
    echo "--- CARE PLANS ---"
    echo "Total care plans:"
    run_query "SELECT COUNT(*) FROM care_plans;"
    echo ""
    echo "Care plans by status:"
    run_query_formatted "SELECT status, COUNT(*) as count FROM care_plans GROUP BY status ORDER BY status;"
    echo ""
    echo "Care plans with version information (if column exists):"
    if run_query "SELECT column_name FROM information_schema.columns WHERE table_name = 'care_plans' AND column_name = 'version';" | grep -q "version"; then
        run_query_formatted "SELECT version, COUNT(*) as count FROM care_plans GROUP BY version ORDER BY version;"
    else
        echo "Version column does not exist yet (will be added during implementation)"
    fi
    echo ""
    echo "Sample care plans (first 5):"
    run_query_formatted "SELECT care_plan_id, patient_id, care_level, status, created_date FROM care_plans LIMIT 5;"
    echo ""
    
    # Care Plan Items
    echo "Total care plan items:"
    run_query "SELECT COUNT(*) FROM care_plan_items;"
    echo ""
    
    # Clinical Notes
    echo "--- CLINICAL NOTES ---"
    echo "Total clinical notes:"
    run_query "SELECT COUNT(*) FROM clinical_notes;"
    echo ""
    echo "Clinical notes by type:"
    run_query_formatted "SELECT note_type, COUNT(*) as count FROM clinical_notes GROUP BY note_type ORDER BY note_type;"
    echo ""
    echo "Clinical notes date range:"
    run_query_formatted "SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM clinical_notes;"
    echo ""
    echo "Sample clinical notes (first 5):"
    run_query_formatted "SELECT note_id, patient_id, note_type, created_by, created_at FROM clinical_notes ORDER BY created_at DESC LIMIT 5;"
    echo ""
    
    # Medication Records
    echo "--- MEDICATION RECORDS ---"
    echo "Total medication orders:"
    run_query "SELECT COUNT(*) FROM medication_orders;"
    echo ""
    echo "Total medication administrations:"
    run_query "SELECT COUNT(*) FROM medication_administrations;"
    echo ""
    echo "Medication administrations with hash chain:"
    if run_query "SELECT column_name FROM information_schema.columns WHERE table_name = 'medication_administrations' AND column_name = 'record_hash';" | grep -q "record_hash"; then
        echo "Hash chain columns exist"
        run_query_formatted "SELECT COUNT(*) as total, COUNT(record_hash) as with_hash, COUNT(previous_hash) as with_prev_hash FROM medication_administrations;"
    else
        echo "Hash chain columns do not exist yet (will be added during implementation)"
    fi
    echo ""
    echo "Sample medication administrations (first 5):"
    run_query_formatted "SELECT admin_id, patient_id, order_id, administered_at, administered_by FROM medication_administrations ORDER BY administered_at DESC LIMIT 5;"
    echo ""
    
    # Vital Signs
    echo "--- VITAL SIGNS ---"
    echo "Total vital sign records:"
    run_query "SELECT COUNT(*) FROM vital_signs;"
    echo ""
    echo "Vital signs date range:"
    run_query_formatted "SELECT MIN(recorded_at) as earliest, MAX(recorded_at) as latest FROM vital_signs;"
    echo ""
    echo "Vital signs by type (sample):"
    run_query_formatted "SELECT COUNT(*) as total_records, COUNT(CASE WHEN systolic IS NOT NULL THEN 1 END) as with_bp, COUNT(CASE WHEN temperature IS NOT NULL THEN 1 END) as with_temp, COUNT(CASE WHEN pulse IS NOT NULL THEN 1 END) as with_pulse FROM vital_signs;"
    echo ""
    echo "Sample vital signs (first 5):"
    run_query_formatted "SELECT vital_id, patient_id, systolic, diastolic, pulse, temperature, recorded_at FROM vital_signs ORDER BY recorded_at DESC LIMIT 5;"
    echo ""
    
    # Assessments
    echo "--- ASSESSMENTS ---"
    echo "Total Barthel assessments:"
    run_query "SELECT COUNT(*) FROM barthel_assessments;"
    echo ""
    echo "Barthel assessments date range:"
    if [ "$(run_query 'SELECT COUNT(*) FROM barthel_assessments;')" -gt 0 ]; then
        run_query_formatted "SELECT MIN(assessment_date) as earliest, MAX(assessment_date) as latest FROM barthel_assessments;"
    else
        echo "No Barthel assessments found"
    fi
    echo ""
    
    # Check for other assessment tables
    echo "Other assessment tables:"
    run_query_formatted "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%assessment%' ORDER BY table_name;"
    echo ""
    
    # Incident Reports
    echo "--- INCIDENT REPORTS ---"
    if run_query "SELECT table_name FROM information_schema.tables WHERE table_name = 'incident_reports';" | grep -q "incident_reports"; then
        echo "Total incident reports:"
        run_query "SELECT COUNT(*) FROM incident_reports;"
        echo ""
    else
        echo "Incident reports table does not exist yet"
    fi
    echo ""
    
    # Session Data
    echo "--- SESSION DATA ---"
    if run_query "SELECT table_name FROM information_schema.tables WHERE table_name = 'session_data';" | grep -q "session_data"; then
        echo "Total session data records:"
        run_query "SELECT COUNT(*) FROM session_data;"
        echo ""
    else
        echo "Session data table does not exist yet"
    fi
    echo ""
    
    # Audit Logs
    echo "--- AUDIT LOGS ---"
    if run_query "SELECT table_name FROM information_schema.tables WHERE table_name = 'audit_logs';" | grep -q "audit_logs"; then
        echo "Total audit log entries:"
        run_query "SELECT COUNT(*) FROM audit_logs;"
        echo ""
        echo "Audit logs date range:"
        run_query_formatted "SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM audit_logs;"
        echo ""
    else
        echo "Audit logs table does not exist yet (will be added during implementation)"
    fi
    echo ""
    
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
    echo "  - User accounts: $(run_query 'SELECT COUNT(*) FROM staff;')"
    echo "  - Patients: $(run_query 'SELECT COUNT(*) FROM patients;')"
    echo "  - Care plans: $(run_query 'SELECT COUNT(*) FROM care_plans;')"
    echo "  - Clinical notes: $(run_query 'SELECT COUNT(*) FROM clinical_notes;')"
    echo "  - Medication administrations: $(run_query 'SELECT COUNT(*) FROM medication_administrations;')"
    echo "  - Vital signs: $(run_query 'SELECT COUNT(*) FROM vital_signs;')"
    echo "  - Barthel assessments: $(run_query 'SELECT COUNT(*) FROM barthel_assessments;')"
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
TEST_DB="verbumcare_test_restore_${TIMESTAMP}"
echo "Creating test database on remote server: ${TEST_DB}"
run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -c 'CREATE DATABASE ${TEST_DB};'" > /dev/null 2>&1

echo "Restoring backup to test database..."
cat "${BACKUP_FILE}" | run_remote "docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${TEST_DB}" > /dev/null 2>&1

echo "Verifying restored data..."
ORIGINAL_COUNT=$(run_query "SELECT COUNT(*) FROM patients;")
RESTORED_COUNT=$(run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${TEST_DB} -t -A -c 'SELECT COUNT(*) FROM patients;'")

if [ "${ORIGINAL_COUNT}" == "${RESTORED_COUNT}" ]; then
    echo -e "${GREEN}✓ Backup verification successful (patient count matches: ${ORIGINAL_COUNT})${NC}"
else
    echo -e "${RED}✗ Backup verification failed (original: ${ORIGINAL_COUNT}, restored: ${RESTORED_COUNT})${NC}"
    run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -c 'DROP DATABASE ${TEST_DB};'" > /dev/null 2>&1
    exit 1
fi

echo "Cleaning up test database..."
run_remote "docker exec ${DB_CONTAINER} psql -U ${DB_USER} -c 'DROP DATABASE ${TEST_DB};'" > /dev/null 2>&1
echo -e "${GREEN}✓ Test database cleaned up${NC}"
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
cat "${VERIFICATION_FILE}" | grep -A 20 "SUMMARY"
echo ""
echo -e "${GREEN}✓ All verification steps completed successfully${NC}"
echo -e "${GREEN}✓ Backup verified and ready for implementation${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo -e "  - Review the verification report: ${VERIFICATION_FILE}"
echo -e "  - Keep the backup safe: ${BACKUP_FILE}"
echo -e "  - Implementation can now proceed safely"
echo ""
