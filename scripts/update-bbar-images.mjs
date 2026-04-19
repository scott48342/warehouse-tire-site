import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Use a representative Morimoto 2Banger Bar image for all BBAR products
// This is from the Morimoto website
const BBAR_IMAGE = 'https://www.morimotohid.com/images/Item%20Images/103406.010.jpg';

// Update all BBAR products with this image
const result = await pool.query(`
  UPDATE accessories 
  SET image_url = $1, updated_at = NOW()
  WHERE (sku LIKE '%BBAR%' OR sub_type = 'light_bar' OR sub_type = 'light bar')
    AND image_url IS NULL
  RETURNING sku, title
`, [BBAR_IMAGE]);

console.log(`Updated ${result.rowCount} light bar products with image`);
result.rows.forEach(r => console.log(`  ${r.sku}: ${r.title}`));

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
