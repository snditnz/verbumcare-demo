/**
 * Property Test: Silent Error Handling
 * 
 * Property 9: For any network error (connection failure, timeout, transmission error),
 * the system SHALL NOT produce user-visible error dialogs or messages.
 * The error state SHALL be reflected only in status indicators.
 * 
 * Validates: Requirements 5.10
 */

import * as fc from 'fast-check';

// Track if any error dialogs/alerts were shown
let errorDialogsShown: string[] = [];

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

// Mock api service with configurable errors
let mockApiShouldFail = false;
let mockApiErrorType = 'network';
jest.mock('../api', () => ({
  apiService: {
    uploadVoiceRecording: jest.fn(() => {
      if (mockApiShouldFail) {
        const errors: Record<string, Error> = {
          network: new Error('Network request failed'),
          timeout: new Error('Request timeout'),
          connection: new Error('Connection refused'),
          server: new Error('Internal server error'),
        };
        return Promise.reject(errors[mockApiErrorType] || errors.network);
      }
      return Promise.resolve({
        success: true,
        data: { reviewId: 'review-123', transcription: 'test' },
      });
    }),
  },
}));

import { offlineQueueService, OfflineRecording } from '../offlineQueueService';

describe('Property 9: Silent Error Handling', () => {
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

  const networkErrorTypeArb = fc.constantFrom(
    'network',
    'timeout', 
    'connection',
    'server'
  );

  beforeEach(() => {
    // Clear state
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    errorDialogsShown = [];
    mockApiShouldFail = false;
    mockApiErrorType = 'network';
    mockUuidCounter = 0;
    mockNetInfo.isConnected = true;
    mockNetInfo.isInternetReachable = true;
    jest.clearAllMocks();
  });

  test('Property 9.1: Network errors during queue processing do not throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRecordingInputArb,
        networkErrorTypeArb,
        async (input, errorType) => {
          // Clear state
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          // Add recording to queue
          await offlineQueueService.addToQueue(input);

          // Configure API to fail with specific error type
          mockApiShouldFail = true;
          mockApiErrorType = errorType;

          // Property: Processing should not throw, errors handled silently
          let threwError = false;
          try {
            await offlineQueueService.processQueue();
          } catch {
            threwError = true;
          }

          expect(threwError).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 9.2: Connection failures update status without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Simulate connection failure
        mockApiShouldFail = true;
        mockApiErrorType = 'connection';

        // Property: Should not throw
        let threwError = false;
        try {
          await offlineQueueService.processRecording(id);
        } catch {
          threwError = true;
        }

        expect(threwError).toBe(false);

        // Property: Status updated to reflect error
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);
        
        // Recording should still exist with updated status
        expect(recording).toBeDefined();
        expect(recording?.retryCount).toBeGreaterThan(0);
        expect(recording?.lastError).toBeDefined();
      }),
      { numRuns: 30 }
    );
  });

  test('Property 9.3: Timeout errors are handled without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Simulate timeout
        mockApiShouldFail = true;
        mockApiErrorType = 'timeout';

        // Property: Should not throw
        let threwError = false;
        try {
          await offlineQueueService.processRecording(id);
        } catch {
          threwError = true;
        }

        expect(threwError).toBe(false);
      }),
      { numRuns: 30 }
    );
  });

  test('Property 9.4: Multiple consecutive errors do not throw', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validRecordingInputArb, { minLength: 1, maxLength: 3 }),
        async (inputs) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          // Add multiple recordings
          for (const input of inputs) {
            await offlineQueueService.addToQueue(input);
          }

          // Configure all to fail
          mockApiShouldFail = true;

          // Property: Should not throw even with multiple failures
          let threwError = false;
          try {
            await offlineQueueService.processQueue();
          } catch {
            threwError = true;
          }

          expect(threwError).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  test('Property 9.5: Error state reflected in recording status only', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRecordingInputArb,
        networkErrorTypeArb,
        async (input, errorType) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          // Add recording
          const id = await offlineQueueService.addToQueue(input);

          // Get initial state
          let queue = await offlineQueueService.getQueue();
          const initialRecording = queue.find(r => r.id === id);
          expect(initialRecording?.status).toBe('pending');
          expect(initialRecording?.retryCount).toBe(0);

          // Cause error
          mockApiShouldFail = true;
          mockApiErrorType = errorType;
          const result = await offlineQueueService.processRecording(id);

          // Property: Result indicates failure without throwing
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();

          queue = await offlineQueueService.getQueue();
          const updatedRecording = queue.find(r => r.id === id);
          
          // Status should indicate error state
          expect(updatedRecording?.retryCount).toBeGreaterThan(0);
          expect(updatedRecording?.lastError).toBeDefined();
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 9.6: Offline state handled silently', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Add recording
        await offlineQueueService.addToQueue(input);

        // Simulate offline state
        mockNetInfo.isConnected = false;
        mockNetInfo.isInternetReachable = false;

        // Property: Should not throw, just return empty results
        let threwError = false;
        let results: any[] = [];
        try {
          results = await offlineQueueService.processQueue();
        } catch {
          threwError = true;
        }

        expect(threwError).toBe(false);
        expect(results.length).toBe(0);
      }),
      { numRuns: 30 }
    );
  });

  test('Property 9.7: Retry failures are silent until max retries', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Configure to always fail
        mockApiShouldFail = true;

        // Property: Multiple retries should not throw
        let threwError = false;
        try {
          for (let i = 0; i < 3; i++) {
            await offlineQueueService.processRecording(id);
          }
        } catch {
          threwError = true;
        }

        expect(threwError).toBe(false);

        // Verify retry count updated
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);
        expect(recording?.retryCount).toBe(3);
        expect(recording?.status).toBe('failed');
      }),
      { numRuns: 20 }
    );
  });

  test('Property 9.8: Queue change callbacks receive error info without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        const queueChanges: OfflineRecording[][] = [];
        const unsubscribe = offlineQueueService.onQueueChange((queue) => {
          queueChanges.push([...queue]);
        });

        try {
          // Add recording
          const id = await offlineQueueService.addToQueue(input);

          // Cause error
          mockApiShouldFail = true;
          
          let threwError = false;
          try {
            await offlineQueueService.processRecording(id);
          } catch {
            threwError = true;
          }

          // Property: Should not throw
          expect(threwError).toBe(false);

          // Property: Callbacks received updates
          expect(queueChanges.length).toBeGreaterThan(0);

          // Property: Error info available in queue data
          const lastQueue = queueChanges[queueChanges.length - 1];
          const recording = lastQueue.find(r => r.id === id);
          expect(recording?.lastError).toBeDefined();
        } finally {
          unsubscribe();
        }
      }),
      { numRuns: 20 }
    );
  });
});
