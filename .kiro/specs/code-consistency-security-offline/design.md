# Design Document: Code Consistency, Security & Offline Capability

## Overview

This design establishes comprehensive patterns for code consistency, security best practices, and robust offline capability across the VerbumCare platform. The design addresses three critical areas:

1. **Code Consistency**: Standardized architectural patterns, TypeScript usage, error handling, and file organization to ensure maintainability and scalability
2. **Security**: Multi-layered security including authentication/authorization, data encryption, audit logging, and cryptographic integrity for medication records
3. **Offline Capability**: Offline-first architecture with intelligent caching, background synchronization, and seamless online/offline transitions

The design builds upon the existing codebase structure while introducing improvements for consistency, security hardening, and enhanced offline operation. All changes are backward-compatible and can be implemented incrementally.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     iPad Application                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Presentation Layer (React Native Components)          │ │
│  │  - Screens, UI Components, Navigation                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  State Management Layer (Zustand Stores)               │ │
│  │  - Auth Store, Care Plan Store, Assessment Store       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Service Layer                                          │ │
│  │  - API Service, Cache Service, Network Service         │ │
│  │  - BLE Service, Voice Service, Socket Service          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Layer                                             │ │
│  │  - Secure Cache (Encrypted AsyncStorage)               │ │
│  │  - Session Storage, Pending Sync Queue                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/TLS 1.3
                            │ Socket.IO (WSS)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend Server                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Layer (Express.js Routes)                         │ │
│  │  - Auth, Patients, Care Plans, Vitals, Voice          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Business Logic Layer                                   │ │
│  │  - Authentication, Authorization, Validation           │ │
│  │  - Cryptographic Hash Chain, Audit Logging             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Access Layer                                      │ │
│  │  - PostgreSQL Database Connection Pool                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Offline-First Architecture Pattern


```
User Action → Check Cache First → Cache Hit? → Use Cached Data
                                 ↓ Cache Miss
                                 Network Available? → Yes → Fetch from API → Update Cache
                                 ↓ No Network
                                 Return Error (No Fallback Data)

Background Process:
  Network Restored → Sync Pending Changes → Update Cache → Notify UI
```

The offline-first pattern prioritizes local cache for all read operations, falling back to network only when cache misses occur. Write operations are queued when offline and synchronized automatically when connectivity is restored.

## Components and Interfaces

### 1. Authentication System

#### AuthStore (Zustand State Management)

```typescript
interface AuthStore {
  // State
  currentUser: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login(username: string, password: string): Promise<boolean>;
  logout(): Promise<void>;
  checkAuth(): Promise<void>;
  refreshToken(): Promise<boolean>;
  updateUserProfile(updates: Partial<User>): void;
}

interface User {
  userId: string;
  staffId: string;
  username: string;
  fullName: string;
  fullNameJa?: string;
  role: StaffRole;
  facilityId: string;
  loginTime: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
```

**Key Design Decisions:**
- JWT tokens stored in encrypted AsyncStorage
- Automatic token refresh before expiration
- Session persistence across app restarts for same user
- Network required only for initial login or explicit logout



### 2. Secure Cache System

#### SecureCache Class

```typescript
class SecureCache {
  private userId: string;

  constructor(userId: string);

  // Core operations
  async set<T>(key: string, data: T): Promise<void>;
  async get<T>(key: string): Promise<T | null>;
  async setMultiple(items: Array<[string, any]>): Promise<void>;
  
  // Metadata management
  async getMetadata(): Promise<CacheMetadata | null>;
  async setMetadata(metadata: Partial<CacheMetadata>): Promise<void>;
  
  // Cache management
  async clear(): Promise<void>;
  async getStats(): Promise<CacheStats>;
}

interface CacheMetadata {
  lastSync: string;
  lastUpdated: string;
  version: number;
  recordCounts: {
    patients?: number;
    carePlans?: number;
    medications?: number;
    vitals?: number;
    assessments?: number;
  };
}
```

**Encryption Strategy:**
- AES-256 encryption for all cached data
- User-scoped encryption keys derived from user ID
- Automatic encryption on write, decryption on read
- Secure deletion on logout

**Data Isolation:**
- Each user has separate encrypted cache namespace
- User A cannot access User B's cached data
- Cache cleared on explicit logout
- Cache persists on app restart for same user

### 3. Network Service

#### NetworkService Class

```typescript
class NetworkService {
  private isCurrentlyConnected: boolean;
  private listeners: ConnectivityCallback[];

  async initialize(): Promise<void>;
  cleanup(): void;
  
  isConnected(): boolean;
  onConnectivityChange(callback: ConnectivityCallback): void;
  offConnectivityChange(callback: ConnectivityCallback): void;
  
  async getDetailedState(): Promise<NetInfoState>;
}
```

**Responsibilities:**
- Monitor device network connectivity (WiFi, cellular)
- Notify services of connectivity changes
- Provide connectivity status for conditional logic
- Trigger background sync on reconnection



### 4. Cache Service

#### CacheService Class

```typescript
class CacheService {
  // Patient caching
  async cachePatients(patients: Patient[]): Promise<void>;
  async getCachedPatients(): Promise<Patient[] | null>;
  async cachePatient(patient: Patient): Promise<void>;
  async getCachedPatient(patientId: string): Promise<Patient | null>;
  
  // Care plan caching
  async cacheCarePlans(carePlans: CarePlan[]): Promise<void>;
  async cacheCarePlan(carePlan: CarePlan): Promise<void>;
  async getCachedCarePlan(patientId: string): Promise<CarePlan | null>;
  async removeCarePlan(patientId: string): Promise<void>;
  
  // Schedule caching
  async cacheTodaySchedule(patientId: string, schedule: TodaySchedule): Promise<void>;
  async getCachedTodaySchedule(patientId: string): Promise<TodaySchedule | null>;
  async cacheStaffSchedule(staffId: string, schedule: any): Promise<void>;
  async getCachedStaffSchedule(staffId: string): Promise<any | null>;
  
  // Template caching
  async cacheProblemTemplates(templates: ProblemTemplate[]): Promise<void>;
  async getCachedProblemTemplates(): Promise<ProblemTemplate[] | null>;
  
  // Sync management
  async setLastSyncTime(): Promise<void>;
  async getLastSyncTime(): Promise<number | null>;
  async shouldSync(): Promise<boolean>;
  
  // Pending sync queue
  async addPendingSync(type: string, data: any): Promise<void>;
  async getPendingSync(): Promise<any[]>;
  async clearPendingSync(): Promise<void>;
  
  // Session data
  async cacheSessionData(sessionData: any): Promise<void>;
  async getCachedSessionData(): Promise<any | null>;
  async clearSessionData(): Promise<void>;
  
  // Cache management
  async clearCache(): Promise<void>;
  async getCacheStats(): Promise<CacheStats>;
}
```

**Cache Expiry Strategy:**
- Patients list: 8 hours (supports demo + travel time)
- Patient detail: 8 hours (matches patients list)
- Schedules: 8 hours (daily refresh)
- Problem templates: 7 days (rarely change)
- Care plans: No expiry (offline-first, sync when online)



### 5. API Service with Offline Support

#### APIService Class

```typescript
class APIService {
  private client: AxiosInstance;

  // Patient operations (cache-first)
  async getPatients(useCache: boolean = true): Promise<Patient[]>;
  async getPatient(id: string): Promise<Patient>;
  
  // Schedule operations (cache-first)
  async getTodaySchedule(patientId: string): Promise<TodaySchedule>;
  async getAllTodaySchedule(staffId?: string): Promise<any>;
  
  // Care plan operations
  async getCarePlans(patientId: string): Promise<CarePlan[]>;
  async createCarePlan(carePlan: Omit<CarePlan, 'id' | 'auditLog'>): Promise<CarePlan>;
  async updateCarePlan(carePlanId: string, updates: Partial<CarePlan>): Promise<CarePlan>;
  
  // Session operations
  async saveSessionData(patientId: string, sessionData: any): Promise<{ session_id: string }>;
  async submitSession(patientId: string, sessionId: string): Promise<any>;
  async submitAllSessionData(patientId: string, sessionData: any): Promise<void>;
  
  // Voice operations
  async uploadVoiceRecording(audioUri: string, patientId: string, recordedBy: string): Promise<VoiceUploadResponse>;
  async processVoiceRecording(recordingId: string): Promise<void>;
  
  // Clinical notes operations
  async getClinicalNotes(patientId: string, filters?: any): Promise<any[]>;
  async createClinicalNote(noteData: any): Promise<any>;
}
```

**Offline-First Implementation Pattern:**

```typescript
async getTodaySchedule(patientId: string): Promise<TodaySchedule> {
  // 1. Try cache first
  const cached = await cacheService.getCachedTodaySchedule(patientId);
  if (cached) {
    // 2. Background refresh (silent fail if offline)
    this.client.get(`/dashboard/today-schedule/${patientId}`)
      .then(response => cacheService.cacheTodaySchedule(patientId, response.data.data))
      .catch(error => console.log('Background refresh failed (offline?)'));
    
    return cached;
  }

  // 3. No cache - fetch from API and cache result
  const response = await this.client.get(`/dashboard/today-schedule/${patientId}`);
  const schedule = response.data.data;
  await cacheService.cacheTodaySchedule(patientId, schedule);
  return schedule;
}
```



### 6. BLE Service (Device-Initiated Connections)

#### BLEService Class

```typescript
class BLEService {
  private manager: BleManager;
  private connectedDevice: Device | null;
  private statusCallback: ((status: BLEConnectionStatus) => void) | null;
  private readingCallback: ((reading: BPReading) => void) | null;

  async requestPermissions(): Promise<boolean>;
  async startScan(): Promise<void>;
  stopScan(): void;
  
  async connectToDevice(device: Device): Promise<void>;
  disconnect(): void;
  
  setStatusCallback(callback: (status: BLEConnectionStatus) => void): void;
  setReadingCallback(callback: (reading: BPReading) => void): void;
}
```

**Device-Initiated Connection Pattern:**

```typescript
// Handle device-initiated broadcast
private async handleDeviceDiscovered(device: Device) {
  // 1. Verify device identity by service UUID
  if (!this.isValidDevice(device)) {
    return;
  }

  // 2. Check if device was previously paired
  const wasPaired = await this.isPreviouslyPaired(device.id);
  
  // 3. Accept connection from known device
  if (wasPaired) {
    await this.connectToDevice(device);
    
    // 4. Capture data immediately
    const reading = await this.readBPData(device);
    
    // 5. Process data (device may disconnect after transmission)
    if (this.readingCallback) {
      this.readingCallback(reading);
    }
    
    // 6. Gracefully handle disconnection (not an error)
    device.onDisconnected(() => {
      console.log('Device disconnected after data transmission (normal behavior)');
      this.statusCallback?.('disconnected');
    });
  }
}
```

**Key Design Decisions:**
- Support broadcast-based devices that awaken to transmit
- Accept device-initiated connections from paired devices
- Capture data immediately without expecting persistent connection
- Handle disconnection after data transmission as normal behavior
- Remember pairings for future device-initiated connections



### 7. Cache Warmer Service

#### CacheWarmer Functions

```typescript
// Warm all caches for offline operation
async function warmAllCaches(userId: string): Promise<WarmCacheResult>;

// Warm schedule caches for all patients
async function warmScheduleCaches(staffId: string): Promise<{
  success: boolean;
  patientsWarmed: number;
  staffScheduleWarmed: boolean;
  errors: string[];
}>;

// Comprehensive cache warming for demo
async function warmAllDataForDemo(staffId: string): Promise<{
  success: boolean;
  details: {
    patients: number;
    schedules: number;
    carePlans: number;
    templates: number;
  };
  errors: string[];
}>;

// Get cached data for offline use
async function getCachedData<T>(userId: string, key: string): Promise<T | null>;

// Check if user has cached data
async function hasCachedData(userId: string): Promise<boolean>;

// Clear cached data for user
async function clearUserCache(userId?: string): Promise<void>;
```

**Cache Warming Strategy:**

1. **On Login**: Automatically warm essential caches
   - Patients list
   - Staff schedule (multi-patient view)
   - Problem templates

2. **Background Warming**: Warm per-patient data
   - Individual patient schedules
   - Care plans (on-demand)
   - Vitals history (on-demand)

3. **Pre-Demo Warming**: Comprehensive warming for offline demo
   - All patients
   - All schedules
   - All templates
   - Selected care plans



## Data Models

### Authentication Models

```typescript
interface User {
  userId: string;        // Database staff_id UUID
  staffId: string;       // Same as userId, explicit for clarity
  username: string;
  fullName: string;
  fullNameJa?: string;
  role: StaffRole;
  facilityId: string;
  loginTime: Date;
}

type StaffRole = 'nurse' | 'care_worker' | 'care_manager' | 'doctor' | 'therapist' | 'dietitian';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
```

### Cache Models

```typescript
interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheMetadata {
  lastSync: string;
  lastUpdated: string;
  version: number;
  recordCounts: {
    patients?: number;
    carePlans?: number;
    medications?: number;
    vitals?: number;
    assessments?: number;
  };
}

interface CacheStats {
  userId: string;
  itemCount: number;
  lastSync: string | null;
  recordCounts: CacheMetadata['recordCounts'];
  isCached: boolean;
}
```

### Session Models

```typescript
interface SessionData {
  vitals?: VitalSigns;
  barthelIndex?: BarthelIndex;
  medications?: MedicationAdmin[];
  patientUpdates?: PatientUpdateDraft;
  incidents?: IncidentReport[];
}

interface PendingSyncItem {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}
```

### BLE Models

```typescript
interface BPReading {
  systolic: number;
  diastolic: number;
  pulse: number;
  timestamp: Date;
  deviceId: string;
  deviceModel: string;
}

type BLEConnectionStatus = 
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Authentication & Session Management Properties

**Property 1: Login with valid credentials returns tokens**
*For any* valid username and password combination, when authenticating with network connectivity, the system should return access and refresh tokens with expiration timestamps
**Validates: Requirements 2.1**

**Property 2: Session restoration round trip**
*For any* authenticated user session, saving the session to cache then reopening the application should restore the same authentication state without requiring network connectivity
**Validates: Requirements 2.2, 9.3, 9.4**

**Property 3: Logout clears all user data**
*For any* authenticated user, when logging out, all cached user data should be removed and subsequent cache queries for that user should return null
**Validates: Requirements 2.3, 3.4**

**Property 4: Token refresh extends session**
*For any* expired access token with valid refresh token and network connectivity, the token refresh operation should return a new access token with future expiration time
**Validates: Requirements 2.5**

**Property 5: API requests include authentication**
*For any* protected API endpoint request, the HTTP headers should contain a valid Bearer token in the Authorization header
**Validates: Requirements 2.6**

**Property 6: Role-based access filtering**
*For any* user role and data access request, the returned data should only include records that the user's role has permission to access
**Validates: Requirements 2.9**



### Data Encryption Properties

**Property 7: Encryption round trip**
*For any* plaintext data, encrypting then decrypting should produce data equivalent to the original plaintext
**Validates: Requirements 3.1**

**Property 8: User data isolation**
*For any* two different users A and B, user A should not be able to retrieve cached data that was stored by user B
**Validates: Requirements 3.3**

**Property 9: Encrypted data is not plaintext**
*For any* sensitive data stored in cache, reading the raw storage should not reveal plaintext patient information
**Validates: Requirements 3.1**

### Offline-First Architecture Properties

**Property 10: Cache-first data access**
*For any* data request when cached data exists, the system should return cached data before attempting network requests
**Validates: Requirements 4.1**

**Property 11: Offline operation with cached data**
*For any* cached dataset, when network connectivity is unavailable, the system should successfully return cached data without throwing network errors
**Validates: Requirements 4.2**

**Property 12: Offline changes queued for sync**
*For any* data modification when network is unavailable, the change should be added to the pending sync queue
**Validates: Requirements 4.3**

**Property 13: Auto-sync on reconnection**
*For any* pending sync queue with items, when network connectivity is restored, all queued items should be transmitted to the backend
**Validates: Requirements 4.4**

**Property 14: Background refresh updates cache**
*For any* stale cached data when network is available, background refresh should update the cache with fresh data from the backend
**Validates: Requirements 4.5**

**Property 15: Cache timestamp accuracy**
*For any* cached data, the displayed last synchronization timestamp should match the actual time of the most recent cache update
**Validates: Requirements 4.6**



### Cache Warming Properties

**Property 16: Login triggers cache warming**
*For any* successful user login, the system should prefetch patients, care plans, problem templates, and schedules for the user's facility
**Validates: Requirements 5.1**

**Property 17: Partial cache warming continues**
*For any* cache warming operation where some items fail to fetch, the system should successfully cache all items that were fetched without failing the entire operation
**Validates: Requirements 5.3**

**Property 18: Expired cache triggers refresh**
*For any* cached data past its expiration time, when network is available, the system should automatically fetch fresh data from the backend
**Validates: Requirements 5.4**

### Network Connectivity Properties

**Property 19: Connectivity change notifications**
*For any* registered connectivity listener, when network status changes from online to offline or vice versa, the listener should be notified with the new status
**Validates: Requirements 6.2**

**Property 20: Reconnection triggers sync**
*For any* pending sync queue with items, when transitioning from offline to online, background synchronization should be initiated automatically
**Validates: Requirements 6.3**

**Property 21: Network failure falls back to cache**
*For any* API request that fails due to network connectivity issues, when cached data exists, the system should return cached data instead of throwing an error
**Validates: Requirements 6.4**

### Audit Logging Properties

**Property 22: Data access creates audit log**
*For any* patient data access, an audit log entry should be created with timestamp, user ID, patient ID, and data type
**Validates: Requirements 7.1**

**Property 23: Data modification logs before/after**
*For any* data modification, the audit log should contain both the previous value and the new value along with timestamp and user ID
**Validates: Requirements 7.2**

**Property 24: Audit log immutability**
*For any* audit log entry, attempting to modify the entry should fail and the original entry should remain unchanged
**Validates: Requirements 7.3**

**Property 25: Audit log filtering**
*For any* audit log query with filters (user, patient, date range, action type), the returned results should only include entries matching all specified filters
**Validates: Requirements 7.4**



### Medication Hash Chain Properties

**Property 26: Hash chain linking**
*For any* medication administration record, the record's previous_hash field should equal the record_hash of the chronologically previous administration
**Validates: Requirements 8.1**

**Property 27: Hash chain validation detects tampering**
*For any* medication administration record that has been modified, hash chain validation should detect the modification and flag the record as invalid
**Validates: Requirements 8.2**

**Property 28: Export includes hash chain**
*For any* medication record export, the exported data should include both record_hash and previous_hash fields for external verification
**Validates: Requirements 8.5**

### Session Persistence Properties

**Property 29: Auto-save interval**
*For any* assessment data entry session, data should be automatically saved to local storage at intervals not exceeding 30 seconds
**Validates: Requirements 9.1**

**Property 30: Background persistence**
*For any* active session when the application is backgrounded, all session data should be persisted to secure storage before the app suspends
**Validates: Requirements 9.2**

**Property 31: Session restoration after restart**
*For any* valid user session, closing and reopening the application should restore both authentication state and workflow state without data loss
**Validates: Requirements 9.3, 9.7**

**Property 32: Session cleanup after submission**
*For any* completed session, after successful submission to the backend, workflow session data should be cleared while authentication cache remains
**Validates: Requirements 9.5**

### Error Handling Properties

**Property 33: Localized error messages**
*For any* error occurrence, the displayed error message should be in the user's selected language (Japanese, English, or Traditional Chinese)
**Validates: Requirements 10.1**

**Property 34: Error type classification**
*For any* network error, the system should correctly classify it as either a connectivity issue (offline) or a server error (4xx/5xx) and display appropriate messages
**Validates: Requirements 10.2**

**Property 35: Error logging**
*For any* critical error, detailed error information (stack trace, context, timestamp) should be logged for debugging purposes
**Validates: Requirements 10.5**



### Voice Processing Security Properties

**Property 36: Voice recording encryption**
*For any* completed voice recording, the audio file should be encrypted immediately and the encrypted file should not contain plaintext audio data
**Validates: Requirements 11.1**

**Property 37: Transcription encryption**
*For any* voice transcription, the transcribed text should be encrypted before storage and decryption should produce the original transcription
**Validates: Requirements 11.4**

**Property 38: Voice file deletion**
*For any* voice recording deletion request, the audio file and all associated metadata should be removed from storage and subsequent queries should return null
**Validates: Requirements 11.5**

### Care Plan Versioning Properties

**Property 39: Initial version is 1.0**
*For any* newly created care plan, the version number should be initialized to 1.0
**Validates: Requirements 12.1**

**Property 40: Version increment on modification**
*For any* care plan modification, the version number should increase (new version > old version)
**Validates: Requirements 12.2**

**Property 41: Version history completeness**
*For any* care plan with multiple versions, querying the history should return all versions in chronological order
**Validates: Requirements 12.3**

**Property 42: Revert creates new version**
*For any* care plan revert operation, a new version should be created with content matching the selected historical version
**Validates: Requirements 12.4**

**Property 43: Last-write-wins conflict resolution**
*For any* conflicting care plan modifications, the modification with the later timestamp should be preserved
**Validates: Requirements 12.5**

### BLE Device Properties

**Property 44: Device identity verification**
*For any* BLE device connection attempt, only devices with valid manufacturer service UUIDs should be accepted
**Validates: Requirements 13.1**

**Property 45: Device-initiated connection acceptance**
*For any* previously paired BLE device that initiates a connection, the system should accept the connection and capture transmitted data
**Validates: Requirements 13.2, 13.3**

**Property 46: Disconnect handling**
*For any* BLE device that disconnects after transmitting data, the system should process the received data and not treat the disconnection as an error
**Validates: Requirements 13.4**

**Property 47: BLE data validation**
*For any* BLE data received, data failing integrity checks (invalid checksums or out-of-range values) should be rejected
**Validates: Requirements 13.5**

**Property 48: BLE data user association**
*For any* BLE reading stored in the system, the reading should be associated with the authenticated user ID and timestamp
**Validates: Requirements 13.6**

**Property 49: Pairing persistence**
*For any* BLE device that has been paired, the pairing should be remembered and future device-initiated connections should be accepted without re-pairing
**Validates: Requirements 13.9**



### Multi-Language Properties

**Property 50: Translation key usage**
*For any* user interface text, the displayed text should come from centralized translation files (ja.json, en.json, zh-TW.json) using translation keys
**Validates: Requirements 14.1**

**Property 51: Language switching updates UI**
*For any* language change, all visible UI text should update to the new language immediately without requiring application restart
**Validates: Requirements 14.2**

**Property 52: Multilingual data preservation**
*For any* data with multiple language versions, storing and retrieving the data should preserve all language versions without data loss
**Validates: Requirements 14.3**

**Property 53: User language preference**
*For any* clinical data display, the data should be shown in the user's selected language, falling back to the default language if the selected language is unavailable
**Validates: Requirements 14.4**

**Property 54: Export language metadata**
*For any* data export, the exported data should include language metadata indicating which language version is included
**Validates: Requirements 14.5**

### Performance Properties

**Property 55: Pagination reduces memory**
*For any* large dataset request, when pagination is enabled, the memory usage should be less than loading the entire dataset at once
**Validates: Requirements 15.1**

**Property 56: Cache size limits**
*For any* cache storage operation, the total cache size should not exceed the configured maximum cache size limit
**Validates: Requirements 15.2**

**Property 57: Image compression**
*For any* image processing operation, the output image file size should be smaller than the input image file size
**Validates: Requirements 15.3**

**Property 58: Sync throttling**
*For any* background synchronization process, sync operations should not occur more frequently than the configured throttle interval
**Validates: Requirements 15.4**



## Error Handling

### Error Classification

```typescript
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',           // No connectivity
  SERVER_ERROR = 'SERVER_ERROR',             // 5xx responses
  CLIENT_ERROR = 'CLIENT_ERROR',             // 4xx responses
  VALIDATION_ERROR = 'VALIDATION_ERROR',     // Data validation failed
  AUTHENTICATION_ERROR = 'AUTH_ERROR',       // Auth token invalid/expired
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',     // Encryption/decryption failed
  CACHE_ERROR = 'CACHE_ERROR',               // Cache read/write failed
  BLE_ERROR = 'BLE_ERROR',                   // BLE device connection failed
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'            // Unexpected error
}

interface AppError {
  type: ErrorType;
  message: string;
  messageJa: string;
  messageEn: string;
  messageZh: string;
  code?: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  recoverable: boolean;
}
```

### Error Handling Strategy

1. **Network Errors**: Fall back to cached data, display offline indicator
2. **Authentication Errors**: Attempt token refresh, redirect to login if refresh fails
3. **Validation Errors**: Highlight specific fields, provide correction guidance
4. **Server Errors**: Log error details, display user-friendly message, provide retry option
5. **BLE Errors**: Provide manual entry fallback, remember device for retry
6. **Cache Errors**: Clear corrupted cache, re-fetch from backend
7. **Encryption Errors**: Log error, clear affected data, require re-authentication

### Error Logging

```typescript
interface ErrorLog {
  errorId: string;
  type: ErrorType;
  message: string;
  stackTrace?: string;
  context: {
    userId?: string;
    screen?: string;
    action?: string;
    timestamp: Date;
  };
  deviceInfo: {
    platform: string;
    osVersion: string;
    appVersion: string;
  };
}
```

All errors are logged locally with full context for debugging. Critical errors are queued for transmission to backend when connectivity is available.



## Testing Strategy

### Unit Testing

**Framework**: Jest with React Native Testing Library

**Unit Test Coverage:**
- **Authentication**: Login success/failure, token refresh, logout cleanup
- **Encryption**: Encrypt/decrypt round trips, data isolation between users
- **Cache Service**: Cache CRUD operations, expiry logic, metadata management
- **Network Service**: Connectivity detection, listener notifications
- **BLE Service**: Device discovery, connection handling, data parsing
- **API Service**: Request formatting, response parsing, error handling
- **Error Handling**: Error classification, message localization, logging

**Example Unit Tests:**
```typescript
describe('AuthStore', () => {
  it('should store tokens after successful login', async () => {
    const result = await authStore.login('testuser', 'password');
    expect(result).toBe(true);
    expect(authStore.tokens).not.toBeNull();
    expect(authStore.isAuthenticated).toBe(true);
  });

  it('should clear all data on logout', async () => {
    await authStore.login('testuser', 'password');
    await authStore.logout();
    expect(authStore.tokens).toBeNull();
    expect(authStore.currentUser).toBeNull();
    expect(authStore.isAuthenticated).toBe(false);
  });
});

describe('SecureCache', () => {
  it('should encrypt data before storage', async () => {
    const cache = new SecureCache('user123');
    await cache.set('test', { sensitive: 'data' });
    
    // Read raw storage - should not be plaintext
    const raw = await AsyncStorage.getItem('@user_user123@verbumcare_cache_test');
    expect(raw).not.toContain('sensitive');
  });

  it('should isolate data between users', async () => {
    const cacheA = new SecureCache('userA');
    const cacheB = new SecureCache('userB');
    
    await cacheA.set('data', { value: 'A' });
    const result = await cacheB.get('data');
    
    expect(result).toBeNull(); // User B cannot access User A's data
  });
});
```



### Property-Based Testing

**Framework**: fast-check (JavaScript property-based testing library)

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Each property test tagged with design document property number
- Generators for common data types (users, patients, care plans, etc.)

**Property Test Examples:**

```typescript
import fc from 'fast-check';

/**
 * Feature: code-consistency-security-offline, Property 7: Encryption round trip
 * Validates: Requirements 3.1
 */
describe('Property 7: Encryption round trip', () => {
  it('should decrypt to original plaintext for any data', () => {
    fc.assert(
      fc.property(
        fc.record({
          patientId: fc.uuid(),
          name: fc.string(),
          age: fc.integer({ min: 0, max: 120 }),
          notes: fc.string()
        }),
        async (data) => {
          const cache = new SecureCache('testuser');
          await cache.set('patient', data);
          const retrieved = await cache.get('patient');
          
          expect(retrieved).toEqual(data);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: code-consistency-security-offline, Property 10: Cache-first data access
 * Validates: Requirements 4.1
 */
describe('Property 10: Cache-first data access', () => {
  it('should return cached data before attempting network request', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          patient_id: fc.uuid(),
          name: fc.string(),
          age: fc.integer({ min: 0, max: 120 })
        })),
        async (patients) => {
          // Pre-populate cache
          await cacheService.cachePatients(patients);
          
          // Track if network was called
          let networkCalled = false;
          const originalGet = apiService.client.get;
          apiService.client.get = jest.fn(() => {
            networkCalled = true;
            return Promise.resolve({ data: { data: [] } });
          });
          
          // Request patients
          const result = await apiService.getPatients(true);
          
          // Should return cached data without network call
          expect(result).toEqual(patients);
          expect(networkCalled).toBe(false);
          
          // Restore original
          apiService.client.get = originalGet;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: code-consistency-security-offline, Property 26: Hash chain linking
 * Validates: Requirements 8.1
 */
describe('Property 26: Hash chain linking', () => {
  it('should link each record to previous record hash', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          patient_id: fc.uuid(),
          order_id: fc.uuid(),
          administered_by: fc.uuid(),
          dose_given: fc.string()
        }), { minLength: 2, maxLength: 10 }),
        async (administrations) => {
          let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
          
          for (const admin of administrations) {
            const record = await createMedicationRecord(admin, previousHash);
            
            // Verify previous_hash matches
            expect(record.previous_hash).toBe(previousHash);
            
            // Update for next iteration
            previousHash = record.record_hash;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Custom Generators:**

```typescript
// Generate valid user objects
const userGenerator = fc.record({
  userId: fc.uuid(),
  staffId: fc.uuid(),
  username: fc.string({ minLength: 3, maxLength: 20 }),
  fullName: fc.string({ minLength: 5, maxLength: 50 }),
  role: fc.constantFrom('nurse', 'care_worker', 'care_manager', 'doctor', 'therapist', 'dietitian'),
  facilityId: fc.uuid(),
  loginTime: fc.date()
});

// Generate valid patient objects
const patientGenerator = fc.record({
  patient_id: fc.uuid(),
  mrn: fc.string({ minLength: 5, maxLength: 20 }),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  name_ja: fc.string({ minLength: 2, maxLength: 20 }),
  age: fc.integer({ min: 0, max: 120 }),
  room_number: fc.string({ minLength: 3, maxLength: 10 }),
  care_level: fc.constantFrom('要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5')
});

// Generate valid care plan objects
const carePlanGenerator = fc.record({
  id: fc.uuid(),
  patientId: fc.uuid(),
  careLevel: fc.constantFrom('要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'),
  status: fc.constantFrom('active', 'draft', 'archived'),
  version: fc.float({ min: 1.0, max: 10.0 }),
  createdDate: fc.date(),
  lastReviewDate: fc.date(),
  nextReviewDate: fc.date()
});
```



### Integration Testing

**Framework**: Detox (React Native end-to-end testing)

**Integration Test Scenarios:**
1. **Login → Cache Warming → Offline Operation**
   - Login with valid credentials
   - Verify cache warming completes
   - Disable network
   - Navigate through app and verify all features work offline

2. **Offline Data Entry → Reconnection → Sync**
   - Disable network
   - Enter patient assessment data
   - Verify data saved to pending sync queue
   - Enable network
   - Verify automatic synchronization

3. **BLE Device Connection → Data Capture**
   - Scan for BLE devices
   - Connect to blood pressure monitor
   - Capture reading
   - Verify reading saved with user association

4. **Session Persistence → App Restart**
   - Login and start assessment
   - Close app
   - Reopen app
   - Verify session restored without re-login

5. **Multi-Language Switching**
   - Switch from Japanese to English
   - Verify all UI text updates
   - Enter data in English
   - Switch to Traditional Chinese
   - Verify data displays correctly

### Test Coverage Goals

- **Unit Tests**: 80% code coverage minimum
- **Property Tests**: All 58 correctness properties implemented
- **Integration Tests**: All critical user workflows covered
- **Manual Testing**: BLE device compatibility, offline demo scenarios

### Continuous Integration

- Run unit tests on every commit
- Run property tests on pull requests
- Run integration tests nightly
- Generate coverage reports
- Block merges if tests fail or coverage drops



## Security Considerations

### Authentication Security

1. **Token Storage**: JWT tokens stored in encrypted AsyncStorage with OS-level security
2. **Token Expiration**: Access tokens expire after 1 hour, refresh tokens after 7 days
3. **Automatic Refresh**: Tokens refreshed automatically 5 minutes before expiration
4. **Session Timeout**: Inactive sessions timeout after 8 hours
5. **Logout Cleanup**: All tokens and cached data securely deleted on logout

### Data Encryption

1. **Encryption Algorithm**: AES-256-GCM for all cached data
2. **Key Derivation**: User-specific keys derived from user ID + device ID
3. **Encryption Scope**: All patient data, clinical notes, session data, and authentication tokens
4. **Key Storage**: Encryption keys stored in iOS Keychain (hardware-backed when available)
5. **Data Isolation**: Each user has separate encryption namespace

### Network Security

1. **Transport Security**: TLS 1.3 for all network communication
2. **Certificate Pinning**: Backend certificate pinned in production builds
3. **Request Signing**: Critical operations signed with user's private key
4. **Replay Protection**: Nonce-based replay attack prevention
5. **Rate Limiting**: Client-side rate limiting to prevent abuse

### Audit Trail Security

1. **Immutable Logs**: Audit logs cannot be modified after creation
2. **Cryptographic Integrity**: Each log entry includes hash of previous entry
3. **Tamper Detection**: Hash chain validation detects any modifications
4. **Secure Storage**: Audit logs encrypted at rest in database
5. **Access Control**: Only administrators can query audit logs

### BLE Security

1. **Device Verification**: Only devices with valid service UUIDs accepted
2. **Pairing Security**: Bluetooth pairing uses secure pairing methods
3. **Data Validation**: All BLE data validated before storage
4. **User Association**: All readings associated with authenticated user
5. **Transmission Security**: BLE data encrypted during transmission

### Medication Hash Chain Security

1. **SHA-256 Hashing**: Cryptographically secure hash algorithm
2. **Chain Integrity**: Each record links to previous record
3. **Tamper Detection**: Any modification breaks the chain
4. **Genesis Block**: First record links to known genesis hash
5. **Verification**: Chain verified on every query

### Voice Processing Security

1. **Immediate Encryption**: Audio files encrypted immediately after recording
2. **Secure Transmission**: Encrypted audio transmitted over TLS
3. **Local Processing**: AI processing on facility servers (no cloud)
4. **Transcription Encryption**: Transcribed text encrypted before storage
5. **Secure Deletion**: Audio files securely erased after processing

### Compliance Considerations

**HIPAA Compliance:**
- Encryption at rest and in transit
- Access controls and audit logging
- Automatic session timeout
- Secure data deletion
- Business Associate Agreement (BAA) ready

**PMDA Compliance (Japan):**
- Medical device classification assessment
- Clinical data integrity verification
- Adverse event reporting workflows
- Japanese language support

**ISO 27001 (Information Security):**
- Information security management system (ISMS)
- Risk assessment and treatment
- Security policies and procedures
- Internal audit processes

**ISO 13485 (Medical Device Quality):**
- Quality management system (QMS)
- Design control processes
- Risk management per ISO 14971
- Post-market surveillance



## Implementation Guidelines

### Code Organization Standards

**Directory Structure:**
```
ipad-app/src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components (buttons, inputs, etc.)
│   ├── vitals/         # Vitals-specific components
│   └── ui/             # UI library components
├── screens/            # Screen components (one per route)
├── services/           # Business logic and API clients
│   ├── api.ts         # API service
│   ├── cache.ts       # Cache service
│   ├── network.ts     # Network monitoring
│   ├── ble.ts         # BLE device service
│   └── voice.ts       # Voice recording service
├── stores/             # Zustand state management
│   ├── authStore.ts   # Authentication state
│   ├── carePlanStore.ts
│   └── assessmentStore.ts
├── types/              # TypeScript type definitions
│   ├── api.ts         # API response types
│   ├── app.ts         # App-specific types
│   └── ble.ts         # BLE device types
├── constants/          # Configuration and constants
│   ├── config.ts      # API URLs, timeouts, etc.
│   ├── theme.ts       # Colors, fonts, spacing
│   └── translations.ts # i18n strings
└── utils/              # Utility functions
    ├── formatters.ts  # Date/time/number formatting
    └── validators.ts  # Input validation
```

### TypeScript Standards

**Type Safety:**
- Use `strict` mode in tsconfig.json
- Avoid `any` type - use `unknown` or proper types
- Define interfaces for all data structures
- Use type guards for runtime type checking
- Export types from centralized type files

**Naming Conventions:**
- Interfaces: PascalCase (e.g., `User`, `Patient`, `CarePlan`)
- Types: PascalCase (e.g., `StaffRole`, `BLEConnectionStatus`)
- Functions: camelCase (e.g., `getPatients`, `cacheData`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `CACHE_EXPIRY`)
- Components: PascalCase (e.g., `PatientCard`, `VitalsDisplay`)

### Error Handling Standards

**Error Handling Pattern:**
```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // 1. Log error with context
  console.error('[ServiceName] Operation failed:', {
    error: error.message,
    context: { userId, patientId },
    timestamp: new Date().toISOString()
  });

  // 2. Classify error type
  const errorType = classifyError(error);

  // 3. Handle based on type
  if (errorType === ErrorType.NETWORK_ERROR) {
    // Fall back to cache
    return await getCachedData();
  } else if (errorType === ErrorType.AUTHENTICATION_ERROR) {
    // Attempt token refresh
    await refreshToken();
    return await riskyOperation(); // Retry
  } else {
    // Throw user-friendly error
    throw new AppError({
      type: errorType,
      message: getLocalizedMessage(errorType, language),
      recoverable: isRecoverable(errorType)
    });
  }
}
```

### Async/Await Standards

**Always use async/await (never use .then/.catch):**
```typescript
// ✅ Good
async function fetchPatient(id: string): Promise<Patient> {
  try {
    const response = await apiService.getPatient(id);
    return response;
  } catch (error) {
    console.error('Failed to fetch patient:', error);
    throw error;
  }
}

// ❌ Bad
function fetchPatient(id: string): Promise<Patient> {
  return apiService.getPatient(id)
    .then(response => response)
    .catch(error => {
      console.error('Failed to fetch patient:', error);
      throw error;
    });
}
```

### State Management Standards

**Zustand Store Pattern:**
```typescript
interface MyStore {
  // State
  data: DataType | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchData: () => Promise<void>;
  updateData: (updates: Partial<DataType>) => void;
  clearData: () => void;
}

export const useMyStore = create<MyStore>((set, get) => ({
  // Initial state
  data: null,
  isLoading: false,
  error: null,

  // Actions
  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiService.getData();
      set({ data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateData: (updates) => {
    const { data } = get();
    if (data) {
      set({ data: { ...data, ...updates } });
    }
  },

  clearData: () => {
    set({ data: null, error: null });
  }
}));
```

### Component Standards

**Functional Components with Hooks:**
```typescript
interface Props {
  patientId: string;
  onComplete: () => void;
}

export const MyComponent: React.FC<Props> = ({ patientId, onComplete }) => {
  // 1. Hooks at top
  const [loading, setLoading] = useState(false);
  const { data, fetchData } = useMyStore();

  // 2. Effects
  useEffect(() => {
    fetchData();
  }, [patientId]);

  // 3. Event handlers
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await submitData();
      onComplete();
    } catch (error) {
      console.error('Submit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 4. Render
  return (
    <View>
      {/* Component JSX */}
    </View>
  );
};
```

### Testing Standards

**Test File Naming:**
- Unit tests: `MyComponent.test.tsx` or `myService.test.ts`
- Property tests: `myService.property.test.ts`
- Integration tests: `myWorkflow.integration.test.ts`

**Test Structure:**
```typescript
describe('MyComponent', () => {
  // Setup
  beforeEach(() => {
    // Reset state, mocks, etc.
  });

  // Unit tests
  describe('rendering', () => {
    it('should display patient name', () => {
      // Test implementation
    });
  });

  describe('interactions', () => {
    it('should call onComplete when submitted', () => {
      // Test implementation
    });
  });

  // Property tests
  describe('properties', () => {
    /**
     * Feature: code-consistency-security-offline, Property 10: Cache-first
     * Validates: Requirements 4.1
     */
    it('should always check cache before network', () => {
      // Property test implementation
    });
  });
});
```



## Data Migration & Backward Compatibility

### Existing Data Preservation

**Critical Principle**: All existing data must be preserved during implementation. No data loss is acceptable.

**Existing Data to Preserve:**
1. **User Accounts**: All staff accounts in the database (staff table)
2. **Patient Records**: All patient demographics, medical history, and care information
3. **Care Plans**: All existing care plans with problems, goals, and interventions
4. **Clinical Notes**: All historical clinical documentation
5. **Medication Records**: All medication administration records with hash chains
6. **Vital Signs**: All historical vital sign measurements
7. **Assessments**: All Barthel Index, fall risk, and other assessments
8. **Audit Logs**: All historical audit trail entries

### Database Schema Changes

**No Breaking Changes**: All database schema modifications must be additive only.

**Allowed Changes:**
- Adding new columns with DEFAULT values or NULL allowed
- Adding new tables for new features
- Adding new indexes for performance
- Adding new constraints that don't affect existing data

**Prohibited Changes:**
- Dropping existing columns
- Changing column types that would lose data
- Adding NOT NULL constraints to existing columns without defaults
- Renaming tables or columns (unless with migration script)

### Cache Structure Versioning

**Cache Version Management:**
```typescript
const CACHE_VERSION = 2; // Increment when cache structure changes

async function getCachedData<T>(key: string): Promise<T | null> {
  const cached = await AsyncStorage.getItem(key);
  if (!cached) return null;

  const parsed = JSON.parse(cached);
  
  // Check version compatibility
  if (parsed.version !== CACHE_VERSION) {
    console.log(`Cache version mismatch (${parsed.version} vs ${CACHE_VERSION}), clearing cache`);
    await clearCache();
    return null; // Trigger fresh fetch from backend
  }

  return parsed.data;
}
```

**Cache Migration Strategy:**
- Detect version mismatches
- Clear incompatible cache
- Trigger automatic re-fetch from backend
- No manual migration needed (cache is ephemeral)

### Authentication Session Migration

**Session Persistence Compatibility:**
- New session format must be able to read old session format
- Add new fields with optional types
- Provide fallback values for missing fields
- Maintain backward compatibility for at least 2 versions

**Example Migration:**
```typescript
interface OldAuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface NewAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date; // NEW FIELD
}

async function migrateAuthTokens(old: OldAuthTokens): Promise<NewAuthTokens> {
  return {
    ...old,
    expiresAt: new Date(Date.now() + 3600000) // Default 1 hour
  };
}
```

### UI Change Policy

**Minimize UI Changes**: Implement features with minimal UI modifications.

**UI Changes Requiring Approval:**
- New screens or navigation changes
- Modified screen layouts
- Changed button positions or labels
- New UI components that affect user workflow

**UI Changes NOT Requiring Approval:**
- Internal component refactoring (same visual appearance)
- Performance optimizations (same UI)
- Bug fixes (restoring intended behavior)
- Accessibility improvements (same visual design)

**UI Change Documentation:**
Before implementing any UI change, document:
1. What is changing (screenshots if possible)
2. Why the change is necessary
3. Impact on user workflow
4. Alternative approaches considered

## Migration Strategy

### Phase 1: Foundation (Week 1-2)

**Goal**: Establish core infrastructure without breaking existing functionality

1. **Enhance Authentication**
   - Add session persistence to authStore
   - Implement automatic token refresh
   - Add offline session restoration
   - Test: Login → Close app → Reopen → Verify session restored

2. **Implement Secure Cache**
   - Create SecureCache class with encryption
   - Add user-scoped data isolation
   - Implement cache metadata tracking
   - Test: User A cannot access User B's data

3. **Enhance Network Service**
   - Add connectivity change listeners
   - Implement reconnection detection
   - Add sync trigger on reconnection
   - Test: Offline → Online → Verify sync triggered

### Phase 2: Offline-First (Week 3-4)

**Goal**: Enable full offline operation for core workflows

1. **Update API Service**
   - Add cache-first logic to all read operations
   - Implement background refresh
   - Add pending sync queue
   - Test: Offline → Read data → Verify cache used

2. **Implement Cache Warming**
   - Add cache warming on login
   - Implement per-patient data warming
   - Add manual refresh trigger
   - Test: Login → Verify all data cached

3. **Update Care Plan Store**
   - Add offline-first care plan operations
   - Implement conflict resolution
   - Add version tracking
   - Test: Offline → Modify care plan → Online → Verify synced

### Phase 3: BLE Enhancement (Week 5)

**Goal**: Support device-initiated BLE connections

1. **Update BLE Service**
   - Add device-initiated connection support
   - Implement pairing persistence
   - Add graceful disconnect handling
   - Test: Device broadcasts → App captures data → Device disconnects

2. **Add BLE Data Validation**
   - Implement checksum validation
   - Add range checking
   - Add user association
   - Test: Invalid data → Verify rejected

### Phase 4: Security Hardening (Week 6-7)

**Goal**: Implement comprehensive security measures

1. **Implement Audit Logging**
   - Add audit log creation for all data access
   - Implement hash chain for immutability
   - Add audit log querying
   - Test: Access data → Verify audit log created

2. **Enhance Medication Hash Chain**
   - Add hash chain validation
   - Implement tamper detection
   - Add verification UI
   - Test: Modify record → Verify chain broken

3. **Add Voice Processing Security**
   - Implement immediate encryption
   - Add secure deletion
   - Add transcription encryption
   - Test: Record voice → Verify encrypted

### Phase 5: Testing & Documentation (Week 8)

**Goal**: Comprehensive testing and documentation

1. **Implement Property Tests**
   - Write property tests for all 58 properties
   - Configure fast-check generators
   - Run 100 iterations per property
   - Test: All properties pass

2. **Integration Testing**
   - Write end-to-end tests for critical workflows
   - Test offline scenarios
   - Test BLE device integration
   - Test: All workflows pass

3. **Documentation**
   - Update API documentation
   - Write developer guides
   - Create troubleshooting guides
   - Document security practices

### Rollback Plan

If issues arise during migration:

1. **Feature Flags**: All new features behind feature flags
2. **Gradual Rollout**: Enable for 10% of users, monitor, then expand
3. **Monitoring**: Track error rates, performance metrics, user feedback
4. **Quick Rollback**: Disable feature flags if critical issues detected
5. **Data Safety**: All data changes backward-compatible

### Success Criteria

- ✅ All 58 correctness properties pass property tests
- ✅ 80%+ unit test coverage
- ✅ All integration tests pass
- ✅ Zero data loss during migration
- ✅ Offline operation works for 8+ hours
- ✅ BLE devices connect reliably
- ✅ Authentication session persists across restarts
- ✅ No performance degradation
- ✅ Security audit passes
- ✅ User acceptance testing passes

