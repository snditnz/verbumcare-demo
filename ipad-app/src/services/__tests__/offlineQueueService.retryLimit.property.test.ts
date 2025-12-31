/**
 * Property Test: Retry Limit Enforcement
 * 
 * Property 15: For any offline recording that fails processing, the system SHALL
 * retry up to 3 times. After 3 failed attempts, the recording status SHALL be
 * set to 'failed' and SHALL NOT be automatically retried.
 * 
 * Validates: Requirements 10.5
 */

import * as fc from 'fast-check';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
}));

// Mock NetInfo
const mockNetInfo = {
  isConnected: true,
  isInternetReachable: true,
};
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve(mockNetInfo)),
}));

// Mock uuid
let mockUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `test-uuid-${++mockUuidCounter}`),
}));

// Mock api service - always fails
let mockApiShouldFail = true;
jest.mock('../api', () => ({
  apiService: {
    uploadVoiceRecording: jest.fn(() => {
      if (mockApiShouldFail) {
        return Promise.reject(new Error('Upload failed'));
      }
      return Promise.resolve({
        success: true,
        data: { reviewId: 'review-123', transcription: 'test' },
      });
    }),
  },
}));

import { offlineQueueService } from '../offlineQueueService';

describe('Property 15: Retry Limit Enforcement', () => {
  const MAX_RETRIES = 3;

  // Arbitrary generators
  const audioUriArb = fc.string({ minLength: 5, maxLength: 100 })
    .map(s => `file://${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`);
  
  const durationArb = fc.float({ min: Math.fround(0.1), max: Math.fround(3600), noNaN: true });
  
  const recordedAtArb = fc.integer({ min: 1577836800000, max: 1924905600000 })
    .map(ts => new Date(ts));
  
  const contextTypeArb = fc.constantFrom('patient' as const, 'global' as const);
  const languageArb = fc.constantFrom('ja', 'en', 'zh-TW');
  const userIdArb = fc.uuid();

  const validRecordingInputArb = fc.record({
    audioUri: audioUriArb,
    duration: durationArb,
    recordedAt: recordedAtArb,
    patientId: fc.option(fc.uuid()),
    contextType: contextTypeArb,
    language: languageArb,
    userId: userIdArb,
  });

  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    mockUuidCounter = 0;
    mockApiShouldFail = true;
    mockNetInfo.isConnected = true;
    mockNetInfo.isInternetReachable = true;
    jest.clearAllMocks();
  });

  test('Property 15.1: RetryCount increments on each failure', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        mockApiShouldFail = true;

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Verify initial retry count
        let queue = await offlineQueueService.getQueue();
        let recording = queue.find(r => r.id === id);
        expect(recording?.retryCount).toBe(0);

        // Process and fail
        await offlineQueueService.processRecording(id);

        // Property: RetryCount should increment
        queue = await offlineQueueService.getQueue();
        recording = queue.find(r => r.id === id);
        expect(recording?.retryCount).toBe(1);

        // Process and fail again
        await offlineQueueService.processRecording(id);

        queue = await offlineQueueService.getQueue();
        recording = queue.find(r => r.id === id);
        expect(recording?.retryCount).toBe(2);
      }),
      { numRuns: 20 }
    );
  });

  test('Property 15.2: Status becomes "failed" after MAX_RETRIES', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        mockApiShouldFail = true;

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Process MAX_RETRIES times
        for (let i = 0; i < MAX_RETRIES; i++) {
          await offlineQueueService.processRecording(id);
        }

        // Property: Status should be 'failed' after max retries
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);
        
        expect(recording?.retryCount).toBe(MAX_RETRIES);
        expect(recording?.status).toBe('failed');
      }),
      { numRuns: 20 }
    );
  });

  test('Property 15.3: Failed recordings not included in processQueue', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        mockApiShouldFail = true;

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Exhaust retries
        for (let i = 0; i < MAX_RETRIES; i++) {
          await offlineQueueService.processRecording(id);
        }

        // Verify status is failed
        let queue = await offlineQueueService.getQueue();
        let recording = queue.find(r => r.id === id);
        expect(recording?.status).toBe('failed');

        // Reset mock call count
        const { apiService } = require('../api');
        apiService.uploadVoiceRecording.mockClear();

        // Process queue again
        await offlineQueueService.processQueue();

        // Property: Failed recording should not be processed again
        expect(apiService.uploadVoiceRecording).not.toHaveBeenCalled();
      }),
      { numRuns: 20 }
    );
  });

  test('Property 15.4: RetryCount never exceeds MAX_RETRIES', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRecordingInputArb,
        fc.integer({ min: 1, max: 10 }),
        async (input, extraAttempts) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
          mockApiShouldFail = true;

          // Add recording
          const id = await offlineQueueService.addToQueue(input);

          // Try to process more than MAX_RETRIES times
          const totalAttempts = MAX_RETRIES + extraAttempts;
          for (let i = 0; i < totalAttempts; i++) {
            await offlineQueueService.processRecording(id);
          }

          // Property: RetryCount should cap at MAX_RETRIES
          const queue = await offlineQueueService.getQueue();
          const recording = queue.find(r => r.id === id);
          
          expect(recording?.retryCount).toBe(MAX_RETRIES);
          expect(recording?.retryCount).toBeLessThanOrEqual(MAX_RETRIES);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 15.5: LastError updated on each failure', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        mockApiShouldFail = true;

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Initial state - no error
        let queue = await offlineQueueService.getQueue();
        let recording = queue.find(r => r.id === id);
        expect(recording?.lastError).toBeUndefined();

        // Process and fail
        await offlineQueueService.processRecording(id);

        // Property: LastError should be set
        queue = await offlineQueueService.getQueue();
        recording = queue.find(r => r.id === id);
        expect(recording?.lastError).toBeDefined();
        expect(recording?.lastError).toContain('Upload failed');
      }),
      { numRuns: 20 }
    );
  });

  test('Property 15.6: Successful processing resets retry tracking', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Fail once
        mockApiShouldFail = true;
        await offlineQueueService.processRecording(id);

        let queue = await offlineQueueService.getQueue();
        let recording = queue.find(r => r.id === id);
        expect(recording?.retryCount).toBe(1);

        // Now succeed
        mockApiShouldFail = false;
        await offlineQueueService.processRecording(id);

        // Property: Recording should be removed after success
        queue = await offlineQueueService.getQueue();
        recording = queue.find(r => r.id === id);
        expect(recording).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });

  test('Property 15.7: Status transitions correctly through retries', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        mockApiShouldFail = true;

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Initial status
        let queue = await offlineQueueService.getQueue();
        let recording = queue.find(r => r.id === id);
        expect(recording?.status).toBe('pending');

        // After first failure (retryCount < MAX_RETRIES)
        await offlineQueueService.processRecording(id);
        queue = await offlineQueueService.getQueue();
        recording = queue.find(r => r.id === id);
        expect(recording?.status).toBe('pending'); // Still pending, can retry

        // After second failure
        await offlineQueueService.processRecording(id);
        queue = await offlineQueueService.getQueue();
        recording = queue.find(r => r.id === id);
        expect(recording?.status).toBe('pending'); // Still pending

        // After third failure (MAX_RETRIES reached)
        await offlineQueueService.processRecording(id);
        queue = await offlineQueueService.getQueue();
        recording = queue.find(r => r.id === id);
        expect(recording?.status).toBe('failed'); // Now failed
      }),
      { numRuns: 20 }
    );
  });

  test('Property 15.8: ProcessRecording returns failure result after max retries', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        mockApiShouldFail = true;

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Exhaust retries
        for (let i = 0; i < MAX_RETRIES; i++) {
          await offlineQueueService.processRecording(id);
        }

        // Try to process again
        const result = await offlineQueueService.processRecording(id);

        // Property: Should return failure with max retry message
        expect(result.success).toBe(false);
        expect(result.error).toContain('Max retry limit reached');
      }),
      { numRuns: 20 }
    );
  });
});
