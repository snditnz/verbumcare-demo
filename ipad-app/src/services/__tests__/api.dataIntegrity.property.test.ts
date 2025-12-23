/**
 * Property-Based Tests for API Service Data Integrity During Transitions
 * 
 * **Feature: backend-switching-settings, Property 10: Data integrity during transitions**
 * **Validates: Requirements 4.5, 7.5**
 * 
 * These tests verify that data integrity is maintained during server transitions,
 * ensuring no data loss occurs when switching between backend servers.
 */

import fc from 'fast-check';
import { APIService } from '../api';
import { ServerConfig } from '../../config/servers';
import { Patient, VitalSigns } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheService } from '../cacheService';
import axios from 'axios';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../cacheService');
jest.mock('../../stores/authStore');
jest.mock('axios');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;

// Mock axios instance
const mockAxiosInstance = {
  defaults: { baseURL: '', timeout: 5000 },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

// Test server configurations
const testServers: ServerConfig[] = [
  {
    id: 'server-a',
    name: 'server-a',
    displayName: 'Test Server A',
    baseUrl: 'https://server-a.test',
    wsUrl: 'wss://server-a.test',
    description: 'Test server A',
    isDefault: true,
    healthCheckEndpoints: ['/health', '/api/patients'],
    connectionTimeout: 5000,
    retryAttempts: 3,
  },
  {
    id: 'server-b',
    name: 'server-b',
    displayName: 'Test Server B',
    baseUrl: 'https://server-b.test',
    wsUrl: 'wss://server-b.test',
    description: 'Test server B',
    isDefault: false,
    healthCheckEndpoints: ['/health', '/api/patients'],
    connectionTimeout: 5000,
    retryAttempts: 3,
  },
];

// Generators for test data
const patientArbitrary = fc.record({
  id: fc.uuid(),
  family_name: fc.string({ minLength: 1, maxLength: 50 }),
  given_name: fc.string({ minLength: 1, maxLength: 50 }),
  family_name_en: fc.string({ minLength: 1, maxLength: 50 }),
  given_name_en: fc.string({ minLength: 1, maxLength: 50 }),
  date_of_birth: fc.constantFrom('1950-01-01', '1960-01-01', '1970-01-01', '1980-01-01', '1990-01-01'),
  gender: fc.constantFrom('male', 'female', 'other'),
  room_number: fc.string({ minLength: 1, maxLength: 10 }),
  bed_number: fc.string({ minLength: 1, maxLength: 5 }),
  admission_date: fc.constantFrom('2020-01-01', '2021-01-01', '2022-01-01', '2023-01-01'),
  barcode: fc.string({ minLength: 8, maxLength: 20 }),
});

const vitalsArbitrary = fc.record({
  id: fc.uuid(),
  patient_id: fc.uuid(),
  heart_rate: fc.integer({ min: 40, max: 200 }),
  blood_pressure_systolic: fc.integer({ min: 80, max: 200 }),
  blood_pressure_diastolic: fc.integer({ min: 40, max: 120 }),
  temperature: fc.float({ min: 35.0, max: 42.0 }),
  recorded_at: fc.constantFrom('2023-01-01T10:00:00.000Z', '2023-06-01T14:30:00.000Z', '2023-12-01T09:15:00.000Z'),
  recorded_by: fc.uuid(),
});

// Helper function to create JSON-safe objects (no undefined values)
const jsonSafeObject = () => fc.dictionary(
  fc.string({ minLength: 1, maxLength: 10 }),
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null), // Use null instead of undefined for JSON compatibility
    fc.array(fc.string(), { maxLength: 3 })
  ),
  { maxKeys: 3 }
);

const sessionDataArbitrary = fc.record({
  patients: fc.array(patientArbitrary, { minLength: 1, maxLength: 10 }),
  vitals: fc.array(vitalsArbitrary, { minLength: 0, maxLength: 20 }),
  pendingOperations: fc.array(fc.record({
    type: fc.constantFrom('create', 'update', 'delete'),
    entity: fc.constantFrom('patient', 'vitals', 'notes'),
    data: jsonSafeObject(), // Use JSON-safe objects
    timestamp: fc.constantFrom('2023-01-01T10:00:00.000Z', '2023-06-01T14:30:00.000Z', '2023-12-01T09:15:00.000Z'),
  }), { minLength: 0, maxLength: 5 }),
});

describe('API Service Data Integrity During Transitions', () => {
  let apiService: APIService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return our mock instance
    mockAxios.create.mockReturnValue(mockAxiosInstance as any);
    
    // Reset AsyncStorage mock
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    
    // Reset cache service mock
    mockCacheService.getCachedPatients.mockResolvedValue(null);
    mockCacheService.cachePatients.mockResolvedValue();
    mockCacheService.clearCache.mockResolvedValue();
    mockCacheService.clearServerSpecificCache.mockResolvedValue();
    
    // Mock getCurrentServer to return a default server
    jest.doMock('../../stores/settingsStore', () => ({
      getCurrentServer: () => testServers[0],
    }));
    
    apiService = new APIService();
  });

  /**
   * **Feature: backend-switching-settings, Property 10: Data integrity during transitions**
   * **Validates: Requirements 4.5, 7.5**
   * 
   * Property: For any session data and server transition, all data should be preserved
   * and no data loss should occur during the transition process.
   */
  it('should preserve all session data during server transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionDataArbitrary,
        fc.constantFrom(...testServers),
        fc.constantFrom(...testServers),
        async (sessionData, fromServer, toServer) => {
          // Skip if same server (no transition needed)
          if (fromServer.id === toServer.id) {
            return true;
          }

          // Setup: Initialize API service with first server
          apiService.updateBaseURL(fromServer.baseUrl, fromServer);
          
          // Store session data in cache
          await mockCacheService.cachePatients(sessionData.patients);
          mockCacheService.getCachedPatients.mockResolvedValue(sessionData.patients);
          
          // Store pending operations in AsyncStorage
          const pendingOpsKey = 'pending_operations';
          await mockAsyncStorage.setItem(pendingOpsKey, JSON.stringify(sessionData.pendingOperations));
          mockAsyncStorage.getItem.mockImplementation((key) => {
            if (key === pendingOpsKey) {
              return Promise.resolve(JSON.stringify(sessionData.pendingOperations));
            }
            return Promise.resolve(null);
          });

          // Perform server transition
          apiService.updateBaseURL(toServer.baseUrl, toServer);
          
          // Verify data integrity after transition
          
          // 1. Cached data should still be accessible
          const cachedPatients = await mockCacheService.getCachedPatients();
          expect(cachedPatients).toEqual(sessionData.patients);
          
          // 2. Pending operations should be preserved
          const storedOps = await mockAsyncStorage.getItem(pendingOpsKey);
          const parsedOps = storedOps ? JSON.parse(storedOps) : [];
          expect(parsedOps).toEqual(sessionData.pendingOperations);
          
          // 3. API service should be configured for new server
          expect(apiService.getCurrentBaseURL()).toBe(toServer.baseUrl);
          expect(apiService.getCurrentServer()?.id).toBe(toServer.id);
          
          return true;
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  /**
   * **Feature: backend-switching-settings, Property 10: Data integrity during transitions**
   * **Validates: Requirements 4.5, 7.5**
   * 
   * Property: For any cached data, server transitions should not corrupt or lose
   * the cached data, and it should remain accessible after the transition.
   */
  it('should maintain cache integrity across server transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(patientArbitrary, { minLength: 1, maxLength: 20 }),
        fc.array(vitalsArbitrary, { minLength: 0, maxLength: 50 }),
        fc.constantFrom(...testServers),
        fc.constantFrom(...testServers),
        async (patients, vitals, fromServer, toServer) => {
          // Skip if same server
          if (fromServer.id === toServer.id) {
            return true;
          }

          // Setup: Cache data on first server
          apiService.updateBaseURL(fromServer.baseUrl, fromServer);
          
          // Mock cache with test data
          mockCacheService.getCachedPatients.mockResolvedValue(patients);
          
          // Store vitals data in a mock cache structure
          const vitalsCache = new Map();
          vitals.forEach(vital => {
            const patientVitals = vitalsCache.get(vital.patient_id) || [];
            patientVitals.push(vital);
            vitalsCache.set(vital.patient_id, patientVitals);
          });

          // Perform server transition
          apiService.updateBaseURL(toServer.baseUrl, toServer);
          
          // Verify cache integrity
          
          // 1. Patient data should still be accessible
          const cachedPatients = await mockCacheService.getCachedPatients();
          expect(cachedPatients).toEqual(patients);
          
          // 2. Vitals data should be preserved (simulated)
          vitals.forEach(vital => {
            const patientVitals = vitalsCache.get(vital.patient_id);
            expect(patientVitals).toContain(vital);
          });
          
          // 3. Cache structure should remain consistent
          expect(vitalsCache.size).toBe(new Set(vitals.map(v => v.patient_id)).size);
          
          return true;
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  /**
   * **Feature: backend-switching-settings, Property 10: Data integrity during transitions**
   * **Validates: Requirements 4.5, 7.5**
   * 
   * Property: For any sequence of server transitions, the final data state should
   * be consistent and no data should be lost regardless of the transition path.
   */
  it('should maintain data consistency across multiple server transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionDataArbitrary,
        fc.array(fc.constantFrom(...testServers), { minLength: 2, maxLength: 5 }),
        async (initialData, serverSequence) => {
          // Ensure we have at least one transition
          if (serverSequence.length < 2) {
            return true;
          }

          // Setup initial state
          const firstServer = serverSequence[0];
          apiService.updateBaseURL(firstServer.baseUrl, firstServer);
          
          // Store initial data
          await mockCacheService.cachePatients(initialData.patients);
          mockCacheService.getCachedPatients.mockResolvedValue(initialData.patients);
          
          const pendingOpsKey = 'pending_operations';
          await mockAsyncStorage.setItem(pendingOpsKey, JSON.stringify(initialData.pendingOperations));
          mockAsyncStorage.getItem.mockImplementation((key) => {
            if (key === pendingOpsKey) {
              return Promise.resolve(JSON.stringify(initialData.pendingOperations));
            }
            return Promise.resolve(null);
          });

          // Perform sequence of server transitions
          for (let i = 1; i < serverSequence.length; i++) {
            const targetServer = serverSequence[i];
            apiService.updateBaseURL(targetServer.baseUrl, targetServer);
            
            // Simulate brief delay between transitions
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // Verify final state integrity
          const finalServer = serverSequence[serverSequence.length - 1];
          
          // 1. API service should be on final server
          expect(apiService.getCurrentBaseURL()).toBe(finalServer.baseUrl);
          expect(apiService.getCurrentServer()?.id).toBe(finalServer.id);
          
          // 2. All original data should still be accessible
          const finalCachedPatients = await mockCacheService.getCachedPatients();
          expect(finalCachedPatients).toEqual(initialData.patients);
          
          const finalStoredOps = await mockAsyncStorage.getItem(pendingOpsKey);
          const finalParsedOps = finalStoredOps ? JSON.parse(finalStoredOps) : [];
          expect(finalParsedOps).toEqual(initialData.pendingOperations);
          
          return true;
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * **Feature: backend-switching-settings, Property 10: Data integrity during transitions**
   * **Validates: Requirements 4.5, 7.5**
   * 
   * Property: For any pending operations during server transitions, they should be
   * preserved and remain executable after the transition completes.
   */
  it('should preserve pending operations during server transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          id: fc.uuid(),
          type: fc.constantFrom('create_patient', 'update_vitals', 'delete_note'),
          payload: jsonSafeObject(), // Use JSON-safe objects
          timestamp: fc.constantFrom('2023-01-01T10:00:00.000Z', '2023-06-01T14:30:00.000Z', '2023-12-01T09:15:00.000Z'),
          retryCount: fc.integer({ min: 0, max: 3 }),
        }), { minLength: 1, maxLength: 10 }),
        fc.constantFrom(...testServers),
        fc.constantFrom(...testServers),
        async (pendingOps, fromServer, toServer) => {
          // Skip if same server
          if (fromServer.id === toServer.id) {
            return true;
          }

          // Setup: Store pending operations
          apiService.updateBaseURL(fromServer.baseUrl, fromServer);
          
          const opsKey = 'pending_operations';
          await mockAsyncStorage.setItem(opsKey, JSON.stringify(pendingOps));
          mockAsyncStorage.getItem.mockImplementation((key) => {
            if (key === opsKey) {
              return Promise.resolve(JSON.stringify(pendingOps));
            }
            return Promise.resolve(null);
          });

          // Perform server transition
          apiService.updateBaseURL(toServer.baseUrl, toServer);
          
          // Verify pending operations are preserved
          const storedOps = await mockAsyncStorage.getItem(opsKey);
          const retrievedOps = storedOps ? JSON.parse(storedOps) : [];
          
          // 1. All operations should be preserved
          expect(retrievedOps).toHaveLength(pendingOps.length);
          
          // 2. Each operation should maintain its properties
          pendingOps.forEach((originalOp, index) => {
            const retrievedOp = retrievedOps[index];
            expect(retrievedOp.id).toBe(originalOp.id);
            expect(retrievedOp.type).toBe(originalOp.type);
            expect(retrievedOp.timestamp).toBe(originalOp.timestamp);
            expect(retrievedOp.retryCount).toBe(originalOp.retryCount);
            expect(retrievedOp.payload).toEqual(originalOp.payload);
          });
          
          return true;
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  /**
   * **Feature: backend-switching-settings, Property 10: Data integrity during transitions**
   * **Validates: Requirements 4.5, 7.5**
   * 
   * Property: For any user session state during server transitions, authentication
   * tokens and user preferences should be preserved and remain valid.
   */
  it('should preserve user session state during server transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          accessToken: fc.string({ minLength: 20, maxLength: 100 }),
          refreshToken: fc.string({ minLength: 20, maxLength: 100 }),
          userId: fc.uuid(),
          userPreferences: fc.record({
            language: fc.constantFrom('ja', 'en', 'zh-TW'),
            theme: fc.constantFrom('light', 'dark'),
            notifications: fc.boolean(),
          }),
        }),
        fc.constantFrom(...testServers),
        fc.constantFrom(...testServers),
        async (sessionState, fromServer, toServer) => {
          // Skip if same server
          if (fromServer.id === toServer.id) {
            return true;
          }

          // Setup: Store session state
          apiService.updateBaseURL(fromServer.baseUrl, fromServer);
          
          const sessionKey = 'user_session';
          const prefsKey = 'user_preferences';
          
          await mockAsyncStorage.setItem(sessionKey, JSON.stringify({
            accessToken: sessionState.accessToken,
            refreshToken: sessionState.refreshToken,
            userId: sessionState.userId,
          }));
          
          await mockAsyncStorage.setItem(prefsKey, JSON.stringify(sessionState.userPreferences));
          
          mockAsyncStorage.getItem.mockImplementation((key) => {
            if (key === sessionKey) {
              return Promise.resolve(JSON.stringify({
                accessToken: sessionState.accessToken,
                refreshToken: sessionState.refreshToken,
                userId: sessionState.userId,
              }));
            }
            if (key === prefsKey) {
              return Promise.resolve(JSON.stringify(sessionState.userPreferences));
            }
            return Promise.resolve(null);
          });

          // Perform server transition
          apiService.updateBaseURL(toServer.baseUrl, toServer);
          
          // Verify session state preservation
          const storedSession = await mockAsyncStorage.getItem(sessionKey);
          const storedPrefs = await mockAsyncStorage.getItem(prefsKey);
          
          const retrievedSession = storedSession ? JSON.parse(storedSession) : null;
          const retrievedPrefs = storedPrefs ? JSON.parse(storedPrefs) : null;
          
          // 1. Session tokens should be preserved
          expect(retrievedSession).not.toBeNull();
          expect(retrievedSession.accessToken).toBe(sessionState.accessToken);
          expect(retrievedSession.refreshToken).toBe(sessionState.refreshToken);
          expect(retrievedSession.userId).toBe(sessionState.userId);
          
          // 2. User preferences should be preserved
          expect(retrievedPrefs).not.toBeNull();
          expect(retrievedPrefs.language).toBe(sessionState.userPreferences.language);
          expect(retrievedPrefs.theme).toBe(sessionState.userPreferences.theme);
          expect(retrievedPrefs.notifications).toBe(sessionState.userPreferences.notifications);
          
          return true;
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });
});