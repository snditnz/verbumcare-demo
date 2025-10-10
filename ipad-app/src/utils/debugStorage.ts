import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Debug utility to inspect AsyncStorage contents
 */
export const debugStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    console.log('\n=== 🔍 AsyncStorage Debug ===');
    console.log('Total keys:', keys.length);
    console.log('All keys:', JSON.stringify(keys, null, 2));

    const verbumcareKeys = keys.filter(key => key.includes('verbumcare'));
    console.log('\n=== 📦 VerbumCare Storage Keys ===');
    console.log('VerbumCare keys found:', verbumcareKeys.length);
    console.log(verbumcareKeys);

    for (const key of verbumcareKeys) {
      const value = await AsyncStorage.getItem(key);
      console.log(`\n=== 📄 ${key} ===`);

      if (value) {
        try {
          const parsed = JSON.parse(value);
          console.log('✅ Valid JSON - Parsed:');
          console.log(JSON.stringify(parsed, null, 2));

          // Special handling for Zustand persist structure
          if (parsed.state && parsed.state.patientSessions) {
            console.log('\n🏥 Patient Sessions Found:');
            const sessions = parsed.state.patientSessions;
            console.log('Number of patient sessions:', Object.keys(sessions).length);
            console.log('Patient IDs:', Object.keys(sessions));

            Object.entries(sessions).forEach(([patientId, sessionData]: [string, any]) => {
              console.log(`\n  Patient ${patientId}:`);
              console.log(`    - Vitals: ${sessionData.vitals ? 'YES' : 'NO'}`);
              console.log(`    - Medications: ${sessionData.medications?.length || 0}`);
              console.log(`    - Patient Updates: ${sessionData.patientUpdates ? 'YES' : 'NO'}`);
              console.log(`    - Incidents: ${sessionData.incidents?.length || 0}`);
              console.log(`    - Barthel Index: ${sessionData.barthelIndex ? 'YES' : 'NO'}`);
            });
          }
        } catch (e) {
          console.log('❌ Not valid JSON:', value);
        }
      } else {
        console.log('⚠️ Key exists but value is null/undefined');
      }
    }

    console.log('\n=== ✅ Debug Complete ===\n');
    return { keys, verbumcareKeys };
  } catch (error) {
    console.error('❌ Error debugging storage:', error);
    return null;
  }
};

/**
 * Clear all VerbumCare storage (for testing)
 */
export const clearVerbumCareStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const verbumcareKeys = keys.filter(key => key.includes('verbumcare'));
    await AsyncStorage.multiRemove(verbumcareKeys);
    console.log('Cleared VerbumCare storage:', verbumcareKeys);
    return verbumcareKeys;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return null;
  }
};
