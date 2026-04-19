import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  UPDATE accessories 
  SET in_stock = false, updated_at = NOW() 
  WHERE brand = 'Schrader'
  RETURNING sku
`);

console.log(`Hidden ${result.rowCount} Schrader products`);

await pool.end();
