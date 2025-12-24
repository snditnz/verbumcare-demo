#!/usr/bin/env node

/**
 * Debug script to test the exact same configuration as the iPad app
 * This will help isolate if the issue is in axios configuration or iOS-specific
 */

const axios = require('axios');

async function testIPadConfiguration() {
  console.log('🧪 Testing iPad app network configuration...');
  
  // Simulate the exact server configuration from the iPad app
  const serverConfig = {
    id: 'mac-mini',
    displayName: 'Mac Mini (Production)',
    baseUrl: 'https://verbumcarenomac-mini.local/api',
    connectionTimeout: 10000
  };
  
  console.log('📋 Server config:', serverConfig);
  
  // Simulate the exact URL construction from auth store
  const baseUrl = serverConfig.baseUrl.replace('/api', ''); // Remove /api suffix
  const loginUrl = `${baseUrl}/api/auth/login`;
  
  console.log('🌐 Constructed URLs:', {
    originalBaseUrl: serverConfig.baseUrl,
    processedBaseUrl: baseUrl,
    finalLoginUrl: loginUrl
  });
  
  // Test 1: Health check (what smart server selector does)
  console.log('\n📋 Test 1: Health Check (Smart Server Selector)');
  try {
    const healthUrl = `${baseUrl}/health`;
    console.log('🌐 Testing health URL:', healthUrl);
    
    const healthResponse = await axios.get(healthUrl, {
      timeout: serverConfig.connectionTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ja',
      }
    });
    
    console.log('✅ Health check successful:', {
      status: healthResponse.status,
      data: healthResponse.data
    });
  } catch (error) {
    console.error('❌ Health check failed:', {
      errorCode: error.code,
      errorMessage: error.message,
      httpStatus: error.response?.status
    });
  }
  
  // Test 2: Login request (what auth store does)
  console.log('\n📋 Test 2: Login Request (Auth Store)');
  try {
    console.log('🌐 Testing login URL:', loginUrl);
    
    const loginResponse = await axios.post(loginUrl, {
      username: 'demo',
      password: 'demo123',
      deviceInfo: {
        platform: 'ios',
        appVersion: '1.0.0',
      }
    }, {
      timeout: serverConfig.connectionTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ja',
      }
    });
    
    console.log('✅ Login successful:', {
      status: loginResponse.status,
      success: loginResponse.data.success,
      hasUser: !!loginResponse.data.data?.user
    });
  } catch (error) {
    console.error('❌ Login failed:', {
      errorCode: error.code,
      errorMessage: error.message,
      httpStatus: error.response?.status,
      isInstant: error.response === undefined && error.code !== 'ECONNABORTED'
    });
  }
  
  // Test 3: Direct axios instance (like API service)
  console.log('\n📋 Test 3: Axios Instance (API Service)');
  try {
    const client = axios.create({
      baseURL: serverConfig.baseUrl,
      timeout: serverConfig.connectionTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ja',
      }
    });
    
    console.log('🌐 Testing with axios instance, baseURL:', serverConfig.baseUrl);
    
    const instanceResponse = await client.post('/auth/login', {
      username: 'demo',
      password: 'demo123',
      deviceInfo: {
        platform: 'ios',
        appVersion: '1.0.0',
      }
    });
    
    console.log('✅ Axios instance successful:', {
      status: instanceResponse.status,
      success: instanceResponse.data.success
    });
  } catch (error) {
    console.error('❌ Axios instance failed:', {
      errorCode: error.code,
      errorMessage: error.message,
      httpStatus: error.response?.status,
      isInstant: error.response === undefined && error.code !== 'ECONNABORTED'
    });
  }
}

// Run the test
testIPadConfiguration().then(() => {
  console.log('\n🎯 Network debug test completed');
}).catch(error => {
  console.error('💥 Unexpected error:', error);
});