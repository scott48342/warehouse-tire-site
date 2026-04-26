/**
 * Find and attempt to fix records with missing tire data
 * by cross-referencing from other records of same year/make/model
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('\n🔍 Checking missing tire data...\n');
  
  // Count missing tires
  const missingCount = await pool.query(`
    SELECT COUNT(*) as c FROM vehicle_fitments 
    WHERE year >= 2000 
    AND oem_wheel_sizes IS NOT NULL 
    AND oem_wheel_sizes::text != '[]'
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
  `);
  console.log(`Records with wheels but no tires: ${missingCount.rows[0].c}`);
  
  // Check if tires are stored as objects instead of strings
  const objectTires = await pool.query(`
    SELECT COUNT(*) as c FROM vehicle_fitments 
    WHERE year >= 2000 
    AND oem_tire_sizes IS NOT NULL 
    AND oem_tire_sizes::text LIKE '%"size":%'
  `);
  console.log(`Records with tire objects (need extraction): ${objectTires.rows[0].c}`);
  
  // Sample missing
  console.log('\nSample records missing tires:');
  const sample = await pool.query(`
    SELECT year, make, model, submodel, 
           oem_wheel_sizes::text as wheels,
           oem_tire_sizes::text as tires
    FROM vehicle_fitments 
    WHERE year >= 2000 
    AND oem_wheel_sizes IS NOT NULL 
    AND oem_wheel_sizes::text != '[]'
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    LIMIT 10
  `);
  
  for (const r of sample.rows) {
    console.log(`  ${r.year} ${r.make} ${r.model} [${r.submodel}]`);
    console.log(`    Wheels: ${r.wheels.substring(0, 60)}...`);
    console.log(`    Tires: ${r.tires}`);
  }
  
  // Check for tires embedded in wheel objects
  console.log('\n\nChecking for tires embedded in wheel data...');
  const embeddedTires = await pool.query(`
    SELECT id, oem_wheel_sizes::text as wheels, oem_tire_sizes::text as tires
    FROM vehicle_fitments 
    WHERE year >= 2000 
    AND oem_wheel_sizes::text LIKE '%tireSize%'
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    LIMIT 5
  `);
  
  console.log(`Records with tires embedded in wheel data: ${embeddedTires.rowCount}`);
  for (const r of embeddedTires.rows) {
    console.log(`  ${r.wheels.substring(0, 100)}...`);
  }
  
  await pool.end();
}

main().catch(console.error);
