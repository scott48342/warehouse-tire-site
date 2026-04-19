import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Check current state
const before = await pool.query(`
  SELECT sub_type, COUNT(*) as count 
  FROM accessories 
  WHERE category = 'lighting' AND (sub_type LIKE '%light%bar%' OR title ILIKE '%light bar%' OR title ILIKE '%bangerbar%')
  GROUP BY sub_type
`);
console.log('Before - sub_type distribution:');
console.table(before.rows);

// Normalize all light bars to 'light_bar' 
const result = await pool.query(`
  UPDATE accessories 
  SET sub_type = 'light_bar' 
  WHERE category = 'lighting' 
    AND (sub_type = 'light bar' OR title ILIKE '%light bar%' OR title ILIKE '%bangerbar%' OR title ILIKE '%banger bar%')
  RETURNING sku
`);

console.log(`\nUpdated ${result.rowCount} products to sub_type = 'light_bar'`);

// Verify
const after = await pool.query(`
  SELECT sub_type, COUNT(*) as count 
  FROM accessories 
  WHERE category = 'lighting' AND sub_type = 'light_bar'
  GROUP BY sub_type
`);
console.log('\nAfter:');
console.table(after.rows);

await pool.end();
