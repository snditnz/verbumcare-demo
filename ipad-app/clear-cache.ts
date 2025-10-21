/**
 * Quick script to clear stale cache
 * Run with: npx ts-node clear-cache.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

async function clearCache() {
  try {
    console.log('Clearing all VerbumCare cache...');

    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`Total keys found: ${allKeys.length}`);

    const verbumcareKeys = allKeys.filter(key =>
      key.startsWith('@verbumcare/') ||
      key.startsWith('@user_') ||
      key.startsWith('@cache_')
    );

    console.log(`VerbumCare keys to delete: ${verbumcareKeys.length}`);
    verbumcareKeys.forEach(key => console.log(`  - ${key}`));

    if (verbumcareKeys.length > 0) {
      await AsyncStorage.multiRemove(verbumcareKeys);
      console.log('✅ Cache cleared successfully!');
    } else {
      console.log('ℹ️  No cache to clear');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

clearCache();
