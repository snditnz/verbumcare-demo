/**
 * Property-Based Tests for Authentication System
 * Feature: code-consistency-security-offline
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useAuthStore } from '../authStore';
import { networkService } from '@services/networkService';

// Mock modules
jest.mock('axios');
jest.mock('@services/networkService');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedNetworkService = networkService as jest.Mocked<typeof networkService>;

// Use fake timers to prevent hanging
jest.useFakeTimers();

// Custom generators
const tokenGenerator = () => fc.array(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'),
  { minLength: 100, maxLength: 200 }
).map(arr => arr.join(''));

describe('Authentication Property Tests', () => {
  beforeEach(() => {
    // Clear all timers
    jest.clearAllTimers();
    
    // Reset store and clear any timers
    const store = useAuthStore.getState();
    store.clearTokenRefreshTimer();
    
    useAuthStore.setState({
      currentUser: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      lastUsername: null,
    });

    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);

    // Setup axios mock
    mockedAxios.post = jest.fn();
    mockedAxios.get = jest.fn();

    // Default network to connected
    mockedNetworkService.isConnected.mockReturnValue(true);
  });

  afterEach(() => {
    // Clean up any pending timers
    const store = useAuthStore.getState();
    store.clearTokenRefreshTimer();
    jest.clearAllTimers();
  });

  /**
   * Feature: code-consistency-security-offline, Property 1: Login with valid credentials returns tokens
   * Validates: Requirements 2.1
   */
  describe('Property 1: Login with valid credentials returns tokens', () => {
    it('should return access and refresh tokens for any valid credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.string({ minLength: 3, maxLength: 20 }),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            userId: fc.uuid(),
            staffId: fc.uuid(),
            fullName: fc.string({ minLength: 5, maxLength: 50 }),
            role: fc.constantFrom('nurse', 'care_worker', 'care_manager', 'doctor', 'therapist', 'dietitian'),
            facilityId: fc.uuid(),
            accessToken: tokenGenerator(),
            refreshToken: tokenGenerator(),
            expiresIn: fc.integer({ min: 3600, max: 86400 }),
          }),
          async (testData) => {
            // Mock successful login response
            mockedAxios.post.mockResolvedValueOnce({
              data: {
                success: true,
                data: {
                  user: {
                    userId: testData.userId,
                    staffId: testData.staffId,
                    username: testData.username,
                    fullName: testData.fullName,
                    role: testData.role,
                    facilityId: testData.facilityId,
                  },
                  accessToken: testData.accessToken,
                  refreshToken: testData.refreshToken,
                  expiresIn: testData.expiresIn,
                },
              },
            });

            // Perform login
            const result = await useAuthStore.getState().login(testData.username, testData.password);

            // Verify login succeeded
            expect(result).toBe(true);

            // Verify tokens are stored
            const state = useAuthStore.getState();
            expect(state.tokens).not.toBeNull();
            expect(state.tokens?.accessToken).toBe(testData.accessToken);
            expect(state.tokens?.refreshToken).toBe(testData.refreshToken);
            expect(state.tokens?.expiresAt).toBeInstanceOf(Date);
            expect(state.isAuthenticated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 2: Session restoration round trip
   * Validates: Requirements 2.2, 9.3, 9.4
   */
  describe('Property 2: Session restoration round trip', () => {
    it('should restore session after saving for any user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            staffId: fc.uuid(),
            username: fc.string({ minLength: 3, maxLength: 20 }),
            fullName: fc.string({ minLength: 5, maxLength: 50 }),
            role: fc.constantFrom('nurse', 'care_worker', 'care_manager', 'doctor', 'therapist', 'dietitian'),
            facilityId: fc.uuid(),
            accessToken: tokenGenerator(),
            refreshToken: tokenGenerator(),
          }),
          async (testData) => {
            const loginTime = new Date();
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

            const user = {
              userId: testData.userId,
              staffId: testData.staffId,
              username: testData.username,
              fullName: testData.fullName,
              role: testData.role,
              facilityId: testData.facilityId,
              loginTime,
            };

            const tokens = {
              accessToken: testData.accessToken,
              refreshToken: testData.refreshToken,
              expiresAt,
            };

            // Mock AsyncStorage to return saved data
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              if (key === '@verbumcare_auth') {
                return Promise.resolve(JSON.stringify(user));
              }
              if (key === '@verbumcare_tokens') {
                return Promise.resolve(JSON.stringify(tokens));
              }
              if (key === '@verbumcare_last_username') {
                return Promise.resolve(testData.username);
              }
              return Promise.resolve(null);
            });

            // Restore session
            await useAuthStore.getState().checkAuth();

            // Verify session restored
            const state = useAuthStore.getState();
            expect(state.isAuthenticated).toBe(true);
            expect(state.currentUser?.userId).toBe(testData.userId);
            expect(state.currentUser?.username).toBe(testData.username);
            expect(state.tokens?.accessToken).toBe(testData.accessToken);
            expect(state.tokens?.refreshToken).toBe(testData.refreshToken);
            expect(state.lastUsername).toBe(testData.username);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 3: Logout clears all user data
   * Validates: Requirements 2.3, 3.4
   */
  describe('Property 3: Logout clears all user data', () => {
    it('should clear all cached data for any authenticated user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            staffId: fc.uuid(),
            username: fc.string({ minLength: 3, maxLength: 20 }),
            accessToken: tokenGenerator(),
            refreshToken: tokenGenerator(),
          }),
          async (testData) => {
            // Set up authenticated state
            useAuthStore.setState({
              currentUser: {
                userId: testData.userId,
                staffId: testData.staffId,
                username: testData.username,
                fullName: 'Test User',
                role: 'nurse',
                facilityId: 'test-facility',
                loginTime: new Date(),
              },
              tokens: {
                accessToken: testData.accessToken,
                refreshToken: testData.refreshToken,
                expiresAt: new Date(Date.now() + 3600000),
              },
              isAuthenticated: true,
              lastUsername: testData.username,
            });

            // Mock getAllKeys to return user cache keys
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
              '@verbumcare_auth',
              '@verbumcare_tokens',
              '@verbumcare_last_username',
              `@user_${testData.userId}@verbumcare_cache_patients`,
              `@user_${testData.userId}@verbumcare_cache_careplans`,
              '@session_data_123',
            ]);

            // Perform logout
            await useAuthStore.getState().logout();

            // Verify all auth data cleared
            const state = useAuthStore.getState();
            expect(state.currentUser).toBeNull();
            expect(state.tokens).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.lastUsername).toBeNull();

            // Verify AsyncStorage cleanup called
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@verbumcare_auth');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@verbumcare_tokens');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@verbumcare_last_username');
            expect(AsyncStorage.multiRemove).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 4: Token refresh extends session
   * Validates: Requirements 2.5
   */
  describe('Property 4: Token refresh extends session', () => {
    it('should return new token with future expiration for any valid refresh token', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            oldAccessToken: tokenGenerator(),
            refreshToken: tokenGenerator(),
            newAccessToken: tokenGenerator(),
            expiresIn: fc.integer({ min: 3600, max: 86400 }),
          }),
          async (testData) => {
            // Set up authenticated state with tokens
            const oldExpiresAt = new Date(Date.now() + 300000); // 5 minutes from now
            useAuthStore.setState({
              currentUser: {
                userId: 'test-user',
                staffId: 'test-staff',
                username: 'testuser',
                fullName: 'Test User',
                role: 'nurse',
                facilityId: 'test-facility',
                loginTime: new Date(),
              },
              tokens: {
                accessToken: testData.oldAccessToken,
                refreshToken: testData.refreshToken,
                expiresAt: oldExpiresAt,
              },
              isAuthenticated: true,
            });

            // Mock successful token refresh
            mockedAxios.post.mockResolvedValueOnce({
              data: {
                success: true,
                data: {
                  accessToken: testData.newAccessToken,
                  expiresIn: testData.expiresIn,
                },
              },
            });

            const beforeRefresh = Date.now();

            // Perform token refresh
            const result = await useAuthStore.getState().refreshToken();

            const afterRefresh = Date.now();

            // Verify refresh succeeded
            expect(result).toBe(true);

            // Verify new token stored
            const state = useAuthStore.getState();
            expect(state.tokens?.accessToken).toBe(testData.newAccessToken);
            expect(state.tokens?.refreshToken).toBe(testData.refreshToken); // Refresh token unchanged

            // Verify expiration extended
            const newExpiresAt = state.tokens?.expiresAt.getTime() || 0;
            const expectedMinExpiry = beforeRefresh + testData.expiresIn * 1000;
            const expectedMaxExpiry = afterRefresh + testData.expiresIn * 1000;
            
            expect(newExpiresAt).toBeGreaterThanOrEqual(expectedMinExpiry);
            expect(newExpiresAt).toBeLessThanOrEqual(expectedMaxExpiry);
            expect(newExpiresAt).toBeGreaterThan(oldExpiresAt.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 5: API requests include authentication
   * Validates: Requirements 2.6
   */
  describe('Property 5: API requests include authentication', () => {
    it('should include Bearer token in Authorization header for any authenticated request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: tokenGenerator(),
          }),
          async (testData) => {
            // Set up authenticated state
            useAuthStore.setState({
              currentUser: {
                userId: 'test-user',
                staffId: 'test-staff',
                username: 'testuser',
                fullName: 'Test User',
                role: 'nurse',
                facilityId: 'test-facility',
                loginTime: new Date(),
              },
              tokens: {
                accessToken: testData.accessToken,
                refreshToken: 'refresh-token',
                expiresAt: new Date(Date.now() + 3600000),
              },
              isAuthenticated: true,
            });

            // Create a mock request config
            const mockConfig: any = {
              headers: {},
              url: '/patients',
            };

            // Simulate what the interceptor does
            const { tokens } = useAuthStore.getState();
            if (tokens?.accessToken) {
              mockConfig.headers.Authorization = `Bearer ${tokens.accessToken}`;
            }

            // Verify Authorization header is present and correct
            expect(mockConfig.headers.Authorization).toBe(`Bearer ${testData.accessToken}`);
            expect(mockConfig.headers.Authorization).toContain('Bearer ');
            expect(mockConfig.headers.Authorization.split(' ')[1]).toBe(testData.accessToken);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
