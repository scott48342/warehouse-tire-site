import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool);

async function main() {
  // What Chrysler models are in catalog?
  const catalog = await db.execute(sql`
    SELECT name, years FROM catalog_models WHERE make_slug = 'chrysler' ORDER BY name
  `);
  console.log('Chrysler in CATALOG:');
  catalog.rows.forEach((r: any) => console.log('  ', r.name));

  // What Chrysler models are in fitment DB for 2005?
  const fitment = await db.execute(sql`
    SELECT DISTINCT model FROM vehicle_fitments WHERE make = 'chrysler' AND year = 2005 ORDER BY model
  `);
  console.log('\nChrysler 2005 in FITMENT DB:');
  fitment.rows.forEach((r: any) => console.log('  ', r.model));

  // Check if Pacifica and Sebring exist anywhere
  const pacifica = await db.execute(sql`
    SELECT year, make, model FROM vehicle_fitments 
    WHERE model ILIKE '%pacifica%' OR model ILIKE '%sebring%'
    ORDER BY year LIMIT 10
  `);
  console.log('\nPacifica/Sebring anywhere in DB:');
  pacifica.rows.forEach((r: any) => console.log('  ', r.year, r.make, r.model));

  await pool.end();
}
main();
