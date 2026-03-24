#!/usr/bin/env npx tsx

/**
 * Query the fitment database to show all fields populated for sample vehicles
 */

import * as dotenv from "dotenv";
import pg from "pg";

// Load .env.local
dotenv.config({ path: ".env.local" });

const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    max: 3,
  });

  try {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("           FITMENT DATABASE - FULLY POPULATED VEHICLES");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Query for vehicles that have complete data (bolt_pattern, wheel sizes, tire sizes)
    const sampleResult = await pool.query(`
      SELECT * FROM vehicle_fitments 
      WHERE bolt_pattern IS NOT NULL 
        AND jsonb_array_length(oem_wheel_sizes) > 0
        AND jsonb_array_length(oem_tire_sizes) > 0
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log(`Found ${sampleResult.rows.length} fully populated fitment records\n`);

    const results: any[] = [];

    for (const row of sampleResult.rows) {
      console.log(`─────────────────────────────────────────────────────────────────`);
      console.log(`${row.year} ${row.make} ${row.model}`);
      console.log(`─────────────────────────────────────────────────────────────────`);
      
      // Grouped output for readability
      console.log(`\n  IDENTIFICATION:`);
      console.log(`    Modification ID: ${row.modification_id}`);
      console.log(`    Raw Trim: ${row.raw_trim || '(none)'}`);
      console.log(`    Display Trim: ${row.display_trim || '(none)'}`);
      console.log(`    Submodel: ${row.submodel || '(none)'}`);
      
      console.log(`\n  BOLT & HUB:`);
      console.log(`    Bolt Pattern: ${row.bolt_pattern}`);
      console.log(`    Center Bore: ${row.center_bore_mm}mm`);
      console.log(`    Thread Size: ${row.thread_size || '(none)'}`);
      console.log(`    Seat Type: ${row.seat_type || '(none)'}`);
      
      console.log(`\n  OFFSET RANGE:`);
      console.log(`    Min Offset: ${row.offset_min_mm !== null ? row.offset_min_mm + 'mm' : '(none)'}`);
      console.log(`    Max Offset: ${row.offset_max_mm !== null ? row.offset_max_mm + 'mm' : '(none)'}`);
      
      console.log(`\n  OEM WHEEL SIZES (${row.oem_wheel_sizes?.length || 0}):`);
      const wheelSizes = row.oem_wheel_sizes || [];
      for (const ws of wheelSizes.slice(0, 5)) { // Show first 5
        const stockLabel = ws.isStock ? '✓ stock' : 'plus-size';
        const axleLabel = ws.axle !== 'front' ? ` [${ws.axle}]` : '';
        console.log(`    • ${ws.diameter}" x ${ws.width}" ET${ws.offset} → ${ws.tireSize}${axleLabel} [${stockLabel}]`);
      }
      if (wheelSizes.length > 5) {
        console.log(`    ... and ${wheelSizes.length - 5} more`);
      }
      
      console.log(`\n  OEM TIRE SIZES (${row.oem_tire_sizes?.length || 0}):`);
      const tireSizes = row.oem_tire_sizes || [];
      console.log(`    ${tireSizes.join(', ')}`);
      
      console.log(`\n  METADATA:`);
      console.log(`    Source: ${row.source}`);
      console.log(`    Created: ${row.created_at}`);
      console.log(`    Updated: ${row.updated_at}`);
      console.log(`    Last Verified: ${row.last_verified_at || '(never)'}`);
      
      console.log('\n');
      
      results.push(row);
    }

    // Also get stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(bolt_pattern) as with_bolt_pattern,
        COUNT(center_bore_mm) as with_center_bore,
        COUNT(thread_size) as with_thread_size,
        COUNT(seat_type) as with_seat_type,
        COUNT(CASE WHEN jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as with_wheel_sizes,
        COUNT(CASE WHEN jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as with_tire_sizes
      FROM vehicle_fitments
    `);
    
    const stats = statsResult.rows[0];
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`                    DATABASE STATISTICS`);
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`  Total Records: ${stats.total}`);
    console.log(`  With Bolt Pattern: ${stats.with_bolt_pattern} (${(stats.with_bolt_pattern / stats.total * 100).toFixed(1)}%)`);
    console.log(`  With Center Bore: ${stats.with_center_bore} (${(stats.with_center_bore / stats.total * 100).toFixed(1)}%)`);
    console.log(`  With Thread Size: ${stats.with_thread_size} (${(stats.with_thread_size / stats.total * 100).toFixed(1)}%)`);
    console.log(`  With Seat Type: ${stats.with_seat_type} (${(stats.with_seat_type / stats.total * 100).toFixed(1)}%)`);
    console.log(`  With Wheel Sizes: ${stats.with_wheel_sizes} (${(stats.with_wheel_sizes / stats.total * 100).toFixed(1)}%)`);
    console.log(`  With Tire Sizes: ${stats.with_tire_sizes} (${(stats.with_tire_sizes / stats.total * 100).toFixed(1)}%)`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    // Write full JSON results
    const output = {
      generatedAt: new Date().toISOString(),
      totalVehicles: results.length,
      databaseStats: stats,
      vehicles: results,
    };

    const fs = await import("fs");
    fs.writeFileSync("fitment-db-sample.json", JSON.stringify(output, null, 2));
    
    console.log(`Full JSON data written to: fitment-db-sample.json\n`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
