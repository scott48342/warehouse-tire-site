import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// What the migration script looks for
const { rows: migrationTargets } = await pool.query(`
  SELECT COUNT(*) as cnt FROM gallery_assets
  WHERE (thumbnail_url LIKE '%cloudfront.net%' OR thumbnail_url LIKE '%canto.com%')
    AND thumbnail_url NOT LIKE '%vercel-storage%'
`);
console.log('Migration targets (thumbnail_url with cloudfront/canto):', migrationTargets[0].cnt);

// What we have by URL type
const { rows: urlTypes } = await pool.query(`
  SELECT 
    CASE 
      WHEN thumbnail_url LIKE '%blob.vercel%' THEN 'vercel_blob'
      WHEN thumbnail_url LIKE '%cloudfront%' THEN 'cloudfront'
      WHEN thumbnail_url IS NULL THEN 'null'
      ELSE 'other: ' || LEFT(thumbnail_url, 40)
    END as thumb_type,
    CASE
      WHEN cdn_url LIKE '%blob.vercel%' THEN 'vercel_blob'
      WHEN cdn_url LIKE '%cloudfront%' THEN 'cloudfront'
      WHEN cdn_url IS NULL THEN 'null'
      ELSE 'other'
    END as cdn_type,
    COUNT(*) as cnt
  FROM gallery_assets
  GROUP BY 1, 2
  ORDER BY cnt DESC
`);
console.log('\nURL types:');
urlTypes.forEach(r => console.log(`  thumb=${r.thumb_type}, cdn=${r.cdn_type}: ${r.cnt}`));

// Sample of what migration is trying to process
const { rows: samples } = await pool.query(`
  SELECT id, thumbnail_url, source_url
  FROM gallery_assets
  WHERE (thumbnail_url LIKE '%cloudfront.net%' OR thumbnail_url LIKE '%canto.com%')
  LIMIT 3
`);
console.log('\nSample migration targets:');
samples.forEach(r => {
  console.log(`  [${r.id}] thumb: ${r.thumbnail_url?.slice(0,60) || 'NULL'}`);
  console.log(`         source: ${r.source_url?.slice(0,60) || 'NULL'}`);
});

await pool.end();
