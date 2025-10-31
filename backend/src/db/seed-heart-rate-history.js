/**
 * Generate 7 days of heart rate history for all patients
 * Creates 2 readings per day (8am, 8pm) = 14 readings per patient = 70 total
 *
 * Usage: node seed-heart-rate-history.js
 */

import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nagare_db',
  user: process.env.DB_USER || 'nagare',
  password: process.env.DB_PASSWORD || 'nagare',
});

// Patient configurations with realistic heart rate patterns
const patients = [
  {
    id: '550e8400-e29b-41d4-a716-446655440201',
    name: 'Yamada Taro',
    baseHR: 75,
    variability: 5, // ±5 bpm
    trend: 0, // stable over 7 days
    notes: 'Hypertension patient, controlled with medication',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440202',
    name: 'Tanaka Yuki',
    baseHR: 73,
    variability: 4,
    trend: -1, // slightly decreasing (post-op recovery, improving)
    notes: 'Post-operative, HR gradually normalizing',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440203',
    name: 'Sato Kenji',
    baseHR: 65,
    variability: 8, // more variable due to cardiac meds
    trend: 0,
    bradycardiaChance: 0.2, // 20% chance of bradycardia reading
    notes: 'Cardiac patient on beta-blockers, occasional bradycardia',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440204',
    name: 'Suzuki Aiko',
    baseHR: 80,
    variability: 6,
    trend: 0,
    notes: 'Normal heart rate, antibiotic therapy patient',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440205',
    name: 'Watanabe Hiroshi',
    baseHR: 72,
    variability: 4,
    trend: 0,
    notes: 'Elderly dementia patient, stable vitals',
  },
];

// Staff who record vitals (alternating)
const staff = [
  '550e8400-e29b-41d4-a716-446655440101', // Sato Misaki
  '550e8400-e29b-41d4-a716-446655440102', // Suzuki Hanako
];

/**
 * Generate a realistic heart rate reading
 */
function generateHeartRate(patient, dayOffset, isEvening) {
  // Apply trend over 7 days
  const trendEffect = patient.trend * dayOffset;

  // Evening readings typically slightly higher (+2-5 bpm)
  const timeOfDayEffect = isEvening ? Math.floor(Math.random() * 3) + 2 : 0;

  // Random variability
  const randomVariation = (Math.random() - 0.5) * 2 * patient.variability;

  // Calculate base heart rate
  let hr = Math.round(patient.baseHR + trendEffect + timeOfDayEffect + randomVariation);

  // Sato Kenji: occasional bradycardia (especially morning readings)
  if (patient.bradycardiaChance && !isEvening && Math.random() < patient.bradycardiaChance) {
    hr = Math.floor(Math.random() * 10) + 50; // 50-59 bpm
  }

  // Ensure within physiological range (40-120 bpm)
  hr = Math.max(40, Math.min(120, hr));

  return hr;
}

/**
 * Generate timestamp for a specific day and time
 */
function generateTimestamp(daysAgo, isEvening) {
  const now = new Date();
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);

  if (isEvening) {
    date.setHours(20, 0, 0, 0); // 8:00 PM
  } else {
    date.setHours(8, 0, 0, 0); // 8:00 AM
  }

  return date.toISOString();
}

/**
 * Generate all vital signs records
 */
async function generateVitalsHistory() {
  const records = [];

  console.log('Generating 7 days of heart rate history...\n');

  // For each patient
  for (const patient of patients) {
    console.log(`Patient: ${patient.name}`);

    // For each of the last 7 days (0 = today, 6 = 7 days ago)
    for (let day = 6; day >= 0; day--) {
      // Morning reading (8am)
      const morningHR = generateHeartRate(patient, 6 - day, false);
      const morningTimestamp = generateTimestamp(day, false);
      const morningStaff = staff[day % staff.length]; // Alternate nurses

      records.push({
        patient_id: patient.id,
        measured_at: morningTimestamp,
        heart_rate: morningHR,
        input_method: 'manual',
        recorded_by: morningStaff,
      });

      console.log(`  Day -${day}: Morning HR = ${morningHR} bpm`);

      // Evening reading (8pm)
      const eveningHR = generateHeartRate(patient, 6 - day, true);
      const eveningTimestamp = generateTimestamp(day, true);
      const eveningStaff = staff[(day + 1) % staff.length]; // Different nurse

      records.push({
        patient_id: patient.id,
        measured_at: eveningTimestamp,
        heart_rate: eveningHR,
        input_method: 'manual',
        recorded_by: eveningStaff,
      });

      console.log(`  Day -${day}: Evening HR = ${eveningHR} bpm`);
    }

    console.log('');
  }

  return records;
}

/**
 * Insert records into database
 */
async function insertRecords(records) {
  console.log(`\nInserting ${records.length} vital signs records into database...`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;

    for (const record of records) {
      const query = `
        INSERT INTO vital_signs (
          patient_id,
          measured_at,
          heart_rate,
          input_method,
          recorded_by
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      await client.query(query, [
        record.patient_id,
        record.measured_at,
        record.heart_rate,
        record.input_method,
        record.recorded_by,
      ]);

      inserted++;
    }

    await client.query('COMMIT');

    console.log(`✅ Successfully inserted ${inserted} records`);

    // Verify insertion
    const result = await client.query(`
      SELECT
        p.given_name || ' ' || p.family_name as patient_name,
        COUNT(*) as reading_count,
        MIN(vs.heart_rate) as min_hr,
        MAX(vs.heart_rate) as max_hr,
        ROUND(AVG(vs.heart_rate)::numeric, 1) as avg_hr
      FROM vital_signs vs
      JOIN patients p ON vs.patient_id = p.patient_id
      WHERE vs.heart_rate IS NOT NULL
      GROUP BY p.patient_id, patient_name
      ORDER BY patient_name
    `);

    console.log('\n📊 Verification Summary:');
    console.log('─'.repeat(70));
    console.log('Patient Name          | Readings | Min HR | Max HR | Avg HR');
    console.log('─'.repeat(70));

    result.rows.forEach(row => {
      console.log(
        `${row.patient_name.padEnd(20)} | ${String(row.reading_count).padStart(8)} | ${String(row.min_hr).padStart(6)} | ${String(row.max_hr).padStart(6)} | ${String(row.avg_hr).padStart(6)}`
      );
    });

    console.log('─'.repeat(70));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error inserting records:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═'.repeat(70));
  console.log('  Heart Rate History Generator');
  console.log('  7 days × 2 readings/day × 5 patients = 70 records');
  console.log('═'.repeat(70));
  console.log('');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Generate records
    const records = await generateVitalsHistory();

    // Insert into database
    await insertRecords(records);

    console.log('\n✅ Heart rate history generation complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
main();

export { generateVitalsHistory, insertRecords };
