import pg from 'pg';
import { config } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('=== WHEEL PDP SITEMAP AUDIT ===\n');
    
    // Check TechFeed JSON file (actual wheel data source)
    console.log('--- TechFeed JSON File ---');
    try {
      const gzPath = path.join(process.cwd(), 'src/techfeed/wheels_by_sku.json.gz');
      const buf = await fs.readFile(gzPath);
      const json = zlib.gunzipSync(buf).toString('utf8');
      const data = JSON.parse(json);
      const allSkus = Object.keys(data.bySku || {});
      const withImages = allSkus.filter(sku => {
        const w = data.bySku[sku];
        return w.images && Array.isArray(w.images) && w.images.length > 0;
      });
      const withoutImages = allSkus.filter(sku => {
        const w = data.bySku[sku];
        return !w.images || !Array.isArray(w.images) || w.images.length === 0;
      });
      
      console.log('Total wheel SKUs in TechFeed:', allSkus.length);
      console.log('With images:', withImages.length);
      console.log('Without images:', withoutImages.length);
      console.log('');
      
      // Sample without images
      console.log('Sample wheels WITHOUT images:');
      withoutImages.slice(0, 5).forEach(sku => {
        const w = data.bySku[sku];
        console.log('  -', sku, '|', w.brand_desc || w.brand_cd, '|', (w.product_desc || '').slice(0, 40));
      });
      console.log('');
      
      // Sitemap impact
      console.log('--- SITEMAP IMPACT ---');
      console.log('Sitemap includes (LIMIT 10000):', Math.min(withImages.length, 10000));
      console.log('Excluded by LIMIT 10000:', Math.max(0, withImages.length - 10000));
      console.log('Excluded by no image:', withoutImages.length);
      console.log('Total excluded:', withoutImages.length + Math.max(0, withImages.length - 10000));
      
    } catch (e) {
      console.log('TechFeed file error:', e.message);
    }
    
    console.log('');
    
    // Check wp_inventory for actual stock
    console.log('--- Database: wp_inventory (wheels) ---');
    const wpInv = await client.query(`
      SELECT COUNT(DISTINCT sku) as cnt 
      FROM wp_inventory 
      WHERE product_type = 'wheel' AND qoh > 0
    `);
    console.log('Wheels in stock (wp_inventory):', wpInv.rows[0].cnt);
    
    // Check wp_wheels table
    console.log('');
    console.log('--- Database: wp_wheels ---');
    const wpWheels = await client.query(`SELECT COUNT(*) as cnt FROM wp_wheels`);
    console.log('Total rows in wp_wheels:', wpWheels.rows[0].cnt);
    
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
