import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  // Check what we inserted
  const inserted = await pool.query(`
    SELECT year, make_key, model_key, modification_id, display_trim, wheel_diameter, tire_size 
    FROM vehicle_fitment_configurations 
    WHERE make_key = 'toyota' AND model_key = 'camry' AND year = 2020
    ORDER BY display_trim
  `);
  console.log("Inserted configs for 2020 Camry:");
  inserted.rows.forEach((r: any) => console.log("  mod_id:", r.modification_id, "| trim:", r.display_trim, "|", r.wheel_diameter, "inch"));

  // Check what the fitment table has for modification_id
  const fitment = await pool.query(`
    SELECT modification_id, display_trim 
    FROM vehicle_fitments 
    WHERE make = 'toyota' AND model = 'camry' AND year = 2020
    ORDER BY display_trim
    LIMIT 10
  `);
  console.log("\nFitment table modification_ids for 2020 Camry:");
  fitment.rows.forEach((r: any) => console.log("  mod_id:", r.modification_id, "| trim:", r.display_trim));

  await pool.end();
}
check();
