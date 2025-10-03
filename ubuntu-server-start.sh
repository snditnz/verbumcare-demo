#!/bin/bash

# VerbumCare Ubuntu Server Startup Script
# For Ubuntu 24.04 LTS x64 with Ollama + Whisper
# Server: verbumcare-lab.local

set -e  # Exit on error

echo "🚀 VerbumCare Ubuntu Server Startup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WHISPER_PORT=8080
OLLAMA_PORT=11434
BACKEND_PORT=3000
POSTGRES_PORT=5432

# Function to check if a service is running
check_service() {
    local name=$1
    local port=$2
    local url=$3

    echo -n "Checking ${name}... "

    if curl -s --max-time 5 "${url}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not available${NC}"
        return 1
    fi
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

echo "📋 Step 1: Pre-flight Checks"
echo "------------------------------"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose available${NC}"

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠ Ollama not found in PATH${NC}"
    echo "  Install: curl -fsSL https://ollama.com/install.sh | sh"
fi

# Check Whisper (multiple possible installations)
WHISPER_CMD=""
if command -v whisper &> /dev/null; then
    WHISPER_CMD="whisper"
elif command -v whisper.cpp &> /dev/null; then
    WHISPER_CMD="whisper.cpp"
elif [ -f "/usr/local/bin/whisper-server" ]; then
    WHISPER_CMD="/usr/local/bin/whisper-server"
fi

if [ -z "$WHISPER_CMD" ]; then
    echo -e "${YELLOW}⚠ Whisper not found${NC}"
    echo "  Install whisper.cpp or faster-whisper"
fi

echo ""
echo "🔧 Step 2: Starting AI Services"
echo "------------------------------"

# Start Ollama if not running
if ! check_port $OLLAMA_PORT; then
    echo "Starting Ollama service..."
    if command -v systemctl &> /dev/null && systemctl is-active --quiet ollama; then
        echo -e "${GREEN}✓ Ollama already running (systemd)${NC}"
    else
        # Start Ollama in background
        nohup ollama serve > /dev/null 2>&1 &
        sleep 3
        echo -e "${GREEN}✓ Ollama started${NC}"
    fi
else
    echo -e "${GREEN}✓ Ollama already running${NC}"
fi

# Verify Ollama and models
if check_service "Ollama" $OLLAMA_PORT "http://localhost:${OLLAMA_PORT}/api/tags"; then
    echo -n "  Checking models... "
    MODELS=$(curl -s http://localhost:${OLLAMA_PORT}/api/tags | grep -o '"name":"[^"]*"' | wc -l)
    if [ "$MODELS" -gt 0 ]; then
        echo -e "${GREEN}${MODELS} model(s) available${NC}"
    else
        echo -e "${YELLOW}No models found${NC}"
        echo "  Run: ollama pull llama3:8b"
    fi
fi

# Start Whisper if not running
if ! check_port $WHISPER_PORT; then
    echo "Starting Whisper service..."

    # Try to start Whisper server (depends on installation)
    if [ -n "$WHISPER_CMD" ]; then
        # This is a placeholder - adjust based on actual Whisper setup
        echo -e "${YELLOW}⚠ Please start Whisper manually on port ${WHISPER_PORT}${NC}"
        echo "  Example: whisper-server --port ${WHISPER_PORT} --model large-v3"
    else
        echo -e "${YELLOW}⚠ Whisper command not found${NC}"
    fi
else
    echo -e "${GREEN}✓ Whisper already running on port ${WHISPER_PORT}${NC}"
fi

echo ""
echo "🐳 Step 3: Starting Docker Services"
echo "------------------------------"

# Check if docker-compose.ubuntu.yml exists
if [ ! -f "docker-compose.ubuntu.yml" ]; then
    echo -e "${RED}✗ docker-compose.ubuntu.yml not found${NC}"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env from template..."
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✓ Created backend/.env${NC}"
    else
        echo -e "${RED}✗ backend/.env.example not found${NC}"
        exit 1
    fi
fi

# Update .env with Ubuntu server settings
echo "Configuring environment for Ubuntu server..."
sed -i.bak 's|WHISPER_URL=.*|WHISPER_URL=http://host.docker.internal:'"${WHISPER_PORT}"'|' backend/.env
sed -i.bak 's|OLLAMA_URL=.*|OLLAMA_URL=http://host.docker.internal:'"${OLLAMA_PORT}"'|' backend/.env
echo -e "${GREEN}✓ Environment configured${NC}"

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.ubuntu.yml down 2>/dev/null || true

# Start services
echo "Starting Docker containers..."
docker-compose -f docker-compose.ubuntu.yml up -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
echo "------------------------------"

# Wait for PostgreSQL
echo -n "PostgreSQL... "
for i in {1..30}; do
    if docker-compose -f docker-compose.ubuntu.yml exec -T postgres pg_isready -U demo -d verbumcare_demo > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    sleep 1
done

# Wait for Backend
echo -n "Backend API... "
for i in {1..30}; do
    if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    sleep 1
done

echo ""
echo "🏥 Step 4: System Health Check"
echo "------------------------------"

# Check all services
ALL_OK=true

check_service "PostgreSQL" $POSTGRES_PORT "http://localhost:${BACKEND_PORT}/health" || ALL_OK=false
check_service "Backend API" $BACKEND_PORT "http://localhost:${BACKEND_PORT}/health" || ALL_OK=false
check_service "Ollama" $OLLAMA_PORT "http://localhost:${OLLAMA_PORT}/api/tags" || ALL_OK=false

if check_port $WHISPER_PORT; then
    echo -e "Whisper... ${GREEN}✓ Running${NC}"
else
    echo -e "Whisper... ${YELLOW}⚠ Not running (optional)${NC}"
fi

echo ""
echo "📊 System Information"
echo "------------------------------"
echo -e "Server Hostname: ${BLUE}$(hostname)${NC}"
echo -e "IP Address: ${BLUE}$(hostname -I | awk '{print $1}')${NC}"
echo -e "Backend API: ${BLUE}http://$(hostname):${BACKEND_PORT}${NC}"
echo -e "Admin Portal: ${BLUE}http://$(hostname):5173${NC} (if running)"
echo ""

# Show container status
echo "Docker Containers:"
docker-compose -f docker-compose.ubuntu.yml ps

echo ""
echo "======================================"
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✅ VerbumCare Ubuntu Server Ready!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Access backend: http://$(hostname):3000/health"
    echo "2. Configure client devices to connect to: http://$(hostname):3000/api"
    echo "3. Run test: ./test-ubuntu-api.sh"
else
    echo -e "${YELLOW}⚠️  Some services are not fully operational${NC}"
    echo ""
    echo "Check logs with:"
    echo "  docker-compose -f docker-compose.ubuntu.yml logs -f backend"
fi
echo "======================================"
