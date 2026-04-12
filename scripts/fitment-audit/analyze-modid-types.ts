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

async function analyze() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  // Get all fitments from 2020+
  const { rows } = await pool.query(`
    SELECT modification_id, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE year >= 2020 AND oem_tire_sizes IS NOT NULL
  `);
  
  // Categorize by modificationId type
  const categories: Record<string, { total: number; multiDia: number; avgDiaCount: number }> = {
    "manual_*": { total: 0, multiDia: 0, avgDiaCount: 0 },
    "railway_*": { total: 0, multiDia: 0, avgDiaCount: 0 },
    "inherited_*": { total: 0, multiDia: 0, avgDiaCount: 0 },
    "reviewed_*": { total: 0, multiDia: 0, avgDiaCount: 0 },
    "semantic": { total: 0, multiDia: 0, avgDiaCount: 0 },
    "s_hash": { total: 0, multiDia: 0, avgDiaCount: 0 },
    "other": { total: 0, multiDia: 0, avgDiaCount: 0 },
  };
  
  let diaCounts: Record<string, number[]> = {
    "manual_*": [],
    "railway_*": [],
    "inherited_*": [],
    "reviewed_*": [],
    "semantic": [],
    "s_hash": [],
    "other": [],
  };
  
  for (const r of rows) {
    const modId = r.modification_id;
    let cat = "other";
    
    if (modId.startsWith("manual_")) cat = "manual_*";
    else if (modId.startsWith("railway_")) cat = "railway_*";
    else if (modId.startsWith("inherited_")) cat = "inherited_*";
    else if (modId.startsWith("reviewed_")) cat = "reviewed_*";
    else if (/^[a-z]+-[a-z]+-.*-[a-f0-9]{8}$/.test(modId)) cat = "semantic";
    else if (/^s_[a-f0-9]{8}$/.test(modId)) cat = "s_hash";
    
    const tireSizes = (r.oem_tire_sizes || []) as string[];
    const diameters = getWheelDiameters(tireSizes);
    
    categories[cat].total++;
    if (diameters.length > 1) {
      categories[cat].multiDia++;
    }
    diaCounts[cat].push(diameters.length);
  }
  
  // Calculate averages
  for (const cat of Object.keys(categories)) {
    if (diaCounts[cat].length > 0) {
      categories[cat].avgDiaCount = diaCounts[cat].reduce((a, b) => a + b, 0) / diaCounts[cat].length;
    }
  }
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   MODIFICATION ID TYPE ANALYSIS (2020+ vehicles)              ");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("ModificationId Type         | Total | Multi-Dia | % Multi | Avg Dias");
  console.log("----------------------------|-------|-----------|---------|----------");
  
  for (const [cat, data] of Object.entries(categories).sort((a, b) => b[1].total - a[1].total)) {
    const pct = data.total > 0 ? (data.multiDia / data.total * 100).toFixed(1) : "0.0";
    console.log(
      `${cat.padEnd(27)} | ${String(data.total).padStart(5)} | ${String(data.multiDia).padStart(9)} | ${pct.padStart(6)}% | ${data.avgDiaCount.toFixed(2)}`
    );
  }
  
  console.log("\n");
  console.log("INTERPRETATION:");
  console.log("- semantic: Clean trim-level data (make-model-trim-hash format)");
  console.log("- manual_*/railway_*: Older import, likely aggregated");
  console.log("- inherited_*/reviewed_*: Mixed quality");
  console.log("- s_hash: Grouped modifications (intentional aggregation)");
  
  await pool.end();
}

analyze().catch(console.error);
