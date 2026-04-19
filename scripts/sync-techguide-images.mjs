/**
 * Sync image URLs from TechGuide CSV to database
 * Targets: Morimoto, Gorilla, GTR, Teraflex, Fox, Bilstein
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

async function main() {
  // Read TechGuide CSV and build SKU -> image_url map
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
  
  // Target brands
  const targetBrands = [
    'Morimoto Offroad',
    'Morimoto',
    'Morimoto - Non XB',
    'Gorilla Automotive',
    'GTR Lighting',
    'Teraflex',
    'Teraflex Axles & Shafts',
    'Fox Shocks',
    'Bilstein'
  ];
  
  let totalUpdated = 0;
  
  for (const brand of targetBrands) {
    // Get SKUs without images for this brand
    const result = await pool.query(`
      SELECT sku FROM accessories 
      WHERE brand = $1 AND image_url IS NULL
    `, [brand]);
    
    if (result.rows.length === 0) {
      console.log(`${brand}: No products need images`);
      continue;
    }
    
    console.log(`${brand}: ${result.rows.length} products need images`);
    
    let updated = 0;
    for (const row of result.rows) {
      const imageUrl = skuToImage.get(row.sku);
      if (imageUrl) {
        await pool.query(
          `UPDATE accessories SET image_url = $1 WHERE sku = $2`,
          [imageUrl, row.sku]
        );
        updated++;
      }
    }
    
    console.log(`  -> Updated ${updated} products\n`);
    totalUpdated += updated;
  }
  
  console.log(`=== Total updated: ${totalUpdated} ===`);
  
  // Final stats
  const stats = await pool.query(`
    SELECT brand, 
           COUNT(*) FILTER (WHERE image_url IS NULL) as needs_image,
           COUNT(*) as total
    FROM accessories
    WHERE brand IN (${targetBrands.map((_, i) => `$${i+1}`).join(',')})
    GROUP BY brand
    ORDER BY needs_image DESC
  `, targetBrands);
  
  console.log('\n=== Remaining by Brand ===');
  for (const row of stats.rows) {
    console.log(`${row.brand}: ${row.needs_image}/${row.total} still need images`);
  }
  
  await pool.end();
}

main().catch(console.error);
