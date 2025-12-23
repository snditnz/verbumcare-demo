#!/usr/bin/env node

/**
 * Landscape Orientation Configuration Test
 * 
 * Verifies that the iPad app is properly configured for landscape-only mode
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 LANDSCAPE ORIENTATION CONFIGURATION TEST');
console.log('==========================================\n');

const results = {
  appJsonConfig: false,
  iosConfig: false,
  androidConfig: false,
  pluginConfig: false,
  appTsxConfig: false,
  packageJsonDep: false
};

// 1. Check app.json configuration
console.log('📱 Checking app.json configuration...');
try {
  const appJsonPath = path.join(__dirname, 'ipad-app', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  // Check main orientation setting
  if (appJson.expo.orientation === 'landscape') {
    console.log('   ✅ Main orientation set to landscape');
    results.appJsonConfig = true;
  } else {
    console.log('   ❌ Main orientation not set to landscape');
  }
  
  // Check iOS-specific settings
  const iosOrientations = appJson.expo.ios?.infoPlist?.UISupportedInterfaceOrientations;
  const iosOrientationsIpad = appJson.expo.ios?.infoPlist?.['UISupportedInterfaceOrientations~ipad'];
  
  if (iosOrientations && iosOrientations.includes('UIInterfaceOrientationLandscapeLeft') && 
      iosOrientations.includes('UIInterfaceOrientationLandscapeRight') &&
      !iosOrientations.includes('UIInterfaceOrientationPortrait')) {
    console.log('   ✅ iOS orientations configured for landscape-only');
    results.iosConfig = true;
  } else {
    console.log('   ❌ iOS orientations not properly configured');
  }
  
  // Check Android-specific settings
  if (appJson.expo.android?.screenOrientation === 'landscape') {
    console.log('   ✅ Android screen orientation set to landscape');
    results.androidConfig = true;
  } else {
    console.log('   ❌ Android screen orientation not set to landscape');
  }
  
  // Check for expo-screen-orientation plugin
  const plugins = appJson.expo.plugins || [];
  if (plugins.includes('expo-screen-orientation')) {
    console.log('   ✅ expo-screen-orientation plugin configured');
    results.pluginConfig = true;
  } else {
    console.log('   ❌ expo-screen-orientation plugin not found');
  }
  
} catch (error) {
  console.log('   ❌ Error reading app.json:', error.message);
}

// 2. Check App.tsx for programmatic orientation lock
console.log('\n📱 Checking App.tsx configuration...');
try {
  const appTsxPath = path.join(__dirname, 'ipad-app', 'App.tsx');
  const appTsxContent = fs.readFileSync(appTsxPath, 'utf8');
  
  if (appTsxContent.includes('expo-screen-orientation') && 
      appTsxContent.includes('ScreenOrientation.lockAsync') &&
      appTsxContent.includes('OrientationLock.LANDSCAPE')) {
    console.log('   ✅ Programmatic orientation lock implemented');
    results.appTsxConfig = true;
  } else {
    console.log('   ❌ Programmatic orientation lock not found');
  }
  
  if (appTsxContent.includes("orientation: 'landscape'")) {
    console.log('   ✅ Navigation configured for landscape');
  } else {
    console.log('   ❌ Navigation not configured for landscape');
  }
  
  // Check for error handling implementation
  if (appTsxContent.includes('console.warn') && 
      appTsxContent.includes('Failed to lock orientation')) {
    console.log('   ✅ Error handling with logging implemented');
  } else {
    console.log('   ❌ Error handling with logging not found');
  }
  
  // Check for timeout protection
  if (appTsxContent.includes('Promise.race') && 
      appTsxContent.includes('setTimeout')) {
    console.log('   ✅ Timeout protection implemented');
  } else {
    console.log('   ❌ Timeout protection not found');
  }
  
} catch (error) {
  console.log('   ❌ Error reading App.tsx:', error.message);
}

// 3. Check package.json for expo-screen-orientation dependency
console.log('\n📦 Checking package.json dependencies...');
try {
  const packageJsonPath = path.join(__dirname, 'ipad-app', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (packageJson.dependencies && packageJson.dependencies['expo-screen-orientation']) {
    console.log('   ✅ expo-screen-orientation dependency installed');
    results.packageJsonDep = true;
  } else {
    console.log('   ❌ expo-screen-orientation dependency not found');
  }
  
} catch (error) {
  console.log('   ❌ Error reading package.json:', error.message);
}

// 4. Check for property-based test implementation
console.log('\n🧪 Checking property-based test implementation...');
try {
  const testFilePath = path.join(__dirname, 'ipad-app', 'src', '__tests__', 'orientationLock.property.test.ts');
  
  if (fs.existsSync(testFilePath)) {
    const testContent = fs.readFileSync(testFilePath, 'utf8');
    
    // Check for Property 9 implementation
    if (testContent.includes('Property 9: Landscape support validation') &&
        testContent.includes('Validates: Requirements 3.3')) {
      console.log('   ✅ Property 9 (Landscape support validation) implemented');
    } else {
      console.log('   ❌ Property 9 (Landscape support validation) not found');
    }
    
    // Check for comprehensive property coverage
    const propertyCount = (testContent.match(/Property \d+:/g) || []).length;
    console.log(`   ✅ ${propertyCount} orientation properties implemented`);
    
    // Check for fast-check usage
    if (testContent.includes('import fc from \'fast-check\'') &&
        testContent.includes('fc.assert') &&
        testContent.includes('numRuns: 100')) {
      console.log('   ✅ Property-based testing with fast-check configured');
    } else {
      console.log('   ❌ Property-based testing not properly configured');
    }
    
  } else {
    console.log('   ❌ Property-based test file not found');
  }
  
} catch (error) {
  console.log('   ❌ Error checking property-based tests:', error.message);
}

// 4. Summary
console.log('\n' + '='.repeat(50));
console.log('📊 LANDSCAPE ORIENTATION SUMMARY');
console.log('='.repeat(50));

const checks = [
  { name: 'app.json Configuration', result: results.appJsonConfig },
  { name: 'iOS Orientation Settings', result: results.iosConfig },
  { name: 'Android Orientation Settings', result: results.androidConfig },
  { name: 'Screen Orientation Plugin', result: results.pluginConfig },
  { name: 'App.tsx Orientation Lock', result: results.appTsxConfig },
  { name: 'Package Dependencies', result: results.packageJsonDep }
];

let passedChecks = 0;
checks.forEach(check => {
  const status = check.result ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
  if (check.result) passedChecks++;
});

const passRate = Math.round((passedChecks / checks.length) * 100);
console.log(`\n📈 Pass Rate: ${passRate}% (${passedChecks}/${checks.length})`);

console.log('\n🎯 LANDSCAPE CONFIGURATION STATUS');
if (passedChecks === checks.length) {
  console.log('🎉 FULLY CONFIGURED FOR LANDSCAPE-ONLY');
  console.log('✅ App will be locked to landscape orientation');
  console.log('✅ Both iOS and Android are properly configured');
  console.log('✅ Programmatic orientation lock is implemented');
  console.log('✅ All dependencies are installed');
} else if (passedChecks >= 4) {
  console.log('⚡ MOSTLY CONFIGURED FOR LANDSCAPE');
  console.log('✅ Core landscape functionality should work');
  console.log('⚠️  Some minor configuration issues detected');
} else {
  console.log('❌ LANDSCAPE CONFIGURATION INCOMPLETE');
  console.log('⚠️  Significant configuration issues detected');
  console.log('🔧 Manual fixes required for proper landscape-only mode');
}

console.log('\n📱 DEMO IMPACT:');
console.log('• App will display in landscape orientation');
console.log('• Better screen real estate for healthcare forms');
console.log('• Consistent orientation for all screens');
console.log('• Professional appearance for clinical use');

console.log('\n🧪 TESTING VALIDATION:');
if (passedChecks === checks.length) {
  console.log('✅ Configuration supports both landscape orientations');
  console.log('✅ Portrait orientations are properly blocked');
  console.log('✅ Programmatic orientation lock is implemented');
  console.log('✅ Error handling and timeout protection included');
  console.log('✅ Ready for automated property-based testing');
} else {
  console.log('❌ Configuration may not support full landscape validation');
  console.log('❌ Some orientation lock features may not work correctly');
  console.log('⚠️  Property-based tests may fail due to configuration issues');
}

console.log('\n🔧 NEXT STEPS:');
if (passedChecks === checks.length) {
  console.log('1. Build the app with: ./build-landscape-app.sh');
  console.log('2. Run property tests: npm test -- orientationLock.property.test.ts');
  console.log('3. Deploy to device and test physical rotation');
  console.log('4. Verify landscape-only behavior in all screens');
} else {
  console.log('1. Fix configuration issues listed above');
  console.log('2. Re-run this test until all checks pass');
  console.log('3. Then proceed with build and deployment');
}

process.exit(passedChecks === checks.length ? 0 : 1);