import AsyncStorage from '@react-native-async-storage/async-storage';
import { Patient, CarePlan, ProblemTemplate, TodaySchedule } from '@models';

/**
 * Offline-first caching service using AsyncStorage
 * Provides persistent storage for API data with automatic expiry
 */

const CACHE_KEYS = {
  PATIENTS: '@verbumcare/patients',
  PATIENT_PREFIX: '@verbumcare/patient/',
  CARE_PLANS: '@verbumcare/care_plans',
  CARE_PLAN_PREFIX: '@verbumcare/care_plan/',
  PROBLEM_TEMPLATES: '@verbumcare/problem_templates',
  PROBLEM_TEMPLATES_VERSION: '@verbumcare/problem_templates_version',
  TODAY_SCHEDULE_PREFIX: '@verbumcare/today_schedule/',
  STAFF_SCHEDULE: '@verbumcare/staff_schedule',
  LAST_SYNC: '@verbumcare/last_sync',
  PENDING_SYNC: '@verbumcare/pending_sync',
  SESSION_DATA: '@verbumcare/session_data',
} as const;

// Cache version - increment this when template structure changes
const PROBLEM_TEMPLATES_VERSION = 2; // v2: Added multilingual support with {ja, en, zh} structure

// Cache expiry: Extended times for offline demo capability
const CACHE_EXPIRY = {
  PATIENTS_LIST: 8 * 60 * 60 * 1000, // 8 hours (for demo + travel time)
  PATIENT_DETAIL: 8 * 60 * 60 * 1000, // 8 hours (match PATIENTS_LIST)
  BARTHEL: 24 * 60 * 60 * 1000, // 24 hours (doesn't change frequently)
  SCHEDULE: 8 * 60 * 60 * 1000, // 8 hours (for demo + travel time)
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
   * Cache care plans (offline-first)
   */
  async cacheCarePlans(carePlans: CarePlan[]): Promise<void> {
    try {
      const cached: CachedData<CarePlan[]> = {
        data: carePlans,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };
      await AsyncStorage.setItem(CACHE_KEYS.CARE_PLANS, JSON.stringify(cached));

      // Also cache individually by patient ID for quick access
      for (const plan of carePlans) {
        await this.cacheCarePlan(plan);
      }
    } catch (error) {
      console.error('Error caching care plans:', error);
    }
  }

  /**
   * Cache individual care plan
   */
  async cacheCarePlan(carePlan: CarePlan): Promise<void> {
    try {
      const cached: CachedData<CarePlan> = {
        data: carePlan,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };
      const key = `${CACHE_KEYS.CARE_PLAN_PREFIX}${carePlan.patientId}`;
      await AsyncStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      console.error('Error caching care plan:', error);
    }
  }

  /**
   * Remove cached care plan for a patient
   */
  async removeCarePlan(patientId: string): Promise<void> {
    try {
      const key = `${CACHE_KEYS.CARE_PLAN_PREFIX}${patientId}`;
      await AsyncStorage.removeItem(key);
      console.log(`[Cache] Removed care plan for patient ${patientId}`);
    } catch (error) {
      console.error('Error removing care plan from cache:', error);
    }
  }

  /**
   * Get cached care plan for a patient
   */
  async getCachedCarePlan(patientId: string): Promise<CarePlan | null> {
    try {
      const key = `${CACHE_KEYS.CARE_PLAN_PREFIX}${patientId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const parsed: CachedData<CarePlan> = JSON.parse(cached);

      // Convert date strings back to Date objects
      const carePlan = this.deserializeCarePlan(parsed.data);

      // For care plans, we don't expire them - offline-first
      // We'll sync when online but always have the local version
      return carePlan;
    } catch (error) {
      console.error('Error reading cached care plan:', error);
      return null;
    }
  }

  /**
   * Deserialize care plan - convert date strings back to Date objects
   */
  private deserializeCarePlan(plan: any): CarePlan {
    return {
      ...plan,
      createdDate: new Date(plan.createdDate),
      lastReviewDate: new Date(plan.lastReviewDate),
      nextReviewDate: new Date(plan.nextReviewDate),
      lastMonitoringDate: plan.lastMonitoringDate ? new Date(plan.lastMonitoringDate) : undefined,
      nextMonitoringDate: new Date(plan.nextMonitoringDate),
      familySignature: plan.familySignature ? {
        ...plan.familySignature,
        date: new Date(plan.familySignature.date)
      } : undefined,
      carePlanItems: plan.carePlanItems.map((item: any) => ({
        ...item,
        problem: {
          ...item.problem,
          identifiedDate: new Date(item.problem.identifiedDate)
        },
        longTermGoal: {
          ...item.longTermGoal,
          targetDate: new Date(item.longTermGoal.targetDate)
        },
        shortTermGoal: {
          ...item.shortTermGoal,
          targetDate: new Date(item.shortTermGoal.targetDate)
        },
        interventions: item.interventions.map((intervention: any) => ({
          ...intervention,
          createdDate: new Date(intervention.createdDate)
        })),
        progressNotes: item.progressNotes.map((note: any) => ({
          ...note,
          date: new Date(note.date)
        })),
        lastUpdated: new Date(item.lastUpdated)
      })),
      auditLog: plan.auditLog.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      })),
      monitoringRecords: plan.monitoringRecords.map((record: any) => ({
        ...record,
        monitoringDate: new Date(record.monitoringDate),
        nextMonitoringDate: new Date(record.nextMonitoringDate)
      }))
    };
  }

  /**
   * Cache problem templates
   */
  async cacheProblemTemplates(templates: ProblemTemplate[]): Promise<void> {
    try {
      const cached: CachedData<ProblemTemplate[]> = {
        data: templates,
        timestamp: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      };
      await AsyncStorage.setItem(CACHE_KEYS.PROBLEM_TEMPLATES, JSON.stringify(cached));
      // Store the version number
      await AsyncStorage.setItem(CACHE_KEYS.PROBLEM_TEMPLATES_VERSION, PROBLEM_TEMPLATES_VERSION.toString());
    } catch (error) {
      console.error('Error caching problem templates:', error);
    }
  }

  /**
   * Get cached problem templates
   * Returns null if cache version doesn't match (forces re-fetch)
   */
  async getCachedProblemTemplates(): Promise<ProblemTemplate[] | null> {
    try {
      // Check cache version first
      const cachedVersion = await AsyncStorage.getItem(CACHE_KEYS.PROBLEM_TEMPLATES_VERSION);
      const versionNumber = cachedVersion ? parseInt(cachedVersion, 10) : 0;

      if (versionNumber !== PROBLEM_TEMPLATES_VERSION) {
        // Version mismatch - clear old cache and return null to force re-fetch
        console.log(`Problem templates cache version mismatch (cached: ${versionNumber}, current: ${PROBLEM_TEMPLATES_VERSION}). Clearing cache.`);
        await this.clearProblemTemplatesCache();
        return null;
      }

      const cached = await AsyncStorage.getItem(CACHE_KEYS.PROBLEM_TEMPLATES);
      if (!cached) return null;

      const parsed: CachedData<ProblemTemplate[]> = JSON.parse(cached);
      // Don't expire problem templates - they rarely change
      return parsed.data;
    } catch (error) {
      console.error('Error reading cached problem templates:', error);
      return null;
    }
  }

  /**
   * Clear problem templates cache (useful when structure changes)
   */
  async clearProblemTemplatesCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.PROBLEM_TEMPLATES);
      await AsyncStorage.removeItem(CACHE_KEYS.PROBLEM_TEMPLATES_VERSION);
      console.log('Problem templates cache cleared');
    } catch (error) {
      console.error('Error clearing problem templates cache:', error);
    }
  }

  /**
   * Cache today's schedule for a specific patient
   */
  async cacheTodaySchedule(patientId: string, schedule: TodaySchedule): Promise<void> {
    try {
      const cached: CachedData<TodaySchedule> = {
        data: schedule,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRY.SCHEDULE,
      };
      const key = `${CACHE_KEYS.TODAY_SCHEDULE_PREFIX}${patientId}`;
      await AsyncStorage.setItem(key, JSON.stringify(cached));
      console.log(`[Cache] Saved schedule for patient ${patientId}`);
    } catch (error) {
      console.error('Error caching today schedule:', error);
    }
  }

  /**
   * Get cached today's schedule for a patient
   * Returns null if cache is expired or doesn't exist
   */
  async getCachedTodaySchedule(patientId: string): Promise<TodaySchedule | null> {
    try {
      const key = `${CACHE_KEYS.TODAY_SCHEDULE_PREFIX}${patientId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const parsed: CachedData<TodaySchedule> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > parsed.expiresAt) {
        console.log(`[Cache] Schedule expired for patient ${patientId}, removing`);
        await AsyncStorage.removeItem(key);
        return null;
      }

      console.log(`[Cache] Using cached schedule for patient ${patientId}`);
      return parsed.data;
    } catch (error) {
      console.error('Error reading cached today schedule:', error);
      return null;
    }
  }

  /**
   * Cache staff schedule (all patients for a staff member)
   */
  async cacheStaffSchedule(staffId: string, schedule: any): Promise<void> {
    try {
      const cached: CachedData<any> = {
        data: schedule,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRY.SCHEDULE,
      };
      const key = `${CACHE_KEYS.STAFF_SCHEDULE}_${staffId}`;
      await AsyncStorage.setItem(key, JSON.stringify(cached));
      console.log(`[Cache] Saved staff schedule for ${staffId}`);
    } catch (error) {
      console.error('Error caching staff schedule:', error);
    }
  }

  /**
   * Get cached staff schedule
   * Returns null if cache is expired or doesn't exist
   */
  async getCachedStaffSchedule(staffId: string): Promise<any | null> {
    try {
      const key = `${CACHE_KEYS.STAFF_SCHEDULE}_${staffId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const parsed: CachedData<any> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > parsed.expiresAt) {
        console.log(`[Cache] Staff schedule expired for ${staffId}, removing`);
        await AsyncStorage.removeItem(key);
        return null;
      }

      console.log(`[Cache] Using cached staff schedule for ${staffId}`);
      return parsed.data;
    } catch (error) {
      console.error('Error reading cached staff schedule:', error);
      return null;
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
    carePlansCount: number;
    templatesCount: number;
    sessionDataExists: boolean;
  }> {
    try {
      const patients = await this.getCachedPatients();
      const lastSync = await this.getLastSyncTime();
      const pending = await this.getPendingSync();
      const keys = await AsyncStorage.getAllKeys();
      const verbumcareKeys = keys.filter(key => key.startsWith('@verbumcare/'));
      
      // Count care plans
      const carePlanKeys = verbumcareKeys.filter(key => key.includes('care_plan/'));
      
      // Check templates
      const templates = await this.getCachedProblemTemplates();
      
      // Check session data
      const sessionData = await this.getCachedSessionData();

      return {
        patientsCount: patients?.length || 0,
        lastSync,
        pendingCount: pending.length,
        cacheSize: verbumcareKeys.length,
        carePlansCount: carePlanKeys.length,
        templatesCount: templates?.length || 0,
        sessionDataExists: sessionData !== null,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        patientsCount: 0,
        lastSync: null,
        pendingCount: 0,
        cacheSize: 0,
        carePlansCount: 0,
        templatesCount: 0,
        sessionDataExists: false,
      };
    }
  }

  /**
   * Check if cache is expired for a given expiry time
   */
  isCacheExpired(timestamp: number, expiryMs: number): boolean {
    return Date.now() > (timestamp + expiryMs);
  }

  /**
   * Get cache expiry configuration
   */
  getCacheExpiryConfig() {
    return CACHE_EXPIRY;
  }

  /**
   * Auto-save session data with timestamp
   * Implements Requirements 9.1 (auto-save every 30 seconds)
   */
  async autoSaveSessionData(sessionData: any): Promise<void> {
    try {
      const dataWithTimestamp = {
        ...sessionData,
        lastSaved: Date.now(),
        autoSaved: true,
      };
      await this.cacheSessionData(dataWithTimestamp);
      console.log('[Cache] Auto-saved session data at', new Date().toISOString());
    } catch (error) {
      console.error('Error auto-saving session data:', error);
    }
  }

  /**
   * Check if session data needs auto-save (30 second interval)
   */
  async shouldAutoSaveSession(): Promise<boolean> {
    try {
      const sessionData = await this.getCachedSessionData();
      if (!sessionData || !sessionData.lastSaved) {
        return true; // No previous save, should save
      }
      
      const timeSinceLastSave = Date.now() - sessionData.lastSaved;
      return timeSinceLastSave >= 30000; // 30 seconds
    } catch (error) {
      console.error('Error checking auto-save status:', error);
      return true; // Default to saving on error
    }
  }

  /**
   * Get detailed cache information for debugging
   */
  async getDetailedCacheInfo(): Promise<{
    patients: { count: number; timestamp: number | null; expiresAt: number | null };
    carePlans: { count: number };
    templates: { count: number; version: number };
    schedules: { count: number };
    session: { exists: boolean; lastSaved: number | null };
    pendingSync: { count: number; items: any[] };
    lastSync: number | null;
  }> {
    try {
      const patients = await this.getCachedPatients();
      const patientsRaw = await AsyncStorage.getItem(CACHE_KEYS.PATIENTS);
      const patientsCached = patientsRaw ? JSON.parse(patientsRaw) : null;
      
      const templates = await this.getCachedProblemTemplates();
      const templateVersion = await AsyncStorage.getItem(CACHE_KEYS.PROBLEM_TEMPLATES_VERSION);
      
      const sessionData = await this.getCachedSessionData();
      const pending = await this.getPendingSync();
      const lastSync = await this.getLastSyncTime();
      
      const keys = await AsyncStorage.getAllKeys();
      const carePlanKeys = keys.filter(key => key.includes('care_plan/'));
      const scheduleKeys = keys.filter(key => key.includes('today_schedule/') || key.includes('staff_schedule'));

      return {
        patients: {
          count: patients?.length || 0,
          timestamp: patientsCached?.timestamp || null,
          expiresAt: patientsCached?.expiresAt || null,
        },
        carePlans: {
          count: carePlanKeys.length,
        },
        templates: {
          count: templates?.length || 0,
          version: templateVersion ? parseInt(templateVersion, 10) : 0,
        },
        schedules: {
          count: scheduleKeys.length,
        },
        session: {
          exists: sessionData !== null,
          lastSaved: sessionData?.lastSaved || null,
        },
        pendingSync: {
          count: pending.length,
          items: pending,
        },
        lastSync,
      };
    } catch (error) {
      console.error('Error getting detailed cache info:', error);
      return {
        patients: { count: 0, timestamp: null, expiresAt: null },
        carePlans: { count: 0 },
        templates: { count: 0, version: 0 },
        schedules: { count: 0 },
        session: { exists: false, lastSaved: null },
        pendingSync: { count: 0, items: [] },
        lastSync: null,
      };
    }
  }

  /**
   * Trigger background refresh for expired cache items
   * Implements Requirements 4.5 (background refresh)
   */
  async triggerBackgroundRefresh(refreshCallback: () => Promise<void>): Promise<void> {
    try {
      const shouldRefresh = await this.shouldSync();
      if (shouldRefresh) {
        console.log('[Cache] Triggering background refresh (cache expired)');
        await refreshCallback();
        await this.setLastSyncTime();
      }
    } catch (error) {
      console.error('Error triggering background refresh:', error);
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
