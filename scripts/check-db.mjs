import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Get schema
  const schema = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'accessories' 
    ORDER BY ordinal_position
  `);
  console.log('=== ACCESSORIES TABLE SCHEMA ===');
  schema.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // Get stats
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(image_url) as with_image,
      COUNT(NULLIF(image_url, '')) as with_image_nonempty,
      COUNT(brand) as with_brand,
      COUNT(category) as with_category
    FROM accessories
  `);
  console.log('\n=== STATS ===');
  console.log(stats.rows[0]);

  // Category breakdown
  const cats = await pool.query(`
    SELECT category, COUNT(*) as count 
    FROM accessories 
    GROUP BY category 
    ORDER BY count DESC
  `);
  console.log('\n=== CATEGORIES ===');
  cats.rows.forEach(r => console.log(`  ${r.category}: ${r.count}`));

  // Sample of items with images vs without
  const sample = await pool.query(`
    SELECT sku, title, category, 
           CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 'YES' ELSE 'NO' END as has_image
    FROM accessories 
    ORDER BY sku 
    LIMIT 10
  `);
  console.log('\n=== SAMPLE (first 10) ===');
  sample.rows.forEach(r => console.log(`  ${r.sku}: ${r.has_image} | ${r.category} | ${r.title?.substring(0,40)}`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
