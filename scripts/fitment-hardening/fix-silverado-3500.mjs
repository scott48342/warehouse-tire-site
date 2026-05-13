/**
 * Fix 2011 Silverado 3500 HD low-confidence record
 * 
 * Issues found:
 * 1. bfb19683 - Missing center bore and offsets (verified-research source)
 * 2. d9a404e3 - Completely wrong bolt pattern (5x120 is BMW, not GM HD)
 * 
 * Reference for 2011 Silverado 3500 HD (8x180):
 * - Center Bore: 124.1mm (confirmed by 5 other records from templates)
 * - Offset Range: -44 to 55mm (from GM HD templates)
 * - Thread Size: M14x1.5 (GM standard for HD trucks)
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

const DRY_RUN = process.argv.includes("--dry-run");
const LOW_CONFIDENCE_ID = "bfb19683-a4a0-452c-b873-a75b4a275a67";
const GARBAGE_ID = "d9a404e3-b04b-425f-8e41-26bed80f04ad";

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`FIX: 2011 Silverado 3500 HD Low-Confidence Record`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`${"=".repeat(60)}\n`);

  // Create snapshot before changes
  const snapshotBefore = await client`
    SELECT * FROM vehicle_fitments 
    WHERE id IN (${LOW_CONFIDENCE_ID}, ${GARBAGE_ID})
  `;
  
  const snapshotPath = join(__dirname, `snapshot-silverado-fix-${Date.now()}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshotBefore, null, 2));
  console.log(`✓ Snapshot saved: ${snapshotPath}\n`);

  // Fix 1: Update the low-confidence record with correct specs
  console.log(`[1] Fixing low-confidence record ${LOW_CONFIDENCE_ID}`);
  console.log(`    Adding: center_bore_mm=124.1, offset_min=-44, offset_max=55`);
  
  if (!DRY_RUN) {
    await client`
      UPDATE vehicle_fitments
      SET 
        center_bore_mm = 124.1,
        offset_min_mm = -44,
        offset_max_mm = 55,
        quality_tier = 'complete',
        source = 'verified-research [fixed:fitment-hardening]',
        updated_at = NOW()
      WHERE id = ${LOW_CONFIDENCE_ID}
    `;
    console.log(`    ✓ Updated\n`);
  } else {
    console.log(`    [DRY RUN] Would update\n`);
  }

  // Fix 2: Delete the garbage record with wrong bolt pattern
  console.log(`[2] Removing garbage record ${GARBAGE_ID}`);
  console.log(`    Reason: 5x120 bolt pattern is incorrect for GM HD trucks`);
  console.log(`    (5x120 is BMW/VW pattern, not GM HD which uses 8x180 for 2011+)`);
  
  if (!DRY_RUN) {
    await client`
      DELETE FROM vehicle_fitments
      WHERE id = ${GARBAGE_ID}
    `;
    console.log(`    ✓ Deleted\n`);
  } else {
    console.log(`    [DRY RUN] Would delete\n`);
  }

  // Verify the fix
  console.log(`${"=".repeat(60)}`);
  console.log(`Verification:`);
  console.log(`${"=".repeat(60)}\n`);
  
  const after = await client`
    SELECT 
      id, year, make, model, display_trim,
      bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
      source, quality_tier
    FROM vehicle_fitments
    WHERE year = 2011 
      AND make = 'Chevrolet' 
      AND model ILIKE '%Silverado%3500%'
    ORDER BY model, display_trim
  `;
  
  console.log(`Remaining records for 2011 Silverado 3500:\n`);
  for (const row of after) {
    const complete = row.center_bore_mm && row.offset_min_mm !== null;
    const status = complete ? "✓" : "⚠️";
    console.log(`${status} ${row.model} | ${row.display_trim}`);
    console.log(`   ${row.bolt_pattern} | CB: ${row.center_bore_mm}mm | Offset: ${row.offset_min_mm} to ${row.offset_max_mm}`);
    console.log(`   Source: ${row.source}\n`);
  }

  await client.end();
}

main().catch(console.error);
