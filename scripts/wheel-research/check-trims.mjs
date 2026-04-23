import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Check if we have trim data
const { rows } = await client.query(`
  SELECT year, make, model, trim, COUNT(*) as cnt
  FROM vehicle_fitments 
  WHERE LOWER(model) LIKE '%mustang%' 
    AND year >= 2020
  GROUP BY year, make, model, trim
  ORDER BY year DESC, trim
  LIMIT 20
`);

console.log('Mustang trim-level data in DB:');
console.table(rows);

await client.end();
