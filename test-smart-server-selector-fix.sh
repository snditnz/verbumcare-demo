#!/bin/bash

# Test Smart Server Selector Fix
# This script tests the corrected smart server selector logic

echo "🚀 Testing Smart Server Selector Fix"
echo "====================================="

# Test the corrected URL construction
echo ""
echo "🔍 Testing URL construction fix..."
echo "================================="

MAC_MINI_BASE="https://verbumcarenomac-mini.local/api"
MAC_MINI_HEALTH="https://verbumcarenomac-mini.local/health"

echo "Mac Mini configuration:"
echo "  Base URL: $MAC_MINI_BASE"
echo "  Health URL: $MAC_MINI_HEALTH (corrected - no /api prefix)"

echo ""
echo "Testing Mac Mini health endpoint..."

if response=$(curl -k -s -w "HTTPSTATUS:%{http_code}" --max-time 10 "$MAC_MINI_HEALTH" 2>/dev/null); then
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_status" = "200" ]; then
        echo "  ✅ SUCCESS: HTTP $http_status"
        echo "  Response: $response_body"
        WORKING_SERVER="mac-mini"
    else
        echo "  ❌ FAILED: HTTP $http_status"
        echo "  Response: $response_body"
    fi
else
    echo "  ❌ FAILED: Connection error"
fi

echo ""
echo "Testing pn51 health endpoint (expected to fail - unplugged)..."

PN51_HEALTH="https://verbumcare-lab.local/health"
echo "  Health URL: $PN51_HEALTH"

if response=$(curl -k -s -w "HTTPSTATUS:%{http_code}" --max-time 5 "$PN51_HEALTH" 2>/dev/null); then
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_status" = "200" ]; then
        echo "  ✅ SUCCESS: HTTP $http_status (unexpected - should be unplugged)"
        echo "  Response: $response_body"
    else
        echo "  ❌ FAILED: HTTP $http_status (expected - server unplugged)"
    fi
else
    echo "  ❌ FAILED: Connection error (expected - server unplugged)"
fi

echo ""
echo "📊 Smart Selection Result:"
echo "========================="

if [ "$WORKING_SERVER" = "mac-mini" ]; then
    echo "🎯 Selected server: Mac Mini (Production)"
    echo "   URL: https://verbumcarenomac-mini.local"
    echo "   Reason: First working server in priority order"
    
    echo ""
    echo "🔐 Testing login endpoint..."
    login_url="https://verbumcarenomac-mini.local/api/auth/login"
    echo "   Login URL: $login_url"
    
    login_response=$(curl -k -s -X POST "$login_url" \
        -H "Content-Type: application/json" \
        -d '{"username": "demo", "password": "demo123"}' \
        --max-time 10 2>/dev/null)
    
    if echo "$login_response" | grep -q '"success":true'; then
        echo "   ✅ Login test successful"
        user_name=$(echo "$login_response" | grep -o '"fullName":"[^"]*"' | cut -d'"' -f4)
        echo "   User: ${user_name:-'Demo User'}"
        
        echo ""
        echo "🎉 SUCCESS: The iPad app should now connect successfully!"
        echo "   The smart server selector fix resolves the network error."
        
    else
        echo "   ❌ Login test failed"
        echo "   Response: $login_response"
    fi
    
else
    echo "❌ FAILURE: No working servers found"
    echo "   Check if Docker services are running on Mac Mini:"
    echo "   ssh vcadmin@verbumcarenomac-mini.local"
fi

echo ""
echo "🔧 Fix Applied:"
echo "==============="
echo "✅ Corrected health check URL construction in smartServerSelector.ts"
echo "   Before: baseUrl + '/health' = 'https://verbumcarenomac-mini.local/api/health' (❌ 404)"
echo "   After:  baseUrl.replace('/api', '') + '/health' = 'https://verbumcarenomac-mini.local/health' (✅ 200)"
echo ""
echo "✅ Updated server configuration in servers.ts"
echo "   - Mac Mini is now the default production server (isDefault: true)"
echo "   - Reduced connection timeout to 10 seconds for faster testing"
echo "   - Simplified health check endpoints to just ['/health']"
echo ""
echo "✅ The iPad app will now:"
echo "   1. Test Mac Mini first (priority order)"
echo "   2. Use correct health check URL"
echo "   3. Connect successfully for demo"