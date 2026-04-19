/**
 * Sync image URLs from TechGuide CSV to database - FAST batch version
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

async function main() {
  console.log('Reading TechGuide CSV...');
  const csv = readFileSync('data/Accessory_TechGuide.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  const skuToImage = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    const sku = parts[0];
    const imageUrl = parts[8];
    
    if (sku && imageUrl && imageUrl.startsWith('http')) {
      skuToImage.set(sku, imageUrl);
    }
  }
  
  console.log(`Loaded ${skuToImage.size} SKU -> image mappings\n`);
  
  // Get all accessories without images
  console.log('Getting accessories without images...');
  const result = await pool.query(`
    SELECT sku, brand FROM accessories WHERE image_url IS NULL
  `);
  
  console.log(`Found ${result.rows.length} accessories without images\n`);
  
  // Build updates array
  const updates = [];
  const brandCounts = {};
  
  for (const row of result.rows) {
    const imageUrl = skuToImage.get(row.sku);
    if (imageUrl) {
      updates.push({ sku: row.sku, imageUrl, brand: row.brand });
      brandCounts[row.brand] = (brandCounts[row.brand] || 0) + 1;
    }
  }
  
  console.log(`Found ${updates.length} images to update\n`);
  console.log('By brand:');
  for (const [brand, count] of Object.entries(brandCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${brand}: ${count}`);
  }
  
  // Batch update using a transaction with VALUES
  if (updates.length > 0) {
    console.log('\nApplying updates in batches...');
    const BATCH_SIZE = 500;
    let totalUpdated = 0;
    
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      // Build VALUES clause
      const values = batch.map((u, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
      const params = batch.flatMap(u => [u.sku, u.imageUrl]);
      
      // Use UPDATE FROM for batch update
      const sql = `
        UPDATE accessories AS a
        SET image_url = v.image_url
        FROM (VALUES ${values}) AS v(sku, image_url)
        WHERE a.sku = v.sku
      `;
      
      const updateResult = await pool.query(sql, params);
      totalUpdated += updateResult.rowCount;
      
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: Updated ${updateResult.rowCount} rows`);
    }
    
    console.log(`\nTotal updated: ${totalUpdated}`);
  }
  
  // Final stats
  console.log('\n=== Final Stats ===');
  const stats = await pool.query(`
    SELECT brand, 
           COUNT(*) FILTER (WHERE image_url IS NULL) as needs_image,
           COUNT(*) FILTER (WHERE image_url IS NOT NULL) as has_image,
           COUNT(*) as total
    FROM accessories
    WHERE brand IN ('Morimoto Offroad', 'Morimoto', 'Morimoto - Non XB', 'Gorilla Automotive', 
                    'GTR Lighting', 'Teraflex', 'Teraflex Axles & Shafts', 'Fox Shocks', 'Bilstein')
    GROUP BY brand
    ORDER BY needs_image DESC
  `);
  
  for (const row of stats.rows) {
    console.log(`${row.brand}: ${row.has_image}/${row.total} have images (${row.needs_image} remaining)`);
  }
  
  await pool.end();
}

main().catch(console.error);
