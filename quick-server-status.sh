#!/bin/bash

# Quick VerbumCare Server Status Check

echo "🔍 QUICK SERVER STATUS CHECK"
echo "============================"
echo ""

SERVER="verbumcare-lab.local"
PROJECT_DIR="/home/q/verbumcare-demo"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📡 SSH Connection:${NC}"
if ssh -o ConnectTimeout=5 $SERVER "echo 'Connected'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH working${NC}"
else
    echo -e "${RED}❌ SSH failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🐳 Docker Services:${NC}"
ssh $SERVER "cd $PROJECT_DIR && docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo -e "${BLUE}🏥 Database Status:${NC}"
if ssh $SERVER "docker exec nagare-postgres psql -U nagare -d nagare_db -c 'SELECT 1;'" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database responding${NC}"
    PATIENT_COUNT=$(ssh $SERVER "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c 'SELECT COUNT(*) FROM patients;'" 2>/dev/null | tr -d ' ')
    echo "   Patients: $PATIENT_COUNT"
else
    echo -e "${RED}❌ Database not responding${NC}"
fi

echo ""
echo -e "${BLUE}🌐 API Status:${NC}"
if ssh $SERVER "curl -k -s https://verbumcare-lab.local/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ API responding${NC}"
else
    echo -e "${RED}❌ API not responding${NC}"
fi

echo ""
echo -e "${BLUE}🔐 SSL Status:${NC}"
if ssh $SERVER "curl -k -s https://verbumcare-lab.local/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ SSL working${NC}"
else
    echo -e "${RED}❌ SSL not working${NC}"
fi

echo ""
echo -e "${BLUE}💾 Disk Usage:${NC}"
ssh $SERVER "df -h | grep -E '(Filesystem|/dev/)'"

echo ""
echo -e "${BLUE}🧠 Memory Usage:${NC}"
ssh $SERVER "free -h"