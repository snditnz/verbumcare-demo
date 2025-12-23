#!/usr/bin/env node

/**
 * Development Proxy Server
 * 
 * This proxy forwards requests from localhost to mDNS hostnames
 * to solve the mDNS resolution issue in Expo development environment.
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  credentials: true
}));

// Proxy configuration - Updated to use correct Mac Mini hostname from user correction
const BACKEND_URL = 'https://verbumcarenomac-mini.local';
const FALLBACK_URL = 'https://verbumcare-lab.local';

console.log(`🚀 Starting development proxy server...`);
console.log(`📡 Primary backend: ${BACKEND_URL}`);
console.log(`🔄 Fallback backend: ${FALLBACK_URL}`);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    proxy: 'development',
    timestamp: new Date().toISOString(),
    backend: BACKEND_URL
  });
});

// Create proxy middleware with fallback
const proxyOptions = {
  target: BACKEND_URL,
  changeOrigin: true,
  secure: false, // Accept self-signed certificates
  timeout: 10000,
  proxyTimeout: 10000,
  onError: (err, req, res) => {
    console.error(`❌ Proxy error: ${err.message}`);
    console.log(`🔄 Attempting fallback to ${FALLBACK_URL}...`);
    
    // Try fallback server
    const fallbackProxy = createProxyMiddleware({
      target: FALLBACK_URL,
      changeOrigin: true,
      secure: false,
      timeout: 5000,
      onError: (fallbackErr, req, res) => {
        console.error(`❌ Fallback also failed: ${fallbackErr.message}`);
        res.status(503).json({
          error: 'Backend servers unavailable',
          primary: err.message,
          fallback: fallbackErr.message
        });
      }
    });
    
    fallbackProxy(req, res);
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`📤 ${req.method} ${req.url} -> ${BACKEND_URL}${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`📥 ${req.method} ${req.url} <- ${proxyRes.statusCode}`);
  }
};

// Apply proxy to all API routes
console.log('🔧 Setting up proxy middleware for /api routes...');
app.use('/api', (req, res, next) => {
  console.log(`📥 Received request: ${req.method} ${req.url}`);
  next();
}, createProxyMiddleware({
  ...proxyOptions,
  // Don't rewrite the path - keep /api prefix
}));

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Development proxy server running on http://localhost:${PORT}`);
  console.log(`🔗 API endpoints available at http://localhost:${PORT}/api/*`);
  console.log(`💡 Configure your app to use: http://localhost:${PORT}/api`);
  console.log(`\n📋 Test the proxy:`);
  console.log(`   curl http://localhost:${PORT}/health`);
  console.log(`   curl http://localhost:${PORT}/api/health`);
});