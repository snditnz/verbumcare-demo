#!/usr/bin/env node

/**
 * mDNS Connectivity Test for Mac Mini
 * 
 * Tests direct HTTPS connectivity to mDNS hostnames without DNS lookup
 */

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test the exact hostname from deployment docs
const TEST_HOSTNAME = 'verbumcaremac-mini.local';

// Test endpoints
const TEST_ENDPOINTS = [
  '/health',
  '/api/patients',
  '/api/auth/login'
];

async function testHttpsEndpoint(hostname, endpoint) {
  return new Promise((resolve) => {
    const url = `https://${hostname}${endpoint}`;
    console.log(`Testing: ${url}`);
    
    const options = {
      hostname: hostname,
      port: 443,
      path: endpoint,
      method: 'GET',
      timeout: 10000,
      rejectUnauthorized: false // Accept self-signed certificates
    };
    
    const req = https.request(options, (res) => {
      console.log(`✅ ${endpoint}: Status ${res.statusCode}`);
      resolve({ success: true, status: res.statusCode });
    });
    
    req.on('error', (error) => {
      console.log(`❌ ${endpoint}: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    req.on('timeout', () => {
      console.log(`❌ ${endpoint}: Timeout`);
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    
    req.end();
  });
}

async function testPing(hostname) {
  try {
    console.log(`Testing ping to ${hostname}...`);
    const { stdout } = await execAsync(`ping -c 3 ${hostname}`);
    if (stdout.includes('3 packets transmitted, 3 received')) {
      console.log(`✅ Ping successful to ${hostname}`);
      return true;
    } else {
      console.log(`❌ Ping failed to ${hostname}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Ping error to ${hostname}: ${error.message}`);
    return false;
  }
}

async function checkMacMiniServices(hostname) {
  console.log(`\n🔧 Checking Mac Mini services on ${hostname}...`);
  
  try {
    console.log('Attempting to check Docker services via SSH...');
    const { stdout } = await execAsync(`ssh -o ConnectTimeout=10 vcadmin@${hostname} "export PATH=/Applications/Docker.app/Contents/Resources/bin:\\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml ps"`);
    
    console.log('✅ Docker services status:');
    console.log(stdout);
    return true;
  } catch (error) {
    console.log(`❌ Could not check Docker services: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 VerbumCare mDNS Connectivity Test');
  console.log('=====================================');
  console.log(`Testing hostname: ${TEST_HOSTNAME}`);
  console.log('');
  
  // Test ping first
  const pingResult = await testPing(TEST_HOSTNAME);
  
  if (!pingResult) {
    console.log('\n❌ Ping failed - mDNS resolution or network connectivity issue');
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check if Mac Mini is powered on and connected to network');
    console.log('2. Verify mDNS/Bonjour is enabled on the network');
    console.log('3. Check Mac Mini hostname in System Preferences > Sharing');
    console.log('4. Try different hostname variations');
    return;
  }
  
  // Test HTTPS endpoints
  console.log('\n🔒 Testing HTTPS endpoints:');
  const results = {};
  
  for (const endpoint of TEST_ENDPOINTS) {
    results[endpoint] = await testHttpsEndpoint(TEST_HOSTNAME, endpoint);
  }
  
  // Check services if any endpoint worked
  const anyWorking = Object.values(results).some(r => r.success);
  if (anyWorking) {
    await checkMacMiniServices(TEST_HOSTNAME);
  }
  
  // Summary
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(30));
  
  const workingEndpoints = Object.entries(results)
    .filter(([_, result]) => result.success)
    .map(([endpoint, _]) => endpoint);
  
  if (workingEndpoints.length > 0) {
    console.log(`✅ Working endpoints on ${TEST_HOSTNAME}:`);
    workingEndpoints.forEach(endpoint => {
      console.log(`   - ${endpoint}`);
    });
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Update iPad app server configuration');
    console.log('2. Test iPad app connection');
    
  } else {
    console.log(`❌ No working HTTPS endpoints on ${TEST_HOSTNAME}`);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('1. Check if nginx is running on Mac Mini');
    console.log('2. Verify SSL certificates are properly configured');
    console.log('3. Check firewall settings');
    console.log('4. Verify Docker services are running');
  }
  
  // Show current iPad app configuration
  console.log('\n📱 Current iPad App Configuration:');
  try {
    const fs = require('fs');
    const serversConfig = fs.readFileSync('ipad-app/src/config/servers.ts', 'utf8');
    const macMiniMatch = serversConfig.match(/name: '([^']+)',[\s\S]*?baseUrl: '([^']+)'/);
    if (macMiniMatch) {
      console.log(`   Current hostname: ${macMiniMatch[1]}`);
      console.log(`   Current baseUrl: ${macMiniMatch[2]}`);
      
      if (macMiniMatch[1] !== TEST_HOSTNAME) {
        console.log(`\n⚠️  HOSTNAME MISMATCH DETECTED!`);
        console.log(`   Config has: ${macMiniMatch[1]}`);
        console.log(`   Testing: ${TEST_HOSTNAME}`);
        console.log(`   This is likely the cause of your connection issues.`);
      }
    }
  } catch (error) {
    console.log('   Could not read current configuration');
  }
}

if (require.main === module) {
  main().catch(console.error);
}