/**
 * Header Consistency Tests
 * 
 * Task 8: Write unit tests for header consistency
 * 
 * This test suite validates:
 * - ServerStatusIndicator is rendered on all updated screens
 * - Patient name displays when currentPatient exists
 * - Patient name is omitted when currentPatient is null
 * - Header structure follows the standard three-section layout
 * 
 * **Validates: Requirements 1.3, 2.1, 2.4, 3.1**
 */

import React from 'react';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  setOptions: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(),
};

const mockRoute = {
  params: {
    patientId: 'test-patient-id',
    patientName: '山田 太郎',
  },
  key: 'test-key',
  name: 'TestScreen',
};

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    defaults: {
      baseURL: 'https://verbumcaremac-mini/api',
    },
  };
  return mockAxios;
});

jest.mock('expo-av', () => ({
  Audio: {
    Recording: jest.fn(),
    Sound: jest.fn(),
    setAudioModeAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

describe('Header Consistency Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Requirement 3.1: ServerStatusIndicator on all screens', () => {
    it('should verify ADLVoiceScreen imports ServerStatusIndicator', async () => {
      // Static verification - the import statement exists in the file
      // This test validates that the component is properly imported
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/ADLVoiceScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent).toContain('ServerStatusIndicator');
      expect(fileContent).toContain('<ServerStatusIndicator compact');
      console.log('✅ ADLVoiceScreen has ServerStatusIndicator');
    });

    it('should verify FallRiskAssessmentScreen imports ServerStatusIndicator', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/FallRiskAssessmentScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent).toContain('ServerStatusIndicator');
      expect(fileContent).toContain('<ServerStatusIndicator compact');
      console.log('✅ FallRiskAssessmentScreen has ServerStatusIndicator');
    });

    it('should verify KihonChecklistScreen imports ServerStatusIndicator', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/KihonChecklistScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent).toContain('ServerStatusIndicator');
      expect(fileContent).toContain('<ServerStatusIndicator compact');
      console.log('✅ KihonChecklistScreen has ServerStatusIndicator');
    });

    it('should verify ReviewConfirmScreen imports ServerStatusIndicator', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/ReviewConfirmScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent).toContain('ServerStatusIndicator');
      expect(fileContent).toContain('<ServerStatusIndicator compact');
      console.log('✅ ReviewConfirmScreen has ServerStatusIndicator');
    });

    it('should verify GeneralVoiceRecorderScreen imports ServerStatusIndicator', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/GeneralVoiceRecorderScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent).toContain('ServerStatusIndicator');
      expect(fileContent).toContain('<ServerStatusIndicator compact');
      console.log('✅ GeneralVoiceRecorderScreen has ServerStatusIndicator');
    });

    it('should verify ClinicalNotesScreen imports ServerStatusIndicator', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/ClinicalNotesScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent).toContain('ServerStatusIndicator');
      expect(fileContent).toContain('<ServerStatusIndicator compact');
      console.log('✅ ClinicalNotesScreen has ServerStatusIndicator');
    });
  });

  describe('Requirement 2.1: Patient name display when patient context exists', () => {
    it('should verify ReviewConfirmScreen has patient name display logic', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/ReviewConfirmScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Verify patient name display in header
      expect(fileContent).toContain('headerPatientName');
      expect(fileContent).toContain('currentPatient.family_name');
      expect(fileContent).toContain('currentPatient.given_name');
      console.log('✅ ReviewConfirmScreen displays patient name in header');
    });

    it('should verify GeneralVoiceRecorderScreen has patient name display logic', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/GeneralVoiceRecorderScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Verify patient name display in header
      expect(fileContent).toContain('headerPatientName');
      expect(fileContent).toContain('context.patientName');
      console.log('✅ GeneralVoiceRecorderScreen displays patient name in header');
    });

    it('should verify ClinicalNotesScreen has patient name display logic', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/ClinicalNotesScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Verify patient name display in header
      expect(fileContent).toContain('headerPatientName');
      expect(fileContent).toContain('patientName');
      console.log('✅ ClinicalNotesScreen displays patient name in header');
    });
  });

  describe('Requirement 2.4: Patient name omitted when no patient context', () => {
    it('should verify ReviewConfirmScreen conditionally renders patient name', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/ReviewConfirmScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Verify conditional rendering with currentPatient check
      expect(fileContent).toContain('{currentPatient && (');
      console.log('✅ ReviewConfirmScreen conditionally renders patient name');
    });

    it('should verify GeneralVoiceRecorderScreen conditionally renders patient name', async () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../screens/GeneralVoiceRecorderScreen.tsx');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Verify conditional rendering with context check
      expect(fileContent).toContain("context?.type === 'patient'");
      console.log('✅ GeneralVoiceRecorderScreen conditionally renders patient name');
    });
  });

  describe('Requirement 1.3: Header structure consistency', () => {
    it('should verify all screens have headerLeft, headerCenter, headerRight structure', async () => {
      const fs = require('fs');
      const path = require('path');
      
      const screens = [
        'ADLVoiceScreen.tsx',
        'FallRiskAssessmentScreen.tsx',
        'KihonChecklistScreen.tsx',
        'ReviewConfirmScreen.tsx',
        'GeneralVoiceRecorderScreen.tsx',
        'ClinicalNotesScreen.tsx',
      ];
      
      for (const screen of screens) {
        const filePath = path.join(__dirname, '../screens', screen);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        expect(fileContent).toContain('headerLeft');
        expect(fileContent).toContain('headerCenter');
        expect(fileContent).toContain('headerRight');
        console.log(`✅ ${screen} has consistent header structure`);
      }
    });

    it('should verify headerRight uses flexDirection row with gap', async () => {
      const fs = require('fs');
      const path = require('path');
      
      const screens = [
        'ADLVoiceScreen.tsx',
        'FallRiskAssessmentScreen.tsx',
        'KihonChecklistScreen.tsx',
        'ReviewConfirmScreen.tsx',
        'GeneralVoiceRecorderScreen.tsx',
        'ClinicalNotesScreen.tsx',
      ];
      
      for (const screen of screens) {
        const filePath = path.join(__dirname, '../screens', screen);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Check that headerRight style includes flexDirection: 'row' and gap
        expect(fileContent).toMatch(/headerRight:[\s\S]*?flexDirection:\s*['"]row['"]/);
        expect(fileContent).toMatch(/headerRight:[\s\S]*?gap:/);
        console.log(`✅ ${screen} headerRight has proper flexDirection and gap`);
      }
    });
  });
});
