#!/usr/bin/env node

/**
 * Debug script to test what URL the app configuration returns
 */

// Simulate the app's server configuration
const AVAILABLE_SERVERS = [
  {
    id: 'localhost-dev',
    name: 'localhost',
    displayName: 'Development Proxy',
    baseUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3001',
    description: 'Development proxy server for mDNS resolution (forwards to Mac Mini)',
    isDefault: true,
    healthCheckEndpoints: ['/health', '/api/patients', '/api/auth/login'],
    connectionTimeout: 5000,
    retryAttempts: 2,
    metadata: {
      region: 'local',
      environment: 'development',
      capabilities: ['proxy', 'development']
    }
  },
  {
    id: 'mac-mini',
    name: 'verbumcaremac-mini',
    displayName: 'Mac Mini (Production)',
    baseUrl: 'https://verbumcaremac-mini/api',
    wsUrl: 'wss://verbumcaremac-mini',
    description: 'Current production server running on Mac Mini with Apple Silicon optimization',
    isDefault: false,
    healthCheckEndpoints: ['/health', '/api/patients', '/api/auth/login'],
    connectionTimeout: 15000,
    retryAttempts: 5,
    metadata: {
      region: 'local',
      environment: 'production',
      capabilities: ['ai-services', 'offline-processing', 'metal-gpu']
    }
  }
];

function getDefaultServer() {
  const defaultServer = AVAILABLE_SERVERS.find(server => server.isDefault);
  if (!defaultServer) {
    throw new Error('No default server configured');
  }
  return defaultServer;
}

console.log('🔍 Debug: Server Configuration Test');
console.log('=====================================');

const defaultServer = getDefaultServer();
console.log(`✅ Default server: ${defaultServer.displayName}`);
console.log(`📡 Base URL: ${defaultServer.baseUrl}`);
console.log(`🔌 WebSocket URL: ${defaultServer.wsUrl}`);
console.log(`🏷️  Server ID: ${defaultServer.id}`);

console.log('\n🧪 Testing proxy connection...');

console.log('Run these commands to test:');
console.log('curl http://localhost:3000/health');
console.log('curl http://localhost:3000/api/health');