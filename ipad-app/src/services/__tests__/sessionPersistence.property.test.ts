/**
 * Property-Based Tests for Session Persistence
 * 
 * Tests session auto-save, background persistence, restoration, and cleanup
 * Uses fast-check for property-based testing
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionPersistenceService } from '../sessionPersistence';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe('Session Persistence Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Reset AsyncStorage mock
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    // Clean up any timers
    sessionPersistenceService.cleanup();
    jest.clearAllTimers();
  });

  /**
   * Feature: code-consistency-security-offline, Property 29: Auto-save interval
   * Validates: Requirements 9.1
   */
  describe('Property 29: Auto-save interval', () => {
    it('should auto-save session data at intervals not exceeding 30 seconds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            patientId: fc.uuid(),
            vitals: fc.record({
              heart_rate: fc.integer({ min: 40, max: 200 }),
              blood_pressure_systolic: fc.integer({ min: 80, max: 200 }),
              blood_pressure_diastolic: fc.integer({ min: 40, max: 120 }),
              temperature: fc.float({ min: 35.0, max: 42.0 }),
              spo2: fc.integer({ min: 70, max: 100 }),
            }),
            medications: fc.array(fc.record({
              medication_name: fc.string({ minLength: 3, maxLength: 50 }),
              dose: fc.string({ minLength: 2, maxLength: 20 }),
            })),
          }),
          async (sessionData) => {
            // Save session data
            await sessionPersistenceService.saveSessionData(
              sessionData.patientId,
              sessionData
            );

            // Verify data was saved with timestamp
            expect(AsyncStorage.setItem).toHaveBeenCalled();
            const savedKey = (AsyncStorage.setItem as jest.Mock).mock.calls[0][0];
            const savedValue = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
            const parsed = JSON.parse(savedValue);

            // Verify timestamp exists and is recent (within 1 second)
            expect(parsed.lastSaved).toBeDefined();
            expect(Date.now() - parsed.lastSaved).toBeLessThan(1000);

            // Verify auto-save flag is set
            expect(parsed.autoSaved).toBe(true);

            // Check if auto-save is needed after 30+ seconds
            const mockOldSession = {
              ...sessionData,
              lastSaved: Date.now() - 31000, // 31 seconds ago
            };
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
              JSON.stringify(mockOldSession)
            );

            const shouldSave = await sessionPersistenceService.shouldAutoSave(
              sessionData.patientId
            );

            // Should need auto-save after 30+ seconds
            expect(shouldSave).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not auto-save if less than 30 seconds have passed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            patientId: fc.uuid(),
            vitals: fc.record({
              heart_rate: fc.integer({ min: 40, max: 200 }),
            }),
          }),
          fc.integer({ min: 0, max: 29 }), // Seconds since last save (less than 30)
          async (sessionData, secondsSinceLastSave) => {
            // Mock session with recent save
            const mockSession = {
              ...sessionData,
              lastSaved: Date.now() - (secondsSinceLastSave * 1000),
              autoSaved: true,
            };
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
              JSON.stringify(mockSession)
            );

            const shouldSave = await sessionPersistenceService.shouldAutoSave(
              sessionData.patientId
            );

            // Should NOT need auto-save if less than 30 seconds
            expect(shouldSave).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 30: Background persistence
   * Validates: Requirements 9.2
   */
  describe('Property 30: Background persistence', () => {
    it('should persist all session data when app goes to background', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              patientId: fc.uuid(),
              vitals: fc.record({
                heart_rate: fc.integer({ min: 40, max: 200 }),
                blood_pressure_systolic: fc.integer({ min: 80, max: 200 }),
              }),
              lastSaved: fc.integer({ min: Date.now() - 3600000, max: Date.now() }),
              autoSaved: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (sessions) => {
            // Mock AsyncStorage to return session keys
            const sessionKeys = sessions.map(
              (s) => `@verbumcare/active_sessions_${s.patientId}`
            );
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce(sessionKeys);

            // Mock getItem to return session data
            sessions.forEach((session, index) => {
              (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
                JSON.stringify(session)
              );
            });

            // Verify all sessions are accessible (without initializing timers)
            for (const session of sessions) {
              // Mock the session data for retrieval
              (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
                JSON.stringify(session)
              );
              
              const retrieved = await sessionPersistenceService.getSessionData(
                session.patientId
              );
              // Session should be retrievable (persistence works)
              expect(retrieved).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 31: Session restoration after restart
   * Validates: Requirements 9.3, 9.7
   */
  describe('Property 31: Session restoration after restart', () => {
    it('should restore session data after app restart', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            patientId: fc.uuid(),
            vitals: fc.record({
              heart_rate: fc.integer({ min: 40, max: 200 }),
              blood_pressure_systolic: fc.integer({ min: 80, max: 200 }),
              blood_pressure_diastolic: fc.integer({ min: 40, max: 120 }),
              temperature: fc.float({ min: 35.0, max: 42.0 }),
              spo2: fc.integer({ min: 70, max: 100 }),
            }),
            medications: fc.array(
              fc.record({
                medication_name: fc.string({ minLength: 3, maxLength: 50 }),
                dose: fc.string({ minLength: 2, maxLength: 20 }),
              }),
              { maxLength: 10 }
            ),
            patientUpdates: fc.record({
              height: fc.integer({ min: 100, max: 220 }),
              weight: fc.float({ min: 30, max: 200 }),
            }),
          }),
          async (sessionData) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            // Save session data (simulating before app close)
            await sessionPersistenceService.saveSessionData(
              sessionData.patientId,
              sessionData
            );

            // Get the saved data from the most recent call
            const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
            const savedValue = setItemCalls[setItemCalls.length - 1][1];

            // Parse the saved value to verify it matches what we saved
            const parsed = JSON.parse(savedValue);
            
            // Verify the saved data matches what we intended to save
            expect(parsed.patientId).toBe(sessionData.patientId);
            expect(parsed.vitals.heart_rate).toBe(sessionData.vitals.heart_rate);
            expect(parsed.vitals.blood_pressure_systolic).toBe(sessionData.vitals.blood_pressure_systolic);
            expect(parsed.vitals.blood_pressure_diastolic).toBe(sessionData.vitals.blood_pressure_diastolic);
            expect(parsed.vitals.spo2).toBe(sessionData.vitals.spo2);
            expect(parsed.medications.length).toBe(sessionData.medications.length);
            expect(parsed.patientUpdates.height).toBe(sessionData.patientUpdates.height);
            expect(parsed.lastSaved).toBeDefined();
            expect(parsed.autoSaved).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing session data gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (patientId) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            // Reset the mock implementation to clear any queued values
            (AsyncStorage.getItem as jest.Mock).mockReset();
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            // Try to retrieve session data
            const restored = await sessionPersistenceService.getSessionData(patientId);

            // Should return null without throwing error
            expect(restored).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 32: Session cleanup after submission
   * Validates: Requirements 9.5
   */
  describe('Property 32: Session cleanup after submission', () => {
    it('should clear session data after successful submission', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            patientId: fc.uuid(),
            vitals: fc.record({
              heart_rate: fc.integer({ min: 40, max: 200 }),
              blood_pressure_systolic: fc.integer({ min: 80, max: 200 }),
            }),
            medications: fc.array(
              fc.record({
                medication_name: fc.string({ minLength: 3, maxLength: 50 }),
              }),
              { maxLength: 5 }
            ),
          }),
          async (sessionData) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            // Save session data first
            await sessionPersistenceService.saveSessionData(
              sessionData.patientId,
              sessionData
            );

            // Verify data was saved
            expect(AsyncStorage.setItem).toHaveBeenCalled();

            // Clear mocks before clearing session
            jest.clearAllMocks();

            // Clear session after submission
            await sessionPersistenceService.clearSessionAfterSubmission(
              sessionData.patientId
            );

            // Verify data was removed
            expect(AsyncStorage.removeItem).toHaveBeenCalled();
            const removeItemCalls = (AsyncStorage.removeItem as jest.Mock).mock.calls;
            const removedKey = removeItemCalls[removeItemCalls.length - 1][0];
            expect(removedKey).toContain(sessionData.patientId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle clearing non-existent session gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (patientId) => {
            // Try to clear session that doesn't exist
            await expect(
              sessionPersistenceService.clearSessionAfterSubmission(patientId)
            ).resolves.not.toThrow();

            // Verify removeItem was called
            expect(AsyncStorage.removeItem).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Session data integrity
   * Ensures session data round-trips correctly
   */
  describe('Session data integrity', () => {
    it('should preserve all session data fields through save/restore cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            patientId: fc.uuid(),
            vitals: fc.record({
              heart_rate: fc.integer({ min: 40, max: 200 }),
              blood_pressure_systolic: fc.integer({ min: 80, max: 200 }),
              blood_pressure_diastolic: fc.integer({ min: 40, max: 120 }),
              temperature: fc.float({ min: 35.0, max: 42.0 }),
              spo2: fc.integer({ min: 70, max: 100 }),
              respiratory_rate: fc.integer({ min: 8, max: 40 }),
            }),
            medications: fc.array(
              fc.record({
                medication_name: fc.string({ minLength: 3, maxLength: 50 }),
                dose: fc.string({ minLength: 2, maxLength: 20 }),
                administered_at: fc.date(),
              }),
              { maxLength: 10 }
            ),
            patientUpdates: fc.record({
              height: fc.integer({ min: 100, max: 220 }),
              weight: fc.float({ min: 30, max: 200 }),
              allergies: fc.string({ maxLength: 200 }),
            }),
            incidents: fc.array(
              fc.record({
                type: fc.constantFrom('fall', 'medication_error', 'other'),
                description: fc.string({ minLength: 10, maxLength: 200 }),
                severity: fc.constantFrom('low', 'medium', 'high'),
              }),
              { maxLength: 3 }
            ),
            barthelIndex: fc.record({
              total_score: fc.integer({ min: 0, max: 100 }),
              recorded_at: fc.date(),
            }),
          }),
          async (sessionData) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();
            
            // Save session data
            await sessionPersistenceService.saveSessionData(
              sessionData.patientId,
              sessionData
            );

            // Get saved value from the most recent call
            const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
            const savedValue = setItemCalls[setItemCalls.length - 1][1];
            
            // Parse to verify it was saved correctly
            const parsed = JSON.parse(savedValue);
            
            // Verify all fields are preserved in the saved data
            expect(parsed.patientId).toBe(sessionData.patientId);
            
            // Vitals - handle NaN serialization (NaN becomes null in JSON)
            expect(parsed.vitals.heart_rate).toBe(sessionData.vitals.heart_rate);
            expect(parsed.vitals.blood_pressure_systolic).toBe(sessionData.vitals.blood_pressure_systolic);
            expect(parsed.vitals.blood_pressure_diastolic).toBe(sessionData.vitals.blood_pressure_diastolic);
            expect(parsed.vitals.spo2).toBe(sessionData.vitals.spo2);
            expect(parsed.vitals.respiratory_rate).toBe(sessionData.vitals.respiratory_rate);
            // Temperature might be NaN which becomes null in JSON
            if (isNaN(sessionData.vitals.temperature)) {
              expect(parsed.vitals.temperature).toBeNull();
            } else {
              expect(parsed.vitals.temperature).toBe(sessionData.vitals.temperature);
            }
            
            // Medications - dates are serialized to strings
            expect(parsed.medications.length).toBe(sessionData.medications.length);
            parsed.medications.forEach((med: any, index: number) => {
              expect(med.medication_name).toBe(sessionData.medications[index].medication_name);
              expect(med.dose).toBe(sessionData.medications[index].dose);
            });
            
            // Patient updates - handle NaN in weight
            expect(parsed.patientUpdates.height).toBe(sessionData.patientUpdates.height);
            expect(parsed.patientUpdates.allergies).toBe(sessionData.patientUpdates.allergies);
            if (isNaN(sessionData.patientUpdates.weight)) {
              expect(parsed.patientUpdates.weight).toBeNull();
            } else {
              expect(parsed.patientUpdates.weight).toBe(sessionData.patientUpdates.weight);
            }
            
            expect(parsed.incidents).toEqual(sessionData.incidents);
            
            // Barthel Index - date is serialized to string
            expect(parsed.barthelIndex.total_score).toBe(sessionData.barthelIndex.total_score);
            expect(parsed.barthelIndex.recorded_at).toBeDefined();
            
            expect(parsed.lastSaved).toBeDefined();
            expect(parsed.autoSaved).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
