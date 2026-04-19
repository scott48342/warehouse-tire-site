import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Fix BAR-xROW and BAF08x products - move to lighting category
const result = await pool.query(`
  UPDATE accessories 
  SET category = 'lighting', sub_type = 'light_bar'
  WHERE (sku LIKE 'BAR-%ROW%' OR sku LIKE 'BAF08%')
    AND category = 'other'
  RETURNING sku
`);

console.log(`Fixed ${result.rowCount} products - moved to lighting/light_bar`);

// Verify
const check = await pool.query(`
  SELECT category, sub_type, COUNT(*) as count 
  FROM accessories 
  WHERE sub_type = 'light_bar'
  GROUP BY category, sub_type
`);
console.log('\nLight bar products now:');
console.table(check.rows);

await pool.end();
