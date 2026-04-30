import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// WheelPros tire brands
const wpBrands = await pool.query(`
  SELECT DISTINCT brand_desc as brand FROM wp_tires 
  WHERE brand_desc IS NOT NULL 
  ORDER BY brand_desc
`);
console.log('=== WHEELPROS TIRE BRANDS (' + wpBrands.rows.length + ') ===');
console.log(wpBrands.rows.map(r => r.brand).join(', '));

// TireWeb cache brands by source
const twBrands = await pool.query(`
  SELECT source, COUNT(*) as cnt, array_agg(DISTINCT brand ORDER BY brand) as brands
  FROM tireweb_sku_cache 
  WHERE brand IS NOT NULL 
  GROUP BY source
  ORDER BY source
`);
console.log('\n=== TIREWEB CACHE BRANDS BY SOURCE ===');
twBrands.rows.forEach(r => {
  console.log(`\n${r.source} (${r.cnt} SKUs):`);
  console.log(r.brands.join(', '));
});

// Check for Ironman, Argus, RBP specifically
const search = await pool.query(`
  SELECT DISTINCT brand, source FROM tireweb_sku_cache 
  WHERE LOWER(brand) LIKE '%ironman%' 
     OR LOWER(brand) LIKE '%argus%' 
     OR LOWER(brand) LIKE '%rbp%'
  ORDER BY source, brand
`);
console.log('\n=== IRONMAN/ARGUS/RBP IN TIREWEB CACHE ===');
if (search.rows.length) {
  console.table(search.rows);
} else {
  console.log('NOT FOUND in cache');
}

// Check TireWeb connections
const twConn = await pool.query(`SELECT supplier_id, supplier_name, enabled FROM tireweb_connections`);
console.log('\n=== TIREWEB_CONNECTIONS ===');
console.table(twConn.rows);

await pool.end();
