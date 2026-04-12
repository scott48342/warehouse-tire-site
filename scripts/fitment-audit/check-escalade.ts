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
    WHERE make = 'cadillac' AND model = 'escalade' AND year >= 2024
    ORDER BY year DESC, display_trim
  `);
  
  console.log("Cadillac Escalade Fitments (2024-2026):\n");
  for (const r of rows) {
    const tires = (r.oem_tire_sizes || []) as string[];
    const diameters = [...new Set(tires.map((t: string) => {
      const m = t.match(/R(\d{2})/i);
      return m ? parseInt(m[1]) : null;
    }).filter(Boolean))].sort((a, b) => (a || 0) - (b || 0));
    
    console.log(`Trim: "${r.display_trim}"`);
    console.log(`  ModID: ${r.modification_id}`);
    console.log(`  Diameters: ${diameters.map(d => d + '"').join(", ")}`);
    console.log(`  Sizes: ${tires.join(", ")}`);
    console.log(`  Source: ${r.source}`);
    console.log("");
  }
  
  await pool.end();
}
check().catch(console.error);
