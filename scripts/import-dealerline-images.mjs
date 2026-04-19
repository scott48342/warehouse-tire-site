/**
 * Import DealerLine Images into Database
 * 
 * Updates accessories with image URLs scraped from DealerLine portal.
 * 
 * Usage:
 *   node scripts/import-dealerline-images.mjs [json-file]
 * 
 * The JSON file should contain an array of: { sku, img }
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

async function main() {
  const jsonPath = process.argv[2] || './data/dealerline-images.json';
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    process.exit(1);
  }
  
  const images = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${images.length} image mappings from ${jsonPath}`);
  
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    let updated = 0;
    let notFound = 0;
    
    for (const { sku, img } of images) {
      if (!sku || !img) continue;
      
      const result = await pool.query(`
        UPDATE accessories 
        SET image_url = $1, updated_at = NOW()
        WHERE sku = $2 AND (image_url IS NULL OR image_url LIKE '%images.wheelpros.com%')
        RETURNING sku
      `, [img, sku]);
      
      if (result.rowCount > 0) {
        updated++;
      } else {
        // Check if SKU exists
        const check = await pool.query('SELECT sku FROM accessories WHERE sku = $1', [sku]);
        if (check.rowCount === 0) {
          notFound++;
        }
      }
    }
    
    console.log(`Updated: ${updated}, Not found: ${notFound}`);
    
    // Show category stats
    const stats = await pool.query(`
      SELECT category, COUNT(*) as total, 
             COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images
      FROM accessories 
      GROUP BY category 
      ORDER BY total DESC
    `);
    
    console.log('\nCategory image stats:');
    for (const row of stats.rows) {
      const pct = Math.round(100 * row.with_images / row.total);
      console.log(`  ${row.category}: ${row.with_images}/${row.total} (${pct}%)`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
