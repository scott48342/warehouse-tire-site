import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check image coverage
  const stats = await pool.query(`
    SELECT 
      category,
      COUNT(*) as total,
      COUNT(image_url) as with_images,
      COUNT(msrp) as with_msrp,
      COUNT(sell_price) as with_price
    FROM accessories 
    GROUP BY category
    ORDER BY total DESC
  `);
  
  console.log('=== IMAGE & PRICE COVERAGE ===');
  for (const row of stats.rows) {
    const imgPct = Math.round((row.with_images / row.total) * 100);
    const pricePct = Math.round((row.with_price / row.total) * 100);
    console.log(`${row.category}: ${row.with_images}/${row.total} images (${imgPct}%), ${row.with_price}/${row.total} prices (${pricePct}%)`);
  }
  
  // Sample some WITH images
  const withImages = await pool.query(`
    SELECT sku, title, category, image_url, sell_price, brand
    FROM accessories 
    WHERE image_url IS NOT NULL AND image_url != ''
    LIMIT 5
  `);
  
  console.log('\n=== SAMPLES WITH IMAGES ===');
  for (const row of withImages.rows) {
    console.log(`${row.category} | ${row.sku}: $${row.sell_price || 'N/A'}`);
    console.log(`  ${row.title}`);
    console.log(`  ${row.image_url}`);
  }
  
  // Sample some WITHOUT images
  const withoutImages = await pool.query(`
    SELECT sku, title, category, brand, brand_code
    FROM accessories 
    WHERE image_url IS NULL OR image_url = ''
    LIMIT 5
  `);
  
  console.log('\n=== SAMPLES WITHOUT IMAGES ===');
  for (const row of withoutImages.rows) {
    console.log(`${row.category} | ${row.sku}: ${row.title} (${row.brand || row.brand_code})`);
  }
  
  await pool.end();
}

check().catch(e => console.error(e));
