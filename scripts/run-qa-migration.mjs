/**
 * Run QA Infrastructure Migration
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;

async function runMigration() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('ERROR: No POSTGRES_URL configured');
    process.exit(1);
  }
  
  console.log('[migration] Connecting to database...');
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    // Test connection
    const testResult = await pool.query('SELECT NOW() as now');
    console.log(`[migration] Connected at ${testResult.rows[0].now}`);
    
    // Read migration SQL
    const sqlPath = path.join(__dirname, 'migrations', '0031_qa_infrastructure.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('[migration] Running migration...');
    await pool.query(sql);
    console.log('[migration] Migration executed successfully');
    
    // Verify tables
    console.log('\n[migration] Verifying tables...');
    
    const tables = ['qa_runs', 'qa_results', 'qa_anomalies', 'qa_baselines', 'qa_canary_vehicles'];
    for (const table of tables) {
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      const exists = parseInt(result.rows[0].count) > 0;
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    }
    
    // Verify canary vehicles seeded
    const canaryResult = await pool.query('SELECT COUNT(*) as count FROM qa_canary_vehicles');
    console.log(`\n[migration] Canary vehicles seeded: ${canaryResult.rows[0].count}`);
    
    // List canary vehicles
    const canaries = await pool.query(`
      SELECT year, make, model, trim, category 
      FROM qa_canary_vehicles 
      ORDER BY priority DESC 
      LIMIT 10
    `);
    console.log('\n[migration] Top canary vehicles:');
    for (const v of canaries.rows) {
      console.log(`  - ${v.year} ${v.make} ${v.model} ${v.trim || ''} (${v.category})`);
    }
    
    // Verify indexes
    const indexResult = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename LIKE 'qa_%'
      ORDER BY indexname
    `);
    console.log(`\n[migration] Indexes created: ${indexResult.rows.length}`);
    for (const idx of indexResult.rows.slice(0, 10)) {
      console.log(`  - ${idx.indexname}`);
    }
    if (indexResult.rows.length > 10) {
      console.log(`  ... and ${indexResult.rows.length - 10} more`);
    }
    
    // Verify foreign keys
    const fkResult = await pool.query(`
      SELECT conname FROM pg_constraint 
      WHERE contype = 'f' AND conrelid::regclass::text LIKE 'qa_%'
    `);
    console.log(`\n[migration] Foreign keys: ${fkResult.rows.length}`);
    for (const fk of fkResult.rows) {
      console.log(`  - ${fk.conname}`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (err) {
    console.error('[migration] ERROR:', err.message);
    if (err.message.includes('already exists')) {
      console.log('\n[migration] Tables may already exist - checking...');
      
      const tables = ['qa_runs', 'qa_results', 'qa_anomalies', 'qa_baselines', 'qa_canary_vehicles'];
      for (const table of tables) {
        const result = await pool.query(`
          SELECT COUNT(*) as count FROM information_schema.tables 
          WHERE table_name = $1
        `, [table]);
        const exists = parseInt(result.rows[0].count) > 0;
        console.log(`  ${exists ? '✓' : '✗'} ${table}`);
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
