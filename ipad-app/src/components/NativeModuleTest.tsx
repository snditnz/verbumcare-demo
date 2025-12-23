/**
 * Native Module Test Component
 * 
 * Simple component to test if NativeSettingsModule is available and working
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NativeModules } from 'react-native';

export const NativeModuleTest: React.FC = () => {
  const [moduleStatus, setModuleStatus] = useState<string>('Checking...');
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    checkModuleAvailability();
  }, []);

  const checkModuleAvailability = () => {
    console.log('Available native modules:', Object.keys(NativeModules));
    
    if (NativeModules.NativeSettingsModule) {
      setModuleStatus('✅ NativeSettingsModule is available!');
      console.log('NativeSettingsModule found:', NativeModules.NativeSettingsModule);
    } else {
      setModuleStatus('❌ NativeSettingsModule is NOT available');
      console.log('Available modules:', Object.keys(NativeModules));
    }
  };

  const testReadAllSettings = async () => {
    try {
      if (!NativeModules.NativeSettingsModule) {
        throw new Error('NativeSettingsModule not available');
      }

      const settings = await NativeModules.NativeSettingsModule.readAllSettings();
      const result = `✅ Read settings: ${JSON.stringify(settings, null, 2)}`;
      setTestResults(prev => [...prev, result]);
      console.log('Settings:', settings);
    } catch (error) {
      const result = `❌ Failed to read settings: ${error}`;
      setTestResults(prev => [...prev, result]);
      console.error('Error reading settings:', error);
    }
  };

  const testGetServerConfig = async () => {
    try {
      if (!NativeModules.NativeSettingsModule) {
        throw new Error('NativeSettingsModule not available');
      }

      const config = await NativeModules.NativeSettingsModule.getEffectiveServerConfig();
      const result = `✅ Server config: ${JSON.stringify(config, null, 2)}`;
      setTestResults(prev => [...prev, result]);
      console.log('Server config:', config);
    } catch (error) {
      const result = `❌ Failed to get server config: ${error}`;
      setTestResults(prev => [...prev, result]);
      console.error('Error getting server config:', error);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Native Module Test</Text>
      
      <Text style={styles.status}>{moduleStatus}</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={checkModuleAvailability}>
          <Text style={styles.buttonText}>Check Module</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testReadAllSettings}>
          <Text style={styles.buttonText}>Test Read Settings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testGetServerConfig}>
          <Text style={styles.buttonText}>Test Server Config</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={clearResults}>
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.result}>{result}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    margin: 5,
    minWidth: 120,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  result: {
    fontSize: 12,
    marginBottom: 5,
    fontFamily: 'monospace',
  },
});

export default NativeModuleTest;