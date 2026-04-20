import pg from 'pg';
import fs from 'fs';

// Parse .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envMatch = envContent.match(/^POSTGRES_URL=["']?([^"'\r\n]+)["']?$/m);
const POSTGRES_URL = envMatch ? envMatch[1].trim() : null;
if (!POSTGRES_URL) throw new Error('POSTGRES_URL not found');

const { Pool } = pg;
const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node run-migration.mjs <sql-file>');
  process.exit(1);
}

const sql = fs.readFileSync(sqlFile, 'utf-8');
console.log('Running migration:', sqlFile);

try {
  await pool.query(sql);
  console.log('✅ Migration complete');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
