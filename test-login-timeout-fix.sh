#!/bin/bash

# Test Login Timeout Fix
# This script tests the login timeout fix for Mac Mini connectivity

echo "🔍 Testing Login Timeout Fix"
echo "============================"

# Test 1: Verify Mac Mini Docker services are running
echo ""
echo "📡 Test 1: Mac Mini Docker Services Status"
echo "Checking Docker services on verbumcarenomac-mini.local..."

if ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml ps" 2>/dev/null | grep -q "Up"; then
    echo "✅ Mac Mini Docker services are running"
    
    # Show service status
    echo "   Service Status:"
    ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml ps" 2>/dev/null | grep -E "(macmini-|Up|Down)" | head -5
else
    echo "❌ Mac Mini Docker services are not running or not accessible"
    echo "   Please start services with:"
    echo "   ssh vcadmin@verbumcarenomac-mini.local"
    echo "   export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH"
    echo "   cd ~/verbumcare-demo"
    echo "   docker compose -f docker-compose.macmini.yml up -d"
    exit 1
fi

# Test 2: Test HTTPS login endpoint with increased timeout
echo ""
echo "🔒 Test 2: Login Endpoint Connectivity Test"
echo "Testing login endpoint with 30-second timeout..."

LOGIN_TEST_START=$(date +%s)
RESPONSE=$(timeout 25 curl -k --connect-timeout 15 --max-time 20 -s -X POST "https://verbumcarenomac-mini.local/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo"}' 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$RESPONSE" ]; then
    LOGIN_TEST_END=$(date +%s)
    LOGIN_DURATION=$((LOGIN_TEST_END - LOGIN_TEST_START))
    echo "✅ Login endpoint responding (${LOGIN_DURATION}s)"
    
    # Test actual login response
    echo "   Testing actual login response..."
    
    if echo "$RESPONSE" | grep -q "success"; then
        echo "✅ Login endpoint returns valid response"
        echo "   Response preview: $(echo "$RESPONSE" | head -c 100)..."
    else
        echo "⚠️  Login endpoint accessible but response may be invalid"
        echo "   Response: $RESPONSE"
    fi
else
    echo "❌ Login endpoint not responding within 20 seconds"
    echo "   This indicates the timeout fix may not be sufficient"
fi

# Test 3: Test pn51 login endpoint for comparison
echo ""
echo "🔒 Test 3: pn51 Login Endpoint (Comparison)"
echo "Testing pn51 login endpoint for performance comparison..."

PN51_TEST_START=$(date +%s)
if timeout 25 curl -k --connect-timeout 20 --max-time 20 -s -X POST "https://verbumcare-lab.local/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo"}' >/dev/null 2>&1; then
    PN51_TEST_END=$(date +%s)
    PN51_DURATION=$((PN51_TEST_END - PN51_TEST_START))
    echo "✅ pn51 login endpoint responding (${PN51_DURATION}s)"
    
    if [ "$PN51_DURATION" -lt 5 ]; then
        echo "   ✅ pn51 has good performance (< 5s)"
    else
        echo "   ⚠️  pn51 performance is slower than expected"
    fi
else
    echo "❌ pn51 login endpoint not responding"
    echo "   This may indicate network issues"
fi

# Test 4: Check server configuration timeouts
echo ""
echo "⚙️  Test 4: Server Configuration Verification"
echo "Checking server timeout configurations..."

if [ -f "ipad-app/src/config/servers.ts" ]; then
    echo "✅ Server configuration file exists"
    
    # Check Mac Mini timeout
    MAC_MINI_TIMEOUT=$(grep -A 10 "id: 'mac-mini'" "ipad-app/src/config/servers.ts" | grep "connectionTimeout:" | awk '{print $2}' | tr -d ',')
    if [ "$MAC_MINI_TIMEOUT" = "30000" ]; then
        echo "✅ Mac Mini timeout correctly set to 30 seconds"
    else
        echo "❌ Mac Mini timeout is $MAC_MINI_TIMEOUT (should be 30000)"
    fi
    
    # Check pn51 timeout
    PN51_TIMEOUT=$(grep -A 10 "id: 'pn51'" "ipad-app/src/config/servers.ts" | grep "connectionTimeout:" | awk '{print $2}' | tr -d ',')
    if [ "$PN51_TIMEOUT" = "20000" ]; then
        echo "✅ pn51 timeout correctly set to 20 seconds"
    else
        echo "❌ pn51 timeout is $PN51_TIMEOUT (should be 20000)"
    fi
else
    echo "❌ Server configuration file not found"
fi

# Test 5: Check iOS Settings Bundle timeout
echo ""
echo "📱 Test 5: iOS Settings Bundle Verification"

if [ -f "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist" ]; then
    echo "✅ iOS Settings Bundle exists"
    
    # Check default timeout value
    if grep -A 1 "connection_timeout" "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist" | grep -q "<real>30</real>"; then
        echo "✅ iOS Settings default timeout correctly set to 30 seconds"
    else
        echo "❌ iOS Settings default timeout not set to 30 seconds"
        echo "   Current value:"
        grep -A 2 "connection_timeout" "ipad-app/ios/VerbumCare/Settings.bundle/Root.plist" | grep "<real>"
    fi
else
    echo "❌ iOS Settings Bundle not found"
fi

# Test 6: Verify API service timeout integration
echo ""
echo "🔧 Test 6: API Service Timeout Integration"

if grep -q "timeout = currentServer.connectionTimeout" "ipad-app/src/services/api.ts"; then
    echo "✅ API service uses server-specific timeouts"
else
    echo "❌ API service may not be using server-specific timeouts"
fi

if grep -q "Updated API timeout to.*ms" "ipad-app/src/services/api.ts"; then
    echo "✅ API service logs timeout updates"
else
    echo "❌ API service may not be logging timeout updates"
fi

# Summary and recommendations
echo ""
echo "📋 Test Summary & Recommendations"
echo "================================="

if [ "$MAC_MINI_TIMEOUT" = "30000" ] && [ -n "$LOGIN_DURATION" ] && [ "$LOGIN_DURATION" -lt 25 ]; then
    echo "✅ Login timeout fix appears successful"
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Build and install the updated iPad app"
    echo "2. Test login with Mac Mini server in iOS Settings"
    echo "3. Verify login completes within 30 seconds"
    echo "4. Check console logs for timeout-related messages"
else
    echo "⚠️  Login timeout fix needs attention"
    echo ""
    echo "🔧 Troubleshooting Steps:"
    
    if [ -z "$LOGIN_DURATION" ]; then
        echo "1. Mac Mini login endpoint is not responding - check Docker services"
        echo "2. Verify nginx reverse proxy is running and configured correctly"
        echo "3. Check SSL certificates are valid and accessible"
    elif [ "$LOGIN_DURATION" -ge 25 ]; then
        echo "1. Login is still slow (${LOGIN_DURATION}s) - may need longer timeout"
        echo "2. Consider increasing Mac Mini timeout to 45 seconds"
        echo "3. Investigate mDNS resolution performance on local network"
    fi
    
    if [ "$MAC_MINI_TIMEOUT" != "30000" ]; then
        echo "4. Fix Mac Mini timeout configuration in servers.ts"
    fi
fi

echo ""
echo "📝 For debugging login issues, check these logs:"
echo "   - iPad app console: Look for '📡 API Service using server-specific timeout'"
echo "   - iPad app console: Look for 'Login error:' messages"
echo "   - Mac Mini backend logs: ssh vcladmin@verbumcarenomac-mini.local 'docker logs macmini-backend'"
echo ""
echo "🔍 Manual test procedure:"
echo "1. Open iPad app"
echo "2. Go to iOS Settings > VerbumCare"
echo "3. Set Backend Server to 'Mac Mini'"
echo "4. Set Connection Timeout to 30 seconds"
echo "5. Return to app and try login with demo/demo"
echo "6. Login should complete within 30 seconds"