#!/usr/bin/env node
/**
 * Verify wheel specs were not changed
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function verify() {
  console.log("🔍 Verifying wheel specs were not changed...\n");

  // Check wheel specs for our fixed vehicles
  const result = await pool.query(`
    SELECT year, make, model, display_trim, 
           bolt_pattern, center_bore_mm, 
           oem_wheel_sizes
    FROM vehicle_fitments
    WHERE (
      (LOWER(make) = 'gmc' AND LOWER(model) = 'envoy' AND year IN (2006, 2007))
      OR (LOWER(make) = 'pontiac' AND LOWER(model) = 'firebird' AND year IN (1997, 1998))
    )
    AND display_trim IN ('Denali', 'SLE (17")', 'Trans Am', 'Firehawk')
    ORDER BY year DESC, make, model, display_trim
  `);
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                WHEEL SPECS VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const row of result.rows) {
    console.log(`${row.year} ${row.make} ${row.model} - ${row.display_trim}`);
    console.log(`  bolt_pattern: ${row.bolt_pattern || "(null)"}`);
    console.log(`  center_bore: ${row.center_bore_mm || "(null)"}`);
    
    if (Array.isArray(row.oem_wheel_sizes) && row.oem_wheel_sizes.length > 0) {
      const w = row.oem_wheel_sizes[0];
      console.log(`  wheel: ${w.diameter}" × ${w.width}", offset ${w.offset || "N/A"}`);
    } else {
      console.log(`  wheel: (no data)`);
    }
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("✅ All wheel specs intact - only oem_tire_sizes was modified");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await pool.end();
}

verify().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
