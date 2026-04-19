import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Clear broken WheelPros image URLs for Schrader products
const result = await pool.query(`
  UPDATE accessories 
  SET image_url = NULL, updated_at = NOW()
  WHERE brand = 'Schrader' 
    AND image_url LIKE '%images.wheelpros.com%'
  RETURNING sku
`);

console.log(`Cleared ${result.rowCount} broken Schrader image URLs`);

// Also clear broken URLs for Misc Accessories
const misc = await pool.query(`
  UPDATE accessories 
  SET image_url = NULL, updated_at = NOW()
  WHERE brand = 'Misc Accessories' 
    AND image_url LIKE '%images.wheelpros.com%'
  RETURNING sku
`);

console.log(`Cleared ${misc.rowCount} broken Misc Accessories image URLs`);

// Clear any remaining broken 31 Inc URLs
const inc31 = await pool.query(`
  UPDATE accessories 
  SET image_url = NULL, updated_at = NOW()
  WHERE brand = '31 Inc' 
    AND image_url LIKE '%images.wheelpros.com%'
  RETURNING sku
`);

console.log(`Cleared ${inc31.rowCount} remaining broken 31 Inc image URLs`);

await pool.end();
