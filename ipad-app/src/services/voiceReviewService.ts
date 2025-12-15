import axios, { AxiosInstance } from 'axios';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG } from '@constants/config';
import { useAuthStore } from '@stores/authStore';
import { networkService } from './networkService';
import { VoiceContext } from './voice';

/**
 * Voice Review Service
 * 
 * Handles API communication for voice review queue management.
 * Implements retry logic and error handling for offline-first operation.
 */

export interface VoiceReviewItem {
  reviewId: string;
  recordingId: string;
  userId: string;
  contextType: 'patient' | 'global';
  contextPatientId?: string;
  contextPatientName?: string;
  
  // Original data
  audioUri: string;
  duration: number;
  recordedAt: Date;
  
  // AI processing results
  transcript: string;
  transcriptLanguage: 'ja' | 'en' | 'zh-TW';
  extractedData: ExtractedData;
  confidence: number;
  
  // Review state
  status: 'pending' | 'in_review' | 'confirmed' | 'discarded';
  createdAt: Date;
  reviewedAt?: Date;
  
  // Metadata
  processingTime: number;
  modelVersion: string;
}

export interface ExtractedData {
  categories: DataCategory[];
  overallConfidence: number;
}

export interface DataCategory {
  type: 'vitals' | 'medication' | 'clinical_note' | 'adl' | 'incident' | 'care_plan' | 'pain';
  confidence: number;
  data: any;
  fieldConfidences: Record<string, number>;
}

interface APIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  language?: string;
  message?: string;
}

interface OfflineQueueItem {
  id: string;
  recordingUri: string;
  context: VoiceContext | null;
  durationMs?: number;
  timestamp: Date;
  retryCount: number;
}

class VoiceReviewService {
  private client: AxiosInstance;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second
  private offlineQueue: OfflineQueueItem[] = [];
  private processingOfflineQueue: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ja',
      },
      httpsAgent: {
        rejectUnauthorized: false, // For self-signed cert
      } as any,
    });

    // Add request interceptor to include authentication headers
    this.client.interceptors.request.use(
      (config) => {
        const { tokens } = useAuthStore.getState();
        
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle authentication errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If 401 Unauthorized and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Attempt to refresh token
          const { refreshToken } = useAuthStore.getState();
          const refreshed = await refreshToken();
          
          if (refreshed) {
            // Retry original request with new token
            const { tokens } = useAuthStore.getState();
            originalRequest.headers.Authorization = `Bearer ${tokens?.accessToken}`;
            return this.client(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );

    // Load offline queue on initialization
    this.loadOfflineQueue();

    // Listen for network status changes
    networkService.onConnectivityChange((isConnected: boolean) => {
      if (isConnected) {
        console.log('[VoiceReviewService] Network restored, processing offline queue...');
        this.processOfflineQueue();
      }
    });
  }

  /**
   * Upload recording with context using efficient file upload
   * @param recordingUri - Local file URI
   * @param context - Voice context (patient or global)
   * @param durationMs - Recording duration in milliseconds
   * @returns Upload result with recording ID
   */
  async uploadRecording(recordingUri: string, context: VoiceContext | null, durationMs?: number): Promise<{ recording_id: string }> {
    // Check if online
    const isOnline = networkService.isConnected();
    
    if (!isOnline) {
      // Queue for later processing
      console.log('[VoiceReviewService] Offline - queuing recording for later upload');
      const queueItem: OfflineQueueItem = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        recordingUri,
        context,
        durationMs,
        timestamp: new Date(),
        retryCount: 0
      };
      
      this.offlineQueue.push(queueItem);
      this.saveOfflineQueue();
      
      throw new Error('Device is offline. Recording queued for upload when connectivity is restored.');
    }

    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(recordingUri);
      if (!fileInfo.exists) {
        throw new Error('Recording file not found');
      }

      // Create FormData for efficient file upload (not base64 JSON)
      const formData = new FormData();
      
      // Add the audio file
      formData.append('audio', {
        uri: recordingUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      // Add context information
      if (context?.patientId) {
        formData.append('patient_id', context.patientId);
      }
      formData.append('context_type', context?.type || 'global');
      if (context?.patientId) {
        formData.append('context_patient_id', context.patientId);
      }
      formData.append('recorded_by', useAuthStore.getState().currentUser?.userId || 'unknown');
      
      // Add duration in seconds if provided
      if (durationMs) {
        const durationSeconds = Math.round(durationMs / 1000);
        formData.append('duration_seconds', durationSeconds.toString());
      }

      // Upload using multipart/form-data (much more efficient than base64 JSON)
      const response = await this.client.post<APIResponse<{ recording_id: string }>>(
        '/voice/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('[VoiceReviewService] Recording uploaded efficiently:', response.data.data.recording_id);
      return response.data.data;
    } catch (error: any) {
      console.error('[VoiceReviewService] Upload failed:', error.message);
      
      // If network error, queue for later
      if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || !error.response) {
        const queueItem: OfflineQueueItem = {
          id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          recordingUri,
          context,
          durationMs,
          timestamp: new Date(),
          retryCount: 0
        };
        
        this.offlineQueue.push(queueItem);
        this.saveOfflineQueue();
        
        throw new Error('Network error. Recording queued for upload when connectivity is restored.');
      }
      
      throw this.handleError(error, 'Failed to upload recording');
    }
  }

  /**
   * Trigger categorization for a recording
   * @param recordingId - Recording ID
   */
  async triggerCategorization(recordingId: string): Promise<void> {
    try {
      await this.client.post(`/voice/categorize`, { recording_id: recordingId });
      console.log('[VoiceReviewService] Categorization triggered for:', recordingId);
    } catch (error: any) {
      console.error('[VoiceReviewService] Failed to trigger categorization:', error.message);
      throw this.handleError(error, 'Failed to trigger categorization');
    }
  }

  /**
   * Process offline queue when connectivity is restored
   */
  async processOfflineQueue(): Promise<void> {
    if (this.processingOfflineQueue || this.offlineQueue.length === 0) {
      return;
    }

    if (!networkService.isConnected()) {
      console.log('[VoiceReviewService] Still offline, cannot process queue');
      return;
    }

    this.processingOfflineQueue = true;
    console.log(`[VoiceReviewService] Processing ${this.offlineQueue.length} queued recordings...`);

    // Process in chronological order
    const sortedQueue = [...this.offlineQueue].sort((a: OfflineQueueItem, b: OfflineQueueItem) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (const item of sortedQueue) {
      try {
        console.log(`[VoiceReviewService] Processing queued item: ${item.id}`);
        
        // Upload recording
        const uploadResult = await this.uploadRecording(item.recordingUri, item.context, item.durationMs);
        
        // Trigger categorization
        await this.triggerCategorization(uploadResult.recording_id);
        
        // Remove from queue on success
        this.offlineQueue = this.offlineQueue.filter(q => q.id !== item.id);
        this.saveOfflineQueue();
        
        console.log(`[VoiceReviewService] ✅ Processed queued item: ${item.id}`);
      } catch (error: any) {
        console.error(`[VoiceReviewService] Failed to process queued item ${item.id}:`, error.message);
        
        // Increment retry count
        const queueItem = this.offlineQueue.find(q => q.id === item.id);
        if (queueItem) {
          queueItem.retryCount++;
          
          // Remove if max retries exceeded
          if (queueItem.retryCount >= 5) {
            console.error(`[VoiceReviewService] Max retries exceeded for ${item.id}, removing from queue`);
            this.offlineQueue = this.offlineQueue.filter(q => q.id !== item.id);
          }
          
          this.saveOfflineQueue();
        }
      }
    }

    this.processingOfflineQueue = false;
    console.log(`[VoiceReviewService] Offline queue processing complete. ${this.offlineQueue.length} items remaining.`);
  }

  /**
   * Save offline queue to AsyncStorage
   */
  private saveOfflineQueue(): void {
    // TODO: Implement AsyncStorage persistence
    console.log(`[VoiceReviewService] Offline queue saved: ${this.offlineQueue.length} items`);
  }

  /**
   * Load offline queue from AsyncStorage
   */
  async loadOfflineQueue(): Promise<void> {
    // TODO: Implement AsyncStorage loading
    console.log('[VoiceReviewService] Offline queue loaded');
  }

  /**
   * Get offline queue count
   */
  getOfflineQueueCount(): number {
    return this.offlineQueue.length;
  }

  /**
   * Fetch review queue for a specific user
   * @param userId - User ID to fetch queue for
   * @returns Array of pending review items
   */
  async fetchReviewQueue(userId: string): Promise<VoiceReviewItem[]> {
    try {
      const response = await this.retryRequest<{ queue: any[]; count: number; urgent_count: number }>(
        () => this.client.get<APIResponse<{ queue: any[]; count: number; urgent_count: number }>>(`/voice/review-queue/${userId}`)
      );

      // Transform API response to VoiceReviewItem format
      const items = response.data.data.queue.map((item: any) => ({
        reviewId: item.review_id,
        recordingId: item.recording_id,
        userId: item.user_id,
        contextType: item.context_type,
        contextPatientId: item.context_patient_id,
        contextPatientName: item.patient_name,
        
        // Original data - we don't have audioUri from API, but we have duration
        audioUri: '', // Not available from review queue API
        duration: item.duration_seconds || 0, // Duration in seconds from voice_recordings table (handle null values)
        recordedAt: new Date(item.created_at), // Use created_at as recordedAt
        
        // AI processing results
        transcript: item.transcript,
        transcriptLanguage: item.transcript_language,
        extractedData: item.extracted_data,
        confidence: parseFloat(item.confidence_score),
        
        // Review state
        status: item.status,
        createdAt: new Date(item.created_at),
        reviewedAt: item.reviewed_at ? new Date(item.reviewed_at) : undefined,
        
        // Metadata
        processingTime: item.processing_time_ms || 0,
        modelVersion: item.model_version || 'unknown',
      }));

      console.log(`[VoiceReviewService] Fetched ${items.length} review items for user ${userId}`);
      return items;
    } catch (error: any) {
      console.error('[VoiceReviewService] Failed to fetch review queue:', error.message);
      throw this.handleError(error, 'Failed to fetch review queue');
    }
  }

  /**
   * Re-analyze transcript with edited text
   * @param reviewId - Review ID
   * @param editedTranscript - Edited transcript text
   * @returns Updated review item with new extraction
   */
  async reanalyzeTranscript(reviewId: string, editedTranscript: string): Promise<{ reviewId: string; transcript: string; extractedData: ExtractedData; confidence: number; processingTime: number }> {
    try {
      const { currentUser } = useAuthStore.getState();
      const response = await this.retryRequest<{ review_id: string; transcript: string; extracted_data: ExtractedData; confidence_score: number; processing_time_ms: number }>(
        () => this.client.post<APIResponse<{ review_id: string; transcript: string; extracted_data: ExtractedData; confidence_score: number; processing_time_ms: number }>>(
          `/voice/review/${reviewId}/reanalyze`,
          { 
            transcript: editedTranscript,
            user_id: currentUser?.userId 
          }
        )
      );

      // Return the actual data structure from the backend (no date deserialization needed)
      const result = {
        reviewId: response.data.data.review_id,
        transcript: response.data.data.transcript,
        extractedData: response.data.data.extracted_data,
        confidence: response.data.data.confidence_score,
        processingTime: response.data.data.processing_time_ms
      };

      console.log(`[VoiceReviewService] Re-analyzed review ${reviewId}`);
      return result;
    } catch (error: any) {
      console.error('[VoiceReviewService] Failed to re-analyze transcript:', error.message);
      throw this.handleError(error, 'Failed to re-analyze transcript');
    }
  }

  /**
   * Confirm review and save to database
   * @param reviewId - Review ID
   * @param finalData - Final extracted data (may be edited by user)
   * @returns Confirmation result
   */
  async confirmReview(reviewId: string, finalData: ExtractedData): Promise<{ success: boolean; message: string }> {
    try {
      const { currentUser } = useAuthStore.getState();
      const response = await this.retryRequest<{ success: boolean; message: string }>(
        () => this.client.post<APIResponse<{ success: boolean; message: string }>>(
          `/voice/review/${reviewId}/confirm`,
          { 
            user_id: currentUser?.userId,
            edited_data: finalData 
          }
        )
      );

      console.log(`[VoiceReviewService] Confirmed review ${reviewId}`);
      return response.data.data;
    } catch (error: any) {
      console.error('[VoiceReviewService] Failed to confirm review:', error.message);
      throw this.handleError(error, 'Failed to confirm review');
    }
  }

  /**
   * Discard review and archive recording
   * @param reviewId - Review ID
   * @returns Discard result
   */
  async discardReview(reviewId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { currentUser } = useAuthStore.getState();
      const response = await this.retryRequest<{ success: boolean; message: string }>(
        () => this.client.delete<APIResponse<{ success: boolean; message: string }>>(
          `/voice/review/${reviewId}`,
          { 
            data: { user_id: currentUser?.userId }
          }
        )
      );

      console.log(`[VoiceReviewService] Discarded review ${reviewId}`);
      return response.data.data;
    } catch (error: any) {
      console.error('[VoiceReviewService] Failed to discard review:', error.message);
      throw this.handleError(error, 'Failed to discard review');
    }
  }

  /**
   * Retry request with exponential backoff
   * @param requestFn - Function that returns a promise for the request
   * @returns Response data
   */
  private async retryRequest<T>(requestFn: () => Promise<any>): Promise<any> {
    let lastError: any;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on 4xx errors (except 408 Request Timeout and 429 Too Many Requests)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          if (error.response.status !== 408 && error.response.status !== 429) {
            throw error;
          }
        }

        // Don't retry on last attempt
        if (attempt === this.maxRetries - 1) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = this.retryDelay * Math.pow(2, attempt);
        console.log(`[VoiceReviewService] Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle and format errors
   * @param error - Error object
   * @param defaultMessage - Default error message
   * @returns Formatted error
   */
  private handleError(error: any, defaultMessage: string): Error {
    if (error.response?.data?.error) {
      return new Error(error.response.data.error);
    }

    if (error.message) {
      return new Error(error.message);
    }

    return new Error(defaultMessage);
  }
}

export const voiceReviewService = new VoiceReviewService();
export default voiceReviewService;
