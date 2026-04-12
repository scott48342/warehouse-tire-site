import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
  if (match) return Math.floor(parseFloat(match[1]));
  return null;
}

async function run() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: false,
  });
  
  const { rows } = await pool.query(`
    SELECT year, make, model, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE year >= 2015 AND oem_tire_sizes IS NOT NULL
    ORDER BY year DESC, make, model
  `);
  
  let multiDiaCount = 0;
  const examples: { vehicle: string; sizes: string[]; diameters: number[] }[] = [];
  
  for (const row of rows) {
    const sizes = (row.oem_tire_sizes || []) as string[];
    const diameters = new Set<number>();
    for (const s of sizes) {
      const d = extractRimDiameter(s);
      if (d !== null) diameters.add(d);
    }
    if (diameters.size > 1) {
      multiDiaCount++;
      if (examples.length < 20) {
        examples.push({
          vehicle: `${row.year} ${row.make} ${row.model} ${row.display_trim || ""}`,
          sizes,
          diameters: [...diameters].sort((a, b) => a - b),
        });
      }
    }
  }
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        VEHICLES WITH MULTIPLE WHEEL DIAMETERS                 ");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log(`Total: ${multiDiaCount} / ${rows.length} records have multiple wheel diameters\n`);
  console.log("Examples:\n");
  
  for (const ex of examples) {
    console.log(`  ${ex.vehicle}`);
    console.log(`    Sizes: ${ex.sizes.join(", ")}`);
    console.log(`    Diameters: ${ex.diameters.map(d => d + '"').join(", ")}`);
    console.log("");
  }
  
  await pool.end();
}

run().catch(console.error);
