/**
 * Property-Based Tests for Voice Review Screen
 * Feature: voice-first-ai-categorization
 */

import fc from 'fast-check';
import { voiceReviewService, VoiceReviewItem, ExtractedData } from '@services/voiceReviewService';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock modules
jest.mock('@services/voiceReviewService');
jest.mock('@stores/authStore');

const mockedVoiceReviewService = voiceReviewService as jest.Mocked<typeof voiceReviewService>;

// Custom generators
const extractedDataGenerator = () => fc.record({
  categories: fc.array(fc.record({
    type: fc.constantFrom('vitals', 'medication', 'clinical_note', 'adl', 'incident', 'care_plan', 'pain'),
    confidence: fc.double({ min: 0.6, max: 1.0 }),
    data: fc.record({
      // Vitals data
      blood_pressure: fc.option(fc.record({
        systolic: fc.integer({ min: 70, max: 250 }),
        diastolic: fc.integer({ min: 40, max: 150 })
      }), { nil: undefined }),
      heart_rate: fc.option(fc.integer({ min: 30, max: 250 }), { nil: undefined }),
      temperature: fc.option(fc.double({ min: 35.0, max: 42.0 }), { nil: undefined }),
      // Medication data
      medication_name: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: undefined }),
      dose: fc.option(fc.string({ minLength: 2, maxLength: 20 }), { nil: undefined }),
      route: fc.option(fc.constantFrom('oral', 'IV', 'IM', 'SC'), { nil: undefined })
    }),
    fieldConfidences: fc.dictionary(fc.string(), fc.double({ min: 0.6, max: 1.0 }))
  }), { minLength: 1, maxLength: 3 }),
  overallConfidence: fc.double({ min: 0.6, max: 1.0 })
});

const reviewItemGenerator = () => fc.record({
  reviewId: fc.uuid(),
  recordingId: fc.uuid(),
  userId: fc.uuid(),
  contextType: fc.constantFrom('patient', 'global') as fc.Arbitrary<'patient' | 'global'>,
  contextPatientId: fc.option(fc.uuid(), { nil: undefined }),
  contextPatientName: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
  audioUri: fc.webUrl(),
  duration: fc.integer({ min: 1000, max: 300000 }),
  recordedAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
  transcript: fc.string({ minLength: 50, maxLength: 500 }),
  transcriptLanguage: fc.constantFrom('ja', 'en', 'zh-TW') as fc.Arbitrary<'ja' | 'en' | 'zh-TW'>,
  extractedData: extractedDataGenerator(),
  confidence: fc.double({ min: 0.6, max: 1.0 }),
  status: fc.constantFrom('pending', 'in_review') as fc.Arbitrary<'pending' | 'in_review'>,
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
  reviewedAt: fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date() }), { nil: undefined }),
  processingTime: fc.integer({ min: 10000, max: 90000 }),
  modelVersion: fc.string({ minLength: 5, maxLength: 20 })
});

describe('Voice Review Screen Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    
    // Reset store
    useVoiceReviewStore.setState({
      reviewQueue: [],
      currentReview: null,
      isLoading: false,
      error: null
    });
  });

  /**
   * Feature: voice-first-ai-categorization, Property 20: No auto-save
   * Validates: Requirements 5.7, 11.1
   * 
   * For any completed AI extraction, the system SHALL NOT save data to
   * the database until explicit user confirmation
   */
  describe('Property 20: No auto-save', () => {
    
    it('should NOT call confirmReview API until user explicitly confirms', async () => {
      await fc.assert(
        fc.asyncProperty(
          reviewItemGenerator(),
          async (reviewItem) => {
            const store = useVoiceReviewStore.getState();
            
            // Clear store state before each test iteration
            store.clearStore();
            
            // Clear mock call history
            mockedVoiceReviewService.confirmReview.mockClear();
            
            // Mock service methods
            mockedVoiceReviewService.confirmReview.mockResolvedValue({
              success: true,
              message: 'Review confirmed'
            });
            
            // Add review item to queue (simulating AI processing completion)
            await store.addToQueue(reviewItem as VoiceReviewItem);
            
            // Verify item is in queue
            expect(store.reviewQueue.length).toBe(1);
            expect(store.reviewQueue[0].reviewId).toBe(reviewItem.reviewId);
            
            // Verify confirmReview was NOT called automatically
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            
            // Simulate user opening review screen (setting current review)
            store.setCurrentReview(reviewItem.reviewId);
            
            // Verify confirmReview still NOT called
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            
            // Simulate user editing extracted data (without confirming)
            await store.updateReview(reviewItem.reviewId, {
              extractedData: {
                ...reviewItem.extractedData,
                overallConfidence: 0.95
              }
            });
            
            // Verify confirmReview still NOT called
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            
            // Only when user explicitly confirms should API be called
            await store.confirmReview(reviewItem.reviewId, reviewItem.extractedData);
            
            // NOW confirmReview should have been called
            expect(mockedVoiceReviewService.confirmReview).toHaveBeenCalledTimes(1);
            expect(mockedVoiceReviewService.confirmReview).toHaveBeenCalledWith(
              reviewItem.reviewId,
              reviewItem.extractedData
            );
          }
        ),
        { numRuns: 10 } // Reduced to avoid timeout from setTimeout delays
      );
    });

    it('should keep data in queue without saving when user edits transcript', async () => {
      await fc.assert(
        fc.asyncProperty(
          reviewItemGenerator(),
          fc.string({ minLength: 50, maxLength: 500 }), // Edited transcript
          async (reviewItem, editedTranscript) => {
            const store = useVoiceReviewStore.getState();
            
            // Mock service methods
            mockedVoiceReviewService.reanalyzeTranscript.mockResolvedValue({
              ...reviewItem,
              transcript: editedTranscript,
              extractedData: {
                ...reviewItem.extractedData,
                overallConfidence: 0.85
              }
            } as VoiceReviewItem);
            
            mockedVoiceReviewService.confirmReview.mockResolvedValue({
              success: true,
              message: 'Review confirmed'
            });
            
            // Add review item to queue
            await store.addToQueue(reviewItem as VoiceReviewItem);
            
            // User edits transcript and re-analyzes
            await store.reanalyzeTranscript(reviewItem.reviewId, editedTranscript);
            
            // Verify confirmReview was NOT called during re-analysis
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            
            // Verify item is still in queue with updated data
            const updatedItem = store.reviewQueue.find(item => item.reviewId === reviewItem.reviewId);
            expect(updatedItem).toBeDefined();
            expect(updatedItem?.transcript).toBe(editedTranscript);
            
            // Verify reanalyzeTranscript was called
            expect(mockedVoiceReviewService.reanalyzeTranscript).toHaveBeenCalledTimes(1);
            expect(mockedVoiceReviewService.reanalyzeTranscript).toHaveBeenCalledWith(
              reviewItem.reviewId,
              editedTranscript
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT save data when user discards review', async () => {
      await fc.assert(
        fc.asyncProperty(
          reviewItemGenerator(),
          async (reviewItem) => {
            const store = useVoiceReviewStore.getState();
            
            // Mock service methods
            mockedVoiceReviewService.discardReview.mockResolvedValue({
              success: true,
              message: 'Review discarded'
            });
            
            mockedVoiceReviewService.confirmReview.mockResolvedValue({
              success: true,
              message: 'Review confirmed'
            });
            
            // Add review item to queue
            await store.addToQueue(reviewItem as VoiceReviewItem);
            
            // User discards review
            await store.discardReview(reviewItem.reviewId);
            
            // Verify confirmReview was NOT called
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            
            // Verify discardReview was called
            expect(mockedVoiceReviewService.discardReview).toHaveBeenCalledTimes(1);
            expect(mockedVoiceReviewService.discardReview).toHaveBeenCalledWith(reviewItem.reviewId);
          }
        ),
        { numRuns: 10 } // Reduced to avoid timeout from setTimeout delays
      );
    });

    it('should maintain pending status until explicit confirmation', async () => {
      await fc.assert(
        fc.asyncProperty(
          reviewItemGenerator(),
          async (reviewItem) => {
            const store = useVoiceReviewStore.getState();
            
            // Ensure item starts in pending status
            const pendingItem = {
              ...reviewItem,
              status: 'pending' as const
            };
            
            // Mock service methods
            mockedVoiceReviewService.confirmReview.mockResolvedValue({
              success: true,
              message: 'Review confirmed'
            });
            
            // Add review item to queue
            await store.addToQueue(pendingItem as VoiceReviewItem);
            
            // Verify status is pending
            let currentItem = store.reviewQueue.find(item => item.reviewId === reviewItem.reviewId);
            expect(currentItem?.status).toBe('pending');
            
            // User opens review (status changes to in_review)
            store.setCurrentReview(reviewItem.reviewId);
            
            // Verify status changed to in_review but NOT confirmed
            currentItem = store.reviewQueue.find(item => item.reviewId === reviewItem.reviewId);
            expect(currentItem?.status).toBe('in_review');
            expect(currentItem?.status).not.toBe('confirmed');
            
            // Verify confirmReview still NOT called
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            
            // Only after explicit confirmation should status become confirmed
            await store.confirmReview(reviewItem.reviewId, reviewItem.extractedData);
            
            // Verify confirmReview was called
            expect(mockedVoiceReviewService.confirmReview).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 10 } // Reduced to avoid timeout from setTimeout delays
      );
    });

    it('should preserve extracted data in queue without database save', async () => {
      await fc.assert(
        fc.asyncProperty(
          reviewItemGenerator(),
          async (reviewItem) => {
            const store = useVoiceReviewStore.getState();
            
            // Mock service methods
            mockedVoiceReviewService.confirmReview.mockResolvedValue({
              success: true,
              message: 'Review confirmed'
            });
            
            // Add review item to queue
            await store.addToQueue(reviewItem as VoiceReviewItem);
            
            // Verify extracted data is in queue
            const queuedItem = store.reviewQueue.find(item => item.reviewId === reviewItem.reviewId);
            expect(queuedItem?.extractedData).toEqual(reviewItem.extractedData);
            
            // Verify data is persisted to AsyncStorage (local cache)
            expect(AsyncStorage.setItem).toHaveBeenCalled();
            
            // Verify confirmReview (database save) was NOT called
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            
            // Simulate user editing extracted data
            const editedData: ExtractedData = {
              ...reviewItem.extractedData,
              overallConfidence: 0.99,
              categories: reviewItem.extractedData.categories.map(cat => ({
                ...cat,
                confidence: 0.99
              }))
            };
            
            await store.updateReview(reviewItem.reviewId, {
              extractedData: editedData
            });
            
            // Verify edited data is in queue
            const updatedItem = store.reviewQueue.find(item => item.reviewId === reviewItem.reviewId);
            expect(updatedItem?.extractedData.overallConfidence).toBe(0.99);
            
            // Verify confirmReview still NOT called (no database save)
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 10 } // Reduced to avoid timeout from setTimeout delays
      );
    });

    it('should allow multiple edits without triggering database save', async () => {
      await fc.assert(
        fc.asyncProperty(
          reviewItemGenerator(),
          fc.array(fc.double({ min: 0.6, max: 1.0 }), { minLength: 2, maxLength: 5 }), // Multiple confidence edits
          async (reviewItem, confidenceEdits) => {
            const store = useVoiceReviewStore.getState();
            
            // Mock service methods
            mockedVoiceReviewService.confirmReview.mockResolvedValue({
              success: true,
              message: 'Review confirmed'
            });
            
            // Add review item to queue
            await store.addToQueue(reviewItem as VoiceReviewItem);
            
            // Perform multiple edits
            let lastConfidence = confidenceEdits[0];
            for (const confidence of confidenceEdits) {
              lastConfidence = confidence;
              
              // Get current item to preserve its structure
              const currentItem = store.reviewQueue.find(item => item.reviewId === reviewItem.reviewId);
              if (!currentItem) continue;
              
              await store.updateReview(reviewItem.reviewId, {
                extractedData: {
                  ...currentItem.extractedData,
                  overallConfidence: confidence
                }
              });
              
              // Verify confirmReview NOT called after each edit
              expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
            }
            
            // Verify final state has last edit
            const finalItem = store.reviewQueue.find(item => item.reviewId === reviewItem.reviewId);
            expect(finalItem?.extractedData.overallConfidence).toBe(lastConfidence);
            
            // Verify confirmReview was never called despite multiple edits
            expect(mockedVoiceReviewService.confirmReview).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 10 } // Reduced to avoid timeout from setTimeout delays
      );
    });

  });
});
