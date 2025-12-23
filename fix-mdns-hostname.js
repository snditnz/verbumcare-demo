#!/usr/bin/env node

/**
 * Mac Mini mDNS Hostname Discovery and Fix
 * 
 * This script discovers the correct Mac Mini mDNS hostname and updates the iPad app configuration
 */

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');

const execAsync = promisify(exec);

// All possible hostname variations to test
const HOSTNAME_VARIATIONS = [
  'verbumcaremac-mini.local',
  'verbumcare-mac-mini.local', 
  'VerbumCareMac-mini.local',
  'VerbumCare-Mac-mini.local',
  'verbumcarenomac-mini.local',
  'VerbumCarenoMac-mini.local',
  'macmini.local',
  'Mac-mini.local',
  'vcadmin-mac-mini.local',
  'vcadmin.local'
];

async function testHttpsEndpoint(hostname, endpoint = '/health') {
  return new Promise((resolve) => {
    const options = {
      hostname: hostname,
      port: 443,
      path: endpoint,
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false
    };
    
    const req = https.request(options, (res) => {
      resolve({ success: true, status: res.statusCode });
    });
    
    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    
    req.end();
  });
}

async function testPing(hostname) {
  try {
    await execAsync(`ping -c 1 -W 3000 ${hostname}`);
    return true;
  } catch (error) {
    return false;
  }
}

async function discoverMacMiniHostname() {
  console.log('🔍 Discovering Mac Mini mDNS hostname...\n');
  
  const results = [];
  
  for (const hostname of HOSTNAME_VARIATIONS) {
    process.stdout.write(`Testing ${hostname}... `);
    
    const pingResult = await testPing(hostname);
    if (pingResult) {
      process.stdout.write('ping ✅ ');
      
      const httpsResult = await testHttpsEndpoint(hostname);
      if (httpsResult.success) {
        process.stdout.write(`https ✅ (${httpsResult.status})\n`);
        results.push({ hostname, ping: true, https: true, status: httpsResult.status });
      } else {
        process.stdout.write(`https ❌ (${httpsResult.error})\n`);
        results.push({ hostname, ping: true, https: false, error: httpsResult.error });
      }
    } else {
      process.stdout.write('ping ❌\n');
      results.push({ hostname, ping: false, https: false });
    }
  }
  
  return results;
}

async function checkMacMiniViaSSH() {
  console.log('\n🔧 Checking Mac Mini via SSH...\n');
  
  // Try SSH with different hostnames
  for (const hostname of HOSTNAME_VARIATIONS) {
    try {
      console.log(`Trying SSH to vcadmin@${hostname}...`);
      const { stdout } = await execAsync(`ssh -o ConnectTimeout=5 -o BatchMode=yes vcadmin@${hostname} "hostname && scutil --get LocalHostName && scutil --get ComputerName" 2>/dev/null`);
      
      console.log(`✅ SSH successful to ${hostname}:`);
      console.log(`   Hostname info: ${stdout.trim()}`);
      
      // Check Docker services
      try {
        const { stdout: dockerStatus } = await execAsync(`ssh -o ConnectTimeout=5 vcadmin@${hostname} "export PATH=/Applications/Docker.app/Contents/Resources/bin:\\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml ps --format table" 2>/dev/null`);
        console.log(`   Docker services:\n${dockerStatus}`);
      } catch (dockerError) {
        console.log(`   Docker check failed: ${dockerError.message}`);
      }
      
      return hostname;
    } catch (error) {
      console.log(`❌ SSH failed to ${hostname}`);
    }
  }
  
  return null;
}

async function updateServerConfig(workingHostname) {
  console.log(`\n📝 Updating server configuration to use ${workingHostname}...\n`);
  
  try {
    const configPath = 'ipad-app/src/config/servers.ts';
    let config = fs.readFileSync(configPath, 'utf8');
    
    // Update the Mac Mini server configuration
    config = config.replace(
      /name: '[^']*mac[^']*\.local'/i,
      `name: '${workingHostname}'`
    );
    config = config.replace(
      /baseUrl: 'https:\/\/[^']*mac[^']*\.local\/api'/i,
      `baseUrl: 'https://${workingHostname}/api'`
    );
    config = config.replace(
      /wsUrl: 'wss:\/\/[^']*mac[^']*\.local'/i,
      `wsUrl: 'wss://${workingHostname}'`
    );
    
    fs.writeFileSync(configPath, config);
    console.log(`✅ Updated ${configPath}`);
    
    // Show the updated configuration
    const updatedLines = config.split('\n').filter(line => 
      line.includes('mac-mini') || line.includes(workingHostname)
    ).slice(0, 5);
    
    console.log('\nUpdated configuration:');
    updatedLines.forEach(line => console.log(`   ${line.trim()}`));
    
  } catch (error) {
    console.log(`❌ Failed to update configuration: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Mac Mini mDNS Hostname Discovery and Fix');
  console.log('='.repeat(50));
  
  // Step 1: Try to discover via mDNS
  const discoveryResults = await discoverMacMiniHostname();
  
  const workingHostnames = discoveryResults.filter(r => r.ping && r.https);
  
  if (workingHostnames.length > 0) {
    console.log('\n✅ Found working hostname(s):');
    workingHostnames.forEach(result => {
      console.log(`   ${result.hostname} (status: ${result.status})`);
    });
    
    const bestHostname = workingHostnames[0].hostname;
    await updateServerConfig(bestHostname);
    
    console.log('\n🎉 SUCCESS! iPad app should now be able to connect.');
    console.log('\nNext steps:');
    console.log('1. Restart your iPad app development server');
    console.log('2. Test the connection from the iPad app');
    
  } else {
    console.log('\n❌ No working mDNS hostnames found via direct testing.');
    
    // Step 2: Try SSH discovery
    const sshHostname = await checkMacMiniViaSSH();
    
    if (sshHostname) {
      console.log(`\n✅ Found Mac Mini via SSH: ${sshHostname}`);
      console.log('\nThe Mac Mini is reachable but HTTPS/nginx might not be running.');
      console.log('\n🔧 Troubleshooting steps:');
      console.log('1. Check if Docker services are running on Mac Mini');
      console.log('2. Verify nginx container is up and listening on port 443');
      console.log('3. Check SSL certificate configuration');
      
      // Try to start services
      console.log('\nAttempting to start Docker services...');
      try {
        await execAsync(`ssh vcadmin@${sshHostname} "export PATH=/Applications/Docker.app/Contents/Resources/bin:\\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml up -d"`);
        console.log('✅ Docker services started');
        
        // Wait a moment and test again
        console.log('Waiting 10 seconds for services to start...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const testResult = await testHttpsEndpoint(sshHostname);
        if (testResult.success) {
          console.log(`✅ HTTPS now working on ${sshHostname}!`);
          await updateServerConfig(sshHostname);
          console.log('\n🎉 SUCCESS! Services started and configuration updated.');
        } else {
          console.log(`❌ HTTPS still not working: ${testResult.error}`);
        }
        
      } catch (error) {
        console.log(`❌ Failed to start services: ${error.message}`);
      }
      
    } else {
      console.log('\n❌ Could not reach Mac Mini via any method.');
      console.log('\n🔧 Manual troubleshooting required:');
      console.log('1. Verify Mac Mini is powered on and connected to network');
      console.log('2. Check Mac Mini hostname in System Preferences > Sharing');
      console.log('3. Verify mDNS/Bonjour is enabled on your network');
      console.log('4. Try connecting to Mac Mini directly via IP address');
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}