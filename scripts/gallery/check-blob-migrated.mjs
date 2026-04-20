import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Count by URL type
const { rows: counts } = await pool.query(`
  SELECT 
    CASE 
      WHEN cdn_url LIKE '%blob.vercel%' THEN 'vercel_blob'
      WHEN cdn_url LIKE '%cloudfront%' THEN 'cloudfront'
      ELSE 'other/null'
    END as url_type,
    COUNT(*) as cnt
  FROM gallery_assets
  GROUP BY 1
  ORDER BY cnt DESC
`);

console.log('=== CDN URL Types ===');
counts.forEach(r => console.log(`  ${r.url_type}: ${r.cnt}`));

// Show blob URLs
const { rows: blobSamples } = await pool.query(`
  SELECT id, wheel_brand, cdn_url
  FROM gallery_assets
  WHERE cdn_url LIKE '%blob.vercel%'
  LIMIT 5
`);

if (blobSamples.length > 0) {
  console.log('\n=== Vercel Blob URLs ===');
  blobSamples.forEach(r => console.log(`  [${r.id}] ${r.wheel_brand}: ${r.cdn_url}`));
}

await pool.end();
