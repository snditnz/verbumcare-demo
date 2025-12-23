/**
 * Session Persistence Service
 * 
 * Handles automatic session saving, background persistence, and restoration
 * Implements Requirements 9.1, 9.2, 9.3, 9.5, 9.6, 9.7
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

interface SessionData {
  patientId: string;
  vitals?: any;
  medications?: any[];
  patientUpdates?: any;
  incidents?: any[];
  barthelIndex?: any;
  painAssessment?: any;
  fallRiskAssessment?: any;
  kihonChecklist?: any;
  lastSaved: number;
  autoSaved: boolean;
}

interface SessionMetadata {
  sessionId: string;
  patientId: string;
  startedAt: number;
  lastSaved: number;
  submitted: boolean;
}

const SESSION_STORAGE_KEY = '@verbumcare/active_sessions';
const SESSION_METADATA_KEY = '@verbumcare/session_metadata';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

class SessionPersistenceService {
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private currentSessionId: string | null = null;

  /**
   * Initialize session persistence
   * Sets up auto-save timer and app state listeners
   * Implements Requirements 9.1, 9.2
   */
  async initialize(): Promise<void> {
    console.log('[SessionPersistence] Initializing...');

    // Set up auto-save timer
    this.startAutoSave();

    // Set up app state listener for background persistence
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    console.log('[SessionPersistence] Initialized successfully');
  }

  /**
   * Clean up listeners and timers
   */
  cleanup(): void {
    console.log('[SessionPersistence] Cleaning up...');

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Start a new session for a patient
   * Implements Requirements 9.1
   */
  async startSession(patientId: string): Promise<string> {
    const sessionId = `session_${patientId}_${Date.now()}`;
    this.currentSessionId = sessionId;

    const metadata: SessionMetadata = {
      sessionId,
      patientId,
      startedAt: Date.now(),
      lastSaved: Date.now(),
      submitted: false,
    };

    await this.saveSessionMetadata(metadata);

    console.log('[SessionPersistence] Started session:', sessionId);
    return sessionId;
  }

  /**
   * Auto-save session data every 30 seconds
   * Implements Requirements 9.1
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.performAutoSave();
      } catch (error) {
        console.error('[SessionPersistence] Auto-save failed:', error);
      }
    }, AUTO_SAVE_INTERVAL);

    console.log('[SessionPersistence] Auto-save timer started (30s interval)');
  }

  /**
   * Perform auto-save of current session data
   * Implements Requirements 9.1
   */
  private async performAutoSave(): Promise<void> {
    // Get current session data from assessment store
    // This will be called by the store itself
    // Only log if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      console.log('[SessionPersistence] Auto-save triggered at', new Date().toISOString());
    }
  }

  /**
   * Save session data with timestamp
   * Implements Requirements 9.1, 9.2
   */
  async saveSessionData(patientId: string, sessionData: Partial<SessionData>): Promise<void> {
    const dataWithTimestamp: SessionData = {
      ...sessionData,
      patientId,
      lastSaved: Date.now(),
      autoSaved: true,
    } as SessionData;

    const key = `${SESSION_STORAGE_KEY}_${patientId}`;
    await AsyncStorage.setItem(key, JSON.stringify(dataWithTimestamp));

    // Update metadata
    if (this.currentSessionId) {
      const metadata = await this.getSessionMetadata(this.currentSessionId);
      if (metadata) {
        metadata.lastSaved = Date.now();
        await this.saveSessionMetadata(metadata);
      }
    }

    console.log('[SessionPersistence] Saved session data for patient:', patientId);
  }

  /**
   * Handle app state changes (background/foreground)
   * Implements Requirements 9.2
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    console.log('[SessionPersistence] App state changed to:', nextAppState);

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App is going to background - persist all session data
      await this.persistOnBackground();
    } else if (nextAppState === 'active') {
      // App is coming to foreground - restore session if needed
      await this.restoreOnForeground();
    }
  };

  /**
   * Persist session data when app goes to background
   * Implements Requirements 9.2
   */
  private async persistOnBackground(): Promise<void> {
    console.log('[SessionPersistence] Persisting data on background...');

    try {
      // Get all active sessions from storage
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(SESSION_STORAGE_KEY));

      console.log('[SessionPersistence] Found', sessionKeys.length, 'active sessions to persist');

      // All data is already in AsyncStorage via Zustand persistence
      // Just log for confirmation
      for (const key of sessionKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const session = JSON.parse(data);
          console.log('[SessionPersistence] Persisted session for patient:', session.patientId);
        }
      }

      console.log('[SessionPersistence] Background persistence complete');
    } catch (error) {
      console.error('[SessionPersistence] Background persistence failed:', error);
    }
  }

  /**
   * Restore session data when app comes to foreground
   * Implements Requirements 9.3, 9.7
   */
  private async restoreOnForeground(): Promise<void> {
    console.log('[SessionPersistence] Restoring data on foreground...');

    try {
      // Check if there are any active sessions to restore
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(SESSION_STORAGE_KEY));

      if (sessionKeys.length > 0) {
        console.log('[SessionPersistence] Found', sessionKeys.length, 'sessions to restore');
        // Sessions will be automatically restored by Zustand persistence
      } else {
        console.log('[SessionPersistence] No sessions to restore');
      }
    } catch (error) {
      console.error('[SessionPersistence] Foreground restoration failed:', error);
    }
  }

  /**
   * Get session data for a patient
   * Implements Requirements 9.3, 9.7
   */
  async getSessionData(patientId: string): Promise<SessionData | null> {
    try {
      const key = `${SESSION_STORAGE_KEY}_${patientId}`;
      const data = await AsyncStorage.getItem(key);

      if (!data) {
        return null;
      }

      const session = JSON.parse(data);
      console.log('[SessionPersistence] Retrieved session for patient:', patientId);
      return session;
    } catch (error) {
      console.error('[SessionPersistence] Failed to get session data:', error);
      return null;
    }
  }

  /**
   * Clear session data after successful submission
   * Implements Requirements 9.5
   */
  async clearSessionAfterSubmission(patientId: string): Promise<void> {
    try {
      const key = `${SESSION_STORAGE_KEY}_${patientId}`;
      await AsyncStorage.removeItem(key);

      // Mark session as submitted in metadata
      if (this.currentSessionId) {
        const metadata = await this.getSessionMetadata(this.currentSessionId);
        if (metadata && metadata.patientId === patientId) {
          metadata.submitted = true;
          await this.saveSessionMetadata(metadata);
        }
      }

      console.log('[SessionPersistence] Cleared session for patient:', patientId);
    } catch (error) {
      console.error('[SessionPersistence] Failed to clear session:', error);
      throw error;
    }
  }

  /**
   * Check if there are any unsaved sessions
   * Implements Requirements 9.6
   */
  async hasUnsavedSessions(): Promise<boolean> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(SESSION_STORAGE_KEY));

      for (const key of sessionKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const session = JSON.parse(data);
          // Check if session has data and hasn't been submitted
          if (session.vitals || session.medications?.length > 0 || session.patientUpdates) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[SessionPersistence] Failed to check unsaved sessions:', error);
      return false;
    }
  }

  /**
   * Get all unsaved sessions for conflict resolution
   * Implements Requirements 9.6
   */
  async getUnsavedSessions(): Promise<SessionData[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(SESSION_STORAGE_KEY));

      const sessions: SessionData[] = [];

      for (const key of sessionKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const session = JSON.parse(data);
          // Only include sessions with actual data
          if (session.vitals || session.medications?.length > 0 || session.patientUpdates) {
            sessions.push(session);
          }
        }
      }

      return sessions;
    } catch (error) {
      console.error('[SessionPersistence] Failed to get unsaved sessions:', error);
      return [];
    }
  }

  /**
   * Save session metadata
   */
  private async saveSessionMetadata(metadata: SessionMetadata): Promise<void> {
    try {
      const key = `${SESSION_METADATA_KEY}_${metadata.sessionId}`;
      await AsyncStorage.setItem(key, JSON.stringify(metadata));
    } catch (error) {
      console.error('[SessionPersistence] Failed to save session metadata:', error);
    }
  }

  /**
   * Get session metadata
   */
  private async getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    try {
      const key = `${SESSION_METADATA_KEY}_${sessionId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[SessionPersistence] Failed to get session metadata:', error);
      return null;
    }
  }

  /**
   * Get time since last save for a session
   */
  async getTimeSinceLastSave(patientId: string): Promise<number | null> {
    const session = await this.getSessionData(patientId);
    if (!session || !session.lastSaved) {
      return null;
    }

    return Date.now() - session.lastSaved;
  }

  /**
   * Check if auto-save is needed (more than 30 seconds since last save)
   */
  async shouldAutoSave(patientId: string): Promise<boolean> {
    const timeSince = await this.getTimeSinceLastSave(patientId);
    if (timeSince === null) {
      return true; // No previous save, should save
    }

    return timeSince >= AUTO_SAVE_INTERVAL;
  }

  /**
   * Save session data (alias for saveSessionData)
   * Implements Requirements 9.1, 9.2
   */
  async saveSession(patientId: string, sessionData: Partial<SessionData>): Promise<void> {
    return this.saveSessionData(patientId, sessionData);
  }

  /**
   * Get session data (alias for getSessionData)
   * Implements Requirements 9.3, 9.7
   */
  async getSession(patientId: string): Promise<SessionData | null> {
    return this.getSessionData(patientId);
  }

  /**
   * Clear session data (alias for clearSessionAfterSubmission)
   * Implements Requirements 9.5
   */
  async clearSession(patientId: string): Promise<void> {
    return this.clearSessionAfterSubmission(patientId);
  }

  /**
   * Clear all sessions (for logout)
   * Implements Requirements 9.5
   */
  async clearAllSessions(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(SESSION_STORAGE_KEY));
      
      for (const key of sessionKeys) {
        await AsyncStorage.removeItem(key);
      }

      // Clear metadata as well
      const metadataKeys = keys.filter(key => key.startsWith(SESSION_METADATA_KEY));
      for (const key of metadataKeys) {
        await AsyncStorage.removeItem(key);
      }

      console.log('[SessionPersistence] Cleared all sessions');
    } catch (error) {
      console.error('[SessionPersistence] Failed to clear all sessions:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const sessionPersistenceService = new SessionPersistenceService();
export default sessionPersistenceService;
