import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  console.log("GMC Yukon 2022 fitments:");
  const yukon = await pool.query(
    `SELECT modification_id, display_trim FROM vehicle_fitments WHERE make = 'gmc' AND model = 'yukon' AND year = 2022`
  );
  yukon.rows.forEach((r: any) => console.log(`  mod_id: ${r.modification_id} | trim: ${r.display_trim}`));
  
  console.log("\nFord Expedition 2022 fitments:");
  const exp = await pool.query(
    `SELECT modification_id, display_trim FROM vehicle_fitments WHERE make = 'ford' AND model = 'expedition' AND year = 2022`
  );
  exp.rows.forEach((r: any) => console.log(`  mod_id: ${r.modification_id} | trim: ${r.display_trim}`));
  
  await pool.end();
}

check().catch(console.error);
