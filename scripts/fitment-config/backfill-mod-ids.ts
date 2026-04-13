/**
 * Backfill modification_id values into vehicle_fitment_configurations
 * 
 * Our web_research records have modification_id: null but display_trim set.
 * We need to look up the corresponding modification_id from vehicle_fitments
 * and update the config records.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function backfillModIds(dryRun: boolean = true) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  BACKFILL MODIFICATION IDs ${dryRun ? "(DRY RUN)" : "(LIVE)"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Find all config rows with null modification_id
  const nullModConfigs = await pool.query(`
    SELECT id, year, make_key, model_key, display_trim
    FROM vehicle_fitment_configurations
    WHERE modification_id IS NULL AND display_trim IS NOT NULL
  `);

  console.log(`Found ${nullModConfigs.rows.length} config rows with null modification_id\n`);

  let updated = 0;
  let noMatch = 0;
  let multiMatch = 0;

  for (const config of nullModConfigs.rows) {
    // Look up modification_id from vehicle_fitments
    // Prefer non-manual IDs (those without 'manual_' prefix)
    const fitmentMatch = await pool.query(`
      SELECT modification_id, display_trim
      FROM vehicle_fitments
      WHERE year = $1 
        AND make = $2 
        AND model = $3 
        AND LOWER(display_trim) = LOWER($4)
      ORDER BY 
        CASE WHEN modification_id NOT LIKE 'manual_%' THEN 0 ELSE 1 END,
        modification_id
      LIMIT 1
    `, [config.year, config.make_key, config.model_key, config.display_trim]);

    if (fitmentMatch.rows.length === 0) {
      console.log(`  ⚠️ No match: ${config.year} ${config.make_key} ${config.model_key} ${config.display_trim}`);
      noMatch++;
      continue;
    }

    const modId = fitmentMatch.rows[0].modification_id;

    if (dryRun) {
      console.log(`  🔍 Would update: ${config.year} ${config.make_key} ${config.model_key} ${config.display_trim} → ${modId}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitment_configurations
        SET modification_id = $1
        WHERE id = $2
      `, [modId, config.id]);
      console.log(`  ✅ Updated: ${config.year} ${config.make_key} ${config.model_key} ${config.display_trim} → ${modId}`);
    }
    updated++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  ${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`  No match found: ${noMatch}`);

  if (dryRun) {
    console.log("\n  Run with --live to actually update records.");
  }

  await pool.end();
}

const args = process.argv.slice(2);
const isLive = args.includes("--live");

backfillModIds(!isLive).catch(console.error);
