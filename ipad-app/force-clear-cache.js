/**
 * Force clear all AsyncStorage cache
 * Run with: node force-clear-cache.js
 *
 * This script will clear ALL @verbumcare/ cached data
 */

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function forceClearCache() {
  try {
    console.log('🧹 Force clearing VerbumCare cache...');

    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`Total keys found: ${allKeys.length}`);

    const verbumcareKeys = allKeys.filter(key =>
      key.startsWith('@verbumcare/')
    );

    console.log(`VerbumCare cache keys to delete: ${verbumcareKeys.length}`);
    verbumcareKeys.forEach(key => console.log(`  - ${key}`));

    if (verbumcareKeys.length > 0) {
      await AsyncStorage.multiRemove(verbumcareKeys);
      console.log('✅ Cache cleared successfully!');
      console.log('📱 Now reload the app to fetch fresh data from the server');
    } else {
      console.log('ℹ️  No cache to clear');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

forceClearCache();
