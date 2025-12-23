import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_CONFIG } from '@constants/config';
import { networkService } from '@services/networkService';
import { getCurrentServer } from './settingsStore';
import { ServerConfig } from '../config/servers';

export type StaffRole = 'nurse' | 'care_worker' | 'care_manager' | 'doctor' | 'therapist' | 'dietitian';

export interface User {
  userId: string;        // NOW THIS IS THE REAL STAFF_ID UUID from database!
  staffId: string;       // Same as userId, explicit for clarity
  username: string;
  fullName: string;
  fullNameJa?: string;
  role: StaffRole;
  facilityId: string;
  loginTime: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface AuthStore {
  currentUser: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastUsername: string | null; // Track last logged in user for offline restoration
  currentServer: ServerConfig | null; // Track current server for auth context

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateUserProfile: (updates: Partial<User>) => void;
  scheduleTokenRefresh: () => void;
  clearTokenRefreshTimer: () => void;
  updateServerContext: (server: ServerConfig) => Promise<void>;
  handleServerSwitch: (newServer: ServerConfig) => Promise<void>;
}

const AUTH_STORAGE_KEY = '@verbumcare_auth';
const TOKEN_STORAGE_KEY = '@verbumcare_tokens';
const LAST_USERNAME_KEY = '@verbumcare_last_username';
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiration

let tokenRefreshTimer: NodeJS.Timeout | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  currentUser: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  lastUsername: null,
  currentServer: null,

  login: async (username: string, password: string) => {
    try {
      // Check network connectivity - required for new login
      if (!networkService.isConnected()) {
        console.error('❌ Login requires network connectivity');
        return false;
      }

      // Get current server configuration
      const currentServer = getCurrentServer();
      const baseUrl = currentServer.baseUrl.replace('/api', ''); // Remove /api suffix for auth endpoint
      
      // Call backend auth API using current server
      const response = await axios.post(
        `${baseUrl}/api/auth/login`,
        {
          username,
          password,
          deviceInfo: {
            platform: 'ios',
            appVersion: '1.0.0',
          },
        },
        {
          timeout: currentServer.connectionTimeout,
          httpsAgent: { rejectUnauthorized: false } as any,
        }
      );

      if (!response.data.success) {
        return false;
      }

      const { user, accessToken, refreshToken, expiresIn } = response.data.data;

      const userWithTimestamp: User = {
        ...user,
        loginTime: new Date(),
      };

      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };

      // Save to AsyncStorage with server context
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithTimestamp));
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
      await AsyncStorage.setItem(LAST_USERNAME_KEY, username);
      await AsyncStorage.setItem(`${AUTH_STORAGE_KEY}_server`, currentServer.id);

      set({
        currentUser: userWithTimestamp,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        lastUsername: username,
        currentServer,
      });

      // Schedule automatic token refresh
      get().scheduleTokenRefresh();

      console.log('✅ Login successful:', {
        username: user.username,
        staffId: user.staffId, // This is now the real UUID!
        role: user.role,
        server: currentServer.displayName,
      });

      return true;
    } catch (error: any) {
      console.error('❌ Login error:', error.response?.data || error.message);
      return false;
    }
  },

  logout: async () => {
    try {
      const { tokens, currentServer } = get();

      // Clear token refresh timer
      get().clearTokenRefreshTimer();

      // Call backend logout if network available and server context exists
      if (tokens?.accessToken && networkService.isConnected() && currentServer) {
        try {
          const baseUrl = currentServer.baseUrl.replace('/api', '');
          await axios.post(
            `${baseUrl}/api/auth/logout`,
            { accessToken: tokens.accessToken },
            {
              timeout: 5000,
              httpsAgent: { rejectUnauthorized: false } as any,
            }
          );
        } catch (error) {
          console.warn('Logout API call failed (continuing with local cleanup):', error);
        }
      }

      // Clear ALL user data from AsyncStorage
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(LAST_USERNAME_KEY);
      await AsyncStorage.removeItem(`${AUTH_STORAGE_KEY}_server`);
      
      // Clear all user-scoped cache data
      const allKeys = await AsyncStorage.getAllKeys();
      const userCacheKeys = allKeys.filter(key => 
        key.startsWith('@user_') || 
        key.startsWith('@verbumcare_cache_') ||
        key.startsWith('@session_')
      );
      if (userCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(userCacheKeys);
      }

      // Clear store
      set({
        currentUser: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        lastUsername: null,
        currentServer: null,
      });

      console.log('✅ Logout successful - all user data cleared');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });

      // Add timeout to prevent hanging on AsyncStorage
      const checkAuthWithTimeout = async () => {
        // Check if tokens stored
        const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        const storedTokens = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        const storedLastUsername = await AsyncStorage.getItem(LAST_USERNAME_KEY);
        const storedServerId = await AsyncStorage.getItem(`${AUTH_STORAGE_KEY}_server`);

        if (!storedUser || !storedTokens) {
          set({
            currentUser: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
            lastUsername: storedLastUsername,
            currentServer: null,
          });
          return;
        }

        return { storedUser, storedTokens, storedLastUsername, storedServerId };
      };

      // Race against timeout
      const result = await Promise.race([
        checkAuthWithTimeout(),
        new Promise<undefined>((_, reject) => 
          setTimeout(() => reject(new Error('Auth check timeout')), 5000)
        )
      ]);

      if (!result) {
        // No stored auth or timeout
        return;
      }

      const { storedUser, storedTokens, storedLastUsername, storedServerId } = result;

      // Parse stored data with backward compatibility
      const user: User = JSON.parse(storedUser);
      const tokens: AuthTokens = JSON.parse(storedTokens);
      
      // Get server context - use current server if stored server not available
      let serverContext: ServerConfig | null = null;
      if (storedServerId) {
        try {
          const currentServer = getCurrentServer();
          serverContext = currentServer.id === storedServerId ? currentServer : null;
        } catch (error) {
          console.warn('Could not get server context during auth check:', error);
        }
      }
      
      // Ensure expiresAt is a Date object (backward compatibility)
      if (typeof tokens.expiresAt === 'string') {
        tokens.expiresAt = new Date(tokens.expiresAt);
      }
      
      const expiresAt = new Date(tokens.expiresAt);

      // Check if token expired
      if (expiresAt < new Date()) {
        console.log('Token expired, attempting refresh...');
        
        // Only attempt refresh if network is available
        if (networkService.isConnected()) {
          const refreshed = await get().refreshToken();
          if (!refreshed) {
            // Refresh failed, but keep session for offline use
            console.log('Token refresh failed, maintaining offline session');
            set({
              currentUser: user,
              tokens,
              isAuthenticated: true,
              isLoading: false,
              lastUsername: storedLastUsername,
              currentServer: serverContext,
            });
          }
        } else {
          // Offline - restore session anyway for offline operation
          console.log('Offline - restoring session for offline operation');
          set({
            currentUser: user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
            lastUsername: storedLastUsername,
            currentServer: serverContext,
          });
        }
        return;
      }

      // Token still valid - restore session
      set({
        currentUser: user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        lastUsername: storedLastUsername,
        currentServer: serverContext,
      });

      // Schedule automatic token refresh
      get().scheduleTokenRefresh();

      console.log('✅ Auth session restored:', user.username, serverContext ? `on ${serverContext.displayName}` : '(no server context)');
    } catch (error) {
      console.error('Check auth error:', error);
      // CRITICAL: Always set isLoading to false, even on error
      // This prevents the app from hanging on splash screen
      set({
        currentUser: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        lastUsername: null,
        currentServer: null,
      });
    }
  },

  refreshToken: async () => {
    try {
      const { tokens, currentServer } = get();

      if (!tokens?.refreshToken) {
        return false;
      }

      // Check network connectivity - required for token refresh
      if (!networkService.isConnected()) {
        console.log('Cannot refresh token - no network connectivity');
        return false;
      }

      // Use current server or fallback to default configuration
      const server = currentServer || getCurrentServer();
      const baseUrl = server.baseUrl.replace('/api', '');

      const response = await axios.post(
        `${baseUrl}/api/auth/refresh`,
        { refreshToken: tokens.refreshToken },
        {
          timeout: server.connectionTimeout,
          httpsAgent: { rejectUnauthorized: false } as any,
        }
      );

      if (!response.data.success) {
        return false;
      }

      const { accessToken, expiresIn } = response.data.data;

      const newTokens: AuthTokens = {
        ...tokens,
        accessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };

      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(newTokens));

      set({ tokens: newTokens });

      // Schedule next refresh
      get().scheduleTokenRefresh();

      console.log('✅ Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  },

  scheduleTokenRefresh: () => {
    const { tokens } = get();
    
    // Clear any existing timer
    get().clearTokenRefreshTimer();
    
    if (!tokens?.expiresAt) {
      return;
    }

    const expiresAt = new Date(tokens.expiresAt).getTime();
    const now = Date.now();
    const timeUntilRefresh = expiresAt - now - TOKEN_REFRESH_BUFFER;

    if (timeUntilRefresh > 0) {
      console.log(`Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
      tokenRefreshTimer = setTimeout(async () => {
        console.log('Automatic token refresh triggered');
        const refreshed = await get().refreshToken();
        if (!refreshed) {
          console.warn('Automatic token refresh failed');
        }
      }, timeUntilRefresh);
    } else {
      // Token expires soon or already expired, refresh immediately
      console.log('Token expires soon, refreshing immediately');
      get().refreshToken();
    }
  },

  clearTokenRefreshTimer: () => {
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
      tokenRefreshTimer = null;
    }
  },

  updateUserProfile: (updates: Partial<User>) => {
    const { currentUser } = get();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      set({ currentUser: updatedUser });

      AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser)).catch(err =>
        console.error('Error saving user profile:', err)
      );
    }
  },

  updateServerContext: async (server: ServerConfig): Promise<void> => {
    try {
      // Update server context in auth store
      set({ currentServer: server });
      
      // Save server context to storage if user is authenticated
      const { isAuthenticated } = get();
      if (isAuthenticated) {
        await AsyncStorage.setItem(`${AUTH_STORAGE_KEY}_server`, server.id);
        console.log(`✅ Auth server context updated to: ${server.displayName}`);
      }
    } catch (error) {
      console.error('❌ Failed to update auth server context:', error);
    }
  },

  handleServerSwitch: async (newServer: ServerConfig): Promise<void> => {
    try {
      const { isAuthenticated, tokens } = get();
      
      if (!isAuthenticated || !tokens) {
        // Not authenticated, just update server context
        await get().updateServerContext(newServer);
        return;
      }

      console.log(`🔄 Handling server switch in auth store: ${newServer.displayName}`);

      // Update server context
      await get().updateServerContext(newServer);

      // Check if we need to re-authenticate on the new server
      if (networkService.isConnected()) {
        try {
          // Test if current token works on new server
          const baseUrl = newServer.baseUrl.replace('/api', '');
          const response = await axios.get(
            `${baseUrl}/api/auth/verify`,
            {
              headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
              },
              timeout: newServer.connectionTimeout,
              httpsAgent: { rejectUnauthorized: false } as any,
            }
          );

          if (response.data.success) {
            console.log('✅ Token valid on new server');
          } else {
            console.log('⚠️ Token not valid on new server - re-authentication may be required');
          }
        } catch (error) {
          console.log('⚠️ Could not verify token on new server - re-authentication may be required');
        }
      }

      console.log('✅ Server switch handled in auth store');
    } catch (error) {
      console.error('❌ Error handling server switch in auth store:', error);
    }
  },
}));

// ========== HELPER FUNCTIONS ==========

/**
 * Get current authenticated user's staff ID (database UUID)
 * This is the REAL staff_id that should be used for all API calls
 * @throws Error if no authenticated user
 */
export const getCurrentStaffId = (): string => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser?.staffId) {
    throw new Error('No authenticated user - cannot get staff ID');
  }
  return currentUser.staffId;
};

/**
 * Get current user's staff ID or return null if not authenticated
 * Safer version that doesn't throw
 */
export const getCurrentStaffIdOrNull = (): string | null => {
  const { currentUser } = useAuthStore.getState();
  return currentUser?.staffId || null;
};

/**
 * Get current server from auth store context
 * Safer version that doesn't throw
 */
export const getCurrentServerFromAuth = (): ServerConfig | null => {
  const { currentServer } = useAuthStore.getState();
  return currentServer;
};

/**
 * Get role display name in Japanese or English
 */
export const getRoleDisplayName = (role: StaffRole, language: 'ja' | 'en'): string => {
  const roleNames: Record<StaffRole, { ja: string; en: string }> = {
    nurse: { ja: '看護師', en: 'Nurse' },
    care_worker: { ja: '介護職員', en: 'Care Worker' },
    care_manager: { ja: 'ケアマネジャー', en: 'Care Manager' },
    doctor: { ja: '医師', en: 'Doctor' },
    therapist: { ja: '療法士', en: 'Therapist' },
    dietitian: { ja: '栄養士', en: 'Dietitian' },
  };

  return language === 'ja' ? roleNames[role].ja : roleNames[role].en;
};
