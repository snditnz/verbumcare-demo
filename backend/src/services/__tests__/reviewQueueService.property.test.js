/**
 * Property-Based Tests for Review Queue Service
 * Tests Properties 30, 32, 40, 41 from design document
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fc from 'fast-check';
import reviewQueueService from '../reviewQueueService.js';
import db from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('Review Queue Service - Property-Based Tests', () => {
  
  // Increase timeout for database operations
  jest.setTimeout(60000); // 1 minute per test
  
  let testUserIds = [];
  let testPatientIds = [];
  
  let facilityId;
  let testRecordingIds = [];
  
  // Helper function to create a test voice recording
  async function createTestRecording(userId, patientId = null) {
    const recordingId = uuidv4();
    testRecordingIds.push(recordingId);
    
    await db.query(`
      INSERT INTO voice_recordings (
        recording_id, patient_id, recorded_at, duration_seconds,
        audio_file_path, recorded_by, processing_status
      )
      VALUES ($1, $2, NOW(), 30, '/test/path', $3, 'completed')
    `, [recordingId, patientId || testPatientIds[0], userId]);
    
    return recordingId;
  }
  
  beforeAll(async () => {
    console.log('⚠️  These tests require PostgreSQL database connection');
    console.log('⚠️  Tests will create and clean up test data');
    
    // Verify database connection
    try {
      await db.testConnection();
    } catch (error) {
      console.error('❌ Database connection failed. Tests will be skipped.');
      throw error;
    }
    
    // Get a facility ID first
    const facilityResult = await db.query('SELECT facility_id FROM facilities LIMIT 1');
    facilityId = facilityResult.rows[0]?.facility_id;
    
    if (!facilityId) {
      throw new Error('No facility found in database. Please run seed script first.');
    }
    
    // Create test users
    for (let i = 0; i < 3; i++) {
      const userId = uuidv4();
      testUserIds.push(userId);
      
      await db.query(`
        INSERT INTO staff (staff_id, facility_id, employee_number, family_name, given_name, role, username, password_hash)
        VALUES ($1, $2, $3, $4, $5, 'registered_nurse', $6, 'test_hash')
        ON CONFLICT (staff_id) DO NOTHING
      `, [userId, facilityId, `TEST${i}`, `TestFamily${i}`, `TestGiven${i}`, `testuser${i}`]);
    }
    
    // Create test patients
    for (let i = 0; i < 2; i++) {
      const patientId = uuidv4();
      testPatientIds.push(patientId);
      
      await db.query(`
        INSERT INTO patients (patient_id, facility_id, mrn, family_name, given_name, date_of_birth, gender)
        VALUES ($1, $2, $3, $4, $5, '1950-01-01', 'male')
        ON CONFLICT (patient_id) DO NOTHING
      `, [patientId, facilityId, `TEST-MRN-${i}`, `TestFamily${i}`, `TestGiven${i}`]);
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    
    // Delete review queue items
    await db.query(`
      DELETE FROM voice_review_queue
      WHERE user_id = ANY($1)
    `, [testUserIds]);
    
    // Delete test recordings
    if (testRecordingIds.length > 0) {
      await db.query(`
        DELETE FROM voice_recordings
        WHERE recording_id = ANY($1)
      `, [testRecordingIds]);
    }
    
    // Delete test patients
    await db.query(`
      DELETE FROM patients
      WHERE patient_id = ANY($1)
    `, [testPatientIds]);
    
    // Delete test users
    await db.query(`
      DELETE FROM staff
      WHERE staff_id = ANY($1)
    `, [testUserIds]);
    
    console.log('✅ Test data cleaned up');
  });

  /**
   * Property 30: Queue addition on completion
   * Validates: Requirements 8.1
   * 
   * For any completed AI processing, the system SHALL add the processed recording
   * to the review queue
   */
  describe('Property 30: Queue Addition on Completion', () => {
    
    // Arbitrary for generating review item data
    const reviewItemDataArb = fc.record({
      contextType: fc.constantFrom('patient', 'global'),
      transcript: fc.string({ minLength: 20, maxLength: 200 }),
      transcriptLanguage: fc.constantFrom('ja', 'en', 'zh-TW'),
      confidenceScore: fc.double({ min: 0.6, max: 0.95 }),
      extractedData: fc.record({
        categories: fc.array(
          fc.constantFrom('vitals', 'medication', 'clinical_note', 'adl', 'incident', 'care_plan', 'pain'),
          { minLength: 1, maxLength: 3 }
        ),
        overallConfidence: fc.double({ min: 0.6, max: 0.95 })
      })
    });

    it('Property 30: Should add review item to queue after processing completes', async () => {
      await fc.assert(
        fc.asyncProperty(reviewItemDataArb, async (itemData) => {
          // Create a test recording
          const recordingId = await createTestRecording(
            testUserIds[0],
            itemData.contextType === 'patient' ? testPatientIds[0] : testPatientIds[1]
          );
          
          // Get initial queue count
          const initialCount = await reviewQueueService.getReviewQueueCount(testUserIds[0]);
          
          // Create review item (simulating completion of processing)
          const reviewItem = await reviewQueueService.createReviewItem({
            recordingId: recordingId,
            userId: testUserIds[0],
            contextType: itemData.contextType,
            contextPatientId: itemData.contextType === 'patient' ? testPatientIds[0] : null,
            transcript: itemData.transcript,
            transcriptLanguage: itemData.transcriptLanguage,
            extractedData: itemData.extractedData,
            confidenceScore: itemData.confidenceScore,
            processingTimeMs: 45000,
            modelVersion: 'llama3.1:8b'
          });
          
          // Verify review item was created
          expect(reviewItem).toBeDefined();
          expect(reviewItem.review_id).toBeDefined();
          expect(reviewItem.status).toBe('pending');
          
          // Get updated queue count
          const updatedCount = await reviewQueueService.getReviewQueueCount(testUserIds[0]);
          
          // Queue count should increase by 1
          expect(updatedCount).toBe(initialCount + 1);
          
          // Verify item is in queue
          const queue = await reviewQueueService.getReviewQueue(testUserIds[0]);
          const addedItem = queue.find(item => item.review_id === reviewItem.review_id);
          expect(addedItem).toBeDefined();
          expect(addedItem.transcript).toBe(itemData.transcript);
          
          // Clean up - pass undefined to bypass auth check
          await reviewQueueService.deleteReviewItem(reviewItem.review_id, undefined);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 32: Chronological queue ordering
   * Validates: Requirements 8.5
   * 
   * For any review queue with multiple recordings, the system SHALL maintain
   * chronological order (oldest first)
   */
  describe('Property 32: Chronological Queue Ordering', () => {
    
    it('Property 32: Should maintain chronological order in queue (oldest first)', async () => {
      // Create multiple review items with different timestamps
      const reviewIds = [];
      const timestamps = [];
      
      for (let i = 0; i < 5; i++) {
        const recordingId = await createTestRecording(testUserIds[1]);
        
        // Create review item
        const reviewItem = await reviewQueueService.createReviewItem({
          recordingId: recordingId,
          userId: testUserIds[1],
          contextType: 'global',
          contextPatientId: null,
          transcript: `Test transcript ${i}`,
          transcriptLanguage: 'en',
          extractedData: { categories: ['clinical_note'], overallConfidence: 0.8 },
          confidenceScore: 0.8
        });
        
        reviewIds.push(reviewItem.review_id);
        timestamps.push(new Date(reviewItem.created_at).getTime());
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Fetch queue
      const queue = await reviewQueueService.getReviewQueue(testUserIds[1]);
      
      // Verify queue is ordered chronologically (oldest first)
      const queueTimestamps = queue
        .filter(item => reviewIds.includes(item.review_id))
        .map(item => new Date(item.created_at).getTime());
      
      // Check that timestamps are in ascending order
      for (let i = 1; i < queueTimestamps.length; i++) {
        expect(queueTimestamps[i]).toBeGreaterThanOrEqual(queueTimestamps[i - 1]);
      }
      
      // Clean up
      for (const reviewId of reviewIds) {
        await reviewQueueService.deleteReviewItem(reviewId, undefined);
      }
    });
    
    it('Property 32: Should flag items older than 24 hours as urgent', async () => {
      // Create an old review item by directly inserting with old timestamp
      const recordingId = await createTestRecording(testUserIds[1]);
      
      // Insert review item with old timestamp using PostgreSQL's NOW() - INTERVAL
      const result = await db.query(`
        INSERT INTO voice_review_queue (
          recording_id, user_id, context_type, transcript, 
          transcript_language, extracted_data, confidence_score, 
          status, created_at
        )
        VALUES ($1, $2, 'global', 'Old test transcript', 'en', 
                '{"categories": ["clinical_note"], "overallConfidence": 0.8}', 
                0.8, 'pending', NOW() - INTERVAL '26 hours')
        RETURNING review_id, created_at
      `, [recordingId, testUserIds[1]]);
      
      const reviewId = result.rows[0].review_id;
      const createdAt = result.rows[0].created_at;
      
      // Fetch queue
      const queue = await reviewQueueService.getReviewQueue(testUserIds[1]);
      
      // Find the old item
      const oldItem = queue.find(item => item.review_id === reviewId);
      
      // Verify it's flagged as urgent
      expect(oldItem).toBeDefined();
      expect(oldItem.is_urgent).toBe(true);
      expect(oldItem.age_hours).toBeGreaterThan(24);
      
      // Clean up - don't pass userId to allow deletion without auth check
      await db.query('DELETE FROM voice_review_queue WHERE review_id = $1', [reviewId]);
    });
  });

  /**
   * Property 40: User queue isolation
   * Validates: Requirements 11.6
   * 
   * For any user login, the system SHALL NOT display other users' pending reviews
   */
  describe('Property 40: User Queue Isolation', () => {
    
    it('Property 40: Should isolate queue items by user', async () => {
      // Create review items for different users
      const user1ReviewIds = [];
      const user2ReviewIds = [];
      
      // Create items for user 1
      for (let i = 0; i < 3; i++) {
        const recordingId = await createTestRecording(testUserIds[0]);
        
        const reviewItem = await reviewQueueService.createReviewItem({
          recordingId: recordingId,
          userId: testUserIds[0],
          contextType: 'global',
          contextPatientId: null,
          transcript: `User 1 transcript ${i}`,
          transcriptLanguage: 'en',
          extractedData: { categories: ['clinical_note'], overallConfidence: 0.8 },
          confidenceScore: 0.8
        });
        
        user1ReviewIds.push(reviewItem.review_id);
      }
      
      // Create items for user 2
      for (let i = 0; i < 2; i++) {
        const recordingId = await createTestRecording(testUserIds[2]);
        
        const reviewItem = await reviewQueueService.createReviewItem({
          recordingId: recordingId,
          userId: testUserIds[2],
          contextType: 'global',
          contextPatientId: null,
          transcript: `User 2 transcript ${i}`,
          transcriptLanguage: 'en',
          extractedData: { categories: ['clinical_note'], overallConfidence: 0.8 },
          confidenceScore: 0.8
        });
        
        user2ReviewIds.push(reviewItem.review_id);
      }
      
      // Fetch queue for user 1
      const user1Queue = await reviewQueueService.getReviewQueue(testUserIds[0]);
      const user1QueueIds = user1Queue.map(item => item.review_id);
      
      // Fetch queue for user 2
      const user2Queue = await reviewQueueService.getReviewQueue(testUserIds[2]);
      const user2QueueIds = user2Queue.map(item => item.review_id);
      
      // Verify user 1 only sees their items
      for (const reviewId of user1ReviewIds) {
        expect(user1QueueIds).toContain(reviewId);
      }
      for (const reviewId of user2ReviewIds) {
        expect(user1QueueIds).not.toContain(reviewId);
      }
      
      // Verify user 2 only sees their items
      for (const reviewId of user2ReviewIds) {
        expect(user2QueueIds).toContain(reviewId);
      }
      for (const reviewId of user1ReviewIds) {
        expect(user2QueueIds).not.toContain(reviewId);
      }
      
      // Clean up
      for (const reviewId of [...user1ReviewIds, ...user2ReviewIds]) {
        await reviewQueueService.deleteReviewItem(reviewId, undefined);
      }
    });
    
    it('Property 40: Should prevent unauthorized access to review items', async () => {
      // Create review item for user 1
      const recordingId = await createTestRecording(testUserIds[0]);
      
      const reviewItem = await reviewQueueService.createReviewItem({
        recordingId: recordingId,
        userId: testUserIds[0],
        contextType: 'global',
        contextPatientId: null,
        transcript: 'Private transcript',
        transcriptLanguage: 'en',
        extractedData: { categories: ['clinical_note'], overallConfidence: 0.8 },
        confidenceScore: 0.8
      });
      
      // Try to access with wrong user
      await expect(async () => {
        await reviewQueueService.getReviewItem(reviewItem.review_id, testUserIds[2]);
      }).rejects.toThrow();
      
      // Try to update status with wrong user
      await expect(async () => {
        await reviewQueueService.updateReviewStatus(
          reviewItem.review_id, 
          'confirmed', 
          testUserIds[2]
        );
      }).rejects.toThrow();
      
      // Clean up
      await reviewQueueService.deleteReviewItem(reviewItem.review_id, undefined);
    });
  });

  /**
   * Property 41: Automatic archival
   * Validates: Requirements 11.7
   * 
   * For any recording in pending state for more than 7 days, the system SHALL
   * archive it and notify administrators
   */
  describe('Property 41: Automatic Archival', () => {
    
    it('Property 41: Should archive items older than 7 days', async () => {
      // Create old review items by directly inserting with old timestamps
      const oldReviewIds = [];
      
      for (let i = 0; i < 3; i++) {
        const recordingId = await createTestRecording(testUserIds[0]);
        
        // Insert review item with old timestamp using PostgreSQL's NOW() - INTERVAL
        const result = await db.query(`
          INSERT INTO voice_review_queue (
            recording_id, user_id, context_type, transcript, 
            transcript_language, extracted_data, confidence_score, 
            status, created_at
          )
          VALUES ($1, $2, 'global', $3, 'en', 
                  '{"categories": ["clinical_note"], "overallConfidence": 0.8}', 
                  0.8, 'pending', NOW() - INTERVAL '${8 + i} days')
          RETURNING review_id
        `, [recordingId, testUserIds[0], `Old transcript ${i}`]);
        
        oldReviewIds.push(result.rows[0].review_id);
      }
      
      // Run archival process
      const archivalResult = await reviewQueueService.archiveOldReviewItems();
      
      // Verify items were archived
      expect(archivalResult.archivedCount).toBeGreaterThanOrEqual(3);
      expect(archivalResult.notifications).toBeDefined();
      expect(archivalResult.notifications.length).toBeGreaterThanOrEqual(3);
      
      // Verify items are no longer in pending queue
      const queue = await reviewQueueService.getReviewQueue(testUserIds[0], { status: 'pending' });
      const queueIds = queue.map(item => item.review_id);
      
      for (const reviewId of oldReviewIds) {
        expect(queueIds).not.toContain(reviewId);
      }
      
      // Verify items are in discarded status
      for (const reviewId of oldReviewIds) {
        const item = await reviewQueueService.getReviewItem(reviewId);
        expect(item.status).toBe('discarded');
        expect(item.reviewed_at).toBeDefined();
      }
      
      // Verify notifications contain required information
      const relevantNotifications = archivalResult.notifications.filter(
        n => oldReviewIds.includes(n.reviewId)
      );
      
      for (const notification of relevantNotifications) {
        expect(notification.userId).toBe(testUserIds[0]);
        expect(notification.reviewId).toBeDefined();
        expect(notification.ageInDays).toBeGreaterThanOrEqual(7);
      }
    });
    
    it('Property 41: Should not archive recent items', async () => {
      // Create recent review item
      const recordingId = await createTestRecording(testUserIds[0]);
      
      const reviewItem = await reviewQueueService.createReviewItem({
        recordingId: recordingId,
        userId: testUserIds[0],
        contextType: 'global',
        contextPatientId: null,
        transcript: 'Recent transcript',
        transcriptLanguage: 'en',
        extractedData: { categories: ['clinical_note'], overallConfidence: 0.8 },
        confidenceScore: 0.8
      });
      
      // Run archival process
      await reviewQueueService.archiveOldReviewItems();
      
      // Verify recent item is still in pending queue
      const queue = await reviewQueueService.getReviewQueue(testUserIds[0], { status: 'pending' });
      const queueIds = queue.map(item => item.review_id);
      
      expect(queueIds).toContain(reviewItem.review_id);
      
      // Verify item status is still pending
      const item = await reviewQueueService.getReviewItem(reviewItem.review_id);
      expect(item.status).toBe('pending');
      
      // Clean up
      await reviewQueueService.deleteReviewItem(reviewItem.review_id, undefined);
    });
  });
});
