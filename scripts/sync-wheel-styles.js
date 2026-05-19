const { Pool } = require('pg');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Loading techfeed...');
  const filePath = path.join(process.cwd(), 'src/techfeed/wheels_by_sku.json.gz');
  const buf = fs.readFileSync(filePath);
  const data = JSON.parse(zlib.gunzipSync(buf).toString());
  
  // Extract unique styles
  const styles = new Map();
  for (const wheel of Object.values(data.bySku)) {
    const styleKey = wheel.style;
    if (!styleKey || styles.has(styleKey)) continue;
    
    styles.set(styleKey, {
      styleKey,
      brandCode: wheel.brand_cd || '',
      brand: wheel.brand_desc || '',
      model: wheel.product_desc || styleKey,
      imageUrl: wheel.images?.[0] || '',
    });
  }
  
  console.log(`Found ${styles.size} unique wheel styles`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const style of styles.values()) {
    try {
      // Check if exists
      const existing = await pool.query(
        'SELECT style_key FROM wheel_style_assets WHERE style_key = $1',
        [style.styleKey]
      );
      
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO wheel_style_assets 
           (style_key, brand_code, brand, model, image_url, visualizer_status)
           VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [style.styleKey, style.brandCode, style.brand, style.model, style.imageUrl]
        );
        inserted++;
        if (inserted % 100 === 0) {
          console.log(`Inserted ${inserted} styles...`);
        }
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`Error for ${style.styleKey}:`, err.message);
    }
  }
  
  console.log(`\n✅ Sync complete!`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped (existing): ${skipped}`);
  
  // Get final count
  const countRes = await pool.query('SELECT COUNT(*) FROM wheel_style_assets');
  console.log(`   Total in DB: ${countRes.rows[0].count}`);
  
  await pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
});
