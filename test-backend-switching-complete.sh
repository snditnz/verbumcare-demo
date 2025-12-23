#!/bin/bash

# Test Backend Switching Configuration
# This script tests the current backend switching implementation

echo "🔍 Testing Backend Switching Configuration"
echo "=========================================="

# Test 1: Check if Mac Mini hostname resolves
echo ""
echo "📡 Test 1: Mac Mini Hostname Resolution"
echo "Testing: verbumcarenomac-mini.local"

if ping -c 1 verbumcarenomac-mini.local >/dev/null 2>&1; then
    echo "✅ verbumcarenomac-mini.local resolves"
    MAC_MINI_IP=$(ping -c 1 verbumcarenomac-mini.local | grep PING | awk '{print $3}' | tr -d '()')
    echo "   IP Address: $MAC_MINI_IP"
else
    echo "❌ verbumcarenomac-mini.local does not resolve"
    echo "   This may cause connection issues in the app"
fi

# Test 2: Check if pn51 hostname resolves
echo ""
echo "📡 Test 2: pn51 mDNS Resolution"
echo "Testing: verbumcare-lab.local"

if ping -c 1 verbumcare-lab.local >/dev/null 2>&1; then
    echo "✅ verbumcare-lab.local resolves"
    PN51_IP=$(ping -c 1 verbumcare-lab.local | grep PING | awk '{print $3}' | tr -d '()')
    echo "   IP Address: $PN51_IP"
else
    echo "❌ verbumcare-lab.local does not resolve"
    echo "   This may cause connection issues when using pn51"
fi

# Test 3: Test HTTPS endpoints
echo ""
echo "🔒 Test 3: HTTPS Endpoint Testing"

# Test Mac Mini HTTPS
echo "Testing Mac Mini HTTPS: https://verbumcarenomac-mini.local/health"
if curl -k --connect-timeout 20 --max-time 30 -s "https://verbumcarenomac-mini.local/health" >/dev/null 2>&1; then
    echo "✅ Mac Mini HTTPS endpoint responding"
    RESPONSE=$(curl -k --connect-timeout 20 --max-time 30 -s "https://verbumcarenomac-mini.local/health" | head -c 100)
    echo "   Response: $RESPONSE"
else
    echo "❌ Mac Mini HTTPS endpoint not responding (may be high latency)"
    echo "   Note: Manual test shows endpoint works but with 300ms+ latency"
fi

# Test pn51 HTTPS
echo ""
echo "Testing pn51 HTTPS: https://verbumcare-lab.local/health"
if curl -k --connect-timeout 10 -s "https://verbumcare-lab.local/health" >/dev/null 2>&1; then
    echo "✅ pn51 HTTPS endpoint responding"
    RESPONSE=$(curl -k --connect-timeout 10 -s "https://verbumcare-lab.local/health" | head -c 100)
    echo "   Response: $RESPONSE"
else
    echo "❌ pn51 HTTPS endpoint not responding"
    echo "   This will cause 'error' status in iOS Settings"
fi

# Test 4: Check for hardcoded URLs in codebase
echo ""
echo "🔍 Test 4: Hardcoded URL Audit"
echo "Searching for potential hardcoded URLs..."

# Search for hardcoded localhost URLs
LOCALHOST_COUNT=$(find ipad-app/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "localhost:" 2>/dev/null | wc -l)
if [ "$LOCALHOST_COUNT" -gt 0 ]; then
    echo "⚠️  Found $LOCALHOST_COUNT files with localhost URLs:"
    find ipad-app/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "localhost:" 2>/dev/null | head -5
else
    echo "✅ No localhost URLs found in iPad app source"
fi

# Search for hardcoded server URLs
HARDCODED_COUNT=$(find ipad-app/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "https://verbum" 2>/dev/null | wc -l)
if [ "$HARDCODED_COUNT" -gt 0 ]; then
    echo "⚠️  Found $HARDCODED_COUNT files with hardcoded server URLs:"
    find ipad-app/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "https://verbum" 2>/dev/null | head -5
else
    echo "✅ No hardcoded server URLs found in iPad app source"
fi

# Test 5: Check iOS Settings Bundle configuration
echo ""
echo "📱 Test 5: iOS Settings Bundle Configuration"

if [ -f "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist" ]; then
    echo "✅ iOS Settings Bundle exists"
    
    # Check if Mac Mini option is configured correctly
    if grep -q "verbumcarenomac-mini.local" "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist"; then
        echo "✅ Mac Mini hostname configured correctly in iOS Settings"
    else
        echo "❌ Mac Mini hostname may be incorrect in iOS Settings"
    fi
    
    # Check if pn51 option exists
    if grep -q "verbumcare-lab.local" "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist"; then
        echo "✅ pn51 hostname configured correctly in iOS Settings"
    else
        echo "❌ pn51 hostname may be incorrect in iOS Settings"
    fi
else
    echo "❌ iOS Settings Bundle not found"
fi

# Test 6: Check server configuration file
echo ""
echo "⚙️  Test 6: Server Configuration File"

if [ -f "ipad-app/src/config/servers.ts" ]; then
    echo "✅ Server configuration file exists"
    
    # Check Mac Mini configuration
    if grep -q "verbumcarenomac-mini.local" "ipad-app/src/config/servers.ts"; then
        echo "✅ Mac Mini configured with correct hostname"
    else
        echo "❌ Mac Mini hostname may be incorrect in server config"
    fi
    
    # Check default server
    if grep -q "isDefault: true" "ipad-app/src/config/servers.ts"; then
        DEFAULT_SERVER=$(grep -B 10 "isDefault: true" "ipad-app/src/config/servers.ts" | grep "id:" | tail -1 | awk -F"'" '{print $2}')
        echo "✅ Default server: $DEFAULT_SERVER"
    else
        echo "⚠️  No default server configured"
    fi
else
    echo "❌ Server configuration file not found"
fi

# Summary
echo ""
echo "📋 Test Summary"
echo "==============="
echo ""

if ping -c 1 verbumcarenomac-mini.local >/dev/null 2>&1 && curl -k --connect-timeout 10 -s "https://verbumcarenomac-mini.local/health" >/dev/null 2>&1; then
    echo "✅ Mac Mini server is accessible and responding"
    echo "   Users should be able to select 'Mac Mini' in iOS Settings"
else
    echo "❌ Mac Mini server has connectivity issues"
    echo "   This explains the 'error' status in iOS Settings"
    echo "   Recommended actions:"
    echo "   1. Check if Mac Mini Docker services are running"
    echo "   2. Verify SSL certificate includes correct hostnames"
    echo "   3. Test hostname resolution on local network"
fi

if ping -c 1 verbumcare-lab.local >/dev/null 2>&1 && curl -k --connect-timeout 10 -s "https://verbumcare-lab.local/health" >/dev/null 2>&1; then
    echo "✅ pn51 server is accessible and responding"
    echo "   Users can use pn51 as fallback server"
else
    echo "❌ pn51 server has connectivity issues"
    echo "   Both servers may be down"
fi

echo ""
echo "🔧 Next Steps:"
echo "1. Fix any connectivity issues identified above"
echo "2. Build and install the updated iPad app"
echo "3. Test server switching in iOS Settings > VerbumCare"
echo "4. Verify API calls use the selected server configuration"
echo ""
echo "📝 For debugging, check console logs for:"
echo "   - '[ServerConfig] Server changed' messages"
echo "   - '[Socket] Connecting to:' messages"
echo "   - '📡 API Service using server:' messages"