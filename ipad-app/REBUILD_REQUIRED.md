# App Rebuild Required

## ⚠️ Important: Monitoring Screens Added

The care plan monitoring features (QuickProgressUpdate and MonitoringForm) were recently added but require rebuilding the app to work properly.

## Why Rebuild?

When you see "Coming Soon" for monitoring features, it means the app is running an old build from before these screens were added.

## How to Rebuild

### Option 1: Development Build (Fast, for testing)

```bash
cd ipad-app

# Install dependencies (if not done)
npm install
npm install @react-native-community/slider

# For iOS Simulator
npx expo run:ios

# Or for physical iPad
npx expo run:ios --device
```

### Option 2: Expo Go (Fastest for quick testing)

```bash
cd ipad-app
npx expo start

# Then scan QR code with Expo Go app on iPad
```

**Note**: Expo Go may have limitations with native modules.

### Option 3: Production Build (EAS)

```bash
cd ipad-app

# Build for iOS
eas build --platform ios --profile development

# Install on device
# (Download from EAS build page and install via Apple Configurator or Testflight)
```

## What's New

After rebuild, you'll see in Care Plan Hub:

1. ✅ **Quick Progress** button (green) - Fast goal achievement updates
2. ✅ **Monitoring** button (orange) - Formal 3/6-month reviews

Both replace "Coming Soon" placeholders.

## Verify It Worked

1. Open app on iPad
2. Select a patient
3. Go to Patient Info → Care Plan
4. Look for "Quick Progress" and "Monitoring" buttons
5. Tap them - should open new screens, not "Coming Soon"

## Dependencies

The monitoring screens use:
- `@react-native-community/slider` - For progress sliders

Make sure it's installed:
```bash
npm install @react-native-community/slider
```

## Troubleshooting

### Still seeing "Coming Soon"?
- Clear app cache and rebuild
- Check you're running the latest code (git pull)
- Verify screens are in App.tsx navigator

### Screens crash on open?
- Check slider library is installed
- Check backend is running (for data)
- Check database has care plan data

### Can't find patient with care plan?
- Database is currently empty
- Need to create care plan first via CreateCarePlanScreen
- Or seed database with sample data

---

**Last Updated**: After commit `0fb967a` (Add care plan monitoring features)
