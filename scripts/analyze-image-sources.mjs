import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Get image URL patterns for products that have images
const result = await pool.query(`
  SELECT 
    brand,
    CASE 
      WHEN image_url LIKE '%s3-us-west-2%' THEN 's3-bucket'
      WHEN image_url LIKE '%media.wheelpros%' THEN 'media-wheelpros'
      WHEN image_url LIKE '%assets.wheelpros%' THEN 'assets-wheelpros'
      WHEN image_url LIKE '%dl.wheelpros%' THEN 'dealerline'
      WHEN image_url LIKE '%morimotohid%' THEN 'morimoto-direct'
      ELSE 'other'
    END as source,
    COUNT(*) as count
  FROM accessories 
  WHERE image_url IS NOT NULL
  AND brand IN ('Gorilla Automotive', 'Morimoto Offroad', 'Teraflex', 'Fox Shocks', 'Bilstein', 'GTR Lighting')
  GROUP BY brand, 
    CASE 
      WHEN image_url LIKE '%s3-us-west-2%' THEN 's3-bucket'
      WHEN image_url LIKE '%media.wheelpros%' THEN 'media-wheelpros'
      WHEN image_url LIKE '%assets.wheelpros%' THEN 'assets-wheelpros'
      WHEN image_url LIKE '%dl.wheelpros%' THEN 'dealerline'
      WHEN image_url LIKE '%morimotohid%' THEN 'morimoto-direct'
      ELSE 'other'
    END
  ORDER BY brand, count DESC
`);

console.log('Image sources by brand:\n');
console.table(result.rows);

// Sample actual URLs
console.log('\nSample image URLs:');
const samples = await pool.query(`
  SELECT brand, sku, image_url 
  FROM accessories 
  WHERE image_url IS NOT NULL 
  AND brand IN ('Gorilla Automotive', 'GTR Lighting', 'Teraflex')
  LIMIT 10
`);

for (const r of samples.rows) {
  console.log(`\n${r.brand} (${r.sku}):`);
  console.log(`  ${r.image_url}`);
}

await pool.end();
