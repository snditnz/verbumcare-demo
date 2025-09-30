import db from './index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath = path.join(__dirname, 'seed.sql');

    console.log('Reading schema file...');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');

    console.log('Reading seed data file...');
    const seedSQL = await fs.readFile(seedPath, 'utf8');

    console.log('Executing schema...');
    await db.query(schemaSQL);

    console.log('Inserting seed data...');
    await db.query(seedSQL);

    console.log('Database seeding completed successfully!');

    const patientCount = await db.query('SELECT COUNT(*) FROM patients');
    const medicationCount = await db.query('SELECT COUNT(*) FROM medication_orders');
    const staffCount = await db.query('SELECT COUNT(*) FROM staff');

    console.log('Seeded data summary:');
    console.log(`- Patients: ${patientCount.rows[0].count}`);
    console.log(`- Medication Orders: ${medicationCount.rows[0].count}`);
    console.log(`- Staff Members: ${staffCount.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();