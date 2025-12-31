/**
 * Property Test: Offline Queue Metadata Completeness
 * 
 * Property 13: For any recording added to the offline queue, the stored record
 * SHALL contain all required metadata: id, audioUri, duration, recordedAt,
 * contextType, language, userId, status, and retryCount.
 * 
 * Validates: Requirements 10.1
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
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => `test-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
}));

// Mock api service
jest.mock('../api', () => ({
  apiService: {
    uploadVoiceRecording: jest.fn(() => Promise.resolve({
      success: true,
      data: { reviewId: 'review-123', transcription: 'test' },
    })),
  },
}));

import { offlineQueueService, OfflineRecording } from '../offlineQueueService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Property 13: Offline Queue Metadata Completeness', () => {
  // Arbitrary generators
  const audioUriArb = fc.string({ minLength: 5, maxLength: 200 })
    .map(s => `file://${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`);
  
  const durationArb = fc.float({ min: Math.fround(0.1), max: Math.fround(3600), noNaN: true });
  
  const recordedAtArb = fc.integer({ min: 1577836800000, max: 1924905600000 })
    .map(ts => new Date(ts)); // Valid dates between 2020-01-01 and 2030-12-31
  
  const patientIdArb = fc.option(fc.uuid());
  
  const contextTypeArb = fc.constantFrom('patient' as const, 'global' as const);
  
  const languageArb = fc.constantFrom('ja', 'en', 'zh-TW');
  
  const userIdArb = fc.uuid();

  const validRecordingInputArb = fc.record({
    audioUri: audioUriArb,
    duration: durationArb,
    recordedAt: recordedAtArb,
    patientId: patientIdArb,
    contextType: contextTypeArb,
    language: languageArb,
    userId: userIdArb,
  });

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
  });

  test('Property 13.1: All required fields present after addToQueue', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        // Clear storage before each test
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Add recording to queue
        const id = await offlineQueueService.addToQueue(input);

        // Get the queue
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);

        // Property: Recording must exist
        expect(recording).toBeDefined();
        if (!recording) return;

        // Property: All required fields must be present
        expect(recording.id).toBeDefined();
        expect(typeof recording.id).toBe('string');
        expect(recording.id.length).toBeGreaterThan(0);

        expect(recording.audioUri).toBeDefined();
        expect(typeof recording.audioUri).toBe('string');
        expect(recording.audioUri).toBe(input.audioUri);

        expect(recording.duration).toBeDefined();
        expect(typeof recording.duration).toBe('number');
        expect(recording.duration).toBe(input.duration);

        expect(recording.recordedAt).toBeDefined();
        expect(recording.recordedAt instanceof Date).toBe(true);

        expect(recording.contextType).toBeDefined();
        expect(['patient', 'global']).toContain(recording.contextType);
        expect(recording.contextType).toBe(input.contextType);

        expect(recording.language).toBeDefined();
        expect(typeof recording.language).toBe('string');
        expect(recording.language).toBe(input.language);

        expect(recording.userId).toBeDefined();
        expect(typeof recording.userId).toBe('string');
        expect(recording.userId).toBe(input.userId);

        expect(recording.status).toBeDefined();
        expect(recording.status).toBe('pending');

        expect(recording.retryCount).toBeDefined();
        expect(typeof recording.retryCount).toBe('number');
        expect(recording.retryCount).toBe(0);
      }),
      { numRuns: 50 }
    );
  });

  test('Property 13.2: ID is unique for each recording', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validRecordingInputArb, { minLength: 2, maxLength: 10 }),
        async (inputs) => {
          // Clear storage
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          // Add all recordings
          const ids: string[] = [];
          for (const input of inputs) {
            const id = await offlineQueueService.addToQueue(input);
            ids.push(id);
          }

          // Property: All IDs must be unique
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 13.3: Status is always "pending" for new recordings', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        const id = await offlineQueueService.addToQueue(input);
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);

        // Property: New recordings always have 'pending' status
        expect(recording?.status).toBe('pending');
      }),
      { numRuns: 50 }
    );
  });

  test('Property 13.4: RetryCount is always 0 for new recordings', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        const id = await offlineQueueService.addToQueue(input);
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);

        // Property: New recordings always have retryCount of 0
        expect(recording?.retryCount).toBe(0);
      }),
      { numRuns: 50 }
    );
  });

  test('Property 13.5: Duration must be positive', async () => {
    const invalidDurationArb = fc.float({ min: -1000, max: 0, noNaN: true });

    await fc.assert(
      fc.asyncProperty(
        validRecordingInputArb,
        invalidDurationArb,
        async (input, invalidDuration) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          const invalidInput = { ...input, duration: invalidDuration };

          // Property: Adding recording with non-positive duration should throw
          await expect(offlineQueueService.addToQueue(invalidInput))
            .rejects.toThrow('Duration must be positive');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 13.6: ContextType must be valid', async () => {
    const invalidContextArb = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => s !== 'patient' && s !== 'global');

    await fc.assert(
      fc.asyncProperty(
        validRecordingInputArb,
        invalidContextArb,
        async (input, invalidContext) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          const invalidInput = { ...input, contextType: invalidContext as any };

          // Property: Adding recording with invalid contextType should throw
          await expect(offlineQueueService.addToQueue(invalidInput))
            .rejects.toThrow('Invalid contextType');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 13.7: PatientId is optional but preserved when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRecordingInputArb,
        async (input) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          const id = await offlineQueueService.addToQueue(input);
          const queue = await offlineQueueService.getQueue();
          const recording = queue.find(r => r.id === id);

          // Property: PatientId should match input (including undefined/null)
          if (input.patientId === null || input.patientId === undefined) {
            expect(recording?.patientId == null).toBe(true); // null or undefined
          } else {
            expect(recording?.patientId).toBe(input.patientId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 13.8: RecordedAt date is preserved correctly', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        const id = await offlineQueueService.addToQueue(input);
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);

        // Property: RecordedAt should be preserved (within 1 second tolerance for serialization)
        const inputTime = input.recordedAt.getTime();
        const storedTime = recording?.recordedAt.getTime() || 0;
        expect(Math.abs(inputTime - storedTime)).toBeLessThan(1000);
      }),
      { numRuns: 50 }
    );
  });

  test('Property 13.9: Queue persists across service instances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validRecordingInputArb, { minLength: 1, maxLength: 5 }),
        async (inputs) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          // Add recordings
          const ids: string[] = [];
          for (const input of inputs) {
            const id = await offlineQueueService.addToQueue(input);
            ids.push(id);
          }

          // Simulate getting queue (as if from new instance)
          const queue = await offlineQueueService.getQueue();

          // Property: All recordings should be retrievable
          expect(queue.length).toBe(inputs.length);
          
          for (const id of ids) {
            const recording = queue.find(r => r.id === id);
            expect(recording).toBeDefined();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 13.10: Metadata integrity after serialization/deserialization', async () => {
    await fc.assert(
      fc.asyncProperty(validRecordingInputArb, async (input) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        // Add recording
        const id = await offlineQueueService.addToQueue(input);

        // Get raw storage data
        const rawData = mockStorage['@verbumcare/offline_recordings'];
        expect(rawData).toBeDefined();

        // Parse and verify structure
        const parsed = JSON.parse(rawData);
        expect(parsed.version).toBe(1);
        expect(Array.isArray(parsed.recordings)).toBe(true);

        // Find our recording in raw data
        const rawRecording = parsed.recordings.find((r: any) => r.id === id);
        expect(rawRecording).toBeDefined();

        // Verify all fields are serialized
        expect(rawRecording.audioUri).toBe(input.audioUri);
        expect(rawRecording.duration).toBe(input.duration);
        expect(rawRecording.contextType).toBe(input.contextType);
        expect(rawRecording.language).toBe(input.language);
        expect(rawRecording.userId).toBe(input.userId);
        expect(rawRecording.status).toBe('pending');
        expect(rawRecording.retryCount).toBe(0);
        expect(typeof rawRecording.recordedAt).toBe('string'); // Date serialized as string
      }),
      { numRuns: 50 }
    );
  });
});
