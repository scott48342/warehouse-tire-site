/**
 * Investigate QA issues
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('\n🔍 INVESTIGATING QA ISSUES\n');
  
  // 1. Check tire/wheel mismatches
  console.log('=== TIRE/WHEEL MISMATCHES ===\n');
  const mismatches = await pool.query(`
    SELECT year, make, model, submodel,
           oem_wheel_sizes::text as wheels,
           oem_tire_sizes::text as tires
    FROM vehicle_fitments
    WHERE year >= 2000
    LIMIT 10
  `);
  
  for (const r of mismatches.rows) {
    console.log(`${r.year} ${r.make} ${r.model} [${r.submodel}]`);
    console.log(`  Wheels: ${r.wheels.substring(0, 100)}`);
    console.log(`  Tires: ${r.tires.substring(0, 100)}`);
    console.log('');
  }
  
  // 2. Check records with object in tire data
  console.log('\n=== TIRE DATA FORMAT CHECK ===\n');
  const badTires = await pool.query(`
    SELECT year, make, model, submodel, oem_tire_sizes::text as tires
    FROM vehicle_fitments
    WHERE year >= 2000 
      AND oem_tire_sizes::text LIKE '%object%'
    LIMIT 5
  `);
  console.log(`Records with 'object' in tire data: ${badTires.rowCount}`);
  
  // 3. Mazda CX-30 example - check if all trims have same wheels
  console.log('\n=== MAZDA SAME-SIZE CHECK ===\n');
  const mazdaCheck = await pool.query(`
    SELECT submodel, oem_wheel_sizes::text as wheels, oem_tire_sizes::text as tires
    FROM vehicle_fitments
    WHERE year = 2024 AND make = 'Mazda' AND LOWER(model) LIKE '%cx-30%'
    ORDER BY submodel
    LIMIT 20
  `);
  
  console.log('2024 Mazda CX-30 trims:');
  for (const r of mazdaCheck.rows) {
    const wheels = JSON.parse(r.wheels || '[]');
    const tires = JSON.parse(r.tires || '[]');
    console.log(`  ${r.submodel}: ${wheels[0]?.diameter || 'N/A'}" | ${tires[0] || 'N/A'}`);
  }
  
  // 4. Count actual tire/wheel mismatches
  console.log('\n=== COUNTING MISMATCHES ===\n');
  const mismatchCount = await pool.query(`
    SELECT COUNT(*) as count
    FROM vehicle_fitments
    WHERE year >= 2000
      AND oem_wheel_sizes IS NOT NULL
      AND oem_tire_sizes IS NOT NULL
      AND oem_wheel_sizes::text != '[]'
      AND oem_tire_sizes::text != '[]'
  `);
  console.log(`Total records with both wheel and tire data: ${mismatchCount.rows[0].count}`);
  
  // 5. Check how tires are stored
  console.log('\n=== TIRE DATA STRUCTURE ===\n');
  const tireStructure = await pool.query(`
    SELECT oem_tire_sizes
    FROM vehicle_fitments
    WHERE year >= 2000 AND oem_tire_sizes IS NOT NULL
    LIMIT 5
  `);
  
  for (const r of tireStructure.rows) {
    console.log(`Raw: ${JSON.stringify(r.oem_tire_sizes)}`);
  }
  
  await pool.end();
}

main().catch(console.error);
