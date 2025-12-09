# Security Best Practices

## Overview

VerbumCare implements comprehensive security measures to protect patient data and ensure compliance with healthcare regulations (HIPAA, PMDA). This guide covers security best practices for developers working on the platform.

## Authentication & Authorization

### Token Management

**JWT Token Security:**

```typescript
// ✅ Good - Secure token storage
import { SecureCache } from '@services/secureCache';

async function storeTokens(tokens: AuthTokens): Promise<void> {
  const cache = new SecureCache(userId);
  await cache.set('auth_tokens', tokens); // Automatically encrypted
}

// ❌ Bad - Insecure token storage
import AsyncStorage from '@react-native-async-storage/async-storage';

async function storeTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.setItem('tokens', JSON.stringify(tokens)); // Plaintext!
}
```

**Token Refresh:**

```typescript
// Automatic token refresh before expiration
async function checkTokenExpiry(): Promise<void> {
  const tokens = await getStoredTokens();
  if (!tokens) return;

  const expiresAt = new Date(tokens.expiresAt);
  const now = new Date();
  const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / 60000;

  // Refresh 5 minutes before expiration
  if (minutesUntilExpiry < 5 && minutesUntilExpiry > 0) {
    await refreshToken();
  }
}

// Run check every minute
setInterval(checkTokenExpiry, 60000);
```

**Session Timeout:**

```typescript
// Implement automatic session timeout
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours

let lastActivityTime = Date.now();

function updateActivity(): void {
  lastActivityTime = Date.now();
}

function checkSessionTimeout(): void {
  const inactiveTime = Date.now() - lastActivityTime;
  if (inactiveTime > SESSION_TIMEOUT) {
    logout();
    showMessage('Session expired due to inactivity');
  }
}

// Track user activity
document.addEventListener('touchstart', updateActivity);
document.addEventListener('keypress', updateActivity);

// Check timeout every minute
setInterval(checkSessionTimeout, 60000);
```

### Logout Security

**Complete Data Cleanup:**

```typescript
async function logout(): Promise<void> {
  try {
    // 1. Invalidate tokens on server
    await apiService.logout();
  } catch (error) {
    console.error('Server logout failed:', error);
    // Continue with local cleanup even if server call fails
  }

  // 2. Clear all cached data
  await cacheService.clearCache();

  // 3. Clear secure storage
  const cache = new SecureCache(userId);
  await cache.clear();

  // 4. Clear session data
  await cacheService.clearSessionData();

  // 5. Clear pending sync queue
  await cacheService.clearPendingSync();

  // 6. Reset all stores
  authStore.getState().reset();
  carePlanStore.getState().reset();
  clinicalNotesStore.getState().reset();

  // 7. Navigate to login
  navigation.navigate('Login');
}
```

### Role-Based Access Control

**Enforce Permissions:**

```typescript
type Permission = 
  | 'view_patients'
  | 'edit_patients'
  | 'view_medications'
  | 'administer_medications'
  | 'view_care_plans'
  | 'edit_care_plans'
  | 'view_audit_logs'
  | 'manage_staff';

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  nurse: [
    'view_patients',
    'edit_patients',
    'view_medications',
    'administer_medications',
    'view_care_plans',
    'edit_care_plans'
  ],
  care_worker: [
    'view_patients',
    'view_medications',
    'view_care_plans'
  ],
  care_manager: [
    'view_patients',
    'edit_patients',
    'view_medications',
    'view_care_plans',
    'edit_care_plans',
    'view_audit_logs',
    'manage_staff'
  ],
  doctor: [
    'view_patients',
    'edit_patients',
    'view_medications',
    'administer_medications',
    'view_care_plans',
    'edit_care_plans'
  ],
  therapist: [
    'view_patients',
    'view_care_plans',
    'edit_care_plans'
  ],
  dietitian: [
    'view_patients',
    'view_care_plans',
    'edit_care_plans'
  ]
};

function hasPermission(user: User, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[user.role];
  return permissions.includes(permission);
}

// Use in components
function MedicationAdminScreen(): JSX.Element {
  const { currentUser } = useAuthStore();

  if (!hasPermission(currentUser, 'administer_medications')) {
    return <AccessDeniedScreen />;
  }

  return <MedicationAdminContent />;
}

// Use in API calls
async function administerMedication(data: MedicationAdmin): Promise<void> {
  if (!hasPermission(currentUser, 'administer_medications')) {
    throw new Error('Insufficient permissions');
  }

  await apiService.administerMedication(data);
}
```

## Data Encryption

### Encrypted Cache

**Always Use SecureCache:**

```typescript
// ✅ Good - Encrypted storage
import { SecureCache } from '@services/secureCache';

async function storePatientData(patientId: string, data: Patient): Promise<void> {
  const cache = new SecureCache(userId);
  await cache.set(`patient_${patientId}`, data);
}

// ❌ Bad - Plaintext storage
import AsyncStorage from '@react-native-async-storage/async-storage';

async function storePatientData(patientId: string, data: Patient): Promise<void> {
  await AsyncStorage.setItem(`patient_${patientId}`, JSON.stringify(data));
}
```

**User-Scoped Encryption:**

```typescript
// Each user has separate encrypted namespace
const userACache = new SecureCache('user-a-id');
const userBCache = new SecureCache('user-b-id');

// User A's data
await userACache.set('patients', patientsA);

// User B cannot access User A's data
const result = await userBCache.get('patients'); // Returns null
```

### Voice Recording Encryption

**Immediate Encryption:**

```typescript
import { encryptVoiceRecording } from '@services/voiceEncryption';

async function handleRecordingComplete(audioUri: string): Promise<void> {
  // 1. Encrypt immediately after recording
  const encryptedUri = await encryptVoiceRecording(audioUri);

  // 2. Delete original unencrypted file
  await FileSystem.deleteAsync(audioUri);

  // 3. Upload encrypted file
  await apiService.uploadVoiceRecording(encryptedUri, patientId, userId);

  // 4. Delete encrypted file after upload
  await FileSystem.deleteAsync(encryptedUri);
}
```

### Transcription Encryption

**Encrypt Before Storage:**

```typescript
// Backend: Encrypt transcription before database storage
import { encrypt } from './utils/crypto.js';

async function storeTranscription(recordingId, transcription) {
  const encryptedText = encrypt(transcription);
  
  await db.query(
    'UPDATE voice_recordings SET transcription = $1 WHERE recording_id = $2',
    [encryptedText, recordingId]
  );
}

// Backend: Decrypt when retrieving
async function getTranscription(recordingId) {
  const result = await db.query(
    'SELECT transcription FROM voice_recordings WHERE recording_id = $1',
    [recordingId]
  );
  
  const decryptedText = decrypt(result.rows[0].transcription);
  return decryptedText;
}
```

## Network Security

### HTTPS/TLS

**Always Use HTTPS:**

```typescript
// ✅ Good - HTTPS endpoint
const API_BASE_URL = 'https://verbumcare-lab.local/api';

// ❌ Bad - HTTP endpoint
const API_BASE_URL = 'http://verbumcare-lab.local/api';
```

**Certificate Pinning (Production):**

```typescript
// iOS: Info.plist
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSPinnedDomains</key>
  <dict>
    <key>verbumcare.com</key>
    <dict>
      <key>NSIncludesSubdomains</key>
      <true/>
      <key>NSPinnedCAIdentities</key>
      <array>
        <dict>
          <key>SPKI-SHA256-BASE64</key>
          <string>YOUR_CERTIFICATE_HASH</string>
        </dict>
      </array>
    </dict>
  </dict>
</dict>
```

### Request Security

**Include Authentication:**

```typescript
// Axios interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const tokens = await getStoredTokens();
    if (tokens) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

**Validate Responses:**

```typescript
// Validate response structure
function validateResponse<T>(response: any, schema: Schema): T {
  const result = schema.safeParse(response);
  if (!result.success) {
    throw new Error('Invalid response format');
  }
  return result.data;
}

// Use with API calls
async function getPatient(id: string): Promise<Patient> {
  const response = await apiClient.get(`/patients/${id}`);
  return validateResponse<Patient>(response.data, PatientSchema);
}
```

## Audit Logging

### Log All Data Access

**Comprehensive Logging:**

```typescript
// Backend: Log all data access
async function logDataAccess(userId, action, resourceType, resourceId, details = {}) {
  await db.query(
    `INSERT INTO audit_logs (
      user_id, action, resource_type, resource_id, 
      details, ip_address, user_agent, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      userId,
      action,
      resourceType,
      resourceId,
      JSON.stringify(details),
      req.ip,
      req.headers['user-agent']
    ]
  );
}

// Use in routes
app.get('/patients/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  // Log access
  await logDataAccess(userId, 'VIEW', 'patient', id);

  const patient = await getPatient(id);
  res.json({ success: true, data: patient });
});
```

### Log Data Modifications

**Before/After Values:**

```typescript
// Backend: Log modifications with before/after
async function logDataModification(userId, resourceType, resourceId, before, after) {
  await db.query(
    `INSERT INTO audit_logs (
      user_id, action, resource_type, resource_id,
      before_value, after_value, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      userId,
      'MODIFY',
      resourceType,
      resourceId,
      JSON.stringify(before),
      JSON.stringify(after)
    ]
  );
}

// Use in update operations
app.put('/care-plans/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const updates = req.body;

  // Get current state
  const before = await getCarePlan(id);

  // Apply updates
  const after = await updateCarePlan(id, updates);

  // Log modification
  await logDataModification(userId, 'care_plan', id, before, after);

  res.json({ success: true, data: after });
});
```

### Immutable Audit Logs

**Hash Chain for Integrity:**

```typescript
// Backend: Create audit log with hash chain
async function createAuditLog(logData) {
  // Get previous log hash
  const previousLog = await db.query(
    'SELECT log_hash FROM audit_logs ORDER BY timestamp DESC LIMIT 1'
  );
  const previousHash = previousLog.rows[0]?.log_hash || '0'.repeat(64);

  // Calculate current log hash
  const logContent = JSON.stringify(logData);
  const currentHash = crypto
    .createHash('sha256')
    .update(previousHash + logContent)
    .digest('hex');

  // Insert with hash chain
  await db.query(
    `INSERT INTO audit_logs (
      user_id, action, resource_type, resource_id,
      details, previous_hash, log_hash, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      logData.userId,
      logData.action,
      logData.resourceType,
      logData.resourceId,
      JSON.stringify(logData.details),
      previousHash,
      currentHash
    ]
  );
}

// Verify audit log integrity
async function verifyAuditLogIntegrity() {
  const logs = await db.query(
    'SELECT * FROM audit_logs ORDER BY timestamp ASC'
  );

  let previousHash = '0'.repeat(64);
  for (const log of logs.rows) {
    // Recalculate hash
    const logContent = JSON.stringify({
      userId: log.user_id,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      details: log.details
    });
    const expectedHash = crypto
      .createHash('sha256')
      .update(previousHash + logContent)
      .digest('hex');

    // Verify hash matches
    if (log.log_hash !== expectedHash) {
      console.error(`Audit log integrity violation at log ${log.log_id}`);
      return false;
    }

    previousHash = log.log_hash;
  }

  return true;
}
```

## Medication Hash Chain

### Cryptographic Integrity

**Create Hash Chain:**

```typescript
// Backend: Create medication administration with hash chain
async function createMedicationAdmin(adminData) {
  // Get previous administration hash
  const previousAdmin = await db.query(
    `SELECT record_hash FROM medication_administrations 
     WHERE patient_id = $1 
     ORDER BY administered_at DESC LIMIT 1`,
    [adminData.patient_id]
  );
  const previousHash = previousAdmin.rows[0]?.record_hash || '0'.repeat(64);

  // Calculate current record hash
  const recordContent = JSON.stringify({
    patient_id: adminData.patient_id,
    order_id: adminData.order_id,
    administered_by: adminData.administered_by,
    administered_at: adminData.administered_at,
    dose_given: adminData.dose_given,
    route: adminData.route
  });
  const recordHash = crypto
    .createHash('sha256')
    .update(previousHash + recordContent)
    .digest('hex');

  // Insert with hash chain
  await db.query(
    `INSERT INTO medication_administrations (
      patient_id, order_id, administered_by, administered_at,
      dose_given, route, previous_hash, record_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      adminData.patient_id,
      adminData.order_id,
      adminData.administered_by,
      adminData.administered_at,
      adminData.dose_given,
      adminData.route,
      previousHash,
      recordHash
    ]
  );
}
```

**Verify Hash Chain:**

```typescript
// Backend: Verify medication hash chain
async function verifyMedicationHashChain(patientId) {
  const records = await db.query(
    `SELECT * FROM medication_administrations 
     WHERE patient_id = $1 
     ORDER BY administered_at ASC`,
    [patientId]
  );

  let previousHash = '0'.repeat(64);
  const violations = [];

  for (const record of records.rows) {
    // Verify previous_hash matches
    if (record.previous_hash !== previousHash) {
      violations.push({
        recordId: record.admin_id,
        error: 'Previous hash mismatch',
        expected: previousHash,
        actual: record.previous_hash
      });
    }

    // Recalculate record hash
    const recordContent = JSON.stringify({
      patient_id: record.patient_id,
      order_id: record.order_id,
      administered_by: record.administered_by,
      administered_at: record.administered_at,
      dose_given: record.dose_given,
      route: record.route
    });
    const expectedHash = crypto
      .createHash('sha256')
      .update(previousHash + recordContent)
      .digest('hex');

    // Verify record_hash matches
    if (record.record_hash !== expectedHash) {
      violations.push({
        recordId: record.admin_id,
        error: 'Record hash mismatch',
        expected: expectedHash,
        actual: record.record_hash
      });
    }

    previousHash = record.record_hash;
  }

  return {
    valid: violations.length === 0,
    violations
  };
}
```

**Display Verification Status:**

```typescript
// iPad App: Show verification status
function MedicationHistoryScreen({ patientId }: Props): JSX.Element {
  const [verificationStatus, setVerificationStatus] = useState<'verified' | 'invalid' | 'checking'>('checking');

  useEffect(() => {
    async function checkIntegrity() {
      const result = await apiService.verifyMedicationHashChain(patientId);
      setVerificationStatus(result.valid ? 'verified' : 'invalid');
    }
    checkIntegrity();
  }, [patientId]);

  return (
    <View>
      <View style={styles.verificationBadge}>
        {verificationStatus === 'verified' && (
          <>
            <Icon name="shield-check" color="green" />
            <Text>Verified</Text>
          </>
        )}
        {verificationStatus === 'invalid' && (
          <>
            <Icon name="alert" color="red" />
            <Text>Integrity Violation Detected</Text>
          </>
        )}
      </View>
      {/* Medication history list */}
    </View>
  );
}
```

## BLE Device Security

### Device Verification

**Verify Device Identity:**

```typescript
// Only accept devices with valid service UUIDs
const VALID_SERVICE_UUIDS = [
  '00001810-0000-1000-8000-00805f9b34fb', // Blood Pressure Service
  '0000180d-0000-1000-8000-00805f9b34fb', // Heart Rate Service
  '00001809-0000-1000-8000-00805f9b34fb'  // Health Thermometer Service
];

async function verifyDevice(device: Device): Promise<boolean> {
  const services = await device.services();
  return services.some(service => 
    VALID_SERVICE_UUIDS.includes(service.uuid.toLowerCase())
  );
}

// Use in device discovery
async function handleDeviceDiscovered(device: Device): Promise<void> {
  const isValid = await verifyDevice(device);
  if (!isValid) {
    console.log('Rejected device with invalid service UUID');
    return;
  }

  // Proceed with connection
  await connectToDevice(device);
}
```

### Data Validation

**Validate BLE Data:**

```typescript
function validateBPReading(reading: BPReading): boolean {
  // Range checks
  if (reading.systolic < 50 || reading.systolic > 250) {
    console.error('Invalid systolic value:', reading.systolic);
    return false;
  }
  if (reading.diastolic < 30 || reading.diastolic > 150) {
    console.error('Invalid diastolic value:', reading.diastolic);
    return false;
  }
  if (reading.pulse < 30 || reading.pulse > 220) {
    console.error('Invalid pulse value:', reading.pulse);
    return false;
  }

  // Logical checks
  if (reading.systolic <= reading.diastolic) {
    console.error('Systolic must be greater than diastolic');
    return false;
  }

  return true;
}

// Use in data capture
async function captureBPReading(device: Device): Promise<void> {
  const reading = await readBPData(device);
  
  if (!validateBPReading(reading)) {
    showError('Invalid reading from device. Please try again.');
    return;
  }

  // Associate with user
  const readingWithUser = {
    ...reading,
    userId: currentUser.userId,
    timestamp: new Date()
  };

  await saveVitalSign(readingWithUser);
}
```

### User Association

**Always Associate with User:**

```typescript
// ✅ Good - Associates reading with user
async function saveBPReading(reading: BPReading): Promise<void> {
  const { currentUser } = useAuthStore.getState();
  
  await apiService.createVitalSign({
    patient_id: currentPatientId,
    recorded_by: currentUser.userId,
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    pulse: reading.pulse,
    device_id: reading.deviceId,
    device_model: reading.deviceModel,
    recorded_at: reading.timestamp
  });
}

// ❌ Bad - No user association
async function saveBPReading(reading: BPReading): Promise<void> {
  await apiService.createVitalSign({
    patient_id: currentPatientId,
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    pulse: reading.pulse
  });
}
```

## Input Validation

### Sanitize User Input

**Always Validate and Sanitize:**

```typescript
import { z } from 'zod';

// Define validation schema
const PatientUpdateSchema = z.object({
  family_name: z.string().min(1).max(50),
  given_name: z.string().min(1).max(50),
  age: z.number().int().min(0).max(120),
  room_number: z.string().regex(/^[A-Z0-9-]+$/),
  care_level: z.enum(['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'])
});

// Validate before processing
async function updatePatient(patientId: string, updates: any): Promise<void> {
  // Validate input
  const result = PatientUpdateSchema.safeParse(updates);
  if (!result.success) {
    throw new ValidationError('Invalid patient data', result.error);
  }

  // Process validated data
  await apiService.updatePatient(patientId, result.data);
}
```

### SQL Injection Prevention

**Use Parameterized Queries:**

```typescript
// ✅ Good - Parameterized query
async function getPatient(patientId: string): Promise<Patient> {
  const result = await db.query(
    'SELECT * FROM patients WHERE patient_id = $1',
    [patientId]
  );
  return result.rows[0];
}

// ❌ Bad - String concatenation (SQL injection risk!)
async function getPatient(patientId: string): Promise<Patient> {
  const result = await db.query(
    `SELECT * FROM patients WHERE patient_id = '${patientId}'`
  );
  return result.rows[0];
}
```

## Error Handling

### Don't Leak Sensitive Information

**Safe Error Messages:**

```typescript
// ✅ Good - Generic error message to user
try {
  await apiService.login(username, password);
} catch (error) {
  // Log detailed error for debugging
  console.error('Login failed:', error);
  
  // Show generic message to user
  showError('Login failed. Please check your credentials.');
}

// ❌ Bad - Exposes internal details
try {
  await apiService.login(username, password);
} catch (error) {
  // Exposes database structure, SQL queries, etc.
  showError(error.message);
}
```

### Log Errors Securely

**Sanitize Error Logs:**

```typescript
function logError(error: Error, context: any): void {
  // Remove sensitive data from context
  const sanitizedContext = {
    ...context,
    password: undefined,
    token: undefined,
    ssn: undefined,
    creditCard: undefined
  };

  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    context: sanitizedContext,
    timestamp: new Date().toISOString()
  });
}
```

## Compliance Checklist

### HIPAA Compliance

- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS 1.3)
- [ ] Access controls (role-based)
- [ ] Audit logging (all data access)
- [ ] Automatic session timeout (8 hours)
- [ ] Secure data deletion (on logout)
- [ ] User authentication (JWT tokens)
- [ ] Data backup and recovery
- [ ] Business Associate Agreement (BAA)

### PMDA Compliance (Japan)

- [ ] Medical device classification
- [ ] Clinical data integrity
- [ ] Adverse event reporting
- [ ] Japanese language support
- [ ] Quality management system
- [ ] Risk management (ISO 14971)
- [ ] Post-market surveillance

### ISO 27001 (Information Security)

- [ ] Information security policy
- [ ] Risk assessment
- [ ] Access control policy
- [ ] Cryptography policy
- [ ] Physical security
- [ ] Operations security
- [ ] Communications security
- [ ] Incident management
- [ ] Business continuity

## Security Testing

### Penetration Testing

**Test Authentication:**
- Brute force protection
- Token expiration
- Session hijacking
- CSRF protection

**Test Authorization:**
- Role-based access control
- Privilege escalation
- Horizontal access control
- Vertical access control

**Test Data Security:**
- Encryption at rest
- Encryption in transit
- Data leakage
- Secure deletion

**Test Input Validation:**
- SQL injection
- XSS attacks
- Command injection
- Path traversal

### Security Audit

**Regular Audits:**
1. Review audit logs for suspicious activity
2. Verify hash chain integrity
3. Check for unauthorized access attempts
4. Review user permissions
5. Verify encryption is working
6. Test backup and recovery procedures

## Resources

- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [React Native Security](https://reactnative.dev/docs/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
