import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import pg from "pg";
const { Pool } = pg;

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  const { rows } = await pool.query(`
    SELECT year, make, model, display_trim, modification_id, oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'corvette' AND year >= 2020
    ORDER BY year DESC, display_trim
    LIMIT 15
  `);
  
  console.log("Corvette 2020+ Fitments (AFTER CLEANUP):\n");
  for (const r of rows) {
    console.log(`${r.year} "${r.display_trim}"`);
    console.log(`  Source: ${r.source}`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }
  
  await pool.end();
}
check().catch(console.error);
