/**
 * Clear Persisted Settings Script
 * 
 * This script clears the persisted app settings to allow iOS Settings to take precedence.
 * Run this when the app is not respecting iOS Settings configuration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = '@VerbumCare:Settings';

export const clearPersistedSettings = async () => {
  try {
    console.log('[ClearSettings] Clearing persisted app settings...');
    await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
    console.log('[ClearSettings] ✅ Persisted settings cleared successfully');
    console.log('[ClearSettings] iOS Settings will now take precedence on next app restart');
    return true;
  } catch (error) {
    console.error('[ClearSettings] ❌ Failed to clear persisted settings:', error);
    return false;
  }
};

// Auto-run if called directly
if (require.main === module) {
  clearPersistedSettings();
}