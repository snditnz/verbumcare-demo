# Simple Build Steps

The Xcode "PIF transfer session" error means Xcode is locked. Here's the simplest way forward:

## Option 1: Let Xcode Configure Signing (Recommended)

1. **Close all Xcode windows** (make sure it's fully quit)

2. **Open the project in Xcode:**
   ```bash
   open ios/VerbumCare.xcworkspace
   ```

3. **Configure signing in Xcode:**
   - Click on "VerbumCare" project in the left sidebar
   - Click on "VerbumCare" target (under TARGETS)
   - Click "Signing & Capabilities" tab at the top
   - Check the box "Automatically manage signing"
   - Select your team from the "Team" dropdown (should show your Apple ID email)
   - You should see "Provisioning Profile" and "Signing Certificate" appear below

4. **Close Xcode** (Cmd+Q)

5. **Build from terminal:**
   ```bash
   ./configure-and-build.sh
   ```
   
   Or manually:
   ```bash
   npx expo run:ios --device --configuration Debug
   ```
   
   When prompted, select "Q's iPad"

## Option 2: Quick Manual Fix

If you're comfortable editing project files:

1. Find your Team ID:
   ```bash
   security find-identity -v -p codesigning | grep "Apple Development"
   ```
   
   Look for a line like: `Apple Development: your@email.com (XXXXXXXXXX)`
   The Team ID is the 10-character code in parentheses.

2. Edit `ios/VerbumCare.xcodeproj/project.pbxproj`:
   - Search for `DEVELOPMENT_TEAM = "";` (appears twice)
   - Replace both with `DEVELOPMENT_TEAM = "YOUR_TEAM_ID";`
   - Also add `CODE_SIGN_STYLE = Automatic;` on the line after each one

3. Build:
   ```bash
   npx expo run:ios --device
   ```

## After Build Succeeds

1. **Trust the developer certificate on iPad:**
   - Settings → General → VPN & Device Management
   - Find your developer profile
   - Tap "Trust" → Confirm "Trust"

2. **Launch the app** from iPad home screen

3. **Test the new features:**
   - Login: nurse1/nurse1
   - Wait for cache warming (30-60 seconds loading screen)
   - Test offline: Enable airplane mode, navigate around
   - Test persistence: Close app, reopen, should stay logged in
   - Check medications: Look for hash verification badge

## Troubleshooting

**"operation in progress" error:**
- Quit Xcode completely
- Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/VerbumCare-*`
- Try again

**"Signing requires a development team":**
- You must configure signing in Xcode (Option 1 above)

**App crashes on launch:**
- Check that backend is running: `curl https://verbumcare-lab.local/api/health`
- Check iPad can reach backend: ping verbumcare-lab.local from iPad browser
