# Task 20: Care Plan Versioning - Next Steps

## ✅ Implementation Complete

All code has been written and is ready for deployment. The implementation includes:

1. **Database Migration** - Creates version history table and migrates existing data
2. **Backend API Enhancements** - Version tracking, history retrieval, and revert functionality
3. **Property-Based Tests** - 5 comprehensive tests covering all correctness properties

## 🚀 Deployment Required

Since the database is running on **verbumcare-lab.local**, you need to run the migration and tests on that server.

### Option 1: Run the Automated Script (Recommended)

```bash
# SSH to verbumcare-lab.local or run locally if you're on that machine
cd /path/to/verbumcare-demo
./kiro/specs/code-consistency-security-offline/run-task-20-on-server.sh
```

This script will:
- Run the database migration
- Verify the migration succeeded
- Run all property-based tests
- Display a summary of results

### Option 2: Run Manually

If you prefer to run each step manually:

```bash
# Step 1: Run the migration
cd backend
node src/db/run-migration.js 009_add_care_plan_versioning.sql

# Step 2: Verify migration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM care_plan_version_history;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM care_plans WHERE version IS NULL OR version = 0;"

# Step 3: Run property tests
npm test -- carePlanVersioning.property.test.js
```

## 📋 What the Migration Does

### Safe Data Preservation
- ✅ Sets all existing care plans to version 1 (if NULL or 0)
- ✅ Creates `care_plan_version_history` table
- ✅ Migrates all existing care plans to version history
- ✅ Preserves complete snapshots of care plan items
- ✅ No data loss - all operations are additive

### Database Changes
```sql
-- New table created
CREATE TABLE care_plan_version_history (
    version_history_id UUID PRIMARY KEY,
    care_plan_id UUID REFERENCES care_plans,
    version INTEGER,
    -- Complete snapshot of care plan data
    care_level, status, patient_intent, family_intent, ...
    -- JSONB snapshot of all care plan items
    care_plan_items_snapshot JSONB,
    -- Metadata
    created_at, created_by, created_by_name, change_description,
    UNIQUE(care_plan_id, version)
);
```

## 🧪 Property Tests

All 5 property tests are implemented and ready to run:

1. **Property 39**: Initial version is 1.0 (100 runs)
   - Validates: Requirements 12.1
   - Tests that all new care plans start at version 1

2. **Property 40**: Version increment on modification (50 runs)
   - Validates: Requirements 12.2
   - Tests that versions increment by exactly 1 on each update

3. **Property 41**: Version history completeness (50 runs)
   - Validates: Requirements 12.3
   - Tests that all versions are preserved in chronological order

4. **Property 42**: Revert creates new version (30 runs)
   - Validates: Requirements 12.4
   - Tests that reverting creates a new version (doesn't reuse old numbers)

5. **Property 43**: Last-write-wins conflict resolution (100 runs)
   - Validates: Requirements 12.5
   - Tests that later timestamps win in concurrent updates

## 🔍 Verification Checklist

After running the migration and tests, verify:

- [ ] Migration completed without errors
- [ ] `care_plan_version_history` table exists
- [ ] All existing care plans have `version = 1`
- [ ] Version history table contains entries for existing care plans
- [ ] All 5 property tests pass
- [ ] No data was lost (check care plan counts before/after)

## 📊 Expected Results

### Before Migration
```sql
SELECT COUNT(*) FROM care_plans;
-- Example: 150 care plans

SELECT COUNT(*) FROM care_plan_version_history;
-- 0 (table doesn't exist yet)
```

### After Migration
```sql
SELECT COUNT(*) FROM care_plans;
-- 150 (same count - no data lost)

SELECT COUNT(*) FROM care_plans WHERE version = 1;
-- 150 (all have version 1)

SELECT COUNT(*) FROM care_plan_version_history;
-- 150 (one history entry per care plan)
```

## 🎯 New API Endpoints Available

Once deployed, these endpoints will be available:

### Get Version History
```
GET /api/care-plans/:id/versions
```

### Get Specific Version
```
GET /api/care-plans/:id/versions/:version
```

### Revert to Previous Version
```
POST /api/care-plans/:id/revert/:version
Body: { revertedBy: "staff-id", changeDescription: "reason" }
```

### Update Care Plan (Enhanced)
```
PUT /api/care-plans/:id
Body: { 
  ...updates...,
  updatedBy: "staff-id",
  changeDescription: "what changed"  // Optional but recommended
}
```

## ⚠️ Important Notes

1. **No UI Changes**: This is internal versioning only. No UI changes were made.
2. **Backward Compatible**: Existing API calls continue to work unchanged.
3. **Data Safety**: Migration is idempotent - can be run multiple times safely.
4. **Transaction Safety**: All updates use database transactions for atomicity.
5. **Audit Trail**: All version changes are logged in `care_plan_audit_log`.

## 🐛 Troubleshooting

### If Migration Fails
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT version();"

# Check if table already exists
psql $DATABASE_URL -c "\d care_plan_version_history"

# If table exists, migration may have already run
# Check version history count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM care_plan_version_history;"
```

### If Tests Fail
```bash
# Check database connection in tests
cd backend
npm test -- --verbose carePlanVersioning.property.test.js

# Verify test data cleanup
psql $DATABASE_URL -c "SELECT * FROM patients WHERE mrn LIKE 'TEST-PBT%';"
```

## 📞 Need Help?

If you encounter any issues:

1. Check the implementation summary: `TASK_20_IMPLEMENTATION_SUMMARY.md`
2. Review the migration file: `backend/src/db/migrations/009_add_care_plan_versioning.sql`
3. Review the test file: `backend/src/services/__tests__/carePlanVersioning.property.test.js`
4. Check the enhanced routes: `backend/src/routes/care-plans.js`

## ✨ What's Next?

After successful deployment:

1. ✅ Mark all PBT tests as passed (if they pass)
2. ✅ Proceed to Task 21: Multi-Language Support
3. 🎉 Care plan versioning is now active!

---

**Ready to deploy?** Run the script on verbumcare-lab.local and let me know the results!
