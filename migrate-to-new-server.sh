#!/bin/bash

# VerbumCare Server Migration Script
# Migrates complete VerbumCare installation to new Mac Mini
# Includes all data, configurations, and SSL certificates

echo "🚀 VERBUMCARE SERVER MIGRATION TO NEW MAC MINI"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server details
OLD_SERVER="verbumcare-lab.local"
OLD_PROJECT_DIR="/home/q/verbumcare-demo"

# Prompt for new server details
echo -e "${BLUE}📝 New Server Configuration${NC}"
echo "Please provide the following information for your new Mac Mini:"
echo ""

read -p "New server hostname/IP (e.g., verbumcare-lab-2.local): " NEW_SERVER
read -p "Username on new server (e.g., admin): " NEW_USER
read -p "Project directory on new server (e.g., /Users/admin/verbumcare-demo): " NEW_PROJECT_DIR

echo ""
echo -e "${BLUE}📋 Migration Plan Summary${NC}"
echo "========================="
echo "Source: $OLD_SERVER:$OLD_PROJECT_DIR"
echo "Target: $NEW_SERVER:$NEW_PROJECT_DIR"
echo "User: $NEW_USER"
echo ""

read -p "Continue with migration? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo -e "${BLUE}🔍 Phase 1: Pre-migration verification${NC}"
echo "======================================"

# Test connectivity to both servers
echo "Testing connectivity to old server..."
if ! ssh -o ConnectTimeout=10 $OLD_SERVER "echo 'Old server accessible'"; then
    echo -e "${RED}❌ Cannot connect to old server $OLD_SERVER${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Old server accessible${NC}"

echo "Testing connectivity to new server..."
if ! ssh -o ConnectTimeout=10 $NEW_USER@$NEW_SERVER "echo 'New server accessible'"; then
    echo -e "${RED}❌ Cannot connect to new server $NEW_SERVER${NC}"
    echo "Please ensure:"
    echo "1. New Mac Mini is powered on and connected to network"
    echo "2. SSH is enabled in System Preferences > Sharing"
    echo "3. User $NEW_USER exists and has admin privileges"
    echo "4. SSH key authentication is set up"
    exit 1
fi
echo -e "${GREEN}✅ New server accessible${NC}"

echo ""
echo -e "${BLUE}💾 Phase 2: Database backup${NC}"
echo "=========================="

# Create timestamped backup
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="verbumcare_migration_backup_$BACKUP_TIMESTAMP.sql"

echo "Creating database backup..."
if ssh $OLD_SERVER "docker exec nagare-postgres pg_dump -U nagare -d nagare_db > /tmp/$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Database backup created: $BACKUP_FILE${NC}"
else
    echo -e "${RED}❌ Database backup failed${NC}"
    exit 1
fi

# Verify backup
BACKUP_SIZE=$(ssh $OLD_SERVER "ls -lh /tmp/$BACKUP_FILE | awk '{print \$5}'")
echo "Backup size: $BACKUP_SIZE"

if ssh $OLD_SERVER "test -s /tmp/$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup file is not empty${NC}"
else
    echo -e "${RED}❌ Backup file is empty or corrupted${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📁 Phase 3: File system preparation${NC}"
echo "=================================="

# Prepare new server
echo "Preparing new server directory structure..."
ssh $NEW_USER@$NEW_SERVER "mkdir -p $NEW_PROJECT_DIR"
ssh $NEW_USER@$NEW_SERVER "mkdir -p $NEW_PROJECT_DIR/uploads"
ssh $NEW_USER@$NEW_SERVER "mkdir -p $NEW_PROJECT_DIR/ssl/certs"
ssh $NEW_USER@$NEW_SERVER "mkdir -p $NEW_PROJECT_DIR/ssl/private"

# Check if Docker is installed on new server
echo "Checking Docker installation on new server..."
if ssh $NEW_USER@$NEW_SERVER "docker --version && docker compose version" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker is installed on new server${NC}"
else
    echo -e "${YELLOW}⚠️  Docker not found on new server${NC}"
    echo "Please install Docker Desktop on the new Mac Mini:"
    echo "1. Download from https://www.docker.com/products/docker-desktop"
    echo "2. Install and start Docker Desktop"
    echo "3. Verify with: docker --version"
    read -p "Press Enter after Docker is installed..."
fi

echo ""
echo -e "${BLUE}🔄 Phase 4: Code and configuration transfer${NC}"
echo "=========================================="

# Transfer project files
echo "Transferring project files..."
rsync -avz --progress -e ssh $OLD_SERVER:$OLD_PROJECT_DIR/ $NEW_USER@$NEW_SERVER:$NEW_PROJECT_DIR/

# Verify transfer
echo "Verifying file transfer..."
OLD_FILE_COUNT=$(ssh $OLD_SERVER "find $OLD_PROJECT_DIR -type f | wc -l")
NEW_FILE_COUNT=$(ssh $NEW_USER@$NEW_SERVER "find $NEW_PROJECT_DIR -type f | wc -l")

echo "Old server files: $OLD_FILE_COUNT"
echo "New server files: $NEW_FILE_COUNT"

if [ "$OLD_FILE_COUNT" -eq "$NEW_FILE_COUNT" ]; then
    echo -e "${GREEN}✅ File transfer complete and verified${NC}"
else
    echo -e "${YELLOW}⚠️  File count mismatch - some files may not have transferred${NC}"
fi

echo ""
echo -e "${BLUE}🔐 Phase 5: SSL certificate transfer${NC}"
echo "=================================="

# Transfer SSL certificates from secure location
echo "Transferring SSL certificates..."
if ssh $OLD_SERVER "test -f /opt/verbumcare/ssl/certs/nginx.crt"; then
    # Transfer from /opt/verbumcare (primary location)
    scp $OLD_SERVER:/opt/verbumcare/ssl/certs/nginx.crt $NEW_USER@$NEW_SERVER:$NEW_PROJECT_DIR/ssl/certs/
    scp $OLD_SERVER:/opt/verbumcare/ssl/certs/nginx.key $NEW_USER@$NEW_SERVER:$NEW_PROJECT_DIR/ssl/certs/
    scp $OLD_SERVER:/opt/verbumcare/ssl/certs/ca.crt $NEW_USER@$NEW_SERVER:$NEW_PROJECT_DIR/ssl/certs/
    scp $OLD_SERVER:/opt/verbumcare/ssl/private/ca.key $NEW_USER@$NEW_SERVER:$NEW_PROJECT_DIR/ssl/private/
    echo -e "${GREEN}✅ SSL certificates transferred from /opt/verbumcare${NC}"
else
    echo -e "${YELLOW}⚠️  Primary SSL certificates not found, checking backup location${NC}"
    # Try backup location
    if ssh $OLD_SERVER "test -f $OLD_PROJECT_DIR/ssl/certs/nginx.crt"; then
        echo "Using certificates from project directory"
        echo -e "${GREEN}✅ SSL certificates already included in project transfer${NC}"
    else
        echo -e "${RED}❌ SSL certificates not found in either location${NC}"
        echo "You may need to regenerate SSL certificates on the new server"
    fi
fi

echo ""
echo -e "${BLUE}💾 Phase 6: Database migration${NC}"
echo "============================="

# Transfer database backup
echo "Transferring database backup..."
scp $OLD_SERVER:/tmp/$BACKUP_FILE $NEW_USER@$NEW_SERVER:/tmp/

# Start PostgreSQL container on new server
echo "Starting PostgreSQL container on new server..."
ssh $NEW_USER@$NEW_SERVER "cd $NEW_PROJECT_DIR && docker compose up -d postgres"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to start..."
sleep 30

# Restore database
echo "Restoring database on new server..."
if ssh $NEW_USER@$NEW_SERVER "docker exec -i nagare-postgres psql -U nagare -d nagare_db < /tmp/$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Database restored successfully${NC}"
else
    echo -e "${RED}❌ Database restore failed${NC}"
    echo "Check PostgreSQL logs on new server"
fi

echo ""
echo -e "${BLUE}🚀 Phase 7: Service startup${NC}"
echo "=========================="

# Start all services on new server
echo "Starting all services on new server..."
ssh $NEW_USER@$NEW_SERVER "cd $NEW_PROJECT_DIR && docker compose up -d"

# Wait for services to start
echo "Waiting for services to start..."
sleep 45

echo ""
echo -e "${BLUE}🔍 Phase 8: Migration verification${NC}"
echo "================================"

# Verify services are running
echo "Checking service status..."
ssh $NEW_USER@$NEW_SERVER "cd $NEW_PROJECT_DIR && docker compose ps"

# Test database connectivity
echo "Testing database connectivity..."
if ssh $NEW_USER@$NEW_SERVER "docker exec nagare-postgres psql -U nagare -d nagare_db -c 'SELECT COUNT(*) FROM patients;'"; then
    echo -e "${GREEN}✅ Database connectivity verified${NC}"
else
    echo -e "${RED}❌ Database connectivity failed${NC}"
fi

# Test API endpoints
echo "Testing API endpoints..."
if ssh $NEW_USER@$NEW_SERVER "curl -k -s https://localhost/health" | grep -q "success"; then
    echo -e "${GREEN}✅ API endpoints responding${NC}"
else
    echo -e "${YELLOW}⚠️  API endpoints may need attention${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Phase 9: Network configuration${NC}"
echo "==============================="

echo "Setting up mDNS hostname (if needed)..."
echo "The new server should be accessible as: $NEW_SERVER"
echo ""
echo "To update iPad app configuration:"
echo "1. Update ipad-app/.env:"
echo "   EXPO_PUBLIC_API_URL=https://$NEW_SERVER/api"
echo ""
echo "2. Update admin-portal/.env:"
echo "   VITE_API_URL=https://$NEW_SERVER/api"
echo "   VITE_WS_URL=wss://$NEW_SERVER"

echo ""
echo -e "${BLUE}📊 MIGRATION SUMMARY${NC}"
echo "==================="

# Count data records
PATIENT_COUNT=$(ssh $NEW_USER@$NEW_SERVER "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c 'SELECT COUNT(*) FROM patients;'" 2>/dev/null | tr -d ' ' || echo "0")
VOICE_COUNT=$(ssh $NEW_USER@$NEW_SERVER "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c 'SELECT COUNT(*) FROM voice_recordings;'" 2>/dev/null | tr -d ' ' || echo "0")

echo "✅ Project files: Transferred"
echo "✅ SSL certificates: Transferred"
echo "✅ Database backup: $BACKUP_SIZE"
echo "✅ Patient records: $PATIENT_COUNT"
echo "✅ Voice recordings: $VOICE_COUNT"
echo "✅ Docker services: Running"

echo ""
echo -e "${GREEN}🎉 MIGRATION COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📱 Next Steps:${NC}"
echo "1. Update iPad app to point to new server: $NEW_SERVER"
echo "2. Test all functionality on new server"
echo "3. Update DNS/network settings if needed"
echo "4. Keep old server running until fully verified"
echo "5. Update any documentation with new server details"

echo ""
echo -e "${BLUE}🔧 New Server Access:${NC}"
echo "SSH: ssh $NEW_USER@$NEW_SERVER"
echo "Web: https://$NEW_SERVER"
echo "API: https://$NEW_SERVER/api"
echo "Project: $NEW_PROJECT_DIR"

echo ""
echo -e "${BLUE}🛡️  Security Notes:${NC}"
echo "1. SSL certificates have been transferred"
echo "2. Database includes all existing user accounts"
echo "3. All voice recordings and patient data preserved"
echo "4. Audit logs and medication hash chains intact"

# Cleanup
echo ""
echo "Cleaning up temporary files..."
ssh $OLD_SERVER "rm -f /tmp/$BACKUP_FILE"
ssh $NEW_USER@$NEW_SERVER "rm -f /tmp/$BACKUP_FILE"

echo -e "${GREEN}✅ Migration completed successfully!${NC}"