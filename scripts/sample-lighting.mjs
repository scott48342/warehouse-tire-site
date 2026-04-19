import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const result = await pool.query(`
  SELECT sku, title, description, image_url 
  FROM accessories 
  WHERE category='lighting' AND description IS NOT NULL 
  LIMIT 2
`);

for (const row of result.rows) {
  console.log('='.repeat(60));
  console.log('SKU:', row.sku);
  console.log('Title:', row.title);
  console.log('Image:', row.image_url);
  console.log('Description:');
  console.log(row.description?.substring(0, 500) + (row.description?.length > 500 ? '...' : ''));
}

await pool.end();
