#!/usr/bin/env node

/**
 * Direct login test to isolate the network error issue
 * This bypasses the iPad app's complex API service and tests login directly
 */

const axios = require('axios');
const https = require('https');

// Create axios instance similar to iPad app
const client = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'ja',
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // For self-signed cert
  }),
});

// Add request interceptor (similar to iPad app)
client.interceptors.request.use(
  (config) => {
    console.log('🌐 [REQUEST]', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
      timeout: config.timeout,
      headers: {
        'Content-Type': config.headers['Content-Type'],
        'Accept-Language': config.headers['Accept-Language'],
      }
    });
    return config;
  },
  (error) => {
    console.error('🚨 [REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

// Add response interceptor (similar to iPad app)
client.interceptors.response.use(
  (response) => {
    console.log('✅ [RESPONSE SUCCESS]', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      fullURL: response.config.baseURL ? `${response.config.baseURL}${response.config.url}` : response.config.url,
      status: response.status,
      statusText: response.statusText,
      dataSize: JSON.stringify(response.data).length + ' bytes',
      dataPreview: JSON.stringify(response.data).substring(0, 200) + '...'
    });
    return response;
  },
  (error) => {
    console.error('❌ [RESPONSE ERROR]', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      fullURL: error.config ? (error.config.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config.url) : 'unknown',
      errorCode: error.code,
      errorMessage: error.message,
      httpStatus: error.response?.status,
      httpStatusText: error.response?.statusText,
      responseData: error.response?.data,
      timeout: error.config?.timeout,
      isNetworkError: !error.response,
      isTimeoutError: error.code === 'ECONNABORTED',
      isServerError: error.response?.status >= 500,
      isClientError: error.response?.status >= 400 && error.response?.status < 500
    });
    return Promise.reject(error);
  }
);

async function testLogin() {
  console.log('🔐 Starting direct login test...');
  
  try {
    const loginUrl = 'https://verbumcarenomac-mini.local/api/auth/login';
    const payload = {
      username: 'demo',
      password: 'demo123',
      deviceInfo: {
        platform: 'ios',
        appVersion: '1.0.0',
      }
    };
    
    console.log('🌐 Making login request:', {
      loginUrl,
      payload: {
        username: payload.username,
        hasPassword: !!payload.password,
        deviceInfo: payload.deviceInfo
      }
    });
    
    const response = await client.post(loginUrl, payload);
    
    console.log('✅ Login response received:', {
      status: response.status,
      statusText: response.statusText,
      success: response.data.success,
      hasUserData: !!response.data.data?.user,
      hasTokens: !!(response.data.data?.accessToken && response.data.data?.refreshToken)
    });
    
    if (!response.data.success) {
      console.error('❌ Login failed - server returned success: false');
      return false;
    }
    
    const { user, accessToken, refreshToken, expiresIn } = response.data.data;
    
    console.log('👤 User data received:', {
      userId: user.userId,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      facilityId: user.facilityId,
      tokenExpiresIn: expiresIn + 's'
    });
    
    console.log('🎉 LOGIN TEST SUCCESSFUL!');
    return true;
    
  } catch (error) {
    console.error('❌ Login test failed:', {
      errorCode: error.code,
      errorMessage: error.message,
      httpStatus: error.response?.status,
      httpStatusText: error.response?.statusText,
      responseData: error.response?.data,
      isNetworkError: !error.response,
      isTimeoutError: error.code === 'ECONNABORTED',
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      requestTimeout: error.config?.timeout
    });
    
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Login timed out - server may be slow or unreachable');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused - server may be down');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🔍 Host not found - check server hostname');
    } else if (!error.response) {
      console.error('🌐 Network error - no response received');
    }
    
    return false;
  }
}

// Run the test
testLogin().then(success => {
  console.log(`\n🎯 Test result: ${success ? 'SUCCESS' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});