#!/bin/bash
# Rollback script for Mac Mini migration
# Safely returns to pn51 as primary server and stops Mac Mini services

set -e

echo "🔄 Rolling Back Mac Mini Migration"
echo "=================================="
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

echo -e "${YELLOW}⚠️  WARNING: This will rollback to pn51 as the primary server${NC}"
echo -e "${YELLOW}   Mac Mini services will be stopped${NC}"
echo -e "${YELLOW}   Any data changes made on Mac Mini since migration will be lost${NC}"
echo ""
read -p "Are you sure you want to proceed with rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled by user"
    exit 0
fi

echo ""
echo -e "${BLUE}1. Stopping Mac Mini Services${NC}"
echo "============================"

# Check if Mac Mini services are running
echo "Checking Mac Mini service status..."
if ssh -o ConnectTimeout=5 vcadmin@verbumcaremac-mini "docker ps | grep -q macmini" 2>/dev/null; then
    print_status "OK" "Mac Mini services are running - will stop them"
    
    # Stop Mac Mini Docker services
    echo "Stopping Mac Mini Docker services..."
    run_remote "vcadmin@verbumcaremac-mini" "cd ~/verbumcare-demo && docker-compose down" && {
        print_status "OK" "Mac Mini Docker services stopped"
    } || {
        print_status "WARN" "Some Mac Mini services may not have stopped cleanly"
    }
    
    # Verify services are stopped
    echo "Verifying Mac Mini services are stopped..."
    if ! run_remote "vcadmin@verbumcaremac-mini" "docker ps | grep -q macmini" 2>/dev/null; then
        print_status "OK" "All Mac Mini Docker services are stopped"
    else
        print_status "WARN" "Some Mac Mini services may still be running"
    fi
    
else
    print_status "OK" "Mac Mini services are already stopped"
fi

echo ""
echo -e "${BLUE}2. Verifying pn51 Status${NC}"
echo "======================="

# Check pn51 connectivity
echo "Checking pn51 connectivity..."
if ping -c 1 verbumcare-lab.local >/dev/null 2>&1; then
    print_status "OK" "pn51 (verbumcare-lab.local) is reachable"
else
    print_status "ERROR" "pn51 (verbumcare-lab.local) is not reachable"
    echo "Cannot proceed with rollback - pn51 is not accessible"
    exit 1
fi

# Check pn51 Docker services
echo "Checking pn51 Docker services..."
pn51_containers=$(run_remote "verbumcare-lab.local" "docker ps --format '{{.Names}}' | grep nagare | wc -l" 2>/dev/null || echo "0")
if [ "$pn51_containers" -ge 2 ]; then
    print_status "OK" "pn51 Docker services are running ($pn51_containers containers)"
else
    print_status "WARN" "pn51 Docker services may not be fully running ($pn51_containers containers)"
    
    echo "Attempting to start pn51 services..."
    run_remote "verbumcare-lab.local" "cd /home/q/verbumcare-demo && docker-compose up -d" && {
        print_status "OK" "pn51 services started"
        
        # Wait for services to be ready
        echo "Waiting for pn51 services to be ready..."
        sleep 10
        
    } || {
        print_status "ERROR" "Failed to start pn51 services"
        exit 1
    }
fi

echo ""
echo -e "${BLUE}3. Testing pn51 Functionality${NC}"
echo "=========================="

# Test pn51 database
echo "Testing pn51 database connectivity..."
if run_remote "verbumcare-lab.local" "docker exec nagare-postgres pg_isready -U nagare -d nagare_db >/dev/null 2>&1"; then
    print_status "OK" "pn51 database is accessible"
else
    print_status "ERROR" "pn51 database is not accessible"
    exit 1
fi

# Test pn51 backend
echo "Testing pn51 backend..."
for i in {1..30}; do
    if run_remote "verbumcare-lab.local" "curl -s http://localhost:3000/health | grep -q 'ok'" 2>/dev/null; then
        print_status "OK" "pn51 backend is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        print_status "ERROR" "pn51 backend is not responding after 30 seconds"
        exit 1
    fi
    echo "Waiting for pn51 backend... ($i/30)"
    sleep 2
done

# Test pn51 HTTPS
echo "Testing pn51 HTTPS endpoint..."
if run_remote "verbumcare-lab.local" "curl -k -s https://localhost/health | grep -q 'ok'" 2>/dev/null; then
    print_status "OK" "pn51 HTTPS endpoint is working"
else
    print_status "ERROR" "pn51 HTTPS endpoint is not working"
    exit 1
fi

# Test pn51 API endpoints
echo "Testing pn51 API endpoints..."
if run_remote "verbumcare-lab.local" "curl -k -s https://localhost/api/patients | grep -q 'success'" 2>/dev/null; then
    print_status "OK" "pn51 API endpoints are working"
else
    print_status "ERROR" "pn51 API endpoints are not working"
    exit 1
fi

echo ""
echo -e "${BLUE}4. Testing pn51 AI Services${NC}"
echo "========================="

# Test Ollama on pn51
echo "Testing pn51 Ollama service..."
if run_remote "verbumcare-lab.local" "curl -s http://localhost:11434/api/tags >/dev/null 2>&1"; then
    print_status "OK" "pn51 Ollama service is working"
else
    print_status "WARN" "pn51 Ollama service is not responding"
fi

# Test Whisper on pn51
echo "Testing pn51 Whisper service..."
if run_remote "verbumcare-lab.local" "curl -s http://localhost:8080/health >/dev/null 2>&1"; then
    print_status "OK" "pn51 Whisper service is working"
else
    print_status "WARN" "pn51 Whisper service is not responding"
fi

echo ""
echo -e "${BLUE}5. Cleanup Mac Mini Environment${NC}"
echo "=============================="

# Remove Docker volumes on Mac Mini (optional)
echo "Checking Mac Mini Docker volumes..."
mac_volumes=$(run_remote "vcadmin@verbumcaremac-mini" "docker volume ls -q | grep -E '(postgres|verbumcare)' | wc -l" 2>/dev/null || echo "0")
if [ "$mac_volumes" -gt 0 ]; then
    echo "Found $mac_volumes Docker volumes on Mac Mini"
    read -p "Do you want to remove Mac Mini Docker volumes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing Mac Mini Docker volumes..."
        run_remote "vcadmin@verbumcaremac-mini" "cd ~/verbumcare-demo && docker-compose down -v" && {
            print_status "OK" "Mac Mini Docker volumes removed"
        } || {
            print_status "WARN" "Some Mac Mini Docker volumes may not have been removed"
        }
    else
        print_status "OK" "Mac Mini Docker volumes preserved"
    fi
else
    print_status "OK" "No Mac Mini Docker volumes to clean up"
fi

# Archive Mac Mini application directory (optional)
echo "Checking Mac Mini application directory..."
if run_remote "vcadmin@verbumcaremac-mini" "test -d ~/verbumcare-demo"; then
    read -p "Do you want to archive the Mac Mini application directory? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        timestamp=$(date +%Y%m%d_%H%M%S)
        echo "Archiving Mac Mini application directory..."
        run_remote "vcadmin@verbumcaremac-mini" "tar -czf ~/verbumcare-demo-rollback-$timestamp.tar.gz -C ~ verbumcare-demo && rm -rf ~/verbumcare-demo" && {
            print_status "OK" "Mac Mini application directory archived as ~/verbumcare-demo-rollback-$timestamp.tar.gz"
        } || {
            print_status "WARN" "Failed to archive Mac Mini application directory"
        }
    else
        print_status "OK" "Mac Mini application directory preserved"
    fi
fi

echo ""
echo -e "${BLUE}6. Final Verification${NC}"
echo "=================="

# Final test of pn51 functionality
echo "Performing final pn51 functionality test..."

# Test database
db_test=$(run_remote "verbumcare-lab.local" "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c \"SELECT COUNT(*) FROM patients;\" 2>/dev/null | xargs" || echo "ERROR")
if [[ "$db_test" != "ERROR" ]] && [ "$db_test" -ge 0 ]; then
    print_status "OK" "pn51 database is fully functional (found $db_test patients)"
else
    print_status "ERROR" "pn51 database functionality test failed"
fi

# Test API
api_test=$(run_remote "verbumcare-lab.local" "curl -k -s https://localhost/api/facilities | head -c 50" 2>/dev/null || echo "ERROR")
if [[ "$api_test" == *"success"* ]]; then
    print_status "OK" "pn51 API is fully functional"
else
    print_status "ERROR" "pn51 API functionality test failed"
fi

# Test authentication
auth_test=$(run_remote "verbumcare-lab.local" "curl -k -s -X POST https://localhost/api/auth/login -H 'Content-Type: application/json' -d '{\"username\": \"demo\", \"password\": \"demo123\"}'" 2>/dev/null || echo "ERROR")
if [[ "$auth_test" == *"success"* ]]; then
    print_status "OK" "pn51 authentication is working"
else
    print_status "WARN" "pn51 authentication test inconclusive"
fi

echo ""
echo -e "${GREEN}✅ Rollback Complete${NC}"
echo ""
echo "Rollback Summary:"
echo "================"
echo "- Mac Mini services: ⏹️  Stopped"
echo "- Mac Mini Docker containers: ⏹️  Stopped"
echo "- pn51 services: ✅ Running and verified"
echo "- pn51 database: ✅ Accessible and functional"
echo "- pn51 API endpoints: ✅ Working"
echo "- pn51 HTTPS: ✅ Working"
echo ""
echo "Active Service Endpoints (pn51):"
echo "- HTTPS API: https://verbumcare-lab.local/"
echo "- Database: verbumcare-lab.local:5432"
echo "- Ollama: verbumcare-lab.local:11434"
echo "- Whisper: verbumcare-lab.local:8080"
echo ""
echo "Client Configuration:"
echo "- iPad App: Should use https://verbumcare-lab.local/api"
echo "- Admin Portal: Should use https://verbumcare-lab.local/api"
echo ""
echo "pn51 Management Commands:"
echo "- View logs: ssh verbumcare-lab.local 'cd /home/q/verbumcare-demo && docker-compose logs -f'"
echo "- Restart services: ssh verbumcare-lab.local 'cd /home/q/verbumcare-demo && docker-compose restart'"
echo "- Stop services: ssh verbumcare-lab.local 'cd /home/q/verbumcare-demo && docker-compose down'"
echo ""
echo -e "${GREEN}🎯 pn51 is now the active primary server${NC}"
echo ""
echo "Notes:"
echo "- Mac Mini can be used again for migration by running the migration scripts"
echo "- Any data changes made on Mac Mini since migration have been lost"
echo "- AI services on Mac Mini are still available for development/testing"