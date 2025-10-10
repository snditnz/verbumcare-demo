import AsyncStorage from '@react-native-async-storage/async-storage';
import { Patient } from '@models';

/**
 * Offline-first caching service using AsyncStorage
 * Provides persistent storage for API data with automatic expiry
 */

const CACHE_KEYS = {
  PATIENTS: '@verbumcare/patients',
  PATIENT_PREFIX: '@verbumcare/patient/',
  LAST_SYNC: '@verbumcare/last_sync',
  PENDING_SYNC: '@verbumcare/pending_sync',
  SESSION_DATA: '@verbumcare/session_data',
} as const;

// Cache expiry: 1 hour for patients list, 5 minutes for individual patient
const CACHE_EXPIRY = {
  PATIENTS_LIST: 60 * 60 * 1000, // 1 hour
  PATIENT_DETAIL: 5 * 60 * 1000, // 5 minutes
  BARTHEL: 24 * 60 * 60 * 1000, // 24 hours (doesn't change frequently)
} as const;

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CacheService {
  /**
   * Store patients list in cache
   */
  async cachePatients(patients: Patient[]): Promise<void> {
    try {
      const cached: CachedData<Patient[]> = {
        data: patients,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRY.PATIENTS_LIST,
      };
      await AsyncStorage.setItem(CACHE_KEYS.PATIENTS, JSON.stringify(cached));
    } catch (error) {
      console.error('Error caching patients:', error);
    }
  }

  /**
   * Get patients list from cache
   * Returns null if cache is expired or doesn't exist
   */
  async getCachedPatients(): Promise<Patient[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.PATIENTS);
      if (!cached) return null;

      const parsed: CachedData<Patient[]> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > parsed.expiresAt) {
        await AsyncStorage.removeItem(CACHE_KEYS.PATIENTS);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error('Error reading cached patients:', error);
      return null;
    }
  }

  /**
   * Store individual patient in cache
   */
  async cachePatient(patient: Patient): Promise<void> {
    try {
      const cached: CachedData<Patient> = {
        data: patient,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRY.PATIENT_DETAIL,
      };
      const key = `${CACHE_KEYS.PATIENT_PREFIX}${patient.patient_id}`;
      await AsyncStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      console.error('Error caching patient:', error);
    }
  }

  /**
   * Get individual patient from cache
   */
  async getCachedPatient(patientId: string): Promise<Patient | null> {
    try {
      const key = `${CACHE_KEYS.PATIENT_PREFIX}${patientId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const parsed: CachedData<Patient> = JSON.parse(cached);

      if (Date.now() > parsed.expiresAt) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error('Error reading cached patient:', error);
      return null;
    }
  }

  /**
   * Update last sync timestamp
   */
  async setLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error('Error setting last sync time:', error);
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Clear all cache (useful for logout or force refresh)
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const verbumcareKeys = keys.filter(key => key.startsWith('@verbumcare/'));
      await AsyncStorage.multiRemove(verbumcareKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Check if we should sync (cache is old or doesn't exist)
   */
  async shouldSync(): Promise<boolean> {
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return true;

    const timeSinceSync = Date.now() - lastSync;
    return timeSinceSync > CACHE_EXPIRY.PATIENTS_LIST;
  }

  /**
   * Store pending sync data (for offline changes)
   */
  async addPendingSync(type: string, data: any): Promise<void> {
    try {
      const pending = await this.getPendingSync();
      pending.push({
        id: Date.now().toString(),
        type,
        data,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_SYNC, JSON.stringify(pending));
    } catch (error) {
      console.error('Error adding pending sync:', error);
    }
  }

  /**
   * Get pending sync items
   */
  async getPendingSync(): Promise<any[]> {
    try {
      const pending = await AsyncStorage.getItem(CACHE_KEYS.PENDING_SYNC);
      return pending ? JSON.parse(pending) : [];
    } catch (error) {
      console.error('Error getting pending sync:', error);
      return [];
    }
  }

  /**
   * Clear pending sync items after successful sync
   */
  async clearPendingSync(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.PENDING_SYNC);
    } catch (error) {
      console.error('Error clearing pending sync:', error);
    }
  }

  /**
   * Store session data (patient-scoped vitals, medications, etc.)
   */
  async cacheSessionData(sessionData: any): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.SESSION_DATA, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error caching session data:', error);
    }
  }

  /**
   * Get session data from cache
   */
  async getCachedSessionData(): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEYS.SESSION_DATA);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error reading cached session data:', error);
      return null;
    }
  }

  /**
   * Clear session data
   */
  async clearSessionData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.SESSION_DATA);
    } catch (error) {
      console.error('Error clearing session data:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  async getCacheStats(): Promise<{
    patientsCount: number;
    lastSync: number | null;
    pendingCount: number;
    cacheSize: number;
  }> {
    try {
      const patients = await this.getCachedPatients();
      const lastSync = await this.getLastSyncTime();
      const pending = await this.getPendingSync();
      const keys = await AsyncStorage.getAllKeys();
      const verbumcareKeys = keys.filter(key => key.startsWith('@verbumcare/'));

      return {
        patientsCount: patients?.length || 0,
        lastSync,
        pendingCount: pending.length,
        cacheSize: verbumcareKeys.length,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        patientsCount: 0,
        lastSync: null,
        pendingCount: 0,
        cacheSize: 0,
      };
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
