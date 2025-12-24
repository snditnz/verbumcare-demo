/**
 * Server Configuration for Backend Switching
 * 
 * This file defines the available backend servers for the VerbumCare application.
 * Users can switch between these servers through the settings screen.
 */

export interface ServerConfig {
  id: string;                    // Unique identifier (e.g., 'mac-mini', 'pn51')
  name: string;                  // Internal name
  displayName: string;           // User-friendly name
  baseUrl: string;              // API base URL
  wsUrl: string;                // WebSocket URL
  description: string;          // User description
  isDefault: boolean;           // Default server flag
  healthCheckEndpoints: string[]; // Endpoints to test
  connectionTimeout: number;     // Connection timeout (ms)
  retryAttempts: number;        // Retry attempts for connectivity
  metadata?: {                  // Optional metadata
    region?: string;
    environment?: 'production' | 'staging' | 'development';
    capabilities?: string[];
  };
}

/**
 * Available Backend Servers
 */
export const AVAILABLE_SERVERS: ServerConfig[] = [
  {
    id: 'localhost-dev',
    name: 'localhost',
    displayName: 'Development Proxy',
    baseUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3001',
    description: 'Development proxy server for mDNS resolution (forwards to Mac Mini)',
    isDefault: false, // Remove default from localhost
    healthCheckEndpoints: ['/health', '/api/patients', '/api/auth/login'],
    connectionTimeout: 5000, // 5 seconds for local
    retryAttempts: 2,
    metadata: {
      region: 'local',
      environment: 'development',
      capabilities: ['proxy', 'development']
    }
  },
  {
    id: 'mac-mini',
    name: 'verbumcarenomac-mini.local',
    displayName: 'Mac Mini (Production)',
    baseUrl: 'https://verbumcarenomac-mini.local/api',
    wsUrl: 'wss://verbumcarenomac-mini.local',
    description: 'Current production server running on Mac Mini with Apple Silicon optimization',
    isDefault: true, // Make Mac Mini the default since it's the current production server
    healthCheckEndpoints: ['/health'], // Health endpoint is at root level, not under /api
    connectionTimeout: 10000, // Reduce to 10 seconds for faster testing
    retryAttempts: 3, // Reduce retries for faster testing
    metadata: {
      region: 'local',
      environment: 'production',
      capabilities: ['ai-services', 'offline-processing', 'metal-gpu']
    }
  },
  {
    id: 'pn51',
    name: 'verbumcare-lab.local',
    displayName: 'pn51 Legacy Server',
    baseUrl: 'https://verbumcare-lab.local/api',
    wsUrl: 'wss://verbumcare-lab.local',
    description: 'Legacy production server available for rollback and testing',
    isDefault: false, // Remove default from pn51 since Mac Mini is now production
    healthCheckEndpoints: ['/health'], // Health endpoint is at root level, not under /api
    connectionTimeout: 10000, // Reduce timeout for faster testing
    retryAttempts: 3, // Reduce retries for faster testing
    metadata: {
      region: 'local',
      environment: 'production',
      capabilities: ['ai-services', 'offline-processing']
    }
  },
  {
    id: 'mac-mini-tailscale',
    name: 'verbumcaremac-mini.tail609750.ts.net',
    displayName: 'Mac Mini Tailscale',
    baseUrl: 'https://verbumcaremac-mini.tail609750.ts.net/api',
    wsUrl: 'wss://verbumcaremac-mini.tail609750.ts.net',
    description: 'Mac Mini accessible via Tailscale VPN (verbumcaremac-mini.tail609750.ts.net)',
    isDefault: false,
    healthCheckEndpoints: ['/health', '/api/patients', '/api/auth/login'],
    connectionTimeout: 25000, // 25 seconds - Tailscale may have additional latency
    retryAttempts: 5, // Increased retries for mDNS issues
    metadata: {
      region: 'local',
      environment: 'production',
      capabilities: ['ai-services', 'offline-processing', 'metal-gpu', 'tailscale']
    }
  }
];

/**
 * Get server configuration by ID
 */
export function getServerById(serverId: string): ServerConfig | undefined {
  return AVAILABLE_SERVERS.find(server => server.id === serverId);
}

/**
 * Get default server configuration
 */
export function getDefaultServer(): ServerConfig {
  const defaultServer = AVAILABLE_SERVERS.find(server => server.isDefault);
  if (!defaultServer) {
    throw new Error('No default server configured');
  }
  return defaultServer;
}

/**
 * Validate server configuration
 */
export function validateServerConfig(config: ServerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.id || config.id.trim() === '') {
    errors.push('Server ID is required');
  }

  if (!config.name || config.name.trim() === '') {
    errors.push('Server name is required');
  }

  if (!config.displayName || config.displayName.trim() === '') {
    errors.push('Display name is required');
  }

  if (!config.baseUrl || config.baseUrl.trim() === '') {
    errors.push('Base URL is required');
  } else {
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push('Base URL must be a valid URL');
    }
  }

  if (!config.wsUrl || config.wsUrl.trim() === '') {
    errors.push('WebSocket URL is required');
  } else {
    try {
      new URL(config.wsUrl);
    } catch {
      errors.push('WebSocket URL must be a valid URL');
    }
  }

  if (!config.healthCheckEndpoints || config.healthCheckEndpoints.length === 0) {
    errors.push('At least one health check endpoint is required');
  }

  if (config.connectionTimeout <= 0) {
    errors.push('Connection timeout must be positive');
  }

  if (config.retryAttempts < 0) {
    errors.push('Retry attempts cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}