import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Overall stats
const stats = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(utqg) as with_utqg,
    COUNT(DISTINCT brand) as brands
  FROM tire_pattern_specs
`);
console.log('=== TIRE_PATTERN_SPECS STATS ===');
console.log(`Total patterns: ${stats.rows[0].total}`);
console.log(`With UTQG: ${stats.rows[0].with_utqg}`);
console.log(`Brands: ${stats.rows[0].brands}`);

// Brands with UTQG
const brands = await pool.query(`
  SELECT brand, COUNT(*) as patterns, COUNT(utqg) as with_utqg
  FROM tire_pattern_specs
  GROUP BY brand
  ORDER BY with_utqg DESC
  LIMIT 30
`);
console.log('\n=== TOP BRANDS WITH UTQG ===');
console.table(brands.rows);

// Check specific patterns for our target brands
const targets = await pool.query(`
  SELECT brand, pattern_name, utqg
  FROM tire_pattern_specs
  WHERE UPPER(brand) IN ('IRONMAN', 'RBP', 'ARGUS ADVANTA')
  ORDER BY brand, pattern_name
`);
console.log('\n=== TARGET BRAND PATTERNS ===');
console.table(targets.rows);

await pool.end();
