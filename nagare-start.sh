#!/bin/bash

# Verbumcare Nagare (流れ) - Japan Edge Server Startup
# Complete deployment script for offline-first healthcare documentation

set -e

echo "🏥 Verbumcare Nagare Edge Server"
echo "================================="
echo "流れ - Flow of Healthcare Documentation"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
WHISPER_PORT=8080
OLLAMA_PORT=11434
NGINX_PORT_HTTP=80
NGINX_PORT_HTTPS=443

# Step 1: Prerequisites check
echo "📋 Step 1: Checking Prerequisites"
echo "----------------------------------"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not installed${NC}"
    echo "Install: curl -fsSL https://get.docker.com | sh"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not available${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose available${NC}"

# Check if mDNS is configured
if ! avahi-resolve -n nagare.local &> /dev/null; then
    echo -e "${YELLOW}⚠ mDNS not configured${NC}"
    echo "  Run: sudo ./mdns/setup-mdns.sh"
fi

# Check if SSL certificates exist
if [ ! -f "ssl/certs/nginx.crt" ]; then
    echo -e "${YELLOW}⚠ SSL certificates not found${NC}"
    echo "  Run: ./ssl/setup-local-ca.sh"
    echo ""
    echo "Generating SSL certificates now..."
    ./ssl/setup-local-ca.sh
fi

echo ""

# Step 2: Check AI Services
echo "🤖 Step 2: Verifying AI Services"
echo "----------------------------------"

# Check Ollama
if curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags > /dev/null 2>&1; then
    echo -e "Ollama... ${GREEN}✓ Running${NC}"
    MODELS=$(curl -s http://localhost:${OLLAMA_PORT}/api/tags | grep -o '"name":"[^"]*"' | wc -l)
    echo "  Models: ${MODELS} available"
else
    echo -e "Ollama... ${YELLOW}⚠ Not running${NC}"
    echo "  Start with: ollama serve"
fi

# Check Whisper
if curl -s --max-time 3 http://localhost:${WHISPER_PORT}/health > /dev/null 2>&1; then
    echo -e "Whisper... ${GREEN}✓ Running${NC}"
elif curl -s --max-time 3 http://localhost:${WHISPER_PORT}/ > /dev/null 2>&1; then
    echo -e "Whisper... ${GREEN}✓ Running${NC}"
else
    echo -e "Whisper... ${YELLOW}⚠ Not running${NC}"
    echo "  Start your faster-whisper server on port ${WHISPER_PORT}"
fi

echo ""

# Step 3: Environment Configuration
echo "⚙️  Step 3: Configuring Environment"
echo "----------------------------------"

# Copy Nagare environment file if .env doesn't exist
if [ ! -f "backend/.env" ]; then
    cp backend/.env.nagare backend/.env
    echo -e "${GREEN}✓ Created backend/.env from template${NC}"
else
    echo -e "${GREEN}✓ backend/.env exists${NC}"
fi

# Create required directories
mkdir -p backend/uploads backend/logs nginx/logs
echo -e "${GREEN}✓ Created required directories${NC}"

echo ""

# Step 4: Start Docker Services
echo "🐳 Step 4: Starting Docker Services"
echo "----------------------------------"

# Stop any existing services
docker compose -f docker-compose.nagare.yml down 2>/dev/null || true

# Start services
echo "Starting PostgreSQL, Backend, and nginx..."
docker compose -f docker-compose.nagare.yml up -d

echo -e "${GREEN}✓ Docker services started${NC}"
echo ""

# Step 5: Wait for services
echo "⏳ Step 5: Waiting for Services to be Ready"
echo "----------------------------------"

# Wait for PostgreSQL
echo -n "PostgreSQL... "
for i in {1..30}; do
    if docker compose -f docker-compose.nagare.yml exec -T postgres pg_isready -U nagare -d nagare_db > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    sleep 1
done

# Wait for Backend
echo -n "Backend API... "
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    sleep 1
done

# Wait for nginx
echo -n "nginx... "
for i in {1..10}; do
    if curl -s http://localhost:${NGINX_PORT_HTTP} > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    sleep 1
done

echo ""

# Step 6: System Health Check
echo "🏥 Step 6: System Health Check"
echo "----------------------------------"

ALL_OK=true

# Test local endpoints (HTTP, will redirect to HTTPS)
if curl -s http://localhost:${NGINX_PORT_HTTP} > /dev/null 2>&1; then
    echo -e "nginx HTTP... ${GREEN}✓ Running${NC}"
else
    echo -e "nginx HTTP... ${RED}✗ Failed${NC}"
    ALL_OK=false
fi

# Test HTTPS (will fail cert validation, but that's OK - we're just checking if it's listening)
if curl -k -s https://localhost:${NGINX_PORT_HTTPS} > /dev/null 2>&1; then
    echo -e "nginx HTTPS... ${GREEN}✓ Running${NC}"
else
    echo -e "nginx HTTPS... ${YELLOW}⚠ Check logs${NC}"
fi

# Test mDNS resolution
if avahi-resolve -n api.nagare.local &> /dev/null 2>&1; then
    echo -e "mDNS (api.nagare.local)... ${GREEN}✓ Resolving${NC}"
else
    echo -e "mDNS (api.nagare.local)... ${YELLOW}⚠ Not resolving${NC}"
    echo "  Run: sudo ./mdns/setup-mdns.sh"
fi

echo ""

# Step 7: Display Information
echo "================================="
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✅ Nagare Edge Server Ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Server started with warnings${NC}"
fi
echo "================================="
echo ""

echo "📊 System Information"
echo "----------------------------------"
echo -e "Server: ${BLUE}nagare.local${NC}"
echo -e "Location: ${BLUE}$(hostname -I | awk '{print $1}')${NC}"
echo ""

echo "🌐 Access URLs (HTTPS with local CA)"
echo "----------------------------------"
echo -e "API:   ${BLUE}https://api.nagare.local${NC}"
echo -e "Admin: ${BLUE}https://admin.nagare.local${NC}"
echo ""

echo "🔐 SSL Certificate Setup"
echo "----------------------------------"
echo "1. Install CA certificate on client devices:"
echo "   File: ${BLUE}ssl/certs/ca.crt${NC}"
echo ""
echo "2. iOS/iPad:"
echo "   - Transfer ca.crt to device (email/AirDrop)"
echo "   - Open file → Install profile"
echo "   - Settings → General → About → Certificate Trust"
echo "   - Enable 'Nagare Edge CA'"
echo ""
echo "3. macOS:"
echo "   sudo security add-trusted-cert -d -r trustRoot \\"
echo "     -k /Library/Keychains/System.keychain ssl/certs/ca.crt"
echo ""

echo "🤖 AI Services"
echo "----------------------------------"
echo -e "Ollama:  ${BLUE}http://localhost:${OLLAMA_PORT}${NC}"
echo -e "Whisper: ${BLUE}http://localhost:${WHISPER_PORT}${NC}"
echo ""

echo "📁 Docker Services"
echo "----------------------------------"
docker compose -f docker-compose.nagare.yml ps
echo ""

echo "📝 Next Steps"
echo "----------------------------------"
echo "1. ${BLUE}Install ca.crt on all client devices${NC}"
echo "2. ${BLUE}Test from iPad:${NC} https://api.nagare.local/health"
echo "3. ${BLUE}View logs:${NC} docker compose -f docker-compose.nagare.yml logs -f"
echo "4. ${BLUE}Stop services:${NC} docker compose -f docker-compose.nagare.yml down"
echo ""

echo "🔍 Troubleshooting"
echo "----------------------------------"
echo "View logs: docker compose -f docker-compose.nagare.yml logs -f backend"
echo "Restart:   docker compose -f docker-compose.nagare.yml restart"
echo "Stop all:  docker compose -f docker-compose.nagare.yml down"
echo ""
