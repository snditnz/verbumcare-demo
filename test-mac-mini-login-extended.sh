#!/bin/bash

# Test Mac Mini Login with Extended Timeout
# This script tests Mac Mini login with extended timeout to handle high network latency

echo "🔍 Testing Mac Mini Login with Extended Timeout"
echo "==============================================="

# Test 1: Check network latency to Mac Mini
echo ""
echo "📡 Test 1: Network Latency Check"
echo "Testing network latency to verbumcarenomac-mini.local..."

PING_RESULT=$(ping -c 5 verbumcarenomac-mini.local 2>/dev/null | tail -1)
if echo "$PING_RESULT" | grep -q "avg"; then
    AVG_LATENCY=$(echo "$PING_RESULT" | awk -F'/' '{print $5}')
    echo "✅ Average latency: ${AVG_LATENCY}ms"
    
    if (( $(echo "$AVG_LATENCY > 300" | bc -l) )); then
        echo "⚠️  High latency detected (>300ms) - extended timeouts required"
        RECOMMENDED_TIMEOUT=120
    elif (( $(echo "$AVG_LATENCY > 100" | bc -l) )); then
        echo "⚠️  Moderate latency detected (>100ms) - increased timeouts recommended"
        RECOMMENDED_TIMEOUT=60
    else
        echo "✅ Normal latency (<100ms)"
        RECOMMENDED_TIMEOUT=30
    fi
    
    echo "   Recommended timeout: ${RECOMMENDED_TIMEOUT} seconds"
else
    echo "❌ Could not measure latency to Mac Mini"
    RECOMMENDED_TIMEOUT=120
fi

# Test 2: Test Mac Mini health endpoint with extended timeout
echo ""
echo "🔒 Test 2: Mac Mini Health Check (Extended Timeout)"
echo "Testing health endpoint with ${RECOMMENDED_TIMEOUT}-second timeout..."

HEALTH_START=$(date +%s)
if timeout $((RECOMMENDED_TIMEOUT + 10)) curl -k --connect-timeout $RECOMMENDED_TIMEOUT --max-time $RECOMMENDED_TIMEOUT -s "https://verbumcarenomac-mini.local/health" >/dev/null 2>&1; then
    HEALTH_END=$(date +%s)
    HEALTH_DURATION=$((HEALTH_END - HEALTH_START))
    echo "✅ Health endpoint responding (${HEALTH_DURATION}s)"
    
    if [ "$HEALTH_DURATION" -lt 10 ]; then
        echo "   ✅ Good performance (< 10s)"
    elif [ "$HEALTH_DURATION" -lt 30 ]; then
        echo "   ⚠️  Moderate performance (10-30s)"
    else
        echo "   ❌ Slow performance (> 30s)"
    fi
else
    echo "❌ Health endpoint not responding within ${RECOMMENDED_TIMEOUT} seconds"
    echo "   This indicates a serious connectivity issue"
fi

# Test 3: Test Mac Mini login endpoint with extended timeout
echo ""
echo "🔒 Test 3: Mac Mini Login Test (Extended Timeout)"
echo "Testing login endpoint with ${RECOMMENDED_TIMEOUT}-second timeout..."

LOGIN_START=$(date +%s)
LOGIN_RESPONSE=$(timeout $((RECOMMENDED_TIMEOUT + 10)) curl -k --connect-timeout $RECOMMENDED_TIMEOUT --max-time $RECOMMENDED_TIMEOUT -s -X POST "https://verbumcarenomac-mini.local/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo"}' 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$LOGIN_RESPONSE" ]; then
    LOGIN_END=$(date +%s)
    LOGIN_DURATION=$((LOGIN_END - LOGIN_START))
    echo "✅ Login endpoint responding (${LOGIN_DURATION}s)"
    
    # Check if response is valid JSON
    if echo "$LOGIN_RESPONSE" | jq . >/dev/null 2>&1; then
        echo "✅ Valid JSON response received"
        
        # Check if it's the expected auth failure
        if echo "$LOGIN_RESPONSE" | jq -r '.success' | grep -q "false"; then
            echo "✅ Expected authentication failure (endpoint working correctly)"
            echo "   Response: $(echo "$LOGIN_RESPONSE" | jq -r '.error')"
        else
            echo "⚠️  Unexpected response format"
            echo "   Response: $LOGIN_RESPONSE"
        fi
    else
        echo "❌ Invalid JSON response"
        echo "   Response: $LOGIN_RESPONSE"
    fi
else
    echo "❌ Login endpoint not responding within ${RECOMMENDED_TIMEOUT} seconds"
    echo "   This will cause login failures in the iPad app"
fi

# Test 4: Compare with pn51 performance
echo ""
echo "🔒 Test 4: pn51 Performance Comparison"
echo "Testing pn51 login for performance comparison..."

PN51_START=$(date +%s)
if timeout 30 curl -k --connect-timeout 20 --max-time 20 -s -X POST "https://verbumcare-lab.local/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo"}' >/dev/null 2>&1; then
    PN51_END=$(date +%s)
    PN51_DURATION=$((PN51_END - PN51_START))
    echo "✅ pn51 login endpoint responding (${PN51_DURATION}s)"
    
    if [ "$PN51_DURATION" -lt 5 ]; then
        echo "   ✅ pn51 has excellent performance (< 5s)"
    elif [ "$PN51_DURATION" -lt 15 ]; then
        echo "   ✅ pn51 has good performance (< 15s)"
    else
        echo "   ⚠️  pn51 performance is slower than expected"
    fi
    
    # Compare performance
    if [ -n "$LOGIN_DURATION" ] && [ -n "$PN51_DURATION" ]; then
        PERFORMANCE_RATIO=$((LOGIN_DURATION * 100 / PN51_DURATION))
        echo "   📊 Mac Mini is ${PERFORMANCE_RATIO}% of pn51 speed"
        
        if [ "$PERFORMANCE_RATIO" -gt 300 ]; then
            echo "   ❌ Mac Mini is significantly slower than pn51"
        elif [ "$PERFORMANCE_RATIO" -gt 150 ]; then
            echo "   ⚠️  Mac Mini is moderately slower than pn51"
        else
            echo "   ✅ Mac Mini performance is acceptable"
        fi
    fi
else
    echo "❌ pn51 login endpoint not responding"
    echo "   This may indicate broader network issues"
fi

# Test 5: Check updated timeout configurations
echo ""
echo "⚙️  Test 5: Updated Timeout Configuration Verification"
echo "Checking if timeout configurations have been updated..."

# Check server configuration
if [ -f "ipad-app/src/config/servers.ts" ]; then
    MAC_MINI_TIMEOUT=$(grep -A 10 "id: 'mac-mini'" "ipad-app/src/config/servers.ts" | grep "connectionTimeout:" | awk '{print $2}' | tr -d ',')
    if [ "$MAC_MINI_TIMEOUT" = "120000" ]; then
        echo "✅ Mac Mini timeout updated to 120 seconds in server config"
    else
        echo "❌ Mac Mini timeout not updated (current: $MAC_MINI_TIMEOUT, should be: 120000)"
    fi
else
    echo "❌ Server configuration file not found"
fi

# Check iOS Settings Bundle
if [ -f "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist" ]; then
    if grep -A 1 "connection_timeout" "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist" | grep -q "<real>120</real>"; then
        echo "✅ iOS Settings default timeout updated to 120 seconds"
    else
        echo "❌ iOS Settings default timeout not updated"
        echo "   Current value:"
        grep -A 2 "connection_timeout" "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist" | grep "<real>"
    fi
else
    echo "❌ iOS Settings Bundle not found"
fi

# Check native settings service
if grep -q "connectionTimeout: 120" "ipad-app/src/services/nativeSettingsService.ts"; then
    echo "✅ Native settings service default timeout updated to 120 seconds"
else
    echo "❌ Native settings service default timeout not updated"
fi

# Summary and recommendations
echo ""
echo "📋 Test Summary & Recommendations"
echo "================================="

if [ -n "$LOGIN_DURATION" ] && [ "$LOGIN_DURATION" -lt 60 ]; then
    echo "✅ Mac Mini login is working with extended timeout"
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Build and install the updated iPad app with 120-second timeouts"
    echo "2. Test login with Mac Mini server in iOS Settings"
    echo "3. Verify login completes within the extended timeout"
    echo "4. Consider network optimization if performance is still poor"
else
    echo "❌ Mac Mini login still has issues even with extended timeout"
    echo ""
    echo "🔧 Troubleshooting Steps:"
    
    if [ -z "$LOGIN_DURATION" ]; then
        echo "1. Mac Mini login endpoint is not responding - check network connectivity"
        echo "2. Verify Mac Mini is on the same network as your development machine"
        echo "3. Check if there are firewall rules blocking HTTPS traffic"
        echo "4. Consider using Tailscale endpoint as alternative"
    elif [ "$LOGIN_DURATION" -ge 60 ]; then
        echo "1. Login is very slow (${LOGIN_DURATION}s) - investigate network issues"
        echo "2. Check WiFi signal strength and network congestion"
        echo "3. Consider using wired connection for Mac Mini"
        echo "4. Use pn51 as primary server until network issues are resolved"
    fi
fi

echo ""
echo "📝 Network Optimization Suggestions:"
echo "   - Use wired Ethernet connection for Mac Mini if possible"
echo "   - Check WiFi signal strength and channel congestion"
echo "   - Consider QoS settings to prioritize VerbumCare traffic"
echo "   - Use Tailscale endpoint (verbumcaremac-mini.tail609750.ts.net) as alternative"
echo ""
echo "🔍 For debugging, check iPad app console logs for:"
echo "   - 'Connection timeout after XXXXXms' messages"
echo "   - 'Network request failed' errors"
echo "   - '📡 API Service using server-specific timeout: 120000ms' confirmations"