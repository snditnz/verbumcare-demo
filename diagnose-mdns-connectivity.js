#!/usr/bin/env node

/**
 * mDNS Connectivity Diagnostic Tool
 * 
 * This script helps diagnose connectivity issues with the Mac Mini server
 * after mDNS hostname changes.
 */

const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test hostnames to try
const TEST_HOSTNAMES = [
  'verbumcarenomac-mini.local',
  'VerbumCarenoMac-mini.local', 
  'verbumcaremac-mini.local',
  'VerbumCareMac-mini.local',
  'verbumcare-mac-mini.local',
  'VerbumCare-Mac-mini.local'
];

// Test endpoints
const TEST_ENDPOINTS = [
  '/health',
  '/api/patients',
  '/api/auth/login'
];

async function testMdnsResolution(hostname) {
  console.log(`\n🔍 Testing mDNS resolution for: ${hostname}`);
  
  try {
    // Test DNS resolution using nslookup
    const { stdout, stderr } = await execAsync(`nslookup ${hostname}`);
    if (stdout.includes('can\'t find') || stderr) {
      console.log(`❌ DNS resolution failed for ${hostname}`);
      return false;
    }
    
    console.log(`✅ DNS resolution successful for ${hostname}`);
    console.log(`   IP: ${stdout.match(/Address: (.+)/)?.[1] || 'Unknown'}`);
    return true;
  } catch (error) {
    console.log(`❌ DNS resolution error for ${hostname}: ${error.message}`);
    return false;
  }
}

async function testHttpsEndpoint(hostname, endpoint) {
  return new Promise((resolve) => {
    const url = `https://${hostname}${endpoint}`;
    console.log(`   Testing: ${url}`);
    
    const options = {
      hostname: hostname,
      port: 443,
      path: endpoint,
      method: 'GET',
      timeout: 10000,
      rejectUnauthorized: false // Accept self-signed certificates
    };
    
    const req = https.request(options, (res) => {
      console.log(`   ✅ HTTPS ${endpoint}: Status ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ HTTPS ${endpoint}: ${error.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log(`   ❌ HTTPS ${endpoint}: Timeout`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function testHttpEndpoint(hostname, endpoint) {
  return new Promise((resolve) => {
    const url = `http://${hostname}${endpoint}`;
    console.log(`   Testing: ${url}`);
    
    const options = {
      hostname: hostname,
      port: 80,
      path: endpoint,
      method: 'GET',
      timeout: 10000
    };
    
    const req = http.request(options, (res) => {
      console.log(`   ✅ HTTP ${endpoint}: Status ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ HTTP ${endpoint}: ${error.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log(`   ❌ HTTP ${endpoint}: Timeout`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function testPing(hostname) {
  try {
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
    // Check if we can SSH to verify services
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
  console.log('🚀 VerbumCare mDNS Connectivity Diagnostic Tool');
  console.log('================================================');
  
  const results = {};
  
  for (const hostname of TEST_HOSTNAMES) {
    console.log(`\n📡 Testing hostname: ${hostname}`);
    console.log('─'.repeat(50));
    
    const result = {
      hostname,
      dnsResolution: false,
      ping: false,
      httpsEndpoints: {},
      httpEndpoints: {},
      servicesCheck: false
    };
    
    // Test DNS resolution
    result.dnsResolution = await testMdnsResolution(hostname);
    
    if (result.dnsResolution) {
      // Test ping
      result.ping = await testPing(hostname);
      
      // Test HTTPS endpoints
      console.log('\n🔒 Testing HTTPS endpoints:');
      for (const endpoint of TEST_ENDPOINTS) {
        result.httpsEndpoints[endpoint] = await testHttpsEndpoint(hostname, endpoint);
      }
      
      // Test HTTP endpoints (should be redirected or blocked)
      console.log('\n🌐 Testing HTTP endpoints:');
      for (const endpoint of TEST_ENDPOINTS) {
        result.httpEndpoints[endpoint] = await testHttpEndpoint(hostname, endpoint);
      }
      
      // Check services if any endpoint worked
      const anyHttpsWorking = Object.values(result.httpsEndpoints).some(Boolean);
      if (anyHttpsWorking) {
        result.servicesCheck = await checkMacMiniServices(hostname);
      }
    }
    
    results[hostname] = result;
  }
  
  // Summary
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(50));
  
  const workingHostnames = Object.entries(results)
    .filter(([_, result]) => result.dnsResolution && Object.values(result.httpsEndpoints).some(Boolean))
    .map(([hostname, _]) => hostname);
  
  if (workingHostnames.length > 0) {
    console.log('✅ Working hostnames:');
    workingHostnames.forEach(hostname => {
      console.log(`   - ${hostname}`);
    });
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Update ipad-app/src/config/servers.ts with the working hostname');
    console.log('2. Update any .env files to use the working hostname');
    console.log('3. Test the iPad app connection');
    
    const bestHostname = workingHostnames[0];
    console.log(`\n📝 Suggested server config update:`);
    console.log(`   baseUrl: 'https://${bestHostname}/api'`);
    console.log(`   wsUrl: 'wss://${bestHostname}'`);
    
  } else {
    console.log('❌ No working hostnames found');
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check if Mac Mini is powered on and connected to network');
    console.log('2. Verify mDNS/Bonjour is enabled on the network');
    console.log('3. Check Mac Mini hostname in System Preferences > Sharing');
    console.log('4. Restart Mac Mini Docker services');
    console.log('5. Check firewall settings on Mac Mini');
  }
  
  // Check current iPad app configuration
  console.log('\n📱 Current iPad App Configuration:');
  try {
    const fs = require('fs');
    const serversConfig = fs.readFileSync('ipad-app/src/config/servers.ts', 'utf8');
    const macMiniConfig = serversConfig.match(/name: '([^']+)',[\s\S]*?baseUrl: '([^']+)'/);
    if (macMiniConfig) {
      console.log(`   Current hostname: ${macMiniConfig[1]}`);
      console.log(`   Current baseUrl: ${macMiniConfig[2]}`);
    }
  } catch (error) {
    console.log('   Could not read current configuration');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testMdnsResolution, testHttpsEndpoint };