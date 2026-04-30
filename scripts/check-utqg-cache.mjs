import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check tireweb_sku_cache schema
const schema = await pool.query(`
  SELECT column_name, data_type FROM information_schema.columns 
  WHERE table_name = 'tireweb_sku_cache'
  ORDER BY ordinal_position
`);
console.log('=== TIREWEB_SKU_CACHE SCHEMA ===');
schema.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

// The cache only has: part_number, size, brand, source, last_seen_at, created_at
// It doesn't store UTQG!

// Check if tire_pattern_specs would match TireWeb brands
const twBrands = await pool.query(`
  SELECT DISTINCT brand FROM tireweb_sku_cache 
  WHERE last_seen_at > NOW() - INTERVAL '7 days'
`);

const specBrands = await pool.query(`
  SELECT DISTINCT brand FROM tire_pattern_specs
`);

const twSet = new Set(twBrands.rows.map(r => r.brand?.toUpperCase()));
const specSet = new Set(specBrands.rows.map(r => r.brand?.toUpperCase()));

const inTwNotSpec = [...twSet].filter(b => !specSet.has(b));
const inSpecNotTw = [...specSet].filter(b => !twSet.has(b));

console.log('\n=== BRAND COVERAGE GAP ===');
console.log('TireWeb brands missing from specs:', inTwNotSpec.length);
console.log(inTwNotSpec.sort().join(', '));

await pool.end();
