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

function getWheelDiameters(tireSizes: string[]): number[] {
  const diameters = new Set<number>();
  for (const size of tireSizes) {
    const d = extractRimDiameter(size);
    if (d !== null) diameters.add(d);
  }
  return Array.from(diameters).sort((a, b) => a - b);
}

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  // Get some semantic modificationIds
  const { rows } = await pool.query(`
    SELECT year, make, model, display_trim, modification_id, oem_tire_sizes
    FROM vehicle_fitments
    WHERE year >= 2022 
      AND modification_id ~ '^[a-z]+-[a-z]+-.*-[a-f0-9]{8}$'
    ORDER BY year DESC, make, model
    LIMIT 30
  `);
  
  console.log("SEMANTIC MODIFICATIONID SAMPLES:\n");
  console.log("These should be clean, trim-specific fitments.\n");
  
  let singleDia = 0;
  let multiDia = 0;
  
  for (const r of rows) {
    const tireSizes = (r.oem_tire_sizes || []) as string[];
    const diameters = getWheelDiameters(tireSizes);
    
    const diaStr = diameters.map(d => d + '"').join(", ");
    const icon = diameters.length === 1 ? "✅" : "📊";
    
    if (diameters.length === 1) singleDia++;
    else multiDia++;
    
    console.log(`${icon} ${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`   Diameters: ${diaStr}`);
    console.log(`   Sizes: ${tireSizes.join(", ")}`);
    console.log(`   ModID: ${r.modification_id}`);
    console.log("");
  }
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Summary: ${singleDia} single-diameter, ${multiDia} multi-diameter`);
  console.log("═══════════════════════════════════════════════════════════════");
  
  await pool.end();
}

check().catch(console.error);
