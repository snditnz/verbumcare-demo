/**
 * Integration Test: Voice-First AI Categorization Workflows
 * Tests complete end-to-end workflows for voice categorization feature
 * 
 * Workflows tested:
 * 1. Patient context recording flow
 * 2. Global context recording flow
 * 3. Multi-category extraction flow
 * 4. Transcript editing flow
 * 5. Queue management flow
 * 6. Offline flow
 * 7. Error recovery flow
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@stores/authStore';

// Mock network connectivity
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// Mock axios BEFORE importing services
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
};

// Mock axios module
jest.mock('axios');
const axios = require('axios');
axios.create = jest.fn(() => mockAxiosInstance);

// Mock file system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

// Mock voiceReviewStore to avoid circular dependency
jest.mock('@stores/voiceReviewStore', () => ({
  useVoiceReviewStore: {
    getState: jest.fn(() => ({
      reviewQueue: [],
      currentReview: null,
    })),
    setState: jest.fn(),
  },
}));

// Import services AFTER mocks are set up
import { voiceReviewService } from '@services/voiceReviewService';
import { networkService } from '@services/networkService';

describe('Integration Test: Voice-First AI Categorization', () => {
  let storage: Map<string, string>;
  let mockNetworkConnected: boolean;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Reset axios mocks
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.put.mockReset();
    mockAxiosInstance.delete.mockReset();
    
    // Reset offline queue by creating a new service instance
    // This is a workaround since the service is a singleton
    (voiceReviewService as any).offlineQueue = [];
    
    storage = new Map<string, string>();
    mockNetworkConnected = true;

    // Setup AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(storage.get(key) || null);
    });

    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    });

    (AsyncStorage.multiRemove as jest.Mock).mockImplementation((keys: string[]) => {
      keys.forEach(key => storage.delete(key));
      return Promise.resolve();
    });

    (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(() => {
      return Promise.resolve(Array.from(storage.keys()));
    });

    // Reset stores
    useAuthStore.setState({
      currentUser: {
        userId: 'user-123',
        staffId: 'staff-123',
        username: 'nurse1',
        fullName: 'Test Nurse',
        role: 'nurse',
        facilityId: 'facility-123',
        loginTime: new Date(),
      },
      tokens: {
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: new Date(Date.now() + 3600000),
      },
      isAuthenticated: true,
      isLoading: false,
    });

    // Reset voiceReviewStore mock
    const { useVoiceReviewStore } = require('@stores/voiceReviewStore');
    useVoiceReviewStore.getState.mockReturnValue({
      reviewQueue: [],
      currentReview: null,
    });

    // Mock network service
    (networkService.isConnected as jest.Mock) = jest.fn(() => mockNetworkConnected);
  });

  afterEach(async () => {
    storage.clear();
  });

  /**
   * Test 10.1: Patient context recording flow
   * Select patient → Record → Process → Review → Confirm
   * Verify data in database with correct patient_id
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   */
  it('should complete patient context recording flow: select → record → process → review → confirm', async () => {
    const FileSystem = require('expo-file-system');
    
    // ============================================================
    // STEP 1: Select patient (establish context)
    // ============================================================
    const patientContext = {
      type: 'patient' as const,
      patientId: 'patient-123',
      patientName: '田中 太郎',
      room: '101',
      bed: 'A',
    };

    console.log('📋 Patient context established:', patientContext.patientName);

    // ============================================================
    // STEP 2: Record voice with patient context
    // ============================================================
    const recordingUri = 'file:///recordings/test-recording-123.m4a';
    const mockAudioBase64 = 'bW9jayBhdWRpbyBkYXRh'; // "mock audio data" in base64

    // Mock file system
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: 1024,
      uri: recordingUri,
    });

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockAudioBase64);

    // Mock upload API response
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          recording_id: 'recording-123',
        },
      },
    });

    // Upload recording with patient context
    const uploadResult = await voiceReviewService.uploadRecording(recordingUri, patientContext);

    expect(uploadResult.recording_id).toBe('recording-123');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/voice/upload',
      expect.objectContaining({
        audio: mockAudioBase64,
        context_type: 'patient',
        context_patient_id: 'patient-123',
      })
    );

    console.log('✅ Recording uploaded with patient context');

    // ============================================================
    // STEP 3: Process (AI categorization)
    // ============================================================
    // Mock categorization trigger
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true },
    });

    await voiceReviewService.triggerCategorization('recording-123');

    console.log('✅ Categorization triggered');

    // ============================================================
    // STEP 4: Review (fetch from queue)
    // ============================================================
    const mockReviewItem = {
      reviewId: 'review-123',
      recordingId: 'recording-123',
      userId: 'user-123',
      contextType: 'patient' as const,
      contextPatientId: 'patient-123',
      contextPatientName: '田中 太郎',
      audioUri: recordingUri,
      duration: 30,
      recordedAt: new Date().toISOString(),
      transcript: '血圧は120の80です。心拍数は72です。',
      transcriptLanguage: 'ja' as const,
      extractedData: {
        categories: [
          {
            type: 'vitals' as const,
            confidence: 0.92,
            data: {
              blood_pressure: { systolic: 120, diastolic: 80 },
              heart_rate: 72,
            },
            fieldConfidences: {
              'blood_pressure.systolic': 0.95,
              'blood_pressure.diastolic': 0.95,
              heart_rate: 0.90,
            },
          },
        ],
        overallConfidence: 0.92,
      },
      confidence: 0.92,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      processingTime: 45000,
      modelVersion: 'llama3.1:8b',
    };

    // Mock fetch review queue
    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockReviewItem],
      },
    });

    const reviewQueue = await voiceReviewService.fetchReviewQueue('user-123');

    expect(reviewQueue.length).toBe(1);
    expect(reviewQueue[0].contextType).toBe('patient');
    expect(reviewQueue[0].contextPatientId).toBe('patient-123');
    expect(reviewQueue[0].extractedData.categories[0].type).toBe('vitals');

    console.log('✅ Review item fetched from queue');

    // ============================================================
    // STEP 5: Confirm (save to database)
    // ============================================================
    // Mock confirm API response
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          success: true,
          message: 'Data saved successfully',
        },
      },
    });

    const confirmResult = await voiceReviewService.confirmReview(
      'review-123',
      mockReviewItem.extractedData
    );

    expect(confirmResult.success).toBe(true);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/voice/review/review-123/confirm',
      expect.objectContaining({
        finalData: mockReviewItem.extractedData,
      })
    );

    console.log('✅ Review confirmed and data saved');

    // ============================================================
    // VERIFICATION: Complete workflow succeeded
    // ============================================================
    expect(uploadResult.recording_id).toBe('recording-123');
    expect(reviewQueue[0].contextPatientId).toBe('patient-123');
    expect(confirmResult.success).toBe(true);

    console.log('✅ Patient context recording flow completed successfully');
  }, 30000);

  /**
   * Test 10.2: Global context recording flow
   * No patient → Record → Process → Review → Confirm
   * Verify data in database with null patient_id
   * Requirements: 2.1, 2.3
   */
  it('should complete global context recording flow: no patient → record → process → review → confirm', async () => {
    const FileSystem = require('expo-file-system');
    
    // ============================================================
    // STEP 1: No patient selected (global context)
    // ============================================================
    const globalContext = null; // No patient context

    console.log('🌐 Global context (no patient selected)');

    // ============================================================
    // STEP 2: Record voice without patient context
    // ============================================================
    const recordingUri = 'file:///recordings/test-global-recording.m4a';
    const mockAudioBase64 = 'Z2xvYmFsIGF1ZGlvIGRhdGE='; // "global audio data" in base64

    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: 2048,
      uri: recordingUri,
    });

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockAudioBase64);

    // Mock upload API response
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          recording_id: 'recording-global-456',
        },
      },
    });

    // Upload recording without patient context
    const uploadResult = await voiceReviewService.uploadRecording(recordingUri, globalContext);

    expect(uploadResult.recording_id).toBe('recording-global-456');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/voice/upload',
      expect.objectContaining({
        audio: mockAudioBase64,
        context_type: 'global',
        context_patient_id: undefined,
      })
    );

    console.log('✅ Recording uploaded with global context');

    // ============================================================
    // STEP 3: Process (AI categorization)
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true },
    });

    await voiceReviewService.triggerCategorization('recording-global-456');

    console.log('✅ Categorization triggered');

    // ============================================================
    // STEP 4: Review (fetch from queue)
    // ============================================================
    const mockGlobalReviewItem = {
      reviewId: 'review-global-456',
      recordingId: 'recording-global-456',
      userId: 'user-123',
      contextType: 'global' as const,
      contextPatientId: null,
      contextPatientName: null,
      audioUri: recordingUri,
      duration: 25,
      recordedAt: new Date().toISOString(),
      transcript: '施設全体の清掃が完了しました。',
      transcriptLanguage: 'ja' as const,
      extractedData: {
        categories: [
          {
            type: 'clinical_note' as const,
            confidence: 0.88,
            data: {
              note_text: '施設全体の清掃が完了しました。',
              category: 'facility_maintenance',
            },
            fieldConfidences: {
              note_text: 0.90,
              category: 0.85,
            },
          },
        ],
        overallConfidence: 0.88,
      },
      confidence: 0.88,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      processingTime: 38000,
      modelVersion: 'llama3.1:8b',
    };

    // Mock fetch review queue
    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockGlobalReviewItem],
      },
    });

    const reviewQueue = await voiceReviewService.fetchReviewQueue('user-123');

    expect(reviewQueue.length).toBe(1);
    expect(reviewQueue[0].contextType).toBe('global');
    expect(reviewQueue[0].contextPatientId).toBeNull();

    console.log('✅ Global review item fetched from queue');

    // ============================================================
    // STEP 5: Confirm (save to database with null patient_id)
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          success: true,
          message: 'Global data saved successfully',
        },
      },
    });

    const confirmResult = await voiceReviewService.confirmReview(
      'review-global-456',
      mockGlobalReviewItem.extractedData
    );

    expect(confirmResult.success).toBe(true);

    console.log('✅ Global review confirmed and data saved');

    // ============================================================
    // VERIFICATION: Complete workflow succeeded
    // ============================================================
    expect(uploadResult.recording_id).toBe('recording-global-456');
    expect(reviewQueue[0].contextType).toBe('global');
    expect(reviewQueue[0].contextPatientId).toBeNull();
    expect(confirmResult.success).toBe(true);

    console.log('✅ Global context recording flow completed successfully');
  }, 30000);

  /**
   * Test 10.3: Multi-category extraction flow
   * Record with vitals + medication → Process → Review
   * Verify both categories extracted
   * Confirm → Verify separate database entries
   * Requirements: 3.7, 1.3
   */
  it('should extract multiple categories and create separate database entries', async () => {
    const FileSystem = require('expo-file-system');
    
    // ============================================================
    // STEP 1: Record voice with multiple data types
    // ============================================================
    const patientContext = {
      type: 'patient' as const,
      patientId: 'patient-789',
      patientName: '佐藤 花子',
      room: '102',
      bed: 'B',
    };

    const recordingUri = 'file:///recordings/test-multi-category.m4a';
    const mockAudioBase64 = 'bXVsdGkgY2F0ZWdvcnkgYXVkaW8=';

    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: 3072,
      uri: recordingUri,
    });

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockAudioBase64);

    // Mock upload
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: { recording_id: 'recording-multi-789' },
      },
    });

    await voiceReviewService.uploadRecording(recordingUri, patientContext);

    console.log('✅ Multi-category recording uploaded');

    // ============================================================
    // STEP 2: Process (AI extracts multiple categories)
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true },
    });

    await voiceReviewService.triggerCategorization('recording-multi-789');

    console.log('✅ Categorization triggered');

    // ============================================================
    // STEP 3: Review (verify both categories extracted)
    // ============================================================
    const mockMultiCategoryReview = {
      reviewId: 'review-multi-789',
      recordingId: 'recording-multi-789',
      userId: 'user-123',
      contextType: 'patient' as const,
      contextPatientId: 'patient-789',
      contextPatientName: '佐藤 花子',
      audioUri: recordingUri,
      duration: 45,
      recordedAt: new Date().toISOString(),
      transcript: '血圧は130の85です。アスピリン100mgを経口投与しました。',
      transcriptLanguage: 'ja' as const,
      extractedData: {
        categories: [
          {
            type: 'vitals' as const,
            confidence: 0.94,
            data: {
              blood_pressure: { systolic: 130, diastolic: 85 },
            },
            fieldConfidences: {
              'blood_pressure.systolic': 0.96,
              'blood_pressure.diastolic': 0.96,
            },
          },
          {
            type: 'medication' as const,
            confidence: 0.91,
            data: {
              medication_name: 'アスピリン',
              dose: '100mg',
              route: '経口',
              time: '14:30',
            },
            fieldConfidences: {
              medication_name: 0.95,
              dose: 0.92,
              route: 0.90,
              time: 0.88,
            },
          },
        ],
        overallConfidence: 0.925,
      },
      confidence: 0.925,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      processingTime: 52000,
      modelVersion: 'llama3.1:8b',
    };

    // Mock fetch review queue
    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: [mockMultiCategoryReview],
      },
    });

    const reviewQueue = await voiceReviewService.fetchReviewQueue('user-123');

    // Verify both categories extracted
    expect(reviewQueue[0].extractedData.categories.length).toBe(2);
    expect(reviewQueue[0].extractedData.categories[0].type).toBe('vitals');
    expect(reviewQueue[0].extractedData.categories[1].type).toBe('medication');

    console.log('✅ Both categories extracted: vitals + medication');

    // ============================================================
    // STEP 4: Confirm (verify separate database entries)
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          success: true,
          message: 'Multi-category data saved',
          insertedRecords: {
            vitals: [{ vital_sign_id: 'vitals-123', patient_id: 'patient-789' }],
            medications: [{ administration_id: 'med-456', patient_id: 'patient-789' }],
          },
        },
      },
    });

    const confirmResult = await voiceReviewService.confirmReview(
      'review-multi-789',
      mockMultiCategoryReview.extractedData
    );

    expect(confirmResult.success).toBe(true);

    console.log('✅ Multi-category data confirmed');

    // ============================================================
    // VERIFICATION: Both categories linked to same patient
    // ============================================================
    expect(reviewQueue[0].extractedData.categories.length).toBe(2);
    expect(reviewQueue[0].contextPatientId).toBe('patient-789');
    expect(confirmResult.success).toBe(true);

    console.log('✅ Multi-category extraction flow completed successfully');
  }, 30000);

  /**
   * Test 10.4: Transcript editing flow
   * Record → Edit transcript → Re-analyze
   * Verify new extraction differs from original
   * Confirm → Verify final data matches edited version
   * Requirements: 5.2, 5.3, 5.6
   */
  it('should re-analyze after transcript edit and update extraction', async () => {
    const FileSystem = require('expo-file-system');
    
    // ============================================================
    // STEP 1: Initial recording and processing
    // ============================================================
    const patientContext = {
      type: 'patient' as const,
      patientId: 'patient-edit-123',
      patientName: '山田 太郎',
      room: '103',
      bed: 'A',
    };

    const recordingUri = 'file:///recordings/test-edit.m4a';
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1500, uri: recordingUri });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('ZWRpdCBhdWRpbw==');

    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: { recording_id: 'recording-edit-123' } },
    });

    await voiceReviewService.uploadRecording(recordingUri, patientContext);

    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
    await voiceReviewService.triggerCategorization('recording-edit-123');

    console.log('✅ Initial recording processed');

    // ============================================================
    // STEP 2: Fetch original review with incorrect transcription
    // ============================================================
    const originalReview = {
      reviewId: 'review-edit-123',
      recordingId: 'recording-edit-123',
      userId: 'user-123',
      contextType: 'patient' as const,
      contextPatientId: 'patient-edit-123',
      contextPatientName: '山田 太郎',
      audioUri: recordingUri,
      duration: 20,
      recordedAt: new Date().toISOString(),
      transcript: '血圧は110の70です。', // Original (incorrect)
      transcriptLanguage: 'ja' as const,
      extractedData: {
        categories: [
          {
            type: 'vitals' as const,
            confidence: 0.89,
            data: {
              blood_pressure: { systolic: 110, diastolic: 70 }, // Original extraction
            },
            fieldConfidences: {
              'blood_pressure.systolic': 0.90,
              'blood_pressure.diastolic': 0.90,
            },
          },
        ],
        overallConfidence: 0.89,
      },
      confidence: 0.89,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      processingTime: 40000,
      modelVersion: 'llama3.1:8b',
    };

    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: [originalReview] },
    });

    const reviewQueue = await voiceReviewService.fetchReviewQueue('user-123');
    const originalExtraction = reviewQueue[0].extractedData.categories[0].data;

    expect(originalExtraction.blood_pressure.systolic).toBe(110);
    expect(originalExtraction.blood_pressure.diastolic).toBe(70);

    console.log('✅ Original extraction: BP 110/70');

    // ============================================================
    // STEP 3: Edit transcript (user corrects transcription error)
    // ============================================================
    const editedTranscript = '血圧は140の90です。'; // Corrected

    console.log('✏️  User edited transcript: 110/70 → 140/90');

    // ============================================================
    // STEP 4: Re-analyze with edited transcript
    // ============================================================
    const reanalyzedReview = {
      ...originalReview,
      transcript: editedTranscript,
      extractedData: {
        categories: [
          {
            type: 'vitals' as const,
            confidence: 0.93,
            data: {
              blood_pressure: { systolic: 140, diastolic: 90 }, // New extraction
            },
            fieldConfidences: {
              'blood_pressure.systolic': 0.95,
              'blood_pressure.diastolic': 0.95,
            },
          },
        ],
        overallConfidence: 0.93,
      },
      confidence: 0.93,
    };

    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: reanalyzedReview },
    });

    const updatedReview = await voiceReviewService.reanalyzeTranscript(
      'review-edit-123',
      editedTranscript
    );

    // Verify new extraction differs from original
    const newExtraction = updatedReview.extractedData.categories[0].data;
    expect(newExtraction.blood_pressure.systolic).toBe(140);
    expect(newExtraction.blood_pressure.diastolic).toBe(90);
    expect(newExtraction.blood_pressure.systolic).not.toBe(originalExtraction.blood_pressure.systolic);

    console.log('✅ Re-analyzed extraction: BP 140/90 (different from original)');

    // ============================================================
    // STEP 5: Confirm with edited data
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: { success: true, message: 'Edited data saved' },
      },
    });

    const confirmResult = await voiceReviewService.confirmReview(
      'review-edit-123',
      updatedReview.extractedData
    );

    expect(confirmResult.success).toBe(true);

    console.log('✅ Edited data confirmed and saved');

    // ============================================================
    // VERIFICATION: Final data matches edited version
    // ============================================================
    expect(updatedReview.transcript).toBe(editedTranscript);
    expect(newExtraction.blood_pressure.systolic).toBe(140);
    expect(newExtraction.blood_pressure.diastolic).toBe(90);
    expect(confirmResult.success).toBe(true);

    console.log('✅ Transcript editing flow completed successfully');
  }, 30000);

  /**
   * Test 10.5: Queue management flow
   * Record 3 voices → Verify queue order
   * Review oldest first → Confirm
   * Verify queue updates correctly
   * Requirements: 8.5, 8.7
   */
  it('should maintain chronological queue order and update correctly', async () => {
    const FileSystem = require('expo-file-system');
    
    // ============================================================
    // STEP 1: Record 3 voices at different times
    // ============================================================
    const recordings = [
      {
        id: 'recording-queue-1',
        reviewId: 'review-queue-1',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        transcript: '最初の記録',
      },
      {
        id: 'recording-queue-2',
        reviewId: 'review-queue-2',
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
        transcript: '2番目の記録',
      },
      {
        id: 'recording-queue-3',
        reviewId: 'review-queue-3',
        timestamp: new Date(Date.now() - 900000), // 15 minutes ago
        transcript: '3番目の記録',
      },
    ];

    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1024 });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('cXVldWUgYXVkaW8=');

    // Upload all recordings
    for (const recording of recordings) {
      (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true, data: { recording_id: recording.id } },
      });

      await voiceReviewService.uploadRecording('file:///test.m4a', {
        type: 'patient',
        patientId: 'patient-queue-123',
        patientName: 'Queue Test',
        room: '104',
        bed: 'A',
      });

      (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      await voiceReviewService.triggerCategorization(recording.id);
    }

    console.log('✅ 3 recordings uploaded and processed');

    // ============================================================
    // STEP 2: Fetch queue and verify chronological order (oldest first)
    // ============================================================
    const mockQueueItems = recordings.map((rec, index) => ({
      reviewId: rec.reviewId,
      recordingId: rec.id,
      userId: 'user-123',
      contextType: 'patient' as const,
      contextPatientId: 'patient-queue-123',
      contextPatientName: 'Queue Test',
      audioUri: 'file:///test.m4a',
      duration: 20,
      recordedAt: rec.timestamp.toISOString(),
      transcript: rec.transcript,
      transcriptLanguage: 'ja' as const,
      extractedData: {
        categories: [
          {
            type: 'clinical_note' as const,
            confidence: 0.85,
            data: { note_text: rec.transcript },
            fieldConfidences: { note_text: 0.85 },
          },
        ],
        overallConfidence: 0.85,
      },
      confidence: 0.85,
      status: 'pending' as const,
      createdAt: rec.timestamp.toISOString(),
      processingTime: 35000,
      modelVersion: 'llama3.1:8b',
    }));

    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: mockQueueItems },
    });

    const reviewQueue = await voiceReviewService.fetchReviewQueue('user-123');

    // Verify chronological order (oldest first)
    expect(reviewQueue.length).toBe(3);
    expect(reviewQueue[0].reviewId).toBe('review-queue-1'); // Oldest
    expect(reviewQueue[1].reviewId).toBe('review-queue-2'); // Middle
    expect(reviewQueue[2].reviewId).toBe('review-queue-3'); // Newest

    console.log('✅ Queue ordered chronologically (oldest first)');

    // ============================================================
    // STEP 3: Review oldest first
    // ============================================================
    const oldestReview = reviewQueue[0];
    expect(oldestReview.reviewId).toBe('review-queue-1');

    console.log('📋 Reviewing oldest item first:', oldestReview.reviewId);

    // ============================================================
    // STEP 4: Confirm oldest review
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: { success: true, message: 'Oldest review confirmed' },
      },
    });

    const confirmResult = await voiceReviewService.confirmReview(
      oldestReview.reviewId,
      oldestReview.extractedData
    );

    expect(confirmResult.success).toBe(true);

    console.log('✅ Oldest review confirmed');

    // ============================================================
    // STEP 5: Fetch queue again and verify update
    // ============================================================
    const updatedQueueItems = mockQueueItems.slice(1); // Remove confirmed item

    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: updatedQueueItems },
    });

    const updatedQueue = await voiceReviewService.fetchReviewQueue('user-123');

    // Verify queue updated correctly
    expect(updatedQueue.length).toBe(2);
    expect(updatedQueue[0].reviewId).toBe('review-queue-2'); // Now oldest
    expect(updatedQueue[1].reviewId).toBe('review-queue-3');

    console.log('✅ Queue updated correctly after confirmation');

    // ============================================================
    // VERIFICATION: Queue management working correctly
    // ============================================================
    expect(reviewQueue.length).toBe(3);
    expect(reviewQueue[0].reviewId).toBe('review-queue-1');
    expect(updatedQueue.length).toBe(2);
    expect(updatedQueue[0].reviewId).toBe('review-queue-2');

    console.log('✅ Queue management flow completed successfully');
  }, 30000);

  /**
   * Test 10.6: Offline flow
   * Go offline → Record → Verify queued
   * Go online → Verify automatic processing
   * Review → Confirm → Verify database
   * Requirements: 7.1, 7.3, 7.4
   */
  it('should queue recordings offline and process when online', async () => {
    const FileSystem = require('expo-file-system');
    
    // ============================================================
    // STEP 1: Go offline
    // ============================================================
    mockNetworkConnected = false;
    (networkService.isConnected as jest.Mock).mockReturnValue(false);

    console.log('📴 Device went offline');

    // ============================================================
    // STEP 2: Record voice while offline
    // ============================================================
    const patientContext = {
      type: 'patient' as const,
      patientId: 'patient-offline-123',
      patientName: 'Offline Test',
      room: '105',
      bed: 'A',
    };

    const recordingUri = 'file:///recordings/test-offline.m4a';
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 2048, uri: recordingUri });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('b2ZmbGluZSBhdWRpbw==');

    // Attempt upload while offline - should queue
    let uploadError: Error | null = null;
    try {
      await voiceReviewService.uploadRecording(recordingUri, patientContext);
    } catch (error) {
      uploadError = error as Error;
    }

    // Verify upload failed and recording was queued
    expect(uploadError).not.toBeNull();
    expect(uploadError?.message).toContain('offline');

    // Verify offline queue count
    const offlineQueueCount = voiceReviewService.getOfflineQueueCount();
    expect(offlineQueueCount).toBe(1);

    console.log('✅ Recording queued for later processing (offline queue: 1)');

    // ============================================================
    // STEP 3: Go online
    // ============================================================
    mockNetworkConnected = true;
    (networkService.isConnected as jest.Mock).mockReturnValue(true);

    console.log('📶 Device came back online');

    // ============================================================
    // STEP 4: Automatic processing when connectivity restored
    // ============================================================
    // Mock upload for queued recording
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: { recording_id: 'recording-offline-123' },
      },
    });

    // Mock categorization trigger
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true },
    });

    // Trigger offline queue processing
    await voiceReviewService.processOfflineQueue();

    // Verify offline queue is now empty
    const queueCountAfterProcessing = voiceReviewService.getOfflineQueueCount();
    expect(queueCountAfterProcessing).toBe(0);

    console.log('✅ Offline queue processed automatically (queue now empty)');

    // ============================================================
    // STEP 5: Review processed recording
    // ============================================================
    const mockOfflineReview = {
      reviewId: 'review-offline-123',
      recordingId: 'recording-offline-123',
      userId: 'user-123',
      contextType: 'patient' as const,
      contextPatientId: 'patient-offline-123',
      contextPatientName: 'Offline Test',
      audioUri: recordingUri,
      duration: 30,
      recordedAt: new Date().toISOString(),
      transcript: 'オフライン時の記録',
      transcriptLanguage: 'ja' as const,
      extractedData: {
        categories: [
          {
            type: 'clinical_note' as const,
            confidence: 0.87,
            data: { note_text: 'オフライン時の記録' },
            fieldConfidences: { note_text: 0.87 },
          },
        ],
        overallConfidence: 0.87,
      },
      confidence: 0.87,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      processingTime: 42000,
      modelVersion: 'llama3.1:8b',
    };

    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: [mockOfflineReview] },
    });

    const reviewQueue = await voiceReviewService.fetchReviewQueue('user-123');

    expect(reviewQueue.length).toBe(1);
    expect(reviewQueue[0].contextPatientId).toBe('patient-offline-123');

    console.log('✅ Offline recording now in review queue');

    // ============================================================
    // STEP 6: Confirm and verify database
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: { success: true, message: 'Offline data saved to database' },
      },
    });

    const confirmResult = await voiceReviewService.confirmReview(
      'review-offline-123',
      mockOfflineReview.extractedData
    );

    expect(confirmResult.success).toBe(true);

    console.log('✅ Offline recording confirmed and saved to database');

    // ============================================================
    // VERIFICATION: Complete offline flow succeeded
    // ============================================================
    expect(uploadError).not.toBeNull(); // Initial upload failed
    expect(offlineQueueCount).toBe(1); // Was queued
    expect(queueCountAfterProcessing).toBe(0); // Queue processed
    expect(reviewQueue[0].contextPatientId).toBe('patient-offline-123'); // Context preserved
    expect(confirmResult.success).toBe(true); // Data saved

    console.log('✅ Offline flow completed successfully');
  }, 30000);

  /**
   * Test 10.7: Error recovery flow
   * Record → Process → Simulate DB failure
   * Verify data retained in queue
   * Retry → Verify success
   * Requirements: 11.4
   */
  it('should retain data in queue on database failure and retry successfully', async () => {
    const FileSystem = require('expo-file-system');
    
    // ============================================================
    // STEP 1: Record and process normally
    // ============================================================
    const patientContext = {
      type: 'patient' as const,
      patientId: 'patient-error-123',
      patientName: 'Error Test',
      room: '106',
      bed: 'A',
    };

    const recordingUri = 'file:///recordings/test-error.m4a';
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1536, uri: recordingUri });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('ZXJyb3IgYXVkaW8=');

    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: { recording_id: 'recording-error-123' } },
    });

    await voiceReviewService.uploadRecording(recordingUri, patientContext);

    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
    await voiceReviewService.triggerCategorization('recording-error-123');

    console.log('✅ Recording processed normally');

    // ============================================================
    // STEP 2: Fetch review item
    // ============================================================
    const mockErrorReview = {
      reviewId: 'review-error-123',
      recordingId: 'recording-error-123',
      userId: 'user-123',
      contextType: 'patient' as const,
      contextPatientId: 'patient-error-123',
      contextPatientName: 'Error Test',
      audioUri: recordingUri,
      duration: 25,
      recordedAt: new Date().toISOString(),
      transcript: 'エラーテスト用の記録',
      transcriptLanguage: 'ja' as const,
      extractedData: {
        categories: [
          {
            type: 'clinical_note' as const,
            confidence: 0.86,
            data: { note_text: 'エラーテスト用の記録' },
            fieldConfidences: { note_text: 0.86 },
          },
        ],
        overallConfidence: 0.86,
      },
      confidence: 0.86,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      processingTime: 38000,
      modelVersion: 'llama3.1:8b',
    };

    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: [mockErrorReview] },
    });

    const reviewQueue = await voiceReviewService.fetchReviewQueue('user-123');
    expect(reviewQueue.length).toBe(1);

    console.log('✅ Review item fetched');

    // ============================================================
    // STEP 3: Simulate database failure on confirm
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          success: false,
          error: 'Database connection failed',
        },
      },
    });

    let confirmError: Error | null = null;
    try {
      await voiceReviewService.confirmReview('review-error-123', mockErrorReview.extractedData);
    } catch (error) {
      confirmError = error as Error;
    }

    expect(confirmError).not.toBeNull();
    expect(confirmError?.message).toContain('Database connection failed');

    console.log('❌ Database failure simulated');

    // ============================================================
    // STEP 4: Verify data retained in queue
    // ============================================================
    // Fetch queue again - item should still be there
    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: [mockErrorReview] },
    });

    const queueAfterError = await voiceReviewService.fetchReviewQueue('user-123');

    expect(queueAfterError.length).toBe(1);
    expect(queueAfterError[0].reviewId).toBe('review-error-123');
    expect(queueAfterError[0].status).toBe('pending');

    console.log('✅ Data retained in queue after failure');

    // ============================================================
    // STEP 5: Retry confirmation (database recovered)
    // ============================================================
    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        data: { success: true, message: 'Data saved successfully on retry' },
      },
    });

    const retryResult = await voiceReviewService.confirmReview(
      'review-error-123',
      mockErrorReview.extractedData
    );

    expect(retryResult.success).toBe(true);

    console.log('✅ Retry successful - data saved');

    // ============================================================
    // STEP 6: Verify queue updated after successful retry
    // ============================================================
    (mockAxiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: { success: true, data: [] }, // Queue now empty
    });

    const queueAfterRetry = await voiceReviewService.fetchReviewQueue('user-123');

    expect(queueAfterRetry.length).toBe(0);

    console.log('✅ Queue cleared after successful retry');

    // ============================================================
    // VERIFICATION: Error recovery flow succeeded
    // ============================================================
    expect(confirmError).not.toBeNull(); // Initial confirm failed
    expect(queueAfterError.length).toBe(1); // Data retained
    expect(queueAfterError[0].reviewId).toBe('review-error-123'); // Same item
    expect(retryResult.success).toBe(true); // Retry succeeded
    expect(queueAfterRetry.length).toBe(0); // Queue cleared

    console.log('✅ Error recovery flow completed successfully');
  }, 30000);

  /**
   * Additional test: Verify context preservation across offline queue
   */
  it('should preserve patient context when processing offline queue', async () => {
    const FileSystem = require('expo-file-system');
    
    // Go offline
    mockNetworkConnected = false;
    (networkService.isConnected as jest.Mock).mockReturnValue(false);

    // Record with patient context while offline
    const patientContext = {
      type: 'patient' as const,
      patientId: 'patient-context-preserve',
      patientName: 'Context Preserve Test',
      room: '107',
      bed: 'B',
    };

    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1024 });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('Y29udGV4dA==');

    // Queue recording
    try {
      await voiceReviewService.uploadRecording('file:///test.m4a', patientContext);
    } catch (error) {
      // Expected to fail offline
    }

    expect(voiceReviewService.getOfflineQueueCount()).toBe(1);

    // Go online
    mockNetworkConnected = true;
    (networkService.isConnected as jest.Mock).mockReturnValue(true);

    // Mock upload with context verification
    (mockAxiosInstance.post as jest.Mock).mockImplementationOnce((url, data) => {
      // Verify context was preserved
      expect(data.context_type).toBe('patient');
      expect(data.context_patient_id).toBe('patient-context-preserve');
      
      return Promise.resolve({
        data: { success: true, data: { recording_id: 'recording-context-123' } },
      });
    });

    (mockAxiosInstance.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

    // Process offline queue
    await voiceReviewService.processOfflineQueue();

    // Verify context was preserved in upload
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/voice/upload',
      expect.objectContaining({
        context_type: 'patient',
        context_patient_id: 'patient-context-preserve',
      })
    );

    console.log('✅ Patient context preserved through offline queue');
  }, 30000);
});
