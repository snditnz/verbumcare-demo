#!/bin/bash
# Discovery script for VerbumCare backend (Offline/LAN-only)

echo "🔍 Discovering VerbumCare backend server (offline mode)..."

# Cache file for last known good config
CACHE_FILE="./.verbumcare-backend-cache"

# Method 1: Try cached IP first (fastest)
if [ -f "$CACHE_FILE" ]; then
    CACHED_URL=$(cat "$CACHE_FILE")
    echo "Trying cached backend: $CACHED_URL"
    if curl -s --connect-timeout 2 "$CACHED_URL/health" > /dev/null 2>&1; then
        echo "✅ Found backend at: $CACHED_URL (cached)"
        echo "export VITE_API_URL=$CACHED_URL/api"
        echo "export VITE_WS_URL=$CACHED_URL"
        exit 0
    else
        echo "⚠️  Cached backend not responding, searching..."
    fi
fi

# Method 2: Try .local hostname (mDNS - works offline)
HOSTNAME="${1:-verbumcare-server.local}"
echo "Trying mDNS hostname: $HOSTNAME"

if curl -s --connect-timeout 2 "http://$HOSTNAME:3000/health" > /dev/null 2>&1; then
    echo "✅ Found backend at: http://$HOSTNAME:3000"
    echo "http://$HOSTNAME:3000" > "$CACHE_FILE"
    echo "export VITE_API_URL=http://$HOSTNAME:3000/api"
    echo "export VITE_WS_URL=http://$HOSTNAME:3000"
    exit 0
fi

# Method 3: Scan local network (slower but comprehensive)
echo "Scanning local network for backend..."

# Try all network interfaces
for INTERFACE in en0 en1 en2; do
    NETWORK_PREFIX=$(ipconfig getifaddr $INTERFACE 2>/dev/null | sed 's/\.[0-9]*$//')

    if [ -z "$NETWORK_PREFIX" ]; then
        continue
    fi

    echo "Scanning $INTERFACE network: $NETWORK_PREFIX.0/24"

    # Parallel scan for speed (max 20 at a time)
    for i in {1..254}; do
        IP="$NETWORK_PREFIX.$i"
        (
            if curl -s --connect-timeout 0.3 "http://$IP:3000/health" > /dev/null 2>&1; then
                echo "✅ Found backend at: http://$IP:3000"
                echo "http://$IP:3000" > "$CACHE_FILE"
                echo "export VITE_API_URL=http://$IP:3000/api"
                echo "export VITE_WS_URL=http://$IP:3000"
                # Kill other scans
                pkill -P $$ curl 2>/dev/null
                exit 0
            fi
        ) &

        # Limit concurrent processes
        if [ $(jobs -r | wc -l) -ge 20 ]; then
            wait -n
        fi
    done

    wait

    # Check if we found it
    if [ -f "$CACHE_FILE" ]; then
        FOUND_URL=$(cat "$CACHE_FILE")
        if curl -s --connect-timeout 1 "$FOUND_URL/health" > /dev/null 2>&1; then
            exit 0
        fi
    fi
done

echo "❌ Backend not found on network"
echo "💡 Make sure:"
echo "   1. Backend server is running (docker-compose up -d)"
echo "   2. You're on the same WiFi network"
echo "   3. Firewall allows port 3000"
exit 1