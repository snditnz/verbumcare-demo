# Troubleshooting Guide

## Common Issues and Solutions

### Authentication Issues

#### Issue: Login fails with "Invalid credentials"

**Symptoms:**
- Login button shows error message
- Cannot access application

**Solutions:**

1. **Verify credentials are correct:**
   ```bash
   # Check user exists in database
   docker exec verbumcare-postgres psql -U demo -d verbumcare_demo -c \
     "SELECT username, role FROM staff WHERE username = 'your_username';"
   ```

2. **Check backend is running:**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"ok"}
   ```

3. **Verify network connectivity:**
   - Check iPad can reach backend server
   - Ping verbumcare-lab.local from iPad
   - Check firewall settings

4. **Check backend logs:**
   ```bash
   docker-compose logs -f backend
   # Look for authentication errors
   ```

#### Issue: Session not persisting after app restart

**Symptoms:**
- Must login again after closing app
- Session data lost

**Solutions:**

1. **Check SecureCache is working:**
   ```typescript
   // Add debug logging
   const cache = new SecureCache(userId);
   const tokens = await cache.get('auth_tokens');
   console.log('Stored tokens:', tokens);
   ```

2. **Verify cache version compatibility:**
   ```typescript
   const metadata = await cache.getMetadata();
   console.log('Cache version:', metadata.version);
   // Should match CACHE_VERSION constant
   ```

3. **Clear and re-login:**
   ```typescript
   await cacheService.clearCache();
   // Login again to repopulate cache
   ```

#### Issue: Token expired error

**Symptoms:**
- API calls fail with 401 Unauthorized
- "Token expired" error message

**Solutions:**

1. **Check token expiration:**
   ```typescript
   const tokens = await getStoredTokens();
   const expiresAt = new Date(tokens.expiresAt);
   const now = new Date();
   console.log('Token expires at:', expiresAt);
   console.log('Current time:', now);
   console.log('Expired:', expiresAt < now);
   ```

2. **Manually refresh token:**
   ```typescript
   await authStore.getState().refreshToken();
   ```

3. **Check automatic refresh is working:**
   ```typescript
   // Verify refresh interval is running
   // Should refresh 5 minutes before expiration
   ```

### Offline Mode Issues

#### Issue: Data not loading offline

**Symptoms:**
- Blank screens when offline
- "No data available" errors
- Loading spinners that never complete

**Solutions:**

1. **Check cache was populated:**
   ```typescript
   const stats = await cacheService.getCacheStats();
   console.log('Cache stats:', stats);
   // Should show cached items
   ```

2. **Verify cache warming completed:**
   ```typescript
   const metadata = await cache.getMetadata();
   console.log('Last sync:', metadata.lastSync);
   console.log('Record counts:', metadata.recordCounts);
   ```

3. **Manually warm cache:**
   ```typescript
   import { warmAllCaches } from '@services/cacheWarmer';
   await warmAllCaches(userId);
   ```

4. **Check cache expiry:**
   ```typescript
   const lastSync = await cacheService.getLastSyncTime();
   const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
   console.log('Hours since last sync:', hoursSinceSync);
   // Cache expires after 8 hours
   ```

#### Issue: Changes not syncing when back online

**Symptoms:**
- Offline changes not appearing on server
- Pending sync queue growing
- Sync errors in logs

**Solutions:**

1. **Check pending sync queue:**
   ```typescript
   const pending = await cacheService.getPendingSync();
   console.log('Pending items:', pending.length);
   console.log('Pending operations:', pending);
   ```

2. **Manually trigger sync:**
   ```typescript
   await processPendingSync();
   ```

3. **Check network connectivity:**
   ```typescript
   const isOnline = networkService.isConnected();
   console.log('Network status:', isOnline);
   ```

4. **Check for sync errors:**
   ```bash
   # Backend logs
   docker-compose logs -f backend | grep "sync"
   ```

5. **Clear and re-sync:**
   ```typescript
   // Last resort - clear pending queue and re-enter data
   await cacheService.clearPendingSync();
   ```

#### Issue: Cache growing too large

**Symptoms:**
- App using excessive storage
- Slow performance
- Out of storage errors

**Solutions:**

1. **Check cache size:**
   ```typescript
   const stats = await cacheService.getCacheStats();
   console.log('Cache item count:', stats.itemCount);
   ```

2. **Clear old cache:**
   ```typescript
   await cacheService.clearCache();
   // Login again to repopulate with fresh data
   ```

3. **Reduce cache expiry times:**
   ```typescript
   // In cacheService.ts
   const CACHE_EXPIRY = {
     patients: 4 * 60 * 60 * 1000, // Reduce from 8 to 4 hours
     schedules: 4 * 60 * 60 * 1000,
     // ...
   };
   ```

### BLE Device Issues

#### Issue: Cannot discover BLE devices

**Symptoms:**
- No devices appear in scan list
- "Scanning..." never completes
- Bluetooth permission errors

**Solutions:**

1. **Check Bluetooth permissions:**
   ```typescript
   const hasPermission = await bleService.requestPermissions();
   console.log('BLE permission granted:', hasPermission);
   ```

2. **Verify Bluetooth is enabled:**
   - Check iPad Settings > Bluetooth
   - Ensure Bluetooth is ON

3. **Check device is broadcasting:**
   - Verify device is powered on
   - Check device battery
   - Ensure device is in pairing mode

4. **Restart Bluetooth:**
   ```typescript
   await bleService.stopScan();
   // Wait a few seconds
   await bleService.startScan();
   ```

#### Issue: Device connects but no data received

**Symptoms:**
- Device shows as connected
- No readings appear
- Timeout errors

**Solutions:**

1. **Check device characteristics:**
   ```typescript
   const device = await bleService.connectedDevice;
   const services = await device.services();
   console.log('Device services:', services);
   
   for (const service of services) {
     const characteristics = await service.characteristics();
     console.log('Characteristics:', characteristics);
   }
   ```

2. **Verify correct service UUID:**
   ```typescript
   const BP_SERVICE_UUID = '00001810-0000-1000-8000-00805f9b34fb';
   // Ensure this matches your device
   ```

3. **Check data parsing:**
   ```typescript
   // Add debug logging in BLE service
   const rawData = await characteristic.read();
   console.log('Raw BLE data:', rawData);
   ```

4. **Try manual entry:**
   - Use manual entry fallback if device issues persist
   - Report device model for compatibility testing

#### Issue: Device disconnects immediately

**Symptoms:**
- Device connects then disconnects
- "Connection lost" errors
- Cannot maintain connection

**Solutions:**

1. **Check if device-initiated connection:**
   - Some devices broadcast data then disconnect (normal behavior)
   - Capture data immediately on connection

2. **Verify pairing:**
   ```typescript
   const isPaired = await bleService.isPreviouslyPaired(deviceId);
   console.log('Device paired:', isPaired);
   ```

3. **Check signal strength:**
   - Move iPad closer to device
   - Remove obstacles between devices

4. **Update device firmware:**
   - Check manufacturer website for firmware updates

### Network Issues

#### Issue: Cannot connect to backend

**Symptoms:**
- "Network error" messages
- API calls timeout
- Cannot reach server

**Solutions:**

1. **Check backend is running:**
   ```bash
   docker-compose ps
   # Should show backend and postgres as "Up"
   ```

2. **Verify network connectivity:**
   ```bash
   # From iPad, ping server
   ping verbumcare-lab.local
   ```

3. **Check API URL configuration:**
   ```typescript
   // In constants/config.ts
   console.log('API URL:', API_CONFIG.BASE_URL);
   // Should be: https://verbumcare-lab.local/api
   ```

4. **Check SSL certificate:**
   ```bash
   # Verify certificate is valid
   curl -k https://verbumcare-lab.local/api/health
   ```

5. **Check firewall:**
   ```bash
   # On server, check if port 443 is open
   sudo netstat -tlnp | grep 443
   ```

#### Issue: Slow API responses

**Symptoms:**
- Long loading times
- Timeouts
- Poor performance

**Solutions:**

1. **Check network latency:**
   ```bash
   ping -c 10 verbumcare-lab.local
   # Look for high latency or packet loss
   ```

2. **Check server resources:**
   ```bash
   # CPU usage
   docker stats
   
   # Memory usage
   free -h
   
   # Disk usage
   df -h
   ```

3. **Check database performance:**
   ```bash
   # Connect to database
   docker exec -it verbumcare-postgres psql -U demo -d verbumcare_demo
   
   # Check slow queries
   SELECT query, calls, total_time, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

4. **Enable caching:**
   - Ensure cache-first pattern is used
   - Verify cache is populated

### Voice Processing Issues

#### Issue: Voice recording fails

**Symptoms:**
- Cannot start recording
- Recording stops immediately
- Permission errors

**Solutions:**

1. **Check microphone permissions:**
   ```typescript
   import { Audio } from 'expo-av';
   const { status } = await Audio.requestPermissionsAsync();
   console.log('Microphone permission:', status);
   ```

2. **Verify audio session:**
   ```typescript
   await Audio.setAudioModeAsync({
     allowsRecordingIOS: true,
     playsInSilentModeIOS: true,
   });
   ```

3. **Check storage space:**
   ```bash
   # On iPad, check available storage
   # Settings > General > iPad Storage
   ```

#### Issue: Transcription not working

**Symptoms:**
- Recording uploads but no transcription
- Transcription shows as "processing" indefinitely
- Transcription errors

**Solutions:**

1. **Check Whisper service:**
   ```bash
   curl http://localhost:8080/health
   # Should return: {"status":"healthy"}
   ```

2. **Check Whisper logs:**
   ```bash
   # If running as systemd service
   sudo journalctl -u whisper-api -f
   
   # If running in Docker
   docker logs whisper-api
   ```

3. **Verify audio file format:**
   - Whisper expects WAV or MP3
   - Check file is not corrupted

4. **Check Ollama service:**
   ```bash
   curl http://localhost:11434/api/tags
   # Should list available models
   ```

5. **Manually process recording:**
   ```bash
   # Test Whisper directly
   curl -X POST http://localhost:8080/transcribe \
     -F "audio=@recording.wav" \
     -F "language=ja"
   ```

### Database Issues

#### Issue: Database connection errors

**Symptoms:**
- "Cannot connect to database" errors
- Backend fails to start
- Query timeouts

**Solutions:**

1. **Check PostgreSQL is running:**
   ```bash
   docker-compose ps postgres
   # Should show "Up"
   ```

2. **Check database credentials:**
   ```bash
   # In backend/.env
   cat backend/.env | grep DATABASE_URL
   # Should match docker-compose.yml
   ```

3. **Test database connection:**
   ```bash
   docker exec -it verbumcare-postgres psql -U demo -d verbumcare_demo
   # Should connect successfully
   ```

4. **Check database logs:**
   ```bash
   docker-compose logs -f postgres
   ```

5. **Restart database:**
   ```bash
   docker-compose restart postgres
   ```

#### Issue: Migration fails

**Symptoms:**
- Migration script errors
- Schema mismatch
- Data corruption

**Solutions:**

1. **Check migration status:**
   ```bash
   docker exec verbumcare-postgres psql -U demo -d verbumcare_demo -c \
     "SELECT * FROM schema_migrations ORDER BY version;"
   ```

2. **Manually run migration:**
   ```bash
   cd backend
   node src/db/run-migration.js
   ```

3. **Rollback and retry:**
   ```bash
   # Restore from backup
   docker exec -i verbumcare-postgres psql -U demo -d verbumcare_demo < backup.sql
   
   # Run migrations again
   node src/db/run-migration.js
   ```

4. **Check migration file syntax:**
   ```bash
   # Validate SQL syntax
   docker exec verbumcare-postgres psql -U demo -d verbumcare_demo \
     -f src/db/migrations/009_add_care_plan_versioning.sql --dry-run
   ```

### Performance Issues

#### Issue: App is slow or laggy

**Symptoms:**
- Slow screen transitions
- Laggy scrolling
- High memory usage
- App crashes

**Solutions:**

1. **Check memory usage:**
   ```typescript
   // Add performance monitoring
   import { PerformanceObserver } from 'react-native-performance';
   
   const observer = new PerformanceObserver((list) => {
     console.log('Performance entries:', list.getEntries());
   });
   observer.observe({ entryTypes: ['measure'] });
   ```

2. **Reduce cache size:**
   ```typescript
   await cacheService.clearCache();
   ```

3. **Optimize images:**
   - Compress images before upload
   - Use appropriate image sizes
   - Implement lazy loading

4. **Implement pagination:**
   ```typescript
   // Load data in chunks
   const PAGE_SIZE = 20;
   const patients = await apiService.getPatients({ 
     page: 1, 
     limit: PAGE_SIZE 
   });
   ```

5. **Profile performance:**
   ```bash
   # Use React DevTools Profiler
   # Identify slow components
   # Optimize render cycles
   ```

#### Issue: High battery drain

**Symptoms:**
- Battery drains quickly
- Device gets hot
- Background activity

**Solutions:**

1. **Check background tasks:**
   ```typescript
   // Reduce sync frequency
   const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes instead of 1 minute
   ```

2. **Disable unnecessary features:**
   - Turn off BLE scanning when not needed
   - Reduce location updates
   - Minimize network requests

3. **Optimize BLE usage:**
   ```typescript
   // Stop scanning when not needed
   await bleService.stopScan();
   
   // Disconnect devices when done
   await bleService.disconnect();
   ```

### Data Integrity Issues

#### Issue: Hash chain verification fails

**Symptoms:**
- "Integrity violation" warnings
- Medication records flagged as tampered
- Audit log errors

**Solutions:**

1. **Verify hash chain:**
   ```bash
   cd backend
   node src/scripts/verifyMedicationHashChain.js
   ```

2. **Check for database corruption:**
   ```bash
   docker exec verbumcare-postgres psql -U demo -d verbumcare_demo -c \
     "SELECT admin_id, previous_hash, record_hash 
      FROM medication_administrations 
      ORDER BY administered_at;"
   ```

3. **Restore from backup:**
   ```bash
   # If corruption detected, restore from last known good backup
   docker exec -i verbumcare-postgres psql -U demo -d verbumcare_demo < backup.sql
   ```

4. **Investigate tampering:**
   - Check audit logs for unauthorized access
   - Review user activity
   - Report security incident

#### Issue: Data sync conflicts

**Symptoms:**
- "Conflict detected" dialogs
- Data overwritten unexpectedly
- Version mismatches

**Solutions:**

1. **Check version numbers:**
   ```typescript
   const localVersion = localCarePlan.version;
   const serverVersion = serverCarePlan.version;
   console.log('Version conflict:', { localVersion, serverVersion });
   ```

2. **Use conflict resolution dialog:**
   - Review both versions
   - Choose which to keep
   - Merge changes if possible

3. **Implement better conflict prevention:**
   - Sync more frequently
   - Use optimistic locking
   - Add version checks before updates

### Testing Issues

#### Issue: Property tests failing

**Symptoms:**
- Property tests fail with counterexamples
- Tests timeout
- Random failures

**Solutions:**

1. **Review counterexample:**
   ```typescript
   // Property test will show failing input
   // Example: { patientId: "invalid-uuid", age: -5 }
   ```

2. **Fix generator constraints:**
   ```typescript
   // Ensure generators produce valid data
   const patientGenerator = fc.record({
     patientId: fc.uuid(), // Valid UUID
     age: fc.integer({ min: 0, max: 120 }) // Valid age range
   });
   ```

3. **Increase timeout:**
   ```typescript
   // In test file
   jest.setTimeout(30000); // 30 seconds
   ```

4. **Reduce iterations for debugging:**
   ```typescript
   fc.assert(
     fc.property(/* ... */),
     { numRuns: 10 } // Reduce from 100 for debugging
   );
   ```

#### Issue: Integration tests failing

**Symptoms:**
- End-to-end tests fail
- Cannot find elements
- Timing issues

**Solutions:**

1. **Check test environment:**
   ```bash
   # Ensure backend is running
   docker-compose ps
   
   # Ensure database is seeded
   cd backend && node src/db/seed.js
   ```

2. **Add wait conditions:**
   ```typescript
   // Wait for element to appear
   await waitFor(() => {
     expect(screen.getByText('Patient List')).toBeTruthy();
   }, { timeout: 5000 });
   ```

3. **Check test data:**
   ```typescript
   // Verify test data exists
   const patients = await apiService.getPatients();
   console.log('Test patients:', patients.length);
   ```

## Getting Help

### Debug Logging

Enable verbose logging:

```typescript
// In constants/config.ts
export const DEBUG = {
  API: true,
  CACHE: true,
  BLE: true,
  NETWORK: true,
  AUTH: true
};

// Use in services
if (DEBUG.API) {
  console.log('[API] Request:', method, url, data);
}
```

### Collect Diagnostic Information

```bash
# System information
uname -a
node --version
npm --version
docker --version

# Docker status
docker-compose ps
docker stats --no-stream

# Database status
docker exec verbumcare-postgres psql -U demo -d verbumcare_demo -c \
  "SELECT version();"

# Backend logs
docker-compose logs --tail=100 backend > backend-logs.txt

# Database logs
docker-compose logs --tail=100 postgres > postgres-logs.txt

# Network connectivity
ping -c 5 verbumcare-lab.local
curl -k https://verbumcare-lab.local/api/health
```

### Report Issues

When reporting issues, include:

1. **Description**: What were you trying to do?
2. **Expected behavior**: What should have happened?
3. **Actual behavior**: What actually happened?
4. **Steps to reproduce**: How can we reproduce the issue?
5. **Environment**: OS, device model, app version
6. **Logs**: Relevant log files and error messages
7. **Screenshots**: If applicable

### Contact Support

- **Email**: support@verbumcare.com
- **Documentation**: https://docs.verbumcare.com
- **GitHub Issues**: https://github.com/verbumcare/verbumcare-demo/issues

## Preventive Maintenance

### Regular Tasks

**Daily:**
- Check backend logs for errors
- Verify database backups completed
- Monitor disk space usage

**Weekly:**
- Review audit logs for suspicious activity
- Verify hash chain integrity
- Check for software updates

**Monthly:**
- Full database backup
- Security audit
- Performance review
- Update documentation

### Monitoring

Set up monitoring for:
- Backend uptime
- Database connections
- API response times
- Error rates
- Storage usage
- Network connectivity

### Backup Strategy

```bash
# Daily automated backup
0 2 * * * /path/to/backup-script.sh

# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
docker exec verbumcare-postgres pg_dump -U demo verbumcare_demo > \
  /backups/verbumcare_$DATE.sql
gzip /backups/verbumcare_$DATE.sql

# Keep last 30 days
find /backups -name "verbumcare_*.sql.gz" -mtime +30 -delete
```
