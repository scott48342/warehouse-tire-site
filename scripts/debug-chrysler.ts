import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { normalizeMake, normalizeModel, modelToDisplayName } from '../src/lib/fitment-db/keys';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool);

async function main() {
  // How does normalizeMake work?
  console.log('Normalized "Chrysler":', normalizeMake('Chrysler'));
  console.log('Normalized "chrysler":', normalizeMake('chrysler'));
  
  // What models exist for chrysler 2005?
  const models = await db.execute(sql`
    SELECT DISTINCT model FROM vehicle_fitments 
    WHERE make = 'chrysler' AND year = 2005 
    ORDER BY model
  `);
  
  console.log('\nModels in fitment DB for chrysler 2005:');
  models.rows.forEach((r: any) => {
    const display = modelToDisplayName(r.model);
    console.log(`  ${r.model} -> "${display}"`);
  });
  
  // Check what the getModelsWithCoverage would return
  const normalizedMake = normalizeMake('Chrysler');
  const coverageModels = await db.execute(sql`
    SELECT DISTINCT model FROM vehicle_fitments 
    WHERE make = ${normalizedMake} AND year = 2005 
    ORDER BY model
  `);
  
  console.log('\ngetModelsWithCoverage would return:');
  coverageModels.rows.forEach((r: any) => console.log(' ', r.model));
  
  // Check total count for chrysler
  const count = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'chrysler'
  `);
  console.log('\nTotal chrysler records:', (count.rows[0] as any).cnt);
  
  await pool.end();
}
main();
