#!/usr/bin/env node

/**
 * Test Smart Server Selector Fix
 * 
 * This script tests the corrected smart server selector to ensure it can
 * properly connect to the Mac Mini production server.
 */

const axios = require('axios');

// Server configurations (matching the iPad app)
const SERVERS = [
  {
    id: 'mac-mini',
    name: 'verbumcarenomac-mini.local',
    displayName: 'Mac Mini (Production)',
    baseUrl: 'https://verbumcarenomac-mini.local/api',
    wsUrl: 'wss://verbumcarenomac-mini.local',
    description: 'Current production server running on Mac Mini with Apple Silicon optimization',
    isDefault: true,
    healthCheckEndpoints: ['/health'],
    connectionTimeout: 10000,
    retryAttempts: 3
  },
  {
    id: 'pn51',
    name: 'verbumcare-lab.local',
    displayName: 'pn51 Legacy Server',
    baseUrl: 'https://verbumcare-lab.local/api',
    wsUrl: 'wss://verbumcare-lab.local',
    description: 'Legacy production server available for rollback and testing',
    isDefault: false,
    healthCheckEndpoints: ['/health'],
    connectionTimeout: 10000,
    retryAttempts: 3
  }
];

async function testServerConnectivity(server) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🔍 Testing ${server.displayName}...`);
    console.log(`   Server ID: ${server.id}`);
    console.log(`   Base URL: ${server.baseUrl}`);
    
    // Correct URL construction (remove /api for health check)
    const baseUrlWithoutApi = server.baseUrl.replace('/api', '');
    const healthUrl = `${baseUrlWithoutApi}/health`;
    
    console.log(`   Health URL: ${healthUrl}`);
    
    const response = await axios.get(healthUrl, {
      timeout: server.connectionTimeout,
      httpsAgent: { rejectUnauthorized: false }
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`   ✅ SUCCESS: ${response.status} (${responseTime}ms)`);
    console.log(`   Response: ${JSON.stringify(response.data)}`);
    
    return {
      serverId: server.id,
      success: true,
      responseTime,
      timestamp: new Date()
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.log(`   ❌ FAILED: ${error.message} (${responseTime}ms)`);
    
    return {
      serverId: server.id,
      success: false,
      responseTime,
      error: error.message,
      timestamp: new Date()
    };
  }
}

async function testSmartServerSelection() {
  console.log('🚀 Testing Smart Server Selector Fix');
  console.log('=====================================');
  
  const testResults = [];
  
  // Test servers in priority order
  for (const server of SERVERS) {
    const result = await testServerConnectivity(server);
    testResults.push(result);
    
    // If we found a working server, we can stop (like the real smart selector)
    if (result.success) {
      console.log(`\n🎯 Smart selection would choose: ${server.displayName}`);
      console.log(`   Reason: First working server in priority order`);
      break;
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  testResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const server = SERVERS.find(s => s.id === result.serverId);
    console.log(`${status} ${server.displayName}: ${result.responseTime}ms ${result.error ? `(${result.error})` : ''}`);
  });
  
  const workingServers = testResults.filter(r => r.success);
  
  if (workingServers.length > 0) {
    console.log(`\n🎉 SUCCESS: Found ${workingServers.length} working server(s)`);
    console.log('   The iPad app should now connect successfully!');
    
    // Test login endpoint on the working server
    const workingServer = SERVERS.find(s => s.id === workingServers[0].serverId);
    console.log(`\n🔐 Testing login endpoint on ${workingServer.displayName}...`);
    
    try {
      const loginResponse = await axios.post(`${workingServer.baseUrl}/auth/login`, {
        username: 'demo',
        password: 'demo123'
      }, {
        timeout: 10000,
        httpsAgent: { rejectUnauthorized: false }
      });
      
      console.log(`   ✅ Login test successful: ${loginResponse.status}`);
      console.log(`   User: ${loginResponse.data.data?.user?.fullName || 'Unknown'}`);
      
    } catch (loginError) {
      console.log(`   ❌ Login test failed: ${loginError.message}`);
    }
    
  } else {
    console.log('\n❌ FAILURE: No working servers found');
    console.log('   Check if Docker services are running on the servers');
  }
}

// Run the test
testSmartServerSelection().catch(error => {
  console.error('\n💥 Test script failed:', error);
  process.exit(1);
});