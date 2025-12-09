-- Migration 009: Add Care Plan Versioning Support
-- This migration adds version history tracking and ensures all existing care plans have version 1.0

-- Step 1: Ensure all existing care plans have version set to 1 (if NULL)
UPDATE care_plans
SET version = 1
WHERE version IS NULL OR version = 0;

-- Step 2: Create care plan version history table
CREATE TABLE IF NOT EXISTS care_plan_version_history (
    version_history_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    care_plan_id UUID NOT NULL REFERENCES care_plans(care_plan_id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Snapshot of care plan data at this version
    care_level VARCHAR(20),
    status VARCHAR(20),
    patient_intent TEXT,
    family_intent TEXT,
    comprehensive_policy TEXT,
    care_manager_id UUID REFERENCES staff(staff_id),
    team_members JSONB,
    family_signature JSONB,
    last_review_date TIMESTAMP,
    next_review_date TIMESTAMP,
    next_monitoring_date TIMESTAMP,
    
    -- Snapshot of care plan items at this version
    care_plan_items_snapshot JSONB,
    
    -- Version metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES staff(staff_id),
    created_by_name VARCHAR(200),
    change_description TEXT,
    
    -- Ensure unique version per care plan
    UNIQUE(care_plan_id, version)
);

-- Step 3: Create index for efficient version history queries
CREATE INDEX IF NOT EXISTS idx_care_plan_version_history_care_plan_id 
ON care_plan_version_history(care_plan_id);

CREATE INDEX IF NOT EXISTS idx_care_plan_version_history_version 
ON care_plan_version_history(care_plan_id, version DESC);

-- Step 4: Create initial version history entries for all existing care plans
-- This preserves the current state as version 1.0
INSERT INTO care_plan_version_history (
    care_plan_id,
    version,
    care_level,
    status,
    patient_intent,
    family_intent,
    comprehensive_policy,
    care_manager_id,
    team_members,
    family_signature,
    last_review_date,
    next_review_date,
    next_monitoring_date,
    care_plan_items_snapshot,
    created_at,
    created_by,
    created_by_name,
    change_description
)
SELECT
    cp.care_plan_id,
    cp.version,
    cp.care_level,
    cp.status,
    cp.patient_intent,
    cp.family_intent,
    cp.comprehensive_policy,
    cp.care_manager_id,
    cp.team_members,
    cp.family_signature,
    cp.last_review_date,
    cp.next_review_date,
    cp.next_monitoring_date,
    -- Snapshot of care plan items
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', cpi.care_plan_item_id,
                'problemCategory', cpi.problem_category,
                'problemDescription', cpi.problem_description,
                'problemPriority', cpi.problem_priority,
                'identifiedDate', cpi.identified_date,
                'problemStatus', cpi.problem_status,
                'longTermGoalDescription', cpi.long_term_goal_description,
                'longTermGoalTargetDate', cpi.long_term_goal_target_date,
                'longTermGoalDuration', cpi.long_term_goal_duration,
                'longTermGoalAchievementStatus', cpi.long_term_goal_achievement_status,
                'shortTermGoalDescription', cpi.short_term_goal_description,
                'shortTermGoalTargetDate', cpi.short_term_goal_target_date,
                'shortTermGoalDuration', cpi.short_term_goal_duration,
                'shortTermGoalAchievementStatus', cpi.short_term_goal_achievement_status,
                'shortTermGoalMeasurableCriteria', cpi.short_term_goal_measurable_criteria,
                'interventions', cpi.interventions,
                'linkedAssessments', cpi.linked_assessments
            )
        )
        FROM care_plan_items cpi
        WHERE cpi.care_plan_id = cp.care_plan_id
    ),
    cp.created_at,
    cp.created_by,
    (SELECT CONCAT(s.family_name, ' ', s.given_name) FROM staff s WHERE s.staff_id = cp.created_by),
    'Initial version (migrated from existing care plan)'
FROM care_plans cp
WHERE NOT EXISTS (
    SELECT 1 FROM care_plan_version_history vh
    WHERE vh.care_plan_id = cp.care_plan_id AND vh.version = cp.version
);

-- Step 5: Add comment to document the migration
COMMENT ON TABLE care_plan_version_history IS 'Stores complete version history of care plans for audit trail and revert functionality';
COMMENT ON COLUMN care_plan_version_history.care_plan_items_snapshot IS 'JSONB snapshot of all care plan items at this version';
COMMENT ON COLUMN care_plan_version_history.version IS 'Version number, increments with each modification';
