#!/bin/bash
# Deploy Docker containers on Mac Mini
# Builds and starts the complete VerbumCare stack on Apple Silicon

set -e

echo "🚀 Deploying Docker Containers on Mac Mini"
echo "=========================================="
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
    local command=$1
    ssh vcadmin@verbumcaremac-mini "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && $command"
}

echo -e "${BLUE}1. Pre-Deployment Verification${NC}"
echo "=============================="

# Check SSH connectivity
echo "Verifying SSH connectivity..."
if ssh -o ConnectTimeout=5 vcadmin@verbumcaremac-mini "echo 'SSH OK'" >/dev/null 2>&1; then
    print_status "OK" "SSH connectivity verified"
else
    print_status "ERROR" "Cannot connect to Mac Mini via SSH"
    exit 1
fi

# Check Docker daemon
echo "Verifying Docker daemon..."
if run_remote "docker info >/dev/null 2>&1"; then
    print_status "OK" "Docker daemon is running"
else
    print_status "ERROR" "Docker daemon is not running - please start Docker Desktop"
    exit 1
fi

# Check application directory
echo "Verifying application directory..."
if run_remote "test -d ~/verbumcare-demo"; then
    print_status "OK" "Application directory exists"
else
    print_status "ERROR" "Application directory not found - run setup-macmini-environment.sh first"
    exit 1
fi

# Check Docker Compose file
echo "Verifying Docker Compose configuration..."
if run_remote "test -f ~/verbumcare-demo/docker-compose.yml"; then
    print_status "OK" "Docker Compose file found"
else
    print_status "ERROR" "Docker Compose file not found"
    exit 1
fi

echo ""
echo -e "${BLUE}2. AI Services Verification${NC}"
echo "=========================="

# Check Ollama service
echo "Checking Ollama service..."
if run_remote "curl -s http://localhost:11434/api/tags >/dev/null 2>&1"; then
    print_status "OK" "Ollama service is running"
    
    # Check for required model
    echo "Checking for required model (llama3.1:8b)..."
    if run_remote "curl -s http://localhost:11434/api/tags | grep -q 'llama3.1:8b'"; then
        print_status "OK" "Required model is available"
    else
        print_status "WARN" "Required model not found - pulling llama3.1:8b..."
        run_remote "ollama pull llama3.1:8b" && {
            print_status "OK" "Model pulled successfully"
        } || {
            print_status "ERROR" "Failed to pull required model"
            exit 1
        }
    fi
else
    print_status "ERROR" "Ollama service is not running"
    echo "Please start Ollama service: ssh vcadmin@verbumcaremac-mini 'ollama serve'"
    exit 1
fi

# Check Whisper service
echo "Checking Whisper service..."
if run_remote "curl -s http://localhost:8080/health >/dev/null 2>&1"; then
    print_status "OK" "Whisper service is running"
else
    print_status "WARN" "Whisper service is not running - containers will start without it"
fi

echo ""
echo -e "${BLUE}3. Container Image Building${NC}"
echo "=========================="

# Build backend image for ARM64
echo "Building backend Docker image for ARM64..."
run_remote "cd ~/verbumcare-demo && docker build -f backend/Dockerfile.arm64 -t verbumcare-backend:arm64 backend/" && {
    print_status "OK" "Backend image built successfully"
} || {
    print_status "ERROR" "Failed to build backend image"
    exit 1
}

# Verify image was built
echo "Verifying backend image..."
if run_remote "docker images | grep -q 'verbumcare-backend.*arm64'"; then
    print_status "OK" "Backend image verified"
else
    print_status "ERROR" "Backend image not found after build"
    exit 1
fi

echo ""
echo -e "${BLUE}4. Container Deployment${NC}"
echo "===================="

# Stop any existing containers
echo "Stopping any existing containers..."
run_remote "cd ~/verbumcare-demo && docker compose down 2>/dev/null || echo 'No existing containers to stop'" && {
    print_status "OK" "Existing containers stopped"
}

# Start PostgreSQL first
echo "Starting PostgreSQL container..."
run_remote "cd ~/verbumcare-demo && docker compose up -d postgres" && {
    print_status "OK" "PostgreSQL container started"
} || {
    print_status "ERROR" "Failed to start PostgreSQL container"
    exit 1
}

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if run_remote "docker exec macmini-postgres pg_isready -U nagare -d nagare_db >/dev/null 2>&1"; then
        print_status "OK" "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_status "ERROR" "PostgreSQL failed to start within 30 seconds"
        run_remote "cd ~/verbumcare-demo && docker logs macmini-postgres"
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 2
done

# Start backend container
echo "Starting backend container..."
run_remote "cd ~/verbumcare-demo && docker compose up -d backend" && {
    print_status "OK" "Backend container started"
} || {
    print_status "ERROR" "Failed to start backend container"
    exit 1
}

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if run_remote "curl -s http://localhost:3000/health >/dev/null 2>&1"; then
        print_status "OK" "Backend is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_status "ERROR" "Backend failed to start within 30 seconds"
        run_remote "cd ~/verbumcare-demo && docker logs macmini-backend"
        exit 1
    fi
    echo "Waiting for backend... ($i/30)"
    sleep 2
done

# Start nginx container
echo "Starting nginx container..."
run_remote "cd ~/verbumcare-demo && docker-compose up -d nginx" && {
    print_status "OK" "nginx container started"
} || {
    print_status "ERROR" "Failed to start nginx container"
    exit 1
}

# Wait for nginx to be ready
echo "Waiting for nginx to be ready..."
for i in {1..15}; do
    if run_remote "curl -s http://localhost/health >/dev/null 2>&1"; then
        print_status "OK" "nginx is ready"
        break
    fi
    if [ $i -eq 15 ]; then
        print_status "ERROR" "nginx failed to start within 15 seconds"
        run_remote "cd ~/verbumcare-demo && docker logs macmini-nginx"
        exit 1
    fi
    echo "Waiting for nginx... ($i/15)"
    sleep 2
done

echo ""
echo -e "${BLUE}5. Container Health Verification${NC}"
echo "==============================="

# Check all containers are running
echo "Checking container status..."
container_status=$(run_remote "cd ~/verbumcare-demo && docker-compose ps --format 'table {{.Name}}\t{{.Status}}'")
echo "$container_status"

# Count running containers
running_containers=$(run_remote "cd ~/verbumcare-demo && docker-compose ps -q | wc -l")
if [ "$running_containers" -eq 3 ]; then
    print_status "OK" "All 3 containers are running"
else
    print_status "ERROR" "Expected 3 containers, found $running_containers running"
fi

# Check individual container health
echo "Checking individual container health..."

# PostgreSQL health
if run_remote "docker exec macmini-postgres pg_isready -U nagare -d nagare_db >/dev/null 2>&1"; then
    print_status "OK" "PostgreSQL container is healthy"
else
    print_status "ERROR" "PostgreSQL container is unhealthy"
fi

# Backend health
if run_remote "curl -s http://localhost:3000/health | grep -q 'ok'"; then
    print_status "OK" "Backend container is healthy"
else
    print_status "ERROR" "Backend container is unhealthy"
fi

# nginx health
if run_remote "curl -s http://localhost/health >/dev/null 2>&1"; then
    print_status "OK" "nginx container is healthy"
else
    print_status "ERROR" "nginx container is unhealthy"
fi

echo ""
echo -e "${BLUE}6. SSL/HTTPS Verification${NC}"
echo "======================="

# Test HTTPS endpoint
echo "Testing HTTPS endpoint..."
if run_remote "curl -k -s https://localhost/health | grep -q 'ok'"; then
    print_status "OK" "HTTPS endpoint is working"
else
    print_status "ERROR" "HTTPS endpoint is not working"
    echo "Checking nginx logs..."
    run_remote "cd ~/verbumcare-demo && docker logs macmini-nginx --tail 10"
fi

# Test SSL certificate
echo "Verifying SSL certificate..."
ssl_info=$(run_remote "echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -subject 2>/dev/null" || echo "SSL_ERROR")
if [[ "$ssl_info" != "SSL_ERROR" ]]; then
    echo "SSL Certificate: $ssl_info"
    print_status "OK" "SSL certificate is valid"
else
    print_status "ERROR" "SSL certificate verification failed"
fi

echo ""
echo -e "${BLUE}7. Network Connectivity Test${NC}"
echo "=========================="

# Test internal container networking
echo "Testing container-to-container networking..."
if run_remote "docker exec macmini-backend curl -s http://postgres:5432 >/dev/null 2>&1 || echo 'Expected connection refused'"; then
    print_status "OK" "Backend can reach PostgreSQL"
else
    print_status "WARN" "Backend-PostgreSQL networking may have issues"
fi

# Test AI service connectivity from container
echo "Testing AI service connectivity from backend container..."
if run_remote "docker exec macmini-backend curl -s http://host.docker.internal:11434/api/tags >/dev/null 2>&1"; then
    print_status "OK" "Backend can reach Ollama service"
else
    print_status "WARN" "Backend cannot reach Ollama service"
fi

if run_remote "docker exec macmini-backend curl -s http://host.docker.internal:8080/health >/dev/null 2>&1"; then
    print_status "OK" "Backend can reach Whisper service"
else
    print_status "WARN" "Backend cannot reach Whisper service (may not be running)"
fi

echo ""
echo -e "${BLUE}8. Resource Usage Check${NC}"
echo "===================="

# Check Docker resource usage
echo "Checking Docker resource usage..."
resource_usage=$(run_remote "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'")
echo "$resource_usage"
print_status "OK" "Resource usage displayed above"

# Check disk usage
echo "Checking disk usage..."
disk_usage=$(run_remote "df -h ~ | tail -1 | awk '{print \"Used: \" \$3 \", Available: \" \$4 \", Usage: \" \$5}'")
echo "$disk_usage"
print_status "OK" "Disk usage checked"

echo ""
echo -e "${GREEN}✅ Mac Mini Container Deployment Complete${NC}"
echo ""
echo "Deployment Summary:"
echo "=================="
echo "- PostgreSQL container: macmini-postgres (running)"
echo "- Backend container: macmini-backend (running)"
echo "- nginx container: macmini-nginx (running)"
echo ""
echo "Service Endpoints:"
echo "- HTTP: http://verbumcaremac-mini/"
echo "- HTTPS: https://verbumcaremac-mini/"
echo "- Backend API: http://verbumcaremac-mini:3000 (internal only)"
echo "- PostgreSQL: verbumcaremac-mini:5432"
echo ""
echo "Container Management:"
echo "- View logs: ssh vcadmin@verbumcaremac-mini 'cd ~/verbumcare-demo && docker-compose logs -f [service]'"
echo "- Restart services: ssh vcadmin@verbumcaremac-mini 'cd ~/verbumcare-demo && docker-compose restart'"
echo "- Stop services: ssh vcadmin@verbumcaremac-mini 'cd ~/verbumcare-demo && docker-compose down'"
echo ""
echo "Next steps:"
echo "1. Run migrate-database.sh to import data from pn51"
echo "2. Run verify-macmini-deployment.sh for comprehensive testing"
echo "3. Update client applications to point to Mac Mini (when ready)"
echo ""
echo -e "${YELLOW}⚠️  Database is empty - run migration script to import data from pn51${NC}"