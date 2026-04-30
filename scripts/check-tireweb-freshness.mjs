import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check freshness of TireWeb cache
const freshness = await pool.query(`
  SELECT 
    MIN(last_seen_at) as oldest,
    MAX(last_seen_at) as newest,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '7 days') as recent
  FROM tireweb_sku_cache
`);
console.log('=== TIREWEB CACHE FRESHNESS ===');
console.log('Oldest:', freshness.rows[0].oldest);
console.log('Newest:', freshness.rows[0].newest);
console.log('Total records:', freshness.rows[0].total);
console.log('Recent (7 days):', freshness.rows[0].recent);

// Check brands that would be returned
const brands = await pool.query(`
  SELECT brand, COUNT(DISTINCT part_number) as count
  FROM tireweb_sku_cache
  WHERE brand IS NOT NULL 
    AND brand != ''
    AND last_seen_at > NOW() - INTERVAL '7 days'
  GROUP BY brand
  ORDER BY count DESC
`);
console.log('\n=== TIREWEB BRANDS (RECENT) ===');
brands.rows.forEach(r => console.log(`  ${r.brand}: ${r.count} SKUs`));

// Check for Ironman, RBP, Argus specifically
const target = await pool.query(`
  SELECT brand, source, COUNT(*) as cnt, MAX(last_seen_at) as last_seen
  FROM tireweb_sku_cache
  WHERE LOWER(brand) IN ('ironman', 'rbp', 'argus advanta')
  GROUP BY brand, source
`);
console.log('\n=== TARGET BRANDS STATUS ===');
console.table(target.rows);

await pool.end();
