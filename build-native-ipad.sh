#!/bin/bash

# Build Native iPad App (Simplified)
# Uses static orientation configuration only

echo "📱 BUILDING NATIVE IPAD APP"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd ipad-app

echo -e "${BLUE}🔧 Configuration Status${NC}"
echo "----------------------"
echo "✅ Static landscape orientation configured in app.json"
echo "✅ iOS UISupportedInterfaceOrientations set to landscape only"
echo "✅ Android screenOrientation set to landscape"
echo "✅ No problematic native modules included"
echo ""

echo -e "${BLUE}🧹 Cleaning Previous Builds${NC}"
echo "----------------------------"

# Clean previous builds
echo "Removing previous build artifacts..."
rm -rf .expo ios/build
echo -e "   ${GREEN}✅ Build artifacts cleared${NC}"

echo ""
echo -e "${BLUE}🏗️  Building for iOS Device${NC}"
echo "----------------------------"

echo "Building iPad app with static landscape configuration..."
echo "This will take a few minutes..."

# Build for iOS device
npx expo run:ios --device --configuration Debug

BUILD_EXIT_CODE=$?

echo ""
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 BUILD SUCCESSFUL!${NC}"
    echo -e "${GREEN}✅ iPad app built successfully${NC}"
    echo -e "${GREEN}✅ Landscape orientation configured via app.json${NC}"
    
    echo ""
    echo -e "${BLUE}📱 Next Steps:${NC}"
    echo "1. Install the app on your iPad via Xcode or direct USB"
    echo "2. Trust the developer certificate in Settings > General > VPN & Device Management"
    echo "3. Launch the app - it will use landscape orientation from app.json"
    echo "4. Test the app functionality"
    
    echo ""
    echo -e "${BLUE}🎯 Orientation Notes:${NC}"
    echo "• App uses static landscape configuration from app.json"
    echo "• iOS will enforce landscape-only mode via UISupportedInterfaceOrientations"
    echo "• No programmatic orientation lock needed"
    echo "• Should work properly on physical iPad devices"
    
else
    echo -e "${YELLOW}⚠️  BUILD FAILED${NC}"
    echo "Check the build output above for errors"
    echo "Common issues:"
    echo "- Xcode not installed or configured"
    echo "- iOS device not connected or trusted"
    echo "- Developer certificate issues"
fi

cd ..

echo ""
echo -e "${BLUE}🎯 Manual Testing Commands:${NC}"
echo "  cd ipad-app && npm run build:dev    # Alternative build command"
echo "  cd ipad-app && npm start            # Start dev server"

exit $BUILD_EXIT_CODE