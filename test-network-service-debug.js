#!/usr/bin/env node

/**
 * Network Service Debug Test
 * 
 * This script helps debug the network service initialization issue
 * that's causing instant "Network Error" during login.
 */

const axios = require('axios');

async function testNetworkConnectivity() {
  console.log('🔍 Testing Network Connectivity...\n');
  
  // Test 1: Direct axios request to Mac Mini
  console.log('📡 Test 1: Direct axios request to Mac Mini health endpoint');
  try {
    const response = await axios.get('https://verbumcarenomac-mini.local/health', {
      timeout: 10000,
      httpsAgent: new (require('https').Agent)({ 
        rejectUnauthorized: false 
      })
    });
    
    console.log('✅ Direct request SUCCESS:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
  } catch (error) {
    console.log('❌ Direct request FAILED:', {
      code: error.code,
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Direct axios request to login endpoint
  console.log('📡 Test 2: Direct axios request to Mac Mini login endpoint');
  try {
    const response = await axios.post('https://verbumcarenomac-mini.local/api/auth/login', {
      username: 'demo',
      password: 'demo123',
      deviceInfo: {
        platform: 'test',
        appVersion: '1.0.0'
      }
    }, {
      timeout: 10000,
      httpsAgent: new (require('https').Agent)({ 
        rejectUnauthorized: false 
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ja'
      }
    });
    
    console.log('✅ Login request SUCCESS:', {
      status: response.status,
      statusText: response.statusText,
      success: response.data.success,
      hasUserData: !!response.data.data?.user,
      hasTokens: !!(response.data.data?.accessToken && response.data.data?.refreshToken)
    });
  } catch (error) {
    console.log('❌ Login request FAILED:', {
      code: error.code,
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Test legacy server for comparison
  console.log('📡 Test 3: Direct axios request to legacy server (pn51) for comparison');
  try {
    const response = await axios.get('https://verbumcare-lab.local/health', {
      timeout: 10000,
      httpsAgent: new (require('https').Agent)({ 
        rejectUnauthorized: false 
      })
    });
    
    console.log('✅ Legacy server request SUCCESS:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
  } catch (error) {
    console.log('❌ Legacy server request FAILED (expected - pn51 unplugged):', {
      code: error.code,
      message: error.message,
      status: error.response?.status
    });
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Test mDNS resolution
  console.log('📡 Test 4: Testing mDNS hostname resolution');
  const dns = require('dns').promises;
  
  try {
    const addresses = await dns.lookup('verbumcarenomac-mini.local');
    console.log('✅ mDNS resolution SUCCESS:', {
      hostname: 'verbumcarenomac-mini.local',
      address: addresses.address,
      family: addresses.family
    });
  } catch (error) {
    console.log('❌ mDNS resolution FAILED:', {
      hostname: 'verbumcarenomac-mini.local',
      error: error.message
    });
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  console.log('🎯 SUMMARY:');
  console.log('- If direct axios requests work, the issue is in React Native network service');
  console.log('- If mDNS resolution fails, the issue is hostname resolution');
  console.log('- If login endpoint works, the backend is functioning correctly');
  console.log('- The iPad app network service might be incorrectly reporting offline status');
}

// Run the test
testNetworkConnectivity().catch(console.error);