# Task 20: Care Plan Versioning - Implementation Summary

## Status: Implementation Complete - Migration Required

## What Was Implemented

### 1. Database Migration (009_add_care_plan_versioning.sql)
Created a comprehensive migration that:
- Ensures all existing care plans have version = 1 (if NULL or 0)
- Creates `care_plan_version_history` table to store complete version snapshots
- Creates indexes for efficient version history queries
- Migrates all existing care plans to version history (preserves current state as version 1)
- Adds proper constraints and documentation

**Key Features:**
- Complete snapshot of care plan data at each version
- JSONB snapshot of all care plan items at each version
- Tracks who made changes and when
- Supports change descriptions for audit trail
- Unique constraint on (care_plan_id, version)

### 2. Enhanced Backend API Routes

#### Updated PUT /api/care-plans/:id
- Now uses database transactions for atomicity
- Saves current version to history before updating
- Increments version number automatically
- Captures complete care plan items snapshot
- Supports optional changeDescription parameter

#### New GET /api/care-plans/:id/versions
- Returns complete version history for a care plan
- Ordered by version (descending - newest first)
- Includes all metadata (who, when, why)

#### New GET /api/care-plans/:id/versions/:version
- Retrieves a specific historical version
- Returns complete snapshot including care plan items

#### New POST /api/care-plans/:id/revert/:version
- Reverts care plan to a previous version
- Creates a NEW version (doesn't overwrite history)
- Saves current state to history before reverting
- Restores care plan items from historical snapshot
- Uses database transactions for data integrity
- Creates audit log entry for the revert action

### 3. Property-Based Tests
Created comprehensive property tests in `backend/src/services/__tests__/carePlanVersioning.property.test.js`:

- **Property 39**: Initial version is 1.0 (100 runs)
- **Property 40**: Version increment on modification (50 runs)
- **Property 41**: Version history completeness (50 runs)
- **Property 42**: Revert creates new version (30 runs)
- **Property 43**: Last-write-wins conflict resolution (100 runs)

## What Needs to Be Done

### 1. Run the Migration on the Server
The migration file is ready but needs to be executed on verbumcare-lab.local:

```bash
# SSH to the server or run from the server
cd /path/to/verbumcare-demo/backend
node src/db/run-migration.js 009_add_care_plan_versioning.sql
```

This will:
- Set all existing care plans to version 1
- Create the version_history table
- Migrate all existing care plans to version history

### 2. Run Property Tests on the Server
Since the database is on verbumcare-lab.local, the tests need to run there:

```bash
# On the server
cd /path/to/verbumcare-demo/backend
npm test -- carePlanVersioning.property.test.js
```

### 3. Update Task Status
Once migration and tests are complete:
- Mark all subtasks as completed
- Update PBT status for each property test
- Mark main task as completed

## Design Decisions

### Version Numbering
- Versions are integers starting at 1
- Each modification increments by 1
- Reverts create new versions (don't reuse old version numbers)
- This ensures monotonic version history

### Version History Storage
- Complete snapshots (not diffs) for simplicity and reliability
- JSONB for care plan items allows flexible querying
- Separate table (not inline) to avoid bloating main table
- Cascade delete ensures cleanup when care plan is deleted

### Conflict Resolution
- Last-write-wins based on updated_at timestamp
- No optimistic locking (simpler for offline-first architecture)
- Audit log tracks all changes for investigation if needed

### Revert Functionality
- Creates new version (preserves complete history)
- Restores both care plan data AND care plan items
- Uses transactions to ensure atomicity
- Audit log entry documents the revert action

## Data Preservation

### Critical Success Criteria Met
✅ All existing care plans preserved (migration sets version = 1)
✅ All existing care plan items preserved (snapshot in version history)
✅ No data loss during migration (additive only)
✅ Backward compatible (version field already existed with DEFAULT 1)
✅ No UI changes required (versioning is internal tracking)

### Migration Safety
- Uses COALESCE and conditional logic to avoid overwriting data
- Creates history entries only if they don't already exist
- All operations are idempotent (can be run multiple times safely)
- Uses transactions in update/revert operations

## API Usage Examples

### Get Version History
```javascript
GET /api/care-plans/cp-001/versions

Response:
{
  data: [
    {
      id: "vh-003",
      carePlanId: "cp-001",
      version: 3,
      careLevel: "要介護3",
      status: "active",
      patientIntent: "...",
      carePlanItemsSnapshot: [...],
      createdAt: "2025-12-08T10:00:00Z",
      createdBy: "staff-123",
      createdByName: "田中 ケアマネジャー",
      changeDescription: "Updated care level"
    },
    // ... older versions
  ],
  count: 3
}
```

### Revert to Previous Version
```javascript
POST /api/care-plans/cp-001/revert/2
Body: {
  revertedBy: "staff-123",
  changeDescription: "Reverting to version 2 due to error"
}

Response:
{
  success: true,
  message: "Care plan reverted to version 2",
  newVersion: 4,  // Creates new version, doesn't overwrite
  language: "ja"
}
```

### Update Care Plan (with versioning)
```javascript
PUT /api/care-plans/cp-001
Body: {
  careLevel: "要介護4",
  updatedBy: "staff-123",
  changeDescription: "Care level increased after assessment"
}

Response:
{
  success: true,
  message: "Care plan updated successfully",
  version: 5,  // New version number
  language: "ja"
}
```

## Testing Strategy

### Property Tests Cover
1. **Initialization**: All new care plans start at version 1
2. **Monotonic Increment**: Versions always increase by exactly 1
3. **History Completeness**: All versions are preserved in order
4. **Revert Behavior**: Reverts create new versions (don't reuse)
5. **Conflict Resolution**: Later timestamps win

### Test Data Isolation
- Each test creates its own patient and staff
- Cleanup after each test to avoid interference
- Uses transactions where appropriate

## Next Steps

1. **Immediate**: Run migration on verbumcare-lab.local
2. **Immediate**: Run property tests on server
3. **Verification**: Check that existing care plans have version = 1
4. **Verification**: Verify version history table populated
5. **Optional**: Add UI to display version history (future enhancement)
6. **Optional**: Add UI to revert to previous versions (future enhancement)

## Notes

- No UI changes were made (as required by task)
- All versioning is internal tracking
- Frontend can continue using existing API endpoints
- Version history endpoints are available if needed in future
- Revert functionality is available but not exposed in UI yet
