import fc from 'fast-check';
import db from '../../db/index.js';
import { insertReviewDataAtomic } from '../reviewDataInsertion.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-Based Tests for Review Data Insertion
 * Tests correctness properties for database insertion from confirmed reviews
 */

describe('Review Data Insertion - Property-Based Tests', () => {
  let testPatientId;
  let testStaffId;
  let testFacilityId;

  beforeAll(async () => {
    // Clean up any existing test data first
    await db.query(`DELETE FROM staff WHERE username = 'teststaff_insertion'`);
    await db.query(`DELETE FROM patients WHERE mrn = 'TEST-INS-001'`);
    await db.query(`DELETE FROM facilities WHERE facility_name = 'Test Facility Insertion'`);

    // Create test facility
    const facilityResult = await db.query(
      `INSERT INTO facilities (facility_name) VALUES ('Test Facility Insertion') RETURNING facility_id`
    );
    testFacilityId = facilityResult.rows[0].facility_id;

    // Create test patient
    const patientResult = await db.query(
      `INSERT INTO patients (facility_id, mrn, family_name, given_name, date_of_birth, gender)
       VALUES ($1, 'TEST-INS-001', 'Test', 'Patient', '1950-01-01', 'male')
       RETURNING patient_id`,
      [testFacilityId]
    );
    testPatientId = patientResult.rows[0].patient_id;

    // Create test staff
    const staffResult = await db.query(
      `INSERT INTO staff (facility_id, employee_number, family_name, given_name, role, username)
       VALUES ($1, 'STAFF-INS-001', 'Test', 'Staff', 'registered_nurse', 'teststaff_insertion')
       RETURNING staff_id`,
      [testFacilityId]
    );
    testStaffId = staffResult.rows[0].staff_id;
  });

  afterAll(async () => {
    // Clean up test data (order matters for foreign key constraints)
    if (testPatientId) {
      // Delete all related records first
      await db.query('DELETE FROM medication_administrations WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM medication_orders WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM vital_signs WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM clinical_notes WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM barthel_assessments WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM patient_incidents WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM nursing_assessments WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM care_plan_items WHERE care_plan_id IN (SELECT care_plan_id FROM care_plans WHERE patient_id = $1)', [testPatientId]);
      await db.query('DELETE FROM care_plans WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM voice_recordings WHERE patient_id = $1', [testPatientId]);
      await db.query('DELETE FROM patients WHERE patient_id = $1', [testPatientId]);
    }
    if (testStaffId) {
      await db.query('DELETE FROM staff WHERE staff_id = $1', [testStaffId]);
    }
    if (testFacilityId) {
      await db.query('DELETE FROM facilities WHERE facility_id = $1', [testFacilityId]);
    }
  });

  /**
   * Property 3: Multi-category patient association
   * For any recording that extracts multiple data types,
   * each database entry SHALL maintain the same patient association
   * Validates: Requirements 1.3
   */
  test('Property 3: Multi-category patient association', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate review with multiple categories
        fc.record({
          categories: fc.array(
            fc.constantFrom('vitals', 'medication', 'clinical_note', 'adl', 'incident', 'care_plan', 'pain'),
            { minLength: 2, maxLength: 4 }
          ).map(cats => [...new Set(cats)]), // Remove duplicates
          transcript: fc.string({ minLength: 20, maxLength: 200 })
        }),
        async ({ categories, transcript }) => {
          // Create review item with multiple categories
          const reviewId = uuidv4();
          const recordingId = uuidv4();

          // Generate data for each category
          const extractedCategories = categories.map(category => {
            let data = {};
            
            switch (category) {
              case 'vitals':
                data = {
                  blood_pressure_systolic: 120,
                  blood_pressure_diastolic: 80,
                  heart_rate: 72,
                  temperature_celsius: 36.5
                };
                break;
              case 'medication':
                data = {
                  medication_name: 'Test Medication',
                  dose: '10mg',
                  route: 'oral',
                  time: new Date()
                };
                break;
              case 'clinical_note':
                data = {
                  note_text: transcript,
                  category: 'other'
                };
                break;
              case 'adl':
                data = {
                  total_score: 85,
                  category_scores: { eating: 10, transfer: 15, toileting: 10 }
                };
                break;
              case 'incident':
                data = {
                  description: 'Test incident',
                  type: 'other',
                  severity: 'low'
                };
                break;
              case 'care_plan':
                data = {
                  problem: 'Test problem',
                  goal: 'Test goal',
                  interventions: ['Test intervention']
                };
                break;
              case 'pain':
                data = {
                  pain_score: 5,
                  location: 'back'
                };
                break;
            }

            return {
              type: category,
              confidence: 0.85,
              data: data,
              fieldConfidences: {}
            };
          });

          // Create voice recording
          await db.query(
            `INSERT INTO voice_recordings (
              recording_id, patient_id, recorded_at, audio_file_path,
              transcription_text, transcription_language, recorded_by,
              context_type, context_patient_id, review_status
            ) VALUES ($1, $2, NOW(), 'test.m4a', $3, 'ja', $4, 'patient', $5, 'pending_review')`,
            [recordingId, testPatientId, transcript, testStaffId, testPatientId]
          );

          // Create review queue item
          await db.query(
            `INSERT INTO voice_review_queue (
              review_id, recording_id, user_id, context_type, context_patient_id,
              transcript, transcript_language, extracted_data, confidence_score, status
            ) VALUES ($1, $2, $3, 'patient', $4, $5, 'ja', $6, 0.85, 'pending')`,
            [reviewId, recordingId, testStaffId, testPatientId, transcript, JSON.stringify({
              categories: extractedCategories,
              overallConfidence: 0.85
            })]
          );

          // Create categorization log
          await db.query(
            `INSERT INTO voice_categorization_log (review_id, detected_categories)
             VALUES ($1, $2)`,
            [reviewId, JSON.stringify(categories)]
          );

          const reviewItem = {
            review_id: reviewId,
            recording_id: recordingId,
            user_id: testStaffId,
            context_type: 'patient',
            context_patient_id: testPatientId,
            transcript: transcript,
            transcript_language: 'ja',
            extracted_data: {
              categories: extractedCategories,
              overallConfidence: 0.85
            }
          };

          try {
            // Insert data using atomic transaction
            const result = await insertReviewDataAtomic(reviewItem, testStaffId);

            // Verify all inserted records link to the same patient
            const insertedRecords = result.insertedRecords;

            // Check vitals
            for (const vital of insertedRecords.vitals || []) {
              expect(vital.patient_id).toBe(testPatientId);
            }

            // Check medications
            for (const medication of insertedRecords.medications || []) {
              expect(medication.patient_id).toBe(testPatientId);
            }

            // Check clinical notes
            for (const note of insertedRecords.clinical_notes || []) {
              expect(note.patient_id).toBe(testPatientId);
            }

            // Check ADL assessments
            for (const adl of insertedRecords.adl_assessments || []) {
              expect(adl.patient_id).toBe(testPatientId);
            }

            // Check incidents
            for (const incident of insertedRecords.incidents || []) {
              expect(incident.patient_id).toBe(testPatientId);
            }

            // Check care plan items (need to verify through care plan)
            for (const carePlanItem of insertedRecords.care_plan_items || []) {
              const carePlanResult = await db.query(
                'SELECT patient_id FROM care_plans WHERE care_plan_id = $1',
                [carePlanItem.care_plan_id]
              );
              expect(carePlanResult.rows[0].patient_id).toBe(testPatientId);
            }

            // Check pain assessments
            for (const painAssessment of insertedRecords.pain_assessments || []) {
              expect(painAssessment.patient_id).toBe(testPatientId);
            }

            // Property holds: All entries link to the same patient
            return true;

          } finally {
            // Clean up test data (order matters for foreign key constraints)
            await db.query('DELETE FROM voice_categorization_log WHERE review_id = $1', [reviewId]);
            await db.query('DELETE FROM voice_review_queue WHERE review_id = $1', [reviewId]);
            await db.query('DELETE FROM medication_administrations WHERE patient_id = $1 AND administered_by = $2', [testPatientId, testStaffId]);
            await db.query('DELETE FROM medication_orders WHERE patient_id = $1 AND order_number LIKE $2', [testPatientId, 'VOICE-%']);
            await db.query('DELETE FROM vital_signs WHERE patient_id = $1 AND recorded_by = $2', [testPatientId, testStaffId]);
            await db.query('DELETE FROM clinical_notes WHERE patient_id = $1 AND authored_by = $2', [testPatientId, testStaffId]);
            await db.query('DELETE FROM barthel_assessments WHERE patient_id = $1 AND assessed_by = $2', [testPatientId, testStaffId]);
            await db.query('DELETE FROM patient_incidents WHERE patient_id = $1 AND reported_by = $2', [testPatientId, testStaffId]);
            await db.query('DELETE FROM nursing_assessments WHERE patient_id = $1 AND assessed_by = $2', [testPatientId, testStaffId]);
            await db.query('DELETE FROM care_plan_items WHERE care_plan_id IN (SELECT care_plan_id FROM care_plans WHERE patient_id = $1)', [testPatientId]);
            await db.query('DELETE FROM care_plans WHERE patient_id = $1', [testPatientId]);
            await db.query('DELETE FROM voice_recordings WHERE recording_id = $1', [recordingId]);
          }
        }
      ),
      { numRuns: 10 } // Reduced for database operations
    );
  }, 60000); // 60 second timeout for database operations

  /**
   * Property 38: Failure recovery
   * For any database insertion failure,
   * the system SHALL retain the approved data in the queue for retry
   * Validates: Requirements 11.4
   * 
   * Note: This test simulates a failure by using invalid data that will fail validation
   */
  test('Property 38: Failure recovery', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          transcript: fc.string({ minLength: 20, maxLength: 200 })
        }),
        async ({ transcript }) => {
          const reviewId = uuidv4();
          const recordingId = uuidv4();

          // Create voice recording with valid patient
          await db.query(
            `INSERT INTO voice_recordings (
              recording_id, patient_id, recorded_at, audio_file_path,
              transcription_text, transcription_language, recorded_by,
              context_type, context_patient_id, review_status
            ) VALUES ($1, $2, NOW(), 'test.m4a', $3, 'ja', $4, 'patient', $5, 'pending_review')`,
            [recordingId, testPatientId, transcript, testStaffId, testPatientId]
          );

          // Create review queue item with invalid data (pain score > 10 will fail validation)
          await db.query(
            `INSERT INTO voice_review_queue (
              review_id, recording_id, user_id, context_type, context_patient_id,
              transcript, transcript_language, extracted_data, confidence_score, status
            ) VALUES ($1, $2, $3, 'patient', $4, $5, 'ja', $6, 0.85, 'pending')`,
            [reviewId, recordingId, testStaffId, testPatientId, transcript, JSON.stringify({
              categories: [{
                type: 'pain',
                confidence: 0.85,
                data: {
                  pain_score: 15, // Invalid: > 10
                  location: 'test'
                }
              }],
              overallConfidence: 0.85
            })]
          );

          // Create categorization log
          await db.query(
            `INSERT INTO voice_categorization_log (review_id, detected_categories)
             VALUES ($1, $2)`,
            [reviewId, JSON.stringify(['pain'])]
          );

          const reviewItem = {
            review_id: reviewId,
            recording_id: recordingId,
            user_id: testStaffId,
            context_type: 'patient',
            context_patient_id: testPatientId,
            transcript: transcript,
            transcript_language: 'ja',
            extracted_data: {
              categories: [{
                type: 'pain',
                confidence: 0.85,
                data: {
                  pain_score: 15, // Invalid: > 10
                  location: 'test'
                }
              }],
              overallConfidence: 0.85
            }
          };

          try {
            // Attempt to insert data (should fail due to invalid pain score)
            await insertReviewDataAtomic(reviewItem, testStaffId);
            
            // If we get here, the test should fail
            return false;

          } catch (error) {
            // Expected to fail
            
            // Verify data is still in queue (status should still be 'pending')
            const queueResult = await db.query(
              'SELECT status FROM voice_review_queue WHERE review_id = $1',
              [reviewId]
            );

            // Property holds: Data retained in queue after failure
            const dataRetained = queueResult.rows.length > 0 && queueResult.rows[0].status === 'pending';
            
            return dataRetained;

          } finally {
            // Clean up test data (order matters for foreign key constraints)
            await db.query('DELETE FROM voice_categorization_log WHERE review_id = $1', [reviewId]);
            await db.query('DELETE FROM voice_review_queue WHERE review_id = $1', [reviewId]);
            await db.query('DELETE FROM voice_recordings WHERE recording_id = $1', [recordingId]);
          }
        }
      ),
      { numRuns: 10 } // Reduced for database operations
    );
  }, 60000); // 60 second timeout
});
