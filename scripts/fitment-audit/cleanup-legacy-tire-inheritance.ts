/**
 * CLEANUP: Remove legacy tire size contamination from modern vehicles
 * 
 * ROOT CAUSE: `generation_inherit` copied tire sizes from classic vehicles
 * to modern vehicles within the same model family.
 * 
 * FIX: For each contaminated record, either:
 * 1. Update with correct tire sizes from `generation_template`/`railway_import`/`wheelsize`
 * 2. Delete if no correct source exists
 * 
 * SAFETY:
 * - DRY RUN by default
 * - Preserves records with correct sizes
 * - Logs all changes
 * 
 * Usage: 
 *   npx tsx scripts/fitment-audit/cleanup-legacy-tire-inheritance.ts --dry-run
 *   npx tsx scripts/fitment-audit/cleanup-legacy-tire-inheritance.ts --apply
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

interface CleanupRecord {
  id: number;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  modificationId: string;
  badTireSizes: string[];
  source: string;
  action: "UPDATE" | "DELETE";
  correctTireSizes?: string[];
  correctSource?: string;
}

// Minimum rim diameter for modern vehicles by year
// Vehicles built after these years should NOT have smaller rims
const MIN_RIM_DIAMETER_BY_YEAR: Record<number, number> = {
  2020: 17, // Modern trucks/SUVs: min 17"
  2015: 16, // 2015-2019: min 16"
  2010: 15, // 2010-2014: min 15" (some compacts still had 15")
  2000: 14, // 2000-2009: min 14"
};

// Specific model overrides (some models have known minimum sizes)
const MODEL_MIN_DIAMETERS: Record<string, number> = {
  "corvette": 18,         // C7/C8 Corvettes: 18" minimum
  "camaro": 18,           // 5th/6th gen: 18" minimum
  "mustang": 17,          // S550+: 17" minimum
  "silverado-1500": 17,   // GMT T1XX: 17" minimum
  "sierra-1500": 17,
  "f-150": 17,            // 2015+: 17" minimum
  "ram-1500": 17,
  "1500": 17,
  "tahoe": 17,
  "yukon": 17,
  "escalade": 22,         // Modern Escalade: 22" minimum
  "tundra": 18,           // 2022+: 18" minimum (older 17")
};

function getMinDiameter(year: number, model: string): number {
  // Check model-specific override
  const modelMin = MODEL_MIN_DIAMETERS[model.toLowerCase()];
  if (modelMin) return modelMin;
  
  // Fall back to year-based minimum
  for (const [cutoffYear, minDia] of Object.entries(MIN_RIM_DIAMETER_BY_YEAR).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    if (year >= Number(cutoffYear)) return minDia;
  }
  return 14; // Default for old vehicles
}

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
  if (match) return Math.floor(parseFloat(match[1]));
  return null;
}

function hasLegacyTires(tireSizes: string[], minDiameter: number): boolean {
  for (const size of tireSizes) {
    const dia = extractRimDiameter(size);
    if (dia !== null && dia < minDiameter) return true;
  }
  return false;
}

function filterValidTires(tireSizes: string[], minDiameter: number): string[] {
  return tireSizes.filter(size => {
    const dia = extractRimDiameter(size);
    return dia === null || dia >= minDiameter;
  });
}

async function runCleanup(dryRun: boolean = true) {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  const report: CleanupRecord[] = [];
  
  try {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("        CLEANUP: LEGACY TIRE SIZE CONTAMINATION                 ");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`MODE: ${dryRun ? "DRY RUN (no changes)" : "APPLYING CHANGES"}\n`);

    // Step 1: Find all contaminated records (modern vehicles with legacy tire sizes)
    const { rows: contaminated } = await pool.query(`
      SELECT 
        id, year, make, model, display_trim, modification_id, 
        oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE year >= 2015
        AND source = 'generation_inherit'
        AND (
          oem_tire_sizes::text LIKE '%R14%'
          OR oem_tire_sizes::text LIKE '%R15%'
          OR oem_tire_sizes::text LIKE '%R16%'
        )
      ORDER BY year DESC, make, model
    `);

    console.log(`Found ${contaminated.length} potentially contaminated records\n`);

    // Step 2: For each contaminated record, find the best correction source
    let updateCount = 0;
    let deleteCount = 0;
    let skipCount = 0;

    for (const record of contaminated) {
      const tireSizes = (record.oem_tire_sizes || []) as string[];
      const minDia = getMinDiameter(record.year, record.model);
      
      // Check if actually contaminated
      if (!hasLegacyTires(tireSizes, minDia)) {
        skipCount++;
        continue; // Not actually a problem
      }

      // Try to find correct tire sizes from a better source
      const { rows: correctSources } = await pool.query(`
        SELECT oem_tire_sizes, source
        FROM vehicle_fitments
        WHERE year = $1 AND make = $2 AND model = $3
          AND source IN ('generation_template', 'railway_import', 'wheelsize', 'api_import', 'cache-import', 'tier-a-import')
          AND oem_tire_sizes IS NOT NULL
        LIMIT 1
      `, [record.year, record.make, record.model]);

      const cleanupRecord: CleanupRecord = {
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        displayTrim: record.display_trim,
        modificationId: record.modification_id,
        badTireSizes: tireSizes,
        source: record.source,
        action: "DELETE",
      };

      if (correctSources.length > 0) {
        const correctTires = (correctSources[0].oem_tire_sizes || []) as string[];
        const validTires = filterValidTires(correctTires, minDia);
        
        if (validTires.length > 0) {
          cleanupRecord.action = "UPDATE";
          cleanupRecord.correctTireSizes = validTires;
          cleanupRecord.correctSource = correctSources[0].source;
        }
      }

      report.push(cleanupRecord);
      
      if (cleanupRecord.action === "UPDATE") {
        updateCount++;
        if (!dryRun) {
          await pool.query(`
            UPDATE vehicle_fitments 
            SET oem_tire_sizes = $1::jsonb,
                source = $2,
                updated_at = NOW()
            WHERE id = $3
          `, [
            JSON.stringify(cleanupRecord.correctTireSizes),
            `cleanup_${cleanupRecord.correctSource}`,
            record.id
          ]);
        }
      } else {
        deleteCount++;
        if (!dryRun) {
          await pool.query(`DELETE FROM vehicle_fitments WHERE id = $1`, [record.id]);
        }
      }
    }

    // Print summary
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                         SUMMARY                                ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    console.log(`Total contaminated: ${contaminated.length - skipCount}`);
    console.log(`  → UPDATE with correct sizes: ${updateCount}`);
    console.log(`  → DELETE (no correct source): ${deleteCount}`);
    console.log(`  → SKIPPED (false positive): ${skipCount}`);
    console.log("");

    // Show examples
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                        EXAMPLES                                ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const updates = report.filter(r => r.action === "UPDATE").slice(0, 5);
    const deletes = report.filter(r => r.action === "DELETE").slice(0, 5);

    if (updates.length > 0) {
      console.log("UPDATES (correcting tire sizes):\n");
      for (const r of updates) {
        console.log(`${r.year} ${r.make} ${r.model} - "${r.displayTrim}"`);
        console.log(`  BAD: ${r.badTireSizes.join(", ")}`);
        console.log(`  GOOD: ${r.correctTireSizes?.join(", ")}`);
        console.log(`  Source: ${r.source} → cleanup_${r.correctSource}`);
        console.log("");
      }
    }

    if (deletes.length > 0) {
      console.log("DELETES (no correct source available):\n");
      for (const r of deletes) {
        console.log(`${r.year} ${r.make} ${r.model} - "${r.displayTrim}"`);
        console.log(`  BAD: ${r.badTireSizes.join(", ")}`);
        console.log("");
      }
    }

    // Save full report
    const fs = await import("fs/promises");
    await fs.writeFile(
      "./scripts/fitment-audit/cleanup-report.json",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        dryRun,
        summary: {
          total: contaminated.length,
          contaminated: contaminated.length - skipCount,
          updates: updateCount,
          deletes: deleteCount,
          skipped: skipCount,
        },
        records: report,
      }, null, 2)
    );
    console.log(`\n📄 Full report saved to: ./scripts/fitment-audit/cleanup-report.json`);

    if (dryRun) {
      console.log("\n⚠️  DRY RUN - No changes made. Run with --apply to execute.");
    } else {
      console.log("\n✅ Changes applied successfully!");
    }

  } finally {
    await pool.end();
  }
}

const dryRun = !process.argv.includes("--apply");
runCleanup(dryRun).catch(console.error);
