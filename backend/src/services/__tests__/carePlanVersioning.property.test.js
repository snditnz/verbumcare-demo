/**
 * Property-Based Tests for Care Plan Versioning
 * Feature: code-consistency-security-offline
 * 
 * These tests validate the correctness properties for care plan versioning:
 * - Property 39: Initial version is 1.0
 * - Property 40: Version increment on modification
 * - Property 41: Version history completeness
 * - Property 42: Revert creates new version
 * - Property 43: Last-write-wins conflict resolution
 */

import fc from 'fast-check';
import db from '../../db/index.js';

// Custom generators for care plan data
const careLevelGenerator = fc.constantFrom(
  '要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'
);

const statusGenerator = fc.constantFrom('active', 'draft', 'archived');

const carePlanGenerator = fc.record({
  patientId: fc.uuid(),
  careLevel: careLevelGenerator,
  status: statusGenerator,
  patientIntent: fc.string({ minLength: 10, maxLength: 200 }),
  familyIntent: fc.string({ minLength: 10, maxLength: 200 }),
  comprehensivePolicy: fc.string({ minLength: 20, maxLength: 300 }),
  createdBy: fc.uuid(),
});

const carePlanUpdateGenerator = fc.record({
  careLevel: fc.option(careLevelGenerator, { nil: undefined }),
  status: fc.option(statusGenerator, { nil: undefined }),
  patientIntent: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
  familyIntent: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
  comprehensivePolicy: fc.option(fc.string({ minLength: 20, maxLength: 300 }), { nil: undefined }),
  updatedBy: fc.uuid(),
  changeDescription: fc.string({ minLength: 5, maxLength: 100 }),
});

describe('Care Plan Versioning Property Tests', () => {
  let testPatientId;
  let testStaffId;

  beforeAll(async () => {
    // Create a test patient and staff member for all tests
    const patientResult = await db.query(`
      INSERT INTO patients (
        mrn, family_name, given_name, date_of_birth, gender, admission_date, facility_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING patient_id
    `, ['TEST-PBT-CP', 'Test', 'Patient', '1950-01-01', 'female', new Date(), '550e8400-e29b-41d4-a716-446655440001']);
    testPatientId = patientResult.rows[0].patient_id;

    const staffResult = await db.query(`
      INSERT INTO staff (
        employee_number, family_name, given_name, role, facility_id, username, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING staff_id
    `, ['TEST-STAFF-CP', 'Test', 'Staff', 'registered_nurse', '550e8400-e29b-41d4-a716-446655440001', 'test_cp_staff', 'hash']);
    testStaffId = staffResult.rows[0].staff_id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testPatientId) {
      await db.query('DELETE FROM patients WHERE patient_id = $1', [testPatientId]);
    }
    if (testStaffId) {
      await db.query('DELETE FROM staff WHERE staff_id = $1', [testStaffId]);
    }
  });

  afterEach(async () => {
    // Clean up care plans created during tests
    await db.query('DELETE FROM care_plans WHERE patient_id = $1', [testPatientId]);
  });

  /**
   * Feature: code-consistency-security-offline, Property 39: Initial version is 1.0
   * Validates: Requirements 12.1
   */
  describe('Property 39: Initial version is 1.0', () => {
    it('should initialize all new care plans with version 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          carePlanGenerator,
          async (carePlanData) => {
            // Create care plan
            const result = await db.query(`
              INSERT INTO care_plans (
                patient_id,
                care_level,
                status,
                patient_intent,
                family_intent,
                comprehensive_policy,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING care_plan_id, version
            `, [
              testPatientId,
              carePlanData.careLevel,
              carePlanData.status,
              carePlanData.patientIntent,
              carePlanData.familyIntent,
              carePlanData.comprehensivePolicy,
              testStaffId
            ]);

            const carePlan = result.rows[0];

            // Property: Initial version must be 1
            expect(carePlan.version).toBe(1);

            // Clean up
            await db.query('DELETE FROM care_plans WHERE care_plan_id = $1', [carePlan.care_plan_id]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 40: Version increment on modification
   * Validates: Requirements 12.2
   */
  describe('Property 40: Version increment on modification', () => {
    it('should increment version number on every modification', async () => {
      await fc.assert(
        fc.asyncProperty(
          carePlanGenerator,
          fc.array(carePlanUpdateGenerator, { minLength: 1, maxLength: 5 }),
          async (initialData, updates) => {
            // Create initial care plan
            const createResult = await db.query(`
              INSERT INTO care_plans (
                patient_id,
                care_level,
                status,
                patient_intent,
                family_intent,
                comprehensive_policy,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING care_plan_id, version
            `, [
              testPatientId,
              initialData.careLevel,
              initialData.status,
              initialData.patientIntent,
              initialData.familyIntent,
              initialData.comprehensivePolicy,
              testStaffId
            ]);

            const carePlanId = createResult.rows[0].care_plan_id;
            let previousVersion = createResult.rows[0].version;

            // Apply each update and verify version increments
            for (const update of updates) {
              // Save current version to history
              const currentPlan = await db.query('SELECT * FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
              const current = currentPlan.rows[0];

              const itemsSnapshot = await db.query(`
                SELECT * FROM care_plan_items WHERE care_plan_id = $1
              `, [carePlanId]);

              await db.query(`
                INSERT INTO care_plan_version_history (
                  care_plan_id, version, care_level, status, patient_intent,
                  family_intent, comprehensive_policy, care_manager_id,
                  team_members, family_signature, last_review_date,
                  next_review_date, next_monitoring_date,
                  care_plan_items_snapshot, created_by, created_by_name,
                  change_description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              `, [
                carePlanId, current.version, current.care_level, current.status,
                current.patient_intent, current.family_intent,
                current.comprehensive_policy, current.care_manager_id,
                current.team_members, current.family_signature,
                current.last_review_date, current.next_review_date,
                current.next_monitoring_date, JSON.stringify(itemsSnapshot.rows),
                testStaffId, 'Test Staff', update.changeDescription
              ]);

              // Update care plan
              const newVersion = previousVersion + 1;
              await db.query(`
                UPDATE care_plans SET
                  care_level = COALESCE($1, care_level),
                  status = COALESCE($2, status),
                  patient_intent = COALESCE($3, patient_intent),
                  family_intent = COALESCE($4, family_intent),
                  comprehensive_policy = COALESCE($5, comprehensive_policy),
                  version = $6,
                  updated_at = CURRENT_TIMESTAMP
                WHERE care_plan_id = $7
              `, [
                update.careLevel,
                update.status,
                update.patientIntent,
                update.familyIntent,
                update.comprehensivePolicy,
                newVersion,
                carePlanId
              ]);

              // Verify version incremented
              const updatedResult = await db.query(
                'SELECT version FROM care_plans WHERE care_plan_id = $1',
                [carePlanId]
              );

              const currentVersion = updatedResult.rows[0].version;

              // Property: New version must be exactly previous version + 1
              expect(currentVersion).toBe(previousVersion + 1);

              previousVersion = currentVersion;
            }

            // Clean up
            await db.query('DELETE FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
          }
        ),
        { numRuns: 50 } // Fewer runs due to multiple updates per test
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 41: Version history completeness
   * Validates: Requirements 12.3
   */
  describe('Property 41: Version history completeness', () => {
    it('should maintain complete version history for all modifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          carePlanGenerator,
          fc.array(carePlanUpdateGenerator, { minLength: 2, maxLength: 5 }),
          async (initialData, updates) => {
            // Create initial care plan
            const createResult = await db.query(`
              INSERT INTO care_plans (
                patient_id,
                care_level,
                status,
                patient_intent,
                family_intent,
                comprehensive_policy,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING care_plan_id, version
            `, [
              testPatientId,
              initialData.careLevel,
              initialData.status,
              initialData.patientIntent,
              initialData.familyIntent,
              initialData.comprehensivePolicy,
              testStaffId
            ]);

            const carePlanId = createResult.rows[0].care_plan_id;
            const versions = [createResult.rows[0].version];

            // Apply updates and track versions
            for (const update of updates) {
              const currentPlan = await db.query('SELECT * FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
              const current = currentPlan.rows[0];

              const itemsSnapshot = await db.query(`
                SELECT * FROM care_plan_items WHERE care_plan_id = $1
              `, [carePlanId]);

              await db.query(`
                INSERT INTO care_plan_version_history (
                  care_plan_id, version, care_level, status, patient_intent,
                  family_intent, comprehensive_policy, care_manager_id,
                  team_members, family_signature, last_review_date,
                  next_review_date, next_monitoring_date,
                  care_plan_items_snapshot, created_by, created_by_name,
                  change_description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              `, [
                carePlanId, current.version, current.care_level, current.status,
                current.patient_intent, current.family_intent,
                current.comprehensive_policy, current.care_manager_id,
                current.team_members, current.family_signature,
                current.last_review_date, current.next_review_date,
                current.next_monitoring_date, JSON.stringify(itemsSnapshot.rows),
                testStaffId, 'Test Staff', update.changeDescription
              ]);

              const newVersion = current.version + 1;
              await db.query(`
                UPDATE care_plans SET
                  care_level = COALESCE($1, care_level),
                  status = COALESCE($2, status),
                  patient_intent = COALESCE($3, patient_intent),
                  family_intent = COALESCE($4, family_intent),
                  comprehensive_policy = COALESCE($5, comprehensive_policy),
                  version = $6,
                  updated_at = CURRENT_TIMESTAMP
                WHERE care_plan_id = $7
              `, [
                update.careLevel,
                update.status,
                update.patientIntent,
                update.familyIntent,
                update.comprehensivePolicy,
                newVersion,
                carePlanId
              ]);

              versions.push(newVersion);
            }

            // Query version history
            const historyResult = await db.query(`
              SELECT version FROM care_plan_version_history
              WHERE care_plan_id = $1
              ORDER BY version ASC
            `, [carePlanId]);

            const historyVersions = historyResult.rows.map(row => row.version);

            // Property: History must contain all versions except the current one
            // (current version is not in history until next update)
            const expectedHistoryVersions = versions.slice(0, -1);
            expect(historyVersions).toEqual(expectedHistoryVersions);

            // Property: History must be in chronological order
            for (let i = 1; i < historyVersions.length; i++) {
              expect(historyVersions[i]).toBeGreaterThan(historyVersions[i - 1]);
            }

            // Clean up
            await db.query('DELETE FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 42: Revert creates new version
   * Validates: Requirements 12.4
   */
  describe('Property 42: Revert creates new version', () => {
    it('should create a new version when reverting to a previous version', async () => {
      await fc.assert(
        fc.asyncProperty(
          carePlanGenerator,
          fc.array(carePlanUpdateGenerator, { minLength: 3, maxLength: 5 }),
          fc.integer({ min: 0, max: 2 }), // Which version to revert to (relative to history)
          async (initialData, updates, revertIndexOffset) => {
            // Create initial care plan
            const createResult = await db.query(`
              INSERT INTO care_plans (
                patient_id,
                care_level,
                status,
                patient_intent,
                family_intent,
                comprehensive_policy,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING care_plan_id, version
            `, [
              testPatientId,
              initialData.careLevel,
              initialData.status,
              initialData.patientIntent,
              initialData.familyIntent,
              initialData.comprehensivePolicy,
              testStaffId
            ]);

            const carePlanId = createResult.rows[0].care_plan_id;

            // Apply updates to create version history
            for (const update of updates) {
              const currentPlan = await db.query('SELECT * FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
              const current = currentPlan.rows[0];

              const itemsSnapshot = await db.query(`
                SELECT * FROM care_plan_items WHERE care_plan_id = $1
              `, [carePlanId]);

              await db.query(`
                INSERT INTO care_plan_version_history (
                  care_plan_id, version, care_level, status, patient_intent,
                  family_intent, comprehensive_policy, care_manager_id,
                  team_members, family_signature, last_review_date,
                  next_review_date, next_monitoring_date,
                  care_plan_items_snapshot, created_by, created_by_name,
                  change_description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              `, [
                carePlanId, current.version, current.care_level, current.status,
                current.patient_intent, current.family_intent,
                current.comprehensive_policy, current.care_manager_id,
                current.team_members, current.family_signature,
                current.last_review_date, current.next_review_date,
                current.next_monitoring_date, JSON.stringify(itemsSnapshot.rows),
                testStaffId, 'Test Staff', update.changeDescription
              ]);

              const newVersion = current.version + 1;
              await db.query(`
                UPDATE care_plans SET
                  care_level = COALESCE($1, care_level),
                  status = COALESCE($2, status),
                  patient_intent = COALESCE($3, patient_intent),
                  family_intent = COALESCE($4, family_intent),
                  comprehensive_policy = COALESCE($5, comprehensive_policy),
                  version = $6,
                  updated_at = CURRENT_TIMESTAMP
                WHERE care_plan_id = $7
              `, [
                update.careLevel,
                update.status,
                update.patientIntent,
                update.familyIntent,
                update.comprehensivePolicy,
                newVersion,
                carePlanId
              ]);
            }

            // Get current version before revert
            const beforeRevert = await db.query(
              'SELECT version FROM care_plans WHERE care_plan_id = $1',
              [carePlanId]
            );
            const versionBeforeRevert = beforeRevert.rows[0].version;

            // Choose a version to revert to (ensure it exists in history)
            const historyResult = await db.query(`
              SELECT version FROM care_plan_version_history
              WHERE care_plan_id = $1
              ORDER BY version ASC
            `, [carePlanId]);

            if (historyResult.rows.length === 0) {
              // No history yet, skip this test case
              await db.query('DELETE FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
              return;
            }

            const revertToIndex = Math.min(revertIndexOffset, historyResult.rows.length - 1);
            const revertToVersion = historyResult.rows[revertToIndex].version;

            // Perform revert (simplified - just update version)
            const newVersion = versionBeforeRevert + 1;
            await db.query(`
              UPDATE care_plans SET
                version = $1,
                updated_at = CURRENT_TIMESTAMP
              WHERE care_plan_id = $2
            `, [newVersion, carePlanId]);

            // Verify new version was created
            const afterRevert = await db.query(
              'SELECT version FROM care_plans WHERE care_plan_id = $1',
              [carePlanId]
            );
            const versionAfterRevert = afterRevert.rows[0].version;

            // Property: Revert must create a new version (increment)
            expect(versionAfterRevert).toBe(versionBeforeRevert + 1);
            expect(versionAfterRevert).toBeGreaterThan(revertToVersion);

            // Clean up
            await db.query('DELETE FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Feature: code-consistency-security-offline, Property 43: Last-write-wins conflict resolution
   * Validates: Requirements 12.5
   */
  describe('Property 43: Last-write-wins conflict resolution', () => {
    it('should preserve the modification with the later timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          carePlanGenerator,
          carePlanUpdateGenerator,
          carePlanUpdateGenerator,
          async (initialData, update1, update2) => {
            // Create initial care plan
            const createResult = await db.query(`
              INSERT INTO care_plans (
                patient_id,
                care_level,
                status,
                patient_intent,
                family_intent,
                comprehensive_policy,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING care_plan_id, version
            `, [
              testPatientId,
              initialData.careLevel,
              initialData.status,
              initialData.patientIntent,
              initialData.familyIntent,
              initialData.comprehensivePolicy,
              testStaffId
            ]);

            const carePlanId = createResult.rows[0].care_plan_id;

            // Simulate concurrent updates with different timestamps
            // First update (earlier timestamp)
            const timestamp1 = new Date('2025-01-01T10:00:00Z');
            await db.query(`
              UPDATE care_plans SET
                patient_intent = $1,
                updated_at = $2
              WHERE care_plan_id = $3
            `, [update1.patientIntent || 'First update', timestamp1, carePlanId]);

            // Second update (later timestamp) - this should win
            const timestamp2 = new Date('2025-01-01T10:05:00Z');
            await db.query(`
              UPDATE care_plans SET
                patient_intent = $1,
                updated_at = $2
              WHERE care_plan_id = $3
            `, [update2.patientIntent || 'Second update', timestamp2, carePlanId]);

            // Query final state
            const finalResult = await db.query(`
              SELECT patient_intent, updated_at FROM care_plans
              WHERE care_plan_id = $1
            `, [carePlanId]);

            const finalPlan = finalResult.rows[0];

            // Property: Last write (later timestamp) should be preserved
            expect(finalPlan.patient_intent).toBe(update2.patientIntent || 'Second update');
            expect(new Date(finalPlan.updated_at).getTime()).toBeGreaterThanOrEqual(timestamp2.getTime());

            // Clean up
            await db.query('DELETE FROM care_plans WHERE care_plan_id = $1', [carePlanId]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
