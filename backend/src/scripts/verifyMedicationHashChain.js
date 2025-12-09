/**
 * Script to verify existing medication hash chain integrity
 * 
 * This script checks all existing medication administration records
 * to ensure the hash chain is intact before implementing enhancements.
 */

import db from '../db/index.js';
import { verifyChainIntegrity } from '../utils/crypto.js';

async function verifyAllFacilities() {
  try {
    console.log('=== Medication Hash Chain Verification ===\n');
    
    // Get all facilities
    const facilitiesQuery = 'SELECT facility_id, facility_name FROM facilities ORDER BY facility_name';
    const facilitiesResult = await db.query(facilitiesQuery);
    
    if (facilitiesResult.rows.length === 0) {
      console.log('No facilities found in database.');
      return;
    }
    
    console.log(`Found ${facilitiesResult.rows.length} facilities to verify\n`);
    
    let totalRecords = 0;
    let totalIssues = 0;
    const facilityResults = [];
    
    for (const facility of facilitiesResult.rows) {
      console.log(`\nVerifying: ${facility.facility_name} (${facility.facility_id})`);
      
      // Count records for this facility
      const countQuery = `
        SELECT COUNT(*) as count
        FROM medication_administrations ma
        JOIN patients p ON ma.patient_id = p.patient_id
        WHERE p.facility_id = $1
      `;
      const countResult = await db.query(countQuery, [facility.facility_id]);
      const recordCount = parseInt(countResult.rows[0].count);
      
      console.log(`  Records: ${recordCount}`);
      
      if (recordCount === 0) {
        console.log('  Status: No records to verify');
        facilityResults.push({
          facility: facility.facility_name,
          recordCount: 0,
          valid: true,
          issues: 0
        });
        continue;
      }
      
      // Verify chain integrity
      const verification = await verifyChainIntegrity(facility.facility_id, recordCount);
      
      totalRecords += recordCount;
      totalIssues += verification.totalIssues || 0;
      
      if (verification.valid) {
        console.log('  Status: ✓ Chain integrity verified');
      } else {
        console.log(`  Status: ✗ Issues found`);
        console.log(`  Broken links: ${verification.brokenLinks?.length || 0}`);
        console.log(`  Tampered records: ${verification.tamperedRecords?.length || 0}`);
        
        if (verification.brokenLinks && verification.brokenLinks.length > 0) {
          console.log('\n  Broken Links:');
          verification.brokenLinks.forEach(link => {
            console.log(`    - Sequence ${link.sequence}: ${link.administration_id}`);
            console.log(`      Expected previous: ${link.expected_previous.substring(0, 16)}...`);
            console.log(`      Actual previous: ${link.actual_previous.substring(0, 16)}...`);
          });
        }
        
        if (verification.tamperedRecords && verification.tamperedRecords.length > 0) {
          console.log('\n  Tampered Records:');
          verification.tamperedRecords.forEach(record => {
            console.log(`    - Sequence ${record.sequence}: ${record.administration_id}`);
            console.log(`      Expected hash: ${record.expected_hash.substring(0, 16)}...`);
            console.log(`      Actual hash: ${record.actual_hash.substring(0, 16)}...`);
          });
        }
      }
      
      facilityResults.push({
        facility: facility.facility_name,
        recordCount,
        valid: verification.valid,
        issues: verification.totalIssues || 0
      });
    }
    
    // Summary
    console.log('\n\n=== Verification Summary ===');
    console.log(`Total facilities: ${facilitiesResult.rows.length}`);
    console.log(`Total records: ${totalRecords}`);
    console.log(`Total issues: ${totalIssues}`);
    console.log(`\nFacility Breakdown:`);
    
    facilityResults.forEach(result => {
      const status = result.valid ? '✓' : '✗';
      console.log(`  ${status} ${result.facility}: ${result.recordCount} records, ${result.issues} issues`);
    });
    
    if (totalIssues === 0) {
      console.log('\n✓ All medication hash chains are intact!');
      console.log('Safe to proceed with enhancements.');
    } else {
      console.log('\n✗ Issues detected in medication hash chains!');
      console.log('Review issues before proceeding with enhancements.');
    }
    
  } catch (error) {
    console.error('Error during verification:', error);
    throw error;
  } finally {
    await db.end();
  }
}

// Run verification
verifyAllFacilities()
  .then(() => {
    console.log('\nVerification complete.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nVerification failed:', error);
    process.exit(1);
  });
