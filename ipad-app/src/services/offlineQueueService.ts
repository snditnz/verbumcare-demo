/**
 * OfflineQueueService
 * 
 * Manages local storage and processing of offline recordings.
 * Implements offline-first architecture for voice documentation.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import NetInfo from '@react-native-community/netinfo';
import { apiService } from './api';

// Storage keys
const OFFLINE_QUEUE_KEY = '@verbumcare/offline_recordings';
const QUEUE_VERSION = 1;

// Constants
const MAX_RETRY_COUNT = 3;
const URGENCY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Recording status types
 */
export type RecordingStatus = 'pending' | 'processing' | 'failed' | 'completed';

/**
 * Offline recording interface
 * Property 13: Must contain all required metadata
 */
export interface OfflineRecording {
  id: string;
  audioUri: string;
  duration: number;
  recordedAt: Date;
  patientId?: string;
  contextType: 'patient' | 'global';
  language: string;
  userId: string;
  status: RecordingStatus;
  retryCount: number;
  lastError?: string;
  isUrgent?: boolean;
}

/**
 * Processing result interface
 */
export interface ProcessingResult {
  recordingId: string;
  success: boolean;
  reviewId?: string;
  transcription?: string;
  error?: string;
  processedAt: Date;
}

/**
 * Queue storage format
 */
interface OfflineQueueStorage {
  recordings: SerializedRecording[];
  lastProcessedAt: string | null;
  version: number;
}

/**
 * Serialized recording for storage (dates as strings)
 */
interface SerializedRecording extends Omit<OfflineRecording, 'recordedAt'> {
  recordedAt: string;
}

/**
 * Event callback types
 */
type QueueChangeCallback = (queue: OfflineRecording[]) => void;
type ProcessingCompleteCallback = (result: ProcessingResult) => void;

class OfflineQueueService {
  private queueChangeCallbacks: QueueChangeCallback[] = [];
  private processingCompleteCallbacks: ProcessingCompleteCallback[] = [];
  private isProcessing = false;
  private networkUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initializeNetworkListener();
  }

  /**
   * Initialize network connectivity listener
   * Requirement 5.8: Monitor connectivity changes
   */
  private initializeNetworkListener(): void {
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        // Network restored - attempt to process queue
        this.processQueue().catch(err => {
          console.log('Background queue processing failed:', err.message);
        });
      }
    });
  }

  /**
   * Add a recording to the offline queue
   * Requirement 10.1: Store recordings locally when offline
   * Property 13: Ensure all required metadata is present
   * 
   * @param recording - Recording to add (without id and status)
   * @returns Recording ID
   */
  async addToQueue(recording: Omit<OfflineRecording, 'id' | 'status' | 'retryCount'>): Promise<string> {
    const id = uuidv4();
    
    const newRecording: OfflineRecording = {
      ...recording,
      id,
      status: 'pending',
      retryCount: 0,
      recordedAt: recording.recordedAt instanceof Date 
        ? recording.recordedAt 
        : new Date(recording.recordedAt),
    };

    // Validate required metadata (Property 13)
    this.validateRecordingMetadata(newRecording);

    const queue = await this.getQueue();
    queue.push(newRecording);
    await this.saveQueue(queue);

    this.notifyQueueChange(queue);
    console.log(`📥 Added recording to offline queue: ${id}`);

    return id;
  }

  /**
   * Validate that recording has all required metadata
   * Property 13: Offline Queue Metadata Completeness
   */
  private validateRecordingMetadata(recording: OfflineRecording): void {
    const requiredFields: (keyof OfflineRecording)[] = [
      'id', 'audioUri', 'duration', 'recordedAt', 
      'contextType', 'language', 'userId', 'status', 'retryCount'
    ];

    for (const field of requiredFields) {
      if (recording[field] === undefined || recording[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (recording.duration <= 0) {
      throw new Error('Duration must be positive');
    }

    if (!['patient', 'global'].includes(recording.contextType)) {
      throw new Error('Invalid contextType');
    }
  }

  /**
   * Get all recordings in the queue
   * @returns Array of offline recordings
   */
  async getQueue(): Promise<OfflineRecording[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!data) {
        return [];
      }

      const storage: OfflineQueueStorage = JSON.parse(data);
      
      // Migrate if needed
      if (storage.version !== QUEUE_VERSION) {
        return this.migrateQueue(storage);
      }

      // Deserialize dates and calculate urgency
      return storage.recordings.map(r => this.deserializeRecording(r));
    } catch (error) {
      console.error('Failed to get offline queue:', error);
      return [];
    }
  }

  /**
   * Deserialize a recording from storage
   */
  private deserializeRecording(serialized: SerializedRecording): OfflineRecording {
    const recordedAt = new Date(serialized.recordedAt);
    const age = Date.now() - recordedAt.getTime();
    
    return {
      ...serialized,
      recordedAt,
      // Property 16: Flag items older than 24 hours as urgent
      isUrgent: age > URGENCY_THRESHOLD_MS,
    };
  }

  /**
   * Serialize a recording for storage
   */
  private serializeRecording(recording: OfflineRecording): SerializedRecording {
    const { isUrgent, ...rest } = recording;
    const recordedAtDate = recording.recordedAt instanceof Date 
      ? recording.recordedAt 
      : new Date(recording.recordedAt);
    return {
      ...rest,
      recordedAt: recordedAtDate.toISOString(),
    };
  }

  /**
   * Migrate queue from older version
   */
  private async migrateQueue(storage: OfflineQueueStorage): Promise<OfflineRecording[]> {
    // For now, just update version and return
    const recordings = storage.recordings.map(r => this.deserializeRecording(r));
    await this.saveQueue(recordings);
    return recordings;
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(queue: OfflineRecording[]): Promise<void> {
    const storage: OfflineQueueStorage = {
      recordings: queue.map(r => this.serializeRecording(r)),
      lastProcessedAt: new Date().toISOString(),
      version: QUEUE_VERSION,
    };

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(storage));
  }

  /**
   * Remove a recording from the queue
   * @param recordingId - ID of recording to remove
   */
  async removeFromQueue(recordingId: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(r => r.id !== recordingId);
    
    if (filtered.length === queue.length) {
      console.warn(`Recording not found in queue: ${recordingId}`);
      return;
    }

    await this.saveQueue(filtered);
    this.notifyQueueChange(filtered);
    console.log(`🗑️ Removed recording from offline queue: ${recordingId}`);
  }

  /**
   * Update a recording in the queue
   */
  private async updateRecording(
    recordingId: string, 
    updates: Partial<OfflineRecording>
  ): Promise<void> {
    const queue = await this.getQueue();
    const index = queue.findIndex(r => r.id === recordingId);
    
    if (index === -1) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    queue[index] = { ...queue[index], ...updates };
    await this.saveQueue(queue);
    this.notifyQueueChange(queue);
  }

  /**
   * Process all pending recordings in the queue
   * Requirement 10.3: Process in chronological order
   * Property 14: Oldest recordedAt first
   * 
   * @returns Array of processing results
   */
  async processQueue(): Promise<ProcessingResult[]> {
    if (this.isProcessing) {
      console.log('Queue processing already in progress');
      return [];
    }

    // Check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.log('No network connectivity - skipping queue processing');
      return [];
    }

    this.isProcessing = true;
    const results: ProcessingResult[] = [];

    try {
      const queue = await this.getQueue();
      
      // Filter pending recordings and sort by recordedAt (oldest first)
      // Property 14: Processing order by chronological order
      const pending = queue
        .filter(r => r.status === 'pending' || r.status === 'failed')
        .filter(r => r.retryCount < MAX_RETRY_COUNT)
        .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

      console.log(`📤 Processing ${pending.length} offline recordings...`);

      for (const recording of pending) {
        const result = await this.processRecording(recording.id);
        results.push(result);

        // Small delay between uploads to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single recording
   * Requirement 10.5: Retry up to 3 times
   * Property 15: Enforce retry limit
   * 
   * @param recordingId - ID of recording to process
   * @returns Processing result
   */
  async processRecording(recordingId: string): Promise<ProcessingResult> {
    const queue = await this.getQueue();
    const recording = queue.find(r => r.id === recordingId);

    if (!recording) {
      return {
        recordingId,
        success: false,
        error: 'Recording not found',
        processedAt: new Date(),
      };
    }

    // Property 15: Check retry limit
    if (recording.retryCount >= MAX_RETRY_COUNT) {
      return {
        recordingId,
        success: false,
        error: 'Max retry limit reached',
        processedAt: new Date(),
      };
    }

    // Update status to processing
    await this.updateRecording(recordingId, { status: 'processing' });

    try {
      console.log(`📤 Processing recording: ${recordingId}`);

      // Upload the recording
      const uploadResult = await this.uploadRecording(recording);

      // Update status to completed
      await this.updateRecording(recordingId, { status: 'completed' });

      const result: ProcessingResult = {
        recordingId,
        success: true,
        reviewId: uploadResult.reviewId,
        transcription: uploadResult.transcription,
        processedAt: new Date(),
      };

      this.notifyProcessingComplete(result);
      console.log(`✅ Recording processed successfully: ${recordingId}`);

      // Remove from queue after successful processing
      await this.removeFromQueue(recordingId);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Increment retry count
      const newRetryCount = recording.retryCount + 1;
      const newStatus: RecordingStatus = newRetryCount >= MAX_RETRY_COUNT ? 'failed' : 'pending';

      await this.updateRecording(recordingId, {
        status: newStatus,
        retryCount: newRetryCount,
        lastError: errorMessage,
      });

      const result: ProcessingResult = {
        recordingId,
        success: false,
        error: errorMessage,
        processedAt: new Date(),
      };

      this.notifyProcessingComplete(result);
      console.log(`❌ Recording processing failed: ${recordingId} (attempt ${newRetryCount}/${MAX_RETRY_COUNT})`);

      return result;
    }
  }

  /**
   * Upload a recording to the server
   */
  private async uploadRecording(recording: OfflineRecording): Promise<{
    reviewId: string;
    transcription: string;
  }> {
    // Create form data for upload
    const formData = new FormData();
    
    // Add audio file
    formData.append('audio', {
      uri: recording.audioUri,
      type: 'audio/wav',
      name: `recording_${recording.id}.wav`,
    } as any);

    // Add metadata
    formData.append('duration', String(recording.duration));
    formData.append('language', recording.language);
    formData.append('contextType', recording.contextType);
    if (recording.patientId) {
      formData.append('patientId', recording.patientId);
    }

    // Upload to voice endpoint
    const response = await apiService.uploadVoiceRecording(formData);

    if (!response.success) {
      throw new Error(response.error || 'Upload failed');
    }

    return {
      reviewId: response.data.reviewId,
      transcription: response.data.transcription || '',
    };
  }

  /**
   * Get count of pending recordings
   * @returns Number of pending recordings
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(r => r.status === 'pending' || r.status === 'processing').length;
  }

  /**
   * Get age of oldest pending recording in milliseconds
   * @returns Age in ms or null if no pending recordings
   */
  async getOldestPendingAge(): Promise<number | null> {
    const queue = await this.getQueue();
    const pending = queue.filter(r => r.status === 'pending');

    if (pending.length === 0) {
      return null;
    }

    // Sort by recordedAt ascending
    pending.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    
    return Date.now() - pending[0].recordedAt.getTime();
  }

  /**
   * Get recordings flagged as urgent (older than 24 hours)
   * Requirement 10.6: Flag items older than 24 hours
   * Property 16: Age-based urgency flagging
   */
  async getUrgentRecordings(): Promise<OfflineRecording[]> {
    const queue = await this.getQueue();
    return queue.filter(r => r.isUrgent && r.status !== 'completed');
  }

  /**
   * Register callback for queue changes
   */
  onQueueChange(callback: QueueChangeCallback): () => void {
    this.queueChangeCallbacks.push(callback);
    return () => {
      this.queueChangeCallbacks = this.queueChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Register callback for processing completion
   */
  onProcessingComplete(callback: ProcessingCompleteCallback): () => void {
    this.processingCompleteCallbacks.push(callback);
    return () => {
      this.processingCompleteCallbacks = this.processingCompleteCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all queue change listeners
   */
  private notifyQueueChange(queue: OfflineRecording[]): void {
    for (const callback of this.queueChangeCallbacks) {
      try {
        callback(queue);
      } catch (error) {
        console.error('Queue change callback error:', error);
      }
    }
  }

  /**
   * Notify all processing complete listeners
   */
  private notifyProcessingComplete(result: ProcessingResult): void {
    for (const callback of this.processingCompleteCallbacks) {
      try {
        callback(result);
      } catch (error) {
        console.error('Processing complete callback error:', error);
      }
    }
  }

  /**
   * Clear all recordings from the queue
   * Use with caution - for testing/debugging only
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    this.notifyQueueChange([]);
    console.log('🗑️ Offline queue cleared');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    this.queueChangeCallbacks = [];
    this.processingCompleteCallbacks = [];
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();
export default offlineQueueService;
