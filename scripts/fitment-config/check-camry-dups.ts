import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Check all Camry LE entries in vehicle_fitments
  const fitments = await pool.query(`
    SELECT year, modification_id, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make = 'toyota' AND model = 'camry' AND LOWER(display_trim) = 'le'
    ORDER BY year, modification_id
  `);
  
  console.log("Vehicle Fitments for Toyota Camry LE:");
  console.log("======================================");
  fitments.rows.forEach((r: any) => {
    console.log(`${r.year} | mod_id: ${r.modification_id} | wheels: ${JSON.stringify(r.oem_wheel_sizes)} | tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  });

  // Check configs
  console.log("\n\nConfig table for Camry LE:");
  console.log("===========================");
  const configs = await pool.query(`
    SELECT year, modification_id, display_trim, wheel_diameter, tire_size
    FROM vehicle_fitment_configurations
    WHERE make_key = 'toyota' AND model_key = 'camry' AND LOWER(display_trim) = 'le'
    ORDER BY year, modification_id
  `);
  configs.rows.forEach((r: any) => {
    console.log(`${r.year} | mod_id: ${r.modification_id} | trim: ${r.display_trim} | ${r.wheel_diameter}" | ${r.tire_size}`);
  });

  await pool.end();
}

check();
