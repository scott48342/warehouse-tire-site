/**
 * Backfill confidence tags based on data completeness
 * 
 * HIGH: All critical specs present + from verified template/OEM source
 * MEDIUM: Most specs present but some gaps or unverified source
 * LOW: Missing critical specs or problematic data
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env.local") });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Backfill Confidence Tags`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`${"=".repeat(60)}\n`);

  // Use a single UPDATE with CASE to handle all tagging
  // This avoids the scalar/array issue by computing scores first
  
  console.log("[1] Computing confidence scores and updating tags...\n");
  
  const updateSql = `
    WITH scored AS (
      SELECT 
        id,
        -- Score components
        CASE WHEN bolt_pattern IS NOT NULL THEN 1 ELSE 0 END as has_bolt,
        CASE WHEN center_bore_mm IS NOT NULL THEN 1 ELSE 0 END as has_cb,
        CASE WHEN offset_min_mm IS NOT NULL AND offset_max_mm IS NOT NULL THEN 1 ELSE 0 END as has_offset,
        CASE 
          WHEN oem_wheel_sizes IS NOT NULL 
           AND oem_wheel_sizes::text != 'null' 
           AND oem_wheel_sizes::text != '[]'
           AND LENGTH(oem_wheel_sizes::text) > 2
          THEN 1 ELSE 0 
        END as has_wheels,
        CASE 
          WHEN oem_tire_sizes IS NOT NULL 
           AND oem_tire_sizes::text != 'null' 
           AND oem_tire_sizes::text != '[]'
           AND LENGTH(oem_tire_sizes::text) > 2
          THEN 1 ELSE 0 
        END as has_tires,
        CASE 
          WHEN source ILIKE '%template%' 
            OR source ILIKE '%oem%' 
            OR source ILIKE '%verified%'
            OR source ILIKE '%manual_import%'
            OR source ILIKE '%api_import%'
          THEN 1 ELSE 0 
        END as verified_source
      FROM vehicle_fitments
    ),
    tagged AS (
      SELECT 
        id,
        CASE
          -- HIGH: All specs + verified source
          WHEN has_bolt = 1 AND has_cb = 1 AND has_offset = 1 
               AND has_wheels = 1 AND has_tires = 1 AND verified_source = 1
          THEN 'HIGH'
          -- LOW: Missing bolt pattern
          WHEN has_bolt = 0 THEN 'LOW'
          -- LOW: Missing both center bore AND offset
          WHEN has_cb = 0 AND has_offset = 0 THEN 'LOW'
          -- LOW: No wheel sizes AND no tire sizes
          WHEN has_wheels = 0 AND has_tires = 0 THEN 'LOW'
          -- MEDIUM: Everything else
          ELSE 'MEDIUM'
        END as new_tag
      FROM scored
    )
    UPDATE vehicle_fitments vf
    SET 
      confidence_tag = t.new_tag,
      updated_at = NOW()
    FROM tagged t
    WHERE vf.id = t.id
      AND vf.confidence_tag != t.new_tag
  `;
  
  if (!DRY_RUN) {
    const result = await client.unsafe(updateSql);
    console.log(`✓ Updated ${result.count} records\n`);
  } else {
    // For dry run, just count what would change
    const countSql = `
      WITH scored AS (
        SELECT 
          id,
          CASE WHEN bolt_pattern IS NOT NULL THEN 1 ELSE 0 END as has_bolt,
          CASE WHEN center_bore_mm IS NOT NULL THEN 1 ELSE 0 END as has_cb,
          CASE WHEN offset_min_mm IS NOT NULL AND offset_max_mm IS NOT NULL THEN 1 ELSE 0 END as has_offset,
          CASE 
            WHEN oem_wheel_sizes IS NOT NULL 
             AND oem_wheel_sizes::text != 'null' 
             AND oem_wheel_sizes::text != '[]'
             AND LENGTH(oem_wheel_sizes::text) > 2
            THEN 1 ELSE 0 
          END as has_wheels,
          CASE 
            WHEN oem_tire_sizes IS NOT NULL 
             AND oem_tire_sizes::text != 'null' 
             AND oem_tire_sizes::text != '[]'
             AND LENGTH(oem_tire_sizes::text) > 2
            THEN 1 ELSE 0 
          END as has_tires,
          CASE 
            WHEN source ILIKE '%template%' 
              OR source ILIKE '%oem%' 
              OR source ILIKE '%verified%'
              OR source ILIKE '%manual_import%'
              OR source ILIKE '%api_import%'
            THEN 1 ELSE 0 
          END as verified_source
        FROM vehicle_fitments
      ),
      tagged AS (
        SELECT 
          id,
          CASE
            WHEN has_bolt = 1 AND has_cb = 1 AND has_offset = 1 
                 AND has_wheels = 1 AND has_tires = 1 AND verified_source = 1
            THEN 'HIGH'
            WHEN has_bolt = 0 THEN 'LOW'
            WHEN has_cb = 0 AND has_offset = 0 THEN 'LOW'
            WHEN has_wheels = 0 AND has_tires = 0 THEN 'LOW'
            ELSE 'MEDIUM'
          END as new_tag
        FROM scored
      )
      SELECT new_tag, COUNT(*) as count 
      FROM tagged 
      GROUP BY new_tag 
      ORDER BY new_tag
    `;
    const preview = await client.unsafe(countSql);
    console.log("[DRY RUN] Would result in:\n");
    for (const row of preview) {
      console.log(`  ${row.new_tag}: ${row.count}`);
    }
    console.log();
  }

  // Final stats
  console.log(`${"=".repeat(60)}`);
  console.log(`Final Distribution:`);
  console.log(`${"=".repeat(60)}\n`);
  
  const stats = await client`
    SELECT confidence_tag, COUNT(*) as count 
    FROM vehicle_fitments 
    GROUP BY confidence_tag
    ORDER BY 
      CASE confidence_tag 
        WHEN 'HIGH' THEN 1 
        WHEN 'MEDIUM' THEN 2 
        WHEN 'LOW' THEN 3 
        ELSE 4 
      END
  `;
  
  let total = 0;
  for (const row of stats) {
    const pct = ((parseInt(row.count) / 37180) * 100).toFixed(1);
    console.log(`  ${row.confidence_tag}: ${row.count} (${pct}%)`);
    total += parseInt(row.count);
  }
  console.log(`  ─────────────`);
  console.log(`  Total: ${total}`);

  // Sample LOW confidence records for review
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Sample LOW Confidence Records:`);
  console.log(`${"=".repeat(60)}\n`);
  
  // First check if there are LOW records
  const lowCheck = await client`
    SELECT COUNT(*) as count FROM vehicle_fitments WHERE confidence_tag = 'LOW'
  `;
  
  if (parseInt(lowCheck[0].count) > 0) {
    const lowSamples = await client`
      SELECT 
        year, make, model, display_trim,
        bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
        oem_wheel_sizes IS NOT NULL as has_wheels,
        oem_tire_sizes IS NOT NULL as has_tires,
        source
      FROM vehicle_fitments
      WHERE confidence_tag = 'LOW'
      ORDER BY year DESC, make, model
      LIMIT 10
    `;
    
    for (const row of lowSamples) {
      console.log(`${row.year} ${row.make} ${row.model} ${row.display_trim}`);
      console.log(`  Bolt: ${row.bolt_pattern || 'NULL'} | CB: ${row.center_bore_mm || 'NULL'} | Offset: ${row.offset_min_mm || 'NULL'}-${row.offset_max_mm || 'NULL'}`);
      console.log(`  Wheels: ${row.has_wheels} | Tires: ${row.has_tires} | Source: ${row.source}\n`);
    }
  } else {
    console.log("  No LOW confidence records found.\n");
  }

  await client.end();
}

main().catch(console.error);
