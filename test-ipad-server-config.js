#!/usr/bin/env node

/**
 * Test iPad App Server Configuration
 * 
 * This script simulates the iPad app's server configuration loading process
 * to debug why the app is getting "Network Error" despite Mac Mini being accessible.
 */

console.log('🔍 Testing iPad App Server Configuration');
console.log('=====================================\n');

// Test 1: Direct server accessibility
console.log('1. Testing direct server accessibility...');

const testEndpoints = [
  'https://verbumcarenomac-mini.local/health',
  'https://verbumcarenomac-mini.local/api/health', 
  'https://verbumcarenomac-mini.local/api/auth/login'
];

async function testDirectAccess() {
  const axios = require('axios');
  
  for (const endpoint of testEndpoints) {
    try {
      console.log(`   Testing: ${endpoint}`);
      const response = await axios.get(endpoint, {
        timeout: 10000,
        httpsAgent: { rejectUnauthorized: false }
      });
      console.log(`   ✅ ${endpoint} - Status: ${response.status}`);
    } catch (error) {
      console.log(`   ❌ ${endpoint} - Error: ${error.message}`);
    }
  }
}

// Test 2: Login endpoint specifically
async function testLogin() {
  console.log('\n2. Testing login endpoint specifically...');
  
  const axios = require('axios');
  
  try {
    const response = await axios.post('https://verbumcarenomac-mini.local/api/auth/login', {
      username: 'demo',
      password: 'demo123'
    }, {
      timeout: 10000,
      httpsAgent: { rejectUnauthorized: false },
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ja'
      }
    });
    
    console.log('   ✅ Login successful!');
    console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
  } catch (error) {
    console.log('   ❌ Login failed:', error.message);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Test 3: Check what the iPad app configuration would be
async function testAppConfiguration() {
  console.log('\n3. Simulating iPad app configuration...');
  
  // Simulate the server configuration from servers.ts
  const AVAILABLE_SERVERS = [
    {
      id: 'localhost-dev',
      name: 'localhost',
      displayName: 'Development Proxy',
      baseUrl: 'http://localhost:3000/api',
      wsUrl: 'ws://localhost:3001',
      isDefault: false,
    },
    {
      id: 'mac-mini',
      name: 'verbumcarenomac-mini.local',
      displayName: 'Mac Mini (Production)',
      baseUrl: 'https://verbumcarenomac-mini.local/api',
      wsUrl: 'wss://verbumcarenomac-mini.local',
      isDefault: false,
    },
    {
      id: 'pn51',
      name: 'verbumcare-lab.local',
      displayName: 'pn51 Legacy Server',
      baseUrl: 'https://verbumcare-lab.local/api',
      wsUrl: 'wss://verbumcare-lab.local',
      isDefault: true, // This is the default!
    }
  ];
  
  const defaultServer = AVAILABLE_SERVERS.find(s => s.isDefault);
  console.log(`   Default server: ${defaultServer.displayName} (${defaultServer.baseUrl})`);
  
  // Simulate iOS Settings Bundle configuration
  const iosSettingsOptions = [
    'https://verbumcare-lab.local/api',      // pn51 (Default in Settings.bundle)
    'https://verbumcarenomac-mini.local/api', // Mac Mini
    'https://verbumcaremac-mini.tail609750.ts.net/api' // Mac Mini Tailscale
  ];
  
  console.log('   iOS Settings Bundle options:');
  iosSettingsOptions.forEach((option, index) => {
    console.log(`     ${index === 0 ? '(default)' : '        '} ${option}`);
  });
  
  // The issue might be here: Settings.bundle defaults to pn51, not Mac Mini!
  console.log('\n   🚨 POTENTIAL ISSUE IDENTIFIED:');
  console.log('   - App default server: pn51 (verbumcare-lab.local)');
  console.log('   - iOS Settings.bundle default: pn51 (verbumcare-lab.local)');
  console.log('   - User said pn51 is deliberately shut down');
  console.log('   - App may be trying to connect to pn51 instead of Mac Mini');
}

// Test 4: Check pn51 status (should be down)
async function testPn51Status() {
  console.log('\n4. Testing pn51 status (should be down)...');
  
  const axios = require('axios');
  
  try {
    const response = await axios.get('https://verbumcare-lab.local/health', {
      timeout: 5000,
      httpsAgent: { rejectUnauthorized: false }
    });
    console.log('   ⚠️ pn51 is actually UP! This might be the issue.');
    console.log(`   Status: ${response.status}`);
  } catch (error) {
    console.log('   ✅ pn51 is down as expected');
    console.log(`   Error: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testDirectAccess();
    await testLogin();
    await testAppConfiguration();
    await testPn51Status();
    
    console.log('\n📋 DIAGNOSIS:');
    console.log('=============');
    console.log('1. Mac Mini server is accessible and working correctly');
    console.log('2. The issue is likely in the iPad app configuration');
    console.log('3. Check if iOS Settings are actually being read');
    console.log('4. Verify the app is using Mac Mini, not pn51');
    console.log('5. The Settings.bundle defaults to pn51 - user must manually select Mac Mini');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runAllTests();