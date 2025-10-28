/**
 * Cache Warmer Service
 *
 * Pre-fetches all necessary data for offline operation
 * Stores encrypted data per user account
 */

import { SecureCache, createSecureCache } from './secureCache';
import { apiService } from './api';
import { cacheService } from './cacheService';
import { Patient } from '@models';
import { DEMO_STAFF_ID } from '@constants/config';

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
export async function clearUserCache(userId?: string): Promise<void> {
  try {
    if (userId) {
      const cache = createSecureCache(userId);
      await cache.clear();
      console.log('[CacheWarmer] Cache cleared for user:', userId);
    }
  } catch (error) {
    console.error('[CacheWarmer] Error clearing cache:', error);
  }
}

/**
 * Warm schedule caches for all patients
 * This ensures offline schedule display for the demo
 */
export async function warmScheduleCaches(staffId: string = DEMO_STAFF_ID): Promise<{
  success: boolean;
  patientsWarmed: number;
  staffScheduleWarmed: boolean;
  errors: string[];
}> {
  console.log('🔥 [CacheWarmer] Starting schedule cache warming...');

  const errors: string[] = [];
  let patientsWarmed = 0;
  let staffScheduleWarmed = false;

  try {
    // First, get all patients (force fresh fetch)
    const patients = await apiService.getPatients(false);
    console.log(`[CacheWarmer] Found ${patients.length} patients to warm schedules for`);

    // Cache patients list first
    await cacheService.cachePatients(patients);
    console.log('✅ [CacheWarmer] Patients list cached');

    // Warm staff schedule (multi-patient view)
    try {
      console.log(`[CacheWarmer] Fetching staff schedule for ${staffId}...`);
      const staffSchedule = await apiService.getAllTodaySchedule(staffId);
      await cacheService.cacheStaffSchedule(staffId, staffSchedule);
      staffScheduleWarmed = true;
      console.log(`✅ [CacheWarmer] Staff schedule cached (${staffSchedule.allItems?.length || 0} items)`);
    } catch (error: any) {
      const errorMsg = `Failed to cache staff schedule: ${error.message}`;
      console.error(`❌ [CacheWarmer] ${errorMsg}`);
      errors.push(errorMsg);
    }

    // Warm per-patient schedules (for PatientInfoScreen)
    console.log(`[CacheWarmer] Warming individual patient schedules...`);
    for (const patient of patients) {
      try {
        const schedule = await apiService.getTodaySchedule(patient.patient_id);
        await cacheService.cacheTodaySchedule(patient.patient_id, schedule);
        patientsWarmed++;
        console.log(`✅ [CacheWarmer] Schedule cached for patient: ${patient.patient_id} (${schedule.allItems?.length || 0} items)`);
      } catch (error: any) {
        const errorMsg = `Failed to cache schedule for patient ${patient.patient_id}: ${error.message}`;
        console.error(`❌ [CacheWarmer] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 [CacheWarmer] Schedule cache warming complete!`);
    console.log(`   - Patients warmed: ${patientsWarmed}/${patients.length}`);
    console.log(`   - Staff schedule: ${staffScheduleWarmed ? 'Yes' : 'No'}`);
    console.log(`   - Errors: ${errors.length}`);

    return {
      success: errors.length === 0 || patientsWarmed > 0,
      patientsWarmed,
      staffScheduleWarmed,
      errors,
    };
  } catch (error: any) {
    console.error('❌ [CacheWarmer] Critical error during schedule warming:', error);
    errors.push(`Critical error: ${error.message}`);
    return {
      success: false,
      patientsWarmed,
      staffScheduleWarmed,
      errors,
    };
  }
}

/**
 * Comprehensive cache warming for ALL offline functionality
 * Call this before going offline for demo
 */
export async function warmAllDataForDemo(staffId: string = DEMO_STAFF_ID): Promise<{
  success: boolean;
  details: {
    patients: number;
    schedules: number;
    carePlans: number;
    templates: number;
  };
  errors: string[];
}> {
  console.log('🔥🔥🔥 [CacheWarmer] Starting FULL demo cache warming...');

  const errors: string[] = [];
  const details = {
    patients: 0,
    schedules: 0,
    carePlans: 0,
    templates: 0,
  };

  try {
    // 1. Warm patients and schedules
    const scheduleResult = await warmScheduleCaches(staffId);
    details.patients = scheduleResult.patientsWarmed;
    details.schedules = scheduleResult.patientsWarmed + (scheduleResult.staffScheduleWarmed ? 1 : 0);
    errors.push(...scheduleResult.errors);

    // 2. Warm problem templates
    try {
      const templates = await apiService.getProblemTemplates();
      await cacheService.cacheProblemTemplates(templates);
      details.templates = templates.length;
      console.log(`✅ [CacheWarmer] Problem templates cached: ${templates.length}`);
    } catch (error: any) {
      errors.push(`Problem templates: ${error.message}`);
    }

    // 3. Warm care plans
    // Note: Care plans are loaded on-demand through carePlanStore
    // We could pre-warm them here but they already have offline-first logic
    console.log('ℹ️  [CacheWarmer] Care plans will be cached on-demand (already have offline-first logic)');

    console.log('🎉🎉🎉 [CacheWarmer] FULL cache warming complete!');
    console.log('   Summary:', details);
    console.log('   Errors:', errors.length);

    return {
      success: details.patients > 0 && details.schedules > 0,
      details,
      errors,
    };
  } catch (error: any) {
    console.error('❌ [CacheWarmer] Critical error during full warming:', error);
    errors.push(`Critical: ${error.message}`);
    return {
      success: false,
      details,
      errors,
    };
  }
}
