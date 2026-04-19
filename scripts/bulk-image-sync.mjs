/**
 * Bulk sync images from multiple sources for accessories
 * Tries S3, media.wheelpros.com, and assets.wheelpros.com
 */

import pg from 'pg';
import { readFileSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Image URL templates to try
const URL_TEMPLATES = [
  sku => `https://wp-media-assets.s3-us-west-2.amazonaws.com/Accessories/${sku}.png`,
  sku => `https://wp-media-assets.s3-us-west-2.amazonaws.com/Accessories/${sku}.jpg`,
  // Clean SKU variations
  sku => `https://wp-media-assets.s3-us-west-2.amazonaws.com/Accessories/${sku.replace(/[^a-zA-Z0-9-]/g, '')}.png`,
];

// Check if URL returns 200
async function checkUrl(url) {
  try {
    const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch {
    return false;
  }
}

// Find working image URL for a SKU
async function findImage(sku) {
  for (const template of URL_TEMPLATES) {
    const url = template(sku);
    if (await checkUrl(url)) {
      return url;
    }
  }
  return null;
}

async function main() {
  const brands = ['Gorilla Automotive', 'Fox Shocks', 'Bilstein', 'Teraflex', 'GTR Lighting'];
  
  for (const brand of brands) {
    console.log(`\n=== Processing ${brand} ===`);
    
    // Get products without images
    const result = await pool.query(`
      SELECT sku FROM accessories 
      WHERE brand = $1 AND image_url IS NULL
      ORDER BY sku
      LIMIT 100
    `, [brand]);
    
    console.log(`Found ${result.rows.length} products without images`);
    
    let found = 0;
    let checked = 0;
    
    for (const row of result.rows) {
      const imageUrl = await findImage(row.sku);
      checked++;
      
      if (imageUrl) {
        await pool.query('UPDATE accessories SET image_url = $1 WHERE sku = $2', [imageUrl, row.sku]);
        found++;
        console.log(`✅ ${row.sku}`);
      }
      
      // Progress every 20
      if (checked % 20 === 0) {
        console.log(`Progress: ${checked}/${result.rows.length}, found: ${found}`);
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 50));
    }
    
    console.log(`${brand}: Found ${found}/${checked} images`);
  }
  
  await pool.end();
}

main().catch(console.error);
