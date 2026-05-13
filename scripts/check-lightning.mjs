#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE LOWER(model) LIKE '%lightning%'
       OR LOWER(model) LIKE '%f-150 lightning%'
    ORDER BY year DESC, display_trim
  `);
  
  console.log(`Found ${result.rows.length} F-150 Lightning records:\n`);
  for (const row of result.rows) {
    console.log(`${row.year} ${row.make} ${row.model} - ${row.display_trim}`);
    console.log(`  oem_tire_sizes: ${JSON.stringify(row.oem_tire_sizes)}`);
    console.log(`  type: ${typeof row.oem_tire_sizes}, isArray: ${Array.isArray(row.oem_tire_sizes)}`);
    console.log("");
  }
  
  await pool.end();
}

check();
