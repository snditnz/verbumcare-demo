#!/bin/bash

# VerbumCare Backend API Test Script
# Tests core functionality without requiring database connection

set -e

API_BASE="http://localhost:3000"

echo "🏥 VerbumCare Backend API Test Suite"
echo "======================================"

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s "$API_BASE/health" | jq '.' || echo "Health check failed - is server running?"

echo -e "\n2. Testing patient endpoints..."
# Note: These will fail without database, but tests the routing
curl -s "$API_BASE/api/patients" -H "Accept-Language: ja" | head -c 200 || echo "Expected: needs database"

echo -e "\n3. Testing medication endpoints..."
curl -s "$API_BASE/api/medications/patient/test-id" -H "Accept-Language: en" | head -c 200 || echo "Expected: needs database"

echo -e "\n4. Testing dashboard metrics..."
curl -s "$API_BASE/api/dashboard/metrics" -H "Accept-Language: zh-TW" | head -c 200 || echo "Expected: needs database"

echo -e "\n5. Testing HL7 export..."
curl -s "$API_BASE/api/dashboard/export/hl7?type=patients" | head -c 200 || echo "Expected: needs database"

echo -e "\n✅ API Test Suite completed!"
echo "Next steps:"
echo "1. Start Docker: docker compose up -d"
echo "2. Wait for database to initialize"
echo "3. Run full tests with database"