# iOS Settings Visibility Fix

## Problem
User reports that iOS Settings for VerbumCare are not visible - only seeing "Allow VerbumCare to Access" section instead of the backend server configuration options.

## Root Cause Analysis
1. **Settings.bundle exists** - ✅ Created with proper Root.plist
2. **Xcode project references** - ✅ Added to project.pbxproj
3. **App defaults to pn51** - ❌ pn51 is unplugged, causing "Network Error"
4. **iOS Settings not visible** - ❌ User can't switch to Mac Mini

## Critical Issue
The Settings.bundle may not be properly included in the app build, or there's a caching issue with iOS Settings.

## Immediate Actions Required

### 1. Verify Settings.bundle in Build
The Settings.bundle must be included in the app bundle for iOS Settings to show custom options.

### 2. Force iOS Settings Refresh
iOS Settings can cache old configurations. Need to:
- Clean build the app
- Delete app from device/simulator
- Reinstall app
- Check iOS Settings > VerbumCare

### 3. Test Native Settings Module
The native settings module might not be working correctly.

### 4. Provide Manual Override
Until iOS Settings work, provide a way for user to manually switch to Mac Mini.

## Demo Day Solution
Since demo is this afternoon and pn51 is unplugged:

1. **Immediate**: Update App.tsx to force Mac Mini for demo
2. **Proper**: Fix iOS Settings visibility for production use