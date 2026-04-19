import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const result = await pool.query(`
  SELECT sku, title, sub_type, image_url 
  FROM accessories 
  WHERE sub_type = 'light bar' 
     OR sub_type = 'light_bar'
     OR title ILIKE '%light bar%' 
     OR sku LIKE '%BBAR%' 
  LIMIT 20
`);

console.log('Light bar products:');
console.table(result.rows);

await pool.end();
