import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Current gallery_assets by brand
const { rows: brands } = await pool.query(`
  SELECT wheel_brand, COUNT(*) as cnt, 
         COUNT(CASE WHEN cdn_url IS NOT NULL THEN 1 END) as with_cdn
  FROM gallery_assets 
  GROUP BY wheel_brand 
  ORDER BY cnt DESC
`);
console.log('=== Current gallery_assets ===');
brands.forEach(r => console.log(`  ${r.wheel_brand || 'NULL'}: ${r.cnt} (${r.with_cdn} with CDN)`));

const { rows: total } = await pool.query(`SELECT COUNT(*) as cnt FROM gallery_assets`);
console.log(`\nTotal: ${total[0].cnt}`);

// Sample a few records
const { rows: samples } = await pool.query(`
  SELECT wheel_brand, wheel_model, vehicle_year, vehicle_make, vehicle_model, cdn_url
  FROM gallery_assets 
  WHERE cdn_url IS NOT NULL
  LIMIT 5
`);
console.log('\n=== Sample records ===');
samples.forEach(r => console.log(`  ${r.wheel_brand} ${r.wheel_model} on ${r.vehicle_year} ${r.vehicle_make} ${r.vehicle_model}`));
console.log(`  URL example: ${samples[0]?.cdn_url?.slice(0,70)}...`);

await pool.end();
