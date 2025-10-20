# Testing Database Updates - Care Plan Monitoring

This guide shows you how to verify that the iPad app is actually updating the PostgreSQL database.

## Prerequisites

Make sure the backend and database are running:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# OR
pg_isready -h localhost -p 5432

# Check if backend is running
curl http://localhost:3000/health
```

---

## Method 1: Real-time PostgreSQL Monitoring (Best for Development)

### Watch Database Changes Live

Open a terminal and connect to PostgreSQL:

```bash
psql postgres://demo:demo123@localhost:5432/verbumcare_demo
```

Then run this query to see the most recent updates:

```sql
-- See recently updated care plan items
SELECT
  care_plan_item_id,
  problem_description,
  long_term_goal_achievement_status as lt_goal,
  short_term_goal_achievement_status as st_goal,
  last_updated,
  updated_by
FROM care_plan_items
ORDER BY last_updated DESC
LIMIT 10;
```

**Before testing**: Note the `last_updated` timestamps

**After using the iPad app**: Run the query again and compare timestamps

### Check Specific Patient's Care Plan

```sql
-- Replace 'P-001' with your patient ID
SELECT
  cpi.care_plan_item_id,
  cpi.problem_description,
  cpi.long_term_goal_achievement_status,
  cpi.short_term_goal_achievement_status,
  cpi.last_updated,
  cpi.updated_by,
  cp.patient_id
FROM care_plan_items cpi
JOIN care_plans cp ON cpi.care_plan_id = cp.care_plan_id
WHERE cp.patient_id = 'P-001'
ORDER BY cpi.last_updated DESC;
```

### Check Progress Notes

```sql
-- See recent progress notes added
SELECT
  pn.progress_note_id,
  pn.care_plan_item_id,
  pn.note,
  pn.author_name,
  pn.created_at
FROM progress_notes pn
ORDER BY pn.created_at DESC
LIMIT 10;
```

### Check Monitoring Records

```sql
-- See monitoring records (formal reviews)
SELECT
  monitoring_record_id,
  care_plan_id,
  monitoring_type,
  monitoring_date,
  overall_status,
  conducted_by_name
FROM monitoring_records
ORDER BY monitoring_date DESC
LIMIT 5;
```

### Continuous Monitoring (Auto-refresh every 2 seconds)

```bash
# Run this in a separate terminal
watch -n 2 'psql postgres://demo:demo123@localhost:5432/verbumcare_demo -c "SELECT care_plan_item_id, problem_description, short_term_goal_achievement_status, last_updated FROM care_plan_items ORDER BY last_updated DESC LIMIT 5;"'
```

---

## Method 2: Backend API Logs

### Watch API Requests

```bash
# If backend is in Docker
docker logs -f verbumcare-backend 2>&1 | grep -E "(PUT|POST|care-plan)"

# If running locally
cd backend
npm run dev
# Watch the console output for PUT/POST requests
```

You should see log entries like:
```
PUT /api/care-plans/:id/items/:itemId
POST /api/care-plans/:id/monitoring
```

### Add Detailed Logging

Edit `backend/src/routes/care-plans.js` and add console.log statements:

```javascript
router.put('/:id/items/:itemId', async (req, res) => {
  console.log('🔄 UPDATE CARE PLAN ITEM:', {
    carePlanId: req.params.id,
    itemId: req.params.itemId,
    updates: req.body,
    timestamp: new Date().toISOString()
  });

  // ... rest of the code
});
```

---

## Method 3: API Testing with curl

### Test the PUT endpoint manually

```bash
# Get a care plan first
curl http://localhost:3000/api/care-plans?patient_id=P-001 | jq

# Update a care plan item
curl -X PUT http://localhost:3000/api/care-plans/cp-001/items/cpi-001 \
  -H "Content-Type: application/json" \
  -d '{
    "longTermGoal": {
      "achievementStatus": 75
    },
    "shortTermGoal": {
      "achievementStatus": 80
    }
  }'

# Verify the update
curl http://localhost:3000/api/care-plans?patient_id=P-001 | jq '.carePlanItems[] | select(.id == "cpi-001")'
```

---

## Method 4: Database Diff Snapshot

### Before Testing

```bash
# Save current state
psql postgres://demo:demo123@localhost:5432/verbumcare_demo -c \
  "COPY (SELECT * FROM care_plan_items ORDER BY care_plan_item_id) TO '/tmp/before.csv' CSV HEADER;"
```

### After Testing

```bash
# Save new state
psql postgres://demo:demo123@localhost:5432/verbumcare_demo -c \
  "COPY (SELECT * FROM care_plan_items ORDER BY care_plan_item_id) TO '/tmp/after.csv' CSV HEADER;"

# Compare
diff /tmp/before.csv /tmp/after.csv
```

---

## Method 5: Network Traffic Inspection

### Monitor HTTP Requests from iPad

```bash
# Install mitmproxy if needed: brew install mitmproxy

# Start proxy
mitmproxy -p 8080

# Configure iPad to use proxy:
# Settings → Wi-Fi → (your network) → Configure Proxy → Manual
# Server: [Your Mac IP]
# Port: 8080

# Watch requests in mitmproxy interface
# Look for: PUT /api/care-plans/:id/items/:itemId
```

---

## Testing Checklist

### QuickProgressUpdate Testing

1. ✅ Open iPad app
2. ✅ Select a patient with a care plan
3. ✅ Navigate to Care Plan Hub → Quick Progress
4. ✅ Select a care plan item
5. ✅ Adjust sliders (e.g., change 40% → 55%)
6. ✅ Add a progress note
7. ✅ Click "Save Progress"
8. ✅ **Verify in database**:
   ```sql
   SELECT
     problem_description,
     long_term_goal_achievement_status,
     short_term_goal_achievement_status,
     last_updated
   FROM care_plan_items
   WHERE care_plan_item_id = 'cpi-001';
   ```
9. ✅ Check `last_updated` timestamp changed
10. ✅ Check progress note was added:
    ```sql
    SELECT * FROM progress_notes
    WHERE care_plan_item_id = 'cpi-001'
    ORDER BY created_at DESC LIMIT 1;
    ```

### MonitoringForm Testing

1. ✅ Navigate to Care Plan Hub → Monitoring
2. ✅ Select monitoring type (e.g., "3-Month Routine")
3. ✅ Review each care plan item
4. ✅ Adjust goal progress
5. ✅ Rate intervention effectiveness
6. ✅ Add comments
7. ✅ Fill overall assessment
8. ✅ Submit
9. ✅ **Verify in database**:
   ```sql
   -- Check monitoring record was created
   SELECT * FROM monitoring_records
   ORDER BY monitoring_date DESC LIMIT 1;

   -- Check all items were updated
   SELECT
     care_plan_item_id,
     long_term_goal_achievement_status,
     short_term_goal_achievement_status,
     last_updated
   FROM care_plan_items
   WHERE care_plan_id = 'cp-001'
   ORDER BY last_updated DESC;
   ```

---

## Common Issues

### Issue: Data not updating

**Check 1**: Is the backend receiving requests?
```bash
docker logs verbumcare-backend | tail -20
```

**Check 2**: Is the iPad app calling the correct endpoint?
- Check network tab in backend logs
- Verify API URL in iPad app config

**Check 3**: Is there a database connection issue?
```bash
psql postgres://demo:demo123@localhost:5432/verbumcare_demo -c "SELECT NOW();"
```

### Issue: Offline mode

The iPad app uses **offline-first caching**. If the backend is down:
- Updates are saved locally (AsyncStorage/cache)
- Database won't update until backend is available
- Check `cacheService` in iPad app for pending syncs

### Issue: Wrong patient ID

```sql
-- List all patients with care plans
SELECT
  p.patient_id,
  p.family_name,
  p.given_name,
  cp.care_plan_id
FROM patients p
LEFT JOIN care_plans cp ON p.patient_id = cp.patient_id;
```

---

## Quick Test Script

Save this as `test-care-plan-update.sh`:

```bash
#!/bin/bash

echo "📊 Care Plan Database State BEFORE update"
psql postgres://demo:demo123@localhost:5432/verbumcare_demo -c \
  "SELECT problem_description, short_term_goal_achievement_status as progress, last_updated FROM care_plan_items LIMIT 3;"

echo ""
echo "⏸  Now make changes in the iPad app..."
echo "Press ENTER when done"
read

echo ""
echo "📊 Care Plan Database State AFTER update"
psql postgres://demo:demo123@localhost:5432/verbumcare_demo -c \
  "SELECT problem_description, short_term_goal_achievement_status as progress, last_updated FROM care_plan_items LIMIT 3;"
```

Run it:
```bash
chmod +x test-care-plan-update.sh
./test-care-plan-update.sh
```

---

## Expected Database Schema

For reference, the key tables involved:

```sql
-- Care plans
care_plans (
  care_plan_id,
  patient_id,
  care_level,
  status,
  last_monitoring_date,
  next_monitoring_date,
  ...
)

-- Care plan items (problems/goals/interventions)
care_plan_items (
  care_plan_item_id,
  care_plan_id,
  problem_description,
  long_term_goal_achievement_status,
  short_term_goal_achievement_status,
  last_updated,
  updated_by,
  ...
)

-- Progress notes
progress_notes (
  progress_note_id,
  care_plan_item_id,
  note,
  author_name,
  created_at,
  ...
)

-- Monitoring records
monitoring_records (
  monitoring_record_id,
  care_plan_id,
  monitoring_type,
  monitoring_date,
  overall_status,
  ...
)
```

---

## Success Criteria

✅ **QuickProgressUpdate works if**:
- `last_updated` timestamp changes in `care_plan_items`
- Achievement status values change (0-100)
- New row appears in `progress_notes` (if note was added)

✅ **MonitoringForm works if**:
- New row appears in `monitoring_records`
- All care plan items have updated `last_updated`
- `last_monitoring_date` updates in `care_plans`
- `next_monitoring_date` is set to 3 months ahead

---

**Pro Tip**: Keep a `psql` session open in a separate terminal window while testing. Run queries repeatedly to watch real-time changes!
