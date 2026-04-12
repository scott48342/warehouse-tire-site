/**
 * Trace the source of bad tire size inheritance
 * 
 * Finds where legacy 15"/16" tire sizes came from for modern vehicles
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

async function trace() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        TRACING BAD TIRE SIZE INHERITANCE                       ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Find modern vehicles with implausibly small tire sizes (15"/16")
  const { rows: contaminated } = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id, 
      oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE year >= 2020
      AND oem_tire_sizes::text LIKE '%R15%'
    ORDER BY year DESC, make, model
    LIMIT 50
  `);

  console.log(`Found ${contaminated.length} contaminated records (2020+ with R15 tires)\n`);

  // Analyze source patterns
  const sourceCounts: Record<string, number> = {};
  for (const r of contaminated) {
    const src = r.source || "null";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }

  console.log("Sources of contamination:");
  for (const [src, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
  }
  console.log("");

  // Show specific examples
  console.log("Contaminated vehicle examples:\n");
  for (const r of contaminated.slice(0, 15)) {
    console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`  Source: ${r.source}`);
    console.log(`  ModID: ${r.modification_id}`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).join(", ")}`);
    
    // Try to trace the inheritance chain
    if (r.modification_id.startsWith("inherited_")) {
      const match = r.modification_id.match(/inherited_(\d{4})_(.+)/);
      if (match) {
        const sourceYear = match[1];
        const sourceModId = match[2];
        console.log(`  → Inherited from ${sourceYear} (mod: ${sourceModId})`);
      }
    }
    console.log("");
  }

  // Find records by source=generation_inherit specifically
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        GENERATION_INHERIT SOURCE ANALYSIS                      ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: genInherit } = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id, 
      oem_tire_sizes, oem_wheel_sizes, source
    FROM vehicle_fitments
    WHERE source = 'generation_inherit'
    ORDER BY year DESC, make, model
    LIMIT 30
  `);

  console.log(`Records with source='generation_inherit': ${genInherit.length} (showing first 30)\n`);

  for (const r of genInherit.slice(0, 10)) {
    const tires = (r.oem_tire_sizes || []) as string[];
    const diameters = [...new Set(tires.map((t: string) => {
      const m = t.match(/R(\d{2})/i);
      return m ? parseInt(m[1]) : null;
    }).filter(Boolean))].sort((a, b) => (a || 0) - (b || 0));
    
    console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`  Diameters: ${diameters.map(d => d + '"').join(", ")}`);
    console.log(`  Sizes: ${tires.slice(0, 4).join(", ")}${tires.length > 4 ? "..." : ""}`);
    console.log("");
  }

  // Check how generation_inherit was created - find the logic
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        CHECKING WHICH SCRIPT CREATED GENERATION_INHERIT        ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Find all distinct source values that look like inheritance
  const { rows: allSources } = await pool.query(`
    SELECT source, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE source LIKE '%inherit%' OR source LIKE '%generation%'
    GROUP BY source
    ORDER BY cnt DESC
  `);

  console.log("All inheritance-related sources:");
  for (const r of allSources) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }

  // Check if there's a pattern in the bad data
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("        CHECKING MODERN TRUCKS WITH LEGACY TIRE SIZES           ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const { rows: modernTrucks } = await pool.query(`
    SELECT 
      year, make, model, display_trim, modification_id, 
      oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE year >= 2020
      AND model IN ('silverado-1500', 'f-150', 'sierra-1500', '1500', 'tundra')
      AND (oem_tire_sizes::text LIKE '%R15%' OR oem_tire_sizes::text LIKE '%R16%')
    ORDER BY make, model, year DESC
    LIMIT 30
  `);

  console.log(`Modern trucks (2020+) with 15"/16" tires: ${modernTrucks.length}\n`);

  for (const r of modernTrucks.slice(0, 15)) {
    console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
    console.log(`  Source: ${r.source}`);
    console.log(`  Sizes: ${(r.oem_tire_sizes || []).slice(0, 4).join(", ")}`);
    console.log("");
  }

  await pool.end();
}

trace().catch(console.error);
