/**
 * Fix Blocked Records
 * 
 * Identifies records that would cause broken user experiences and either:
 * 1. Fixes them if possible
 * 2. Marks them as inactive to exclude from selector
 * 
 * Run: npx tsx scripts/fix-blocked-records.ts --dry-run
 * Run: npx tsx scripts/fix-blocked-records.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { sql, eq } from "drizzle-orm";

interface BlockedRecord {
  id: string;
  year: number;
  make: string;
  model: string;
  modificationId: string;
  displayTrim: string;
  source: string;
  boltPattern: string | null;
  centerBoreMm: string | null;
  threadSize: string | null;
  blockReason: string[];
  fixAction: "fix_trim" | "delete" | "keep";
}

// Patterns that indicate junk/broken data
const TRULY_BROKEN_PATTERNS = [
  /^\s*$/,                    // Empty/whitespace only
  /^null$/i,                  // Literal "null"
  /^undefined$/i,             // Literal "undefined"
  /^n\/a$/i,                  // N/A
  /^none$/i,                  // None
  /^-+$/,                     // Just dashes
  /^\?+$/,                    // Just question marks
];

function isTrulyBroken(value: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  for (const pattern of TRULY_BROKEN_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function isValidBoltPattern(bp: string | null): boolean {
  if (!bp) return false;
  // Valid: 5x114.3, 6x135, 8x170, etc.
  return /^\d+x\d+(\.\d+)?$/.test(bp.trim());
}

function isValidCenterBore(cb: string | null): boolean {
  if (!cb) return false;
  const val = parseFloat(cb);
  // Typical range: 54mm (VW) to 180mm (heavy trucks)
  return !isNaN(val) && val >= 40 && val <= 200;
}

async function findBlockedRecords(): Promise<BlockedRecord[]> {
  console.log("Finding blocked records...");
  
  const records = await db.execute(sql`
    SELECT id, year, make, model, modification_id, display_trim, source,
           bolt_pattern, center_bore_mm, thread_size
    FROM vehicle_fitments
    ORDER BY make, model, year
  `);
  
  const blocked: BlockedRecord[] = [];
  
  for (const row of records.rows as any[]) {
    const reasons: string[] = [];
    
    // Check for missing/invalid core fields
    if (!isValidBoltPattern(row.bolt_pattern)) {
      reasons.push("invalid_bolt_pattern");
    }
    if (!isValidCenterBore(row.center_bore_mm)) {
      reasons.push("invalid_center_bore");
    }
    
    // Check for broken trim data
    if (isTrulyBroken(row.display_trim)) {
      reasons.push("broken_trim");
    }
    
    // Check for broken modification ID
    if (isTrulyBroken(row.modification_id)) {
      reasons.push("broken_modification_id");
    }
    
    if (reasons.length > 0) {
      // Determine fix action
      let fixAction: "fix_trim" | "delete" | "keep" = "keep";
      
      if (reasons.includes("invalid_bolt_pattern") || reasons.includes("invalid_center_bore")) {
        // Missing core fitment data - must delete
        fixAction = "delete";
      } else if (reasons.includes("broken_trim") && !reasons.includes("broken_modification_id")) {
        // Just broken trim - can fix
        fixAction = "fix_trim";
      } else if (reasons.includes("broken_modification_id")) {
        // Broken mod ID - delete
        fixAction = "delete";
      }
      
      blocked.push({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        modificationId: row.modification_id,
        displayTrim: row.display_trim,
        source: row.source,
        boltPattern: row.bolt_pattern,
        centerBoreMm: row.center_bore_mm,
        threadSize: row.thread_size,
        blockReason: reasons,
        fixAction,
      });
    }
  }
  
  return blocked;
}

async function fixBlockedRecords(blocked: BlockedRecord[], dryRun: boolean): Promise<{
  fixed: number;
  deleted: number;
  kept: number;
}> {
  let fixed = 0;
  let deleted = 0;
  let kept = 0;
  
  for (const record of blocked) {
    if (record.fixAction === "fix_trim") {
      // Fix broken trim by setting to "Base"
      if (!dryRun) {
        await db.execute(sql`
          UPDATE vehicle_fitments
          SET display_trim = 'Base',
              raw_trim = 'Base',
              updated_at = NOW()
          WHERE id = ${record.id}::uuid
        `);
      }
      console.log(`  FIX: ${record.year} ${record.make} ${record.model} - set trim to 'Base' (was: '${record.displayTrim}')`);
      fixed++;
    } else if (record.fixAction === "delete") {
      // Delete record with missing core data
      if (!dryRun) {
        await db.execute(sql`
          DELETE FROM vehicle_fitments
          WHERE id = ${record.id}::uuid
        `);
      }
      console.log(`  DELETE: ${record.year} ${record.make} ${record.model} - ${record.blockReason.join(", ")}`);
      deleted++;
    } else {
      kept++;
    }
  }
  
  return { fixed, deleted, kept };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FIX BLOCKED RECORDS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(dryRun ? "  Mode: DRY RUN (no changes)" : "  Mode: LIVE");
  console.log();
  
  const blocked = await findBlockedRecords();
  
  console.log(`\nFound ${blocked.length} potentially blocked records`);
  
  // Group by reason
  const byReason = new Map<string, number>();
  const byAction = new Map<string, number>();
  
  for (const r of blocked) {
    for (const reason of r.blockReason) {
      byReason.set(reason, (byReason.get(reason) || 0) + 1);
    }
    byAction.set(r.fixAction, (byAction.get(r.fixAction) || 0) + 1);
  }
  
  console.log("\nBy reason:");
  for (const [reason, count] of byReason) {
    console.log(`  ${reason}: ${count}`);
  }
  
  console.log("\nBy action:");
  for (const [action, count] of byAction) {
    console.log(`  ${action}: ${count}`);
  }
  
  console.log("\nExamples of records to delete:");
  const toDelete = blocked.filter(r => r.fixAction === "delete").slice(0, 10);
  for (const r of toDelete) {
    console.log(`  ${r.year} ${r.make} ${r.model}: BP='${r.boltPattern}' CB='${r.centerBoreMm}' [${r.blockReason.join(", ")}]`);
  }
  
  console.log("\nExamples of records to fix:");
  const toFix = blocked.filter(r => r.fixAction === "fix_trim").slice(0, 10);
  for (const r of toFix) {
    console.log(`  ${r.year} ${r.make} ${r.model}: trim='${r.displayTrim}' -> 'Base'`);
  }
  
  if (blocked.length === 0) {
    console.log("\n✅ No blocked records found!");
    process.exit(0);
  }
  
  console.log("\n" + (dryRun ? "Would apply fixes..." : "Applying fixes..."));
  const result = await fixBlockedRecords(blocked, dryRun);
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Records fixed (trim):  ${result.fixed}`);
  console.log(`  Records deleted:       ${result.deleted}`);
  console.log(`  Records kept:          ${result.kept}`);
  console.log();
  
  if (dryRun) {
    console.log("Run without --dry-run to apply changes.");
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
