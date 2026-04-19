/**
 * Update Schrader TPMS images from catalogue.schradertpms.com
 * 
 * Image URLs use pattern: https://cdn.schradertpms.com//Products/NA/{uuid}.jpg
 * Each product has a unique UUID that must be looked up from the catalog.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Mapping of Schrader part numbers to their image UUIDs (from catalog lookup)
// Format: SKU (with SEZ- prefix) -> part number -> image UUID
const SCHRADER_IMAGES = {
  // Found via browser automation
  'SEZ-20018': 'https://cdn.schradertpms.com//Products/NA/211ccd2f-4d49-4f59-9f8b-22d68e19d63c.jpg',
  
  // Additional mappings can be added as discovered
  // 'SEZ-20798': 'https://cdn.schradertpms.com//Products/NA/xxxxx.jpg',
  // 'SEZ-21057': 'https://cdn.schradertpms.com//Products/NA/xxxxx.jpg',
};

async function run() {
  console.log('=== Updating Schrader TPMS images ===\n');
  
  let updated = 0;
  
  for (const [sku, imageUrl] of Object.entries(SCHRADER_IMAGES)) {
    const result = await pool.query(
      'UPDATE accessories SET image_url = $1, updated_at = NOW() WHERE sku = $2 RETURNING sku',
      [imageUrl, sku]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ ${sku}`);
      updated++;
    } else {
      console.log(`⚠️ ${sku} not found in DB`);
    }
  }
  
  console.log(`\nUpdated ${updated} Schrader products with images`);
  
  // Show remaining without images
  const remaining = await pool.query(`
    SELECT sku, title 
    FROM accessories 
    WHERE brand = 'Schrader' AND in_stock = true AND image_url IS NULL
    ORDER BY sku
  `);
  
  if (remaining.rows.length > 0) {
    console.log(`\n${remaining.rows.length} Schrader products still need images:`);
    for (const row of remaining.rows) {
      // Extract part number for catalog lookup
      const part = row.sku.replace('SEZ-', '').replace('SEZ', '');
      console.log(`  ${row.sku} (search: ${part}) - ${row.title}`);
    }
  }
  
  await pool.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
