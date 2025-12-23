#!/bin/bash
# Comprehensive verification script for Mac Mini deployment
# Tests all aspects of the migrated VerbumCare stack

# set -e  # Commented out to continue on errors

echo "🔍 Comprehensive Mac Mini Deployment Verification"
echo "================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters for test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Function to print status and update counters
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
        ((TESTS_PASSED++))
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
        ((TESTS_WARNING++))
    else
        echo -e "${RED}❌ $message${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to run remote command
run_remote() {
    local command=$1
    ssh vcadmin@verbumcaremac-mini "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && $command"
}

# Function to test HTTP endpoint
test_endpoint() {
    local url=$1
    local description=$2
    local expected_pattern=$3
    
    echo "Testing: $description"
    response=$(run_remote "curl -s -w '%{http_code}' '$url'" 2>/dev/null || echo "CONNECTION_FAILED")
    
    if [[ "$response" == *"CONNECTION_FAILED"* ]]; then
        print_status "ERROR" "$description - Connection failed"
        return 1
    fi
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        if [ -n "$expected_pattern" ] && [[ "$body" == *"$expected_pattern"* ]]; then
            print_status "OK" "$description - HTTP $http_code with expected content"
        elif [ -z "$expected_pattern" ]; then
            print_status "OK" "$description - HTTP $http_code"
        else
            print_status "WARN" "$description - HTTP $http_code but unexpected content"
        fi
    else
        print_status "ERROR" "$description - HTTP $http_code"
        return 1
    fi
}

# Function to test HTTPS endpoint
test_https_endpoint() {
    local url=$1
    local description=$2
    local expected_pattern=$3
    
    echo "Testing: $description"
    response=$(run_remote "curl -k -s -w '%{http_code}' '$url'" 2>/dev/null || echo "CONNECTION_FAILED")
    
    if [[ "$response" == *"CONNECTION_FAILED"* ]]; then
        print_status "ERROR" "$description - Connection failed"
        return 1
    fi
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        if [ -n "$expected_pattern" ] && [[ "$body" == *"$expected_pattern"* ]]; then
            print_status "OK" "$description - HTTPS $http_code with expected content"
        elif [ -z "$expected_pattern" ]; then
            print_status "OK" "$description - HTTPS $http_code"
        else
            print_status "WARN" "$description - HTTPS $http_code but unexpected content"
        fi
    else
        print_status "ERROR" "$description - HTTPS $http_code"
        return 1
    fi
}

echo -e "${BLUE}1. Infrastructure Verification${NC}"
echo "============================="

# Check SSH connectivity
echo "Checking SSH connectivity..."
if ssh -o ConnectTimeout=5 vcadmin@verbumcaremac-mini "echo 'SSH OK'" >/dev/null 2>&1; then
    print_status "OK" "SSH connectivity to Mac Mini"
else
    print_status "ERROR" "SSH connectivity to Mac Mini"
fi

# Check Docker daemon
echo "Checking Docker daemon..."
if run_remote "docker info >/dev/null 2>&1"; then
    print_status "OK" "Docker daemon is running"
else
    print_status "ERROR" "Docker daemon is not running"
fi

# Check container status
echo "Checking container status..."
container_count=$(run_remote "cd ~/verbumcare-demo && docker-compose ps -q | wc -l")
if [ "$container_count" -eq 3 ]; then
    print_status "OK" "All 3 containers are running"
else
    print_status "ERROR" "Expected 3 containers, found $container_count"
fi

# Check individual containers
containers=("macmini-postgres" "macmini-backend" "macmini-nginx")
for container in "${containers[@]}"; do
    echo "Checking container: $container"
    if run_remote "docker ps | grep -q $container"; then
        print_status "OK" "Container $container is running"
    else
        print_status "ERROR" "Container $container is not running"
    fi
done

echo ""
echo -e "${BLUE}2. Database Verification${NC}"
echo "======================"

# Check PostgreSQL connectivity
echo "Checking PostgreSQL connectivity..."
if run_remote "docker exec macmini-postgres pg_isready -U nagare -d nagare_db >/dev/null 2>&1"; then
    print_status "OK" "PostgreSQL is accepting connections"
else
    print_status "ERROR" "PostgreSQL is not accepting connections"
fi

# Check database size
echo "Checking database size..."
db_size=$(run_remote "docker exec macmini-postgres psql -U nagare -d nagare_db -t -c \"SELECT pg_size_pretty(pg_database_size('nagare_db'));\" | xargs" 2>/dev/null || echo "ERROR")
if [[ "$db_size" != "ERROR" ]] && [[ "$db_size" != *"kB"* ]]; then
    print_status "OK" "Database has substantial data ($db_size)"
else
    print_status "WARN" "Database appears empty or small ($db_size)"
fi

# Check key tables exist and have data
key_tables=("patients" "users" "facilities" "medication_orders" "vital_signs")
echo "Checking key tables..."
for table in "${key_tables[@]}"; do
    row_count=$(run_remote "docker exec macmini-postgres psql -U nagare -d nagare_db -t -c \"SELECT COUNT(*) FROM $table;\" 2>/dev/null | xargs" || echo "ERROR")
    if [[ "$row_count" != "ERROR" ]] && [ "$row_count" -gt 0 ]; then
        print_status "OK" "Table $table has $row_count rows"
    elif [[ "$row_count" != "ERROR" ]] && [ "$row_count" -eq 0 ]; then
        print_status "WARN" "Table $table exists but is empty"
    else
        print_status "ERROR" "Table $table is missing or inaccessible"
    fi
done

echo ""
echo -e "${BLUE}3. Backend API Verification${NC}"
echo "========================="

# Test health endpoint
test_endpoint "http://localhost:3000/health" "Backend health endpoint" "ok"

# Test API endpoints
test_endpoint "http://localhost:3000/api/patients" "Patients API endpoint" "success"
test_endpoint "http://localhost:3000/api/facilities" "Facilities API endpoint" "success"
test_endpoint "http://localhost:3000/api/users" "Users API endpoint" "success"

# Test authentication endpoint
echo "Testing authentication endpoint..."
auth_response=$(run_remote "curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{\"username\": \"demo\", \"password\": \"demo123\"}'" 2>/dev/null || echo "ERROR")
if [[ "$auth_response" == *"success"* ]] && [[ "$auth_response" == *"true"* ]]; then
    print_status "OK" "Authentication endpoint working"
elif [[ "$auth_response" == *"success"* ]] && [[ "$auth_response" == *"false"* ]]; then
    print_status "WARN" "Authentication endpoint working but demo credentials may not exist"
else
    print_status "ERROR" "Authentication endpoint not working"
fi

echo ""
echo -e "${BLUE}4. HTTPS/SSL Verification${NC}"
echo "======================="

# Test HTTPS health endpoint
test_https_endpoint "https://localhost/health" "HTTPS health endpoint" "ok"

# Test HTTPS API endpoints
test_https_endpoint "https://localhost/api/patients" "HTTPS patients API" "success"
test_https_endpoint "https://localhost/api/facilities" "HTTPS facilities API" "success"

# Test SSL certificate
echo "Checking SSL certificate..."
ssl_info=$(run_remote "echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null" || echo "SSL_ERROR")
if [[ "$ssl_info" != "SSL_ERROR" ]]; then
    print_status "OK" "SSL certificate is valid and accessible"
    echo "Certificate info: $ssl_info"
else
    print_status "ERROR" "SSL certificate verification failed"
fi

# Test HTTP to HTTPS redirect
echo "Testing HTTP to HTTPS redirect..."
redirect_response=$(run_remote "curl -s -w '%{http_code}' http://localhost/ | tail -c 3" 2>/dev/null || echo "ERROR")
if [ "$redirect_response" = "301" ] || [ "$redirect_response" = "302" ]; then
    print_status "OK" "HTTP to HTTPS redirect working (HTTP $redirect_response)"
else
    print_status "WARN" "HTTP to HTTPS redirect may not be working (HTTP $redirect_response)"
fi

echo ""
echo -e "${BLUE}5. AI Services Integration${NC}"
echo "========================="

# Test Ollama connectivity from backend
echo "Testing Ollama connectivity from backend container..."
ollama_test=$(run_remote "docker exec macmini-backend curl -s http://host.docker.internal:11434/api/tags 2>/dev/null | head -c 50" || echo "ERROR")
if [[ "$ollama_test" != "ERROR" ]] && [[ "$ollama_test" == *"models"* ]]; then
    print_status "OK" "Backend can reach Ollama service"
else
    print_status "WARN" "Backend cannot reach Ollama service"
fi

# Test Whisper connectivity from backend
echo "Testing Whisper connectivity from backend container..."
whisper_test=$(run_remote "docker exec macmini-backend curl -s http://host.docker.internal:8080/health 2>/dev/null" || echo "ERROR")
if [[ "$whisper_test" != "ERROR" ]] && [[ "$whisper_test" == *"ok"* ]]; then
    print_status "OK" "Backend can reach Whisper service"
else
    print_status "WARN" "Backend cannot reach Whisper service (may not be running)"
fi

# Test AI services directly
echo "Testing Ollama service directly..."
if run_remote "curl -s http://localhost:11434/api/tags >/dev/null 2>&1"; then
    print_status "OK" "Ollama service is running on Mac Mini"
else
    print_status "WARN" "Ollama service is not running on Mac Mini"
fi

echo "Testing Whisper service directly..."
if run_remote "curl -s http://localhost:8080/health >/dev/null 2>&1"; then
    print_status "OK" "Whisper service is running on Mac Mini"
else
    print_status "WARN" "Whisper service is not running on Mac Mini"
fi

echo ""
echo -e "${BLUE}6. Network and Connectivity${NC}"
echo "========================="

# Test container networking
echo "Testing container-to-container networking..."
if run_remote "docker exec macmini-backend ping -c 1 postgres >/dev/null 2>&1"; then
    print_status "OK" "Backend can reach PostgreSQL container"
else
    print_status "ERROR" "Backend cannot reach PostgreSQL container"
fi

# Test external network access from containers
echo "Testing external network access from backend..."
if run_remote "docker exec macmini-backend ping -c 1 8.8.8.8 >/dev/null 2>&1"; then
    print_status "OK" "Backend has external network access"
else
    print_status "WARN" "Backend does not have external network access"
fi

# Test mDNS resolution (if applicable)
echo "Testing hostname resolution..."
if run_remote "ping -c 1 verbumcaremac-mini >/dev/null 2>&1"; then
    print_status "OK" "Mac Mini hostname resolves locally"
else
    print_status "WARN" "Mac Mini hostname may not resolve externally"
fi

echo ""
echo -e "${BLUE}7. Performance and Resource Usage${NC}"
echo "================================"

# Check system resources
echo "Checking system resources..."
memory_usage=$(run_remote "vm_stat | grep 'Pages free' | awk '{print \$3}' | sed 's/\\.//' | awk '{print \$1 * 4096 / 1024 / 1024}'" 2>/dev/null || echo "unknown")
if [[ "$memory_usage" != "unknown" ]] && (( $(echo "$memory_usage > 1000" | bc -l) )); then
    print_status "OK" "Sufficient free memory (${memory_usage}MB available)"
else
    print_status "WARN" "Limited free memory (${memory_usage}MB available)"
fi

# Check disk space
disk_usage=$(run_remote "df -h ~ | tail -1 | awk '{print \$4}'" 2>/dev/null || echo "unknown")
if [[ "$disk_usage" == *"G"* ]]; then
    print_status "OK" "Sufficient disk space ($disk_usage available)"
else
    print_status "WARN" "Limited disk space ($disk_usage available)"
fi

# Check Docker resource usage
echo "Checking Docker container resource usage..."
container_stats=$(run_remote "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | tail -n +2")
if [ -n "$container_stats" ]; then
    print_status "OK" "Container resource usage retrieved"
    echo "$container_stats"
else
    print_status "WARN" "Could not retrieve container resource usage"
fi

echo ""
echo -e "${BLUE}8. Data Integrity Verification${NC}"
echo "=============================="

# Test data retrieval through API
echo "Testing patient data retrieval..."
patient_data=$(run_remote "curl -s https://localhost/api/patients -k | head -c 100" 2>/dev/null || echo "ERROR")
if [[ "$patient_data" == *"success"* ]] && [[ "$patient_data" == *"data"* ]]; then
    print_status "OK" "Patient data retrievable through API"
else
    print_status "ERROR" "Patient data not retrievable through API"
fi

# Test database queries
echo "Testing direct database queries..."
patient_count=$(run_remote "docker exec macmini-postgres psql -U nagare -d nagare_db -t -c \"SELECT COUNT(*) FROM patients;\" 2>/dev/null | xargs" || echo "ERROR")
if [[ "$patient_count" != "ERROR" ]] && [ "$patient_count" -ge 0 ]; then
    print_status "OK" "Database queries working (found $patient_count patients)"
else
    print_status "ERROR" "Database queries not working"
fi

echo ""
echo -e "${BLUE}9. Security Verification${NC}"
echo "======================"

# Check that port 3000 is not externally accessible
echo "Verifying port 3000 is not externally accessible..."
if ! run_remote "curl --connect-timeout 5 http://verbumcaremac-mini:3000/health >/dev/null 2>&1"; then
    print_status "OK" "Port 3000 is properly blocked externally"
else
    print_status "ERROR" "Port 3000 is accessible externally (security risk)"
fi

# Check SSL configuration
echo "Checking SSL security headers..."
ssl_headers=$(run_remote "curl -k -s -I https://localhost/ | grep -i 'strict-transport-security\\|x-frame-options\\|x-content-type-options'" || echo "")
if [ -n "$ssl_headers" ]; then
    print_status "OK" "Security headers are present"
else
    print_status "WARN" "Security headers may be missing"
fi

echo ""
echo -e "${BLUE}10. Rollback Capability Test${NC}"
echo "=========================="

# Verify pn51 is still accessible for rollback
echo "Verifying pn51 rollback capability..."
if ping -c 1 verbumcare-lab.local >/dev/null 2>&1; then
    print_status "OK" "pn51 is still reachable for rollback"
    
    # Check if pn51 services are still running
    if ssh verbumcare-lab.local "docker ps | grep -q nagare" 2>/dev/null; then
        print_status "OK" "pn51 Docker services are still running"
    else
        print_status "WARN" "pn51 Docker services may not be running"
    fi
else
    print_status "WARN" "pn51 is not reachable (rollback may be difficult)"
fi

echo ""
echo -e "${GREEN}🎯 Verification Summary${NC}"
echo "======================"
echo ""
echo "Test Results:"
echo "- ✅ Passed: $TESTS_PASSED"
echo "- ⚠️  Warnings: $TESTS_WARNING"
echo "- ❌ Failed: $TESTS_FAILED"
echo ""

# Calculate overall status
total_tests=$((TESTS_PASSED + TESTS_WARNING + TESTS_FAILED))
pass_rate=$((TESTS_PASSED * 100 / total_tests))

if [ $TESTS_FAILED -eq 0 ] && [ $pass_rate -ge 90 ]; then
    echo -e "${GREEN}🎉 DEPLOYMENT VERIFICATION: EXCELLENT${NC}"
    echo "Mac Mini deployment is fully functional and ready for production use."
elif [ $TESTS_FAILED -eq 0 ] && [ $pass_rate -ge 75 ]; then
    echo -e "${YELLOW}✅ DEPLOYMENT VERIFICATION: GOOD${NC}"
    echo "Mac Mini deployment is functional with minor warnings."
elif [ $TESTS_FAILED -le 2 ] && [ $pass_rate -ge 60 ]; then
    echo -e "${YELLOW}⚠️  DEPLOYMENT VERIFICATION: ACCEPTABLE${NC}"
    echo "Mac Mini deployment has some issues that should be addressed."
else
    echo -e "${RED}❌ DEPLOYMENT VERIFICATION: NEEDS ATTENTION${NC}"
    echo "Mac Mini deployment has significant issues that must be resolved."
fi

echo ""
echo "Mac Mini Service Endpoints:"
echo "- HTTPS API: https://verbumcaremac-mini/"
echo "- Database: verbumcaremac-mini:5432"
echo "- Ollama: verbumcaremac-mini:11434"
echo "- Whisper: verbumcaremac-mini:8080"
echo ""
echo "Management Commands:"
echo "- View logs: ssh vcadmin@verbumcaremac-mini 'cd ~/verbumcare-demo && docker-compose logs -f'"
echo "- Restart services: ssh vcadmin@verbumcaremac-mini 'cd ~/verbumcare-demo && docker-compose restart'"
echo "- Stop services: ssh vcadmin@verbumcaremac-mini 'cd ~/verbumcare-demo && docker-compose down'"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Mac Mini is ready for client application retargeting!${NC}"
else
    echo -e "${YELLOW}⚠️  Resolve failed tests before retargeting client applications${NC}"
fi