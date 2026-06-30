import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const r = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_discontinued=FALSE) as active,
    COUNT(*) FILTER (WHERE image1 IS NOT NULL AND image1 NOT LIKE 'http%cdn.bfldr%') as images_mirrored,
    COUNT(*) FILTER (WHERE image1 LIKE 'http%cdn.bfldr%') as images_cdn_only,
    COUNT(*) FILTER (WHERE image1 IS NULL) as images_missing,
    MIN(created_at)::text as first_import,
    MAX(updated_at)::text as last_update,
    COUNT(DISTINCT brand) as brands
  FROM wheel1_products
`);
console.log('DB state:', r.rows[0]);
const brands = await pool.query('SELECT brand, COUNT(*) as cnt FROM wheel1_products GROUP BY brand ORDER BY cnt DESC');
console.log('Brands:', brands.rows.map(b => `${b.brand}:${b.cnt}`).join(', '));
await pool.end();
