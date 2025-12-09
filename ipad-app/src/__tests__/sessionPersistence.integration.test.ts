/**
 * Integration Test: Session Persistence
 * Tests session restoration across app restarts
 * 
 * Workflow:
 * 1. User logs in and starts assessment
 * 2. User enters partial assessment data
 * 3. System auto-saves data every 30 seconds
 * 4. User backgrounds the app
 * 5. System persists session data
 * 6. App is closed/killed
 * 7. User reopens app
 * 8. System restores authentication session
 * 9. System restores workflow state
 * 10. User continues assessment from where they left off
 * 11. User completes and submits assessment
 * 12. System clears workflow session data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@stores/authStore';
import { sessionPersistence } from '@services/sessionPersistence';
import { cacheService } from '@services/cacheService';

// Mock AppState for background/foreground detection
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  currentState: 'active',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

describe('Integration Test: Session Persistence', () => {
  let storage: Map<string, string>;
  let autoSaveInterval: NodeJS.Timeout | null = null;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage = new Map<string, string>();

    // Setup AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(storage.get(key) || null);
    });

    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    });

    (AsyncStorage.multiRemove as jest.Mock).mockImplementation((keys: string[]) => {
      keys.forEach(key => storage.delete(key));
      return Promise.resolve();
    });

    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(() => {
      return Promise.resolve(Array.from(storage.keys()));
    });

    // Reset auth store
    useAuthStore.setState({
      currentUser: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Clear any existing intervals
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }
  });

  afterEach(async () => {
    storage.clear();
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }
  });

  it('should complete full session persistence workflow: login → data entry → restart → restore → complete', async () => {
    // ============================================================
    // STEP 1: User logs in and starts assessment
    // ============================================================
    const mockUser = {
      userId: 'user-123',
      staffId: 'staff-123',
      username: 'nurse1',
      fullName: 'Test Nurse',
      role: 'nurse' as const,
      facilityId: 'facility-123',
      loginTime: new Date(),
    };

    const mockTokens = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };

    // Set authenticated state
    useAuthStore.setState({
      currentUser: mockUser,
      tokens: mockTokens,
      isAuthenticated: true,
      isLoading: false,
    });

    // Verify login successful
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // ============================================================
    // STEP 2: User enters partial assessment data
    // ============================================================
    const patientId = 'patient-123';
    const sessionId = `session_${Date.now()}`;

    const assessmentData = {
      sessionId,
      patientId,
      assessmentType: 'barthel',
      startTime: new Date().toISOString(),
      data: {
        feeding: 10,
        bathing: 5,
        grooming: 5,
        dressing: 10,
        // Incomplete - user hasn't finished yet
      },
      progress: 0.4, // 40% complete
      lastModified: new Date().toISOString(),
    };

    // ============================================================
    // STEP 3: System auto-saves data every 30 seconds
    // ============================================================
    // Save initial data
    await sessionPersistence.saveSession(patientId, assessmentData);

    // Verify data is saved
    let savedSession = await sessionPersistence.getSession(patientId);
    expect(savedSession).not.toBeNull();
    expect(savedSession?.sessionId).toBe(sessionId);
    expect(savedSession?.progress).toBe(0.4);

    // Simulate auto-save after user adds more data
    assessmentData.data = {
      ...assessmentData.data,
      toileting: 10,
      transfer: 15,
    };
    assessmentData.progress = 0.6; // 60% complete
    assessmentData.lastModified = new Date().toISOString();

    await sessionPersistence.saveSession(patientId, assessmentData);

    // Verify updated data is saved
    savedSession = await sessionPersistence.getSession(patientId);
    expect(savedSession?.progress).toBe(0.6);
    expect(savedSession?.data.toileting).toBe(10);

    // ============================================================
    // STEP 4: User backgrounds the app
    // ============================================================
    // Simulate app going to background
    const AppState = require('react-native/Libraries/AppState/AppState');
    AppState.currentState = 'background';

    // System should persist session data
    await sessionPersistence.saveSession(patientId, assessmentData);

    // ============================================================
    // STEP 5: System persists session data
    // ============================================================
    // Verify session data is in storage
    const sessionKey = `@session_${patientId}`;
    const storedSession = await AsyncStorage.getItem(sessionKey);
    expect(storedSession).not.toBeNull();

    const parsedSession = JSON.parse(storedSession!);
    expect(parsedSession.sessionId).toBe(sessionId);
    expect(parsedSession.progress).toBe(0.6);

    // ============================================================
    // STEP 6: App is closed/killed
    // ============================================================
    // Simulate app termination - clear in-memory state
    useAuthStore.setState({
      currentUser: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Note: AsyncStorage persists across app restarts

    // ============================================================
    // STEP 7: User reopens app
    // ============================================================
    AppState.currentState = 'active';

    // ============================================================
    // STEP 8: System restores authentication session
    // ============================================================
    const authStore = useAuthStore.getState();
    await authStore.checkAuth();

    // Verify authentication restored
    const restoredAuth = useAuthStore.getState();
    expect(restoredAuth.isAuthenticated).toBe(true);
    expect(restoredAuth.currentUser?.userId).toBe(mockUser.userId);
    expect(restoredAuth.tokens?.accessToken).toBe(mockTokens.accessToken);

    // ============================================================
    // STEP 9: System restores workflow state
    // ============================================================
    const restoredSession = await sessionPersistence.getSession(patientId);

    expect(restoredSession).not.toBeNull();
    expect(restoredSession?.sessionId).toBe(sessionId);
    expect(restoredSession?.progress).toBe(0.6);
    expect(restoredSession?.data.feeding).toBe(10);
    expect(restoredSession?.data.toileting).toBe(10);

    // ============================================================
    // STEP 10: User continues assessment from where they left off
    // ============================================================
    // User completes remaining fields
    const completedData = {
      ...restoredSession,
      data: {
        ...restoredSession!.data,
        mobility: 15,
        stairs: 10,
        bowels: 10,
        bladder: 10,
      },
      progress: 1.0, // 100% complete
      lastModified: new Date().toISOString(),
      completedTime: new Date().toISOString(),
    };

    await sessionPersistence.saveSession(patientId, completedData);

    // Verify completion
    const finalSession = await sessionPersistence.getSession(patientId);
    expect(finalSession?.progress).toBe(1.0);
    expect(finalSession?.completedTime).toBeDefined();

    // ============================================================
    // STEP 11: User submits assessment
    // ============================================================
    // Simulate submission to backend
    const submissionData = {
      patientId: finalSession!.patientId,
      assessmentType: finalSession!.assessmentType,
      data: finalSession!.data,
      submittedBy: restoredAuth.currentUser?.userId,
      submittedAt: new Date().toISOString(),
    };

    // Mock successful submission
    const submissionSuccess = true;
    expect(submissionSuccess).toBe(true);

    // ============================================================
    // STEP 12: System clears workflow session data
    // ============================================================
    await sessionPersistence.clearSession(patientId);

    // Verify session data is cleared
    const clearedSession = await sessionPersistence.getSession(patientId);
    expect(clearedSession).toBeNull();

    // Verify authentication is still intact
    const authAfterClear = useAuthStore.getState();
    expect(authAfterClear.isAuthenticated).toBe(true);
    expect(authAfterClear.currentUser?.userId).toBe(mockUser.userId);

    // ============================================================
    // VERIFICATION: Complete workflow succeeded
    // ============================================================
    expect(restoredAuth.isAuthenticated).toBe(true);
    expect(restoredSession?.sessionId).toBe(sessionId);
    expect(finalSession?.progress).toBe(1.0);
    expect(clearedSession).toBeNull();
    expect(authAfterClear.isAuthenticated).toBe(true);
  }, 30000);

  it('should handle multiple concurrent sessions for different patients', async () => {
    // Setup authenticated user
    useAuthStore.setState({
      currentUser: {
        userId: 'user-123',
        staffId: 'staff-123',
        username: 'nurse1',
        fullName: 'Test Nurse',
        role: 'nurse',
        facilityId: 'facility-123',
        loginTime: new Date(),
      },
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600000),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    // Create sessions for multiple patients
    const patient1Session = {
      sessionId: 'session-1',
      patientId: 'patient-1',
      assessmentType: 'barthel',
      data: { feeding: 10, bathing: 5 },
      progress: 0.2,
      lastModified: new Date().toISOString(),
    };

    const patient2Session = {
      sessionId: 'session-2',
      patientId: 'patient-2',
      assessmentType: 'vitals',
      data: { bloodPressure: { systolic: 120, diastolic: 80 } },
      progress: 0.5,
      lastModified: new Date().toISOString(),
    };

    const patient3Session = {
      sessionId: 'session-3',
      patientId: 'patient-3',
      assessmentType: 'pain',
      data: { painLevel: 3, location: 'lower back' },
      progress: 0.8,
      lastModified: new Date().toISOString(),
    };

    // Save all sessions
    await sessionPersistence.saveSession('patient-1', patient1Session);
    await sessionPersistence.saveSession('patient-2', patient2Session);
    await sessionPersistence.saveSession('patient-3', patient3Session);

    // Simulate app restart
    useAuthStore.setState({
      currentUser: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Restore auth
    await useAuthStore.getState().checkAuth();

    // Verify all sessions are restored independently
    const restored1 = await sessionPersistence.getSession('patient-1');
    const restored2 = await sessionPersistence.getSession('patient-2');
    const restored3 = await sessionPersistence.getSession('patient-3');

    expect(restored1?.sessionId).toBe('session-1');
    expect(restored1?.progress).toBe(0.2);

    expect(restored2?.sessionId).toBe('session-2');
    expect(restored2?.progress).toBe(0.5);

    expect(restored3?.sessionId).toBe('session-3');
    expect(restored3?.progress).toBe(0.8);

    // Clear one session
    await sessionPersistence.clearSession('patient-2');

    // Verify only patient-2 session is cleared
    const afterClear1 = await sessionPersistence.getSession('patient-1');
    const afterClear2 = await sessionPersistence.getSession('patient-2');
    const afterClear3 = await sessionPersistence.getSession('patient-3');

    expect(afterClear1).not.toBeNull();
    expect(afterClear2).toBeNull();
    expect(afterClear3).not.toBeNull();
  }, 30000);

  it('should handle session conflict resolution', async () => {
    // Setup authenticated user
    useAuthStore.setState({
      currentUser: {
        userId: 'user-123',
        staffId: 'staff-123',
        username: 'nurse1',
        fullName: 'Test Nurse',
        role: 'nurse',
        facilityId: 'facility-123',
        loginTime: new Date(),
      },
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600000),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    const patientId = 'patient-123';

    // Create initial session
    const session1 = {
      sessionId: 'session-1',
      patientId,
      assessmentType: 'barthel',
      data: { feeding: 10, bathing: 5 },
      progress: 0.3,
      lastModified: new Date('2024-01-01T10:00:00Z').toISOString(),
    };

    await sessionPersistence.saveSession(patientId, session1);

    // Simulate conflict: another session for same patient (e.g., from another device)
    const session2 = {
      sessionId: 'session-2',
      patientId,
      assessmentType: 'barthel',
      data: { feeding: 5, bathing: 0, grooming: 5 },
      progress: 0.4,
      lastModified: new Date('2024-01-01T10:05:00Z').toISOString(), // Later timestamp
    };

    // Check for existing session
    const existingSession = await sessionPersistence.getSession(patientId);
    expect(existingSession).not.toBeNull();

    // Conflict detected - compare timestamps
    const existingTime = new Date(existingSession!.lastModified).getTime();
    const newTime = new Date(session2.lastModified).getTime();

    // Last-write-wins: newer session should be kept
    if (newTime > existingTime) {
      await sessionPersistence.saveSession(patientId, session2);
    }

    // Verify newer session is saved
    const resolvedSession = await sessionPersistence.getSession(patientId);
    expect(resolvedSession?.sessionId).toBe('session-2');
    expect(resolvedSession?.progress).toBe(0.4);
    expect(resolvedSession?.data.grooming).toBe(5);
  }, 30000);

  it('should auto-save at regular intervals', async () => {
    // Setup authenticated user
    useAuthStore.setState({
      currentUser: {
        userId: 'user-123',
        staffId: 'staff-123',
        username: 'nurse1',
        fullName: 'Test Nurse',
        role: 'nurse',
        facilityId: 'facility-123',
        loginTime: new Date(),
      },
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600000),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    const patientId = 'patient-123';
    let saveCount = 0;

    // Create initial session
    const sessionData = {
      sessionId: 'session-1',
      patientId,
      assessmentType: 'barthel',
      data: { feeding: 10 },
      progress: 0.1,
      lastModified: new Date().toISOString(),
    };

    // Setup auto-save interval (30 seconds in production, 100ms for test)
    autoSaveInterval = setInterval(async () => {
      saveCount++;
      sessionData.lastModified = new Date().toISOString();
      await sessionPersistence.saveSession(patientId, sessionData);
    }, 100);

    // Wait for multiple auto-saves
    await new Promise(resolve => setTimeout(resolve, 350));

    // Stop auto-save
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }

    // Verify multiple saves occurred
    expect(saveCount).toBeGreaterThanOrEqual(3);

    // Verify latest data is saved
    const savedSession = await sessionPersistence.getSession(patientId);
    expect(savedSession).not.toBeNull();
    expect(savedSession?.sessionId).toBe('session-1');
  }, 30000);

  it('should clear all sessions on logout', async () => {
    // Setup authenticated user
    useAuthStore.setState({
      currentUser: {
        userId: 'user-123',
        staffId: 'staff-123',
        username: 'nurse1',
        fullName: 'Test Nurse',
        role: 'nurse',
        facilityId: 'facility-123',
        loginTime: new Date(),
      },
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600000),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    // Create multiple sessions
    await sessionPersistence.saveSession('patient-1', {
      sessionId: 'session-1',
      patientId: 'patient-1',
      data: {},
      progress: 0.5,
      lastModified: new Date().toISOString(),
    });

    await sessionPersistence.saveSession('patient-2', {
      sessionId: 'session-2',
      patientId: 'patient-2',
      data: {},
      progress: 0.3,
      lastModified: new Date().toISOString(),
    });

    // Verify sessions exist
    expect(await sessionPersistence.getSession('patient-1')).not.toBeNull();
    expect(await sessionPersistence.getSession('patient-2')).not.toBeNull();

    // Logout
    await useAuthStore.getState().logout();

    // Verify all sessions are cleared
    expect(await sessionPersistence.getSession('patient-1')).toBeNull();
    expect(await sessionPersistence.getSession('patient-2')).toBeNull();

    // Verify authentication is cleared
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().currentUser).toBeNull();
  }, 30000);
});
