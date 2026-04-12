import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import pg from "pg";
const { Pool } = pg;

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  // Check Silverado trims specifically
  const { rows } = await pool.query(`
    SELECT year, make, model, display_trim, modification_id, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make = 'chevrolet' AND model = 'silverado-1500' AND year = 2024
    ORDER BY display_trim
    LIMIT 15
  `);
  
  console.log("2024 Silverado-1500 Fitments:\n");
  for (const r of rows) {
    console.log(`Trim: "${r.display_trim}"`);
    console.log(`  ModID: ${r.modification_id}`);
    console.log(`  Sizes (${(r.oem_tire_sizes || []).length}): ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }
  
  // Check F-150 trims
  const { rows: f150 } = await pool.query(`
    SELECT year, make, model, display_trim, modification_id, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make = 'ford' AND model = 'f-150' AND year = 2024
    ORDER BY display_trim
    LIMIT 15
  `);
  
  console.log("\n2024 F-150 Fitments:\n");
  for (const r of f150) {
    console.log(`Trim: "${r.display_trim}"`);
    console.log(`  ModID: ${r.modification_id}`);
    console.log(`  Sizes (${(r.oem_tire_sizes || []).length}): ${(r.oem_tire_sizes || []).join(", ")}`);
    console.log("");
  }
  
  await pool.end();
}
check();
