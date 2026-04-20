import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check URL patterns
const { rows } = await pool.query(`
  SELECT 
    CASE 
      WHEN cdn_url LIKE '%blob.vercel%' THEN 'vercel_blob'
      WHEN cdn_url LIKE '%cloudfront%' THEN 'cloudfront'
      WHEN cdn_url IS NULL THEN 'none'
      ELSE 'other'
    END as url_type,
    COUNT(*) as cnt
  FROM gallery_assets
  GROUP BY 1
  ORDER BY cnt DESC
`);

console.log('=== URL Patterns in gallery_assets ===');
rows.forEach(r => console.log(`  ${r.url_type}: ${r.cnt}`));

// Sample of different types
const { rows: samples } = await pool.query(`
  SELECT id, wheel_brand, cdn_url 
  FROM gallery_assets 
  WHERE cdn_url IS NOT NULL 
  LIMIT 3
`);
console.log('\n=== Sample CDN URLs ===');
samples.forEach(r => console.log(`  [${r.id}] ${r.wheel_brand}: ${r.cdn_url?.slice(0,80)}...`));

await pool.end();
