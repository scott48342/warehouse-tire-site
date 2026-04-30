import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const sql = fs.readFileSync(
  path.join(__dirname, 'migrations', 'expand-tireweb-cache.sql'),
  'utf-8'
);

console.log('Running migration: expand-tireweb-cache.sql');
console.log('---');

try {
  await pool.query(sql);
  console.log('✅ Migration complete!');
  
  // Verify new columns
  const { rows } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tireweb_sku_cache'
    ORDER BY ordinal_position
  `);
  
  console.log('\n=== UPDATED SCHEMA ===');
  rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
