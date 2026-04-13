import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const r = await pool.query(
    "SELECT modification_id, display_trim FROM vehicle_fitments WHERE make = $1 AND model = $2 AND year = $3",
    ["toyota", "camry", 2020]
  );
  console.log("2020 Toyota Camry fitments:");
  r.rows.forEach((row: any) => {
    console.log(`  mod_id: ${row.modification_id} | trim: ${row.display_trim}`);
  });
  await pool.end();
}

check().catch(console.error);
