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
   * Clear server-specific cached data during server switches
   * Preserves user preferences and session data
   */
  async clearServerSpecificCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const serverSpecificKeys = keys.filter(key => 
        key.startsWith('@verbumcare/') && 
        !key.includes('session_data') && 
        !key.includes('preferences') &&
        !key.includes('settings') &&
        !key.includes('language')
      );
      
      if (serverSpecificKeys.length > 0) {
        await AsyncStorage.multiRemove(serverSpecificKeys);
        console.log(`[Cache] Cleared ${serverSpecificKeys.length} server-specific cache entries`);
      }
    } catch (error) {
      console.error('Error clearing server-specific cache:', error);
    }
  }

  /**
   * Selective cache clearing with preservation rules
   * Implements Requirements 4.2 (selective cache clearing)
   */
  async selectiveCacheClear(options: {
    preserveUserData?: boolean;
    preserveSettings?: boolean;
    preserveSession?: boolean;
    preserveTemplates?: boolean;
    serverSpecificOnly?: boolean;
  } = {}): Promise<void> {
    try {
      const {
        preserveUserData = true,
        preserveSettings = true,
        preserveSession = true,
        preserveTemplates = true,
        serverSpecificOnly = true
      } = options;

      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove: string[] = [];

      for (const key of keys) {
        if (!key.startsWith('@verbumcare/')) continue;

        // Always preserve settings if requested
        if (preserveSettings && (key.includes('settings') || key.includes('language'))) {
          continue;
        }

        // Preserve session data if requested
        if (preserveSession && key.includes('session_data')) {
          continue;
        }

        // Preserve user preferences if requested
        if (preserveUserData && key.includes('preferences')) {
          continue;
        }

        // Preserve problem templates if requested (they rarely change)
        if (preserveTemplates && key.includes('problem_templates')) {
          continue;
        }

        // If server-specific only, skip non-server data
        if (serverSpecificOnly) {
          // Server-specific data includes patients, care plans, schedules, sync data
          if (key.includes('patients') || 
              key.includes('care_plan') || 
              key.includes('schedule') || 
              key.includes('last_sync') || 
              key.includes('pending_sync')) {
            keysToRemove.push(key);
          }
        } else {
          // Clear everything except preserved items
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[Cache] Selectively cleared ${keysToRemove.length} cache entries`);
      }
    } catch (error) {
      console.error('Error in selective cache clear:', error);
      throw new Error(`Selective cache clear failed: ${error.message}`);
    }
  }

  /**
   * Create server-specific cache backup before switching
   * Implements Requirements 4.2 (cache restoration for previous servers)
   */
  async createServerCacheBackup(serverId: string): Promise<string> {
    try {
      const backupKey = `@verbumcare/server_backup_${serverId}_${Date.now()}`;
      const keys = await AsyncStorage.getAllKeys();
      const serverSpecificKeys = keys.filter(key => 
        key.startsWith('@verbumcare/') && 
        (key.includes('patients') || 
         key.includes('care_plan') || 
         key.includes('schedule') || 
         key.includes('last_sync'))
      );

      if (serverSpecificKeys.length === 0) {
        console.log(`[Cache] No server-specific data to backup for ${serverId}`);
        return backupKey;
      }

      const backupData: Record<string, string> = {};
      const keyValuePairs = await AsyncStorage.multiGet(serverSpecificKeys);
      
      for (const [key, value] of keyValuePairs) {
        if (value !== null) {
          backupData[key] = value;
        }
      }

      const backup = {
        serverId,
        timestamp: Date.now(),
        data: backupData,
        version: PROBLEM_TEMPLATES_VERSION,
      };

      await AsyncStorage.setItem(backupKey, JSON.stringify(backup));
      console.log(`[Cache] Created backup for server ${serverId} with ${Object.keys(backupData).length} entries`);
      
      return backupKey;
    } catch (error) {
      console.error(`Error creating cache backup for server ${serverId}:`, error);
      throw new Error(`Cache backup failed: ${error.message}`);
    }
  }

  /**
   * Restore cache from server-specific backup
   * Implements Requirements 4.2 (cache restoration for previous servers)
   */
  async restoreServerCacheBackup(serverId: string): Promise<boolean> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const backupKeys = keys.filter(key => key.includes(`server_backup_${serverId}`));
      
      if (backupKeys.length === 0) {
        console.log(`[Cache] No backup found for server ${serverId}`);
        return false;
      }

      // Use the most recent backup
      const mostRecentBackupKey = backupKeys.sort().pop()!;
      const backupData = await AsyncStorage.getItem(mostRecentBackupKey);
      
      if (!backupData) {
        console.log(`[Cache] Backup data not found for ${mostRecentBackupKey}`);
        return false;
      }

      const backup = JSON.parse(backupData);
      
      // Validate backup structure
      if (!backup.data || !backup.serverId || backup.serverId !== serverId) {
        console.warn(`[Cache] Invalid backup structure for server ${serverId}`);
        return false;
      }

      // Check if backup is too old (older than 24 hours)
      const backupAge = Date.now() - backup.timestamp;
      if (backupAge > 24 * 60 * 60 * 1000) {
        console.log(`[Cache] Backup for server ${serverId} is too old (${Math.round(backupAge / (60 * 60 * 1000))} hours), skipping restore`);
        return false;
      }

      // Restore the backup data
      const restoreEntries = Object.entries(backup.data).map(([key, value]) => [key, String(value)]) as [string, string][];
      if (restoreEntries.length > 0) {
        await AsyncStorage.multiSet(restoreEntries);
        console.log(`[Cache] Restored ${restoreEntries.length} cache entries for server ${serverId}`);
      }

      return true;
    } catch (error) {
      console.error(`Error restoring cache backup for server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Clean up old server cache backups
   * Keeps only the most recent backup per server
   */
  async cleanupServerBackups(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const backupKeys = keys.filter(key => key.includes('server_backup_'));
      
      if (backupKeys.length === 0) return;

      // Group backups by server ID
      const backupsByServer: Record<string, string[]> = {};
      
      for (const key of backupKeys) {
        const match = key.match(/server_backup_([^_]+)_/);
        if (match) {
          const serverId = match[1];
          if (!backupsByServer[serverId]) {
            backupsByServer[serverId] = [];
          }
          backupsByServer[serverId].push(key);
        }
      }

      // Keep only the most recent backup per server
      const keysToRemove: string[] = [];
      
      for (const [serverId, serverBackups] of Object.entries(backupsByServer)) {
        if (serverBackups.length > 1) {
          // Sort by timestamp (newest first) and remove all but the first
          const sortedBackups = serverBackups.sort().reverse();
          keysToRemove.push(...sortedBackups.slice(1));
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[Cache] Cleaned up ${keysToRemove.length} old server backups`);
      }
    } catch (error) {
      console.error('Error cleaning up server backups:', error);
    }
  }

  /**
   * Handle cache corruption recovery
   * Implements Requirements 4.5 (cache corruption recovery)
   */
  async recoverFromCacheCorruption(): Promise<{
    recovered: boolean;
    corruptedKeys: string[];
    recoveredKeys: string[];
  }> {
    const result = {
      recovered: false,
      corruptedKeys: [] as string[],
      recoveredKeys: [] as string[]
    };

    try {
      const keys = await AsyncStorage.getAllKeys();
      const verbumcareKeys = keys.filter(key => key.startsWith('@verbumcare/'));
      
      console.log(`[Cache] Checking ${verbumcareKeys.length} cache entries for corruption`);

      for (const key of verbumcareKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value === null) continue;

          // Try to parse JSON to detect corruption
          JSON.parse(value);
          
          // Additional validation for specific cache types
          if (key.includes('patients') || key.includes('care_plan')) {
            const parsed = JSON.parse(value);
            if (!parsed.data || !parsed.timestamp) {
              throw new Error('Invalid cache structure');
            }
          }
        } catch (parseError) {
          console.warn(`[Cache] Corrupted cache entry detected: ${key}`);
          result.corruptedKeys.push(key);
          
          try {
            // Try to recover from backup if available
            const serverId = this.extractServerIdFromKey(key);
            if (serverId && await this.restoreServerCacheBackup(serverId)) {
              result.recoveredKeys.push(key);
            } else {
              // Remove corrupted entry
              await AsyncStorage.removeItem(key);
            }
          } catch (recoveryError) {
            console.error(`[Cache] Failed to recover corrupted key ${key}:`, recoveryError);
            // Remove the corrupted entry as last resort
            await AsyncStorage.removeItem(key);
          }
        }
      }

      result.recovered = result.corruptedKeys.length > 0;
      
      if (result.recovered) {
        console.log(`[Cache] Corruption recovery completed: ${result.corruptedKeys.length} corrupted, ${result.recoveredKeys.length} recovered`);
      }

      return result;
    } catch (error) {
      console.error('Error during cache corruption recovery:', error);
      return result;
    }
  }

  /**
   * Extract server ID from cache key for recovery purposes
   */
  private extractServerIdFromKey(key: string): string | null {
    // This is a simple heuristic - in a real implementation, 
    // we might store server ID metadata with each cache entry
    if (key.includes('mac-mini') || key.includes('macmini')) {
      return 'mac-mini';
    } else if (key.includes('pn51') || key.includes('lab')) {
      return 'pn51';
    }
    return null;
  }

  /**
   * Validate cache versioning and compatibility
   * Implements Requirements 4.5 (cache versioning and compatibility)
   */
  async validateCacheVersion(): Promise<{
    valid: boolean;
    currentVersion: number;
    cacheVersion: number | null;
    migrationNeeded: boolean;
  }> {
    try {
      const cachedVersion = await AsyncStorage.getItem(CACHE_KEYS.PROBLEM_TEMPLATES_VERSION);
      const cacheVersion = cachedVersion ? parseInt(cachedVersion, 10) : null;
      const currentVersion = PROBLEM_TEMPLATES_VERSION;
      
      const valid = cacheVersion === currentVersion;
      const migrationNeeded = cacheVersion !== null && cacheVersion < currentVersion;

      return {
        valid,
        currentVersion,
        cacheVersion,
        migrationNeeded
      };
    } catch (error) {
      console.error('Error validating cache version:', error);
      return {
        valid: false,
        currentVersion: PROBLEM_TEMPLATES_VERSION,
        cacheVersion: null,
        migrationNeeded: false
      };
    }
  }

  /**
   * Migrate cache to new version
   * Implements Requirements 4.5 (cache versioning and compatibility)
   */
  async migrateCacheVersion(): Promise<boolean> {
    try {
      const versionInfo = await this.validateCacheVersion();
      
      if (!versionInfo.migrationNeeded) {
        console.log('[Cache] No migration needed');
        return true;
      }

      console.log(`[Cache] Migrating cache from version ${versionInfo.cacheVersion} to ${versionInfo.currentVersion}`);

      // For now, we'll clear incompatible cache and let it rebuild
      // In a more sophisticated implementation, we could transform the data
      await this.clearProblemTemplatesCache();
      
      // Update version
      await AsyncStorage.setItem(CACHE_KEYS.PROBLEM_TEMPLATES_VERSION, versionInfo.currentVersion.toString());
      
      console.log('[Cache] Cache migration completed successfully');
      return true;
    } catch (error) {
      console.error('Error during cache migration:', error);
      return false;
    }
  }

  /**
   * Preserve user preferences during server switches
   * Implements Requirements 4.2 (preserve user preferences during switches)
   */
  async preserveUserPreferences(): Promise<Record<string, any>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const preferenceKeys = keys.filter(key => 
        key.includes('preferences') || 
        key.includes('settings') || 
        key.includes('language') ||
        key.includes('session_data')
      );

      const preferences: Record<string, any> = {};
      
      if (preferenceKeys.length > 0) {
        const keyValuePairs = await AsyncStorage.multiGet(preferenceKeys);
        for (const [key, value] of keyValuePairs) {
          if (value !== null) {
            preferences[key] = value;
          }
        }
      }

      console.log(`[Cache] Preserved ${Object.keys(preferences).length} user preference entries`);
      return preferences;
    } catch (error) {
      console.error('Error preserving user preferences:', error);
      return {};
    }
  }

  /**
   * Restore preserved user preferences after server switch
   * Implements Requirements 4.2 (preserve user preferences during switches)
   */
  async restoreUserPreferences(preferences: Record<string, any>): Promise<void> {
    try {
      const entries = Object.entries(preferences);
      
      if (entries.length > 0) {
        await AsyncStorage.multiSet(entries);
        console.log(`[Cache] Restored ${entries.length} user preference entries`);
      }
    } catch (error) {
      console.error('Error restoring user preferences:', error);
      throw new Error(`Failed to restore user preferences: ${error.message}`);
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

  /**
   * Clear user-specific cached data (for authentication failures)
   * Preserves server configuration and general app data
   */
  async clearUserSpecificCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userSpecificKeys = keys.filter(key => 
        key.startsWith('@verbumcare/') && (
          key.includes('session_data') ||
          key.includes('patient/') ||
          key.includes('care_plan/') ||
          key.includes('today_schedule/') ||
          key.includes('staff_schedule') ||
          key.includes('pending_sync')
        )
      );
      
      if (userSpecificKeys.length > 0) {
        await AsyncStorage.multiRemove(userSpecificKeys);
        console.log(`[Cache] Cleared ${userSpecificKeys.length} user-specific cache entries`);
      }
    } catch (error) {
      console.error('Error clearing user-specific cache:', error);
    }
  }

  /**
   * Handle server switch - manage cache during server transitions
   * Implements Requirements 1.2, 4.2 (cache management during server switches)
   */
  async handleServerSwitch(fromServerId: string, toServerId: string, options: {
    preserveUserData?: boolean;
    createBackup?: boolean;
  } = {}): Promise<void> {
    const { preserveUserData = true, createBackup = true } = options;
    
    try {
      console.log(`[Cache] Handling server switch: ${fromServerId} → ${toServerId}`);
      
      // Create backup of current server data if requested
      if (createBackup) {
        await this.createServerCacheBackup(fromServerId);
      }
      
      // Preserve user preferences before clearing
      const preservedPreferences = preserveUserData ? await this.preserveUserPreferences() : {};
      
      // Clear server-specific cache
      await this.selectiveCacheClear({
        preserveUserData,
        preserveSettings: true,
        preserveSession: preserveUserData,
        preserveTemplates: true,
        serverSpecificOnly: true
      });
      
      // Try to restore cache for the target server
      const restored = await this.restoreServerCacheBackup(toServerId);
      if (restored) {
        console.log(`[Cache] Restored cache for server ${toServerId}`);
      }
      
      // Restore user preferences
      if (preserveUserData && Object.keys(preservedPreferences).length > 0) {
        await this.restoreUserPreferences(preservedPreferences);
      }
      
      console.log(`✅ [Cache] Server switch completed: ${fromServerId} → ${toServerId}`);
    } catch (error) {
      console.error(`❌ [Cache] Error during server switch:`, error);
      throw new Error(`Cache server switch failed: ${error.message}`);
    }
  }

  /**
   * Initialize cache for a new server
   * Implements Requirements 6.1, 6.3 (server configuration initialization)
   */
  async initializeServerCache(serverId: string): Promise<void> {
    try {
      console.log(`[Cache] Initializing cache for server ${serverId}`);
      
      // Check if we have existing cache for this server
      // Note: This is a placeholder - in a full implementation, we might track server-specific cache metadata
      
      console.log(`[Cache] Starting fresh cache initialization for server ${serverId}`);
      
      // Validate cache version and migrate if needed
      const versionInfo = await this.validateCacheVersion();
      if (versionInfo.migrationNeeded) {
        await this.migrateCacheVersion();
      }
      
      console.log(`✅ [Cache] Initialized cache for server ${serverId}`);
    } catch (error) {
      console.error(`❌ [Cache] Error initializing cache for server ${serverId}:`, error);
    }
  }

  /**
   * Get server-specific cache statistics
   * Implements Requirements 4.5 (cache monitoring and debugging)
   */
  async getServerCacheStats(serverId: string): Promise<{
    serverId: string;
    hasBackup: boolean;
    backupAge?: number;
    cacheEntries: number;
    lastSync?: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      
      // Check for backup
      const backupKeys = keys.filter(key => key.includes(`server_backup_${serverId}`));
      const hasBackup = backupKeys.length > 0;
      let backupAge: number | undefined;
      
      if (hasBackup) {
        const mostRecentBackup = backupKeys.sort().pop()!;
        const backupData = await AsyncStorage.getItem(mostRecentBackup);
        if (backupData) {
          const backup = JSON.parse(backupData);
          backupAge = Date.now() - backup.timestamp;
        }
      }
      
      // Count server-specific cache entries
      const serverCacheKeys = keys.filter(key => 
        key.startsWith('@verbumcare/') && 
        (key.includes('patients') || 
         key.includes('care_plan') || 
         key.includes('schedule'))
      );
      
      // Get last sync time
      const lastSync = await this.getLastSyncTime();
      
      return {
        serverId,
        hasBackup,
        backupAge,
        cacheEntries: serverCacheKeys.length,
        lastSync: lastSync || undefined,
      };
    } catch (error) {
      console.error(`Error getting cache stats for server ${serverId}:`, error);
      return {
        serverId,
        hasBackup: false,
        cacheEntries: 0,
      };
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
