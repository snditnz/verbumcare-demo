#!/bin/bash
# VerbumCare Intel Mac (Server) Startup Script
# Starts all backend services for demo

set -e  # Exit on error

echo "🏥 VerbumCare Intel Mac Server Startup"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on correct machine
HOSTNAME=$(scutil --get LocalHostName 2>/dev/null || hostname)
if [[ "$HOSTNAME" != "verbumcare-server" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Hostname is '$HOSTNAME', expected 'verbumcare-server'${NC}"
    echo "Set with: sudo scutil --set LocalHostName verbumcare-server"
    echo ""
fi

# Check if in correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.yml not found${NC}"
    echo "Please run this script from the verbumcare-demo directory"
    exit 1
fi

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "📦 Step 1: Starting Docker services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to initialize (30 seconds)..."
sleep 5
echo "   25 seconds remaining..."
sleep 5
echo "   20 seconds remaining..."
sleep 5
echo "   15 seconds remaining..."
sleep 5
echo "   10 seconds remaining..."
sleep 5
echo "   5 seconds remaining..."
sleep 5

echo ""
echo "🔍 Step 2: Verifying backend health..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Backend API not responding yet, check logs:${NC}"
    echo "   docker-compose logs backend"
fi

echo ""
echo "🔍 Step 3: Checking database..."
if docker exec verbumcare-postgres pg_isready -U demo > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL not ready yet${NC}"
fi

echo ""
echo "🌐 Step 4: Starting Admin Portal..."
cd admin-portal
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Admin portal dependencies not installed${NC}"
    echo "Run: cd admin-portal && npm install"
    cd ..
else
    echo "Starting admin portal dev server..."
    npm run dev > ../admin-portal.log 2>&1 &
    ADMIN_PID=$!
    echo -e "${GREEN}✅ Admin Portal started (PID: $ADMIN_PID)${NC}"
    echo "   Logs: tail -f admin-portal.log"
    cd ..
fi

echo ""
echo "📊 Step 5: Starting Dashboard..."
cd dashboard 2>/dev/null || echo -e "${YELLOW}⚠️  Dashboard directory not found (optional)${NC}"
if [ -d "dashboard" ] && [ -d "dashboard/node_modules" ]; then
    cd dashboard
    npm run dev > ../dashboard.log 2>&1 &
    DASH_PID=$!
    echo -e "${GREEN}✅ Dashboard started (PID: $DASH_PID)${NC}"
    echo "   Logs: tail -f dashboard.log"
    cd ..
fi

echo ""
echo "🎯 Step 6: Verifying AI connectivity to M2 Mac..."
if curl -s http://verbumcare-ai.local:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama on M2 Mac is reachable${NC}"
else
    echo -e "${YELLOW}⚠️  Cannot reach Ollama on M2 Mac${NC}"
    echo "   Make sure M2 Mac AI services are running"
    echo "   Run ./m2-mac-start.sh on M2 Mac"
fi

if curl -s http://verbumcare-ai.local:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Whisper on M2 Mac is reachable${NC}"
else
    echo -e "${YELLOW}⚠️  Cannot reach Whisper on M2 Mac${NC}"
    echo "   Make sure M2 Mac AI services are running"
fi

echo ""
echo "================================================================"
echo -e "${GREEN}✅ Intel Mac Server Startup Complete!${NC}"
echo "================================================================"
echo ""
echo "🌐 Access URLs:"
echo "   Backend API:    http://localhost:3000"
echo "   Admin Portal:   http://localhost:5173"
echo "   Dashboard:      http://localhost:5174"
echo "   Config Display: http://localhost:3000/api/config/display"
echo ""
echo "📱 For iPad configuration:"
echo "   Open http://verbumcare-server.local:3000/api/config/display"
echo "   Scan the QR code"
echo ""
echo "🔍 Monitor services:"
echo "   docker-compose logs -f"
echo "   tail -f admin-portal.log"
echo ""
echo "🛑 To stop all services:"
echo "   docker-compose down"
echo "   pkill -f 'npm run dev'"
echo ""

# Memory check
MEMORY_USAGE=$(ps -A -o %mem | awk '{s+=$1} END {print s}')
echo "💾 Current memory usage: ${MEMORY_USAGE}%"
echo ""