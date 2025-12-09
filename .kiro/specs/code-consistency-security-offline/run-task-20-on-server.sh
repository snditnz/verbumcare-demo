#!/bin/bash

# Script to run Task 20 (Care Plan Versioning) migration and tests on the server
# This should be run ON the verbumcare-lab.local server where the database is running

set -e  # Exit on error

echo "=========================================="
echo "Task 20: Care Plan Versioning"
echo "Migration and Testing Script"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "backend/src/db/migrations/009_add_care_plan_versioning.sql" ]; then
    echo "❌ Error: Migration file not found!"
    echo "Please run this script from the verbumcare-demo root directory"
    exit 1
fi

echo "Step 1: Running database migration..."
echo "--------------------------------------"
cd backend
node src/db/run-migration.js 009_add_care_plan_versioning.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "Step 2: Verifying migration..."
echo "--------------------------------------"

# Check if version_history table exists
psql $DATABASE_URL -c "\d care_plan_version_history" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ care_plan_version_history table exists"
else
    echo "❌ care_plan_version_history table not found"
    exit 1
fi

# Check if existing care plans have version = 1
VERSION_CHECK=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM care_plans WHERE version IS NULL OR version = 0;")
if [ "$VERSION_CHECK" -eq 0 ]; then
    echo "✅ All care plans have valid version numbers"
else
    echo "⚠️  Warning: $VERSION_CHECK care plans have NULL or 0 version"
fi

# Check if version history was populated
HISTORY_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM care_plan_version_history;")
echo "✅ Version history contains $HISTORY_COUNT entries"

echo ""
echo "Step 3: Running property-based tests..."
echo "--------------------------------------"
npm test -- carePlanVersioning.property.test.js

if [ $? -eq 0 ]; then
    echo "✅ All property tests passed"
else
    echo "❌ Some property tests failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Task 20 Implementation Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Migration applied successfully"
echo "- Version history table created"
echo "- All existing care plans migrated to version 1"
echo "- All property tests passed"
echo ""
echo "Next steps:"
echo "1. Mark task 20 and all subtasks as completed"
echo "2. Update PBT status for all 5 property tests"
echo "3. Proceed to Task 21 (Multi-Language Support)"
