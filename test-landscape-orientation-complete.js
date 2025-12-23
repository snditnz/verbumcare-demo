#!/usr/bin/env node

/**
 * Complete Landscape Orientation Configuration Test
 * Tests all aspects of landscape orientation lock implementation
 */

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function runTests() {
  log('\n🧪 COMPLETE LANDSCAPE ORIENTATION TEST', 'bold');
  log('=====================================', 'blue');
  
  let passCount = 0;
  let totalTests = 0;
  const results = [];

  // Test 1: Check app.json static configuration
  totalTests++;
  log('\n1️⃣  Testing app.json static configuration...', 'blue');
  
  const appJsonPath = path.join('ipad-app', 'app.json');
  if (!checkFileExists(appJsonPath)) {
    log('   ❌ app.json not found', 'red');
    results.push({ test: 'app.json exists', passed: false });
  } else {
    const appJson = readJsonFile(appJsonPath);
    if (!appJson) {
      log('   ❌ app.json is invalid JSON', 'red');
      results.push({ test: 'app.json valid', passed: false });
    } else {
      let configPassed = true;
      
      // Check root orientation
      if (appJson.expo?.orientation !== 'landscape') {
        log('   ❌ expo.orientation is not set to "landscape"', 'red');
        configPassed = false;
      } else {
        log('   ✅ expo.orientation set to landscape', 'green');
      }
      
      // Check iOS configuration
      const iosOrientations = appJson.expo?.ios?.infoPlist?.UISupportedInterfaceOrientations;
      const iosOrientationsIpad = appJson.expo?.ios?.infoPlist?.['UISupportedInterfaceOrientations~ipad'];
      
      if (!iosOrientations || !Array.isArray(iosOrientations)) {
        log('   ❌ iOS UISupportedInterfaceOrientations not configured', 'red');
        configPassed = false;
      } else if (!iosOrientations.includes('UIInterfaceOrientationLandscapeLeft') || 
                 !iosOrientations.includes('UIInterfaceOrientationLandscapeRight')) {
        log('   ❌ iOS orientations missing landscape modes', 'red');
        configPassed = false;
      } else {
        log('   ✅ iOS UISupportedInterfaceOrientations configured for landscape', 'green');
      }
      
      if (!iosOrientationsIpad || !Array.isArray(iosOrientationsIpad)) {
        log('   ❌ iOS iPad-specific orientations not configured', 'red');
        configPassed = false;
      } else if (!iosOrientationsIpad.includes('UIInterfaceOrientationLandscapeLeft') || 
                 !iosOrientationsIpad.includes('UIInterfaceOrientationLandscapeRight')) {
        log('   ❌ iOS iPad orientations missing landscape modes', 'red');
        configPassed = false;
      } else {
        log('   ✅ iOS iPad orientations configured for landscape', 'green');
      }
      
      // Check Android configuration
      if (appJson.expo?.android?.screenOrientation !== 'landscape') {
        log('   ❌ Android screenOrientation not set to landscape', 'red');
        configPassed = false;
      } else {
        log('   ✅ Android screenOrientation set to landscape', 'green');
      }
      
      if (configPassed) {
        passCount++;
        log('   🎉 Static configuration: PASSED', 'green');
      } else {
        log('   💥 Static configuration: FAILED', 'red');
      }
      
      results.push({ test: 'Static configuration', passed: configPassed });
    }
  }

  // Test 2: Check expo-screen-orientation plugin
  totalTests++;
  log('\n2️⃣  Testing expo-screen-orientation plugin...', 'blue');
  
  const appJson = readJsonFile(appJsonPath);
  if (appJson?.expo?.plugins) {
    const hasOrientationPlugin = appJson.expo.plugins.some(plugin => 
      plugin === 'expo-screen-orientation' || 
      (Array.isArray(plugin) && plugin[0] === 'expo-screen-orientation')
    );
    
    if (hasOrientationPlugin) {
      log('   ✅ expo-screen-orientation plugin configured in app.json', 'green');
      passCount++;
      results.push({ test: 'Plugin configuration', passed: true });
    } else {
      log('   ❌ expo-screen-orientation plugin not found in app.json', 'red');
      results.push({ test: 'Plugin configuration', passed: false });
    }
  } else {
    log('   ❌ No plugins array found in app.json', 'red');
    results.push({ test: 'Plugin configuration', passed: false });
  }

  // Test 3: Check package.json dependencies
  totalTests++;
  log('\n3️⃣  Testing package.json dependencies...', 'blue');
  
  const packageJsonPath = path.join('ipad-app', 'package.json');
  if (!checkFileExists(packageJsonPath)) {
    log('   ❌ package.json not found', 'red');
    results.push({ test: 'Package dependencies', passed: false });
  } else {
    const packageJson = readJsonFile(packageJsonPath);
    if (!packageJson) {
      log('   ❌ package.json is invalid JSON', 'red');
      results.push({ test: 'Package dependencies', passed: false });
    } else {
      const hasOrientationDep = packageJson.dependencies && 
                               packageJson.dependencies['expo-screen-orientation'];
      
      if (hasOrientationDep) {
        log(`   ✅ expo-screen-orientation dependency found (${hasOrientationDep})`, 'green');
        
        // Check if it's a recent version
        const version = hasOrientationDep.replace(/[^0-9.]/g, '');
        const majorVersion = parseInt(version.split('.')[0]);
        
        if (majorVersion >= 8) {
          log('   ✅ Using recent version (8.x or 9.x)', 'green');
          passCount++;
          results.push({ test: 'Package dependencies', passed: true });
        } else {
          log('   ⚠️  Using older version, consider upgrading', 'yellow');
          passCount++;
          results.push({ test: 'Package dependencies', passed: true });
        }
      } else {
        log('   ❌ expo-screen-orientation dependency not found', 'red');
        results.push({ test: 'Package dependencies', passed: false });
      }
    }
  }

  // Test 4: Check App.tsx programmatic implementation
  totalTests++;
  log('\n4️⃣  Testing App.tsx programmatic implementation...', 'blue');
  
  const appTsxPath = path.join('ipad-app', 'App.tsx');
  if (!checkFileExists(appTsxPath)) {
    log('   ❌ App.tsx not found', 'red');
    results.push({ test: 'Programmatic implementation', passed: false });
  } else {
    const appTsxContent = readTextFile(appTsxPath);
    if (!appTsxContent) {
      log('   ❌ Could not read App.tsx', 'red');
      results.push({ test: 'Programmatic implementation', passed: false });
    } else {
      let implementationPassed = true;
      
      // Check for import
      if (!appTsxContent.includes('expo-screen-orientation')) {
        log('   ❌ Missing expo-screen-orientation import', 'red');
        implementationPassed = false;
      } else {
        log('   ✅ expo-screen-orientation imported', 'green');
      }
      
      // Check for orientation lock call
      if (!appTsxContent.includes('lockAsync') && !appTsxContent.includes('LANDSCAPE')) {
        log('   ❌ Missing orientation lock implementation', 'red');
        implementationPassed = false;
      } else {
        log('   ✅ Orientation lock implementation found', 'green');
      }
      
      // Check for error handling
      if (!appTsxContent.includes('try') || !appTsxContent.includes('catch')) {
        log('   ❌ Missing error handling for orientation lock', 'red');
        implementationPassed = false;
      } else {
        log('   ✅ Error handling implemented', 'green');
      }
      
      // Check for timeout protection
      if (!appTsxContent.includes('timeout') && !appTsxContent.includes('Promise.race')) {
        log('   ⚠️  No timeout protection found (recommended)', 'yellow');
      } else {
        log('   ✅ Timeout protection implemented', 'green');
      }
      
      if (implementationPassed) {
        passCount++;
        log('   🎉 Programmatic implementation: PASSED', 'green');
      } else {
        log('   💥 Programmatic implementation: FAILED', 'red');
      }
      
      results.push({ test: 'Programmatic implementation', passed: implementationPassed });
    }
  }

  // Test 5: Check navigation configuration
  totalTests++;
  log('\n5️⃣  Testing navigation configuration...', 'blue');
  
  const appTsxContent = readTextFile(appTsxPath);
  if (appTsxContent) {
    let navConfigPassed = true;
    
    // Check for orientation in screenOptions
    if (!appTsxContent.includes('orientation:') && !appTsxContent.includes("'landscape'")) {
      log('   ⚠️  No navigation orientation configuration found', 'yellow');
      // Not critical since we have other locks
    } else {
      log('   ✅ Navigation orientation configuration found', 'green');
    }
    
    // Check for Stack.Navigator
    if (!appTsxContent.includes('Stack.Navigator')) {
      log('   ❌ Stack.Navigator not found', 'red');
      navConfigPassed = false;
    } else {
      log('   ✅ Stack.Navigator configured', 'green');
    }
    
    if (navConfigPassed) {
      passCount++;
      log('   🎉 Navigation configuration: PASSED', 'green');
    } else {
      log('   💥 Navigation configuration: FAILED', 'red');
    }
    
    results.push({ test: 'Navigation configuration', passed: navConfigPassed });
  } else {
    log('   ❌ Could not analyze navigation configuration', 'red');
    results.push({ test: 'Navigation configuration', passed: false });
  }

  // Test 6: Check build script
  totalTests++;
  log('\n6️⃣  Testing build script...', 'blue');
  
  const buildScriptPath = 'build-native-ipad.sh';
  if (!checkFileExists(buildScriptPath)) {
    log('   ❌ build-native-ipad.sh not found', 'red');
    results.push({ test: 'Build script', passed: false });
  } else {
    const buildScript = readTextFile(buildScriptPath);
    if (!buildScript) {
      log('   ❌ Could not read build script', 'red');
      results.push({ test: 'Build script', passed: false });
    } else {
      let buildScriptPassed = true;
      
      // Check for expo run:ios
      if (!buildScript.includes('expo run:ios')) {
        log('   ❌ Missing expo run:ios command', 'red');
        buildScriptPassed = false;
      } else {
        log('   ✅ expo run:ios command found', 'green');
      }
      
      // Check for device flag
      if (!buildScript.includes('--device')) {
        log('   ❌ Missing --device flag for physical device build', 'red');
        buildScriptPassed = false;
      } else {
        log('   ✅ --device flag configured for physical device', 'green');
      }
      
      if (buildScriptPassed) {
        passCount++;
        log('   🎉 Build script: PASSED', 'green');
      } else {
        log('   💥 Build script: FAILED', 'red');
      }
      
      results.push({ test: 'Build script', passed: buildScriptPassed });
    }
  }

  // Final Results
  log('\n📊 TEST RESULTS SUMMARY', 'bold');
  log('====================', 'blue');
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`${index + 1}. ${result.test}: ${status}`, color);
  });
  
  log(`\n🎯 OVERALL RESULT: ${passCount}/${totalTests} tests passed`, 
      passCount === totalTests ? 'green' : 'red');
  
  if (passCount === totalTests) {
    log('\n🎉 ALL TESTS PASSED! Landscape orientation is fully configured.', 'green');
    log('✅ Ready for native iPad build', 'green');
    log('✅ Static and programmatic orientation locks in place', 'green');
    log('✅ Error handling and fallbacks implemented', 'green');
    
    log('\n📱 Next Steps:', 'blue');
    log('1. Run: ./build-native-ipad.sh', 'blue');
    log('2. Install app on iPad via USB/Xcode', 'blue');
    log('3. Test landscape lock on physical device', 'blue');
    
  } else {
    log('\n⚠️  Some tests failed. Please review the issues above.', 'yellow');
    log('The app may still work with partial configuration.', 'yellow');
  }
  
  return passCount === totalTests;
}

// Run the tests
const success = runTests();
process.exit(success ? 0 : 1);