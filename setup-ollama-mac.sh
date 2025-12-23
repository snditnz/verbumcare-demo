#!/bin/bash

# VerbumCare Ollama Setup for Mac
# Sets up Ollama service to match pn51 configuration

set -e

echo "🤖 Setting up Ollama for VerbumCare on Mac"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration from backend/.env
OLLAMA_MODEL="llama3.1:8b"
OLLAMA_PORT=11434

echo "📋 Configuration:"
echo "  Model: ${OLLAMA_MODEL}"
echo "  Port: ${OLLAMA_PORT}"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama not found${NC}"
    echo "Please install Ollama first:"
    echo "  brew install ollama"
    echo "  # OR download from https://ollama.ai"
    exit 1
fi

echo -e "${GREEN}✅ Ollama found${NC}"
ollama --version

# Check if Ollama service is running
echo ""
echo "🔍 Checking Ollama service..."
if curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama service is running${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama service not running${NC}"
    echo "Starting Ollama service..."
    
    # Start Ollama in background
    ollama serve &
    OLLAMA_PID=$!
    
    # Wait for service to start
    echo "Waiting for Ollama to start..."
    for i in {1..30}; do
        if curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Ollama service started${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    
    if ! curl -s --max-time 3 http://localhost:${OLLAMA_PORT}/api/tags > /dev/null 2>&1; then
        echo -e "${RED}❌ Failed to start Ollama service${NC}"
        exit 1
    fi
fi

# Check available models
echo ""
echo "📦 Checking available models..."
MODELS=$(curl -s http://localhost:${OLLAMA_PORT}/api/tags)
echo "Current models:"
echo "$MODELS" | jq -r '.models[]?.name // empty' 2>/dev/null || echo "  (Unable to parse model list)"

# Check if our target model is available
if echo "$MODELS" | grep -q "llama3.1:8b"; then
    echo -e "${GREEN}✅ Target model llama3.1:8b found${NC}"
elif echo "$MODELS" | grep -q "llama3:8b"; then
    echo -e "${YELLOW}⚠️  Found llama3:8b (close match)${NC}"
    echo "You may want to pull the exact model: ollama pull llama3.1:8b"
else
    echo -e "${YELLOW}⚠️  Target model not found${NC}"
    echo "Pulling ${OLLAMA_MODEL}..."
    
    # Pull the model
    ollama pull ${OLLAMA_MODEL}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Model ${OLLAMA_MODEL} downloaded${NC}"
    else
        echo -e "${RED}❌ Failed to download model${NC}"
        echo "You can try manually: ollama pull ${OLLAMA_MODEL}"
    fi
fi

# Test the model
echo ""
echo "🧪 Testing model..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:${OLLAMA_PORT}/api/generate \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'${OLLAMA_MODEL}'",
        "prompt": "Hello, respond with just: OK",
        "stream": false,
        "options": {
            "num_ctx": 2048,
            "num_thread": 8,
            "temperature": 0.1
        }
    }')

if echo "$TEST_RESPONSE" | grep -q "OK"; then
    echo -e "${GREEN}✅ Model test successful${NC}"
else
    echo -e "${YELLOW}⚠️  Model test response:${NC}"
    echo "$TEST_RESPONSE" | jq -r '.response // .error // .' 2>/dev/null || echo "$TEST_RESPONSE"
fi

# Create systemd-style service script for macOS
echo ""
echo "📝 Creating service management script..."

cat > ollama-service.sh << 'EOF'
#!/bin/bash

# Ollama Service Manager for VerbumCare
# Usage: ./ollama-service.sh [start|stop|status|restart]

OLLAMA_PORT=11434
PIDFILE="/tmp/ollama.pid"

case "$1" in
    start)
        if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
            echo "Ollama is already running (PID: $(cat $PIDFILE))"
            exit 1
        fi
        
        echo "Starting Ollama service..."
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
                MODELS=$(curl -s http://localhost:${OLLAMA_PORT}/api/tags | jq -r '.models | length' 2>/dev/null || echo "unknown")
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
EOF

chmod +x ollama-service.sh

echo -e "${GREEN}✅ Service script created: ollama-service.sh${NC}"
echo ""
echo "📋 Usage:"
echo "  ./ollama-service.sh start   - Start Ollama service"
echo "  ./ollama-service.sh stop    - Stop Ollama service"
echo "  ./ollama-service.sh status  - Check service status"
echo "  ./ollama-service.sh restart - Restart service"

# Update backend .env to use localhost
echo ""
echo "🔧 Updating backend configuration..."
if [ -f "backend/.env" ]; then
    # Backup original
    cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Update Ollama URL to localhost
    sed -i '' 's|OLLAMA_URL=.*|OLLAMA_URL=http://localhost:11434|g' backend/.env
    
    echo -e "${GREEN}✅ Backend .env updated${NC}"
    echo "  OLLAMA_URL set to http://localhost:11434"
    echo "  Backup saved as backend/.env.backup.*"
else
    echo -e "${YELLOW}⚠️  backend/.env not found${NC}"
    echo "You may need to create it with:"
    echo "  OLLAMA_URL=http://localhost:11434"
    echo "  OLLAMA_MODEL=llama3.1:8b"
fi

echo ""
echo "🎉 Ollama setup complete!"
echo ""
echo "🔍 Final status check:"
./ollama-service.sh status

echo ""
echo "📝 Next steps:"
echo "1. Test the backend integration:"
echo "   cd backend && npm test -- --testPathPattern=ollama"
echo ""
echo "2. Start the full VerbumCare stack:"
echo "   ./start.sh  # or ./nagare-start.sh"
echo ""
echo "3. Monitor Ollama logs:"
echo "   tail -f /tmp/ollama.log"