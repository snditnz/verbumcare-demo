#!/usr/bin/env node

/**
 * Server Discovery Script for Offline mDNS Resolution
 * 
 * This script helps discover VerbumCare servers on the local network
 * when mDNS hostnames are not resolving properly.
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 VerbumCare Server Discovery');
console.log('==============================');

// Test hostnames to try
const testHosts = [
  'verbumcaremac-mini.local',
  'verbumcaremac-mini',
  'verbumcare-lab.local'
];

async function testHost(hostname) {
  try {
    console.log(`🧪 Testing ${hostname}...`);
    
    // Try to resolve the hostname
    const result = execSync(`nslookup ${hostname}`, { 
      encoding: 'utf8', 
      timeout: 5000,
      stdio: 'pipe'
    });
    
    // Extract IP address
    const ipMatch = result.match(/Address: (\d+\.\d+\.\d+\.\d+)/);
    if (ipMatch) {
      const ip = ipMatch[1];
      console.log(`  ✅ Resolved to: ${ip}`);
      
      // Test HTTPS connection
      try {
        execSync(`curl -k -s --connect-timeout 3 "https://${hostname}/health"`, {
          timeout: 5000,
          stdio: 'pipe'
        });
        console.log(`  ✅ HTTPS working: https://${hostname}`);
        return { hostname, ip, status: 'working' };
      } catch (error) {
        console.log(`  ❌ HTTPS failed: ${error.message}`);
        return { hostname, ip, status: 'dns-only' };
      }
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message.split('\n')[0]}`);
    return { hostname, status: 'failed' };
  }
}

async function discoverServers() {
  console.log('\n🔍 Testing known hostnames...\n');
  
  const results = [];
  for (const host of testHosts) {
    const result = await testHost(host);
    results.push(result);
  }
  
  console.log('\n📋 Discovery Results:');
  console.log('====================');
  
  const workingServers = results.filter(r => r.status === 'working');
  const dnsOnlyServers = results.filter(r => r.status === 'dns-only');
  
  if (workingServers.length > 0) {
    console.log('\n✅ Working Servers:');
    workingServers.forEach(server => {
      console.log(`  • ${server.hostname} (${server.ip}) - https://${server.hostname}`);
    });
  }
  
  if (dnsOnlyServers.length > 0) {
    console.log('\n⚠️  DNS Only (HTTPS Issues):');
    dnsOnlyServers.forEach(server => {
      console.log(`  • ${server.hostname} (${server.ip}) - DNS works, HTTPS fails`);
    });
  }
  
  const failedServers = results.filter(r => r.status === 'failed');
  if (failedServers.length > 0) {
    console.log('\n❌ Failed to Resolve:');
    failedServers.forEach(server => {
      console.log(`  • ${server.hostname} - Not reachable`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (workingServers.length > 0) {
    console.log('  ✅ Use these working servers in your app configuration');
  } else {
    console.log('  ⚠️  No working servers found. Check:');
    console.log('     1. Mac Mini mDNS configuration');
    console.log('     2. Network connectivity');
    console.log('     3. SSL certificate setup');
  }
}

discoverServers().catch(console.error);