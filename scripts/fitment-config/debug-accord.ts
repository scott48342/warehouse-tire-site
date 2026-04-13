import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function debug() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DEBUG: 2020 Honda Accord LX");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Check config table for 2020 Honda Accord LX
  console.log("1. CONFIG TABLE - vehicle_fitment_configurations:");
  const configs = await pool.query(`
    SELECT id, year, make_key, model_key, modification_id, display_trim, wheel_diameter, tire_size
    FROM vehicle_fitment_configurations
    WHERE make_key = 'honda' AND model_key = 'accord' AND year = 2020
    ORDER BY display_trim, wheel_diameter
  `);
  if (configs.rows.length === 0) {
    console.log("   ❌ NO CONFIG ROWS FOUND for 2020 Honda Accord");
  } else {
    console.log(`   Found ${configs.rows.length} config rows:`);
    configs.rows.forEach((r: any) => {
      console.log(`   - mod_id: ${r.modification_id || 'NULL'} | trim: ${r.display_trim} | ${r.wheel_diameter}" | ${r.tire_size}`);
    });
  }

  // 2. Check vehicle_fitments for LX entries
  console.log("\n2. VEHICLE_FITMENTS - entries for 2020 Accord LX:");
  const fitments = await pool.query(`
    SELECT modification_id, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make = 'honda' AND model = 'accord' AND year = 2020 AND LOWER(display_trim) = 'lx'
  `);
  if (fitments.rows.length === 0) {
    console.log("   ❌ NO FITMENT ROWS for 2020 Accord LX");
  } else {
    console.log(`   Found ${fitments.rows.length} fitment rows:`);
    fitments.rows.forEach((r: any) => {
      console.log(`   - mod_id: ${r.modification_id} | trim: ${r.display_trim}`);
      console.log(`     wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    });
  }

  // 3. Check what the URL modification_id resolves to
  const urlModId = "manual_5c8b7546d9f6";
  console.log(`\n3. URL MODIFICATION_ID LOOKUP: ${urlModId}`);
  const urlFitment = await pool.query(`
    SELECT modification_id, display_trim
    FROM vehicle_fitments
    WHERE make = 'honda' AND model = 'accord' AND year = 2020 AND modification_id = $1
  `, [urlModId]);
  if (urlFitment.rows.length === 0) {
    console.log(`   ❌ modification_id '${urlModId}' NOT FOUND in vehicle_fitments`);
  } else {
    console.log(`   ✅ Found: display_trim = '${urlFitment.rows[0].display_trim}'`);
  }

  // 4. Check if config matches by display_trim
  console.log("\n4. CONFIG LOOKUP BY DISPLAY_TRIM 'LX':");
  const configByTrim = await pool.query(`
    SELECT id, modification_id, display_trim, wheel_diameter, tire_size
    FROM vehicle_fitment_configurations
    WHERE make_key = 'honda' AND model_key = 'accord' AND year = 2020 AND display_trim = 'LX'
  `);
  if (configByTrim.rows.length === 0) {
    console.log("   ❌ NO CONFIG ROWS with display_trim = 'LX'");
  } else {
    console.log(`   ✅ Found ${configByTrim.rows.length} config rows:`);
    configByTrim.rows.forEach((r: any) => {
      console.log(`   - mod_id: ${r.modification_id || 'NULL'} | ${r.wheel_diameter}" | ${r.tire_size}`);
    });
  }

  // 5. Test the exact lookup the code does
  console.log("\n5. SIMULATING getFitmentConfigurations LOOKUP:");
  console.log("   Step A: Try exact modification_id match...");
  const exactMatch = await pool.query(`
    SELECT * FROM vehicle_fitment_configurations
    WHERE year = 2020 AND make_key = 'honda' AND model_key = 'accord' AND modification_id = $1
  `, [urlModId]);
  console.log(`   Result: ${exactMatch.rows.length} rows`);

  console.log("   Step B: Look up display_trim from vehicle_fitments...");
  const trimLookup = await pool.query(`
    SELECT display_trim FROM vehicle_fitments
    WHERE year = 2020 AND make = 'honda' AND model = 'accord' AND modification_id = $1
  `, [urlModId]);
  if (trimLookup.rows.length > 0) {
    const displayTrim = trimLookup.rows[0].display_trim;
    console.log(`   Result: display_trim = '${displayTrim}'`);
    
    console.log("   Step C: Try config match by display_trim...");
    const trimMatch = await pool.query(`
      SELECT * FROM vehicle_fitment_configurations
      WHERE year = 2020 AND make_key = 'honda' AND model_key = 'accord' AND display_trim = $1
    `, [displayTrim]);
    console.log(`   Result: ${trimMatch.rows.length} rows`);
  } else {
    console.log(`   Result: modification_id not found in vehicle_fitments`);
  }

  await pool.end();
}

debug().catch(console.error);
