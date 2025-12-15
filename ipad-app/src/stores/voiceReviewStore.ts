import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { voiceReviewService, VoiceReviewItem, ExtractedData } from '@services/voiceReviewService';
import { useAuthStore } from './authStore';

const REVIEW_QUEUE_STORAGE_KEY = '@verbumcare_review_queue';

interface VoiceReviewStore {
  reviewQueue: VoiceReviewItem[];
  currentReview: VoiceReviewItem | null;
  isLoading: boolean;
  error: string | null;

  // Computed properties
  queueCount: () => number;

  // Actions
  loadQueue: (userId?: string) => Promise<void>;
  addToQueue: (item: VoiceReviewItem) => Promise<void>;
  removeFromQueue: (reviewId: string) => Promise<void>;
  updateReview: (reviewId: string, updates: Partial<VoiceReviewItem>) => Promise<void>;
  setCurrentReview: (reviewId: string | null) => void;
  reanalyzeTranscript: (reviewId: string, editedTranscript: string) => Promise<void>;
  confirmReview: (reviewId: string, finalData: ExtractedData) => Promise<void>;
  discardReview: (reviewId: string) => Promise<void>;
  clearError: () => void;
  clearStore: () => void;

  // Persistence
  saveQueueToStorage: () => Promise<void>;
  loadQueueFromStorage: () => Promise<void>;
}

export const useVoiceReviewStore = create<VoiceReviewStore>((set, get) => ({
  reviewQueue: [],
  currentReview: null,
  isLoading: false,
  error: null,

  // Computed property: get queue count
  queueCount: () => {
    return get().reviewQueue.filter(item => item.status === 'pending').length;
  },

  // Load queue from backend API
  loadQueue: async (userId?: string) => {
    try {
      set({ isLoading: true, error: null });

      // Get user ID from auth store if not provided
      const effectiveUserId = userId || useAuthStore.getState().currentUser?.userId;
      
      if (!effectiveUserId) {
        throw new Error('No user ID available');
      }

      // Fetch from backend
      const items = await voiceReviewService.fetchReviewQueue(effectiveUserId);

      // Sort by created date (oldest first)
      const sortedItems = items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      set({ reviewQueue: sortedItems, isLoading: false });

      // Persist to AsyncStorage
      await get().saveQueueToStorage();

      console.log(`[VoiceReviewStore] Loaded ${sortedItems.length} review items`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to load queue:', error.message);
      
      // Fallback to cached queue
      await get().loadQueueFromStorage();
      
      set({
        isLoading: false,
        error: 'Failed to load review queue. Showing cached data.'
      });
    }
  },

  // Add item to queue
  addToQueue: async (item: VoiceReviewItem) => {
    try {
      set((state) => {
        // Check if item already exists
        const exists = state.reviewQueue.some(i => i.reviewId === item.reviewId);
        if (exists) {
          console.warn(`[VoiceReviewStore] Item ${item.reviewId} already in queue`);
          return state;
        }

        // Add to queue and sort by created date
        const newQueue = [...state.reviewQueue, item].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        return { reviewQueue: newQueue };
      });

      // Persist to AsyncStorage
      await get().saveQueueToStorage();

      console.log(`[VoiceReviewStore] Added item ${item.reviewId} to queue`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to add to queue:', error.message);
      set({ error: 'Failed to add item to queue' });
    }
  },

  // Remove item from queue
  removeFromQueue: async (reviewId: string) => {
    try {
      set((state) => ({
        reviewQueue: state.reviewQueue.filter(item => item.reviewId !== reviewId),
        currentReview: state.currentReview?.reviewId === reviewId ? null : state.currentReview
      }));

      // Persist to AsyncStorage
      await get().saveQueueToStorage();

      console.log(`[VoiceReviewStore] Removed item ${reviewId} from queue`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to remove from queue:', error.message);
      set({ error: 'Failed to remove item from queue' });
    }
  },

  // Update review item
  updateReview: async (reviewId: string, updates: Partial<VoiceReviewItem>) => {
    try {
      set((state) => {
        const newQueue = state.reviewQueue.map(item =>
          item.reviewId === reviewId ? { ...item, ...updates } : item
        );

        const newCurrentReview = state.currentReview?.reviewId === reviewId
          ? { ...state.currentReview, ...updates }
          : state.currentReview;

        return {
          reviewQueue: newQueue,
          currentReview: newCurrentReview
        };
      });

      // Persist to AsyncStorage
      await get().saveQueueToStorage();

      console.log(`[VoiceReviewStore] Updated review ${reviewId}`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to update review:', error.message);
      set({ error: 'Failed to update review' });
    }
  },

  // Set current review
  setCurrentReview: (reviewId: string | null) => {
    if (reviewId === null) {
      set({ currentReview: null });
      return;
    }

    const item = get().reviewQueue.find(i => i.reviewId === reviewId);
    if (item) {
      // Update status to 'in_review'
      get().updateReview(reviewId, { status: 'in_review' });
      set({ currentReview: item });
    }
  },

  // Re-analyze transcript
  reanalyzeTranscript: async (reviewId: string, editedTranscript: string) => {
    try {
      set({ isLoading: true, error: null });

      // Call backend API
      const reanalysisResult = await voiceReviewService.reanalyzeTranscript(reviewId, editedTranscript);

      // Update only the relevant fields in the store
      await get().updateReview(reviewId, {
        transcript: reanalysisResult.transcript,
        extractedData: reanalysisResult.extractedData,
        confidence: reanalysisResult.confidence,
        processingTime: reanalysisResult.processingTime
      });

      set({ isLoading: false });

      console.log(`[VoiceReviewStore] Re-analyzed review ${reviewId}`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to re-analyze:', error.message);
      set({
        isLoading: false,
        error: 'Failed to re-analyze transcript'
      });
      throw error;
    }
  },

  // Confirm review
  confirmReview: async (reviewId: string, finalData: ExtractedData) => {
    try {
      set({ isLoading: true, error: null });

      // Call backend API
      await voiceReviewService.confirmReview(reviewId, finalData);

      // Update status and remove from queue
      await get().updateReview(reviewId, {
        status: 'confirmed',
        reviewedAt: new Date(),
        extractedData: finalData
      });

      // Remove from queue after short delay (so user sees confirmation)
      setTimeout(async () => {
        await get().removeFromQueue(reviewId);
      }, 1000);

      set({ isLoading: false, currentReview: null });

      console.log(`[VoiceReviewStore] Confirmed review ${reviewId}`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to confirm review:', error.message);
      set({
        isLoading: false,
        error: 'Failed to confirm review'
      });
      throw error;
    }
  },

  // Discard review
  discardReview: async (reviewId: string) => {
    try {
      set({ isLoading: true, error: null });

      // Call backend API
      await voiceReviewService.discardReview(reviewId);

      // Update status and remove from queue
      await get().updateReview(reviewId, {
        status: 'discarded',
        reviewedAt: new Date()
      });

      // Remove from queue after short delay
      setTimeout(async () => {
        await get().removeFromQueue(reviewId);
      }, 1000);

      set({ isLoading: false, currentReview: null });

      console.log(`[VoiceReviewStore] Discarded review ${reviewId}`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to discard review:', error.message);
      set({
        isLoading: false,
        error: 'Failed to discard review'
      });
      throw error;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Clear store
  clearStore: () => {
    set({
      reviewQueue: [],
      currentReview: null,
      isLoading: false,
      error: null
    });
    
    // Clear from AsyncStorage
    AsyncStorage.removeItem(REVIEW_QUEUE_STORAGE_KEY).catch(err =>
      console.error('[VoiceReviewStore] Failed to clear storage:', err)
    );
  },

  // Save queue to AsyncStorage
  saveQueueToStorage: async () => {
    try {
      const { reviewQueue } = get();
      
      // Serialize dates to ISO strings
      const serializedQueue = reviewQueue.map(item => ({
        ...item,
        recordedAt: item.recordedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        reviewedAt: item.reviewedAt?.toISOString()
      }));

      await AsyncStorage.setItem(REVIEW_QUEUE_STORAGE_KEY, JSON.stringify(serializedQueue));
      
      console.log(`[VoiceReviewStore] Saved ${reviewQueue.length} items to storage`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to save queue to storage:', error.message);
    }
  },

  // Load queue from AsyncStorage
  loadQueueFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(REVIEW_QUEUE_STORAGE_KEY);
      
      if (!stored) {
        console.log('[VoiceReviewStore] No cached queue found');
        return;
      }

      const serializedQueue = JSON.parse(stored);
      
      // Deserialize dates
      const reviewQueue = serializedQueue.map((item: any) => ({
        ...item,
        recordedAt: new Date(item.recordedAt),
        createdAt: new Date(item.createdAt),
        reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : undefined
      }));

      set({ reviewQueue });

      console.log(`[VoiceReviewStore] Loaded ${reviewQueue.length} items from storage`);
    } catch (error: any) {
      console.error('[VoiceReviewStore] Failed to load queue from storage:', error.message);
      
      // Corruption fallback: clear storage and start fresh
      try {
        await AsyncStorage.removeItem(REVIEW_QUEUE_STORAGE_KEY);
        console.log('[VoiceReviewStore] Cleared corrupted storage');
      } catch (clearError) {
        console.error('[VoiceReviewStore] Failed to clear corrupted storage:', clearError);
      }
      
      set({ reviewQueue: [] });
    }
  },
}));

// Note: Queue is loaded from storage when user logs in or app starts
// Call loadQueueFromStorage() explicitly when needed
