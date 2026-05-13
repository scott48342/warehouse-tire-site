#!/usr/bin/env node
/**
 * Analyze LOW and NEEDS_REVIEW vehicles from wheel confidence audit
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const LOW_VEHICLES = [
  { year: 2018, make: 'Ferrari', model: '812 Superfast' },
  { year: 2018, make: 'Ferrari', model: 'GTC4Lusso' },
  { year: 2018, make: 'Ferrari', model: 'GTC4Lusso T' },
  { year: 2018, make: 'Ford', model: 'GT' },
  { year: 2018, make: 'Lamborghini', model: 'Aventador' },
  { year: 2018, make: 'Mercedes-Benz', model: 'Sprinter 3500' },
];

const NEEDS_REVIEW_VEHICLES = [
  { year: 2018, make: 'BMW', model: '740e xDrive' },
  { year: 2018, make: 'BMW', model: '740i' },
  { year: 2018, make: 'BMW', model: '750i' },
  { year: 2018, make: 'BMW', model: 'Alpina B7' },
  { year: 2018, make: 'BMW', model: 'M5' },
  { year: 2018, make: 'BMW', model: 'M550i xDrive' },
  { year: 2018, make: 'GMC', model: 'Sierra 3500 HD' },
  { year: 2018, make: 'Mercedes-Benz', model: 'Sprinter 3500XD' },
  { year: 2018, make: 'Rolls-Royce', model: 'Phantom' },
  { year: 2019, make: 'Ford', model: 'F-450' },
  { year: 2024, make: 'Chevrolet', model: 'Equinox EV' },
];

async function queryVehicle(year, make, model) {
  const result = await pool.query(
    `SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, 
            offset_min_mm, offset_max_mm, oem_tire_sizes, oem_wheel_sizes, 
            source, created_at, updated_at 
     FROM vehicle_fitments 
     WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3 
     LIMIT 5`,
    [year, `%${make}%`, `%${model}%`]
  );
  return result.rows;
}

async function main() {
  console.log("=".repeat(70));
  console.log("LOW CONFIDENCE VEHICLES (6)");
  console.log("=".repeat(70));

  for (const v of LOW_VEHICLES) {
    console.log(`\n>>> ${v.year} ${v.make} ${v.model}`);
    const rows = await queryVehicle(v.year, v.make, v.model);
    
    if (rows.length === 0) {
      console.log("  STATUS: NOT FOUND IN DB");
      continue;
    }
    
    for (const r of rows) {
      console.log(`  Trim: ${r.display_trim}`);
      console.log(`  Bolt: ${r.bolt_pattern || 'NULL'}`);
      console.log(`  Center Bore: ${r.center_bore_mm || 'NULL'}mm`);
      console.log(`  Offset: ${r.offset_min_mm ?? 'NULL'} to ${r.offset_max_mm ?? 'NULL'}mm`);
      console.log(`  Tire Sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
      console.log(`  Wheel Sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
      console.log(`  Source: ${r.source}`);
      console.log(`  Created: ${r.created_at}`);
      console.log("");
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("NEEDS_REVIEW VEHICLES (sample)");
  console.log("=".repeat(70));

  for (const v of NEEDS_REVIEW_VEHICLES) {
    console.log(`\n>>> ${v.year} ${v.make} ${v.model}`);
    const rows = await queryVehicle(v.year, v.make, v.model);
    
    if (rows.length === 0) {
      console.log("  STATUS: NOT FOUND IN DB");
      continue;
    }
    
    // Just show first match
    const r = rows[0];
    console.log(`  Trim: ${r.display_trim}`);
    console.log(`  Bolt: ${r.bolt_pattern || 'NULL'}`);
    console.log(`  Center Bore: ${r.center_bore_mm || 'NULL'}mm`);
    console.log(`  Offset: ${r.offset_min_mm ?? 'NULL'} to ${r.offset_max_mm ?? 'NULL'}mm`);
    console.log(`  Tire Sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`  Source: ${r.source}`);
  }

  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
