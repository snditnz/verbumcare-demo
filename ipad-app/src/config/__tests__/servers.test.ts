/**
 * Tests for server configuration
 */

import { 
  AVAILABLE_SERVERS, 
  getServerById, 
  getDefaultServer, 
  validateServerConfig,
  ServerConfig 
} from '../servers';

describe('Server Configuration', () => {
  test('should have at least two servers configured', () => {
    expect(AVAILABLE_SERVERS.length).toBeGreaterThanOrEqual(2);
  });

  test('should have exactly one default server', () => {
    const defaultServers = AVAILABLE_SERVERS.filter(server => server.isDefault);
    expect(defaultServers.length).toBe(1);
  });

  test('should have Mac Mini as default server', () => {
    const defaultServer = getDefaultServer();
    expect(defaultServer.id).toBe('mac-mini');
    expect(defaultServer.isDefault).toBe(true);
  });

  test('should have pn51 legacy server configured', () => {
    const pn51Server = getServerById('pn51');
    expect(pn51Server).toBeDefined();
    expect(pn51Server?.name).toBe('verbumcare-lab.local');
    expect(pn51Server?.isDefault).toBe(false);
  });

  test('should return undefined for non-existent server', () => {
    const nonExistentServer = getServerById('non-existent');
    expect(nonExistentServer).toBeUndefined();
  });

  test('should validate valid server configuration', () => {
    const validConfig: ServerConfig = {
      id: 'test-server',
      name: 'test.local',
      displayName: 'Test Server',
      baseUrl: 'https://test.local/api',
      wsUrl: 'wss://test.local',
      description: 'Test server for validation',
      isDefault: false,
      healthCheckEndpoints: ['/health'],
      connectionTimeout: 5000,
      retryAttempts: 2
    };

    const result = validateServerConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject invalid server configuration', () => {
    const invalidConfig: ServerConfig = {
      id: '',
      name: '',
      displayName: '',
      baseUrl: 'invalid-url',
      wsUrl: 'invalid-ws-url',
      description: '',
      isDefault: false,
      healthCheckEndpoints: [],
      connectionTimeout: -1,
      retryAttempts: -1
    };

    const result = validateServerConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('all configured servers should be valid', () => {
    AVAILABLE_SERVERS.forEach(server => {
      const result = validateServerConfig(server);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('all servers should have unique IDs', () => {
    const ids = AVAILABLE_SERVERS.map(server => server.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('all servers should have required health check endpoints', () => {
    AVAILABLE_SERVERS.forEach(server => {
      expect(server.healthCheckEndpoints).toContain('/health');
      expect(server.healthCheckEndpoints.length).toBeGreaterThan(0);
    });
  });

  test('all servers should have valid URLs', () => {
    AVAILABLE_SERVERS.forEach(server => {
      expect(() => new URL(server.baseUrl)).not.toThrow();
      expect(() => new URL(server.wsUrl)).not.toThrow();
    });
  });
});