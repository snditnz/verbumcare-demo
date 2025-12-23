/**
 * Integration tests for server configuration and settings
 */

import { getDefaultServer, getServerById, AVAILABLE_SERVERS } from '../servers';
import { DEFAULT_PERSISTED_SETTINGS, validateSettingsConstants } from '../../constants/settings';
import { validatePersistedSettings } from '../../types/settings';

describe('Server Configuration Integration', () => {
  test('default persisted settings should reference valid server', () => {
    const defaultServer = getDefaultServer();
    const settingsServer = getServerById(DEFAULT_PERSISTED_SETTINGS.currentServerId);
    
    expect(settingsServer).toBeDefined();
    expect(settingsServer?.id).toBe(defaultServer.id);
  });

  test('all available servers should be accessible by ID', () => {
    AVAILABLE_SERVERS.forEach(server => {
      const retrievedServer = getServerById(server.id);
      expect(retrievedServer).toBeDefined();
      expect(retrievedServer?.id).toBe(server.id);
    });
  });

  test('settings constants should be valid', () => {
    const constantsValidation = validateSettingsConstants();
    expect(constantsValidation.valid).toBe(true);
  });

  test('default settings should be valid', () => {
    const settingsValidation = validatePersistedSettings(DEFAULT_PERSISTED_SETTINGS);
    expect(settingsValidation.valid).toBe(true);
  });

  test('server configuration should support both production servers', () => {
    const macMiniServer = getServerById('mac-mini');
    const pn51Server = getServerById('pn51');
    
    expect(macMiniServer).toBeDefined();
    expect(pn51Server).toBeDefined();
    
    // Mac Mini should be default (current production)
    expect(macMiniServer?.isDefault).toBe(true);
    expect(pn51Server?.isDefault).toBe(false);
    
    // Both should have HTTPS endpoints
    expect(macMiniServer?.baseUrl).toMatch(/^https:/);
    expect(pn51Server?.baseUrl).toMatch(/^https:/);
    
    // Both should have WSS endpoints
    expect(macMiniServer?.wsUrl).toMatch(/^wss:/);
    expect(pn51Server?.wsUrl).toMatch(/^wss:/);
  });

  test('server metadata should indicate production environment', () => {
    AVAILABLE_SERVERS.forEach(server => {
      expect(server.metadata?.environment).toBe('production');
      expect(server.metadata?.capabilities).toContain('ai-services');
      expect(server.metadata?.capabilities).toContain('offline-processing');
    });
  });
});