/**
 * Sync Accessory Images from S3 Bucket
 * 
 * Crawls https://wp-media-assets.s3-us-west-2.amazonaws.com/?prefix=Accessories/
 * to find available images, then updates the database with valid URLs.
 * 
 * Usage: node scripts/sync-accessory-images.mjs
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const S3_BUCKET = 'https://wp-media-assets.s3-us-west-2.amazonaws.com';
const S3_PREFIX = 'Accessories/';

/**
 * List all keys from S3 bucket with pagination
 */
async function listAllS3Keys() {
  const keys = new Map(); // sku -> full key (with extension)
  let marker = '';
  let pageCount = 0;
  
  console.log('Fetching S3 image listing...');
  
  while (true) {
    const url = `${S3_BUCKET}/?prefix=${S3_PREFIX}&max-keys=1000${marker ? `&marker=${marker}` : ''}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`S3 list failed: ${res.status}`);
    }
    
    const xml = await res.text();
    
    // Parse XML to extract keys
    const keyMatches = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)];
    
    if (keyMatches.length === 0) break;
    
    for (const match of keyMatches) {
      const key = match[1]; // e.g., "Accessories/70028S.png"
      const filename = key.replace(S3_PREFIX, ''); // e.g., "70028S.png"
      const sku = filename.replace(/\.(png|jpg|jpeg)$/i, ''); // e.g., "70028S"
      
      // Prefer PNG over JPG if both exist
      if (!keys.has(sku) || filename.endsWith('.png')) {
        keys.set(sku, key);
      }
    }
    
    // Check if truncated (more pages)
    if (!xml.includes('<IsTruncated>true</IsTruncated>')) break;
    
    // Get last key as marker for next page
    marker = encodeURIComponent(keyMatches[keyMatches.length - 1][1]);
    pageCount++;
    
    if (pageCount % 10 === 0) {
      console.log(`  ... fetched ${keys.size} images (page ${pageCount})`);
    }
  }
  
  console.log(`Found ${keys.size} total images in S3`);
  return keys;
}

/**
 * Update database with valid image URLs using batch updates
 */
async function updateDatabase(pool, imageKeys) {
  console.log('\nUpdating database...');
  
  // Build a map of SKU -> S3 URL for all images
  const skuToUrl = new Map();
  for (const [sku, key] of imageKeys) {
    skuToUrl.set(sku, `${S3_BUCKET}/${key}`);
  }
  
  // Step 1: Update all accessories that have images in S3 (batch by building a VALUES clause)
  console.log('Updating accessories with valid S3 images...');
  
  // Convert to array for batch processing
  const entries = Array.from(skuToUrl.entries());
  const BATCH_SIZE = 500;
  let updated = 0;
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    
    // Build a single UPDATE using CASE WHEN
    const cases = batch.map(([sku, url], idx) => `WHEN sku = $${idx * 2 + 1} THEN $${idx * 2 + 2}`).join(' ');
    const skus = batch.map(([sku]) => sku);
    const params = batch.flatMap(([sku, url]) => [sku, url]);
    
    const skuPlaceholders = batch.map((_, idx) => `$${idx * 2 + 1}`).join(',');
    
    const sql = `
      UPDATE accessories 
      SET image_url = CASE ${cases} END,
          updated_at = NOW()
      WHERE sku IN (${skuPlaceholders})
    `;
    
    const result = await pool.query(sql, params);
    updated += result.rowCount;
    
    if ((i / BATCH_SIZE) % 5 === 0) {
      console.log(`  ... processed ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} images`);
    }
  }
  
  console.log(`Updated ${updated} accessories with S3 images`);
  
  // Step 2: Clear broken images.wheelpros.com URLs
  console.log('\nClearing broken image URLs...');
  const clearResult = await pool.query(`
    UPDATE accessories 
    SET image_url = NULL, updated_at = NOW()
    WHERE image_url LIKE '%images.wheelpros.com%'
  `);
  console.log(`Cleared ${clearResult.rowCount} broken image URLs`);
  
  // Step 3: Get stats
  const stats = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images,
      COUNT(*) FILTER (WHERE image_url IS NULL) as without_images,
      COUNT(*) as total
    FROM accessories
  `);
  
  console.log(`\nFinal stats:`);
  console.log(`  With images: ${stats.rows[0].with_images}`);
  console.log(`  Without images: ${stats.rows[0].without_images}`);
  console.log(`  Total: ${stats.rows[0].total}`);
}

async function main() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    // Step 1: List all images from S3
    const imageKeys = await listAllS3Keys();
    
    // Step 2: Update database
    await updateDatabase(pool, imageKeys);
    
    console.log('\nDone!');
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
