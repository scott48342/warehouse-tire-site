import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function check() {
  // All Chrysler models in DB
  const models = await db.execute(sql`
    SELECT DISTINCT model, COUNT(*) as count, MIN(year) as min_year, MAX(year) as max_year
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chrysler'
    GROUP BY model
    ORDER BY model
  `);
  
  console.log('All Chrysler models in database:');
  for (const r of models.rows as any[]) {
    console.log(`  ${r.model}: ${r.count} records (${r.min_year}-${r.max_year})`);
  }
  
  // Specifically 2008
  const models2008 = await db.execute(sql`
    SELECT DISTINCT model, COUNT(*) as trims
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chrysler' AND year = 2008
    GROUP BY model
    ORDER BY model
  `);
  
  console.log('\nChrysler models for 2008 specifically:');
  if (models2008.rows.length === 0) {
    console.log('  (none found for 2008)');
  }
  for (const r of models2008.rows as any[]) {
    console.log(`  ${r.model}: ${r.trims} trims`);
  }

  // Check what years we have for common Chrysler models
  const commonModels = ['pacifica', 'town-country', 'town-and-country', 'sebring', 'pt-cruiser', 'aspen', 'crossfire'];
  console.log('\nYears available for common Chrysler models:');
  for (const model of commonModels) {
    const years = await db.execute(sql`
      SELECT DISTINCT year FROM vehicle_fitments 
      WHERE LOWER(make) = 'chrysler' AND LOWER(model) LIKE ${`%${model}%`}
      ORDER BY year
    `);
    if (years.rows.length > 0) {
      const yearList = (years.rows as any[]).map(r => r.year).join(', ');
      console.log(`  ${model}: ${yearList}`);
    }
  }
  
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
