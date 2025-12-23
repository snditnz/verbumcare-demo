# Landscape Orientation Lock - Troubleshooting Guide

## Error: "Cannot find native module 'ExpoScreenOrientation'"

### What This Error Means

This error occurs when the app tries to access the `expo-screen-orientation` native module, but it's not available in the current runtime environment.

### Common Causes

1. **Running in Expo Go**: Expo Go doesn't support all native modules
2. **Running in Web Browser**: Web environment doesn't have native orientation APIs
3. **Development Server**: Some development environments don't have native bindings
4. **Missing Native Build**: The app hasn't been built with native code included

### Solutions

#### ✅ Solution 1: Use Development Build (Recommended)

The landscape orientation lock requires a **development build** with native code:

```bash
# Navigate to iPad app directory
cd ipad-app

# Create development build for iOS device
npx expo run:ios --device

# Or create development build for iOS simulator
npx expo run:ios
```

#### ✅ Solution 2: Verify Current Environment

Check what environment you're running in:

```bash
# In the app, check the console logs for:
# "Orientation support: { nativeModuleAvailable: true/false, ... }"
```

#### ✅ Solution 3: Use EAS Build (Production)

For production builds:

```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Build for iOS
eas build --platform ios --profile development
```

### How the App Handles This Error

The app has been updated with **graceful error handling**:

1. **Safe Detection**: Checks if native module is available before using it
2. **Fallback Behavior**: Uses static configuration from `app.json` when native module unavailable
3. **Clear Logging**: Provides informative console messages about orientation status
4. **Continued Operation**: App continues to work even without programmatic orientation control

### Verification Steps

#### 1. Check App Configuration

The app will work with landscape orientation even without the native module:

```bash
# Run the configuration test
node test-landscape-orientation.js
```

Expected output should show:
- ✅ app.json Configuration
- ✅ iOS Orientation Settings  
- ✅ Android Orientation Settings
- ✅ Screen Orientation Plugin

#### 2. Check Console Logs

When the app starts, look for these messages:

**✅ Native Module Available:**
```
[App] Orientation support: { nativeModuleAvailable: true, ... }
[App] ✅ Programmatic orientation lock successful
```

**📱 Fallback Mode (Expected in Expo Go):**
```
[App] Orientation support: { nativeModuleAvailable: false, ... }
[App] 📱 Using static configuration fallback for orientation control
[App] 📱 App will still maintain landscape orientation via app.json settings
```

#### 3. Test Orientation Behavior

Even without the native module, the app should:
- Start in landscape orientation
- Maintain landscape orientation when device is rotated
- Prevent portrait mode display

### Environment-Specific Behavior

| Environment | Native Module | Orientation Control | Notes |
|-------------|---------------|-------------------|-------|
| **Development Build** | ✅ Available | Full programmatic control | Recommended for testing |
| **Expo Go** | ❌ Not Available | Static configuration only | Expected behavior |
| **Web Browser** | ❌ Not Available | CSS-based control | Limited functionality |
| **Production Build** | ✅ Available | Full programmatic control | Final deployment |

### Quick Fixes

#### Fix 1: Clear Cache and Rebuild

```bash
cd ipad-app
npm run clean
npm install
npx expo prebuild --clean
npx expo run:ios --device
```

#### Fix 2: Verify Plugin Installation

```bash
cd ipad-app
npm list expo-screen-orientation
# Should show: expo-screen-orientation@9.0.8
```

#### Fix 3: Check app.json Configuration

Ensure `app.json` contains:

```json
{
  "expo": {
    "orientation": "landscape",
    "plugins": ["expo-screen-orientation"],
    "ios": {
      "infoPlist": {
        "UISupportedInterfaceOrientations": [
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight"
        ]
      }
    }
  }
}
```

### Testing Without Native Module

You can test the app's orientation behavior even in Expo Go:

1. **Start the app** in Expo Go
2. **Rotate the device** to portrait
3. **Verify** the app display remains in landscape layout
4. **Check** that UI elements are properly arranged for landscape

The static configuration should prevent portrait mode even without programmatic control.

### When to Be Concerned

**🚨 Contact Support If:**
- App displays in portrait mode on physical device
- Landscape layout is broken or distorted  
- Orientation changes unexpectedly during use
- Static configuration tests fail

**✅ Normal Behavior:**
- "Cannot find native module" error in Expo Go
- Fallback messages in console logs
- App working correctly in landscape despite error

### Production Deployment

For production deployment:

1. **Always use development builds** (`npx expo run:ios --device`)
2. **Test on physical devices** before release
3. **Verify orientation lock** works in production environment
4. **Monitor** for orientation-related user reports

### Summary

The "Cannot find native module 'ExpoScreenOrientation'" error is **expected and handled gracefully** in development environments like Expo Go. The app will continue to work correctly with landscape orientation through the static configuration in `app.json`.

For full functionality and testing, use a development build with `npx expo run:ios --device`.