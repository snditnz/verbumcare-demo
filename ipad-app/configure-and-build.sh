#!/bin/bash

# Script to configure code signing and build the iPad app

echo "🔧 Configuring code signing..."

# Use plutil to modify the project settings
# This is safer than sed for plist-like files

# First, let's use xcodebuild to set the team automatically
echo "📱 Detecting iPad..."
DEVICE_ID=$(xcrun xctrace list devices 2>&1 | grep -i "ipad" | grep -o '\([0-9A-F]\{8\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{12\}\)' | head -1)

if [ -z "$DEVICE_ID" ]; then
    echo "❌ No iPad detected. Please connect your iPad and try again."
    exit 1
fi

echo "✅ Found iPad: $DEVICE_ID"

# Build with Expo which handles signing better
echo "🏗️  Building app..."
echo "This will take several minutes..."

npx expo run:ios --device --configuration Debug

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "📱 Next steps:"
    echo "1. On your iPad, go to: Settings → General → VPN & Device Management"
    echo "2. Find your developer profile"
    echo "3. Tap 'Trust' and confirm"
    echo "4. Launch VerbumCare from the home screen"
    echo ""
    echo "🧪 Test checklist:"
    echo "  - Login with nurse1/nurse1"
    echo "  - Wait for cache warming (30-60 seconds)"
    echo "  - Test offline mode (airplane mode)"
    echo "  - Check session persistence (close/reopen)"
    echo "  - Verify hash badge on medications"
else
    echo ""
    echo "❌ Build failed"
    echo ""
    echo "If you see a code signing error, you need to:"
    echo "1. Open Xcode: open ios/VerbumCare.xcworkspace"
    echo "2. Select VerbumCare project → VerbumCare target"
    echo "3. Go to 'Signing & Capabilities' tab"
    echo "4. Check 'Automatically manage signing'"
    echo "5. Select your team"
    echo "6. Close Xcode and run this script again"
    exit 1
fi
