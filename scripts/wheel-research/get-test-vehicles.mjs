import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// First check what makes we have and their case
const { rows: makes } = await client.query(`
  SELECT DISTINCT make, COUNT(*) as cnt
  FROM vehicle_fitments
  WHERE quality_tier != 'complete' AND year >= 2015
  GROUP BY make
  ORDER BY cnt DESC
  LIMIT 10
`);
console.log('Top makes with incomplete data:');
console.log(makes);

// Now get vehicles with correct case
const { rows } = await client.query(`
  SELECT DISTINCT year, make, model
  FROM vehicle_fitments
  WHERE quality_tier != 'complete'
    AND year >= 2015
  ORDER BY make, model, year DESC
  LIMIT 20
`);

console.log('\nTest vehicles:');
console.log(JSON.stringify(rows, null, 2));
await client.end();
