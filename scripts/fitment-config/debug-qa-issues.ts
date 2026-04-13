import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Check Yukon config
  console.log("1. GMC Yukon Config (2022):");
  const yukon = await pool.query(`
    SELECT year, display_trim, wheel_diameter, tire_size
    FROM vehicle_fitment_configurations
    WHERE make_key = 'gmc' AND model_key = 'yukon' AND year = 2022
    ORDER BY display_trim, wheel_diameter
  `);
  yukon.rows.forEach((r: any) => console.log(`   ${r.display_trim} → ${r.wheel_diameter}" | ${r.tire_size}`));

  // Check what modification_id Denali has
  console.log("\n2. Yukon modification_ids in vehicle_fitments (2022):");
  const yukonMods = await pool.query(`
    SELECT modification_id, display_trim 
    FROM vehicle_fitments 
    WHERE make = 'gmc' AND model = 'yukon' AND year = 2022
  `);
  yukonMods.rows.forEach((r: any) => console.log(`   mod_id: ${r.modification_id} | trim: ${r.display_trim}`));

  // Check Ford Expedition
  console.log("\n3. Ford Expedition config data (2020+):");
  const exp = await pool.query(`
    SELECT year, display_trim, wheel_diameter
    FROM vehicle_fitment_configurations
    WHERE make_key = 'ford' AND model_key = 'expedition' AND year >= 2020
    ORDER BY year, display_trim
  `);
  if (exp.rows.length === 0) {
    console.log("   NO CONFIG DATA for Ford Expedition 2020+");
  } else {
    exp.rows.forEach((r: any) => console.log(`   ${r.year} ${r.display_trim} → ${r.wheel_diameter}"`));
  }

  // Check what Expedition trims exist in fitments
  console.log("\n4. Ford Expedition trims in vehicle_fitments (2022):");
  const expFitments = await pool.query(`
    SELECT DISTINCT display_trim FROM vehicle_fitments 
    WHERE make = 'ford' AND model = 'expedition' AND year = 2022
  `);
  expFitments.rows.forEach((r: any) => console.log(`   ${r.display_trim}`));

  await pool.end();
}

check().catch(console.error);
