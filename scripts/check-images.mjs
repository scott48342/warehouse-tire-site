import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const result = await pool.query(`
  SELECT 
    category, 
    COUNT(*) as total, 
    COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_image,
    ROUND(COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1) as pct
  FROM accessories 
  GROUP BY category 
  ORDER BY total DESC
`);

console.log('\n=== IMAGE COVERAGE BY CATEGORY ===\n');
console.table(result.rows);

// Sample some URLs
const sample = await pool.query(`
  SELECT category, image_url 
  FROM accessories 
  WHERE image_url IS NOT NULL AND image_url != ''
  LIMIT 5
`);
console.log('\n=== SAMPLE IMAGE URLs ===\n');
sample.rows.forEach(r => console.log(`${r.category}: ${r.image_url}`));

await pool.end();
