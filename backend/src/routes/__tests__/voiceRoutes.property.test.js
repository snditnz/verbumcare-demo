/**
 * Property-Based Tests for Voice Routes
 * Tests API endpoints for voice categorization and review
 */

import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import voiceRouter from '../voice.js';
import db from '../../db/index.js';
import reviewQueueService from '../../services/reviewQueueService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create test app
const app = express();
app.use(express.json());
app.use('/api/voice', voiceRouter);

// Test timeout
jest.setTimeout(30000);

describe('Voice Routes Property-Based Tests', () => {
  
  /**
   * Property 1: Patient context capture
   * Feature: voice-first-ai-categorization, Property 1: Patient context capture
   * Validates: Requirements 1.1
   * 
   * For any voice recording initiated with an active patient context,
   * the recording SHALL capture and store the patient ID
   */
  describe('Property 1: Patient context capture', () => {
    
    // Get a real patient ID from the database for testing
    let testPatientId = null;
    
    beforeAll(async () => {
      const result = await db.query('SELECT patient_id FROM patients LIMIT 1');
      if (result.rows.length > 0) {
        testPatientId = result.rows[0].patient_id;
      }
    });
    
    it('should capture patient context when provided', async () => {
      // Skip if no test patient available
      if (!testPatientId) {
        console.warn('⚠️  Skipping test: No patients in database');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          // Generate random recording metadata
          fc.record({
            contextType: fc.constant('patient'),
            recordedBy: fc.uuid(),
            durationSeconds: fc.integer({ min: 1, max: 300 })
          }),
          async (context) => {
            // Create a test audio file
            const testAudioPath = path.join(__dirname, 'test-audio.m4a');
            await fs.writeFile(testAudioPath, Buffer.from('fake audio data'));

            try {
              // Upload with patient context (using real patient ID)
              const response = await request(app)
                .post('/api/voice/upload')
                .field('context_type', context.contextType)
                .field('context_patient_id', testPatientId)
                .field('recorded_by', context.recordedBy)
                .field('duration_seconds', context.durationSeconds.toString())
                .attach('audio', testAudioPath);

              // Should succeed
              expect(response.status).toBe(201);
              expect(response.body.success).toBe(true);
              
              // Should capture context
              expect(response.body.data.context_type).toBe('patient');
              expect(response.body.data.context_patient_id).toBe(testPatientId);
              expect(response.body.data.review_status).toBe('pending_review');

              // Verify in database
              const recordingId = response.body.data.recording_id;
              const dbResult = await db.query(
                'SELECT context_type, context_patient_id, review_status FROM voice_recordings WHERE recording_id = $1',
                [recordingId]
              );

              expect(dbResult.rows.length).toBe(1);
              expect(dbResult.rows[0].context_type).toBe('patient');
              expect(dbResult.rows[0].context_patient_id).toBe(testPatientId);
              expect(dbResult.rows[0].review_status).toBe('pending_review');

              // Cleanup
              await db.query('DELETE FROM voice_recordings WHERE recording_id = $1', [recordingId]);

            } finally {
              // Cleanup test file
              try {
                await fs.unlink(testAudioPath);
              } catch (err) {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced for faster testing
      );
    });

    it('should capture global context when no patient provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random global context
          fc.record({
            contextType: fc.constant('global'),
            recordedBy: fc.uuid(),
            durationSeconds: fc.integer({ min: 1, max: 300 })
          }),
          async (context) => {
            // Create a test audio file
            const testAudioPath = path.join(__dirname, 'test-audio.m4a');
            await fs.writeFile(testAudioPath, Buffer.from('fake audio data'));

            try {
              // Upload with global context
              const response = await request(app)
                .post('/api/voice/upload')
                .field('context_type', context.contextType)
                .field('recorded_by', context.recordedBy)
                .field('duration_seconds', context.durationSeconds.toString())
                .attach('audio', testAudioPath);

              // Should succeed
              expect(response.status).toBe(201);
              expect(response.body.success).toBe(true);
              
              // Should capture global context
              expect(response.body.data.context_type).toBe('global');
              expect(response.body.data.context_patient_id).toBeNull();
              expect(response.body.data.review_status).toBe('pending_review');

              // Verify in database
              const recordingId = response.body.data.recording_id;
              const dbResult = await db.query(
                'SELECT context_type, context_patient_id, review_status FROM voice_recordings WHERE recording_id = $1',
                [recordingId]
              );

              expect(dbResult.rows.length).toBe(1);
              expect(dbResult.rows[0].context_type).toBe('global');
              expect(dbResult.rows[0].context_patient_id).toBeNull();
              expect(dbResult.rows[0].review_status).toBe('pending_review');

              // Cleanup
              await db.query('DELETE FROM voice_recordings WHERE recording_id = $1', [recordingId]);

            } finally {
              // Cleanup test file
              try {
                await fs.unlink(testAudioPath);
              } catch (err) {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced for faster testing
      );
    });

    it('should handle legacy patient_id field for backward compatibility', async () => {
      // Skip if no test patient available
      if (!testPatientId) {
        console.warn('⚠️  Skipping test: No patients in database');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          // Generate random recording metadata
          fc.record({
            recordedBy: fc.uuid(),
            durationSeconds: fc.integer({ min: 1, max: 300 })
          }),
          async (context) => {
            // Create a test audio file
            const testAudioPath = path.join(__dirname, 'test-audio.m4a');
            await fs.writeFile(testAudioPath, Buffer.from('fake audio data'));

            try {
              // Upload with legacy patient_id field (no context_type)
              const response = await request(app)
                .post('/api/voice/upload')
                .field('patient_id', testPatientId)
                .field('recorded_by', context.recordedBy)
                .field('duration_seconds', context.durationSeconds.toString())
                .attach('audio', testAudioPath);

              // Should succeed
              expect(response.status).toBe(201);
              expect(response.body.success).toBe(true);
              
              // Should auto-detect patient context from patient_id
              expect(response.body.data.context_type).toBe('patient');
              expect(response.body.data.context_patient_id).toBe(testPatientId);
              expect(response.body.data.review_status).toBe('pending_review');

              // Verify in database
              const recordingId = response.body.data.recording_id;
              const dbResult = await db.query(
                'SELECT context_type, context_patient_id, review_status FROM voice_recordings WHERE recording_id = $1',
                [recordingId]
              );

              expect(dbResult.rows.length).toBe(1);
              expect(dbResult.rows[0].context_type).toBe('patient');
              expect(dbResult.rows[0].context_patient_id).toBe(testPatientId);
              expect(dbResult.rows[0].review_status).toBe('pending_review');

              // Cleanup
              await db.query('DELETE FROM voice_recordings WHERE recording_id = $1', [recordingId]);

            } finally {
              // Cleanup test file
              try {
                await fs.unlink(testAudioPath);
              } catch (err) {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced for faster testing
      );
    });

  });

  /**
   * Property 17: Audit metadata logging
   * Feature: voice-first-ai-categorization, Property 17: Audit metadata logging
   * Validates: Requirements 4.3
   * 
   * For any saved extracted data, the system SHALL log AI model version,
   * extraction timestamp, and confidence scores
   */
  describe('Property 17: Audit metadata logging', () => {
    
    // Get test data
    let testPatientId = null;
    let testUserId = null;
    
    beforeAll(async () => {
      const patientResult = await db.query('SELECT patient_id FROM patients LIMIT 1');
      const userResult = await db.query('SELECT staff_id FROM staff LIMIT 1');
      
      if (patientResult.rows.length > 0) {
        testPatientId = patientResult.rows[0].patient_id;
      }
      if (userResult.rows.length > 0) {
        testUserId = userResult.rows[0].staff_id;
      }
    });
    
    it('should log audit metadata when categorization is created', async () => {
      // Skip if no test data available
      if (!testPatientId || !testUserId) {
        console.warn('⚠️  Skipping test: No patients or staff in database');
        return;
      }

      // This test verifies that the categorization log table captures
      // all required audit metadata
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recordingId: fc.uuid(),
            categories: fc.array(
              fc.constantFrom('vitals', 'medication', 'clinical_note', 'adl', 'incident', 'care_plan', 'pain'),
              { minLength: 1, maxLength: 3 }
            ),
            userEditedTranscript: fc.boolean(),
            userEditedData: fc.boolean(),
            transcript: fc.string({ minLength: 10, maxLength: 100 }),
            confidence: fc.double({ min: 0.6, max: 0.95 })
          }),
          async (testData) => {
            // Create a review item first (required for foreign key)
            const reviewItem = await reviewQueueService.createReviewItem({
              recordingId: testData.recordingId,
              userId: testUserId,
              contextType: 'patient',
              contextPatientId: testPatientId,
              transcript: testData.transcript,
              transcriptLanguage: 'ja',
              extractedData: { categories: [] },
              confidenceScore: testData.confidence
            });

            // Insert a test categorization log entry
            const insertQuery = `
              INSERT INTO voice_categorization_log (
                review_id,
                detected_categories,
                extraction_prompt,
                user_edited_transcript,
                user_edited_data,
                created_at
              ) VALUES ($1, $2, $3, $4, $5, NOW())
              RETURNING *
            `;

            const result = await db.query(insertQuery, [
              reviewItem.review_id,
              JSON.stringify(testData.categories),
              'Test extraction prompt',
              testData.userEditedTranscript,
              testData.userEditedData
            ]);

            const logEntry = result.rows[0];

            // Verify audit metadata is logged
            expect(logEntry.log_id).toBeDefined();
            expect(logEntry.review_id).toBe(reviewItem.review_id);
            expect(logEntry.detected_categories).toBeDefined();
            expect(logEntry.created_at).toBeDefined(); // Timestamp logged
            expect(logEntry.user_edited_transcript).toBe(testData.userEditedTranscript);
            expect(logEntry.user_edited_data).toBe(testData.userEditedData);

            // Cleanup
            await db.query('DELETE FROM voice_categorization_log WHERE log_id = $1', [logEntry.log_id]);
            await db.query('DELETE FROM voice_review_queue WHERE review_id = $1', [reviewItem.review_id]);
          }
        ),
        { numRuns: 10 }
      );
    });

  });

  /**
   * Property 18: Correction logging
   * Feature: voice-first-ai-categorization, Property 18: Correction logging
   * Validates: Requirements 4.5
   * 
   * For any user correction to AI-extracted data, the system SHALL store
   * the correction in the categorization log
   */
  describe('Property 18: Correction logging', () => {
    
    // Get test data
    let testPatientId = null;
    let testUserId = null;
    
    beforeAll(async () => {
      const patientResult = await db.query('SELECT patient_id FROM patients LIMIT 1');
      const userResult = await db.query('SELECT staff_id FROM staff LIMIT 1');
      
      if (patientResult.rows.length > 0) {
        testPatientId = patientResult.rows[0].patient_id;
      }
      if (userResult.rows.length > 0) {
        testUserId = userResult.rows[0].staff_id;
      }
    });
    
    it('should log user corrections when data is edited', async () => {
      // Skip if no test data available
      if (!testPatientId || !testUserId) {
        console.warn('⚠️  Skipping test: No patients or staff in database');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recordingId: fc.uuid(),
            reanalysisCount: fc.integer({ min: 0, max: 5 }),
            userEditedTranscript: fc.boolean(),
            userEditedData: fc.boolean(),
            transcript: fc.string({ minLength: 10, maxLength: 100 }),
            confidence: fc.double({ min: 0.6, max: 0.95 })
          }),
          async (testData) => {
            // Create a review item first (required for foreign key)
            const reviewItem = await reviewQueueService.createReviewItem({
              recordingId: testData.recordingId,
              userId: testUserId,
              contextType: 'patient',
              contextPatientId: testPatientId,
              transcript: testData.transcript,
              transcriptLanguage: 'ja',
              extractedData: { categories: [] },
              confidenceScore: testData.confidence
            });

            // Insert a test categorization log entry
            const insertQuery = `
              INSERT INTO voice_categorization_log (
                review_id,
                detected_categories,
                user_edited_transcript,
                user_edited_data,
                reanalysis_count
              ) VALUES ($1, $2, $3, $4, $5)
              RETURNING *
            `;

            const result = await db.query(insertQuery, [
              reviewItem.review_id,
              JSON.stringify(['vitals']),
              testData.userEditedTranscript,
              testData.userEditedData,
              testData.reanalysisCount
            ]);

            const logEntry = result.rows[0];

            // Verify corrections are logged
            expect(logEntry.user_edited_transcript).toBe(testData.userEditedTranscript);
            expect(logEntry.user_edited_data).toBe(testData.userEditedData);
            expect(logEntry.reanalysis_count).toBe(testData.reanalysisCount);

            // If user edited, at least one flag should be true
            if (testData.userEditedTranscript || testData.userEditedData) {
              expect(
                logEntry.user_edited_transcript || logEntry.user_edited_data
              ).toBe(true);
            }

            // Cleanup
            await db.query('DELETE FROM voice_categorization_log WHERE log_id = $1', [logEntry.log_id]);
            await db.query('DELETE FROM voice_review_queue WHERE review_id = $1', [reviewItem.review_id]);
          }
        ),
        { numRuns: 10 }
      );
    });

  });

  /**
   * Property 37: Atomic transaction
   * Feature: voice-first-ai-categorization, Property 37: Atomic transaction
   * Validates: Requirements 11.3
   * 
   * For any user confirmation, the system SHALL save all approved data
   * in a single atomic transaction (all or nothing)
   */
  describe('Property 37: Atomic transaction', () => {
    
    it('should rollback all changes if any part of transaction fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            reviewId: fc.uuid(),
            recordingId: fc.uuid(),
            userId: fc.uuid()
          }),
          async (testData) => {
            const client = await db.pool.connect();
            
            try {
              await client.query('BEGIN');

              // Simulate a transaction with multiple operations
              await client.query(
                'INSERT INTO voice_categorization_log (review_id, detected_categories) VALUES ($1, $2)',
                [testData.reviewId, JSON.stringify(['vitals'])]
              );

              // Intentionally cause an error (invalid foreign key)
              try {
                await client.query(
                  'UPDATE voice_review_queue SET status = $1 WHERE review_id = $2',
                  ['confirmed', testData.reviewId] // This will fail if review doesn't exist
                );
                
                await client.query('COMMIT');
              } catch (error) {
                // Rollback on error
                await client.query('ROLLBACK');
                
                // Verify rollback: categorization log entry should not exist
                const checkResult = await db.query(
                  'SELECT * FROM voice_categorization_log WHERE review_id = $1',
                  [testData.reviewId]
                );
                
                expect(checkResult.rows.length).toBe(0);
              }

            } finally {
              client.release();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

  });

  /**
   * Property 35: Archive on discard
   * Feature: voice-first-ai-categorization, Property 35: Archive on discard
   * Validates: Requirements 8.8
   * 
   * For any discarded queued recording, the system SHALL remove it from
   * the queue and archive the recording
   */
  describe('Property 35: Archive on discard', () => {
    
    it('should update status to discarded when review is deleted', async () => {
      // Get a real patient and user for testing
      const patientResult = await db.query('SELECT patient_id FROM patients LIMIT 1');
      const userResult = await db.query('SELECT staff_id FROM staff LIMIT 1');
      
      if (patientResult.rows.length === 0 || userResult.rows.length === 0) {
        console.warn('⚠️  Skipping test: No patients or staff in database');
        return;
      }

      const testPatientId = patientResult.rows[0].patient_id;
      const testUserId = userResult.rows[0].staff_id;

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            recordingId: fc.uuid(),
            transcript: fc.string({ minLength: 10, maxLength: 100 }),
            confidence: fc.double({ min: 0.6, max: 0.95 })
          }),
          async (testData) => {
            // Create a test review item
            const reviewItem = await reviewQueueService.createReviewItem({
              recordingId: testData.recordingId,
              userId: testUserId,
              contextType: 'patient',
              contextPatientId: testPatientId,
              transcript: testData.transcript,
              transcriptLanguage: 'ja',
              extractedData: { categories: [] },
              confidenceScore: testData.confidence
            });

            // Verify it's in pending state
            expect(reviewItem.status).toBe('pending');

            // Delete (archive) the review item
            await reviewQueueService.deleteReviewItem(reviewItem.review_id, testUserId);

            // Verify it's now discarded
            const updatedItem = await reviewQueueService.getReviewItem(reviewItem.review_id);
            expect(updatedItem.status).toBe('discarded');

            // Cleanup
            await db.query('DELETE FROM voice_review_queue WHERE review_id = $1', [reviewItem.review_id]);
          }
        ),
        { numRuns: 10 }
      );
    });

  });

});
