import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Parse Lighting_TechGuide for light bar images
const csv = fs.readFileSync('./data/Lighting_TechGuide.csv', 'utf8');
const lines = csv.split('\n');
const header = lines[0].split(',');

const skuIdx = header.indexOf('SKU');
const imgIdx = header.indexOf('ImageLink1');

console.log('Columns: SKU at', skuIdx, ', ImageLink1 at', imgIdx);

const lightBarImages = new Map();
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('BBAR') || line.toLowerCase().includes('light bar')) {
    const cols = line.split(',');
    const sku = cols[skuIdx];
    const img = cols[imgIdx];
    if (sku && img && img.startsWith('http')) {
      lightBarImages.set(sku, img);
      console.log(`  ${sku}: ${img.substring(0, 60)}...`);
    }
  }
}

console.log(`\nFound ${lightBarImages.size} light bar SKUs with images in Lighting_TechGuide`);

// Update category and sub_type for BBAR products
const updateResult = await pool.query(`
  UPDATE accessories 
  SET category = 'lighting', sub_type = 'light_bar', updated_at = NOW()
  WHERE sku LIKE '%BBAR%'
  RETURNING sku
`);
console.log(`\nUpdated ${updateResult.rowCount} BBAR products to category=lighting, sub_type=light_bar`);

// Update images for products where we have them
let updated = 0;
for (const [sku, img] of lightBarImages) {
  const res = await pool.query(`
    UPDATE accessories 
    SET image_url = $1, updated_at = NOW()
    WHERE sku = $2 AND image_url IS NULL
    RETURNING sku
  `, [img, sku]);
  if (res.rowCount > 0) {
    updated++;
  }
}
console.log(`Updated images for ${updated} products`);

// Show final stats
const stats = await pool.query(`
  SELECT sub_type, COUNT(*) as total, 
         COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images
  FROM accessories 
  WHERE category = 'lighting'
  GROUP BY sub_type
  ORDER BY total DESC
`);

console.log('\nLighting sub_type stats:');
console.table(stats.rows);

await pool.end();
