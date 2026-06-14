/**
 * Run lead capture migration
 * Usage: node scripts/run-lead-migration.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log('Running lead capture migration...');
  
  const sqlPath = join(__dirname, '..', 'migrations', '2026-07-18-lead-capture.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  
  try {
    // Run the entire SQL file as one query
    await pool.query(sql);
    console.log('Migration executed successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
    
    // If it's a "already exists" error, that's fine
    if (err.message.includes('already exists')) {
      console.log('Tables may already exist, continuing...');
    } else {
      throw err;
    }
  }
  
  // Verify tables exist
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('leads', 'jake_builds', 'funnel_events_daily')
    ORDER BY table_name
  `);
  
  console.log('\nTables verified:');
  for (const row of tables) {
    // Get row count
    const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM ${row.table_name}`);
    console.log(`  ✓ ${row.table_name} (${countRows[0].count} rows)`);
  }
  
  // Check views
  const { rows: views } = await pool.query(`
    SELECT table_name FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name IN ('lead_source_stats', 'daily_lead_stats', 'jake_build_stats', 'funnel_conversion_rates')
    ORDER BY table_name
  `);
  
  if (views.length > 0) {
    console.log('\nViews created:');
    for (const row of views) {
      console.log(`  ✓ ${row.table_name}`);
    }
  }
  
  await pool.end();
  console.log('\nMigration complete!');
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
