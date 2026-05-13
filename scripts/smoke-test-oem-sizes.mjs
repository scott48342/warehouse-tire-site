#!/usr/bin/env node
/**
 * Smoke test oem_tire_sizes for specific vehicles
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const testCases = [
  // F-150 Lightning
  { year: 2022, make: "Ford", model: "F-150 Lightning" },
  { year: 2023, make: "Ford", model: "F-150 Lightning" },
  // GMC Envoy (just fixed)
  { year: 2006, make: "GMC", model: "Envoy" },
  { year: 2007, make: "GMC", model: "Envoy" },
  // Regular vehicles
  { year: 2024, make: "Ford", model: "F-150" },
  { year: 2024, make: "Toyota", model: "Tacoma" },
  { year: 2024, make: "Chevrolet", model: "Silverado 2500 HD" },
  { year: 2024, make: "Chevrolet", model: "Corvette" },
];

async function test() {
  console.log("🔍 Smoke testing oem_tire_sizes...\n");
  console.log("═══════════════════════════════════════════════════════════════");

  for (const tc of testCases) {
    const result = await pool.query(`
      SELECT 
        year, make, model, display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE year = $1 
        AND LOWER(make) = LOWER($2)
        AND (LOWER(model) = LOWER($3) OR LOWER(model) LIKE LOWER($3) || '%')
      ORDER BY display_trim
      LIMIT 3
    `, [tc.year, tc.make, tc.model]);

    const label = `${tc.year} ${tc.make} ${tc.model}`;
    
    if (result.rows.length === 0) {
      console.log(`❌ ${label}: NO RECORDS FOUND`);
    } else {
      const allValid = result.rows.every(r => {
        const val = r.oem_tire_sizes;
        return Array.isArray(val) && val.length > 0 && val.every(v => typeof v === "string");
      });
      
      const icon = allValid ? "✅" : "⚠️";
      console.log(`${icon} ${label} (${result.rows.length} trims)`);
      
      for (const row of result.rows) {
        const val = row.oem_tire_sizes;
        const isValid = Array.isArray(val) && val.every(v => typeof v === "string");
        const status = isValid ? "OK" : "BAD";
        console.log(`   [${status}] ${row.display_trim}: ${JSON.stringify(val)}`);
      }
    }
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════════════════");
  await pool.end();
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
