# Offline-First Data Strategy

**Goal**: Ensure ALL data is available offline while server remains source of truth

**Last Updated**: 2025-10-21

---

## Problem Statement

The iPad app needs to function completely offline during demos, but:
- Server is out of range during demo presentations
- Data (patients, care plans, assessments) lives on the server
- App currently uses cache-first strategy but may not have all data
- Need to ensure complete dataset is available offline

---

## Architecture: Server as Source of Truth + Offline-First Client

### Principles

1. **Server is Single Source of Truth**
   - All data originates and is authoritative on the server
   - Server database is the canonical data store

2. **Client is Offline-Capable**
   - Full dataset prefetched and cached on device
   - Client can operate indefinitely without network
   - Changes queue locally and sync when network available

3. **Sync on Connect**
   - When network is available: pull latest data, push pending changes
   - When network unavailable: operate entirely from cache
   - Conflict resolution favors server data (demo context)

---

## Implementation Strategy

### Phase 1: Data Prefetch/Warm Cache (IMMEDIATE - For Demo)

**Goal**: Download entire dataset before going offline

#### 1.1 Prefetch API Endpoint
```typescript
// Backend: GET /api/prefetch/all
{
  patients: Patient[],
  carePlans: CarePlan[],
  medications: Medication[],
  vitalSigns: VitalSign[],
  problemTemplates: ProblemTemplate[],
  staff: Staff[],
  timestamp: ISO8601
}
```

#### 1.2 Cache Warming Function
```typescript
// ipad-app/src/services/cacheWarmer.ts
export async function warmAllCaches() {
  try {
    // 1. Fetch complete dataset
    const data = await apiService.get('/prefetch/all');

    // 2. Store in AsyncStorage
    await AsyncStorage.multiSet([
      ['@cache_patients', JSON.stringify(data.patients)],
      ['@cache_carePlans', JSON.stringify(data.carePlans)],
      ['@cache_medications', JSON.stringify(data.medications)],
      ['@cache_vitals', JSON.stringify(data.vitalSigns)],
      ['@cache_templates', JSON.stringify(data.problemTemplates)],
      ['@cache_staff', JSON.stringify(data.staff)],
      ['@cache_timestamp', data.timestamp],
    ]);

    // 3. Populate Zustand stores
    usePatientStore.getState().setPatients(data.patients);
    useCarePlanStore.getState().loadFromCache(data.carePlans);
    // ... etc

    return { success: true, recordCount: data.patients.length };
  } catch (error) {
    console.error('Cache warming failed:', error);
    return { success: false, error };
  }
}
```

#### 1.3 UI: Pre-Demo Checklist
```typescript
// DashboardScreen or SettingsScreen
<Card>
  <Text>Demo Preparation</Text>
  <Button onPress={warmAllCaches}>
    Download All Data for Offline Use
  </Button>
  <Text>Last synced: {lastSyncTime}</Text>
  <Text>Cached records: {cachedRecordCount}</Text>
</Card>
```

**When to trigger**:
- Manual button in Dashboard/Settings
- Automatic on login when network available
- Before demo (checklist item)

---

### Phase 2: Offline-First API Service (CURRENT ARCHITECTURE)

**Already implemented** via `apiService.ts` with cache-first strategy:

```typescript
// Current implementation
export const apiService = {
  async getPatients(useCache = true) {
    if (useCache) {
      const cached = await AsyncStorage.getItem('@cache_patients');
      if (cached) return JSON.parse(cached);
    }
    // Fall back to network...
  }
}
```

**Enhancement needed**: Ensure cache is ALWAYS populated before demo

---

### Phase 3: Write Queue for Offline Changes (FUTURE)

**Goal**: Allow creating/editing data offline, sync when online

#### 3.1 Pending Changes Queue
```typescript
// Store offline changes
interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'carePlan' | 'vital' | 'assessment';
  data: any;
  timestamp: ISO8601;
  synced: boolean;
}

// Queue in AsyncStorage
const pendingChanges: PendingChange[] = [];
```

#### 3.2 Sync Engine
```typescript
async function syncPendingChanges() {
  const pending = await getPendingChanges();

  for (const change of pending) {
    try {
      switch (change.type) {
        case 'create':
          await apiService.post(`/api/${change.entity}`, change.data);
          break;
        case 'update':
          await apiService.put(`/api/${change.entity}/${change.data.id}`, change.data);
          break;
        case 'delete':
          await apiService.delete(`/api/${change.entity}/${change.data.id}`);
          break;
      }
      markAsSynced(change.id);
    } catch (error) {
      console.error('Sync failed for', change.id, error);
      // Leave in queue for retry
    }
  }
}
```

#### 3.3 Network Detection
```typescript
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  if (state.isConnected) {
    syncPendingChanges();
    warmAllCaches(); // Pull latest data
  }
});
```

---

### Phase 4: Conflict Resolution (FUTURE)

**Strategy for Demo Context**: Server Wins

Since this is a demo with controlled data:
- Server data is authoritative
- Client changes are best-effort
- On conflict: discard client change, use server data
- Log conflicts for review

**Production Strategy** (if needed later):
- Last-write-wins with timestamps
- Field-level merging
- Manual conflict resolution UI

---

## Pre-Demo Workflow

### Developer Checklist (Before Demo)

1. **Ensure Server is Running**
   ```bash
   docker-compose up -d
   # Verify: curl http://localhost:3000/health
   ```

2. **Populate Server with Demo Data**
   ```bash
   npm run seed  # or manual SQL inserts
   # Ensure: patients, care plans, medications, vitals, etc.
   ```

3. **Connect iPad to Same Network as Server**
   - Both on same WiFi
   - Test: Open browser on iPad, visit http://server-ip:3000/health

4. **Warm Cache on iPad**
   - Open app
   - Go to Dashboard → Settings (or Pre-Demo Checklist)
   - Tap "Download All Data for Offline Use"
   - Wait for success message
   - Verify record counts

5. **Disconnect from Network**
   - Turn off WiFi on iPad (or disconnect server)
   - Verify app still works with all data

6. **Demo Ready!**

---

## Implementation Priority

### Immediate (For Next Demo)

- [x] Review current cache strategy (already exists)
- [ ] Create `/api/prefetch/all` endpoint on backend
- [ ] Implement `warmAllCaches()` function in app
- [ ] Add "Download Offline Data" button to Dashboard
- [ ] Add cache status indicator (last sync time, record count)
- [ ] Document pre-demo workflow
- [ ] Test full offline operation

### Short-term (Next Week)

- [ ] Automatic cache warming on login
- [ ] Cache expiration (refresh if > 24 hours old)
- [ ] Background sync when network detected
- [ ] Better error handling for cache misses

### Long-term (Future)

- [ ] Implement write queue for offline changes
- [ ] Network detection and auto-sync
- [ ] Conflict resolution
- [ ] Cache size management
- [ ] Incremental sync (only changed records)

---

## Technical Details

### Cache Storage

**AsyncStorage Keys**:
- `@cache_patients` - All patient records
- `@cache_carePlans` - All care plans with items
- `@cache_medications` - Medication orders
- `@cache_vitals` - Vital signs history
- `@cache_templates` - Problem templates (for translations)
- `@cache_staff` - Staff members
- `@cache_timestamp` - Last sync timestamp
- `@cache_version` - Schema version (for migrations)

**Size Estimates**:
- 50 patients: ~50KB
- 50 care plans (with items): ~200KB
- 500 vital signs: ~100KB
- Problem templates: ~50KB
- **Total**: ~500KB (well within AsyncStorage limits)

### API Service Updates

```typescript
// ipad-app/src/services/api.ts

export const apiService = {
  // Existing cache-first methods
  async getPatients(useCache = true) { /* ... */ },

  // NEW: Prefetch all data
  async prefetchAllData() {
    const response = await fetch(`${API_BASE_URL}/prefetch/all`);
    const data = await response.json();

    // Store in AsyncStorage
    await Promise.all([
      AsyncStorage.setItem('@cache_patients', JSON.stringify(data.patients)),
      AsyncStorage.setItem('@cache_carePlans', JSON.stringify(data.carePlans)),
      // ... etc
    ]);

    return data;
  },

  // NEW: Get cache status
  async getCacheStatus() {
    const timestamp = await AsyncStorage.getItem('@cache_timestamp');
    const patients = await AsyncStorage.getItem('@cache_patients');

    return {
      lastSync: timestamp ? new Date(timestamp) : null,
      recordCount: patients ? JSON.parse(patients).length : 0,
      isCached: !!timestamp,
    };
  },
};
```

---

## Testing Strategy

### Offline Testing Checklist

1. **With Network**:
   - [ ] Login successful
   - [ ] Dashboard loads
   - [ ] Patient list loads from cache
   - [ ] Can trigger cache warming
   - [ ] Cache status shows correct info

2. **Warm Cache**:
   - [ ] Tap "Download Offline Data"
   - [ ] Success message appears
   - [ ] Record count updates
   - [ ] Timestamp updates

3. **Without Network** (Airplane mode):
   - [ ] App launches without crash
   - [ ] Login works (cached credentials)
   - [ ] Dashboard shows all data
   - [ ] Patient list complete
   - [ ] Care plans viewable
   - [ ] Assessments work
   - [ ] Monitoring screens work

4. **Return Online**:
   - [ ] Background sync triggers (future)
   - [ ] Cache refreshes automatically (future)

---

## Backend Changes Needed

### 1. Prefetch Endpoint

**File**: `backend/src/routes/prefetch.js` (new)

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

router.get('/all', async (req, res) => {
  try {
    // Fetch all tables needed for offline operation
    const [patients, carePlans, medications, vitals, templates, staff] =
      await Promise.all([
        pool.query('SELECT * FROM patients ORDER BY family_name'),
        pool.query(`
          SELECT cp.*,
                 json_agg(cpi.*) as care_plan_items
          FROM care_plans cp
          LEFT JOIN care_plan_items cpi ON cp.id = cpi.care_plan_id
          GROUP BY cp.id
        `),
        pool.query('SELECT * FROM medication_orders WHERE status = $1', ['active']),
        pool.query('SELECT * FROM vital_signs WHERE recorded_at > NOW() - INTERVAL \'30 days\''),
        pool.query('SELECT * FROM problem_templates'),
        pool.query('SELECT * FROM staff WHERE active = true'),
      ]);

    res.json({
      patients: patients.rows,
      carePlans: carePlans.rows,
      medications: medications.rows,
      vitalSigns: vitals.rows,
      problemTemplates: templates.rows,
      staff: staff.rows,
      timestamp: new Date().toISOString(),
      recordCount: patients.rows.length,
    });
  } catch (error) {
    console.error('Prefetch error:', error);
    res.status(500).json({ error: 'Failed to prefetch data' });
  }
});

module.exports = router;
```

**Add to** `backend/src/app.js`:
```javascript
const prefetchRoutes = require('./routes/prefetch');
app.use('/api/prefetch', prefetchRoutes);
```

---

## Success Criteria

### Demo-Ready Definition

- [ ] iPad can operate for 2+ hours completely offline
- [ ] All patient data visible (50 patients)
- [ ] All care plans accessible
- [ ] Assessments can be performed (with mock data)
- [ ] No network errors or loading spinners
- [ ] Cache status visible to user
- [ ] One-button cache warming works

---

## Future Enhancements

### 1. Selective Sync
Only sync changed records (delta sync) using timestamps

### 2. Image Caching
Cache patient photos, facility images, logos

### 3. Voice Recording Offline
Store recordings locally, process when online

### 4. Multi-Device Sync
Sync data across multiple iPads

### 5. Backup/Restore
Export cached data, restore on new device

---

## Related Documentation

- `ipad-app/src/services/api.ts` - Current API service
- `backend/src/routes/` - API endpoints
- `.claude/session_memory.md` - Architecture notes
- `CURRENT_WORK.md` - Active development

---

**Next Action**: Implement Phase 1 (Prefetch endpoint + cache warming) before next demo
