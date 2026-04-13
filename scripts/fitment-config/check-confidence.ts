import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const r = await pool.query(`
    SELECT source_confidence, COUNT(*) as count 
    FROM vehicle_fitment_configurations 
    GROUP BY source_confidence
  `);
  console.log("Confidence distribution:", r.rows);
  await pool.end();
}

check().catch(console.error);
