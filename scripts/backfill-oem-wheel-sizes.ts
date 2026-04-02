/**
 * Backfill OEM Wheel Sizes (Optimized v2)
 * 
 * Handles multiple data formats:
 * - Object format: { diameter: 18, width: 8, ... }
 * - String format: "18x8", "7.5Jx17"
 * - Corrupted: "[object Object]" (needs cleanup)
 * 
 * Run: npx tsx scripts/backfill-oem-wheel-sizes.ts --dry-run
 * Run: npx tsx scripts/backfill-oem-wheel-sizes.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";

interface FitmentRecord {
  id: string;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  boltPattern: string;
  centerBoreMm: string;
  oemWheelSizes: any[];
}

function isValidWheelSizes(sizes: any[]): boolean {
  if (!sizes || !Array.isArray(sizes) || sizes.length === 0) return false;
  
  const first = sizes[0];
  
  // Object format with diameter
  if (typeof first === "object" && first !== null && first.diameter) return true;
  
  // String format like "18x8" or "7.5Jx17" (NOT "[object Object]")
  if (typeof first === "string") {
    if (first.includes("[object")) return false; // Corrupted
    if (/\d+[xX]\d+/.test(first)) return true; // Valid string format
    if (/\d+J?[xX]\d+/.test(first)) return true; // Valid J format
  }
  
  return false;
}

function isCorrupted(sizes: any[]): boolean {
  if (!sizes || !Array.isArray(sizes) || sizes.length === 0) return false;
  const first = sizes[0];
  return typeof first === "string" && first.includes("[object");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  BACKFILL OEM WHEEL SIZES (v2)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(dryRun ? "  Mode: DRY RUN (no changes)" : "  Mode: LIVE");
  console.log();
  
  // Load all records
  console.log("Loading all fitment records...");
  const allRecords = await db.execute(sql`
    SELECT id, year, make, model, display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes
    FROM vehicle_fitments
    ORDER BY make, model, year
  `);
  
  const records: FitmentRecord[] = (allRecords.rows as any[]).map(r => ({
    id: r.id,
    year: r.year,
    make: r.make,
    model: r.model,
    displayTrim: r.display_trim,
    boltPattern: r.bolt_pattern,
    centerBoreMm: r.center_bore_mm,
    oemWheelSizes: r.oem_wheel_sizes,
  }));
  
  console.log(`Loaded ${records.length} records`);
  
  // Categorize
  const validRecords = records.filter(r => isValidWheelSizes(r.oemWheelSizes));
  const corruptedRecords = records.filter(r => isCorrupted(r.oemWheelSizes));
  const emptyRecords = records.filter(r => 
    !isValidWheelSizes(r.oemWheelSizes) && !isCorrupted(r.oemWheelSizes)
  );
  
  console.log(`\nData categories:`);
  console.log(`  Valid wheel sizes:     ${validRecords.length}`);
  console.log(`  Corrupted [object]:    ${corruptedRecords.length}`);
  console.log(`  Empty/missing:         ${emptyRecords.length}`);
  
  // Step 1: Clean corrupted records (set to empty)
  if (corruptedRecords.length > 0) {
    console.log(`\nStep 1: Cleaning ${corruptedRecords.length} corrupted records...`);
    if (!dryRun) {
      await db.execute(sql`
        UPDATE vehicle_fitments
        SET oem_wheel_sizes = '[]'::jsonb,
            updated_at = NOW()
        WHERE oem_wheel_sizes::text LIKE '%[object Object]%'
      `);
      console.log(`  Cleaned ${corruptedRecords.length} corrupted records`);
    } else {
      console.log(`  Would clean ${corruptedRecords.length} corrupted records`);
    }
  }
  
  // Build lookup maps from valid records only
  const byMakeModel = new Map<string, FitmentRecord[]>();
  for (const r of validRecords) {
    const key = `${r.make}|${r.model}`;
    if (!byMakeModel.has(key)) byMakeModel.set(key, []);
    byMakeModel.get(key)!.push(r);
  }
  
  // Build donor index
  const donorIndex = new Map<string, { trim: string; sizes: any[] }>();
  for (const r of validRecords) {
    const key = `${r.make}|${r.model}|${r.year}`;
    if (!donorIndex.has(key)) {
      donorIndex.set(key, { trim: r.displayTrim, sizes: r.oemWheelSizes });
    }
  }
  
  // Find records needing backfill (corrupted + empty)
  const needsBackfill = [...corruptedRecords, ...emptyRecords];
  
  console.log(`\nStep 2: Finding donors for ${needsBackfill.length} records...`);
  
  const stats = { sibling_trim: 0, adjacent_year: 0, same_generation: 0, no_donor: 0 };
  const updates: { id: string; sizes: any[] }[] = [];
  const logs: any[] = [];
  
  for (const record of needsBackfill) {
    const mmKey = `${record.make}|${record.model}`;
    let donor: { source: string; year: number; trim: string; sizes: any[] } | null = null;
    
    // Strategy 1: Same year sibling
    const sameYearKey = `${record.make}|${record.model}|${record.year}`;
    if (donorIndex.has(sameYearKey)) {
      const d = donorIndex.get(sameYearKey)!;
      donor = { source: "sibling_trim", year: record.year, trim: d.trim, sizes: d.sizes };
    }
    
    // Strategy 2: Adjacent year (±2)
    if (!donor) {
      for (const offset of [1, -1, 2, -2]) {
        const adjKey = `${record.make}|${record.model}|${record.year + offset}`;
        if (donorIndex.has(adjKey)) {
          const d = donorIndex.get(adjKey)!;
          donor = { source: "adjacent_year", year: record.year + offset, trim: d.trim, sizes: d.sizes };
          break;
        }
      }
    }
    
    // Strategy 3: Same generation (±5, same bolt pattern)
    if (!donor) {
      const siblings = byMakeModel.get(mmKey) || [];
      for (const sib of siblings) {
        if (Math.abs(sib.year - record.year) <= 5 &&
            sib.boltPattern === record.boltPattern &&
            sib.centerBoreMm === record.centerBoreMm) {
          donor = { source: "same_generation", year: sib.year, trim: sib.displayTrim, sizes: sib.oemWheelSizes };
          break;
        }
      }
    }
    
    if (donor) {
      stats[donor.source as keyof typeof stats]++;
      updates.push({ id: record.id, sizes: donor.sizes });
      if (logs.length < 50) {
        logs.push({
          year: record.year,
          make: record.make,
          model: record.model,
          displayTrim: record.displayTrim,
          source: donor.source,
          donorYear: donor.year,
          donorTrim: donor.trim,
        });
      }
    } else {
      stats.no_donor++;
    }
  }
  
  const totalFilled = stats.sibling_trim + stats.adjacent_year + stats.same_generation;
  
  console.log(`\nFound donors for ${totalFilled} records`);
  console.log(`  - Sibling trim:     ${stats.sibling_trim}`);
  console.log(`  - Adjacent year:    ${stats.adjacent_year}`);
  console.log(`  - Same generation:  ${stats.same_generation}`);
  console.log(`  - No donor:         ${stats.no_donor}`);
  
  // Apply updates
  if (updates.length > 0 && !dryRun) {
    console.log(`\nStep 3: Applying ${updates.length} updates...`);
    let applied = 0;
    for (const upd of updates) {
      await db.execute(sql`
        UPDATE vehicle_fitments
        SET oem_wheel_sizes = ${JSON.stringify(upd.sizes)}::jsonb,
            updated_at = NOW()
        WHERE id = ${upd.id}::uuid
      `);
      applied++;
      if (applied % 200 === 0) {
        console.log(`  Applied ${applied}/${updates.length}`);
      }
    }
    console.log(`  Applied ${applied} updates`);
  }
  
  // Show examples
  console.log("\nExamples of backfilled records:");
  for (const log of logs.slice(0, 15)) {
    console.log(`  ${log.year} ${log.make} ${log.model} <- ${log.donorYear} ${log.donorTrim} [${log.source}]`);
  }
  
  // Show models with most missing
  const noDonorByModel = new Map<string, number>();
  for (const record of needsBackfill) {
    const mmKey = `${record.make}|${record.model}`;
    if (!updates.find(u => u.id === record.id)) {
      noDonorByModel.set(mmKey, (noDonorByModel.get(mmKey) || 0) + 1);
    }
  }
  
  if (noDonorByModel.size > 0) {
    console.log("\nModels still missing wheel sizes (need manual data):");
    const sorted = Array.from(noDonorByModel.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [model, count] of sorted) {
      console.log(`  ${model.replace("|", " ")}: ${count} records`);
    }
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Corrupted cleaned:   ${corruptedRecords.length}`);
  console.log(`  Backfilled:          ${totalFilled}`);
  console.log(`  Still missing:       ${stats.no_donor}`);
  console.log();
  
  fs.writeFileSync("scripts/backfill-oem-wheel-sizes-log.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun,
    corruptedCleaned: corruptedRecords.length,
    backfilled: totalFilled,
    stillMissing: stats.no_donor,
    stats,
    sampleLogs: logs,
  }, null, 2));
  console.log("Log saved to: scripts/backfill-oem-wheel-sizes-log.json");
  
  if (dryRun) {
    console.log("\nRun without --dry-run to apply changes.");
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
