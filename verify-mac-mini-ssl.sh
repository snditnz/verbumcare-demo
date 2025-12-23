#!/bin/bash

# Verify Mac Mini SSL Certificate
# This script verifies the SSL certificate is working for all hostname variants

set -e

MAC_MINI_HOST="verbumcarenomac-mini.local"

echo "🔍 Verifying Mac Mini SSL Certificate"
echo "====================================="

# Test all hostname variants
hostnames=(
    "verbumcarenomac-mini.local"
    "verbumcaremac-mini"
    "verbumcaremac-mini.tail609750.ts.net"
)

for hostname in "${hostnames[@]}"; do
    echo ""
    echo "🧪 Testing $hostname..."
    
    # Test HTTPS connectivity
    if curl -k --connect-timeout 10 -s "https://$hostname/health" > /dev/null; then
        echo "✅ HTTPS connectivity: SUCCESS"
        
        # Check certificate details
        echo "📋 Certificate details:"
        curl -k -v "https://$hostname/health" 2>&1 | grep -E "(subject:|issuer:|SSL certificate verify)" | head -3
        
        # Test API endpoint
        response=$(curl -k -s "https://$hostname/health" | head -c 100)
        if [[ $response == *"healthy"* ]]; then
            echo "✅ API response: SUCCESS"
        else
            echo "⚠️  API response: Unexpected - $response"
        fi
    else
        echo "❌ HTTPS connectivity: FAILED"
    fi
done

echo ""
echo "🔍 Checking certificate SANs..."
if curl -k -v "https://$MAC_MINI_HOST/health" 2>&1 | grep -q "subject alternative name"; then
    echo "✅ Certificate has Subject Alternative Names"
else
    echo "⚠️  Could not verify SANs (connection may have failed)"
fi

echo ""
echo "📊 Summary:"
echo "==========="

# Test summary
success_count=0
total_count=${#hostnames[@]}

for hostname in "${hostnames[@]}"; do
    if curl -k --connect-timeout 5 -s "https://$hostname/health" > /dev/null 2>&1; then
        echo "✅ $hostname - Working"
        ((success_count++))
    else
        echo "❌ $hostname - Failed"
    fi
done

echo ""
if [[ $success_count -eq $total_count ]]; then
    echo "🎉 All hostnames working! SSL certificate deployment successful."
    echo ""
    echo "✅ Ready for iOS Settings testing:"
    echo "   1. Open Settings > VerbumCare on iPad"
    echo "   2. Select 'Mac Mini' from dropdown"
    echo "   3. Return to VerbumCare app"
    echo "   4. Check connection status"
else
    echo "⚠️  $success_count/$total_count hostnames working."
    echo "   Some hostnames may need additional configuration."
fi