/**
 * Fix broken Wheel-1 CDN image URLs.
 *
 * The 129 failing images are all Cali Off-Road 9110D (dually) SKUs
 * referencing two specific Bynder files that return HTTP 404:
 *   - Cali911DF-GB1.png  (front dually variant)
 *   - Cali911DR-GB1.png  (rear dually variant)
 *
 * These files don't exist on Wheel-1's CDN. We NULL them out so the
 * site shows a graceful placeholder instead of a broken image.
 *
 * Run: node scripts/wheel1-fix-broken-images.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const BROKEN_PATTERNS = [
  'Cali911DF-GB1.png',
  'Cali911DR-GB1.png',
];

// Find all affected rows
const affected = await pool.query(`
  SELECT id, sku, brand, image1_source, image2_source, image3_source, image4_source
  FROM wheel1_products
  WHERE (
    image1_source LIKE '%Cali911DF-GB1%' OR image1_source LIKE '%Cali911DR-GB1%' OR
    image2_source LIKE '%Cali911DF-GB1%' OR image2_source LIKE '%Cali911DR-GB1%' OR
    image3_source LIKE '%Cali911DF-GB1%' OR image3_source LIKE '%Cali911DR-GB1%' OR
    image4_source LIKE '%Cali911DF-GB1%' OR image4_source LIKE '%Cali911DR-GB1%'
  ) AND is_discontinued = FALSE
`);

console.log(`\nFound ${affected.rows.length} SKUs with broken CDN image URLs`);
console.log('Sample:', affected.rows.slice(0, 3).map(r => r.sku).join(', '));

if (affected.rows.length === 0) {
  console.log('Nothing to fix.');
  await pool.end();
  process.exit(0);
}

// NULL out image1/image1_source where they point to broken files
// image columns: if the broken filename is in image1_source, clear both image1 and image1_source
const result = await pool.query(`
  UPDATE wheel1_products SET
    image1        = CASE WHEN image1_source       LIKE '%Cali911DF-GB1%' OR image1_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image1        END,
    image1_source = CASE WHEN image1_source       LIKE '%Cali911DF-GB1%' OR image1_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image1_source END,
    image2        = CASE WHEN image2_source       LIKE '%Cali911DF-GB1%' OR image2_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image2        END,
    image2_source = CASE WHEN image2_source       LIKE '%Cali911DF-GB1%' OR image2_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image2_source END,
    image3        = CASE WHEN image3_source       LIKE '%Cali911DF-GB1%' OR image3_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image3        END,
    image3_source = CASE WHEN image3_source       LIKE '%Cali911DF-GB1%' OR image3_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image3_source END,
    image4        = CASE WHEN image4_source       LIKE '%Cali911DF-GB1%' OR image4_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image4        END,
    image4_source = CASE WHEN image4_source       LIKE '%Cali911DF-GB1%' OR image4_source       LIKE '%Cali911DR-GB1%' THEN NULL ELSE image4_source END,
    updated_at    = NOW()
  WHERE (
    image1_source LIKE '%Cali911DF-GB1%' OR image1_source LIKE '%Cali911DR-GB1%' OR
    image2_source LIKE '%Cali911DF-GB1%' OR image2_source LIKE '%Cali911DR-GB1%' OR
    image3_source LIKE '%Cali911DF-GB1%' OR image3_source LIKE '%Cali911DR-GB1%' OR
    image4_source LIKE '%Cali911DF-GB1%' OR image4_source LIKE '%Cali911DR-GB1%'
  ) AND is_discontinued = FALSE
`);

console.log(`✅ Nulled broken image URLs on ${result.rowCount} rows`);

// Quick recount
const counts = await pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE image1_source IS NOT NULL) as has_img1,
    COUNT(*) FILTER (WHERE image1_source IS NULL)     as no_img1
  FROM wheel1_products WHERE is_discontinued = FALSE
`);
console.log(`After fix: ${counts.rows[0].has_img1} SKUs with image1, ${counts.rows[0].no_img1} without`);

await pool.end();
