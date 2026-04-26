import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check records that are "complete" but missing key data
  const missingWheels = await pool.query(`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND quality_tier = 'complete'
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes = 'null'::jsonb)
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  
  console.log('Complete records MISSING wheel sizes:');
  console.log('=====================================');
  let totalMissing = 0;
  for (const row of missingWheels.rows) {
    console.log(`  ${row.model}: ${row.cnt}`);
    totalMissing += parseInt(row.cnt);
  }
  console.log(`\nTotal missing: ${totalMissing} records`);
  
  // Check records missing tire sizes
  const missingTires = await pool.query(`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND quality_tier = 'complete'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  
  console.log('\n\nComplete records MISSING tire sizes:');
  console.log('=====================================');
  let totalMissingTires = 0;
  for (const row of missingTires.rows) {
    console.log(`  ${row.model}: ${row.cnt}`);
    totalMissingTires += parseInt(row.cnt);
  }
  console.log(`\nTotal missing: ${totalMissingTires} records`);
  
  // Sample of good data
  const goodSample = await pool.query(`
    SELECT year, model, display_trim, oem_wheel_sizes, oem_tire_sizes, bolt_pattern
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND quality_tier = 'complete'
      AND oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes != '[]'::jsonb
    ORDER BY model, year DESC
    LIMIT 10
  `);
  
  console.log('\n\nSample of complete records with data:');
  console.log('======================================');
  for (const row of goodSample.rows) {
    console.log(`  ${row.year} ${row.model} ${row.display_trim}`);
    console.log(`    Wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
    console.log(`    Tires: ${JSON.stringify(row.oem_tire_sizes)}`);
    console.log(`    Bolt: ${row.bolt_pattern}`);
  }
  
  await pool.end();
}

main().catch(console.error);
