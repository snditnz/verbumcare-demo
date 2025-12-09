# Quick Fix Applied - Splash Screen Hang

I've added timeouts to prevent the app from hanging on initialization. The changes:

## Changes Made

### 1. App.tsx - Added Timeouts to Service Initialization
- Network service init: 5 second timeout
- Session persistence init: 3 second timeout  
- Socket init: wrapped in try-catch
- Template loading: 5 second timeout

All services will continue even if they timeout, allowing the app to work offline.

### 2. authStore.ts - Added Timeout to Auth Check
- AsyncStorage reads: 5 second timeout
- Always sets `isLoading: false` even on error
- Prevents infinite splash screen hang

## Rebuild Required

You need to rebuild the app for these changes to take effect:

```bash
cd ipad-app

# Option 1: Using Xcode (if it's already open with signing configured)
# Just press Cmd+R in Xcode

# Option 2: From terminal
npx expo run:ios --device
# Then select "Q's iPad" when prompted

# Option 3: Quick rebuild (if you've built before)
xcodebuild -workspace ios/VerbumCare.xcworkspace \
  -scheme VerbumCare \
  -configuration Debug \
  -destination 'platform=iOS,id=00008027-000C44191A22002E' \
  -derivedDataPath ios/build \
  -allowProvisioningUpdates
```

## What This Fixes

The app was hanging because:
1. `networkService.initialize()` was waiting indefinitely for network check
2. `checkAuth()` was waiting indefinitely for AsyncStorage
3. If either hung, `isLoading` stayed `true` forever

Now:
- All initialization has 3-5 second timeouts
- App continues even if services fail to initialize
- Splash screen will always disappear within ~10 seconds max
- You'll see the login screen even if backend is unreachable

## After Rebuild

Once rebuilt, the app should:
1. Show splash screen for max 10 seconds
2. Show login screen
3. You can login (if backend is reachable) or see error message (if not)

Check Xcode console for these messages:
- `Network initialization failed or timed out` - means network check timed out (OK)
- `Auth check timeout` - means AsyncStorage timed out (OK)
- `✅ Auth session restored` - means auth worked (GOOD)

## If Still Hanging

If it still hangs after rebuild, the issue is deeper (possibly React Native itself). In that case:

1. Delete app from iPad completely
2. Clean build:
   ```bash
   rm -rf ios/build
   rm -rf ~/Library/Developer/Xcode/DerivedData/VerbumCare-*
   ```
3. Rebuild fresh
