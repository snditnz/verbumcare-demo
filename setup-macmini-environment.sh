#!/bin/bash
# Setup Mac Mini environment for Docker stack migration
# Prepares Mac Mini with necessary directories, configurations, and dependencies

set -e

echo "🚀 Setting up Mac Mini Environment for Docker Migration"
echo "======================================================"
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

echo -e "${BLUE}1. Verifying Mac Mini Prerequisites${NC}"
echo "=================================="

# Check SSH connectivity
echo "Checking SSH connectivity to Mac Mini..."
if ssh -o ConnectTimeout=5 vcadmin@verbumcaremac-mini "echo 'SSH OK'" >/dev/null 2>&1; then
    print_status "OK" "SSH connectivity verified"
else
    print_status "ERROR" "Cannot connect to Mac Mini via SSH"
    exit 1
fi

# Check Docker installation
echo "Verifying Docker installation..."
docker_version=$(run_remote "docker --version" 2>/dev/null || echo "NOT_INSTALLED")
if [[ "$docker_version" == *"Docker version"* ]]; then
    echo "Docker version: $docker_version"
    print_status "OK" "Docker is installed"
else
    print_status "ERROR" "Docker is not installed on Mac Mini"
    echo "Please install Docker Desktop for Mac (Apple Silicon) first"
    exit 1
fi

# Check Docker daemon
echo "Verifying Docker daemon is running..."
if run_remote "docker info >/dev/null 2>&1"; then
    print_status "OK" "Docker daemon is running"
else
    print_status "ERROR" "Docker daemon is not running"
    echo "Please start Docker Desktop on Mac Mini"
    exit 1
fi

echo ""
echo -e "${BLUE}2. Creating Directory Structure${NC}"
echo "==============================="

# Create main application directory
echo "Creating main application directory..."
run_remote "mkdir -p ~/verbumcare-demo" && {
    print_status "OK" "Main directory created: ~/verbumcare-demo"
} || {
    print_status "ERROR" "Failed to create main directory"
    exit 1
}

# Create subdirectories
echo "Creating subdirectories..."
run_remote "mkdir -p ~/verbumcare-demo/{backend,nginx,ssl,uploads}" && {
    print_status "OK" "Subdirectories created"
} || {
    print_status "ERROR" "Failed to create subdirectories"
    exit 1
}

# Create SSL certificate directories
echo "Creating SSL certificate directories..."
run_remote "mkdir -p ~/verbumcare-demo/ssl/{certs,private}" && {
    print_status "OK" "SSL directories created"
} || {
    print_status "ERROR" "Failed to create SSL directories"
    exit 1
}

# Set proper permissions
echo "Setting directory permissions..."
run_remote "chmod 755 ~/verbumcare-demo && chmod 700 ~/verbumcare-demo/ssl/private" && {
    print_status "OK" "Directory permissions set"
} || {
    print_status "WARN" "Failed to set some directory permissions"
}

echo ""
echo -e "${BLUE}3. Copying Application Files${NC}"
echo "============================"

# Copy Docker Compose file for Mac Mini
echo "Copying Mac Mini Docker Compose configuration..."
scp docker-compose.macmini.yml vcadmin@verbumcaremac-mini:~/verbumcare-demo/docker-compose.yml && {
    print_status "OK" "Docker Compose file copied"
} || {
    print_status "ERROR" "Failed to copy Docker Compose file"
    exit 1
}

# Copy backend directory
echo "Copying backend application files..."
scp -r backend/ vcadmin@verbumcaremac-mini:~/verbumcare-demo/ && {
    print_status "OK" "Backend files copied"
} || {
    print_status "ERROR" "Failed to copy backend files"
    exit 1
}

# Copy nginx configuration
echo "Copying nginx configuration..."
scp -r nginx/ vcadmin@verbumcaremac-mini:~/verbumcare-demo/ && {
    print_status "OK" "nginx configuration copied"
} || {
    print_status "ERROR" "Failed to copy nginx configuration"
    exit 1
}

echo ""
echo -e "${BLUE}4. SSL Certificate Migration${NC}"
echo "============================"

# Check if we have a recent backup with SSL certificates
latest_backup=$(ls -t pn51_backup_*/ssl_primary_backup_*.tar.gz 2>/dev/null | head -1 || echo "")

if [ -n "$latest_backup" ]; then
    echo "Found SSL backup: $latest_backup"
    echo "Extracting and copying SSL certificates..."
    
    # Extract SSL certificates locally
    temp_ssl_dir=$(mktemp -d)
    tar -xzf "$latest_backup" -C "$temp_ssl_dir" && {
        print_status "OK" "SSL certificates extracted locally"
    } || {
        print_status "ERROR" "Failed to extract SSL certificates"
        exit 1
    }
    
    # Copy SSL certificates to Mac Mini
    scp -r "$temp_ssl_dir/ssl/"* vcadmin@verbumcaremac-mini:~/verbumcare-demo/ssl/ && {
        print_status "OK" "SSL certificates copied to Mac Mini"
    } || {
        print_status "ERROR" "Failed to copy SSL certificates to Mac Mini"
        exit 1
    }
    
    # Clean up temporary directory
    rm -rf "$temp_ssl_dir"
    
else
    echo "No SSL backup found - copying directly from pn51..."
    
    # Copy SSL certificates directly from pn51
    echo "Copying SSL certificates from pn51 primary location..."
    if scp verbumcare-lab.local:/opt/verbumcare/ssl/certs/* vcadmin@verbumcaremac-mini:~/verbumcare-demo/ssl/certs/ 2>/dev/null; then
        print_status "OK" "Primary SSL certificates copied"
    else
        print_status "WARN" "Primary SSL certificates copy failed"
        
        # Try secondary location
        echo "Trying secondary SSL certificate location..."
        if scp verbumcare-lab.local:/home/q/verbumcare-demo/ssl/certs/* vcadmin@verbumcaremac-mini:~/verbumcare-demo/ssl/certs/ 2>/dev/null; then
            print_status "OK" "Secondary SSL certificates copied"
        else
            print_status "ERROR" "Failed to copy SSL certificates from both locations"
            exit 1
        fi
    fi
    
    # Copy private keys
    echo "Copying SSL private keys..."
    if scp verbumcare-lab.local:/opt/verbumcare/ssl/private/* vcadmin@verbumcaremac-mini:~/verbumcare-demo/ssl/private/ 2>/dev/null; then
        print_status "OK" "SSL private keys copied"
    else
        print_status "WARN" "SSL private keys copy failed"
    fi
fi

# Verify SSL certificates
echo "Verifying SSL certificates on Mac Mini..."
ssl_cert_count=$(run_remote "ls ~/verbumcare-demo/ssl/certs/ | wc -l")
if [ "$ssl_cert_count" -ge 2 ]; then
    print_status "OK" "SSL certificates verified ($ssl_cert_count files)"
else
    print_status "ERROR" "Insufficient SSL certificate files ($ssl_cert_count)"
fi

echo ""
echo -e "${BLUE}5. AI Services Configuration${NC}"
echo "============================"

# Check if Ollama is already running
echo "Checking Ollama service status..."
if run_remote "curl -s http://localhost:11434/api/tags >/dev/null 2>&1"; then
    print_status "OK" "Ollama service is already running"
else
    print_status "WARN" "Ollama service is not running - will need to be started"
    
    # Check if Ollama is installed
    if run_remote "which ollama >/dev/null 2>&1"; then
        echo "Starting Ollama service..."
        run_remote "nohup ollama serve > ~/ollama.log 2>&1 &" && {
            sleep 5
            if run_remote "curl -s http://localhost:11434/api/tags >/dev/null 2>&1"; then
                print_status "OK" "Ollama service started"
            else
                print_status "WARN" "Ollama service may not have started properly"
            fi
        }
    else
        print_status "WARN" "Ollama is not installed - will need manual installation"
    fi
fi

# Check if required model is available
echo "Checking for required Ollama model (llama3.1:8b)..."
if run_remote "curl -s http://localhost:11434/api/tags | grep -q 'llama3.1:8b'"; then
    print_status "OK" "Required Ollama model is available"
else
    print_status "WARN" "Required Ollama model (llama3.1:8b) not found - will need to be pulled"
fi

# Check Whisper service
echo "Checking Whisper service status..."
if run_remote "curl -s http://localhost:8080/health >/dev/null 2>&1"; then
    print_status "OK" "Whisper service is already running"
else
    print_status "WARN" "Whisper service is not running - will need to be started"
fi

echo ""
echo -e "${BLUE}6. Docker Network and Volume Setup${NC}"
echo "=================================="

# Create Docker network
echo "Creating Docker network..."
run_remote "docker network create verbumcare-network 2>/dev/null || echo 'Network may already exist'" && {
    print_status "OK" "Docker network configured"
} || {
    print_status "WARN" "Docker network setup had issues"
}

# Create Docker volumes
echo "Creating Docker volumes..."
run_remote "docker volume create postgres_data 2>/dev/null || echo 'Volume may already exist'" && {
    print_status "OK" "Docker volumes configured"
} || {
    print_status "WARN" "Docker volume setup had issues"
}

echo ""
echo -e "${BLUE}7. Environment Configuration${NC}"
echo "============================"

# Create environment file for Mac Mini
echo "Creating environment configuration..."
cat > /tmp/macmini.env << 'EOF'
# Mac Mini Environment Configuration
DATABASE_URL=postgres://nagare:nagare_secure_password_change_me@postgres:5432/nagare_db
PORT=3000
NODE_ENV=production

# AI Services (Mac Mini local)
WHISPER_URL=http://host.docker.internal:8080
WHISPER_MODEL=large-v3
WHISPER_LANGUAGE=ja

OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_THREAD=8
OLLAMA_TEMPERATURE=0.1

# CORS (permissive for LAN)
API_CORS_ORIGIN=*
SOCKET_CORS_ORIGIN=*
EOF

# Copy environment file to Mac Mini
scp /tmp/macmini.env vcadmin@verbumcaremac-mini:~/verbumcare-demo/.env && {
    print_status "OK" "Environment configuration created"
} || {
    print_status "ERROR" "Failed to create environment configuration"
    exit 1
}

# Clean up temporary file
rm /tmp/macmini.env

echo ""
echo -e "${BLUE}8. Docker Image Preparation${NC}"
echo "=========================="

# Check if we need to build ARM64 images
echo "Checking Docker platform support..."
if run_remote "docker buildx ls | grep -q 'linux/arm64'"; then
    print_status "OK" "ARM64 platform support available"
else
    print_status "WARN" "ARM64 platform support may need configuration"
fi

# Pre-pull base images to save time during deployment
echo "Pre-pulling base Docker images..."
run_remote "docker pull --platform linux/arm64 postgres:15-alpine" && {
    print_status "OK" "PostgreSQL ARM64 image pulled"
} || {
    print_status "WARN" "Failed to pull PostgreSQL ARM64 image"
}

run_remote "docker pull --platform linux/arm64 nginx:alpine" && {
    print_status "OK" "nginx ARM64 image pulled"
} || {
    print_status "WARN" "Failed to pull nginx ARM64 image"
}

run_remote "docker pull --platform linux/arm64 node:18-alpine" && {
    print_status "OK" "Node.js ARM64 image pulled"
} || {
    print_status "WARN" "Failed to pull Node.js ARM64 image"
}

echo ""
echo -e "${BLUE}9. Final Verification${NC}"
echo "==================="

# Verify directory structure
echo "Verifying directory structure..."
dir_structure=$(run_remote "find ~/verbumcare-demo -type d | wc -l")
if [ "$dir_structure" -gt 5 ]; then
    print_status "OK" "Directory structure verified ($dir_structure directories)"
else
    print_status "ERROR" "Directory structure incomplete ($dir_structure directories)"
fi

# Verify key files
echo "Verifying key files..."
key_files=$(run_remote "find ~/verbumcare-demo -name '*.yml' -o -name '*.conf' -o -name 'Dockerfile*' | wc -l")
if [ "$key_files" -gt 3 ]; then
    print_status "OK" "Key configuration files verified ($key_files files)"
else
    print_status "ERROR" "Key configuration files missing ($key_files files)"
fi

# Check available disk space
echo "Checking available disk space..."
disk_space=$(run_remote "df -h ~ | tail -1 | awk '{print \$4}'")
echo "Available disk space: $disk_space"
if [[ "$disk_space" == *"G"* ]]; then
    print_status "OK" "Sufficient disk space available ($disk_space)"
else
    print_status "WARN" "Limited disk space available ($disk_space)"
fi

echo ""
echo -e "${GREEN}✅ Mac Mini Environment Setup Complete${NC}"
echo ""
echo "Setup Summary:"
echo "=============="
echo "- Directory structure created in ~/verbumcare-demo"
echo "- Application files copied from local machine"
echo "- SSL certificates migrated from pn51"
echo "- Docker network and volumes configured"
echo "- Environment configuration created"
echo "- Base Docker images pre-pulled"
echo ""
echo "Mac Mini is now ready for Docker container deployment!"
echo ""
echo "Next steps:"
echo "1. Run deploy-macmini-containers.sh to start containers"
echo "2. Run migrate-database.sh to import data from pn51"
echo "3. Run verify-macmini-deployment.sh to validate setup"
echo ""
echo -e "${YELLOW}⚠️  Remember: AI services (Ollama/Whisper) should be running before container deployment${NC}"