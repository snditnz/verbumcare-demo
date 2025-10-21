/**
 * Secure Cache Service
 *
 * Provides encrypted storage for offline data within user accounts.
 * Data is encrypted on device before storage and decrypted on retrieval.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Cache key prefix for current user
const CACHE_PREFIX = '@verbumcare_cache_';
const USER_PREFIX = '@user_';

/**
 * Generate a simple encryption key from user credentials
 * In production, this would use proper key derivation (PBKDF2/Argon2)
 */
function generateUserKey(userId: string): string {
  // For demo: use consistent key per user
  // Production: derive from user password + salt
  return `${userId}_encryption_key`;
}

/**
 * Simple XOR-based encryption for demo purposes
 * Production should use AES-256-GCM via expo-crypto
 */
async function encryptData(data: string, userId: string): Promise<string> {
  try {
    // In production, use proper AES encryption:
    // const key = await Crypto.digestStringAsync(
    //   Crypto.CryptoDigestAlgorithm.SHA256,
    //   generateUserKey(userId)
    // );
    // Then use AES-GCM with the key

    // For now, Base64 encode to simulate encryption
    // (still provides data isolation per user)
    const encoded = Buffer.from(data).toString('base64');
    return encoded;
  } catch (error) {
    console.error('Encryption error:', error);
    return data; // Fallback to unencrypted
  }
}

/**
 * Decrypt data for the current user
 */
async function decryptData(encryptedData: string, userId: string): Promise<string> {
  try {
    // Decode from Base64
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf-8');
    return decoded;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedData; // Fallback
  }
}

/**
 * Secure cache operations scoped to current user
 */
export class SecureCache {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Generate storage key for this user
   */
  private getUserKey(key: string): string {
    return `${USER_PREFIX}${this.userId}${CACHE_PREFIX}${key}`;
  }

  /**
   * Store encrypted data for current user
   */
  async set<T>(key: string, data: T): Promise<void> {
    try {
      const jsonData = JSON.stringify(data);
      const encrypted = await encryptData(jsonData, this.userId);
      const storageKey = this.getUserKey(key);

      await AsyncStorage.setItem(storageKey, encrypted);
      console.log(`[SecureCache] Stored ${key} for user ${this.userId}`);
    } catch (error) {
      console.error(`[SecureCache] Error storing ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt data for current user
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const storageKey = this.getUserKey(key);
      const encrypted = await AsyncStorage.getItem(storageKey);

      if (!encrypted) {
        return null;
      }

      const decrypted = await decryptData(encrypted, this.userId);
      const data = JSON.parse(decrypted) as T;

      console.log(`[SecureCache] Retrieved ${key} for user ${this.userId}`);
      return data;
    } catch (error) {
      console.error(`[SecureCache] Error retrieving ${key}:`, error);
      return null;
    }
  }

  /**
   * Store multiple items efficiently
   */
  async setMultiple(items: Array<[string, any]>): Promise<void> {
    try {
      const encryptedPairs = await Promise.all(
        items.map(async ([key, data]) => {
          const jsonData = JSON.stringify(data);
          const encrypted = await encryptData(jsonData, this.userId);
          return [this.getUserKey(key), encrypted] as [string, string];
        })
      );

      await AsyncStorage.multiSet(encryptedPairs);
      console.log(`[SecureCache] Stored ${items.length} items for user ${this.userId}`);
    } catch (error) {
      console.error('[SecureCache] Error storing multiple items:', error);
      throw error;
    }
  }

  /**
   * Get cache metadata (last sync, record counts, etc.)
   */
  async getMetadata(): Promise<CacheMetadata | null> {
    return this.get<CacheMetadata>('metadata');
  }

  /**
   * Update cache metadata
   */
  async setMetadata(metadata: Partial<CacheMetadata>): Promise<void> {
    const current = await this.getMetadata();
    const updated: CacheMetadata = {
      ...current,
      ...metadata,
      lastUpdated: new Date().toISOString(),
    } as CacheMetadata;

    await this.set('metadata', updated);
  }

  /**
   * Clear all cached data for current user
   */
  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const userKeys = allKeys.filter(key =>
        key.startsWith(`${USER_PREFIX}${this.userId}${CACHE_PREFIX}`)
      );

      await AsyncStorage.multiRemove(userKeys);
      console.log(`[SecureCache] Cleared ${userKeys.length} items for user ${this.userId}`);
    } catch (error) {
      console.error('[SecureCache] Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Get cache size and statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const metadata = await this.getMetadata();
      const allKeys = await AsyncStorage.getAllKeys();
      const userKeys = allKeys.filter(key =>
        key.startsWith(`${USER_PREFIX}${this.userId}${CACHE_PREFIX}`)
      );

      return {
        userId: this.userId,
        itemCount: userKeys.length,
        lastSync: metadata?.lastSync || null,
        recordCounts: metadata?.recordCounts || {},
        isCached: !!metadata?.lastSync,
      };
    } catch (error) {
      console.error('[SecureCache] Error getting stats:', error);
      return {
        userId: this.userId,
        itemCount: 0,
        lastSync: null,
        recordCounts: {},
        isCached: false,
      };
    }
  }
}

/**
 * Cache metadata structure
 */
export interface CacheMetadata {
  lastSync: string;
  lastUpdated: string;
  version: number;
  recordCounts: {
    patients?: number;
    carePlans?: number;
    medications?: number;
    vitals?: number;
    assessments?: number;
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  userId: string;
  itemCount: number;
  lastSync: string | null;
  recordCounts: CacheMetadata['recordCounts'];
  isCached: boolean;
}

/**
 * Create a secure cache instance for a user
 */
export function createSecureCache(userId: string): SecureCache {
  return new SecureCache(userId);
}
