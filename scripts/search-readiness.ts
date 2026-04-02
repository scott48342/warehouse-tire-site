import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SEARCH BEHAVIOR READINESS CHECK");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  const searchReady = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN bolt_pattern IS NOT NULL THEN 1 END) as has_bolt,
      COUNT(CASE WHEN center_bore_mm IS NOT NULL THEN 1 END) as has_cb,
      COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb THEN 1 END) as has_wheels,
      COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb THEN 1 END) as has_tires,
      COUNT(CASE WHEN thread_size IS NOT NULL THEN 1 END) as has_thread
    FROM vehicle_fitments
  `);
  
  const s = searchReady.rows[0] as any;
  console.log(`Total records:      ${s.total}`);
  console.log(`Has bolt pattern:   ${s.has_bolt} (${(s.has_bolt/s.total*100).toFixed(1)}%)`);
  console.log(`Has center bore:    ${s.has_cb} (${(s.has_cb/s.total*100).toFixed(1)}%)`);
  console.log(`Has wheel sizes:    ${s.has_wheels} (${(s.has_wheels/s.total*100).toFixed(1)}%)`);
  console.log(`Has tire sizes:     ${s.has_tires} (${(s.has_tires/s.total*100).toFixed(1)}%)`);
  console.log(`Has thread size:    ${s.has_thread} (${(s.has_thread/s.total*100).toFixed(1)}%)`);
  
  // Can run wheel search (needs bolt + CB + wheel sizes)
  const wheelSearchReady = await db.execute(sql`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL
      AND center_bore_mm IS NOT NULL
      AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb
  `);
  console.log(`\nWheel search ready: ${(wheelSearchReady.rows[0] as any).count} (${((wheelSearchReady.rows[0] as any).count/s.total*100).toFixed(1)}%)`);
  
  // Full fitment ready (all fields)
  const fullReady = await db.execute(sql`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL
      AND center_bore_mm IS NOT NULL
      AND thread_size IS NOT NULL
      AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb
      AND oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb
  `);
  console.log(`Full fitment ready: ${(fullReady.rows[0] as any).count} (${((fullReady.rows[0] as any).count/s.total*100).toFixed(1)}%)`);

  // Breakdown by issue type
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RECORDS THAT WOULD FAIL WHEEL SEARCH");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  const failWheelSearch = await db.execute(sql`
    SELECT 
      CASE 
        WHEN bolt_pattern IS NULL THEN 'missing_bolt_pattern'
        WHEN center_bore_mm IS NULL THEN 'missing_center_bore'
        WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb THEN 'missing_wheel_sizes'
        ELSE 'other'
      END as reason,
      COUNT(*) as count
    FROM vehicle_fitments
    WHERE bolt_pattern IS NULL
       OR center_bore_mm IS NULL
       OR oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  
  for (const r of failWheelSearch.rows as any[]) {
    console.log(`  ${r.reason}: ${r.count}`);
  }
  
  // Sample vehicles that would fail
  console.log("\nSAMPLE VEHICLES THAT WOULD FAIL WHEEL SEARCH:");
  const sampleFail = await db.execute(sql`
    SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, 
           CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb THEN 'none' ELSE 'has_data' END as wheels
    FROM vehicle_fitments
    WHERE bolt_pattern IS NULL
       OR center_bore_mm IS NULL
       OR oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]'::jsonb
    ORDER BY make, model
    LIMIT 20
  `);
  
  for (const r of sampleFail.rows as any[]) {
    console.log(`  ${r.year} ${r.make} ${r.model} - Bolt: ${r.bolt_pattern || 'MISSING'}, CB: ${r.center_bore_mm || 'MISSING'}, Wheels: ${r.wheels}`);
  }

  process.exit(0);
}

main().catch(console.error);
