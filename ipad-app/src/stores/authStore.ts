import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StaffRole = 'nurse' | 'care_worker' | 'care_manager' | 'doctor' | 'therapist' | 'dietitian';

export interface User {
  userId: string;
  username: string;
  fullName: string;
  fullNameJa?: string;
  role: StaffRole;
  loginTime: Date;
}

interface AuthStore {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => void;
}

const AUTH_STORAGE_KEY = '@verbumcare_auth';

export const useAuthStore = create<AuthStore>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username: string, password: string) => {
    try {
      // TODO: Replace with actual API call to backend
      // For now, demo authentication with hardcoded users
      const demoUsers: Record<string, { password: string; user: Omit<User, 'loginTime'> }> = {
        'nurse1': {
          password: 'demo123',
          user: {
            userId: 'nurse-001',
            username: 'nurse1',
            fullName: 'Sato Keiko',
            fullNameJa: '佐藤 恵子',
            role: 'nurse',
          },
        },
        'manager1': {
          password: 'demo123',
          user: {
            userId: 'cm-001',
            username: 'manager1',
            fullName: 'Tanaka Hiroshi',
            fullNameJa: '田中 博',
            role: 'care_manager',
          },
        },
        'doctor1': {
          password: 'demo123',
          user: {
            userId: 'doc-001',
            username: 'doctor1',
            fullName: 'Yamada Takeshi',
            fullNameJa: '山田 武',
            role: 'doctor',
          },
        },
        'demo': {
          password: 'demo',
          user: {
            userId: 'demo-001',
            username: 'demo',
            fullName: 'Demo Staff',
            fullNameJa: 'デモ 職員',
            role: 'nurse',
          },
        },
      };

      const userEntry = demoUsers[username.toLowerCase()];

      if (!userEntry || userEntry.password !== password) {
        return false; // Invalid credentials
      }

      const user: User = {
        ...userEntry.user,
        loginTime: new Date(),
      };

      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

      set({
        currentUser: user,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },

  logout: async () => {
    try {
      // Clear AsyncStorage
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);

      // Clear store
      set({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });

      // Check if user is stored in AsyncStorage
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (storedUser) {
        const user: User = JSON.parse(storedUser);

        // Optional: Check if session is still valid (e.g., within 24 hours)
        const loginTime = new Date(user.loginTime);
        const hoursSinceLogin = (Date.now() - loginTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLogin < 24) {
          // Session still valid
          set({
            currentUser: user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Session expired
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          set({
            currentUser: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        // No stored user
        set({
          currentUser: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Check auth error:', error);
      set({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  updateUserProfile: (updates: Partial<User>) => {
    const { currentUser } = get();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      set({ currentUser: updatedUser });

      // Persist to AsyncStorage
      AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser)).catch(err =>
        console.error('Error saving user profile:', err)
      );
    }
  },
}));

// Helper function to get role display name
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
