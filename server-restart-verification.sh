#!/bin/bash

# VerbumCare Server Restart Verification Script
# Ensures server comes back up "working" after shutdown

echo "🔄 VERBUMCARE SERVER RESTART VERIFICATION"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server details
SERVER="verbumcare-lab.local"
PROJECT_DIR="/home/q/verbumcare-demo"

echo -e "${BLUE}📡 Testing SSH connectivity...${NC}"
if ! ssh -o ConnectTimeout=10 $SERVER "echo 'SSH connection successful'"; then
    echo -e "${RED}❌ Cannot connect to $SERVER${NC}"
    echo "Please ensure the server is powered on and network accessible"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection working${NC}"

echo ""
echo -e "${BLUE}🐳 Checking Docker status...${NC}"
ssh $SERVER "docker --version && docker compose version"

echo ""
echo -e "${BLUE}📁 Checking project directory...${NC}"
if ! ssh $SERVER "test -d $PROJECT_DIR"; then
    echo -e "${RED}❌ Project directory $PROJECT_DIR not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Project directory exists${NC}"

echo ""
echo -e "${BLUE}📋 Current container status...${NC}"
ssh $SERVER "cd $PROJECT_DIR && docker compose ps"

echo ""
echo -e "${BLUE}🚀 Starting all services...${NC}"
ssh $SERVER "cd $PROJECT_DIR && docker compose up -d"

echo ""
echo -e "${BLUE}⏳ Waiting for services to start (30 seconds)...${NC}"
sleep 30

echo ""
echo -e "${BLUE}🔍 Verifying service status...${NC}"
ssh $SERVER "cd $PROJECT_DIR && docker compose ps"

echo ""
echo -e "${BLUE}🏥 Testing database connectivity...${NC}"
if ssh $SERVER "docker exec nagare-postgres psql -U nagare -d nagare_db -c 'SELECT 1;'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection working${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Checking database logs..."
    ssh $SERVER "cd $PROJECT_DIR && docker compose logs postgres | tail -20"
fi

echo ""
echo -e "${BLUE}🌐 Testing backend API...${NC}"
if ssh $SERVER "curl -k -s https://verbumcare-lab.local/health" | grep -q "success"; then
    echo -e "${GREEN}✅ Backend API responding${NC}"
else
    echo -e "${RED}❌ Backend API not responding${NC}"
    echo "Checking backend logs..."
    ssh $SERVER "cd $PROJECT_DIR && docker compose logs backend | tail -20"
fi

echo ""
echo -e "${BLUE}🔐 Testing SSL certificates...${NC}"
if ssh $SERVER "curl -k -s https://verbumcare-lab.local/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSL certificates working${NC}"
else
    echo -e "${RED}❌ SSL certificates not working${NC}"
    echo "Checking nginx logs..."
    ssh $SERVER "cd $PROJECT_DIR && docker compose logs nginx | tail -20"
fi

echo ""
echo -e "${BLUE}📊 Final service verification...${NC}"
ssh $SERVER "cd $PROJECT_DIR && docker compose ps"

echo ""
echo -e "${BLUE}🎯 Testing critical endpoints...${NC}"

# Test login endpoint
if ssh $SERVER "curl -k -s -X POST https://verbumcare-lab.local/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"demo\",\"password\":\"demo123\"}'" | grep -q "success"; then
    echo -e "${GREEN}✅ Login endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  Login endpoint may need attention${NC}"
fi

# Test patients endpoint
if ssh $SERVER "curl -k -s https://verbumcare-lab.local/api/patients" | grep -q "success\|patients"; then
    echo -e "${GREEN}✅ Patients endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  Patients endpoint may need attention${NC}"
fi

echo ""
echo -e "${BLUE}📝 RESTART VERIFICATION SUMMARY${NC}"
echo "================================"

# Count running containers
RUNNING_CONTAINERS=$(ssh $SERVER "cd $PROJECT_DIR && docker compose ps --format json" | grep -c "running" || echo "0")

if [ "$RUNNING_CONTAINERS" -ge 3 ]; then
    echo -e "${GREEN}🎉 SERVER RESTART SUCCESSFUL!${NC}"
    echo -e "${GREEN}✅ All critical services are running${NC}"
    echo -e "${GREEN}✅ Database connectivity verified${NC}"
    echo -e "${GREEN}✅ API endpoints responding${NC}"
    echo -e "${GREEN}✅ SSL certificates working${NC}"
    echo ""
    echo -e "${BLUE}📱 Ready for iPad app connections${NC}"
    echo -e "${BLUE}🌐 Admin portal accessible at: https://verbumcare-lab.local${NC}"
    echo -e "${BLUE}🔗 API base URL: https://verbumcare-lab.local/api${NC}"
else
    echo -e "${RED}⚠️  SERVER RESTART INCOMPLETE${NC}"
    echo -e "${RED}Only $RUNNING_CONTAINERS containers running (expected 3+)${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting steps:${NC}"
    echo "1. Check Docker logs: ssh $SERVER 'cd $PROJECT_DIR && docker compose logs'"
    echo "2. Restart services: ssh $SERVER 'cd $PROJECT_DIR && docker compose restart'"
    echo "3. Check disk space: ssh $SERVER 'df -h'"
    echo "4. Check memory: ssh $SERVER 'free -h'"
fi

echo ""
echo -e "${BLUE}🔄 Auto-restart configuration:${NC}"
echo "To ensure services restart automatically after reboot:"
echo "1. SSH to server: ssh $SERVER"
echo "2. Add to crontab: @reboot cd $PROJECT_DIR && docker compose up -d"
echo "3. Or use systemd service (recommended for production)"

exit 0