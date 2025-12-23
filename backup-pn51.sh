#!/bin/bash
# Comprehensive backup script for pn51 before Mac Mini migration
# Creates multiple backup types for safety and rollback capability

set -e

echo "🔄 Creating Comprehensive pn51 Backup"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timestamp for backup files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="pn51_backup_$TIMESTAMP"

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

# Create local backup directory
echo "Creating local backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
print_status "OK" "Local backup directory created"

echo ""
echo -e "${BLUE}1. Database Backup (Critical)${NC}"
echo "============================="

# Stop backend temporarily for consistent backup
echo "Temporarily stopping backend for consistent database backup..."
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker stop nagare-backend" || {
    print_status "WARN" "Could not stop backend - proceeding with live backup"
}

# Create comprehensive database backup
echo "Creating full database dump..."
ssh verbumcare-lab.local "docker exec nagare-postgres pg_dump -U nagare -d nagare_db --verbose --clean --no-owner --no-privileges > /tmp/verbumcare_full_backup_$TIMESTAMP.sql" && {
    print_status "OK" "Full database dump created"
} || {
    print_status "ERROR" "Failed to create full database dump"
    exit 1
}

# Create schema-only backup
echo "Creating schema-only backup..."
ssh verbumcare-lab.local "docker exec nagare-postgres pg_dump -U nagare -d nagare_db --schema-only --verbose --clean --no-owner --no-privileges > /tmp/verbumcare_schema_backup_$TIMESTAMP.sql" && {
    print_status "OK" "Schema-only backup created"
} || {
    print_status "WARN" "Schema-only backup failed"
}

# Create data-only backup
echo "Creating data-only backup..."
ssh verbumcare-lab.local "docker exec nagare-postgres pg_dump -U nagare -d nagare_db --data-only --verbose --no-owner --no-privileges > /tmp/verbumcare_data_backup_$TIMESTAMP.sql" && {
    print_status "OK" "Data-only backup created"
} || {
    print_status "WARN" "Data-only backup failed"
}

# Restart backend
echo "Restarting backend..."
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker start nagare-backend" && {
    print_status "OK" "Backend restarted"
} || {
    print_status "ERROR" "Failed to restart backend"
}

# Copy database backups locally
echo "Copying database backups locally..."
scp verbumcare-lab.local:/tmp/verbumcare_*_backup_$TIMESTAMP.sql "$BACKUP_DIR/" && {
    print_status "OK" "Database backups copied locally"
} || {
    print_status "ERROR" "Failed to copy database backups"
    exit 1
}

echo ""
echo -e "${BLUE}2. Docker Volume Backup${NC}"
echo "======================"

# Backup PostgreSQL data volume
echo "Creating PostgreSQL data volume backup..."
ssh verbumcare-lab.local "docker run --rm -v nagare_postgres_data:/data -v /tmp:/backup alpine tar czf /backup/postgres_data_$TIMESTAMP.tar.gz -C /data ." && {
    print_status "OK" "PostgreSQL data volume backed up"
} || {
    print_status "WARN" "PostgreSQL data volume backup failed"
}

# Copy volume backup locally
echo "Copying volume backup locally..."
scp verbumcare-lab.local:/tmp/postgres_data_$TIMESTAMP.tar.gz "$BACKUP_DIR/" && {
    print_status "OK" "Volume backup copied locally"
} || {
    print_status "WARN" "Volume backup copy failed"
}

echo ""
echo -e "${BLUE}3. SSL Certificates Backup (Critical)${NC}"
echo "====================================="

# Backup SSL certificates from primary location
echo "Backing up SSL certificates from /opt/verbumcare/ssl/..."
if ssh verbumcare-lab.local "sudo tar -czf /tmp/ssl_primary_backup_$TIMESTAMP.tar.gz -C /opt/verbumcare ssl/ 2>/dev/null"; then
    print_status "OK" "Primary SSL certificates backed up"
else
    print_status "WARN" "Primary SSL certificates backup failed (may need sudo password)"
fi

# Backup SSL certificates from secondary location
echo "Backing up SSL certificates from /home/q/verbumcare-demo/ssl/..."
ssh verbumcare-lab.local "tar -czf /tmp/ssl_secondary_backup_$TIMESTAMP.tar.gz -C /home/q/verbumcare-demo ssl/" && {
    print_status "OK" "Secondary SSL certificates backed up"
} || {
    print_status "WARN" "Secondary SSL certificates backup failed"
}

# Copy SSL backups locally
echo "Copying SSL certificate backups locally..."
scp verbumcare-lab.local:/tmp/ssl_*_backup_$TIMESTAMP.tar.gz "$BACKUP_DIR/" 2>/dev/null && {
    print_status "OK" "SSL certificate backups copied locally"
} || {
    print_status "WARN" "Some SSL certificate backups may not have been copied"
}

echo ""
echo -e "${BLUE}4. Application Files Backup${NC}"
echo "=========================="

# Backup entire application directory
echo "Creating application files backup..."
ssh verbumcare-lab.local "tar --exclude='verbumcare-demo/uploads/*' --exclude='verbumcare-demo/node_modules' -czf /tmp/verbumcare_app_$TIMESTAMP.tar.gz -C /home/q verbumcare-demo" && {
    print_status "OK" "Application files backed up (excluding uploads and node_modules)"
} || {
    print_status "ERROR" "Application files backup failed"
    exit 1
}

# Copy application backup locally
echo "Copying application backup locally..."
scp verbumcare-lab.local:/tmp/verbumcare_app_$TIMESTAMP.tar.gz "$BACKUP_DIR/" && {
    print_status "OK" "Application backup copied locally"
} || {
    print_status "ERROR" "Failed to copy application backup"
}

echo ""
echo -e "${BLUE}5. Uploads Directory Backup${NC}"
echo "=========================="

# Check uploads directory size first
echo "Checking uploads directory size..."
uploads_size=$(ssh verbumcare-lab.local "du -sh /home/q/verbumcare-demo/uploads 2>/dev/null | cut -f1" || echo "unknown")
echo "Uploads directory size: $uploads_size"

# Backup uploads directory (may be large)
echo "Creating uploads directory backup..."
ssh verbumcare-lab.local "tar -czf /tmp/verbumcare_uploads_$TIMESTAMP.tar.gz -C /home/q/verbumcare-demo uploads/" && {
    print_status "OK" "Uploads directory backed up"
} || {
    print_status "WARN" "Uploads directory backup failed (may be too large)"
}

# Copy uploads backup locally (if not too large)
if [[ "$uploads_size" != *"G"* ]] || [[ "$uploads_size" == "0"* ]]; then
    echo "Copying uploads backup locally..."
    scp verbumcare-lab.local:/tmp/verbumcare_uploads_$TIMESTAMP.tar.gz "$BACKUP_DIR/" && {
        print_status "OK" "Uploads backup copied locally"
    } || {
        print_status "WARN" "Uploads backup copy failed"
    }
else
    print_status "WARN" "Uploads backup too large ($uploads_size) - keeping on remote server only"
fi

echo ""
echo -e "${BLUE}6. Docker Configuration Backup${NC}"
echo "=============================="

# Backup docker-compose files and configurations
echo "Creating Docker configuration backup..."
ssh verbumcare-lab.local "tar -czf /tmp/docker_config_$TIMESTAMP.tar.gz -C /home/q/verbumcare-demo docker-compose*.yml nginx/ .env* || true" && {
    print_status "OK" "Docker configuration backed up"
} || {
    print_status "WARN" "Docker configuration backup failed"
}

# Copy Docker config backup locally
echo "Copying Docker configuration backup locally..."
scp verbumcare-lab.local:/tmp/docker_config_$TIMESTAMP.tar.gz "$BACKUP_DIR/" && {
    print_status "OK" "Docker configuration backup copied locally"
} || {
    print_status "WARN" "Docker configuration backup copy failed"
}

echo ""
echo -e "${BLUE}7. System Information Capture${NC}"
echo "============================="

# Capture system information for reference
echo "Capturing system information..."
ssh verbumcare-lab.local "
echo '=== System Information ===' > /tmp/system_info_$TIMESTAMP.txt
uname -a >> /tmp/system_info_$TIMESTAMP.txt
echo '' >> /tmp/system_info_$TIMESTAMP.txt
echo '=== Docker Version ===' >> /tmp/system_info_$TIMESTAMP.txt
docker --version >> /tmp/system_info_$TIMESTAMP.txt
echo '' >> /tmp/system_info_$TIMESTAMP.txt
echo '=== Docker Containers ===' >> /tmp/system_info_$TIMESTAMP.txt
docker ps -a >> /tmp/system_info_$TIMESTAMP.txt
echo '' >> /tmp/system_info_$TIMESTAMP.txt
echo '=== Docker Images ===' >> /tmp/system_info_$TIMESTAMP.txt
docker images >> /tmp/system_info_$TIMESTAMP.txt
echo '' >> /tmp/system_info_$TIMESTAMP.txt
echo '=== Docker Volumes ===' >> /tmp/system_info_$TIMESTAMP.txt
docker volume ls >> /tmp/system_info_$TIMESTAMP.txt
echo '' >> /tmp/system_info_$TIMESTAMP.txt
echo '=== Disk Usage ===' >> /tmp/system_info_$TIMESTAMP.txt
df -h >> /tmp/system_info_$TIMESTAMP.txt
" && {
    print_status "OK" "System information captured"
} || {
    print_status "WARN" "System information capture failed"
}

# Copy system info locally
scp verbumcare-lab.local:/tmp/system_info_$TIMESTAMP.txt "$BACKUP_DIR/" && {
    print_status "OK" "System information copied locally"
} || {
    print_status "WARN" "System information copy failed"
}

echo ""
echo -e "${BLUE}8. Backup Verification${NC}"
echo "===================="

# Verify backup integrity
echo "Verifying backup integrity..."
backup_files=$(ls -la "$BACKUP_DIR/" | wc -l)
if [ "$backup_files" -gt 5 ]; then
    print_status "OK" "Backup directory contains $backup_files files"
else
    print_status "ERROR" "Backup directory contains insufficient files ($backup_files)"
fi

# Check database backup integrity
if [ -f "$BACKUP_DIR/verbumcare_full_backup_$TIMESTAMP.sql" ]; then
    backup_size=$(wc -l < "$BACKUP_DIR/verbumcare_full_backup_$TIMESTAMP.sql")
    if [ "$backup_size" -gt 100 ]; then
        print_status "OK" "Database backup appears valid ($backup_size lines)"
    else
        print_status "ERROR" "Database backup appears invalid ($backup_size lines)"
    fi
else
    print_status "ERROR" "Database backup file not found"
fi

echo ""
echo -e "${BLUE}9. Cleanup Remote Temporary Files${NC}"
echo "================================="

# Clean up temporary files on remote server
echo "Cleaning up temporary files on pn51..."
ssh verbumcare-lab.local "rm -f /tmp/verbumcare_*_$TIMESTAMP.* /tmp/ssl_*_$TIMESTAMP.* /tmp/postgres_data_$TIMESTAMP.* /tmp/docker_config_$TIMESTAMP.* /tmp/system_info_$TIMESTAMP.txt" && {
    print_status "OK" "Remote temporary files cleaned up"
} || {
    print_status "WARN" "Remote cleanup failed"
}

echo ""
echo -e "${GREEN}✅ pn51 Backup Complete${NC}"
echo ""
echo "Backup Summary:"
echo "==============="
echo "Backup directory: $BACKUP_DIR"
echo "Backup timestamp: $TIMESTAMP"
echo ""
echo "Backup contents:"
ls -lh "$BACKUP_DIR/"
echo ""
echo "Critical files backed up:"
echo "- Full database dump (verbumcare_full_backup_$TIMESTAMP.sql)"
echo "- SSL certificates (ssl_*_backup_$TIMESTAMP.tar.gz)"
echo "- Application files (verbumcare_app_$TIMESTAMP.tar.gz)"
echo "- Docker configurations (docker_config_$TIMESTAMP.tar.gz)"
echo "- System information (system_info_$TIMESTAMP.txt)"
echo ""
echo -e "${YELLOW}⚠️  Keep this backup safe - it's your rollback point!${NC}"
echo ""
echo "Next step: Run setup-macmini-environment.sh"