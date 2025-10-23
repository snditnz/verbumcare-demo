import express from 'express';
import db from '../db/index.js';
import { detectLanguage, getTranslation } from '../utils/i18n.js';

const router = express.Router();

// ============================================================================
// PROBLEM TEMPLATES - For quick entry
// ============================================================================

router.get('/problem-templates', async (req, res) => {
  try {
    const language = detectLanguage(req);

    const query = `
      SELECT
        template_id as "templateId",
        category,
        japanese_text as "japanese",
        english_text as "english",
        chinese_text as "chinese",
        suggested_long_term_goals as "suggestedLongTermGoals",
        suggested_short_term_goals as "suggestedShortTermGoals",
        suggested_interventions as "suggestedInterventions"
      FROM problem_templates
      ORDER BY category, japanese_text
    `;

    const result = await db.query(query);

    res.json({
      templates: result.rows,
      language
    });
  } catch (error) {
    console.error('Error fetching problem templates:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// CARE PLANS - CRUD Operations
// ============================================================================

// Get ALL care plans across all patients (for "All Care Plans" page)
router.get('/all', async (req, res) => {
  try {
    const language = detectLanguage(req);

    // Get only the LATEST care plan per patient (not all versions/duplicates)
    const query = `
      WITH latest_care_plans AS (
        SELECT
          cp.care_plan_id,
          cp.patient_id,
          ROW_NUMBER() OVER (
            PARTITION BY cp.patient_id
            ORDER BY cp.created_date DESC, cp.version DESC
          ) as rn
        FROM care_plans cp
        WHERE cp.status IN ('active', 'draft')
      )
      SELECT
        cp.care_plan_id as "id",
        cp.patient_id as "patientId",
        cp.care_level as "careLevel",
        cp.status,
        cp.version,
        cp.created_date as "createdDate",
        cp.last_review_date as "lastReviewDate",
        cp.next_review_date as "nextReviewDate",
        cp.created_by as "createdBy",
        cp.patient_intent as "patientIntent",
        cp.family_intent as "familyIntent",
        cp.comprehensive_policy as "comprehensivePolicy",
        cp.care_manager_id as "careManagerId",
        cp.team_members as "teamMembers",
        cp.family_signature as "familySignature",
        cp.last_monitoring_date as "lastMonitoringDate",
        cp.next_monitoring_date as "nextMonitoringDate",
        -- Patient info
        jsonb_build_object(
          'patient_id', p.patient_id,
          'mrn', p.mrn,
          'family_name', p.family_name,
          'given_name', p.given_name,
          'family_name_en', p.family_name_en,
          'given_name_en', p.given_name_en,
          'room', p.room,
          'bed', p.bed,
          'gender', p.gender,
          'status', p.status
        ) as "patient",
        -- Stats for quick display
        COALESCE(
          (SELECT COUNT(*)
           FROM care_plan_items cpi
           WHERE cpi.care_plan_id = cp.care_plan_id
             AND cpi.problem_status = 'active'),
          0
        ) as "activeItemsCount",
        COALESCE(
          (SELECT ROUND(AVG(cpi.short_term_goal_achievement_status))
           FROM care_plan_items cpi
           WHERE cpi.care_plan_id = cp.care_plan_id
             AND cpi.problem_status = 'active'),
          0
        ) as "avgProgress",
        -- Alert flags
        CASE WHEN cp.next_monitoring_date < CURRENT_DATE THEN true ELSE false END as "overdueMonitoring",
        COALESCE(
          (SELECT COUNT(*) > 0
           FROM care_plan_items cpi
           WHERE cpi.care_plan_id = cp.care_plan_id
             AND cpi.problem_status = 'active'
             AND (cpi.problem_priority = 'urgent' OR cpi.problem_priority = 'high')),
          false
        ) as "hasHighPriority",
        COALESCE(
          (SELECT COUNT(*) > 0
           FROM care_plan_items cpi
           WHERE cpi.care_plan_id = cp.care_plan_id
             AND cpi.problem_status = 'active'
             AND cpi.short_term_goal_achievement_status < 30),
          false
        ) as "hasStuckGoals",
        -- Last updated info
        (SELECT MAX(cpi.last_updated)
         FROM care_plan_items cpi
         WHERE cpi.care_plan_id = cp.care_plan_id) as "lastItemUpdate",
        (SELECT s.family_name || ' ' || s.given_name
         FROM care_plan_items cpi
         JOIN staff s ON s.staff_id = cpi.updated_by
         WHERE cpi.care_plan_id = cp.care_plan_id
         ORDER BY cpi.last_updated DESC
         LIMIT 1) as "lastUpdatedBy"
      FROM latest_care_plans lcp
      INNER JOIN care_plans cp ON cp.care_plan_id = lcp.care_plan_id
      INNER JOIN patients p ON p.patient_id = cp.patient_id
      WHERE lcp.rn = 1
      ORDER BY cp.last_review_date DESC NULLS LAST, cp.created_date DESC
    `;

    const result = await db.query(query);

    res.json({
      data: result.rows,
      count: result.rows.length,
      language
    });
  } catch (error) {
    console.error('Error fetching all care plans:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get care plans for a patient
router.get('/', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { patient_id } = req.query;

    if (!patient_id) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'patient_id is required'
      });
    }

    const query = `
      SELECT
        cp.care_plan_id as "id",
        cp.patient_id as "patientId",
        cp.care_level as "careLevel",
        cp.status,
        cp.version,
        cp.created_date as "createdDate",
        cp.last_review_date as "lastReviewDate",
        cp.next_review_date as "nextReviewDate",
        cp.created_by as "createdBy",
        cp.patient_intent as "patientIntent",
        cp.family_intent as "familyIntent",
        cp.comprehensive_policy as "comprehensivePolicy",
        cp.care_manager_id as "careManagerId",
        cp.team_members as "teamMembers",
        cp.family_signature as "familySignature",
        cp.last_monitoring_date as "lastMonitoringDate",
        cp.next_monitoring_date as "nextMonitoringDate"
      FROM care_plans cp
      WHERE cp.patient_id = $1
      ORDER BY cp.created_date DESC
    `;

    const result = await db.query(query, [patient_id]);

    // For each care plan, fetch its items
    for (let i = 0; i < result.rows.length; i++) {
      const carePlan = result.rows[i];

      // Get care plan items
      const itemsQuery = `
        SELECT
          cpi.care_plan_item_id as "id",
          cpi.care_plan_id as "carePlanId",
          jsonb_build_object(
            'category', cpi.problem_category,
            'description', cpi.problem_description,
            'priority', cpi.problem_priority,
            'identifiedDate', cpi.identified_date,
            'status', cpi.problem_status
          ) as "problem",
          jsonb_build_object(
            'description', cpi.long_term_goal_description,
            'targetDate', cpi.long_term_goal_target_date,
            'duration', cpi.long_term_goal_duration,
            'achievementStatus', cpi.long_term_goal_achievement_status
          ) as "longTermGoal",
          jsonb_build_object(
            'description', cpi.short_term_goal_description,
            'targetDate', cpi.short_term_goal_target_date,
            'duration', cpi.short_term_goal_duration,
            'achievementStatus', cpi.short_term_goal_achievement_status,
            'measurableCriteria', cpi.short_term_goal_measurable_criteria
          ) as "shortTermGoal",
          cpi.interventions,
          cpi.linked_assessments as "linkedAssessments",
          cpi.last_updated as "lastUpdated",
          cpi.updated_by as "updatedBy"
        FROM care_plan_items cpi
        WHERE cpi.care_plan_id = $1
        ORDER BY cpi.problem_priority DESC, cpi.identified_date DESC
      `;

      const itemsResult = await db.query(itemsQuery, [carePlan.id]);

      // For each item, fetch progress notes
      for (let j = 0; j < itemsResult.rows.length; j++) {
        const item = itemsResult.rows[j];

        const notesQuery = `
          SELECT
            progress_note_id as "id",
            care_plan_item_id as "carePlanItemId",
            note_date as "date",
            note,
            author_id as "author",
            author_name as "authorName"
          FROM care_plan_progress_notes
          WHERE care_plan_item_id = $1
          ORDER BY note_date DESC
        `;

        const notesResult = await db.query(notesQuery, [item.id]);
        item.progressNotes = notesResult.rows;
      }

      carePlan.carePlanItems = itemsResult.rows;

      // Get weekly schedule
      const scheduleQuery = `
        SELECT
          schedule_item_id as "id",
          care_plan_id as "carePlanId",
          day_of_week as "dayOfWeek",
          time_slot as "timeSlot",
          specific_time as "specificTime",
          service_data as "service",
          linked_to_care_plan_item as "linkedToCarePlanItem",
          frequency
        FROM weekly_schedule_items
        WHERE care_plan_id = $1
        ORDER BY day_of_week, specific_time
      `;

      const scheduleResult = await db.query(scheduleQuery, [carePlan.id]);
      carePlan.weeklySchedule = scheduleResult.rows;

      // Get monitoring records
      const monitoringQuery = `
        SELECT
          monitoring_record_id as "id",
          care_plan_id as "carePlanId",
          monitoring_date as "monitoringDate",
          monitoring_type as "monitoringType",
          conducted_by as "conductedBy",
          conducted_by_name as "conductedByName",
          item_reviews as "itemReviews",
          overall_status as "overallStatus",
          patient_feedback as "patientFeedback",
          family_feedback as "familyFeedback",
          staff_observations as "staffObservations",
          proposed_changes as "proposedChanges",
          next_monitoring_date as "nextMonitoringDate",
          action_items as "actionItems"
        FROM monitoring_records
        WHERE care_plan_id = $1
        ORDER BY monitoring_date DESC
      `;

      const monitoringResult = await db.query(monitoringQuery, [carePlan.id]);
      carePlan.monitoringRecords = monitoringResult.rows;

      // Get audit log
      const auditQuery = `
        SELECT
          audit_log_id as "id",
          timestamp,
          user_id as "userId",
          user_name as "userName",
          action,
          changes,
          version
        FROM care_plan_audit_log
        WHERE care_plan_id = $1
        ORDER BY timestamp DESC
      `;

      const auditResult = await db.query(auditQuery, [carePlan.id]);
      carePlan.auditLog = auditResult.rows;
    }

    res.json({
      data: result.rows,
      language
    });
  } catch (error) {
    console.error('Error fetching care plans:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get a specific care plan by ID
router.get('/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;

    const query = `
      SELECT
        cp.care_plan_id as "id",
        cp.patient_id as "patientId",
        cp.care_level as "careLevel",
        cp.status,
        cp.version,
        cp.created_date as "createdDate",
        cp.last_review_date as "lastReviewDate",
        cp.next_review_date as "nextReviewDate",
        cp.created_by as "createdBy",
        cp.patient_intent as "patientIntent",
        cp.family_intent as "familyIntent",
        cp.comprehensive_policy as "comprehensivePolicy",
        cp.care_manager_id as "careManagerId",
        cp.team_members as "teamMembers",
        cp.family_signature as "familySignature",
        cp.last_monitoring_date as "lastMonitoringDate",
        cp.next_monitoring_date as "nextMonitoringDate"
      FROM care_plans cp
      WHERE cp.care_plan_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: getTranslation('errors.not_found', language),
        message: 'Care plan not found'
      });
    }

    const carePlan = result.rows[0];

    // Fetch all related data (same as in GET /)
    // Get care plan items
    const itemsQuery = `
      SELECT
        cpi.care_plan_item_id as "id",
        cpi.care_plan_id as "carePlanId",
        jsonb_build_object(
          'category', cpi.problem_category,
          'description', cpi.problem_description,
          'priority', cpi.problem_priority,
          'identifiedDate', cpi.identified_date,
          'status', cpi.problem_status
        ) as "problem",
        jsonb_build_object(
          'description', cpi.long_term_goal_description,
          'targetDate', cpi.long_term_goal_target_date,
          'duration', cpi.long_term_goal_duration,
          'achievementStatus', cpi.long_term_goal_achievement_status
        ) as "longTermGoal",
        jsonb_build_object(
          'description', cpi.short_term_goal_description,
          'targetDate', cpi.short_term_goal_target_date,
          'duration', cpi.short_term_goal_duration,
          'achievementStatus', cpi.short_term_goal_achievement_status,
          'measurableCriteria', cpi.short_term_goal_measurable_criteria
        ) as "shortTermGoal",
        cpi.interventions,
        cpi.linked_assessments as "linkedAssessments",
        cpi.last_updated as "lastUpdated",
        cpi.updated_by as "updatedBy"
      FROM care_plan_items cpi
      WHERE cpi.care_plan_id = $1
      ORDER BY cpi.problem_priority DESC, cpi.identified_date DESC
    `;
    const itemsResult = await db.query(itemsQuery, [carePlan.id]);

    // For each item, fetch progress notes
    for (let j = 0; j < itemsResult.rows.length; j++) {
      const item = itemsResult.rows[j];
      const notesQuery = `
        SELECT
          progress_note_id as "id",
          care_plan_item_id as "carePlanItemId",
          note_date as "date",
          note,
          author_id as "author",
          author_name as "authorName"
        FROM care_plan_progress_notes
        WHERE care_plan_item_id = $1
        ORDER BY note_date DESC
      `;
      const notesResult = await db.query(notesQuery, [item.id]);
      item.progressNotes = notesResult.rows;
    }

    carePlan.carePlanItems = itemsResult.rows;

    // Get audit log
    const auditQuery = `
      SELECT
        audit_log_id as "id",
        timestamp,
        user_id as "userId",
        user_name as "userName",
        action,
        changes,
        version
      FROM care_plan_audit_log
      WHERE care_plan_id = $1
      ORDER BY timestamp DESC
    `;
    const auditResult = await db.query(auditQuery, [carePlan.id]);
    carePlan.auditLog = auditResult.rows;

    // Get monitoring records
    const monitoringQuery = `
      SELECT
        monitoring_record_id as "id",
        monitoring_date as "monitoringDate",
        monitoring_type as "monitoringType",
        conducted_by as "conductedBy",
        conducted_by_name as "conductedByName",
        overall_status as "overallStatus",
        item_reviews as "itemReviews",
        next_monitoring_date as "nextMonitoringDate"
      FROM monitoring_records
      WHERE care_plan_id = $1
      ORDER BY monitoring_date DESC
    `;
    const monitoringResult = await db.query(monitoringQuery, [carePlan.id]);
    carePlan.monitoringRecords = monitoringResult.rows;

    res.json({
      carePlan,
      language
    });
  } catch (error) {
    console.error('Error fetching care plan:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create a new care plan
router.post('/', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const {
      patientId,
      careLevel,
      status = 'draft',
      createdBy,
      patientIntent = '',
      familyIntent = '',
      comprehensivePolicy = '',
      careManagerId,
      teamMembers = [],
      nextReviewDate
    } = req.body;

    if (!patientId || !createdBy) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'patientId and createdBy are required'
      });
    }

    const query = `
      INSERT INTO care_plans (
        patient_id,
        care_level,
        status,
        created_by,
        patient_intent,
        family_intent,
        comprehensive_policy,
        care_manager_id,
        team_members,
        next_review_date,
        next_monitoring_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        care_plan_id as "id",
        patient_id as "patientId",
        care_level as "careLevel",
        status,
        version,
        created_date as "createdDate",
        created_by as "createdBy",
        patient_intent as "patientIntent",
        family_intent as "familyIntent",
        comprehensive_policy as "comprehensivePolicy",
        care_manager_id as "careManagerId",
        team_members as "teamMembers",
        next_review_date as "nextReviewDate",
        next_monitoring_date as "nextMonitoringDate"
    `;

    // Calculate initial monitoring date (3 months from now)
    const nextMonitoringDate = new Date();
    nextMonitoringDate.setMonth(nextMonitoringDate.getMonth() + 3);

    const result = await db.query(query, [
      patientId,
      careLevel,
      status,
      createdBy,
      patientIntent,
      familyIntent,
      comprehensivePolicy,
      careManagerId,
      JSON.stringify(teamMembers),
      nextReviewDate,
      nextMonitoringDate
    ]);

    const carePlan = result.rows[0];
    carePlan.carePlanItems = [];
    carePlan.weeklySchedule = [];
    carePlan.monitoringRecords = [];
    carePlan.auditLog = [];

    // Create audit log entry
    await db.query(`
      INSERT INTO care_plan_audit_log (care_plan_id, user_id, user_name, action, version)
      SELECT $1, $2, CONCAT(s.family_name, ' ', s.given_name), 'created', 1
      FROM staff s WHERE s.staff_id = $2
    `, [carePlan.id, createdBy]);

    res.status(201).json({
      data: carePlan,
      language
    });
  } catch (error) {
    console.error('Error creating care plan:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update a care plan
router.put('/:id', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id } = req.params;
    const {
      careLevel,
      status,
      patientIntent,
      familyIntent,
      comprehensivePolicy,
      careManagerId,
      teamMembers,
      familySignature,
      lastReviewDate,
      nextReviewDate,
      nextMonitoringDate,
      updatedBy
    } = req.body;

    if (!updatedBy) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'updatedBy is required'
      });
    }

    // Get current version
    const versionQuery = await db.query('SELECT version FROM care_plans WHERE care_plan_id = $1', [id]);
    if (versionQuery.rows.length === 0) {
      return res.status(404).json({
        error: getTranslation('errors.not_found', language),
        message: 'Care plan not found'
      });
    }

    const newVersion = versionQuery.rows[0].version + 1;

    const query = `
      UPDATE care_plans SET
        care_level = COALESCE($1, care_level),
        status = COALESCE($2, status),
        patient_intent = COALESCE($3, patient_intent),
        family_intent = COALESCE($4, family_intent),
        comprehensive_policy = COALESCE($5, comprehensive_policy),
        care_manager_id = COALESCE($6, care_manager_id),
        team_members = COALESCE($7, team_members),
        family_signature = COALESCE($8, family_signature),
        last_review_date = COALESCE($9, last_review_date),
        next_review_date = COALESCE($10, next_review_date),
        next_monitoring_date = COALESCE($11, next_monitoring_date),
        version = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE care_plan_id = $13
      RETURNING *
    `;

    await db.query(query, [
      careLevel,
      status,
      patientIntent,
      familyIntent,
      comprehensivePolicy,
      careManagerId,
      teamMembers ? JSON.stringify(teamMembers) : null,
      familySignature ? JSON.stringify(familySignature) : null,
      lastReviewDate,
      nextReviewDate,
      nextMonitoringDate,
      newVersion,
      id
    ]);

    // Create audit log entry
    await db.query(`
      INSERT INTO care_plan_audit_log (care_plan_id, user_id, user_name, action, changes, version)
      SELECT $1, $2, CONCAT(s.family_name, ' ', s.given_name), 'updated', $3, $4
      FROM staff s WHERE s.staff_id = $2
    `, [id, updatedBy, JSON.stringify(req.body), newVersion]);

    res.json({
      success: true,
      message: 'Care plan updated successfully',
      language
    });
  } catch (error) {
    console.error('Error updating care plan:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// CARE PLAN ITEMS - CRUD Operations
// ============================================================================

// Add a care plan item
router.post('/:id/items', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id: carePlanId } = req.params;
    const {
      problem,
      longTermGoal,
      shortTermGoal,
      interventions = [],
      linkedAssessments = {},
      updatedBy
    } = req.body;

    if (!problem || !longTermGoal || !shortTermGoal || !updatedBy) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'problem, longTermGoal, shortTermGoal, and updatedBy are required'
      });
    }

    const query = `
      INSERT INTO care_plan_items (
        care_plan_id,
        problem_category,
        problem_description,
        problem_priority,
        identified_date,
        problem_status,
        long_term_goal_description,
        long_term_goal_target_date,
        long_term_goal_duration,
        long_term_goal_achievement_status,
        short_term_goal_description,
        short_term_goal_target_date,
        short_term_goal_duration,
        short_term_goal_achievement_status,
        short_term_goal_measurable_criteria,
        interventions,
        linked_assessments,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING care_plan_item_id as "id"
    `;

    const result = await db.query(query, [
      carePlanId,
      problem.category,
      problem.description,
      problem.priority,
      problem.identifiedDate || new Date(),
      problem.status || 'active',
      longTermGoal.description,
      longTermGoal.targetDate,
      longTermGoal.duration,
      longTermGoal.achievementStatus || 0,
      shortTermGoal.description,
      shortTermGoal.targetDate,
      shortTermGoal.duration,
      shortTermGoal.achievementStatus || 0,
      shortTermGoal.measurableCriteria || '',
      JSON.stringify(interventions),
      JSON.stringify(linkedAssessments),
      updatedBy
    ]);

    // Create audit log entry
    await db.query(`
      INSERT INTO care_plan_audit_log (care_plan_id, user_id, user_name, action, changes, version)
      SELECT $1, $2, CONCAT(s.family_name, ' ', s.given_name), 'item_added', $3, (SELECT version FROM care_plans WHERE care_plan_id = $1)
      FROM staff s WHERE s.staff_id = $2
    `, [carePlanId, updatedBy, JSON.stringify({ itemId: result.rows[0].id, problem })]);

    // Build the full item response
    const carePlanItem = {
      id: result.rows[0].id,
      carePlanId,
      problem,
      longTermGoal,
      shortTermGoal,
      interventions,
      linkedAssessments,
      progressNotes: [],
      lastUpdated: new Date(),
      updatedBy
    };

    res.status(201).json({
      data: carePlanItem,
      language
    });
  } catch (error) {
    console.error('Error adding care plan item:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update a care plan item
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id: carePlanId, itemId } = req.params;
    const {
      problem,
      longTermGoal,
      shortTermGoal,
      interventions,
      linkedAssessments,
      updatedBy
    } = req.body;

    if (!updatedBy) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'updatedBy is required'
      });
    }

    const query = `
      UPDATE care_plan_items SET
        problem_category = COALESCE($1, problem_category),
        problem_description = COALESCE($2, problem_description),
        problem_priority = COALESCE($3, problem_priority),
        problem_status = COALESCE($4, problem_status),
        long_term_goal_description = COALESCE($5, long_term_goal_description),
        long_term_goal_target_date = COALESCE($6, long_term_goal_target_date),
        long_term_goal_duration = COALESCE($7, long_term_goal_duration),
        long_term_goal_achievement_status = COALESCE($8, long_term_goal_achievement_status),
        short_term_goal_description = COALESCE($9, short_term_goal_description),
        short_term_goal_target_date = COALESCE($10, short_term_goal_target_date),
        short_term_goal_duration = COALESCE($11, short_term_goal_duration),
        short_term_goal_achievement_status = COALESCE($12, short_term_goal_achievement_status),
        short_term_goal_measurable_criteria = COALESCE($13, short_term_goal_measurable_criteria),
        interventions = COALESCE($14, interventions),
        linked_assessments = COALESCE($15, linked_assessments),
        updated_by = $16,
        last_updated = CURRENT_TIMESTAMP
      WHERE care_plan_item_id = $17 AND care_plan_id = $18
      RETURNING care_plan_item_id
    `;

    const result = await db.query(query, [
      problem?.category,
      problem?.description,
      problem?.priority,
      problem?.status,
      longTermGoal?.description,
      longTermGoal?.targetDate,
      longTermGoal?.duration,
      longTermGoal?.achievementStatus,
      shortTermGoal?.description,
      shortTermGoal?.targetDate,
      shortTermGoal?.duration,
      shortTermGoal?.achievementStatus,
      shortTermGoal?.measurableCriteria,
      interventions ? JSON.stringify(interventions) : null,
      linkedAssessments ? JSON.stringify(linkedAssessments) : null,
      updatedBy,
      itemId,
      carePlanId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: getTranslation('errors.not_found', language),
        message: 'Care plan item not found'
      });
    }

    // Create audit log entry
    await db.query(`
      INSERT INTO care_plan_audit_log (care_plan_id, user_id, user_name, action, changes, version)
      SELECT $1, $2, CONCAT(s.family_name, ' ', s.given_name), 'item_updated', $3, (SELECT version FROM care_plans WHERE care_plan_id = $1)
      FROM staff s WHERE s.staff_id = $2
    `, [carePlanId, updatedBy, JSON.stringify({ itemId, updates: req.body })]);

    res.json({
      success: true,
      message: 'Care plan item updated successfully',
      language
    });
  } catch (error) {
    console.error('Error updating care plan item:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete a care plan item
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id: carePlanId, itemId } = req.params;
    const { deletedBy } = req.query;

    if (!deletedBy) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'deletedBy is required'
      });
    }

    const query = `
      DELETE FROM care_plan_items
      WHERE care_plan_item_id = $1 AND care_plan_id = $2
      RETURNING care_plan_item_id
    `;

    const result = await db.query(query, [itemId, carePlanId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: getTranslation('errors.not_found', language),
        message: 'Care plan item not found'
      });
    }

    // Create audit log entry
    await db.query(`
      INSERT INTO care_plan_audit_log (care_plan_id, user_id, user_name, action, changes, version)
      SELECT $1, $2, CONCAT(s.family_name, ' ', s.given_name), 'item_deleted', $3, (SELECT version FROM care_plans WHERE care_plan_id = $1)
      FROM staff s WHERE s.staff_id = $2
    `, [carePlanId, deletedBy, JSON.stringify({ itemId })]);

    res.json({
      success: true,
      message: 'Care plan item deleted successfully',
      language
    });
  } catch (error) {
    console.error('Error deleting care plan item:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add a progress note to a care plan item
router.post('/:id/items/:itemId/notes', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { itemId } = req.params;
    const { note, authorId, authorName } = req.body;

    if (!note || !authorId || !authorName) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'note, authorId, and authorName are required'
      });
    }

    const query = `
      INSERT INTO care_plan_progress_notes (
        care_plan_item_id,
        note_date,
        note,
        author_id,
        author_name
      ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4)
      RETURNING
        progress_note_id as "id",
        note_date as "date",
        note,
        author_id as "author",
        author_name as "authorName"
    `;

    const result = await db.query(query, [itemId, note, authorId, authorName]);

    res.status(201).json({
      progressNote: result.rows[0],
      message: 'Progress note added successfully',
      language
    });
  } catch (error) {
    console.error('Error adding progress note:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create monitoring record
router.post('/:id/monitoring', async (req, res) => {
  try {
    const language = detectLanguage(req);
    const { id: carePlanId } = req.params;
    const {
      monitoringDate,
      monitoringType,
      conductedBy,
      conductedByName,
      itemReviews,
      overallStatus,
      patientFeedback,
      familyFeedback,
      staffObservations,
      proposedChanges,
      nextMonitoringDate,
      actionItems
    } = req.body;

    if (!monitoringDate || !monitoringType || !conductedBy || !overallStatus) {
      return res.status(400).json({
        error: getTranslation('errors.missing_parameter', language),
        message: 'monitoringDate, monitoringType, conductedBy, and overallStatus are required'
      });
    }

    // Insert monitoring record
    const query = `
      INSERT INTO monitoring_records (
        care_plan_id,
        monitoring_date,
        monitoring_type,
        conducted_by,
        conducted_by_name,
        item_reviews,
        overall_status,
        patient_feedback,
        family_feedback,
        staff_observations,
        proposed_changes,
        next_monitoring_date,
        action_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING
        monitoring_record_id as "id",
        care_plan_id as "carePlanId",
        monitoring_date as "monitoringDate",
        monitoring_type as "monitoringType",
        conducted_by as "conductedBy",
        conducted_by_name as "conductedByName",
        item_reviews as "itemReviews",
        overall_status as "overallStatus",
        patient_feedback as "patientFeedback",
        family_feedback as "familyFeedback",
        staff_observations as "staffObservations",
        proposed_changes as "proposedChanges",
        next_monitoring_date as "nextMonitoringDate",
        action_items as "actionItems",
        created_at as "createdAt"
    `;

    const result = await db.query(query, [
      carePlanId,
      monitoringDate,
      monitoringType,
      conductedBy,
      conductedByName,
      JSON.stringify(itemReviews),
      overallStatus,
      patientFeedback,
      familyFeedback,
      staffObservations,
      JSON.stringify(proposedChanges),
      nextMonitoringDate,
      JSON.stringify(actionItems)
    ]);

    const monitoringRecord = result.rows[0];

    // Update care plan's last and next monitoring dates
    await db.query(`
      UPDATE care_plans
      SET last_monitoring_date = $1, next_monitoring_date = $2
      WHERE care_plan_id = $3
    `, [monitoringDate, nextMonitoringDate, carePlanId]);

    // Create audit log entry
    await db.query(`
      INSERT INTO care_plan_audit_log (care_plan_id, user_id, user_name, action, changes, version)
      SELECT $1, $2, CONCAT(s.family_name, ' ', s.given_name), 'monitoring_completed', $3, (SELECT version FROM care_plans WHERE care_plan_id = $1)
      FROM staff s WHERE s.staff_id = $2
    `, [carePlanId, conductedBy, JSON.stringify({ monitoringId: monitoringRecord.id, monitoringType })]);

    res.status(201).json({
      data: monitoringRecord,
      language
    });
  } catch (error) {
    console.error('Error creating monitoring record:', error);
    res.status(500).json({
      error: getTranslation('errors.server', detectLanguage(req)),
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
