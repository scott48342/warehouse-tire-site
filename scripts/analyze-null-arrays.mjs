#!/usr/bin/env node
/**
 * Analyze null-array oem_tire_sizes records
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function analyze() {
  // Get all null-array records
  const nullRecords = await pool.query(`
    SELECT 
      id, year, make, model, display_trim, 
      oem_tire_sizes, oem_wheel_sizes,
      bolt_pattern, center_bore_mm
    FROM vehicle_fitments
    WHERE oem_tire_sizes::text = '[null]'
    ORDER BY year DESC, display_trim
  `);

  console.log(`Found ${nullRecords.rows.length} null-array records:\n`);

  // Group by year/make/model
  const groups = {};
  for (const row of nullRecords.rows) {
    const key = `${row.year} ${row.make} ${row.model}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  for (const [key, records] of Object.entries(groups)) {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`${key} (${records.length} null records)`);
    console.log(`═══════════════════════════════════════════════════════════════`);

    // Check for sibling records with valid sizes
    const [year, make, ...modelParts] = key.split(' ');
    const model = modelParts.join(' ');
    
    const siblings = await pool.query(`
      SELECT DISTINCT display_trim, oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
        AND oem_tire_sizes IS NOT NULL 
        AND oem_tire_sizes::text != '[null]'
        AND oem_tire_sizes::text != '[]'
      ORDER BY display_trim
    `, [parseInt(year), make, model]);

    console.log(`\nNull-array trims:`);
    for (const rec of records) {
      console.log(`  - ${rec.display_trim}`);
      console.log(`    ID: ${rec.id}`);
      console.log(`    Wheel sizes: ${JSON.stringify(rec.oem_wheel_sizes)}`);
    }

    if (siblings.rows.length > 0) {
      console.log(`\nSibling trims with valid sizes:`);
      for (const sib of siblings.rows) {
        console.log(`  - ${sib.display_trim}: ${JSON.stringify(sib.oem_tire_sizes)}`);
      }
    } else {
      console.log(`\n⚠️  No sibling trims with valid tire sizes found`);
    }
  }

  await pool.end();
}

analyze().catch(err => {
  console.error("Analysis failed:", err);
  process.exit(1);
});
