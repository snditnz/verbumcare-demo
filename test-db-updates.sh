#!/bin/bash

# Database credentials (Nagare setup)
DB_USER="nagare"
DB_NAME="nagare_db"
CONTAINER="nagare-postgres"

echo "═══════════════════════════════════════════════════════"
echo "📊 Care Plan Database Monitor"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check if database is running
if ! docker ps | grep -q "$CONTAINER"; then
    echo "❌ Error: PostgreSQL container '$CONTAINER' is not running"
    echo "Start it with: docker-compose up -d"
    exit 1
fi

echo "✅ Database is running"
echo ""

# Function to run query
run_query() {
    docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "$1"
}

# Show current state
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 CURRENT STATE - Care Plan Items"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_query "
SELECT
  care_plan_item_id,
  LEFT(problem_description, 40) as problem,
  long_term_goal_achievement_status as lt_goal,
  short_term_goal_achievement_status as st_goal,
  last_updated
FROM care_plan_items
ORDER BY last_updated DESC
LIMIT 5;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Recent Progress Notes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_query "
SELECT
  progress_note_id,
  LEFT(note, 50) as note,
  author_name,
  created_at
FROM care_plan_progress_notes
ORDER BY created_at DESC
LIMIT 3;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Monitoring Records"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_query "
SELECT
  monitoring_record_id,
  monitoring_type,
  monitoring_date,
  LEFT(conducted_by_name, 20) as conducted_by
FROM monitoring_records
ORDER BY monitoring_date DESC
LIMIT 3;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👥 Patients in Database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_query "
SELECT
  LEFT(patient_id::text, 15) as patient_id,
  family_name,
  given_name,
  room
FROM patients
ORDER BY room;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 Statistics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_query "
SELECT
  (SELECT COUNT(*) FROM patients) as total_patients,
  (SELECT COUNT(*) FROM care_plans) as total_care_plans,
  (SELECT COUNT(*) FROM care_plan_items) as total_items,
  (SELECT COUNT(*) FROM care_plan_progress_notes) as total_notes,
  (SELECT COUNT(*) FROM monitoring_records) as total_monitoring_records;
"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "💡 Tip: Run this script before and after testing to see changes"
echo "   Example: ./test-db-updates.sh > before.txt"
echo "           (make changes in iPad app)"
echo "           ./test-db-updates.sh > after.txt"
echo "           diff before.txt after.txt"
echo ""
