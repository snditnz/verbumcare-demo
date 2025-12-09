# Offline-First Development Guide

## Overview

VerbumCare implements an offline-first architecture that enables full application functionality without network connectivity. This guide explains the patterns, services, and best practices for developing offline-capable features.

## Core Principles

### 1. Cache-First Data Access

Always check the local cache before making network requests:

```typescript
async getPatients(useCache: boolean = true): Promise<Patient[]> {
  // 1. Try cache first
  if (useCache) {
    const cached = await cacheService.getCachedPatients();
    if (cached) {
      // 2. Background refresh (silent fail if offline)
      this.client.get('/patients')
        .then(response => cacheService.cachePatients(response.data.data))
        .catch(error => console.log('Background refresh failed (offline?)'));
      
      return cached;
    }
  }

  // 3. No cache - fetch from API and cache result
  const response = await this.client.get('/patients');
  const patients = response.data.data;
  await cacheService.cachePatients(patients);
  return patients;
}
```

### 2. Optimistic Updates

Update the UI immediately, sync in the background:

```typescript
async updateCarePlan(carePlanId: string, updates: Partial<CarePlan>): Promise<void> {
  // 1. Update local state immediately
  set(state => ({
    carePlans: state.carePlans.map(cp => 
      cp.id === carePlanId ? { ...cp, ...updates } : cp
    )
  }));

  // 2. Update cache
  await cacheService.cacheCarePlan({ ...carePlan, ...updates });

  // 3. Sync to backend (queue if offline)
  try {
    await apiService.updateCarePlan(carePlanId, updates);
  } catch (error) {
    if (networkService.isConnected()) {
      // Real error - revert changes
      await this.fetchCarePlans();
    } else {
      // Offline - queue for sync
      await cacheService.addPendingSync('updateCarePlan', {
        carePlanId,
        updates
      });
    }
  }
}
```

### 3. Pending Sync Queue

Queue operations when offline, sync when connectivity is restored:

```typescript
// Add to pending sync queue
await cacheService.addPendingSync('createClinicalNote', {
  patientId: 'patient-123',
  noteData: { /* ... */ }
});

// Process pending sync queue (called on reconnection)
async function processPendingSync(): Promise<void> {
  const pending = await cacheService.getPendingSync();
  
  for (const item of pending) {
    try {
      switch (item.type) {
        case 'createClinicalNote':
          await apiService.createClinicalNote(item.data.noteData);
          break;
        case 'updateCarePlan':
          await apiService.updateCarePlan(item.data.carePlanId, item.data.updates);
          break;
        // ... other operations
      }
    } catch (error) {
      console.error(`Failed to sync ${item.type}:`, error);
      // Keep in queue for retry
      continue;
    }
  }
  
  // Clear successfully synced items
  await cacheService.clearPendingSync();
}
```

## Services

### SecureCache

Encrypted storage for user-scoped data:

```typescript
import { SecureCache } from '@services/secureCache';

// Create user-scoped cache
const cache = new SecureCache(userId);

// Store data (automatically encrypted)
await cache.set('patients', patientsArray);

// Retrieve data (automatically decrypted)
const patients = await cache.get<Patient[]>('patients');

// Store multiple items
await cache.setMultiple([
  ['patients', patientsArray],
  ['carePlans', carePlansArray],
  ['schedules', schedulesArray]
]);

// Get cache metadata
const metadata = await cache.getMetadata();
console.log('Last sync:', metadata.lastSync);
console.log('Record counts:', metadata.recordCounts);

// Clear user cache (on logout)
await cache.clear();
```

**Key Features:**
- AES-256 encryption for all data
- User-scoped isolation (User A cannot access User B's data)
- Automatic encryption/decryption
- Metadata tracking (last sync, record counts, version)

### CacheService

High-level caching operations:

```typescript
import { cacheService } from '@services/cacheService';

// Cache patients
await cacheService.cachePatients(patients);
const cachedPatients = await cacheService.getCachedPatients();

// Cache care plans
await cacheService.cacheCarePlan(carePlan);
const cachedCarePlan = await cacheService.getCachedCarePlan(patientId);

// Cache schedules
await cacheService.cacheTodaySchedule(patientId, schedule);
const cachedSchedule = await cacheService.getCachedTodaySchedule(patientId);

// Pending sync queue
await cacheService.addPendingSync('operation', data);
const pending = await cacheService.getPendingSync();
await cacheService.clearPendingSync();

// Session data
await cacheService.cacheSessionData(sessionData);
const session = await cacheService.getCachedSessionData();
await cacheService.clearSessionData();

// Cache management
await cacheService.setLastSyncTime();
const lastSync = await cacheService.getLastSyncTime();
const shouldSync = await cacheService.shouldSync(); // Check if cache is stale

// Get cache statistics
const stats = await cacheService.getCacheStats();
console.log('Cache stats:', stats);
```

**Cache Expiry Times:**
- Patients list: 8 hours
- Patient detail: 8 hours
- Schedules: 8 hours
- Problem templates: 7 days
- Care plans: No expiry (offline-first, sync when online)

### NetworkService

Monitor network connectivity:

```typescript
import { networkService } from '@services/networkService';

// Initialize (call once at app startup)
await networkService.initialize();

// Check connectivity
const isOnline = networkService.isConnected();

// Listen for connectivity changes
networkService.onConnectivityChange((isConnected) => {
  if (isConnected) {
    console.log('Network restored - syncing pending changes');
    processPendingSync();
  } else {
    console.log('Network lost - switching to offline mode');
  }
});

// Get detailed network state
const state = await networkService.getDetailedState();
console.log('Connection type:', state.type); // wifi, cellular, none
console.log('Is connected:', state.isConnected);
console.log('Is internet reachable:', state.isInternetReachable);

// Cleanup (call on app unmount)
networkService.cleanup();
```

### CacheWarmer

Pre-fetch data for offline operation:

```typescript
import { warmAllCaches, warmScheduleCaches, warmAllDataForDemo } from '@services/cacheWarmer';

// Warm essential caches on login
const result = await warmAllCaches(userId);
console.log('Cache warming result:', result);
// {
//   success: true,
//   details: {
//     patients: 25,
//     templates: 50,
//     staffSchedule: true
//   },
//   errors: []
// }

// Warm per-patient schedules
const scheduleResult = await warmScheduleCaches(staffId);
console.log('Schedules warmed:', scheduleResult.patientsWarmed);

// Comprehensive warming for demo
const demoResult = await warmAllDataForDemo(staffId);
console.log('Demo data warmed:', demoResult.details);
```

**Cache Warming Strategy:**
1. **On Login**: Automatically warm essential caches (patients, templates, staff schedule)
2. **Background**: Warm per-patient data as needed
3. **Pre-Demo**: Comprehensive warming for offline demonstrations

## Best Practices

### 1. Always Handle Offline State

```typescript
// ✅ Good - Handles offline gracefully
async function loadPatientData(patientId: string): Promise<void> {
  try {
    const patient = await apiService.getPatient(patientId);
    setPatient(patient);
  } catch (error) {
    if (!networkService.isConnected()) {
      // Offline - use cached data
      const cached = await cacheService.getCachedPatient(patientId);
      if (cached) {
        setPatient(cached);
        showOfflineIndicator();
      } else {
        showError('Patient data not available offline');
      }
    } else {
      // Real error
      showError('Failed to load patient data');
    }
  }
}

// ❌ Bad - Doesn't handle offline
async function loadPatientData(patientId: string): Promise<void> {
  const patient = await apiService.getPatient(patientId);
  setPatient(patient);
}
```

### 2. Provide Offline Indicators

```typescript
import { NetworkStatusIndicator } from '@components/NetworkStatusIndicator';

// Show network status in UI
<View style={styles.header}>
  <Text style={styles.title}>Patient List</Text>
  <NetworkStatusIndicator />
</View>

// Show last sync time
const lastSync = await cacheService.getLastSyncTime();
<Text style={styles.syncInfo}>
  Last synced: {formatTimeAgo(lastSync)}
</Text>
```

### 3. Implement Conflict Resolution

```typescript
async function syncCarePlan(localCarePlan: CarePlan): Promise<void> {
  try {
    const serverCarePlan = await apiService.getCarePlan(localCarePlan.id);
    
    // Check for conflicts
    if (serverCarePlan.version > localCarePlan.version) {
      // Server has newer version - show conflict dialog
      showConflictDialog({
        local: localCarePlan,
        server: serverCarePlan,
        onResolve: async (resolved) => {
          await apiService.updateCarePlan(resolved.id, resolved);
          await cacheService.cacheCarePlan(resolved);
        }
      });
    } else {
      // No conflict - sync local changes
      await apiService.updateCarePlan(localCarePlan.id, localCarePlan);
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```

### 4. Test Offline Scenarios

```typescript
describe('Offline workflow', () => {
  it('should work offline with cached data', async () => {
    // 1. Populate cache
    await cacheService.cachePatients(mockPatients);
    
    // 2. Simulate offline
    networkService.isConnected = jest.fn(() => false);
    
    // 3. Test functionality
    const patients = await apiService.getPatients();
    expect(patients).toEqual(mockPatients);
    
    // 4. Verify no network calls
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it('should queue changes when offline', async () => {
    // 1. Simulate offline
    networkService.isConnected = jest.fn(() => false);
    
    // 2. Make changes
    await carePlanStore.updateCarePlan('plan-1', { status: 'active' });
    
    // 3. Verify queued
    const pending = await cacheService.getPendingSync();
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('updateCarePlan');
  });

  it('should sync when reconnected', async () => {
    // 1. Queue changes while offline
    await cacheService.addPendingSync('createNote', { data: 'test' });
    
    // 2. Simulate reconnection
    networkService.isConnected = jest.fn(() => true);
    await processPendingSync();
    
    // 3. Verify synced
    expect(mockAxios.post).toHaveBeenCalledWith('/clinical-notes', { data: 'test' });
    const pending = await cacheService.getPendingSync();
    expect(pending).toHaveLength(0);
  });
});
```

## Common Patterns

### Pattern 1: Cache-First Read

```typescript
async function getData<T>(
  cacheKey: string,
  apiCall: () => Promise<T>,
  cacheSetter: (data: T) => Promise<void>
): Promise<T> {
  // Try cache first
  const cached = await cacheService.get<T>(cacheKey);
  if (cached) {
    // Background refresh
    apiCall()
      .then(data => cacheSetter(data))
      .catch(error => console.log('Background refresh failed'));
    return cached;
  }

  // Fetch from API
  const data = await apiCall();
  await cacheSetter(data);
  return data;
}
```

### Pattern 2: Optimistic Write

```typescript
async function updateData<T>(
  id: string,
  updates: Partial<T>,
  localUpdate: (id: string, updates: Partial<T>) => void,
  apiCall: (id: string, updates: Partial<T>) => Promise<T>
): Promise<void> {
  // Update locally
  localUpdate(id, updates);

  // Sync to backend
  try {
    await apiCall(id, updates);
  } catch (error) {
    if (!networkService.isConnected()) {
      // Queue for sync
      await cacheService.addPendingSync('update', { id, updates });
    } else {
      // Real error - revert
      throw error;
    }
  }
}
```

### Pattern 3: Offline Queue

```typescript
async function queueOperation(
  operation: string,
  data: any
): Promise<void> {
  if (networkService.isConnected()) {
    // Execute immediately
    await executeOperation(operation, data);
  } else {
    // Queue for later
    await cacheService.addPendingSync(operation, data);
  }
}

async function executeOperation(
  operation: string,
  data: any
): Promise<void> {
  switch (operation) {
    case 'createNote':
      await apiService.createClinicalNote(data);
      break;
    case 'updateCarePlan':
      await apiService.updateCarePlan(data.id, data.updates);
      break;
    // ... other operations
  }
}
```

## Troubleshooting

### Cache Not Working

**Symptom**: Data not loading from cache when offline

**Solutions**:
1. Check if cache was populated: `await cacheService.getCacheStats()`
2. Verify user ID is correct: Cache is user-scoped
3. Check cache expiry: Some data expires after 8 hours
4. Clear and re-warm cache: `await cacheService.clearCache()` then login again

### Sync Not Triggering

**Symptom**: Pending changes not syncing when online

**Solutions**:
1. Verify network listener is registered: `networkService.onConnectivityChange(callback)`
2. Check pending queue: `await cacheService.getPendingSync()`
3. Manually trigger sync: `await processPendingSync()`
4. Check for errors in sync operations

### Data Conflicts

**Symptom**: Local and server data differ after sync

**Solutions**:
1. Implement version tracking in data models
2. Use last-write-wins strategy with timestamps
3. Show conflict resolution dialog to user
4. Preserve both versions in audit log

### Cache Growing Too Large

**Symptom**: App using too much storage

**Solutions**:
1. Implement cache size limits: Check `cacheService.getCacheStats()`
2. Clear old data: `await cacheService.clearCache()`
3. Reduce cache expiry times for less critical data
4. Implement selective caching (only cache frequently accessed data)

## Performance Considerations

### Cache Warming

- Warm caches on login (background process)
- Show progress indicator during warming
- Allow app usage before warming completes
- Prioritize essential data (patients, schedules)

### Background Sync

- Throttle sync operations (max 1 per minute)
- Batch multiple changes into single request
- Use exponential backoff for retries
- Cancel sync if user logs out

### Memory Management

- Clear cache on logout
- Implement cache size limits (e.g., 50MB)
- Use pagination for large datasets
- Compress cached data if needed

## Security Considerations

### Encrypted Cache

- All cached data is encrypted with AES-256
- User-scoped encryption keys
- Keys stored in iOS Keychain
- Automatic encryption/decryption

### Data Isolation

- Each user has separate cache namespace
- User A cannot access User B's data
- Cache cleared on logout
- No shared cache between users

### Secure Deletion

- Overwrite data before deletion
- Clear encryption keys on logout
- Verify deletion completed successfully
- No data remnants in storage

## Migration Guide

### Adding Offline Support to Existing Feature

1. **Identify data requirements**: What data does the feature need?
2. **Add caching**: Implement cache methods in `cacheService`
3. **Update API calls**: Add cache-first logic to API service
4. **Handle offline state**: Add offline indicators and error handling
5. **Test offline**: Verify feature works without network
6. **Add sync**: Implement pending sync for write operations

### Example Migration

```typescript
// Before: Online-only
async function loadPatients(): Promise<void> {
  const patients = await apiService.getPatients();
  setPatients(patients);
}

// After: Offline-first
async function loadPatients(): Promise<void> {
  try {
    // Try cache first
    const cached = await cacheService.getCachedPatients();
    if (cached) {
      setPatients(cached);
      setOfflineMode(!networkService.isConnected());
      
      // Background refresh
      if (networkService.isConnected()) {
        const fresh = await apiService.getPatients(false);
        setPatients(fresh);
        await cacheService.cachePatients(fresh);
      }
      return;
    }

    // No cache - fetch from API
    const patients = await apiService.getPatients();
    setPatients(patients);
    await cacheService.cachePatients(patients);
  } catch (error) {
    if (!networkService.isConnected()) {
      showError('No cached data available offline');
    } else {
      showError('Failed to load patients');
    }
  }
}
```

## Resources

- [SecureCache API Reference](./API_SECURE_CACHE.md)
- [CacheService API Reference](./API_CACHE_SERVICE.md)
- [NetworkService API Reference](./API_NETWORK_SERVICE.md)
- [Offline Testing Guide](./TESTING_OFFLINE.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
