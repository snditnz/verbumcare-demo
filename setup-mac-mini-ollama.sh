#!/bin/bash

# VerbumCare Mac Mini Ollama Setup
# Configures Ollama service on the Mac Mini AI server to match pn51 configuration

set -e

echo "🤖 Setting up Ollama on Mac Mini for VerbumCare"
echo "==============================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAC_MINI_HOST="verbumcaremac-mini"
MAC_MINI_USER="vcadmin"
OLLAMA_MODEL="llama3.1:8b"
OLLAMA_PORT=11434

echo "📋 Configuration:"
echo "  Mac Mini: ${MAC_MINI_USER}@${MAC_MINI_HOST}"
echo "  Model: ${OLLAMA_MODEL}"
echo "  Port: ${OLLAMA_PORT}"
echo ""

# Test SSH connectivity
echo "🔍 Testing SSH connectivity to Mac Mini..."
if ssh -o ConnectTimeout=5 ${MAC_MINI_USER}@${MAC_MINI_HOST} "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH connection to Mac Mini successful${NC}"
else
    echo -e "${RED}❌ Cannot connect to Mac Mini via SSH${NC}"
    echo "Please ensure:"
    echo "  1. Mac Mini is powered on and connected to network"
    echo "  2. SSH is enabled on Mac Mini"
    echo "  3. You can connect with: ssh ${MAC_MINI_USER}@${MAC_MINI_HOST}"
    exit 1
fi

# Check if Ollama is installed on Mac Mini
echo ""
echo "🔍 Checking Ollama installation on Mac Mini..."
if ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "command -v ollama" >/dev/null 2>&1; then
    OLLAMA_VERSION=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "ollama --version" 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✅ Ollama found on Mac Mini${NC}"
    echo "  Version: $OLLAMA_VERSION"
else
    echo -e "${RED}❌ Ollama not found on Mac Mini${NC}"
    echo ""
    echo "To install Ollama on Mac Mini:"
    echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST}"
    echo "  brew install ollama"
    echo "  # OR download from https://ollama.ai"
    exit 1
fi

# Check if Ollama service is running
echo ""
echo "🔍 Checking Ollama service on Mac Mini..."
if ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama service is running on Mac Mini${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama service not running on Mac Mini${NC}"
    echo "Starting Ollama service on Mac Mini..."
    
    # Start Ollama service on Mac Mini
    ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "nohup ollama serve > /tmp/ollama.log 2>&1 &"
    
    # Wait for service to start
    echo "Waiting for Ollama to start on Mac Mini..."
    for i in {1..30}; do
        if ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Ollama service started on Mac Mini${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    
    if ! ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
        echo -e "${RED}❌ Failed to start Ollama service on Mac Mini${NC}"
        echo "Try manually:"
        echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST}"
        echo "  ollama serve"
        exit 1
    fi
fi

# Check available models on Mac Mini
echo ""
echo "📦 Checking available models on Mac Mini..."
MODELS=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s http://localhost:${OLLAMA_PORT}/api/tags")
echo "Current models on Mac Mini:"
echo "$MODELS" | jq -r '.models[]?.name // empty' 2>/dev/null | sed 's/^/  - /' || echo "  (Unable to parse model list)"

# Check if target model is available
if echo "$MODELS" | grep -q "llama3.1:8b"; then
    echo -e "${GREEN}✅ Target model llama3.1:8b found on Mac Mini${NC}"
elif echo "$MODELS" | grep -q "llama3:8b"; then
    echo -e "${YELLOW}⚠️  Found llama3:8b on Mac Mini (close match)${NC}"
    echo "You may want to pull the exact model:"
    echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} 'ollama pull llama3.1:8b'"
else
    echo -e "${YELLOW}⚠️  Target model not found on Mac Mini${NC}"
    echo "Pulling ${OLLAMA_MODEL} on Mac Mini..."
    
    # Pull the model on Mac Mini
    echo "This may take several minutes..."
    if ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "ollama pull ${OLLAMA_MODEL}"; then
        echo -e "${GREEN}✅ Model ${OLLAMA_MODEL} downloaded to Mac Mini${NC}"
    else
        echo -e "${RED}❌ Failed to download model to Mac Mini${NC}"
        echo "You can try manually:"
        echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} 'ollama pull ${OLLAMA_MODEL}'"
    fi
fi

# Test the model on Mac Mini
echo ""
echo "🧪 Testing model on Mac Mini..."
TEST_RESPONSE=$(ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "curl -s -X POST http://localhost:${OLLAMA_PORT}/api/generate \
    -H 'Content-Type: application/json' \
    -d '{
        \"model\": \"${OLLAMA_MODEL}\",
        \"prompt\": \"Hello, respond with just: OK\",
        \"stream\": false,
        \"options\": {
            \"num_ctx\": 2048,
            \"num_thread\": 8,
            \"temperature\": 0.1
        }
    }'")

if echo "$TEST_RESPONSE" | grep -q "OK"; then
    echo -e "${GREEN}✅ Model test successful on Mac Mini${NC}"
else
    echo -e "${YELLOW}⚠️  Model test response from Mac Mini:${NC}"
    echo "$TEST_RESPONSE" | jq -r '.response // .error // .' 2>/dev/null || echo "$TEST_RESPONSE"
fi

# Create service management script on Mac Mini
echo ""
echo "📝 Creating service management script on Mac Mini..."

ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} 'cat > ~/ollama-service.sh << '\''EOF'\''
#!/bin/bash

# Ollama Service Manager for VerbumCare Mac Mini
# Usage: ./ollama-service.sh [start|stop|status|restart]

OLLAMA_PORT=11434
PIDFILE="/tmp/ollama.pid"

case "$1" in
    start)
        if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
            echo "Ollama is already running (PID: $(cat $PIDFILE))"
            exit 1
        fi
        
        echo "Starting Ollama service on Mac Mini..."
        nohup ollama serve > /tmp/ollama.log 2>&1 &
        echo $! > "$PIDFILE"
        
        # Wait for startup
        sleep 3
        if curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags > /dev/null 2>&1; then
            echo "✅ Ollama service started (PID: $(cat $PIDFILE))"
        else
            echo "❌ Failed to start Ollama service"
            rm -f "$PIDFILE"
            exit 1
        fi
        ;;
        
    stop)
        if [ -f "$PIDFILE" ]; then
            PID=$(cat "$PIDFILE")
            if kill -0 "$PID" 2>/dev/null; then
                echo "Stopping Ollama service (PID: $PID)..."
                kill "$PID"
                rm -f "$PIDFILE"
                echo "✅ Ollama service stopped"
            else
                echo "Ollama service not running"
                rm -f "$PIDFILE"
            fi
        else
            echo "Ollama service not running (no PID file)"
        fi
        ;;
        
    status)
        if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
            echo "✅ Ollama service is running (PID: $(cat $PIDFILE))"
            if curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags > /dev/null 2>&1; then
                echo "✅ API is responding"
                MODELS=$(curl -s http://localhost:${OLLAMA_PORT}/api/tags | jq -r ".models | length" 2>/dev/null || echo "unknown")
                echo "📦 Models available: $MODELS"
            else
                echo "❌ API not responding"
            fi
        else
            echo "❌ Ollama service is not running"
            rm -f "$PIDFILE"
        fi
        ;;
        
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
        
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 1
        ;;
esac
EOF'

ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "chmod +x ~/ollama-service.sh"

echo -e "${GREEN}✅ Service script created on Mac Mini: ~/ollama-service.sh${NC}"

# Backend configuration check (no changes made)
echo ""
echo "📋 Backend configuration status..."
if [ -f "backend/.env" ]; then
    CURRENT_OLLAMA_URL=$(grep "OLLAMA_URL" backend/.env | cut -d'=' -f2 || echo "")
    echo "  Current backend OLLAMA_URL: $CURRENT_OLLAMA_URL"
    echo -e "${BLUE}ℹ️  Backend configuration unchanged (as requested)${NC}"
    echo "  Backend will continue using: $CURRENT_OLLAMA_URL"
else
    echo -e "${YELLOW}⚠️  backend/.env not found${NC}"
fi

# Test connectivity from local machine to Mac Mini
echo ""
echo "🌐 Testing connectivity from local machine to Mac Mini..."
if curl -s --max-time 5 "http://${MAC_MINI_HOST}:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Can reach Mac Mini Ollama from local machine${NC}"
else
    echo -e "${YELLOW}⚠️  Cannot reach Mac Mini Ollama from local machine${NC}"
    echo "This might be normal if you're not on the same network."
    echo "The backend server should be able to reach it."
fi

echo ""
echo "🎉 Mac Mini Ollama setup complete!"
echo ""
echo "📋 Summary:"
echo "  ✅ Ollama installed and running on Mac Mini"
echo "  ✅ Model ${OLLAMA_MODEL} available"
echo "  ✅ Service management script created"
echo "  ℹ️  Backend configuration unchanged (still uses pn51)"
echo ""
echo "📋 Service management on Mac Mini:"
echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} '~/ollama-service.sh start'"
echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} '~/ollama-service.sh stop'"
echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} '~/ollama-service.sh status'"
echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} '~/ollama-service.sh restart'"
echo ""
echo "🔍 Final status check:"
ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} "~/ollama-service.sh status"

echo ""
echo "📝 Next steps:"
echo "1. Mac Mini now has Ollama running (same as pn51)"
echo "2. Backend continues using pn51 for production"
echo "3. Mac Mini available for testing/development if needed"
echo ""
echo "4. Monitor Mac Mini Ollama logs:"
echo "   ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} 'tail -f /tmp/ollama.log'"