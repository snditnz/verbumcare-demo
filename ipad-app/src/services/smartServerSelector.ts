/**
 * Smart Server Selector Service
 * 
 * Intelligently selects the best available server when no user preference exists.
 * Tests servers in priority order and caches successful selections.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServerConfig, getServerById, AVAILABLE_SERVERS } from '../config/servers';
import { networkService } from './networkService';

export interface ServerTestResult {
  serverId: string;
  success: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export interface ServerSelectionResult {
  selectedServer: ServerConfig;
  testResults: ServerTestResult[];
  selectionReason: string;
  cached: boolean;
}

export interface SmartServerSelectorConfig {
  testOrder: string[];           // Order to test servers
  timeoutPerServer: number;      // Max time to test each server
  maxConcurrentTests: number;    // Parallel testing limit
  cacheExpiryMs: number;        // Cache expiry time
  fallbackServerId: string;     // Last resort server
}

const SMART_SELECTOR_CONFIG: SmartServerSelectorConfig = {
  testOrder: ['mac-mini', 'pn51', 'localhost-dev', 'mac-mini-tailscale'],
  timeoutPerServer: 5000,        // 5 seconds per server
  maxConcurrentTests: 2,         // Test 2 servers at once
  cacheExpiryMs: 5 * 60 * 1000, // 5 minutes cache
  fallbackServerId: 'mac-mini'   // Mac Mini as fallback
};

const CACHE_KEY = 'smart_server_selection_cache';

interface CachedSelection {
  serverId: string;
  timestamp: number;
  testResults: ServerTestResult[];
}

class SmartServerSelector {
  private config: SmartServerSelectorConfig;

  constructor(config: SmartServerSelectorConfig = SMART_SELECTOR_CONFIG) {
    this.config = config;
  }

  /**
   * Test connectivity to a specific server
   */
  async testServerConnectivity(serverId: string): Promise<ServerTestResult> {
    const server = getServerById(serverId);
    const startTime = Date.now();

    console.log(`🔍 [SMART SELECTOR] Testing server: ${serverId}`);

    if (!server) {
      console.error(`❌ [SMART SELECTOR] Server not found: ${serverId}`);
      return {
        serverId,
        success: false,
        responseTime: 0,
        error: `Server not found: ${serverId}`,
        timestamp: new Date()
      };
    }

    console.log(`📋 [SMART SELECTOR] Server config:`, {
      id: server.id,
      displayName: server.displayName,
      baseUrl: server.baseUrl,
      timeout: this.config.timeoutPerServer
    });

    try {
      // Test the health endpoint with timeout
      // Health endpoint is at root level, not under /api
      const baseUrlWithoutApi = server.baseUrl.replace('/api', '');
      const healthUrl = `${baseUrlWithoutApi}/health`;
      
      console.log(`🌐 [SMART SELECTOR] Testing health URL: ${healthUrl}`);
      console.log(`⏱️ [SMART SELECTOR] Timeout: ${this.config.timeoutPerServer}ms`);
      
      const response = await axios.get(healthUrl, {
        timeout: this.config.timeoutPerServer,
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'ja',
        },
        // Note: httpsAgent not supported in React Native
      });

      const responseTime = Date.now() - startTime;
      
      console.log(`✅ [SMART SELECTOR] Success for ${serverId}:`, {
        status: response.status,
        responseTime: responseTime + 'ms',
        dataReceived: JSON.stringify(response.data)
      });

      return {
        serverId,
        success: response.status === 200,
        responseTime,
        timestamp: new Date()
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      console.error(`❌ [SMART SELECTOR] Failed for ${serverId}:`, {
        errorCode: error.code,
        errorMessage: error.message,
        responseTime: responseTime + 'ms',
        httpStatus: error.response?.status,
        httpStatusText: error.response?.statusText
      });

      return {
        serverId,
        success: false,
        responseTime,
        error: error.message || 'Connection failed',
        timestamp: new Date()
      };
    }
  }

  /**
   * Test multiple servers concurrently with limit
   */
  private async testServersInBatches(serverIds: string[]): Promise<ServerTestResult[]> {
    const results: ServerTestResult[] = [];
    const { maxConcurrentTests } = this.config;

    for (let i = 0; i < serverIds.length; i += maxConcurrentTests) {
      const batch = serverIds.slice(i, i + maxConcurrentTests);
      const batchPromises = batch.map(serverId => this.testServerConnectivity(serverId));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // If we found a working server, we can stop testing
        const workingServer = batchResults.find(result => result.success);
        if (workingServer) {
          console.log(`[SmartServerSelector] Found working server: ${workingServer.serverId}, stopping tests`);
          break;
        }
      } catch (error) {
        console.warn('[SmartServerSelector] Batch testing failed:', error);
      }
    }

    return results;
  }

  /**
   * Get cached server selection if still valid
   */
  private async getCachedSelection(): Promise<ServerConfig | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cachedSelection: CachedSelection = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - cachedSelection.timestamp > this.config.cacheExpiryMs) {
        console.log('[SmartServerSelector] Cache expired, will perform fresh selection');
        return null;
      }

      const server = getServerById(cachedSelection.serverId);
      if (!server) {
        console.log('[SmartServerSelector] Cached server no longer exists');
        return null;
      }

      console.log(`[SmartServerSelector] Using cached server: ${server.displayName}`);
      return server;
    } catch (error) {
      console.warn('[SmartServerSelector] Failed to read cache:', error);
      return null;
    }
  }

  /**
   * Cache successful server selection
   */
  private async cacheSelection(serverId: string, testResults: ServerTestResult[]): Promise<void> {
    try {
      const cacheData: CachedSelection = {
        serverId,
        timestamp: Date.now(),
        testResults
      };

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log(`[SmartServerSelector] Cached selection: ${serverId}`);
    } catch (error) {
      console.warn('[SmartServerSelector] Failed to cache selection:', error);
    }
  }

  /**
   * Select the best available server
   */
  async selectBestServer(candidateIds?: string[]): Promise<ServerSelectionResult> {
    console.log('[SmartServerSelector] Starting smart server selection...');

    // Check if we're offline
    if (!networkService.isConnected()) {
      const cachedServer = await this.getCachedSelection();
      if (cachedServer) {
        return {
          selectedServer: cachedServer,
          testResults: [],
          selectionReason: 'Using cached server (offline)',
          cached: true
        };
      }

      // Offline with no cache - use fallback
      const fallbackServer = getServerById(this.config.fallbackServerId);
      if (!fallbackServer) {
        throw new Error('No fallback server available and offline');
      }

      return {
        selectedServer: fallbackServer,
        testResults: [],
        selectionReason: 'Using fallback server (offline, no cache)',
        cached: false
      };
    }

    // Check cache first (online)
    const cachedServer = await this.getCachedSelection();
    if (cachedServer) {
      // Verify cached server is still working
      const testResult = await this.testServerConnectivity(cachedServer.id);
      if (testResult.success) {
        return {
          selectedServer: cachedServer,
          testResults: [testResult],
          selectionReason: 'Using cached server (verified working)',
          cached: true
        };
      } else {
        console.log(`[SmartServerSelector] Cached server ${cachedServer.id} is no longer working`);
      }
    }

    // Perform fresh server selection
    const testCandidates = candidateIds || this.config.testOrder;
    console.log(`[SmartServerSelector] Testing servers in order: ${testCandidates.join(', ')}`);

    const testResults = await this.testServersInBatches(testCandidates);
    
    // Find first working server
    const workingResult = testResults.find(result => result.success);
    
    if (workingResult) {
      const selectedServer = getServerById(workingResult.serverId);
      if (!selectedServer) {
        throw new Error(`Selected server ${workingResult.serverId} not found in configuration`);
      }

      // Cache the successful selection
      await this.cacheSelection(workingResult.serverId, testResults);

      return {
        selectedServer,
        testResults,
        selectionReason: `Auto-selected first working server (${workingResult.responseTime}ms response)`,
        cached: false
      };
    }

    // No working servers found - use fallback
    console.warn('[SmartServerSelector] No working servers found, using fallback');
    const fallbackServer = getServerById(this.config.fallbackServerId);
    
    if (!fallbackServer) {
      throw new Error('No working servers found and no fallback available');
    }

    return {
      selectedServer: fallbackServer,
      testResults,
      selectionReason: 'No working servers found, using fallback',
      cached: false
    };
  }

  /**
   * Clear cached selection (force fresh selection next time)
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      console.log('[SmartServerSelector] Cache cleared');
    } catch (error) {
      console.warn('[SmartServerSelector] Failed to clear cache:', error);
    }
  }

  /**
   * Get current cache status
   */
  async getCacheStatus(): Promise<{
    hasCachedSelection: boolean;
    cachedServerId?: string;
    cacheAge?: number;
    isExpired?: boolean;
  }> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) {
        return { hasCachedSelection: false };
      }

      const cachedSelection: CachedSelection = JSON.parse(cached);
      const now = Date.now();
      const cacheAge = now - cachedSelection.timestamp;
      const isExpired = cacheAge > this.config.cacheExpiryMs;

      return {
        hasCachedSelection: true,
        cachedServerId: cachedSelection.serverId,
        cacheAge,
        isExpired
      };
    } catch (error) {
      console.warn('[SmartServerSelector] Failed to get cache status:', error);
      return { hasCachedSelection: false };
    }
  }
}

// Export singleton instance
export const smartServerSelector = new SmartServerSelector();

// Export class for testing
export { SmartServerSelector };