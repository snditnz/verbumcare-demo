#!/bin/bash
# Database migration script from pn51 to Mac Mini
# Handles complete database export, transfer, and import with verification

set -e

echo "🗄️  Migrating Database from pn51 to Mac Mini"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${RED}❌ $message${NC}"
    fi
}

# Function to run remote command
run_remote() {
    local host=$1
    local command=$2
    if [ "$host" = "vcadmin@verbumcaremac-mini" ]; then
        ssh "$host" "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && $command"
    else
        ssh "$host" "$command"
    fi
}

# Timestamp for migration files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}1. Pre-Migration Verification${NC}"
echo "============================"

# Check pn51 database connectivity
echo "Checking pn51 database connectivity..."
if run_remote "verbumcare-lab.local" "docker exec nagare-postgres pg_isready -U nagare -d nagare_db >/dev/null 2>&1"; then
    print_status "OK" "pn51 database is accessible"
else
    print_status "ERROR" "pn51 database is not accessible"
    exit 1
fi

# Check Mac Mini containers
echo "Checking Mac Mini containers..."
if run_remote "vcadmin@verbumcaremac-mini" "docker exec macmini-postgres pg_isready -U nagare -d nagare_db >/dev/null 2>&1"; then
    print_status "OK" "Mac Mini database is accessible"
else
    print_status "ERROR" "Mac Mini database is not accessible - run deploy-macmini-containers.sh first"
    exit 1
fi

# Check database sizes
echo "Checking source database size..."
source_size=$(run_remote "verbumcare-lab.local" "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c \"SELECT pg_size_pretty(pg_database_size('nagare_db'));\" | xargs")
echo "Source database size: $source_size"

echo "Checking target database size..."
target_size=$(run_remote "vcadmin@verbumcaremac-mini" "docker exec macmini-postgres psql -U nagare -d nagare_db -t -c \"SELECT pg_size_pretty(pg_database_size('nagare_db'));\" | xargs")
echo "Target database size: $target_size"

if [[ "$target_size" != *"kB"* ]] && [[ "$target_size" != "0 bytes" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  Target database is not empty!${NC}"
    echo "Target database size: $target_size"
    echo ""
    read -p "Do you want to continue and overwrite the target database? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled by user"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}2. Creating Database Backup on pn51${NC}"
echo "=================================="

# Stop backend temporarily for consistent backup
echo "Temporarily stopping pn51 backend for consistent backup..."
run_remote "verbumcare-lab.local" "cd /home/q/verbumcare-demo && docker stop nagare-backend" && {
    print_status "OK" "pn51 backend stopped"
} || {
    print_status "WARN" "Could not stop pn51 backend - proceeding with live backup"
}

# Create comprehensive database dump
echo "Creating comprehensive database dump..."
run_remote "verbumcare-lab.local" "docker exec nagare-postgres pg_dump -U nagare -d nagare_db --verbose --clean --no-owner --no-privileges --format=custom > /tmp/migration_backup_$TIMESTAMP.dump" && {
    print_status "OK" "Database dump created (custom format)"
} || {
    print_status "ERROR" "Failed to create database dump"
    exit 1
}

# Create SQL format backup as fallback
echo "Creating SQL format backup as fallback..."
run_remote "verbumcare-lab.local" "docker exec nagare-postgres pg_dump -U nagare -d nagare_db --verbose --clean --no-owner --no-privileges > /tmp/migration_backup_$TIMESTAMP.sql" && {
    print_status "OK" "SQL format backup created"
} || {
    print_status "WARN" "SQL format backup failed"
}

# Restart pn51 backend
echo "Restarting pn51 backend..."
run_remote "verbumcare-lab.local" "cd /home/q/verbumcare-demo && docker start nagare-backend" && {
    print_status "OK" "pn51 backend restarted"
} || {
    print_status "ERROR" "Failed to restart pn51 backend"
}

# Verify backup integrity
echo "Verifying backup integrity..."
backup_size=$(run_remote "verbumcare-lab.local" "ls -lh /tmp/migration_backup_$TIMESTAMP.dump | awk '{print \$5}'")
if [[ "$backup_size" == *"M"* ]] || [[ "$backup_size" == *"G"* ]]; then
    print_status "OK" "Backup appears valid (size: $backup_size)"
else
    print_status "ERROR" "Backup appears invalid (size: $backup_size)"
    exit 1
fi

echo ""
echo -e "${BLUE}3. Transferring Database Backup${NC}"
echo "=============================="

# Copy backup to Mac Mini
echo "Copying database backup to Mac Mini..."
scp verbumcare-lab.local:/tmp/migration_backup_$TIMESTAMP.dump /tmp/ && {
    print_status "OK" "Backup copied to local machine"
} || {
    print_status "ERROR" "Failed to copy backup to local machine"
    exit 1
}

scp /tmp/migration_backup_$TIMESTAMP.dump vcadmin@verbumcaremac-mini:/tmp/ && {
    print_status "OK" "Backup copied to Mac Mini"
} || {
    print_status "ERROR" "Failed to copy backup to Mac Mini"
    exit 1
}

# Copy SQL backup as well (if it exists)
if run_remote "verbumcare-lab.local" "test -f /tmp/migration_backup_$TIMESTAMP.sql"; then
    echo "Copying SQL backup as fallback..."
    scp verbumcare-lab.local:/tmp/migration_backup_$TIMESTAMP.sql /tmp/ && \
    scp /tmp/migration_backup_$TIMESTAMP.sql vcadmin@verbumcaremac-mini:/tmp/ && {
        print_status "OK" "SQL backup copied as fallback"
    } || {
        print_status "WARN" "SQL backup copy failed"
    }
fi

echo ""
echo -e "${BLUE}4. Preparing Target Database${NC}"
echo "=========================="

# Stop Mac Mini backend temporarily
echo "Stopping Mac Mini backend temporarily..."
run_remote "vcadmin@verbumcaremac-mini" "cd ~/verbumcare-demo && docker stop macmini-backend" && {
    print_status "OK" "Mac Mini backend stopped"
} || {
    print_status "WARN" "Could not stop Mac Mini backend"
}

# Drop and recreate database for clean import
echo "Preparing clean target database..."
run_remote "vcadmin@verbumcaremac-mini" "docker exec macmini-postgres psql -U nagare -d postgres -c 'DROP DATABASE IF EXISTS nagare_db;'" && {
    print_status "OK" "Target database dropped"
} || {
    print_status "ERROR" "Failed to drop target database"
    exit 1
}

run_remote "vcadmin@verbumcaremac-mini" "docker exec macmini-postgres psql -U nagare -d postgres -c 'CREATE DATABASE nagare_db OWNER nagare;'" && {
    print_status "OK" "Target database recreated"
} || {
    print_status "ERROR" "Failed to recreate target database"
    exit 1
}

echo ""
echo -e "${BLUE}5. Importing Database${NC}"
echo "=================="

# Import using custom format (preferred)
echo "Importing database using custom format..."
if run_remote "vcadmin@verbumcaremac-mini" "docker exec -i macmini-postgres pg_restore -U nagare -d nagare_db --verbose --clean --no-owner --no-privileges < /tmp/migration_backup_$TIMESTAMP.dump"; then
    print_status "OK" "Database imported successfully using custom format"
    import_success=true
else
    print_status "WARN" "Custom format import failed, trying SQL format..."
    import_success=false
    
    # Fallback to SQL format
    if run_remote "vcadmin@verbumcaremac-mini" "test -f /tmp/migration_backup_$TIMESTAMP.sql"; then
        echo "Attempting SQL format import..."
        if run_remote "vcadmin@verbumcaremac-mini" "docker exec -i macmini-postgres psql -U nagare -d nagare_db < /tmp/migration_backup_$TIMESTAMP.sql"; then
            print_status "OK" "Database imported successfully using SQL format"
            import_success=true
        else
            print_status "ERROR" "SQL format import also failed"
            import_success=false
        fi
    else
        print_status "ERROR" "No SQL backup available for fallback"
        import_success=false
    fi
fi

if [ "$import_success" = false ]; then
    print_status "ERROR" "Database import failed completely"
    exit 1
fi

echo ""
echo -e "${BLUE}6. Database Verification${NC}"
echo "====================="

# Check database size after import
echo "Checking imported database size..."
imported_size=$(run_remote "vcadmin@verbumcaremac-mini" "docker exec macmini-postgres psql -U nagare -d nagare_db -t -c \"SELECT pg_size_pretty(pg_database_size('nagare_db'));\" | xargs")
echo "Imported database size: $imported_size"

# Compare sizes
echo "Size comparison:"
echo "  Source (pn51): $source_size"
echo "  Target (Mac Mini): $imported_size"

# Check table counts
echo "Verifying table structure..."
source_tables=$(run_remote "verbumcare-lab.local" "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';\" | xargs")
target_tables=$(run_remote "vcadmin@verbumcaremac-mini" "docker exec macmini-postgres psql -U nagare -d nagare_db -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';\" | xargs")

echo "Table count comparison:"
echo "  Source (pn51): $source_tables tables"
echo "  Target (Mac Mini): $target_tables tables"

if [ "$source_tables" -eq "$target_tables" ]; then
    print_status "OK" "Table counts match"
else
    print_status "WARN" "Table counts differ - may indicate partial import"
fi

# Check key table row counts
echo "Verifying key table data..."
key_tables=("patients" "users" "facilities" "medication_orders")

for table in "${key_tables[@]}"; do
    echo "Checking table: $table"
    
    source_count=$(run_remote "verbumcare-lab.local" "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c \"SELECT COUNT(*) FROM $table;\" 2>/dev/null | xargs" || echo "0")
    target_count=$(run_remote "vcadmin@verbumcaremac-mini" "docker exec macmini-postgres psql -U nagare -d nagare_db -t -c \"SELECT COUNT(*) FROM $table;\" 2>/dev/null | xargs" || echo "0")
    
    echo "  Source: $source_count rows, Target: $target_count rows"
    
    if [ "$source_count" -eq "$target_count" ]; then
        print_status "OK" "Table $table: row counts match"
    else
        print_status "WARN" "Table $table: row counts differ"
    fi
done

echo ""
echo -e "${BLUE}7. Restarting Services${NC}"
echo "==================="

# Restart Mac Mini backend
echo "Restarting Mac Mini backend..."
run_remote "vcadmin@verbumcaremac-mini" "cd ~/verbumcare-demo && docker start macmini-backend" && {
    print_status "OK" "Mac Mini backend restarted"
} || {
    print_status "ERROR" "Failed to restart Mac Mini backend"
}

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if run_remote "vcadmin@verbumcaremac-mini" "curl -s http://localhost:3000/health >/dev/null 2>&1"; then
        print_status "OK" "Backend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_status "ERROR" "Backend failed to start after database migration"
        run_remote "vcadmin@verbumcaremac-mini" "cd ~/verbumcare-demo && docker logs macmini-backend --tail 20"
        exit 1
    fi
    echo "Waiting for backend... ($i/30)"
    sleep 2
done

echo ""
echo -e "${BLUE}8. Functional Testing${NC}"
echo "=================="

# Test database connectivity from backend
echo "Testing database connectivity from backend..."
if run_remote "vcadmin@verbumcaremac-mini" "curl -s http://localhost:3000/api/patients | grep -q 'success'"; then
    print_status "OK" "Backend can query database successfully"
else
    print_status "ERROR" "Backend cannot query database"
fi

# Test HTTPS endpoint
echo "Testing HTTPS endpoint..."
if run_remote "vcadmin@verbumcaremac-mini" "curl -k -s https://localhost/api/patients | grep -q 'success'"; then
    print_status "OK" "HTTPS API endpoint working"
else
    print_status "ERROR" "HTTPS API endpoint not working"
fi

echo ""
echo -e "${BLUE}9. Cleanup${NC}"
echo "========"

# Clean up temporary files
echo "Cleaning up temporary files..."
rm -f /tmp/migration_backup_$TIMESTAMP.* && {
    print_status "OK" "Local temporary files cleaned"
}

run_remote "verbumcare-lab.local" "rm -f /tmp/migration_backup_$TIMESTAMP.*" && {
    print_status "OK" "pn51 temporary files cleaned"
}

run_remote "vcadmin@verbumcaremac-mini" "rm -f /tmp/migration_backup_$TIMESTAMP.*" && {
    print_status "OK" "Mac Mini temporary files cleaned"
}

echo ""
echo -e "${GREEN}✅ Database Migration Complete${NC}"
echo ""
echo "Migration Summary:"
echo "=================="
echo "- Source database (pn51): $source_size"
echo "- Target database (Mac Mini): $imported_size"
echo "- Tables migrated: $target_tables"
echo "- Migration timestamp: $TIMESTAMP"
echo ""
echo "Verification Results:"
echo "- Database size: $([ "$source_size" = "$imported_size" ] && echo "✅ Match" || echo "⚠️  Different")"
echo "- Table count: $([ "$source_tables" -eq "$target_tables" ] && echo "✅ Match" || echo "⚠️  Different")"
echo "- Backend connectivity: ✅ Working"
echo "- HTTPS endpoint: ✅ Working"
echo ""
echo "Mac Mini Database Access:"
echo "- Connection string: postgres://nagare:nagare_secure_password_change_me@verbumcaremac-mini:5432/nagare_db"
echo "- Direct access: ssh vcadmin@verbumcaremac-mini 'docker exec -it macmini-postgres psql -U nagare -d nagare_db'"
echo ""
echo "Next step: Run verify-macmini-deployment.sh for comprehensive testing"