# iPad App Build Instructions - Updated

## Issue Encountered

The app build is failing due to code signing configuration. The project needs a development team to be set for code signing.

## Quick Fix - Use Xcode

The easiest way to fix this is to open the project in Xcode and let it automatically configure signing:

1. Open the project in Xcode:
   ```bash
   open ios/VerbumCare.xcworkspace
   ```

2. In Xcode:
   - Select the "VerbumCare" project in the left sidebar
   - Select the "VerbumCare" target
   - Go to "Signing & Capabilities" tab
   - Check "Automatically manage signing"
   - Select your team from the dropdown (should show your Apple ID)

3. Close Xcode

4. Build and install to iPad:
   ```bash
   npx expo run:ios --device
   ```
   
   When prompted, select "Q's iPad"

## Alternative - Manual Configuration

If you prefer to configure manually, you need to find your Team ID:

```bash
# List your development teams
security find-identity -v -p codesigning
```

Then edit `ios/VerbumCare.xcodeproj/project.pbxproj` and replace:
```
DEVELOPMENT_TEAM = "";
```

With your actual team ID (10-character alphanumeric string).

## What's Been Fixed

1. ✅ Fixed `package.json` entry point (`main: "index.ts"`)
2. ✅ Cleared Metro bundler cache
3. ✅ Ran `expo prebuild --clean` successfully
4. ✅ Installed all CocoaPods dependencies
5. ⏳ Need to configure code signing (see above)

## After Signing is Configured

Once signing is set up, the build should complete successfully and install to your iPad. You'll then need to:

1. Trust the developer certificate on iPad:
   - Settings → General → VPN & Device Management
   - Find your developer profile
   - Tap "Trust" → Confirm

2. Launch the app from the iPad home screen

3. Test the new features:
   - Login with nurse1/nurse1
   - Wait for cache warming (30-60 seconds)
   - Test offline mode (airplane mode)
   - Check session persistence (close/reopen app)
   - Verify hash verification badge on medications
