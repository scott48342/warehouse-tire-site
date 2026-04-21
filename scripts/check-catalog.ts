/**
 * Check what's in our catalog tables
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const db = drizzle(pool);

async function main() {
  // Check catalog_makes
  const makes = await db.execute(sql`SELECT COUNT(*) as cnt FROM catalog_makes`);
  console.log('catalog_makes:', makes.rows[0]);
  
  // Check catalog_models  
  const models = await db.execute(sql`SELECT COUNT(*) as cnt FROM catalog_models`);
  console.log('catalog_models:', models.rows[0]);
  
  // Sample of models with years
  const sample = await db.execute(sql`
    SELECT make_slug, slug, name, years 
    FROM catalog_models 
    ORDER BY make_slug, name 
    LIMIT 10
  `);
  console.log('\nSample catalog_models:');
  sample.rows.forEach((r: any) => console.log(`  ${r.make_slug}/${r.name}: years=${JSON.stringify(r.years)?.slice(0,50)}...`));
  
  await pool.end();
}

main().catch(console.error);
