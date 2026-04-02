import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AUDIT DETAIL BREAKDOWN");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Records missing thread_size
  console.log("MISSING THREAD_SIZE (339 records):");
  const noThread = await db.execute(sql`
    SELECT DISTINCT make, model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE thread_size IS NULL OR thread_size = ''
    GROUP BY make, model
    ORDER BY count DESC
    LIMIT 20
  `);
  for (const r of noThread.rows as any[]) {
    console.log(`  ${r.make} ${r.model}: ${r.count}`);
  }

  // Records missing wheel sizes
  console.log("\nMISSING/INVALID WHEEL SIZES (157 records):");
  const noWheels = await db.execute(sql`
    SELECT DISTINCT make, model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NULL 
       OR oem_wheel_sizes = '[]'::jsonb
    GROUP BY make, model
    ORDER BY count DESC
    LIMIT 20
  `);
  for (const r of noWheels.rows as any[]) {
    console.log(`  ${r.make} ${r.model}: ${r.count}`);
  }

  // Records missing tire sizes
  console.log("\nMISSING/INVALID TIRE SIZES (255 records):");
  const noTires = await db.execute(sql`
    SELECT DISTINCT make, model, COUNT(*) as count
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL 
       OR oem_tire_sizes = '[]'::jsonb
    GROUP BY make, model
    ORDER BY count DESC
    LIMIT 20
  `);
  for (const r of noTires.rows as any[]) {
    console.log(`  ${r.make} ${r.model}: ${r.count}`);
  }

  // Records with junk trims
  console.log("\nJUNK DISPLAY TRIMS:");
  const junkTrims = await db.execute(sql`
    SELECT year, make, model, display_trim, modification_id
    FROM vehicle_fitments
    WHERE display_trim IS NULL 
       OR display_trim = ''
       OR display_trim ~ '^\d+$'
       OR display_trim ~ '^[a-zA-Z]$'
    LIMIT 30
  `);
  for (const r of junkTrims.rows as any[]) {
    console.log(`  ${r.year} ${r.make} ${r.model}: "${r.display_trim}"`);
  }

  // Records missing offset data
  console.log("\nMISSING OFFSET DATA BY SOURCE:");
  const noOffset = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM vehicle_fitments
    WHERE offset_min_mm IS NULL AND offset_max_mm IS NULL
    GROUP BY source
    ORDER BY count DESC
  `);
  for (const r of noOffset.rows as any[]) {
    console.log(`  ${r.source}: ${r.count}`);
  }

  // Check unrecognized tire size formats
  console.log("\nSAMPLE UNRECOGNIZED TIRE SIZE FORMATS:");
  const weirdTires = await db.execute(sql`
    SELECT year, make, model, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb
      AND oem_tire_sizes::text NOT LIKE '%/%R%'
      AND oem_tire_sizes::text NOT LIKE '%/%r%'
    LIMIT 10
  `);
  for (const r of weirdTires.rows as any[]) {
    console.log(`  ${r.year} ${r.make} ${r.model}: ${JSON.stringify(r.oem_tire_sizes)}`);
  }

  // Check unrecognized wheel size formats
  console.log("\nSAMPLE UNRECOGNIZED WHEEL SIZE FORMATS:");
  const weirdWheels = await db.execute(sql`
    SELECT year, make, model, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes != '[]'::jsonb
      AND oem_wheel_sizes::text NOT LIKE '%diameter%'
      AND oem_wheel_sizes::text NOT LIKE '%x%'
      AND oem_wheel_sizes::text NOT LIKE '%X%'
    LIMIT 10
  `);
  for (const r of weirdWheels.rows as any[]) {
    console.log(`  ${r.year} ${r.make} ${r.model}: ${JSON.stringify(r.oem_wheel_sizes)}`);
  }

  // Overall health check
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SEARCH BEHAVIOR READINESS CHECK");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  const searchReady = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN bolt_pattern IS NOT NULL AND bolt_pattern != '' THEN 1 END) as has_bolt,
      COUNT(CASE WHEN center_bore_mm IS NOT NULL AND center_bore_mm != '' THEN 1 END) as has_cb,
      COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb THEN 1 END) as has_wheels,
      COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb THEN 1 END) as has_tires
    FROM vehicle_fitments
  `);
  
  const s = searchReady.rows[0] as any;
  console.log(`Total records:      ${s.total}`);
  console.log(`Has bolt pattern:   ${s.has_bolt} (${(s.has_bolt/s.total*100).toFixed(1)}%)`);
  console.log(`Has center bore:    ${s.has_cb} (${(s.has_cb/s.total*100).toFixed(1)}%)`);
  console.log(`Has wheel sizes:    ${s.has_wheels} (${(s.has_wheels/s.total*100).toFixed(1)}%)`);
  console.log(`Has tire sizes:     ${s.has_tires} (${(s.has_tires/s.total*100).toFixed(1)}%)`);
  
  // Can run wheel search (needs bolt + CB + wheel sizes)
  const wheelSearchReady = await db.execute(sql`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL AND bolt_pattern != ''
      AND center_bore_mm IS NOT NULL AND center_bore_mm != ''
      AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb
  `);
  console.log(`\nWheel search ready: ${(wheelSearchReady.rows[0] as any).count} (${((wheelSearchReady.rows[0] as any).count/s.total*100).toFixed(1)}%)`);

  process.exit(0);
}

main().catch(console.error);
