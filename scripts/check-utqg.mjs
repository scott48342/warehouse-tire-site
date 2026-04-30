import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check tire_pattern_specs table for UTQG data
const schema = await pool.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'tire_pattern_specs'
  ORDER BY ordinal_position
`);
console.log('=== TIRE_PATTERN_SPECS COLUMNS ===');
console.log(schema.rows.map(r => r.column_name).join(', '));

// Check if we have UTQG for target brands
const utqg = await pool.query(`
  SELECT brand, COUNT(*) as total,
    COUNT(utqg) as with_utqg,
    COUNT(treadwear) as with_treadwear
  FROM tire_pattern_specs
  WHERE UPPER(brand) IN ('IRONMAN', 'RBP', 'ARGUS ADVANTA', 'ARGUS')
  GROUP BY brand
`);
console.log('\n=== UTQG FOR TARGET BRANDS ===');
if (utqg.rows.length) {
  console.table(utqg.rows);
} else {
  console.log('No records found in tire_pattern_specs for these brands');
}

// Sample some records to see what data we have
const sample = await pool.query(`
  SELECT brand, pattern_name, utqg, treadwear, traction, temperature
  FROM tire_pattern_specs
  WHERE UPPER(brand) IN ('IRONMAN', 'RBP', 'ARGUS ADVANTA', 'ARGUS')
  LIMIT 10
`);
console.log('\n=== SAMPLE RECORDS ===');
if (sample.rows.length) {
  console.table(sample.rows);
} else {
  console.log('No pattern specs for these brands');
}

// Check overall UTQG coverage
const coverage = await pool.query(`
  SELECT 
    COUNT(*) as total_patterns,
    COUNT(utqg) as with_utqg,
    COUNT(treadwear) as with_treadwear,
    ROUND(100.0 * COUNT(utqg) / NULLIF(COUNT(*), 0), 1) as utqg_pct
  FROM tire_pattern_specs
`);
console.log('\n=== OVERALL UTQG COVERAGE ===');
console.table(coverage.rows);

// Check what brands DO have UTQG
const brandsWithUtqg = await pool.query(`
  SELECT brand, COUNT(*) as patterns, COUNT(utqg) as with_utqg
  FROM tire_pattern_specs
  WHERE utqg IS NOT NULL
  GROUP BY brand
  ORDER BY with_utqg DESC
  LIMIT 20
`);
console.log('\n=== TOP BRANDS WITH UTQG DATA ===');
console.table(brandsWithUtqg.rows);

await pool.end();
