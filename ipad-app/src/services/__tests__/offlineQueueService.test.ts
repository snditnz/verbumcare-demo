/**
 * Offline Queue Service Tests
 * 
 * Tests for offline mode handling and queue management functionality.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineQueueService } from '../offlineQueueService';
import { networkService } from '../networkService';
import { getDefaultServer } from '../../config/servers';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock network service
jest.mock('../networkService', () => ({
  networkService: {
    isConnected: jest.fn(),
    onReconnection: jest.fn(),
    offReconnection: jest.fn(),
  },
}));

// Mock settings store to avoid circular dependency
const mockSwitchServer = jest.fn().mockResolvedValue(true);
const mockSetLanguage = jest.fn().mockResolvedValue(undefined);
const mockUpdatePreferences = jest.fn().mockResolvedValue(undefined);
const mockTestServerConnectivity = jest.fn().mockResolvedValue({ status: 'connected' });

jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      switchServer: mockSwitchServer,
      setLanguage: mockSetLanguage,
      updatePreferences: mockUpdatePreferences,
      testServerConnectivity: mockTestServerConnectivity,
    }),
  },
}));

describe('OfflineQueueService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSwitchServer.mockClear().mockResolvedValue(true);
    mockSetLanguage.mockClear().mockResolvedValue(undefined);
    mockUpdatePreferences.mockClear().mockResolvedValue(undefined);
    mockTestServerConnectivity.mockClear().mockResolvedValue({ status: 'connected' });
    
    // Ensure the mock is available for dynamic imports
    jest.doMock('../../stores/settingsStore', () => ({
      useSettingsStore: {
        getState: () => ({
          switchServer: mockSwitchServer,
          setLanguage: mockSetLanguage,
          updatePreferences: mockUpdatePreferences,
          testServerConnectivity: mockTestServerConnectivity,
        }),
      },
    }));
    
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (networkService.isConnected as jest.Mock).mockReturnValue(true);
    
    // Clear the queue before each test
    await offlineQueueService.clearQueue();
  });

  describe('Server Configuration Preservation', () => {
    it('should preserve server configuration when going offline', async () => {
      const server = getDefaultServer();
      
      await offlineQueueService.preserveServerConfiguration(server);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'verbumcare_offline_server_config',
        expect.stringContaining(server.id)
      );
    });

    it('should retrieve last known server configuration', async () => {
      const server = getDefaultServer();
      await offlineQueueService.preserveServerConfiguration(server);
      
      const lastKnown = offlineQueueService.getLastKnownServerConfig();
      
      expect(lastKnown).toBeTruthy();
      expect(lastKnown?.serverId).toBe(server.id);
    });
  });

  describe('Queue Management', () => {
    it('should queue server switch operations', async () => {
      const operationId = await offlineQueueService.queueServerSwitch(
        'mac-mini',
        'pn51',
        {
          preserveUserData: true,
          enableFallback: true,
          userInitiated: true,
        }
      );
      
      expect(operationId).toBeTruthy();
      expect(typeof operationId).toBe('string');
      
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBe(1);
      expect(status.operationsByType.server_switch).toBe(1);
    });

    it('should queue language change operations', async () => {
      const operationId = await offlineQueueService.queueLanguageChange('en');
      
      expect(operationId).toBeTruthy();
      
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBe(1);
      expect(status.operationsByType.language_change).toBe(1);
    });

    it('should queue settings update operations', async () => {
      const preferences = { autoSwitchOnFailure: true };
      const operationId = await offlineQueueService.queueSettingsUpdate(preferences);
      
      expect(operationId).toBeTruthy();
      
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBe(1);
      expect(status.operationsByType.settings_update).toBe(1);
    });

    it('should prevent duplicate operations', async () => {
      // Queue the same server switch twice
      await offlineQueueService.queueServerSwitch('mac-mini', 'pn51');
      await offlineQueueService.queueServerSwitch('mac-mini', 'pn51');
      
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBe(1); // Should only have one operation
    });

    it('should maintain queue size limit', async () => {
      // Queue more than the maximum allowed operations
      const promises = [];
      for (let i = 0; i < 105; i++) {
        promises.push(offlineQueueService.queueConnectivityTest(`server-${i}`));
      }
      
      await Promise.all(promises);
      
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBeLessThanOrEqual(100); // Should respect max queue size
    });
  });

  describe('Queue Processing', () => {
    it('should process queued operations successfully', async () => {
      // Queue some operations
      await offlineQueueService.queueServerSwitch('mac-mini', 'pn51');
      await offlineQueueService.queueLanguageChange('en');
      
      const result = await offlineQueueService.processQueue();
      
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      
      // Queue should be empty after successful processing
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBe(0);
    });

    it('should handle failed operations with retry logic', async () => {
      // Modify the existing mock to return false (simulate failure)
      mockSwitchServer.mockResolvedValue(false);
      
      await offlineQueueService.queueServerSwitch('mac-mini', 'invalid-server', { maxRetries: 1 });
      
      const result = await offlineQueueService.processQueue();
      
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
      
      // Reset the mock back to success for other tests
      mockSwitchServer.mockResolvedValue(true);
    });
  });

  describe('Offline Functionality', () => {
    it('should report offline functionality availability', () => {
      const server = getDefaultServer();
      offlineQueueService.preserveServerConfiguration(server);
      
      const isAvailable = offlineQueueService.isOfflineFunctionalityAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should report offline editing availability', () => {
      const server = getDefaultServer();
      offlineQueueService.preserveServerConfiguration(server);
      
      const isAvailable = offlineQueueService.isOfflineEditingAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('Queue Status and Management', () => {
    it('should provide accurate queue status', async () => {
      await offlineQueueService.queueServerSwitch('mac-mini', 'pn51');
      await offlineQueueService.queueLanguageChange('en');
      
      const status = offlineQueueService.getQueueStatus();
      
      expect(status.queueLength).toBe(2);
      expect(status.isProcessing).toBe(false);
      expect(status.operationsByType.server_switch).toBe(1);
      expect(status.operationsByType.language_change).toBe(1);
      expect(status.oldestOperation).toBeInstanceOf(Date);
      expect(status.newestOperation).toBeInstanceOf(Date);
    });

    it('should clear queue when requested', async () => {
      await offlineQueueService.queueServerSwitch('mac-mini', 'pn51');
      await offlineQueueService.queueLanguageChange('en');
      
      await offlineQueueService.clearQueue();
      
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBe(0);
    });

    it('should remove specific operations', async () => {
      const operationId = await offlineQueueService.queueServerSwitch('mac-mini', 'pn51');
      await offlineQueueService.queueLanguageChange('en');
      
      const removed = await offlineQueueService.removeOperation(operationId);
      
      expect(removed).toBe(true);
      
      const status = offlineQueueService.getQueueStatus();
      expect(status.queueLength).toBe(1);
      expect(status.operationsByType.server_switch).toBe(0);
      expect(status.operationsByType.language_change).toBe(1);
    });
  });
});