/**
 * Verify Fitment Promotion Results
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function verify() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VERIFICATION REPORT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Count total configs
  const totalRes = await pool.query("SELECT COUNT(*) as count FROM vehicle_fitment_configurations");
  console.log("Total config rows:", totalRes.rows[0].count);
  
  // Count by source
  const sourceRes = await pool.query("SELECT source, COUNT(*) as count FROM vehicle_fitment_configurations GROUP BY source ORDER BY count DESC");
  console.log("\nBy source:");
  sourceRes.rows.forEach((r: any) => console.log(`  ${r.source}: ${r.count}`));
  
  // Check Camry LE specifically
  const camryLERes = await pool.query(`
    SELECT year, display_trim, wheel_diameter, tire_size 
    FROM vehicle_fitment_configurations 
    WHERE make_key = 'toyota' AND model_key = 'camry' AND display_trim = 'LE'
    ORDER BY year
  `);
  console.log("\n✅ Toyota Camry LE configs:", camryLERes.rows.length, "rows");
  camryLERes.rows.forEach((r: any) => console.log(`  ${r.year} Camry LE → ${r.tire_size} (${r.wheel_diameter}")`));
  
  // Check Honda Accord LX
  const accordLXRes = await pool.query(`
    SELECT year, display_trim, wheel_diameter, tire_size 
    FROM vehicle_fitment_configurations 
    WHERE make_key = 'honda' AND model_key = 'accord' AND display_trim = 'LX'
    ORDER BY year
  `);
  console.log("\n✅ Honda Accord LX configs:", accordLXRes.rows.length, "rows");
  accordLXRes.rows.forEach((r: any) => console.log(`  ${r.year} Accord LX → ${r.tire_size} (${r.wheel_diameter}")`));

  // Check Escalade (should have existing high-confidence data)
  const escaladeRes = await pool.query(`
    SELECT year, display_trim, wheel_diameter, tire_size, source, source_confidence
    FROM vehicle_fitment_configurations 
    WHERE make_key = 'cadillac' AND model_key = 'escalade'
    ORDER BY year, display_trim
    LIMIT 10
  `);
  console.log("\n✅ Cadillac Escalade configs (existing + new):", escaladeRes.rows.length, "rows (showing first 10)");
  escaladeRes.rows.forEach((r: any) => console.log(`  ${r.year} Escalade ${r.display_trim} → ${r.tire_size} (${r.wheel_diameter}") [${r.source}/${r.source_confidence}]`));

  // Unique vehicles covered
  const uniqueRes = await pool.query(`
    SELECT COUNT(DISTINCT (year, make_key, model_key, display_trim)) as unique_trims
    FROM vehicle_fitment_configurations
  `);
  console.log("\n📊 Unique trim configurations:", uniqueRes.rows[0].unique_trims);

  await pool.end();
}

verify().catch(console.error);
