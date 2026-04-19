import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const result = await pool.query(`
  SELECT sku, image_url, product_desc 
  FROM suspension_fitments 
  WHERE image_url IS NOT NULL AND image_url != ''
  LIMIT 10
`);

console.log('Suspension records with images:', result.rows.length);
for (const row of result.rows) {
  console.log('\nSKU:', row.sku);
  console.log('Image:', row.image_url);
  console.log('Desc:', row.product_desc?.substring(0, 60));
}

await pool.end();
