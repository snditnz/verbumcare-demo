#!/bin/bash
# Pre-Migration Checklist for Mac Mini Docker Stack Migration
# This script verifies readiness for migrating from pn51 to Mac Mini

set -e

echo "🔍 Pre-Migration Checklist for Mac Mini Docker Stack Migration"
echo "=============================================================="
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

# Function to run remote command and capture output
run_remote() {
    local host=$1
    local command=$2
    ssh -o ConnectTimeout=10 "$host" "$command" 2>/dev/null || echo "CONNECTION_FAILED"
}

echo -e "${BLUE}1. Checking Mac Mini Resources and Readiness...${NC}"
echo "================================================"

# Check Mac Mini connectivity
echo "Checking Mac Mini connectivity..."
if ping -c 1 verbumcaremac-mini >/dev/null 2>&1; then
    print_status "OK" "Mac Mini (verbumcaremac-mini) is reachable"
else
    print_status "ERROR" "Mac Mini (verbumcaremac-mini) is not reachable"
    exit 1
fi

# Check Mac Mini SSH access
echo "Checking Mac Mini SSH access..."
if ssh -o ConnectTimeout=5 vcadmin@verbumcaremac-mini "echo 'SSH OK'" >/dev/null 2>&1; then
    print_status "OK" "SSH access to Mac Mini working"
else
    print_status "ERROR" "Cannot SSH to Mac Mini (vcadmin@verbumcaremac-mini)"
    exit 1
fi

# Check Mac Mini system specs
echo "Checking Mac Mini system specifications..."
mac_specs=$(run_remote "vcadmin@verbumcaremac-mini" "system_profiler SPHardwareDataType | grep -E '(Model Name|Chip|Memory)' | head -3")
if [ "$mac_specs" != "CONNECTION_FAILED" ]; then
    echo "$mac_specs"
    print_status "OK" "Mac Mini system specs retrieved"
else
    print_status "ERROR" "Could not retrieve Mac Mini system specs"
fi

# Check Mac Mini disk space
echo "Checking Mac Mini disk space..."
mac_disk=$(run_remote "vcadmin@verbumcaremac-mini" "df -h / | tail -1 | awk '{print \$4\" available out of \"\$2\" total\"}'")
if [ "$mac_disk" != "CONNECTION_FAILED" ]; then
    echo "Disk space: $mac_disk"
    print_status "OK" "Mac Mini disk space checked"
else
    print_status "WARN" "Could not check Mac Mini disk space"
fi

# Check Docker installation on Mac Mini
echo "Checking Docker installation on Mac Mini..."
mac_docker=$(run_remote "vcadmin@verbumcaremac-mini" "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && docker --version" 2>/dev/null || echo "NOT_INSTALLED")
if [[ "$mac_docker" == *"Docker version"* ]]; then
    echo "Docker version: $mac_docker"
    print_status "OK" "Docker is installed on Mac Mini"
else
    print_status "ERROR" "Docker is not installed on Mac Mini"
    echo "Please install Docker Desktop for Mac (Apple Silicon) before proceeding"
    exit 1
fi

# Check Docker daemon status on Mac Mini
echo "Checking Docker daemon status on Mac Mini..."
mac_docker_status=$(run_remote "vcadmin@verbumcaremac-mini" "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && docker info >/dev/null 2>&1 && echo 'RUNNING' || echo 'NOT_RUNNING'")
if [ "$mac_docker_status" = "RUNNING" ]; then
    print_status "OK" "Docker daemon is running on Mac Mini"
else
    print_status "ERROR" "Docker daemon is not running on Mac Mini"
    echo "Please start Docker Desktop on Mac Mini before proceeding"
    exit 1
fi

# Check existing AI services on Mac Mini
echo "Checking existing AI services on Mac Mini..."
ollama_status=$(run_remote "vcadmin@verbumcaremac-mini" "curl -s http://localhost:11434/api/tags >/dev/null 2>&1 && echo 'RUNNING' || echo 'NOT_RUNNING'")
if [ "$ollama_status" = "RUNNING" ]; then
    print_status "OK" "Ollama service is running on Mac Mini"
else
    print_status "WARN" "Ollama service is not running on Mac Mini (will be started during migration)"
fi

whisper_status=$(run_remote "vcadmin@verbumcaremac-mini" "curl -s http://localhost:8080/health >/dev/null 2>&1 && echo 'RUNNING' || echo 'NOT_RUNNING'")
if [ "$whisper_status" = "RUNNING" ]; then
    print_status "OK" "Whisper service is running on Mac Mini"
else
    print_status "WARN" "Whisper service is not running on Mac Mini (will be started during migration)"
fi

echo ""
echo -e "${BLUE}2. Checking pn51 Current State...${NC}"
echo "================================="

# Check pn51 connectivity
echo "Checking pn51 connectivity..."
if ping -c 1 verbumcare-lab.local >/dev/null 2>&1; then
    print_status "OK" "pn51 (verbumcare-lab.local) is reachable"
else
    print_status "ERROR" "pn51 (verbumcare-lab.local) is not reachable"
    exit 1
fi

# Check pn51 Docker containers
echo "Checking pn51 Docker containers..."
pn51_containers=$(run_remote "verbumcare-lab.local" "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E '(nagare-|verbumcare)'")
if [ "$pn51_containers" != "CONNECTION_FAILED" ]; then
    echo "$pn51_containers"
    print_status "OK" "pn51 Docker containers are running"
else
    print_status "ERROR" "Could not check pn51 Docker containers"
fi

# Check database size and health
echo "Checking pn51 database..."
db_size=$(run_remote "verbumcare-lab.local" "docker exec nagare-postgres psql -U nagare -d nagare_db -t -c \"SELECT pg_size_pretty(pg_database_size('nagare_db'));\" 2>/dev/null | xargs")
if [ "$db_size" != "CONNECTION_FAILED" ] && [ -n "$db_size" ]; then
    echo "Database size: $db_size"
    print_status "OK" "pn51 database is accessible and sized at $db_size"
else
    print_status "ERROR" "Could not check pn51 database size"
fi

# Check SSL certificates
echo "Checking pn51 SSL certificates..."
ssl_certs=$(run_remote "verbumcare-lab.local" "ls -la /opt/verbumcare/ssl/certs/nginx.* 2>/dev/null | wc -l")
if [ "$ssl_certs" -ge 2 ]; then
    print_status "OK" "SSL certificates found in /opt/verbumcare/ssl/certs/"
else
    print_status "WARN" "SSL certificates may not be in expected location"
fi

# Check application files
echo "Checking pn51 application files..."
app_files=$(run_remote "verbumcare-lab.local" "ls -la /home/q/verbumcare-demo/ 2>/dev/null | wc -l")
if [ "$app_files" -gt 5 ]; then
    print_status "OK" "Application files found in /home/q/verbumcare-demo/"
else
    print_status "ERROR" "Application files not found in expected location"
fi

echo ""
echo -e "${BLUE}3. Architecture Compatibility Check...${NC}"
echo "====================================="

# Check current architecture
echo "Checking current pn51 architecture..."
pn51_arch=$(run_remote "verbumcare-lab.local" "uname -m")
echo "pn51 architecture: $pn51_arch"

echo "Checking Mac Mini architecture..."
mac_arch=$(run_remote "vcadmin@verbumcaremac-mini" "uname -m")
echo "Mac Mini architecture: $mac_arch"

if [ "$pn51_arch" != "$mac_arch" ]; then
    print_status "WARN" "Architecture change detected: $pn51_arch → $mac_arch (ARM64 containers will be used)"
else
    print_status "OK" "Same architecture - no container rebuilding needed"
fi

# Check Docker platform support
echo "Checking Docker multi-platform support on Mac Mini..."
mac_platforms=$(run_remote "vcadmin@verbumcaremac-mini" "docker buildx ls | grep -o 'linux/arm64' | head -1")
if [ "$mac_platforms" = "linux/arm64" ]; then
    print_status "OK" "Docker supports ARM64 platform on Mac Mini"
else
    print_status "WARN" "Docker multi-platform support may need configuration"
fi

echo ""
echo -e "${BLUE}4. Migration Readiness Summary...${NC}"
echo "================================"

# Calculate estimated migration time
echo "Estimating migration requirements..."
if [ "$db_size" != "CONNECTION_FAILED" ]; then
    # Extract numeric value from size (e.g., "150 MB" -> 150)
    size_num=$(echo "$db_size" | grep -o '[0-9]*' | head -1)
    if [ -n "$size_num" ] && [ "$size_num" -gt 0 ]; then
        if [[ "$db_size" == *"GB"* ]]; then
            estimated_time="4-6 hours"
        elif [[ "$db_size" == *"MB"* ]] && [ "$size_num" -gt 500 ]; then
            estimated_time="2-3 hours"
        else
            estimated_time="1-2 hours"
        fi
        echo "Estimated migration time: $estimated_time (based on database size: $db_size)"
    fi
fi

echo ""
echo -e "${GREEN}✅ Pre-Migration Checklist Complete${NC}"
echo ""
echo "Next steps:"
echo "1. Review any warnings or errors above"
echo "2. Ensure Docker Desktop is running on Mac Mini"
echo "3. Run backup-pn51.sh to create comprehensive backups"
echo "4. Execute setup-macmini-environment.sh to prepare Mac Mini"
echo ""
echo "Migration files ready:"
echo "- docker-compose.macmini.yml (ARM64 compatible)"
echo "- backend/Dockerfile.arm64 (ARM64 backend image)"
echo "- nginx/verbumcare-macmini.conf (Mac Mini nginx config)"
echo ""
echo -e "${YELLOW}⚠️  Remember: This migration is for environment setup only${NC}"
echo -e "${YELLOW}   App retargeting will be a separate phase after validation${NC}"