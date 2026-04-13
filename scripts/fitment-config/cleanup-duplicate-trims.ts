/**
 * Clean up duplicate trim entries in vehicle_fitments
 * 
 * When the same year/make/model/trim has multiple modification_ids,
 * prefer non-manual entries (940e5c2264, reviewed_*) over manual_* ones.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function cleanup(dryRun: boolean = true) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  CLEANUP DUPLICATE TRIMS ${dryRun ? "(DRY RUN)" : "(LIVE)"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Find all year/make/model/trim combos that have multiple modification_ids
  const duplicates = await pool.query(`
    SELECT year, make, model, display_trim, COUNT(*) as cnt,
           array_agg(modification_id ORDER BY 
             CASE 
               WHEN modification_id NOT LIKE 'manual_%' AND modification_id NOT LIKE 'reviewed_%' THEN 0
               WHEN modification_id LIKE 'reviewed_%' THEN 1
               ELSE 2
             END
           ) as mod_ids
    FROM vehicle_fitments
    WHERE display_trim IS NOT NULL
    GROUP BY year, make, model, display_trim
    HAVING COUNT(*) > 1
    ORDER BY year DESC, make, model, display_trim
  `);

  console.log(`Found ${duplicates.rows.length} trim combos with duplicates\n`);

  let wouldDelete = 0;
  let deleted = 0;

  for (const row of duplicates.rows) {
    const modIds = row.mod_ids as string[];
    const keepId = modIds[0]; // First one is preferred (non-manual > reviewed > manual)
    const deleteIds = modIds.slice(1);

    // Only delete manual_* entries, keep reviewed_* and original IDs
    const toDelete = deleteIds.filter((id: string) => id.startsWith('manual_'));
    
    if (toDelete.length === 0) continue;

    console.log(`${row.year} ${row.make} ${row.model} ${row.display_trim}:`);
    console.log(`  Keep: ${keepId}`);
    console.log(`  Delete: ${toDelete.join(', ')}`);

    if (dryRun) {
      wouldDelete += toDelete.length;
    } else {
      for (const id of toDelete) {
        await pool.query(`
          DELETE FROM vehicle_fitments 
          WHERE year = $1 AND make = $2 AND model = $3 AND modification_id = $4
        `, [row.year, row.make, row.model, id]);
        deleted++;
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  ${dryRun ? "Would delete" : "Deleted"}: ${dryRun ? wouldDelete : deleted} duplicate manual entries`);

  if (dryRun) {
    console.log("\n  Run with --live to actually delete records.");
  }

  await pool.end();
}

const args = process.argv.slice(2);
const isLive = args.includes("--live");

cleanup(!isLive).catch(console.error);
