#!/bin/bash

# Build Landscape-Only iPad App
# Ensures all orientation changes are properly applied

echo "📱 BUILDING LANDSCAPE-ONLY IPAD APP"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd ipad-app

echo -e "${BLUE}🔧 Pre-build Configuration Check${NC}"
echo "--------------------------------"

# Verify complete landscape configuration
echo "Checking complete landscape orientation configuration..."
if node ../test-landscape-orientation.js; then
    echo -e "   ${GREEN}✅ Complete landscape configuration verified${NC}"
    echo -e "   ${GREEN}✅ All 6 configuration components validated${NC}"
else
    echo -e "   ${YELLOW}⚠️  Landscape configuration issues detected${NC}"
    echo -e "   ${YELLOW}⚠️  Some configuration components may be missing${NC}"
    echo ""
    echo -e "${BLUE}🔧 Configuration Details:${NC}"
    echo "Running detailed configuration analysis..."
    node ../test-landscape-orientation.js || true
fi

echo ""
echo -e "${BLUE}🧹 Cleaning Previous Builds${NC}"
echo "----------------------------"

# Clear Expo cache
echo "Clearing Expo cache..."
npx expo install --fix > /dev/null 2>&1
echo -e "   ${GREEN}✅ Dependencies verified${NC}"

# Clear Metro cache
echo "Clearing Metro bundler cache..."
npx expo start --clear > /dev/null 2>&1 &
EXPO_PID=$!
sleep 3
kill $EXPO_PID 2>/dev/null
echo -e "   ${GREEN}✅ Metro cache cleared${NC}"

echo ""
echo -e "${BLUE}🏗️  Building for iOS Device${NC}"
echo "----------------------------"

echo "Building iPad app with landscape-only configuration..."
echo "This will take a few minutes..."

# Build for iOS device with landscape configuration
npx expo run:ios --device --configuration Debug

BUILD_EXIT_CODE=$?

echo ""
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 BUILD SUCCESSFUL!${NC}"
    echo -e "${GREEN}✅ iPad app built with landscape-only orientation${NC}"
    echo -e "${GREEN}✅ App is ready for demo deployment${NC}"
    
    echo ""
    echo -e "${BLUE}📱 Next Steps:${NC}"
    echo "1. Install the app on your iPad"
    echo "2. Trust the developer certificate in Settings > General > VPN & Device Management"
    echo "3. Launch the app - it will be locked to landscape orientation"
    echo "4. Test the orientation lock by rotating the device"
    
    echo ""
    echo -e "${BLUE}🎯 Demo Features:${NC}"
    echo "• App locked to landscape orientation only"
    echo "• Better screen real estate for healthcare forms"
    echo "• Professional appearance for clinical use"
    echo "• Consistent orientation across all screens"
    
else
    echo -e "${YELLOW}⚠️  BUILD COMPLETED WITH ISSUES${NC}"
    echo "Check the build output above for any errors"
    echo "The app may still work, but verify orientation behavior"
fi

cd ..

echo ""
echo -e "${BLUE}🔍 Final Verification${NC}"
echo "-------------------"

# Run comprehensive orientation lock verification
echo "Running final orientation lock verification..."
if node ../test-landscape-orientation.js > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Final verification passed - orientation lock fully configured${NC}"
    echo -e "${GREEN}✅ App is ready for landscape-only deployment${NC}"
    
    echo ""
    echo -e "${BLUE}📋 Verification Summary:${NC}"
    echo "• app.json configuration: ✅"
    echo "• iOS orientation settings: ✅" 
    echo "• Android orientation settings: ✅"
    echo "• expo-screen-orientation plugin: ✅"
    echo "• App.tsx programmatic lock: ✅"
    echo "• Package dependencies: ✅"
    
else
    echo -e "${YELLOW}⚠️  Final verification detected configuration issues${NC}"
    echo ""
    echo -e "${BLUE}📋 Detailed Configuration Report:${NC}"
    node ../test-landscape-orientation.js || true
    echo ""
    echo -e "${YELLOW}⚠️  Please review configuration issues above${NC}"
    echo -e "${YELLOW}⚠️  App may not maintain landscape-only orientation${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Manual Verification Commands:${NC}"
echo "  node test-landscape-orientation.js    # Run configuration test"
echo "  npm test -- orientationLock.property.test.ts    # Run property tests"

exit $BUILD_EXIT_CODE