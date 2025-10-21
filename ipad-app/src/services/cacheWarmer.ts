/**
 * Cache Warmer Service
 *
 * Pre-fetches all necessary data for offline operation
 * Stores encrypted data per user account
 */

import { SecureCache, createSecureCache } from './secureCache';
import { apiService } from './api';
import { Patient } from '@models';

export interface WarmCacheResult {
  success: boolean;
  recordCounts?: {
    patients: number;
    carePlans: number;
    medications: number;
    vitals: number;
    templates: number;
    staff: number;
  };
  timestamp?: string;
  error?: string;
}

/**
 * Fetch and cache all data for offline operation
 */
export async function warmAllCaches(userId: string): Promise<WarmCacheResult> {
  try {
    console.log('[CacheWarmer] Starting cache warming for user:', userId);

    // Create secure cache for this user
    const cache = createSecureCache(userId);

    // Fetch all data from API
    // Note: Currently using individual endpoints since prefetch/all doesn't exist yet
    const [patients, carePlans, problemTemplates] = await Promise.all([
      fetchPatients(),
      fetchCarePlans(),
      fetchProblemTemplates(),
    ]);

    // Store encrypted data
    await cache.setMultiple([
      ['patients', patients],
      ['carePlans', carePlans],
      ['problemTemplates', problemTemplates],
    ]);

    // Update metadata
    const recordCounts = {
      patients: patients.length,
      carePlans: carePlans.length,
      medications: 0, // TODO: Add when endpoint exists
      vitals: 0, // TODO: Add when endpoint exists
      templates: problemTemplates.length,
      staff: 0, // TODO: Add when endpoint exists
    };

    await cache.setMetadata({
      lastSync: new Date().toISOString(),
      version: 1,
      recordCounts,
    });

    console.log('[CacheWarmer] ✅ Cache warming complete:', recordCounts);

    return {
      success: true,
      recordCounts,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('[CacheWarmer] ❌ Cache warming failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Fetch patients from API
 */
async function fetchPatients(): Promise<Patient[]> {
  try {
    // Use API service without cache to get fresh data
    const patients = await apiService.getPatients(false);
    console.log(`[CacheWarmer] Fetched ${patients.length} patients`);
    return patients;
  } catch (error) {
    console.warn('[CacheWarmer] Failed to fetch patients, using empty array');
    return [];
  }
}

/**
 * Fetch care plans from API
 */
async function fetchCarePlans(): Promise<any[]> {
  try {
    // TODO: Implement when care plans API is available
    // For now, return empty array
    console.log('[CacheWarmer] Care plans fetch not implemented yet');
    return [];
  } catch (error) {
    console.warn('[CacheWarmer] Failed to fetch care plans');
    return [];
  }
}

/**
 * Fetch problem templates from API
 */
async function fetchProblemTemplates(): Promise<any[]> {
  try {
    const templates = await apiService.getProblemTemplates();
    console.log(`[CacheWarmer] Fetched ${templates.length} problem templates`);
    return templates;
  } catch (error) {
    console.warn('[CacheWarmer] Failed to fetch problem templates');
    return [];
  }
}

/**
 * Get cached data for offline use
 */
export async function getCachedData<T>(userId: string, key: string): Promise<T | null> {
  try {
    const cache = createSecureCache(userId);
    return await cache.get<T>(key);
  } catch (error) {
    console.error(`[CacheWarmer] Error getting cached ${key}:`, error);
    return null;
  }
}

/**
 * Check if user has cached data
 */
export async function hasCachedData(userId: string): Promise<boolean> {
  try {
    const cache = createSecureCache(userId);
    const metadata = await cache.getMetadata();
    return !!metadata?.lastSync;
  } catch (error) {
    return false;
  }
}

/**
 * Get cache statistics for UI display
 */
export async function getCacheStats(userId: string) {
  try {
    const cache = createSecureCache(userId);
    return await cache.getStats();
  } catch (error) {
    console.error('[CacheWarmer] Error getting cache stats:', error);
    return null;
  }
}

/**
 * Clear cached data for user (e.g., on logout)
 */
export async function clearUserCache(userId: string): Promise<void> {
  try {
    const cache = createSecureCache(userId);
    await cache.clear();
    console.log('[CacheWarmer] Cache cleared for user:', userId);
  } catch (error) {
    console.error('[CacheWarmer] Error clearing cache:', error);
  }
}
