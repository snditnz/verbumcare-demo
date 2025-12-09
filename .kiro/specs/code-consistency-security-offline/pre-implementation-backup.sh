#!/bin/bash

# VerbumCare Pre-Implementation Data Backup and Documentation Script
# Purpose: Document and backup all existing data before implementing code consistency,
#          security, and offline capability features
# Date: $(date +%Y-%m-%d)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR=".kiro/specs/code-consistency-security-offline/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/verbumcare_backup_${TIMESTAMP}.sql"
DOCUMENTATION_FILE="${BACKUP_DIR}/data_documentation_${TIMESTAMP}.md"

# Database connection details (from .env)
if [ -f "backend/.env" ]; then
    source backend/.env
else
    echo -e "${RED}Error: backend/.env file not found${NC}"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VerbumCare Pre-Implementation Backup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to run SQL query and return result
run_query() {
    local query="$1"
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "${query}"
}

# Function to run SQL query and return formatted result
run_query_formatted() {
    local query="$1"
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "${query}"
}

echo -e "${YELLOW}Step 1: Creating full database backup...${NC}"
PGPASSWORD="${DB_PASSWORD}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --format=plain \
    --no-owner \
    --no-acl \
    --file="${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database backup created: ${BACKUP_FILE}${NC}"
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo -e "  Backup size: ${BACKUP_SIZE}"
else
    echo -e "${RED}✗ Database backup failed${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 2: Documenting database schema and data...${NC}"

# Start documentation file
cat > "${DOCUMENTATION_FILE}" << 'EOF'
# VerbumCare Database Documentation - Pre-Implementation Snapshot

**Generated:** $(date +"%Y-%m-%d %H:%M:%S")
**Purpose:** Document existing data before implementing code consistency, security, and offline capability features

## Critical Requirements

- **Requirement 16.1**: All existing data MUST be preserved during implementation
- **Requirement 16.2**: Database schema changes MUST include migration scripts
- **Requirement 16.3**: New fields MUST provide defaults for existing records
- **Requirement 16.4**: Cache structure changes MUST detect version mismatches
- **Requirement 16.5**: Authentication updates MUST migrate existing sessions

## Database Schema Overview

### Core Tables

EOF

# Document all tables
echo -e "${BLUE}Documenting database tables...${NC}"
TABLES=$(run_query "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")

echo "### All Database Tables" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
for table in $TABLES; do
    echo "- \`${table}\`" >> "${DOCUMENTATION_FILE}"
done
echo "" >> "${DOCUMENTATION_FILE}"

# Document table schemas
echo "## Detailed Table Schemas" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"

for table in $TABLES; do
    echo "### Table: \`${table}\`" >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    echo '```sql' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
done

# Document data counts
echo "## Data Inventory" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"

echo -e "${BLUE}Counting records in all tables...${NC}"

# Facilities
FACILITY_COUNT=$(run_query "SELECT COUNT(*) FROM facilities;")
echo "### Facilities: ${FACILITY_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${FACILITY_COUNT}" -gt 0 ]; then
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT facility_id, facility_name, facility_name_ja, timezone, language FROM facilities;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Facilities: ${FACILITY_COUNT}"

# Staff/Users
STAFF_COUNT=$(run_query "SELECT COUNT(*) FROM staff;")
echo "### Staff/User Accounts: ${STAFF_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${STAFF_COUNT}" -gt 0 ]; then
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT staff_id, username, family_name, given_name, family_name_en, given_name_en, role, facility_id FROM staff ORDER BY username;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    # Count by role
    echo "**Staff by Role:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT role, COUNT(*) as count FROM staff GROUP BY role ORDER BY count DESC;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Staff accounts: ${STAFF_COUNT}"

# Patients
PATIENT_COUNT=$(run_query "SELECT COUNT(*) FROM patients;")
echo "### Patients: ${PATIENT_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${PATIENT_COUNT}" -gt 0 ]; then
    echo "**Patient Demographics:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT patient_id, mrn, family_name, given_name, date_of_birth, gender, room, bed, status FROM patients ORDER BY mrn;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    # Count by status
    echo "**Patients by Status:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT status, COUNT(*) as count FROM patients GROUP BY status;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Patients: ${PATIENT_COUNT}"

# Care Plans
CARE_PLAN_COUNT=$(run_query "SELECT COUNT(*) FROM care_plans;")
echo "### Care Plans: ${CARE_PLAN_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${CARE_PLAN_COUNT}" -gt 0 ]; then
    echo "**Care Plans by Status:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT status, COUNT(*) as count FROM care_plans GROUP BY status;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    echo "**Care Plan Details:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT care_plan_id, patient_id, care_level, status, version, created_date FROM care_plans ORDER BY created_date DESC LIMIT 10;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Care plans: ${CARE_PLAN_COUNT}"

# Care Plan Items
CARE_PLAN_ITEM_COUNT=$(run_query "SELECT COUNT(*) FROM care_plan_items;")
echo "### Care Plan Items: ${CARE_PLAN_ITEM_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${CARE_PLAN_ITEM_COUNT}" -gt 0 ]; then
    echo "**Items by Category:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT problem_category, COUNT(*) as count FROM care_plan_items GROUP BY problem_category ORDER BY count DESC;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Care plan items: ${CARE_PLAN_ITEM_COUNT}"

# Clinical Notes
CLINICAL_NOTE_COUNT=$(run_query "SELECT COUNT(*) FROM clinical_notes;")
echo "### Clinical Notes: ${CLINICAL_NOTE_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${CLINICAL_NOTE_COUNT}" -gt 0 ]; then
    echo "**Notes by Type:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT note_type, COUNT(*) as count FROM clinical_notes GROUP BY note_type;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    echo "**Notes by Category:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT note_category, COUNT(*) as count FROM clinical_notes GROUP BY note_category ORDER BY count DESC;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Clinical notes: ${CLINICAL_NOTE_COUNT}"

# Medication Orders
MED_ORDER_COUNT=$(run_query "SELECT COUNT(*) FROM medication_orders;")
echo "### Medication Orders: ${MED_ORDER_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${MED_ORDER_COUNT}" -gt 0 ]; then
    echo "**Orders by Status:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT status, COUNT(*) as count FROM medication_orders GROUP BY status;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Medication orders: ${MED_ORDER_COUNT}"

# Medication Administrations (with hash chain)
MED_ADMIN_COUNT=$(run_query "SELECT COUNT(*) FROM medication_administrations;")
echo "### Medication Administrations: ${MED_ADMIN_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${MED_ADMIN_COUNT}" -gt 0 ]; then
    echo "**Administrations by Status:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT status, COUNT(*) as count FROM medication_administrations GROUP BY status;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    echo "**Hash Chain Status:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT COUNT(*) as total_records, COUNT(DISTINCT record_hash) as unique_hashes, COUNT(previous_hash) as records_with_previous_hash, MIN(chain_sequence) as min_sequence, MAX(chain_sequence) as max_sequence FROM medication_administrations;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    # Sample hash chain records
    echo "**Sample Hash Chain Records:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT administration_id, chain_sequence, LEFT(record_hash, 16) as record_hash_prefix, LEFT(previous_hash, 16) as prev_hash_prefix, administered_datetime FROM medication_administrations ORDER BY chain_sequence LIMIT 5;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Medication administrations: ${MED_ADMIN_COUNT}"

# Vital Signs
VITAL_SIGNS_COUNT=$(run_query "SELECT COUNT(*) FROM vital_signs;")
echo "### Vital Signs: ${VITAL_SIGNS_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${VITAL_SIGNS_COUNT}" -gt 0 ]; then
    echo "**Date Range:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT MIN(measured_at) as earliest, MAX(measured_at) as latest, COUNT(DISTINCT patient_id) as unique_patients FROM vital_signs;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    echo "**Input Methods:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT input_method, COUNT(*) as count FROM vital_signs GROUP BY input_method;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Vital signs: ${VITAL_SIGNS_COUNT}"

# Barthel Assessments
BARTHEL_COUNT=$(run_query "SELECT COUNT(*) FROM barthel_assessments;")
echo "### Barthel Index Assessments: ${BARTHEL_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${BARTHEL_COUNT}" -gt 0 ]; then
    echo "**Score Distribution:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT MIN(total_score) as min_score, MAX(total_score) as max_score, AVG(total_score)::numeric(5,2) as avg_score FROM barthel_assessments;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Barthel assessments: ${BARTHEL_COUNT}"

# Patient Incidents
INCIDENT_COUNT=$(run_query "SELECT COUNT(*) FROM patient_incidents;")
echo "### Patient Incidents: ${INCIDENT_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${INCIDENT_COUNT}" -gt 0 ]; then
    echo "**Incidents by Type:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT incident_type, COUNT(*) as count FROM patient_incidents GROUP BY incident_type ORDER BY count DESC;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    echo "" >> "${DOCUMENTATION_FILE}"
    
    echo "**Incidents by Severity:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT severity, COUNT(*) as count FROM patient_incidents GROUP BY severity ORDER BY count DESC;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Patient incidents: ${INCIDENT_COUNT}"

# Voice Recordings
VOICE_COUNT=$(run_query "SELECT COUNT(*) FROM voice_recordings;")
echo "### Voice Recordings: ${VOICE_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${VOICE_COUNT}" -gt 0 ]; then
    echo "**Processing Status:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT processing_status, COUNT(*) as count FROM voice_recordings GROUP BY processing_status;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Voice recordings: ${VOICE_COUNT}"

# Session Data
SESSION_COUNT=$(run_query "SELECT COUNT(*) FROM patient_session_data;")
echo "### Patient Session Data: ${SESSION_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${SESSION_COUNT}" -gt 0 ]; then
    echo "**Sessions by Status:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT session_status, COUNT(*) as count FROM patient_session_data GROUP BY session_status;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Session data records: ${SESSION_COUNT}"

# Problem Templates
TEMPLATE_COUNT=$(run_query "SELECT COUNT(*) FROM problem_templates;")
echo "### Problem Templates: ${TEMPLATE_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${TEMPLATE_COUNT}" -gt 0 ]; then
    echo "**Templates by Category:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT category, COUNT(*) as count FROM problem_templates GROUP BY category ORDER BY count DESC;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Problem templates: ${TEMPLATE_COUNT}"

# Authentication tables
AUTH_SESSION_COUNT=$(run_query "SELECT COUNT(*) FROM staff_sessions;")
echo "### Staff Sessions (Authentication): ${AUTH_SESSION_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Staff sessions: ${AUTH_SESSION_COUNT}"

AUTH_AUDIT_COUNT=$(run_query "SELECT COUNT(*) FROM auth_audit_log;")
echo "### Authentication Audit Log: ${AUTH_AUDIT_COUNT}" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
if [ "${AUTH_AUDIT_COUNT}" -gt 0 ]; then
    echo "**Events by Type:**" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
    run_query_formatted "SELECT event_type, COUNT(*) as count FROM auth_audit_log GROUP BY event_type ORDER BY count DESC;" >> "${DOCUMENTATION_FILE}"
    echo '```' >> "${DOCUMENTATION_FILE}"
fi
echo "" >> "${DOCUMENTATION_FILE}"
echo -e "  Auth audit logs: ${AUTH_AUDIT_COUNT}"

# Summary
echo "## Summary" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"
echo "| Data Type | Count |" >> "${DOCUMENTATION_FILE}"
echo "|-----------|-------|" >> "${DOCUMENTATION_FILE}"
echo "| Facilities | ${FACILITY_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Staff/Users | ${STAFF_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Patients | ${PATIENT_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Care Plans | ${CARE_PLAN_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Care Plan Items | ${CARE_PLAN_ITEM_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Clinical Notes | ${CLINICAL_NOTE_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Medication Orders | ${MED_ORDER_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Medication Administrations | ${MED_ADMIN_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Vital Signs | ${VITAL_SIGNS_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Barthel Assessments | ${BARTHEL_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Patient Incidents | ${INCIDENT_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Voice Recordings | ${VOICE_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Session Data | ${SESSION_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Problem Templates | ${TEMPLATE_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Staff Sessions | ${AUTH_SESSION_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "| Auth Audit Logs | ${AUTH_AUDIT_COUNT} |" >> "${DOCUMENTATION_FILE}"
echo "" >> "${DOCUMENTATION_FILE}"

echo -e "${GREEN}✓ Documentation created: ${DOCUMENTATION_FILE}${NC}"
echo ""

echo -e "${YELLOW}Step 3: Verifying backup can be restored...${NC}"

# Create a test database name
TEST_DB="${DB_NAME}_restore_test_${TIMESTAMP}"

# Create test database
echo -e "${BLUE}Creating test database: ${TEST_DB}${NC}"
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${TEST_DB};"

# Restore backup to test database
echo -e "${BLUE}Restoring backup to test database...${NC}"
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEST_DB}" -f "${BACKUP_FILE}" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup restoration successful${NC}"
    
    # Verify record counts match
    echo -e "${BLUE}Verifying record counts...${NC}"
    TEST_PATIENT_COUNT=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT COUNT(*) FROM patients;")
    
    if [ "${TEST_PATIENT_COUNT}" == "${PATIENT_COUNT}" ]; then
        echo -e "${GREEN}✓ Record counts verified (patients: ${TEST_PATIENT_COUNT})${NC}"
    else
        echo -e "${RED}✗ Record count mismatch! Original: ${PATIENT_COUNT}, Restored: ${TEST_PATIENT_COUNT}${NC}"
    fi
    
    # Clean up test database
    echo -e "${BLUE}Cleaning up test database...${NC}"
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE ${TEST_DB};"
    echo -e "${GREEN}✓ Test database removed${NC}"
else
    echo -e "${RED}✗ Backup restoration failed${NC}"
    echo -e "${YELLOW}Cleaning up test database...${NC}"
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE ${TEST_DB};" 2>/dev/null
    exit 1
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Backup and Documentation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Backup file: ${BACKUP_FILE}"
echo -e "Documentation: ${DOCUMENTATION_FILE}"
echo ""
echo -e "${YELLOW}CRITICAL: No implementation work should proceed until this backup is verified!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Review the documentation file to understand current data state"
echo "2. Store backup file in a safe location"
echo "3. Proceed with implementation tasks only after backup verification"
echo ""
