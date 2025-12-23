#!/bin/bash

# VerbumCare iPad App Deployment Script
# Handles full native build deployment for system changes

set -e  # Exit on any error

echo "🚀 VerbumCare iPad App Deployment"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "ipad-app/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Navigate to iPad app directory
cd ipad-app

echo "📋 Pre-deployment checks..."

# Check if iPad is connected
echo "📱 Detecting connected iPad..."
DEVICE_ID=$(xcrun xctrace list devices 2>&1 | grep -i "ipad" | grep -o '\([0-9A-F]\{8\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{12\}\)' | head -1)

if [ -z "$DEVICE_ID" ]; then
    echo "❌ No iPad detected. Please:"
    echo "   1. Connect your iPad via USB"
    echo "   2. Trust this computer on iPad"
    echo "   3. Run this script again"
    exit 1
fi

echo "✅ Found iPad: $DEVICE_ID"

# Check environment configuration
echo "🔧 Checking environment configuration..."

# The app uses dynamic server switching - no hardcoded server URLs needed
# Users can choose their backend server through:
# 1. iOS Settings app (VerbumCare section)
# 2. In-app Settings → Server Configuration

if [ -f ".env.local" ]; then
    echo "✅ Using existing .env.local configuration"
    # Check if it has any API URL (for connectivity testing only)
    API_URL=$(grep "EXPO_PUBLIC_API_URL" .env.local | cut -d'=' -f2 2>/dev/null || echo "")
else
    echo "ℹ️  No .env.local found - app will use default server configuration"
    echo "   Users can choose their backend server in Settings after deployment"
    API_URL=""
fi

echo "ℹ️  Server selection: User-configurable via iOS Settings or in-app Settings"

# Check backend connectivity (optional - only if API_URL is configured)
if [ -n "$API_URL" ]; then
    echo "🌐 Testing backend connectivity (optional check)..."
    if curl -k -s --connect-timeout 10 "$API_URL/health" > /dev/null; then
        echo "✅ Backend is reachable at $API_URL"
    else
        echo "ℹ️  Backend not reachable at $API_URL (this is OK - users can configure server in Settings)"
    fi
else
    echo "ℹ️  No API URL configured - users will choose backend server in Settings"
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
echo "   - Removing node_modules..."
rm -rf node_modules

echo "   - Clearing Expo cache..."
rm -rf .expo

echo "   - Clearing iOS build artifacts..."
rm -rf ios/build ios/Pods

echo "   - Clearing Metro cache..."
watchman watch-del-all 2>/dev/null || true
rm -rf $TMPDIR/react-* $TMPDIR/metro-* $TMPDIR/haste-map-* 2>/dev/null || true

echo "   - Clearing npm cache..."
npm cache clean --force

echo "📦 Installing dependencies..."
npm install

echo "🔨 Pre-building native code..."
npx expo prebuild --clean

echo "🏗️  Building and deploying to iPad..."
echo "   This will take 5-10 minutes..."
echo ""

# Build with detailed logging
npx expo run:ios --device --configuration Debug 2>&1 | tee build.log

BUILD_EXIT_CODE=${PIPESTATUS[0]}

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📱 Next steps on your iPad:"
    echo "   1. Go to: Settings → General → VPN & Device Management"
    echo "   2. Find your developer profile under 'Developer App'"
    echo "   3. Tap 'Trust [Your Name]' and confirm"
    echo "   4. Launch VerbumCare from the home screen"
    echo ""
    echo "🔧 Configure backend server:"
    echo "   Option 1 - iOS Settings:"
    echo "     • Go to: iPad Settings → VerbumCare"
    echo "     • Set 'Backend Server' to your preferred server"
    echo "   Option 2 - In-app Settings:"
    echo "     • Open VerbumCare → Settings → Server Configuration"
    echo "     • Choose from: Mac Mini, pn51 Legacy, or Development Proxy"
    echo ""
    echo "🧪 Testing checklist:"
    echo "   ✓ Login with: nurse1/nurse1"
    echo "   ✓ Wait for cache warming (30-60 seconds)"
    echo "   ✓ Test backend switching in Settings → Server Configuration"
    echo "   ✓ Test offline mode (airplane mode)"
    echo "   ✓ Check session persistence (close/reopen app)"
    echo "   ✓ Verify medication hash badges"
    echo "   ✓ Test voice recording and AI categorization"
    echo "   ✓ Test landscape orientation lock (should stay landscape)"
    echo "   ✓ Test BLE blood pressure monitor connectivity"
    echo "   ✓ Test multi-language support (EN/JA/ZH-TW)"
    echo "   ✓ Test secure cache and encryption features"
    echo ""
    echo "🔍 If issues occur:"
    echo "   - Check build.log for detailed error messages"
    echo "   - Configure backend server in Settings first"
    echo "   - Verify chosen backend server is running and accessible"
    echo "   - Check iPad network connectivity to backend"
    echo ""
else
    echo ""
    echo "❌ Build failed (exit code: $BUILD_EXIT_CODE)"
    echo ""
    echo "🔍 Common solutions:"
    echo ""
    echo "1. Code Signing Issues:"
    echo "   - Open Xcode: open ios/VerbumCare.xcworkspace"
    echo "   - Select VerbumCare project → VerbumCare target"
    echo "   - Go to 'Signing & Capabilities' tab"
    echo "   - Check 'Automatically manage signing'"
    echo "   - Select your Apple Developer team"
    echo "   - Close Xcode and run this script again"
    echo ""
    echo "2. Xcode Lock Issues:"
    echo "   - Quit Xcode completely (Cmd+Q)"
    echo "   - Delete derived data: rm -rf ~/Library/Developer/Xcode/DerivedData/VerbumCare-*"
    echo "   - Run this script again"
    echo ""
    echo "3. Device Issues:"
    echo "   - Disconnect and reconnect iPad"
    echo "   - Trust this computer again on iPad"
    echo "   - Ensure iPad is unlocked during build"
    echo ""
    echo "📋 Check build.log for detailed error information"
    exit 1
fi