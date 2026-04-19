import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check TPMS image coverage
const stats = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(image_url) as with_image,
    COUNT(*) - COUNT(image_url) as missing_image
  FROM accessories 
  WHERE category = 'tpms' AND in_stock = true
`);
console.log('TPMS Image Stats (in-stock only):');
console.table(stats.rows);

// Check by brand
const brands = await pool.query(`
  SELECT 
    brand,
    COUNT(*) as total,
    COUNT(image_url) as with_image
  FROM accessories 
  WHERE category = 'tpms' AND in_stock = true
  GROUP BY brand
  ORDER BY total DESC
`);
console.log('\nBy Brand:');
console.table(brands.rows);

// Sample without images
const missing = await pool.query(`
  SELECT sku, title, brand
  FROM accessories 
  WHERE category = 'tpms' AND in_stock = true AND image_url IS NULL
  LIMIT 15
`);
console.log('\nSample TPMS without images:');
console.table(missing.rows);

// Sample with images (to see URL pattern)
const withImg = await pool.query(`
  SELECT sku, title, brand, image_url
  FROM accessories 
  WHERE category = 'tpms' AND in_stock = true AND image_url IS NOT NULL
  LIMIT 5
`);
console.log('\nSample TPMS WITH images:');
console.table(withImg.rows);

await pool.end();
