/**
 * Property-Based Tests for Voice Review Store
 * Feature: voice-first-ai-categorization
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVoiceReviewStore } from '../voiceReviewStore';
import { voiceReviewService, VoiceReviewItem } from '@services/voiceReviewService';
import { useAuthStore } from '../authStore';

// Mock modules
jest.mock('@services/voiceReviewService');
jest.mock('../authStore');

const mockedVoiceReviewService = voiceReviewService as jest.Mocked<typeof voiceReviewService>;
const mockedUseAuthStore = useAuthStore as jest.Mocked<typeof useAuthStore>;

// Custom generators
const reviewItemGenerator = () => fc.record({
  reviewId: fc.uuid().filter(id => id !== '00000000-0000-1000-8000-000000000000'), // Avoid all-zeros UUID
  recordingId: fc.uuid(),
  userId: fc.uuid(),
  contextType: fc.constantFrom('patient', 'global') as fc.Arbitrary<'patient' | 'global'>,
  contextPatientId: fc.option(fc.uuid(), { nil: undefined }),
  contextPatientName: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
  audioUri: fc.webUrl(),
  duration: fc.integer({ min: 1000, max: 300000 }), // 1s to 5min
  recordedAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
  transcript: fc.string({ minLength: 50, maxLength: 500 }),
  transcriptLanguage: fc.constantFrom('ja', 'en', 'zh-TW') as fc.Arbitrary<'ja' | 'en' | 'zh-TW'>,
  extractedData: fc.record({
    categories: fc.array(fc.record({
      type: fc.constantFrom('vitals', 'medication', 'clinical_note', 'adl', 'incident', 'care_plan', 'pain'),
      confidence: fc.double({ min: 0.6, max: 1.0 }),
      data: fc.anything(),
      fieldConfidences: fc.dictionary(fc.string(), fc.double({ min: 0.6, max: 1.0 }))
    }), { minLength: 1, maxLength: 3 }),
    overallConfidence: fc.double({ min: 0.6, max: 1.0 })
  }),
  confidence: fc.double({ min: 0.6, max: 1.0 }),
  status: fc.constantFrom('pending', 'in_review', 'confirmed', 'discarded') as fc.Arbitrary<'pending' | 'in_review' | 'confirmed' | 'discarded'>,
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
  reviewedAt: fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date() }), { nil: undefined }),
  processingTime: fc.integer({ min: 10000, max: 90000 }), // 10s to 90s
  modelVersion: fc.string({ minLength: 5, maxLength: 20 })
});

describe('Voice Review Store Property Tests', () => {
  beforeEach(async () => {
    // Clear all mocks first
    jest.clearAllMocks();

    // Reset AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

    // Clear store completely using clearStore action
    const store = useVoiceReviewStore.getState();
    store.clearStore();

    // Double-check state is reset
    useVoiceReviewStore.setState({
      reviewQueue: [],
      currentReview: null,
      isLoading: false,
      error: null
    });

    // Mock auth store
    (mockedUseAuthStore.getState as jest.Mock).mockReturnValue({
      currentUser: {
        userId: 'test-user-id',
        staffId: 'test-staff-id',
        username: 'testuser',
        fullName: 'Test User',
        role: 'nurse',
        facilityId: 'test-facility-id',
        loginTime: new Date()
      },
      tokens: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      },
      isAuthenticated: true
    });
  });

  /**
   * Feature: voice-first-ai-categorization, Property 39: Queue persistence across sessions
   * Validates: Requirements 11.5
   */
  describe('Property 39: Queue persistence across sessions', () => {
    it('should persist queue to AsyncStorage and restore it after logout/login', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(reviewItemGenerator(), { minLength: 1, maxLength: 5 }), // Reduced for memory
          async (reviewItems) => {
            // Reset store before each property test iteration
            useVoiceReviewStore.setState({
              reviewQueue: [],
              currentReview: null,
              isLoading: false,
              error: null
            });

            const store = useVoiceReviewStore.getState();

            // Ensure unique review IDs to avoid duplicate rejection
            const uniqueItems = reviewItems.map((item, index) => ({
              ...item,
              reviewId: `test-review-${index}-${Date.now()}`
            }));

            // Add items to queue
            for (const item of uniqueItems) {
              await store.addToQueue(item as VoiceReviewItem);
            }

            // Verify items are in queue
            const queueBeforeSave = store.reviewQueue;
            expect(queueBeforeSave.length).toBe(uniqueItems.length);

            // Save to storage (should happen automatically, but call explicitly for test)
            await store.saveQueueToStorage();

            // Verify AsyncStorage.setItem was called
            expect(AsyncStorage.setItem).toHaveBeenCalled();

            // Get the serialized data that was saved
            const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
            const lastCall = setItemCalls[setItemCalls.length - 1];
            const serializedData = lastCall[1];

            // Simulate logout - clear store state only (not AsyncStorage)
            useVoiceReviewStore.setState({
              reviewQueue: [],
              currentReview: null,
              isLoading: false,
              error: null
            });
            expect(store.reviewQueue.length).toBe(0);

            // Simulate login - restore from storage
            // Mock AsyncStorage.getItem to return the saved data
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(serializedData);

            await store.loadQueueFromStorage();

            // Verify queue is restored
            const queueAfterRestore = store.reviewQueue;
            expect(queueAfterRestore.length).toBe(reviewItems.length);

            // Verify all items are restored with correct data
            for (let i = 0; i < uniqueItems.length; i++) {
              const original = uniqueItems[i];
              const restored = queueAfterRestore.find(item => item.reviewId === original.reviewId);

              expect(restored).toBeDefined();
              expect(restored?.reviewId).toBe(original.reviewId);
              expect(restored?.recordingId).toBe(original.recordingId);
              expect(restored?.userId).toBe(original.userId);
              expect(restored?.contextType).toBe(original.contextType);
              expect(restored?.transcript).toBe(original.transcript);
              expect(restored?.status).toBe(original.status);

              // Verify dates are restored as Date objects
              expect(restored?.recordedAt).toBeInstanceOf(Date);
              expect(restored?.createdAt).toBeInstanceOf(Date);
            }
          }
        ),
        { numRuns: 10 } // Reduced for memory constraints
      );
    });

    it('should handle corrupted storage gracefully by clearing and starting fresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }), // Random corrupted data
          async (corruptedData) => {
            const store = useVoiceReviewStore.getState();

            // Mock AsyncStorage to return corrupted data
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(corruptedData);

            // Attempt to load from storage
            await store.loadQueueFromStorage();

            // Verify store falls back to empty queue
            expect(store.reviewQueue.length).toBe(0);

            // Verify corrupted storage was cleared
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@verbumcare_review_queue');
          }
        ),
        { numRuns: 10 } // Reduced for memory constraints
      );
    });

    it('should maintain queue order after persistence cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(reviewItemGenerator(), { minLength: 2, maxLength: 5 }), // Reduced for memory
          async (reviewItems) => {
            const store = useVoiceReviewStore.getState();

            // Add items to queue (they will be sorted by createdAt)
            for (const item of reviewItems) {
              await store.addToQueue(item as VoiceReviewItem);
            }

            const queueBeforeSave = store.reviewQueue;

            // Save to storage
            await store.saveQueueToStorage();

            // Get the serialized data
            const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
            const lastCall = setItemCalls[setItemCalls.length - 1];
            const serializedData = lastCall[1];

            // Clear store
            store.clearStore();

            // Restore from storage
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(serializedData);
            await store.loadQueueFromStorage();

            const queueAfterRestore = store.reviewQueue;

            // Verify order is maintained (chronological by createdAt)
            for (let i = 0; i < queueAfterRestore.length - 1; i++) {
              expect(queueAfterRestore[i].createdAt.getTime()).toBeLessThanOrEqual(
                queueAfterRestore[i + 1].createdAt.getTime()
              );
            }

            // Verify same order as before save
            expect(queueAfterRestore.map(item => item.reviewId)).toEqual(
              queueBeforeSave.map(item => item.reviewId)
            );
          }
        ),
        { numRuns: 10 } // Reduced for memory constraints
      );
    });

    it('should preserve all review item fields through persistence cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          reviewItemGenerator(),
          async (reviewItem) => {
            // Reset store before each property test iteration
            useVoiceReviewStore.setState({
              reviewQueue: [],
              currentReview: null,
              isLoading: false,
              error: null
            });

            const store = useVoiceReviewStore.getState();

            // Ensure unique review ID
            const uniqueItem = {
              ...reviewItem,
              reviewId: `test-review-${Date.now()}-${Math.random()}`
            };

            // Add item to queue
            await store.addToQueue(uniqueItem as VoiceReviewItem);

            // Save to storage
            await store.saveQueueToStorage();

            // Get the serialized data
            const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
            const lastCall = setItemCalls[setItemCalls.length - 1];
            const serializedData = lastCall[1];

            // Clear store state (but not AsyncStorage)
            useVoiceReviewStore.setState({
              reviewQueue: [],
              currentReview: null,
              isLoading: false,
              error: null
            });

            // Restore from storage
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(serializedData);
            await store.loadQueueFromStorage();

            // Find the restored item by reviewId (since queue might be sorted)
            const restored = store.reviewQueue.find(item => item.reviewId === uniqueItem.reviewId);
            expect(restored).toBeDefined();

            if (!restored) return; // Type guard

            // Verify all fields are preserved
            expect(restored.reviewId).toBe(uniqueItem.reviewId);
            expect(restored.recordingId).toBe(uniqueItem.recordingId);
            expect(restored.userId).toBe(uniqueItem.userId);
            expect(restored.contextType).toBe(uniqueItem.contextType);
            expect(restored.contextPatientId).toBe(uniqueItem.contextPatientId);
            expect(restored.contextPatientName).toBe(uniqueItem.contextPatientName);
            expect(restored.audioUri).toBe(uniqueItem.audioUri);
            expect(restored.duration).toBe(uniqueItem.duration);
            expect(restored.transcript).toBe(uniqueItem.transcript);
            expect(restored.transcriptLanguage).toBe(uniqueItem.transcriptLanguage);
            expect(restored.confidence).toBe(uniqueItem.confidence);
            expect(restored.status).toBe(uniqueItem.status);
            expect(restored.processingTime).toBe(uniqueItem.processingTime);
            expect(restored.modelVersion).toBe(uniqueItem.modelVersion);

            // Verify dates are restored correctly
            expect(restored.recordedAt.getTime()).toBe(uniqueItem.recordedAt.getTime());
            expect(restored.createdAt.getTime()).toBe(uniqueItem.createdAt.getTime());
            
            if (uniqueItem.reviewedAt) {
              expect(restored.reviewedAt?.getTime()).toBe(uniqueItem.reviewedAt.getTime());
            } else {
              expect(restored.reviewedAt).toBeUndefined();
            }

            // Verify extracted data structure is preserved
            expect(restored.extractedData.categories.length).toBe(uniqueItem.extractedData.categories.length);
            expect(restored.extractedData.overallConfidence).toBe(uniqueItem.extractedData.overallConfidence);
          }
        ),
        { numRuns: 10 } // Reduced for memory constraints
      );
    });
  });

  /**
   * Additional property: Queue count accuracy
   * Validates: Requirements 8.2
   */
  describe('Property 31: Queue count accuracy', () => {
    it('should return accurate count of pending reviews', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(reviewItemGenerator(), { minLength: 0, maxLength: 5 }), // Reduced for memory
          async (reviewItems) => {
            // Reset store before each property test iteration
            useVoiceReviewStore.setState({
              reviewQueue: [],
              currentReview: null,
              isLoading: false,
              error: null
            });

            const store = useVoiceReviewStore.getState();

            // Add items to queue
            for (const item of reviewItems) {
              await store.addToQueue(item as VoiceReviewItem);
            }

            // Count pending items
            const pendingCount = reviewItems.filter(item => item.status === 'pending').length;

            // Verify queue count matches
            expect(store.queueCount()).toBe(pendingCount);
          }
        ),
        { numRuns: 10 } // Reduced for memory constraints
      );
    });

    it('should update count when items are removed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(reviewItemGenerator(), { minLength: 2, maxLength: 5 }), // Reduced for memory
          async (reviewItems) => {
            // Reset store before each property test iteration
            useVoiceReviewStore.setState({
              reviewQueue: [],
              currentReview: null,
              isLoading: false,
              error: null
            });

            const store = useVoiceReviewStore.getState();

            // Add items to queue
            for (const item of reviewItems) {
              await store.addToQueue(item as VoiceReviewItem);
            }

            const initialCount = store.queueCount();

            // Ensure we have items to remove
            if (store.reviewQueue.length === 0) {
              return; // Skip this test case
            }

            // Remove first item
            const firstItem = store.reviewQueue[0];
            await store.removeFromQueue(firstItem.reviewId);

            // Verify count decreased if item was pending
            if (firstItem.status === 'pending') {
              expect(store.queueCount()).toBe(initialCount - 1);
            } else {
              expect(store.queueCount()).toBe(initialCount);
            }
          }
        ),
        { numRuns: 10 } // Reduced for memory constraints
      );
    });
  });
});
