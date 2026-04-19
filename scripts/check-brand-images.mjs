import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

const brands = [
  'Gorilla Automotive',
  'Morimoto Offroad', 
  'Teraflex',
  'Fox Shocks',
  'Bilstein',
  'GTR Lighting'
];

console.log('Brand image status:\n');

for (const brand of brands) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images,
      COUNT(*) FILTER (WHERE image_url IS NULL) as missing
    FROM accessories 
    WHERE brand = $1
  `, [brand]);
  
  const r = result.rows[0];
  console.log(`${brand}: ${r.with_images}/${r.total} have images (${r.missing} missing)`);
}

// Sample SKUs without images for each brand
console.log('\n\nSample SKUs without images:');
for (const brand of brands) {
  const samples = await pool.query(`
    SELECT sku, title FROM accessories 
    WHERE brand = $1 AND image_url IS NULL 
    LIMIT 3
  `, [brand]);
  
  if (samples.rows.length > 0) {
    console.log(`\n${brand}:`);
    samples.rows.forEach(r => console.log(`  ${r.sku} - ${r.title.slice(0, 50)}`));
  }
}

// Check S3 bucket for a sample Gorilla SKU
console.log('\n\nTesting S3 bucket URLs...');
const gorillaSample = await pool.query(`
  SELECT sku FROM accessories WHERE brand = 'Gorilla Automotive' AND image_url IS NULL LIMIT 5
`);

for (const row of gorillaSample.rows) {
  const s3Url = `https://wp-media-assets.s3-us-west-2.amazonaws.com/Accessories/${row.sku}.png`;
  try {
    const resp = await fetch(s3Url, { method: 'HEAD' });
    console.log(`${row.sku}: ${resp.status} ${resp.ok ? '✅' : '❌'}`);
  } catch (e) {
    console.log(`${row.sku}: ERROR`);
  }
}

await pool.end();
