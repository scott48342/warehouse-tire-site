import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check Chevy 'high' tier models
  const chevyHigh = await pool.query(`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND quality_tier = 'high'
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  console.log('=== CHEVROLET "HIGH" TIER MODELS (need upgrade to complete) ===');
  console.log('Total models:', chevyHigh.rows.length);
  console.log('Total records:', chevyHigh.rows.reduce((s: number, r: any) => s + parseInt(r.cnt), 0));
  chevyHigh.rows.forEach((r: any) => console.log(r.model + ': ' + r.cnt));
  
  // Check GMC 'high' tier models
  const gmcHigh = await pool.query(`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'gmc' AND quality_tier = 'high'
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  console.log('\n=== GMC "HIGH" TIER MODELS (need upgrade to complete) ===');
  console.log('Total models:', gmcHigh.rows.length);
  console.log('Total records:', gmcHigh.rows.reduce((s: number, r: any) => s + parseInt(r.cnt), 0));
  gmcHigh.rows.forEach((r: any) => console.log(r.model + ': ' + r.cnt));
  
  // Sample a "high" tier Chevy record
  const sample = await pool.query(`
    SELECT id, year, model, display_trim, quality_tier, source, oem_wheel_sizes, oem_tire_sizes, bolt_pattern
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND quality_tier = 'high'
    LIMIT 5
  `);
  console.log('\n=== SAMPLE "HIGH" TIER CHEVY RECORDS ===');
  sample.rows.forEach((r: any) => {
    console.log(`${r.year} ${r.model} ${r.display_trim}: source=${r.source}, bolt=${r.bolt_pattern}`);
    console.log(`  wheels: ${JSON.stringify(r.oem_wheel_sizes)?.slice(0,100)}`);
    console.log(`  tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  });
  
  // Also check unknown/partial
  const other = await pool.query(`
    SELECT make, model, quality_tier, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE (LOWER(make) = 'chevrolet' OR LOWER(make) = 'gmc') AND quality_tier IN ('unknown', 'partial')
    GROUP BY make, model, quality_tier
    ORDER BY make, model
  `);
  console.log('\n=== OTHER TIERS (unknown/partial) ===');
  other.rows.forEach((r: any) => console.log(`${r.make} ${r.model}: ${r.quality_tier} (${r.cnt})`));
  
  await pool.end();
}
main().catch(console.error);
