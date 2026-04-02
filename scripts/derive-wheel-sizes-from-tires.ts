/**
 * Derive OEM Wheel Sizes from Tire Sizes
 * 
 * Extracts wheel diameter from tire size strings (e.g., "255/65R16" → 16")
 * and creates basic wheel size records.
 * 
 * Safe because we're extracting data that's already encoded in tire sizes.
 * 
 * Run: npx tsx scripts/derive-wheel-sizes-from-tires.ts --dry-run
 * Run: npx tsx scripts/derive-wheel-sizes-from-tires.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";

// Extract wheel diameter from tire size string
// Examples: "255/65R16" → 16, "P275/55R20" → 20, "LT265/70R17" → 17
function extractDiameter(tireSize: string): number | null {
  const match = tireSize.match(/R(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

// Get standard width for a given diameter (conservative defaults)
function getDefaultWidth(diameter: number): number {
  if (diameter <= 15) return 6;
  if (diameter === 16) return 6.5;
  if (diameter === 17) return 7;
  if (diameter === 18) return 7.5;
  if (diameter === 19) return 8;
  if (diameter === 20) return 8.5;
  if (diameter === 21) return 9;
  return 8; // Default for larger
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DERIVE OEM WHEEL SIZES FROM TIRE SIZES");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(dryRun ? "  Mode: DRY RUN (no changes)" : "  Mode: LIVE");
  console.log();
  
  // Find records with tire sizes but no valid wheel sizes
  console.log("Finding records with tire sizes but no wheel sizes...");
  
  const records = await db.execute(sql`
    SELECT id, year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb
      AND jsonb_array_length(oem_tire_sizes) > 0
      AND (
        oem_wheel_sizes IS NULL 
        OR oem_wheel_sizes = '[]'::jsonb
        OR oem_wheel_sizes::text LIKE '%[object Object]%'
      )
    ORDER BY make, model, year
  `);
  
  console.log(`Found ${records.rows.length} records to process`);
  
  const updates: { id: string; wheelSizes: any[] }[] = [];
  const logs: any[] = [];
  let processed = 0;
  let skipped = 0;
  
  for (const row of records.rows as any[]) {
    const tireSizes = row.oem_tire_sizes as string[];
    
    // Extract unique diameters from tire sizes
    const diameters = new Set<number>();
    for (const tire of tireSizes) {
      if (typeof tire === "string") {
        const d = extractDiameter(tire);
        if (d && d >= 13 && d <= 24) { // Reasonable wheel range
          diameters.add(d);
        }
      }
    }
    
    if (diameters.size === 0) {
      skipped++;
      continue;
    }
    
    // Create wheel size records
    const wheelSizes = Array.from(diameters).sort((a, b) => a - b).map(diameter => ({
      diameter,
      width: getDefaultWidth(diameter),
      offset: null,
      axle: "front",
      isStock: true,
    }));
    
    updates.push({ id: row.id, wheelSizes });
    
    if (logs.length < 30) {
      logs.push({
        year: row.year,
        make: row.make,
        model: row.model,
        tireSizes: tireSizes.slice(0, 4),
        derivedDiameters: Array.from(diameters),
      });
    }
    
    processed++;
  }
  
  console.log(`\nProcessed: ${processed} records`);
  console.log(`Skipped (no valid tire sizes): ${skipped} records`);
  
  // Show examples
  console.log("\nExamples of derived wheel sizes:");
  for (const log of logs.slice(0, 15)) {
    console.log(`  ${log.year} ${log.make} ${log.model}:`);
    console.log(`    Tires: ${log.tireSizes.join(", ")}`);
    console.log(`    Derived: ${log.derivedDiameters.map((d: number) => d + '"').join(", ")}`);
  }
  
  // Apply updates
  if (updates.length > 0 && !dryRun) {
    console.log(`\nApplying ${updates.length} updates...`);
    let applied = 0;
    for (const upd of updates) {
      await db.execute(sql`
        UPDATE vehicle_fitments
        SET oem_wheel_sizes = ${JSON.stringify(upd.wheelSizes)}::jsonb,
            updated_at = NOW()
        WHERE id = ${upd.id}::uuid
      `);
      applied++;
      if (applied % 500 === 0) {
        console.log(`  Applied ${applied}/${updates.length}`);
      }
    }
    console.log(`  Applied ${applied} updates`);
  }
  
  // Summary by make
  const byMake = new Map<string, number>();
  for (const row of records.rows as any[]) {
    byMake.set(row.make, (byMake.get(row.make) || 0) + 1);
  }
  
  console.log("\nRecords updated by make:");
  const sortedMakes = Array.from(byMake.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [make, count] of sortedMakes) {
    console.log(`  ${make}: ${count}`);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Records with wheel sizes derived: ${processed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log();
  
  fs.writeFileSync("scripts/derive-wheel-sizes-log.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun,
    derived: processed,
    skipped,
    sampleLogs: logs,
  }, null, 2));
  console.log("Log saved to: scripts/derive-wheel-sizes-log.json");
  
  if (dryRun) {
    console.log("\nRun without --dry-run to apply changes.");
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
