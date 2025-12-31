/**
 * Property Test: Age-Based Urgency Flagging
 * 
 * Property 16: For any offline queue item where (currentTime - recordedAt) > 24 hours,
 * the item SHALL be flagged as `isUrgent: true`. Items younger than 24 hours SHALL
 * have `isUrgent: false`.
 * 
 * Validates: Requirements 10.6
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
let mockUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `test-uuid-${++mockUuidCounter}`),
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

import { offlineQueueService } from '../offlineQueueService';

describe('Property 16: Age-Based Urgency Flagging', () => {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  // Arbitrary generators
  const audioUriArb = fc.string({ minLength: 5, maxLength: 100 })
    .map(s => `file://${s.replace(/[^a-zA-Z0-9]/g, '_')}.wav`);
  
  const durationArb = fc.float({ min: Math.fround(0.1), max: Math.fround(3600), noNaN: true });
  
  const contextTypeArb = fc.constantFrom('patient' as const, 'global' as const);
  const languageArb = fc.constantFrom('ja', 'en', 'zh-TW');
  const userIdArb = fc.uuid();

  // Generate age in milliseconds
  const recentAgeArb = fc.integer({ min: 0, max: TWENTY_FOUR_HOURS_MS - 1000 }); // Less than 24 hours
  const oldAgeArb = fc.integer({ min: TWENTY_FOUR_HOURS_MS + 1000, max: TWENTY_FOUR_HOURS_MS * 7 }); // More than 24 hours

  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    mockUuidCounter = 0;
    jest.clearAllMocks();
  });

  test('Property 16.1: Items older than 24 hours are flagged as urgent', async () => {
    await fc.assert(
      fc.asyncProperty(oldAgeArb, async (ageMs) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        const recordedAt = new Date(Date.now() - ageMs);

        // Add old recording
        const id = await offlineQueueService.addToQueue({
          audioUri: 'file://test.wav',
          duration: 10,
          recordedAt,
          contextType: 'global' as const,
          language: 'ja',
          userId: 'user-123',
        });

        // Get queue
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);

        // Property: Old items should be flagged as urgent
        expect(recording).toBeDefined();
        expect(recording?.isUrgent).toBe(true);
      }),
      { numRuns: 30 }
    );
  });

  test('Property 16.2: Items younger than 24 hours are not flagged as urgent', async () => {
    await fc.assert(
      fc.asyncProperty(recentAgeArb, async (ageMs) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        const recordedAt = new Date(Date.now() - ageMs);

        // Add recent recording
        const id = await offlineQueueService.addToQueue({
          audioUri: 'file://test.wav',
          duration: 10,
          recordedAt,
          contextType: 'global' as const,
          language: 'ja',
          userId: 'user-123',
        });

        // Get queue
        const queue = await offlineQueueService.getQueue();
        const recording = queue.find(r => r.id === id);

        // Property: Recent items should not be flagged as urgent
        expect(recording).toBeDefined();
        expect(recording?.isUrgent).toBe(false);
      }),
      { numRuns: 30 }
    );
  });

  test('Property 16.3: Urgency threshold is exactly 24 hours', async () => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

    const now = Date.now();

    // Add recording exactly at 24 hour boundary (just under)
    const justUnder24Hours = new Date(now - TWENTY_FOUR_HOURS_MS + 1000);
    const id1 = await offlineQueueService.addToQueue({
      audioUri: 'file://just_under.wav',
      duration: 10,
      recordedAt: justUnder24Hours,
      contextType: 'global' as const,
      language: 'ja',
      userId: 'user-123',
    });

    // Add recording exactly at 24 hour boundary (just over)
    const justOver24Hours = new Date(now - TWENTY_FOUR_HOURS_MS - 1000);
    const id2 = await offlineQueueService.addToQueue({
      audioUri: 'file://just_over.wav',
      duration: 10,
      recordedAt: justOver24Hours,
      contextType: 'global' as const,
      language: 'ja',
      userId: 'user-123',
    });

    const queue = await offlineQueueService.getQueue();
    const recording1 = queue.find(r => r.id === id1);
    const recording2 = queue.find(r => r.id === id2);

    // Property: Just under 24 hours should not be urgent
    expect(recording1?.isUrgent).toBe(false);

    // Property: Just over 24 hours should be urgent
    expect(recording2?.isUrgent).toBe(true);
  });

  test('Property 16.4: getUrgentRecordings returns only urgent items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 5 }),
        async (isOldFlags) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          const now = Date.now();
          const ids: { id: string; isOld: boolean }[] = [];

          // Add mix of old and recent recordings
          for (let i = 0; i < isOldFlags.length; i++) {
            const isOld = isOldFlags[i];
            const ageMs = isOld 
              ? TWENTY_FOUR_HOURS_MS + 1000 + i * 1000 
              : 1000 + i * 1000;
            
            const id = await offlineQueueService.addToQueue({
              audioUri: `file://test_${i}.wav`,
              duration: 10,
              recordedAt: new Date(now - ageMs),
              contextType: 'global' as const,
              language: 'ja',
              userId: 'user-123',
            });
            ids.push({ id, isOld });
          }

          // Get urgent recordings
          const urgentRecordings = await offlineQueueService.getUrgentRecordings();

          // Property: All returned recordings should be urgent
          for (const recording of urgentRecordings) {
            expect(recording.isUrgent).toBe(true);
          }

          // Property: Count should match number of old recordings
          const expectedUrgentCount = isOldFlags.filter(f => f).length;
          expect(urgentRecordings.length).toBe(expectedUrgentCount);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 16.5: Urgency is recalculated on each queue retrieval', async () => {
    // This test simulates time passing by manipulating recordedAt
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

    // Add a recording that's 23 hours old (not urgent yet)
    const almostOldTime = new Date(Date.now() - (23 * 60 * 60 * 1000));
    const id = await offlineQueueService.addToQueue({
      audioUri: 'file://test.wav',
      duration: 10,
      recordedAt: almostOldTime,
      contextType: 'global' as const,
      language: 'ja',
      userId: 'user-123',
    });

    // Get queue - should not be urgent
    let queue = await offlineQueueService.getQueue();
    let recording = queue.find(r => r.id === id);
    expect(recording?.isUrgent).toBe(false);

    // Manually update the storage to simulate time passing
    // Change recordedAt to be 25 hours ago
    const storageData = JSON.parse(mockStorage['@verbumcare/offline_recordings']);
    const recordingIndex = storageData.recordings.findIndex((r: any) => r.id === id);
    storageData.recordings[recordingIndex].recordedAt = new Date(
      Date.now() - (25 * 60 * 60 * 1000)
    ).toISOString();
    mockStorage['@verbumcare/offline_recordings'] = JSON.stringify(storageData);

    // Get queue again - should now be urgent
    queue = await offlineQueueService.getQueue();
    recording = queue.find(r => r.id === id);
    expect(recording?.isUrgent).toBe(true);
  });

  test('Property 16.6: Completed recordings excluded from urgent list', async () => {
    await fc.assert(
      fc.asyncProperty(oldAgeArb, async (ageMs) => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

        const recordedAt = new Date(Date.now() - ageMs);

        // Add old recording
        const id = await offlineQueueService.addToQueue({
          audioUri: 'file://test.wav',
          duration: 10,
          recordedAt,
          contextType: 'global' as const,
          language: 'ja',
          userId: 'user-123',
        });

        // Manually mark as completed
        const storageData = JSON.parse(mockStorage['@verbumcare/offline_recordings']);
        const recordingIndex = storageData.recordings.findIndex((r: any) => r.id === id);
        storageData.recordings[recordingIndex].status = 'completed';
        mockStorage['@verbumcare/offline_recordings'] = JSON.stringify(storageData);

        // Get urgent recordings
        const urgentRecordings = await offlineQueueService.getUrgentRecordings();

        // Property: Completed recordings should not be in urgent list
        const found = urgentRecordings.find(r => r.id === id);
        expect(found).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });

  test('Property 16.7: Urgency flag is boolean', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: TWENTY_FOUR_HOURS_MS * 3 }),
        async (ageMs) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          const recordedAt = new Date(Date.now() - ageMs);

          const id = await offlineQueueService.addToQueue({
            audioUri: 'file://test.wav',
            duration: 10,
            recordedAt,
            contextType: 'global' as const,
            language: 'ja',
            userId: 'user-123',
          });

          const queue = await offlineQueueService.getQueue();
          const recording = queue.find(r => r.id === id);

          // Property: isUrgent should always be a boolean
          expect(typeof recording?.isUrgent).toBe('boolean');
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 16.8: Multiple old recordings all flagged as urgent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(oldAgeArb, { minLength: 2, maxLength: 5 }),
        async (ages) => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key]);

          const ids: string[] = [];

          // Add multiple old recordings
          for (const ageMs of ages) {
            const id = await offlineQueueService.addToQueue({
              audioUri: `file://test_${ageMs}.wav`,
              duration: 10,
              recordedAt: new Date(Date.now() - ageMs),
              contextType: 'global' as const,
              language: 'ja',
              userId: 'user-123',
            });
            ids.push(id);
          }

          const queue = await offlineQueueService.getQueue();

          // Property: All old recordings should be flagged as urgent
          for (const id of ids) {
            const recording = queue.find(r => r.id === id);
            expect(recording?.isUrgent).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
