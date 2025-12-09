# Debugging Splash Screen Hang

The app is hanging on the splash screen. This is likely because:

1. **The `isLoading` state is stuck at `true`** in the auth store
2. **Network initialization is timing out**
3. **AsyncStorage is not accessible**

## Quick Fixes to Try

### Fix 1: Check Xcode Console for Errors

1. In Xcode, open the Console (View → Debug Area → Activate Console)
2. Look for errors related to:
   - AsyncStorage
   - Network requests
   - Auth initialization
   - Any red error messages

### Fix 2: Force Skip Loading State

If you need to get past the splash screen immediately, you can temporarily bypass the loading check:

1. Open `ipad-app/App.tsx`
2. Find this line (around line 155):
   ```typescript
   if (isLoading) {
   ```
3. Change it to:
   ```typescript
   if (false) {  // Temporarily disabled for debugging
   ```
4. Rebuild and install

This will skip the loading screen and show you the login page, which might reveal more errors.

### Fix 3: Clear App Data

The app might have corrupted AsyncStorage data:

1. Delete the app from iPad (long press → Remove App → Delete App)
2. Rebuild and install fresh:
   ```bash
   cd ipad-app
   npx expo run:ios --device
   ```

### Fix 4: Check Backend Connectivity

The app might be hanging trying to reach the backend:

1. On your iPad, open Safari
2. Navigate to: `https://verbumcare-lab.local/health`
3. You should see: `{"status":"healthy",...}`
4. If you get a certificate warning, tap "Show Details" → "visit this website"
5. Accept the certificate

If Safari can't reach the backend, the iPad and Mac need to be on the same network.

## Most Likely Cause

Based on the code, the most likely issue is:

**The iPad can't reach the backend server at `verbumcare-lab.local`**

This causes:
1. `networkService.initialize()` to hang waiting for network check
2. `checkAuth()` to timeout trying to validate tokens
3. App stuck showing splash screen

## Solution

### On iPad:
1. Settings → Wi-Fi → Make sure connected to same network as Mac
2. Safari → Navigate to `https://verbumcare-lab.local/health`
3. Accept the security certificate if prompted

### On Mac:
```bash
# Check backend is running
ssh verbumcare-lab.local "docker ps | grep backend"

# Check backend health
curl -k https://verbumcare-lab.local/health

# If backend not responding, restart it
ssh verbumcare-lab.local "cd /path/to/project && docker-compose restart backend"
```

### Then Rebuild App:
```bash
cd ipad-app
# Kill the app on iPad first
npx expo run:ios --device
```

## Debug Logging

To see what's happening, check the Xcode console for these log messages:

- `[Network] Initializing network monitoring...`
- `[Network] Initial state: ONLINE/OFFLINE`
- `✅ Auth session restored:` or `Token expired`
- `[App] User authenticated, starting cache warming...`

If you don't see these messages, the app is hanging before it gets to them.

## Emergency Bypass

If you just need to test the app and can't fix the backend connection:

1. Edit `ipad-app/src/stores/authStore.ts`
2. In the `checkAuth` function, add this at the very beginning:
   ```typescript
   checkAuth: async () => {
     // EMERGENCY BYPASS - Remove after debugging
     set({ isLoading: false, isAuthenticated: false });
     return;
     // ... rest of function
   ```

3. Rebuild

This will skip all auth checks and let you see the login screen.
