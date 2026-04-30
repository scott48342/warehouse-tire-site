import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check if ANY tireweb_sku_cache records have UTQG populated
const hasUtqg = await pool.query(`
  SELECT source, COUNT(*) as total, 
         COUNT(utqg) as with_utqg,
         ROUND(100.0 * COUNT(utqg) / NULLIF(COUNT(*), 0), 1) as pct
  FROM tireweb_sku_cache
  GROUP BY source
  ORDER BY source
`);
console.log('=== UTQG IN TIREWEB_SKU_CACHE ===');
console.table(hasUtqg.rows);

// Sample some records with UTQG
const samples = await pool.query(`
  SELECT part_number, brand, source, utqg, treadwear, model
  FROM tireweb_sku_cache
  WHERE utqg IS NOT NULL
  LIMIT 10
`);
console.log('\n=== SAMPLE RECORDS WITH UTQG ===');
if (samples.rows.length) {
  console.table(samples.rows);
} else {
  console.log('No records have UTQG yet - cache needs to be populated by searches');
}

// Check for target brands specifically
const targetBrands = await pool.query(`
  SELECT brand, source, COUNT(*) as total, COUNT(utqg) as with_utqg
  FROM tireweb_sku_cache
  WHERE UPPER(brand) IN ('IRONMAN', 'RBP', 'ARGUS ADVANTA')
  GROUP BY brand, source
`);
console.log('\n=== TARGET BRANDS IN CACHE ===');
if (targetBrands.rows.length) {
  console.table(targetBrands.rows);
}

await pool.end();
