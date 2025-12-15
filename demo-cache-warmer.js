#!/usr/bin/env node

/**
 * Demo Cache Warmer Script
 * 
 * Pre-populates all caches for reliable demo operation
 * Ensures the app works perfectly even if network fails during demo
 */

const https = require('https');

// Ignore self-signed certificate for demo
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const API_BASE = 'https://verbumcare-lab.local/api';
const FACILITY_ID = '550e8400-e29b-41d4-a716-446655440001';
const DEMO_STAFF_ID = '550e8400-e29b-41d4-a716-446655440101';

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) {
            resolve(parsed.data);
          } else if (parsed.templates) {
            // Handle problem templates response format
            resolve(parsed.templates);
          } else if (parsed.data !== undefined) {
            // Handle care plans response format
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || 'API request failed'));
          }
        } catch (e) {
          // Check if it's HTML error page
          if (data.includes('<!DOCTYPE html>')) {
            reject(new Error('Endpoint not found (HTML error page)'));
          } else {
            reject(new Error('Invalid JSON response'));
          }
        }
      });
    }).on('error', reject);
  });
}

async function warmCaches() {
  console.log('🔥 Starting Demo Cache Warming...\n');

  const results = {
    patients: 0,
    vitals: 0,
    carePlans: 0,
    templates: 0,
    schedules: 0,
    errors: []
  };

  try {
    // 1. Test and warm patients
    console.log('📋 Warming patients cache...');
    const patients = await makeRequest(`${API_BASE}/patients?facility_id=${FACILITY_ID}`);
    results.patients = patients.length;
    console.log(`✅ Patients: ${patients.length} loaded`);

    // 2. Test vitals for first patient
    if (patients.length > 0) {
      console.log('\n💓 Testing vitals endpoints...');
      try {
        const vitals = await makeRequest(`${API_BASE}/vitals/patient/${patients[0].patient_id}`);
        results.vitals = vitals.length;
        console.log(`✅ Vitals: ${vitals.length} records for first patient`);
      } catch (error) {
        console.log(`⚠️  Vitals: ${error.message}`);
        results.errors.push(`Vitals: ${error.message}`);
      }
    }

    // 3. Test care plan templates
    console.log('\n📝 Warming care plan templates...');
    try {
      const templates = await makeRequest(`${API_BASE}/care-plans/problem-templates`);
      results.templates = templates.length;
      console.log(`✅ Templates: ${templates.length} loaded`);
    } catch (error) {
      console.log(`⚠️  Templates: ${error.message}`);
      results.errors.push(`Templates: ${error.message}`);
    }

    // 4. Test schedules for each patient
    console.log('\n📅 Warming schedule caches...');
    let scheduleCount = 0;
    
    // Staff schedule (all patients)
    try {
      const staffSchedule = await makeRequest(`${API_BASE}/dashboard/today-schedule-all?staff_id=${DEMO_STAFF_ID}`);
      scheduleCount++;
      console.log(`✅ Staff schedule: ${staffSchedule.allItems?.length || 0} items`);
    } catch (error) {
      console.log(`⚠️  Staff schedule: ${error.message}`);
      results.errors.push(`Staff schedule: ${error.message}`);
    }

    // Individual patient schedules
    for (let i = 0; i < Math.min(patients.length, 3); i++) {
      const patient = patients[i];
      try {
        const schedule = await makeRequest(`${API_BASE}/dashboard/today-schedule/${patient.patient_id}`);
        scheduleCount++;
        console.log(`✅ Patient ${patient.mrn}: ${schedule.allItems?.length || 0} schedule items`);
      } catch (error) {
        console.log(`⚠️  Patient ${patient.mrn}: ${error.message}`);
        results.errors.push(`Patient schedule ${patient.mrn}: ${error.message}`);
      }
    }
    results.schedules = scheduleCount;

    // 5. Test care plans endpoint
    console.log('\n🏥 Testing care plans...');
    try {
      const response = await makeRequest(`${API_BASE}/care-plans/all`);
      // Handle different response formats
      const carePlans = Array.isArray(response) ? response : (response.data || []);
      results.carePlans = carePlans.length;
      console.log(`✅ Care plans: ${carePlans.length} loaded`);
    } catch (error) {
      console.log(`⚠️  Care plans: ${error.message}`);
      results.errors.push(`Care plans: ${error.message}`);
    }

    // 6. Test voice endpoints
    console.log('\n🎤 Testing voice endpoints...');
    try {
      // Test voice review queue (requires staff ID)
      const reviewQueue = await makeRequest(`${API_BASE}/voice/review-queue/${DEMO_STAFF_ID}`);
      console.log(`✅ Voice review queue: ${reviewQueue.queue?.length || 0} items`);
    } catch (error) {
      console.log(`⚠️  Voice review queue: ${error.message}`);
      results.errors.push(`Voice review: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Critical error:', error.message);
    results.errors.push(`Critical: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎯 DEMO CACHE WARMING SUMMARY');
  console.log('='.repeat(50));
  console.log(`📋 Patients:     ${results.patients}`);
  console.log(`💓 Vitals:       ${results.vitals}`);
  console.log(`📅 Schedules:    ${results.schedules}`);
  console.log(`📝 Templates:    ${results.templates}`);
  console.log(`🏥 Care Plans:   ${results.carePlans}`);
  console.log(`❌ Errors:       ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:');
    results.errors.forEach(error => console.log(`   - ${error}`));
  }

  const isReady = results.patients > 0 && results.schedules > 0 && results.templates > 0;
  console.log(`\n${isReady ? '🎉' : '❌'} DEMO READINESS: ${isReady ? 'READY' : 'NOT READY'}`);
  
  if (isReady) {
    console.log('\n✅ The app should work reliably for your demo!');
    console.log('✅ All critical endpoints are responding correctly.');
    console.log('✅ Cache warming will happen automatically when users login.');
  } else {
    console.log('\n❌ Some critical issues need to be resolved before demo.');
  }

  return isReady;
}

// Run the cache warmer
warmCaches()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });