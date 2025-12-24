# Demo Readiness Fix - Backend Connectivity

## Current Status
- ✅ Mac Mini server is running and accessible
- ✅ Login endpoint works perfectly
- ❌ iPad app getting "Network Error" 
- ❌ iOS Settings not visible to user
- ❌ pn51 (default server) is unplugged

## Immediate Demo Fix Applied

### 1. App Initialization Fix
Updated `ipad-app/App.tsx` to force Mac Mini server during app initialization:
```typescript
// FOR DEMO: Force Mac Mini server since pn51 is unplugged
await nativeSettingsService.writeNativeSettingsForTesting({
  backendServerAddress: 'https://verbumcarenomac-mini.local/api',
  connectionTimeout: 120,
  autoSwitchOnFailure: true,
  enableDetailedLogging: false
});
```

### 2. What This Does
- Forces the app to use Mac Mini server instead of pn51 default
- Bypasses the iOS Settings visibility issue
- Ensures login will work for the demo

## For Production Use - iOS Settings Fix

### Root Cause: Settings.bundle Not Visible
The Settings.bundle exists but iOS Settings may not be showing it due to:
1. **Build cache issue** - Settings.bundle not included in app bundle
2. **iOS Settings cache** - Old configuration cached
3. **Xcode project issue** - Settings.bundle not properly referenced

### Fix Steps:

#### 1. Clean Build and Reinstall
```bash
cd ipad-app
npm run clean
# Delete app from device/simulator
# Rebuild and reinstall app
npm run ios
```

#### 2. Verify Settings.bundle in Build
Check that Settings.bundle is included in the app bundle:
- Open Xcode
- Check Build Phases > Copy Bundle Resources
- Ensure Settings.bundle is listed

#### 3. iOS Settings Cache Clear
- Go to iOS Settings > General > iPhone Storage
- Find VerbumCare app
- Delete app completely
- Reinstall from Xcode

#### 4. Test iOS Settings
After reinstall:
- Go to iOS Settings
- Look for "VerbumCare" section
- Should see "Backend Server Configuration" options
- Select "Mac Mini Production"

## Verification Steps

### 1. Test Current Fix
```bash
# Test Mac Mini connectivity
curl -k "https://verbumcarenomac-mini.local/health"
curl -k -X POST "https://verbumcarenomac-mini.local/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123"}'
```

### 2. Test App Login
- Launch iPad app
- Try login with demo/demo123
- Should connect to Mac Mini successfully

## Demo Day Checklist
- [x] Mac Mini server running and healthy
- [x] App forced to use Mac Mini server
- [x] Login endpoint tested and working
- [ ] Test app login on iPad
- [ ] Verify patient data loads
- [ ] Test core workflows

## Post-Demo Tasks
1. Fix iOS Settings visibility properly
2. Remove forced server selection from App.tsx
3. Test backend switching functionality
4. Document proper iOS Settings configuration

## Emergency Rollback
If issues persist, can temporarily:
1. Start pn51 server as backup
2. Or use localhost development proxy
3. Or hardcode Mac Mini in API_CONFIG