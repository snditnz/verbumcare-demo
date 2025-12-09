import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration(migrationFile) {
  try {
    console.log(`\n📄 Reading migration file: ${migrationFile}`);
    const migrationPath = join(__dirname, 'migrations', migrationFile);
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🔌 Testing database connection...');
    await db.testConnection();

    console.log('🚀 Running migration...\n');
    await db.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file.sql>');
  console.error('Example: node run-migration.js 006_create_clinical_notes_table.sql');
  process.exit(1);
}

runMigration(migrationFile);
