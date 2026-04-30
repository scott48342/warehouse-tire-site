import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check if model column has any data
const models = await pool.query(`
  SELECT COUNT(*) as total, COUNT(model) as with_model
  FROM tireweb_sku_cache
`);
console.log('=== MODEL COLUMN STATUS ===');
console.log(`Total: ${models.rows[0].total}, With Model: ${models.rows[0].with_model}`);

// Check what unique patterns we can get from description parsing
const patterns = await pool.query(`
  SELECT DISTINCT brand, 
    SPLIT_PART(description, ' ', 1) as possible_model,
    COUNT(*) as cnt
  FROM tireweb_sku_cache
  WHERE brand = 'IRONMAN'
  GROUP BY brand, SPLIT_PART(description, ' ', 1)
  ORDER BY cnt DESC
  LIMIT 20
`);
console.log('\n=== IRONMAN PATTERNS (from description) ===');
console.table(patterns.rows);

await pool.end();
