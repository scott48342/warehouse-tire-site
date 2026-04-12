import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import pg from "pg";
const { Pool } = pg;

async function fix() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  // Correct tire sizes for 5th gen Escalade (2021+) - only 22" and 24"
  const correctSizes = ["P275/50R22", "P285/45R22", "P285/40R24"];
  
  console.log("Fixing 2026 Escalade tire sizes...\n");
  console.log("BEFORE: Included incorrect 18\"/20\" sizes from older generations");
  console.log("AFTER: Only correct 22\"/24\" OEM sizes\n");
  
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $1::jsonb, 
        source = 'manual_fix_escalade_2026', 
        updated_at = NOW() 
    WHERE make = 'cadillac' 
      AND model = 'escalade' 
      AND year = 2026 
      AND oem_tire_sizes::text LIKE '%R18%'
    RETURNING id, display_trim, oem_tire_sizes
  `, [JSON.stringify(correctSizes)]);
  
  console.log(`Fixed ${result.rowCount} record(s):\n`);
  for (const r of result.rows) {
    console.log(`  ID: ${r.id}`);
    console.log(`  Trim: ${r.display_trim}`);
    console.log(`  New sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
  }
  
  await pool.end();
}

fix().catch(console.error);
