import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Get breakdown by category and brand
const result = await pool.query(`
  SELECT 
    category,
    sub_type,
    brand,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE image_url IS NULL) as missing_images
  FROM accessories
  GROUP BY category, sub_type, brand
  HAVING COUNT(*) FILTER (WHERE image_url IS NULL) > 0
  ORDER BY COUNT(*) FILTER (WHERE image_url IS NULL) DESC
  LIMIT 50
`);

console.log('Categories/Brands with missing images:\n');
console.log('Category | Sub-Type | Brand | Missing | Total');
console.log('-'.repeat(80));

for (const row of result.rows) {
  const pct = Math.round((row.missing_images / row.total) * 100);
  console.log(`${row.category} | ${row.sub_type || '-'} | ${row.brand || 'Unknown'} | ${row.missing_images}/${row.total} (${pct}%)`);
}

// Get totals by category
console.log('\n\nTotals by category:');
const totals = await pool.query(`
  SELECT 
    category,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE image_url IS NULL) as missing,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL) as have_images
  FROM accessories
  GROUP BY category
  ORDER BY COUNT(*) FILTER (WHERE image_url IS NULL) DESC
`);

console.log('\nCategory | Have Images | Missing | Total');
console.log('-'.repeat(60));
for (const row of totals.rows) {
  console.log(`${row.category} | ${row.have_images} | ${row.missing} | ${row.total}`);
}

// Sample products without images for top categories
console.log('\n\nSample products without images (by brand):');
const samples = await pool.query(`
  SELECT DISTINCT ON (brand) 
    sku, title, brand, category, sub_type
  FROM accessories 
  WHERE image_url IS NULL 
    AND brand IS NOT NULL
    AND brand != 'Misc Accessories'
  ORDER BY brand, sku
  LIMIT 20
`);

for (const row of samples.rows) {
  console.log(`\n${row.brand}:`);
  console.log(`  SKU: ${row.sku}`);
  console.log(`  Title: ${row.title}`);
  console.log(`  Category: ${row.category} / ${row.sub_type || '-'}`);
}

await pool.end();
