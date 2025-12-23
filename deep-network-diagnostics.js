#!/usr/bin/env node

/**
 * Deep Network Diagnostics for iPad App Connectivity Issues
 * 
 * This script performs comprehensive network diagnostics to identify
 * why the iPad app cannot connect to the backend services.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

console.log('🔍 DEEP NETWORK DIAGNOSTICS');
console.log('===========================');
console.log('');

// Test results storage
const results = {
  timestamp: new Date().toISOString(),
  tests: {},
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

function logTest(name, status, details) {
  const symbols = { pass: '✅', fail: '❌', warn: '⚠️' };
  console.log(`${symbols[status]} ${name}`);
  if (details) console.log(`   ${details}`);
  
  results.tests[name] = { status, details };
  results.summary[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
}

function testCommand(command, testName) {
  try {
    const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
    logTest(testName, 'pass', output.trim().substring(0, 100));
    return { success: true, output };
  } catch (error) {
    logTest(testName, 'fail', error.message);
    return { success: false, error: error.message };
  }
}

function testHttpEndpoint(url, testName, timeout = 5000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      timeout,
      rejectUnauthorized: false // Accept self-signed certificates
    };
    
    const req = client.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        logTest(testName, 'pass', `Status: ${res.statusCode}, Response: ${data.substring(0, 50)}...`);
        resolve({ success: true, status: res.statusCode, data });
      });
    });
    
    req.on('error', (error) => {
      logTest(testName, 'fail', error.message);
      resolve({ success: false, error: error.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      logTest(testName, 'fail', 'Request timeout');
      resolve({ success: false, error: 'timeout' });
    });
  });
}

async function runDiagnostics() {
  console.log('🔧 BASIC CONNECTIVITY TESTS');
  console.log('----------------------------');
  
  // Test 1: Basic network connectivity
  testCommand('ping -c 3 8.8.8.8', 'Internet connectivity (Google DNS)');
  
  // Test 2: Local network connectivity
  testCommand('ping -c 3 192.168.0.1', 'Local router connectivity');
  
  // Test 3: mDNS resolution tests
  console.log('\n🌐 mDNS RESOLUTION TESTS');
  console.log('------------------------');
  
  const hostnames = [
    'verbumcaremac-mini',
    'verbumcaremac-mini.local',
    'verbumcarenomac-mini.local',
    'VerbumCarenoMac-mini.local'
  ];
  
  for (const hostname of hostnames) {
    testCommand(`ping -c 2 ${hostname}`, `mDNS resolution: ${hostname}`);
  }
  
  // Test 4: Port connectivity tests
  console.log('\n🔌 PORT CONNECTIVITY TESTS');
  console.log('---------------------------');
  
  const portTests = [
    { host: 'verbumcarenomac-mini.local', port: 443, desc: 'HTTPS (Mac Mini)' },
    { host: 'verbumcarenomac-mini.local', port: 80, desc: 'HTTP (Mac Mini)' },
    { host: 'verbumcare-lab.local', port: 443, desc: 'HTTPS (pn51 legacy)' },
    { host: 'localhost', port: 3000, desc: 'Development proxy' },
    { host: 'localhost', port: 8081, desc: 'Expo dev server' }
  ];
  
  for (const test of portTests) {
    testCommand(`nc -z -v -w5 ${test.host} ${test.port}`, `Port ${test.port} on ${test.host} (${test.desc})`);
  }
  
  // Test 5: HTTP/HTTPS endpoint tests
  console.log('\n🌍 HTTP/HTTPS ENDPOINT TESTS');
  console.log('-----------------------------');
  
  const endpoints = [
    'http://localhost:3000/health',
    'http://localhost:3000/api/health',
    'https://verbumcarenomac-mini.local/health',
    'https://verbumcarenomac-mini.local/api/health',
    'https://verbumcare-lab.local/health',
    'https://verbumcare-lab.local/api/health'
  ];
  
  for (const endpoint of endpoints) {
    await testHttpEndpoint(endpoint, `HTTP GET: ${endpoint}`);
  }
  
  // Test 6: Development proxy analysis
  console.log('\n🔄 DEVELOPMENT PROXY ANALYSIS');
  console.log('------------------------------');
  
  // Check if proxy is running
  testCommand('lsof -i :3000', 'Development proxy process check');
  
  // Test proxy forwarding
  await testHttpEndpoint('http://localhost:3000/health', 'Proxy health endpoint');
  await testHttpEndpoint('http://localhost:3000/api/patients', 'Proxy API forwarding test');
  
  // Test 7: iPad app configuration analysis
  console.log('\n📱 IPAD APP CONFIGURATION ANALYSIS');
  console.log('-----------------------------------');
  
  try {
    const serversConfig = fs.readFileSync('ipad-app/src/config/servers.ts', 'utf8');
    const defaultServer = serversConfig.match(/isDefault:\s*true/);
    if (defaultServer) {
      logTest('Default server configuration', 'pass', 'Found default server in config');
    } else {
      logTest('Default server configuration', 'warn', 'No default server found');
    }
    
    // Check for localhost configuration
    if (serversConfig.includes('localhost:3000')) {
      logTest('Localhost proxy configuration', 'pass', 'Development proxy configured');
    } else {
      logTest('Localhost proxy configuration', 'fail', 'Development proxy not found in config');
    }
    
    // Check for mDNS hostnames
    if (serversConfig.includes('verbumcarenomac-mini.local')) {
      logTest('mDNS hostname configuration', 'pass', 'Mac Mini mDNS hostname found');
    } else {
      logTest('mDNS hostname configuration', 'fail', 'Mac Mini mDNS hostname not found');
    }
    
  } catch (error) {
    logTest('iPad app configuration file', 'fail', error.message);
  }
  
  // Test 8: Environment variable analysis
  console.log('\n🔧 ENVIRONMENT VARIABLE ANALYSIS');
  console.log('---------------------------------');
  
  try {
    const envLocal = fs.readFileSync('ipad-app/.env.local', 'utf8');
    console.log('📄 .env.local contents:');
    console.log(envLocal);
    
    if (envLocal.includes('localhost:3000')) {
      logTest('Environment API URL', 'pass', 'Points to development proxy');
    } else if (envLocal.includes('verbumcarenomac-mini.local')) {
      logTest('Environment API URL', 'warn', 'Points directly to Mac Mini (may have mDNS issues)');
    } else {
      logTest('Environment API URL', 'fail', 'Unknown or missing API URL');
    }
    
  } catch (error) {
    logTest('Environment file (.env.local)', 'fail', error.message);
  }
  
  // Test 9: Mac Mini backend service status
  console.log('\n🖥️  MAC MINI BACKEND SERVICE STATUS');
  console.log('-----------------------------------');
  
  testCommand('ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml ps"', 'Mac Mini Docker services status');
  
  // Test 10: Network interface analysis
  console.log('\n🌐 NETWORK INTERFACE ANALYSIS');
  console.log('------------------------------');
  
  testCommand('ifconfig | grep "inet "', 'Local IP addresses');
  testCommand('route -n get default', 'Default route information');
  
  // Generate summary report
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('=====================');
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`⚠️  Warnings: ${results.summary.warnings}`);
  
  // Save detailed results
  fs.writeFileSync('network-diagnostics-results.json', JSON.stringify(results, null, 2));
  console.log('\n📄 Detailed results saved to: network-diagnostics-results.json');
  
  // Provide recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('==================');
  
  if (results.summary.failed > 0) {
    console.log('❌ Network connectivity issues detected:');
    
    // Check for specific failure patterns
    const failedTests = Object.entries(results.tests).filter(([_, test]) => test.status === 'fail');
    
    if (failedTests.some(([name]) => name.includes('mDNS resolution'))) {
      console.log('   • mDNS resolution failing - iPad may not be on same network as Mac Mini');
      console.log('   • Recommendation: Use development proxy (localhost:3000) as default');
    }
    
    if (failedTests.some(([name]) => name.includes('Development proxy'))) {
      console.log('   • Development proxy not running or accessible');
      console.log('   • Recommendation: Restart proxy with: node dev-proxy.js');
    }
    
    if (failedTests.some(([name]) => name.includes('Mac Mini'))) {
      console.log('   • Mac Mini backend services may be down');
      console.log('   • Recommendation: Check Docker services on Mac Mini');
    }
    
    if (failedTests.some(([name]) => name.includes('Port'))) {
      console.log('   • Port connectivity issues detected');
      console.log('   • Recommendation: Check firewall settings and service status');
    }
  } else {
    console.log('✅ All basic connectivity tests passed');
    console.log('   • Issue may be in iPad app configuration or caching');
    console.log('   • Recommendation: Clear app cache and restart');
  }
  
  console.log('\n🔧 NEXT STEPS');
  console.log('=============');
  console.log('1. Review the diagnostic results above');
  console.log('2. Check network-diagnostics-results.json for detailed information');
  console.log('3. Follow the specific recommendations for failed tests');
  console.log('4. If issues persist, check iPad app logs and network settings');
}

// Run diagnostics
runDiagnostics().catch(console.error);