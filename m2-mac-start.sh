#!/bin/bash
# VerbumCare M2 Mac (AI + Presentation) Startup Script
# Starts AI services for demo - keep it LEAN!

set -e  # Exit on error

echo "🤖 VerbumCare M2 Mac AI Services Startup"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on correct machine
HOSTNAME=$(scutil --get LocalHostName 2>/dev/null || hostname)
if [[ "$HOSTNAME" != "verbumcare-ai" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Hostname is '$HOSTNAME', expected 'verbumcare-ai'${NC}"
    echo "Set with: sudo scutil --set LocalHostName verbumcare-ai"
    echo ""
fi

# Memory warning
echo -e "${BLUE}💾 Memory Check (8GB total available)${NC}"
MEMORY_FREE=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
MEMORY_FREE_GB=$((MEMORY_FREE * 4096 / 1024 / 1024 / 1024))
echo "   Free memory: ~${MEMORY_FREE_GB}GB"
if [ $MEMORY_FREE_GB -lt 4 ]; then
    echo -e "${RED}⚠️  WARNING: Less than 4GB free memory!${NC}"
    echo "   Close unnecessary applications before continuing"
    echo "   Press Ctrl+C to cancel, or Enter to continue anyway"
    read
fi
echo ""

# Check for Ollama
echo "🔍 Step 1: Checking Ollama installation..."
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Error: Ollama not installed${NC}"
    echo "Install with: brew install ollama"
    exit 1
fi
echo -e "${GREEN}✅ Ollama found${NC}"

# Check if Ollama model is downloaded
echo ""
echo "🔍 Step 2: Checking for Llama model..."
if ollama list | grep -q "llama3:8b"; then
    echo -e "${GREEN}✅ Llama 3 8B model found${NC}"
else
    echo -e "${YELLOW}⚠️  Llama 3 8B model not found${NC}"
    echo "Download with: ollama pull llama3:8b-q4_K_M"
    echo "This will take a few minutes..."
    read -p "Download now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ollama pull llama3:8b-q4_K_M
    else
        echo "Continuing without model (will fail when processing)"
    fi
fi

# Check for Whisper
echo ""
echo "🔍 Step 3: Checking Whisper installation..."
if ! command -v whisper-server &> /dev/null && ! command -v whisper &> /dev/null; then
    echo -e "${YELLOW}⚠️  Whisper not found${NC}"
    echo "Install options:"
    echo "  1. whisper.cpp: brew install whisper-cpp"
    echo "  2. faster-whisper: pip3 install faster-whisper"
    echo ""
    echo "Continuing anyway (will check for model)..."
fi

# Check if Whisper model exists
if [ -f "models/ggml-large-v3.bin" ] || [ -f "$HOME/.cache/whisper/large-v3.pt" ]; then
    echo -e "${GREEN}✅ Whisper model found${NC}"
else
    echo -e "${YELLOW}⚠️  Whisper Large-v3 model not found${NC}"
    echo "Download with whisper.cpp:"
    echo "  bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/ggerganov/whisper.cpp/master/models/download-ggml-model.sh)\" _ large-v3"
fi

# Start Ollama
echo ""
echo "🚀 Step 4: Starting Ollama service..."
# Check if already running
if pgrep -x "ollama" > /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama already running${NC}"
else
    ollama serve > /tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!
    echo -e "${GREEN}✅ Ollama started (PID: $OLLAMA_PID)${NC}"
    echo "   Logs: tail -f /tmp/ollama.log"

    # Wait for Ollama to be ready
    echo "   Waiting for Ollama to be ready..."
    for i in {1..10}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${GREEN}   ✅ Ollama is ready${NC}"
            break
        fi
        sleep 1
        if [ $i -eq 10 ]; then
            echo -e "${RED}   ❌ Ollama failed to start${NC}"
            echo "   Check logs: tail /tmp/ollama.log"
        fi
    done
fi

# Start Whisper
echo ""
echo "🚀 Step 5: Starting Whisper service..."
# Check if already running
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 8080 already in use (Whisper may be running)${NC}"
else
    if command -v whisper-server &> /dev/null; then
        # Using whisper.cpp server
        if [ -f "models/ggml-large-v3.bin" ]; then
            whisper-server --model models/ggml-large-v3.bin --language ja --port 8080 > /tmp/whisper.log 2>&1 &
            WHISPER_PID=$!
            echo -e "${GREEN}✅ Whisper started (PID: $WHISPER_PID)${NC}"
            echo "   Logs: tail -f /tmp/whisper.log"
        else
            echo -e "${RED}❌ Whisper model not found${NC}"
            echo "   Service will not start"
        fi
    else
        echo -e "${YELLOW}⚠️  whisper-server not found${NC}"
        echo "   You'll need to start Whisper manually"
        echo "   Or install: brew install whisper-cpp"
    fi

    # Wait for Whisper to be ready
    if [ ! -z "$WHISPER_PID" ]; then
        echo "   Waiting for Whisper to be ready..."
        for i in {1..10}; do
            if curl -s http://localhost:8080/health > /dev/null 2>&1; then
                echo -e "${GREEN}   ✅ Whisper is ready${NC}"
                break
            fi
            sleep 1
            if [ $i -eq 10 ]; then
                echo -e "${RED}   ❌ Whisper failed to start${NC}"
                echo "   Check logs: tail /tmp/whisper.log"
            fi
        done
    fi
fi

# Final status
echo ""
echo "================================================================"
echo -e "${GREEN}✅ M2 Mac AI Services Ready!${NC}"
echo "================================================================"
echo ""
echo "🎯 Service Status:"
echo -n "   Ollama (port 11434):  "
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not responding${NC}"
fi

echo -n "   Whisper (port 8080):  "
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not responding${NC}"
fi

echo ""
echo "💾 Memory Status:"
MEMORY_USED=$(ps -A -o %mem | awk '{s+=$1} END {print s}')
echo "   Current usage: ${MEMORY_USED}%"
echo "   Expected peak during processing: ~85-90%"
echo ""
echo "🔍 Test AI services from Intel Mac:"
echo "   curl http://verbumcare-ai.local:11434/api/tags"
echo "   curl http://verbumcare-ai.local:8080/health"
echo ""
echo "📊 Monitor logs:"
echo "   Ollama:  tail -f /tmp/ollama.log"
echo "   Whisper: tail -f /tmp/whisper.log"
echo ""
echo "🛑 To stop services:"
echo "   pkill ollama"
echo "   pkill whisper-server"
echo ""
echo "📽️  Now open your PowerPoint presentation!"
echo ""