/**
 * Add approved package choices for 2020 Ram 1500 Big Horn
 * Same configuration as 2024 - verified from OEM fitment data:
 * - 18" Standard Big Horn — 275/65R18
 * - 20" Sport / Night / Off-Road Package — 275/55R20
 */

import { getDbPool } from "../src/lib/db/pool";

async function addChoices() {
  const pool = getDbPool();
  if (!pool) {
    console.error("No database pool available");
    process.exit(1);
  }

  const choices = [
    {
      year: 2020,
      make: "Ram",
      model: "1500",
      trim: "Big Horn",
      package_label: '18" Standard Big Horn',
      package_description: null,
      wheel_diameter: 18,
      rim_width: null,
      tire_size: "275/65R18",
      tire_size_rear: null,
      load_rating: null,
      source: "verified_oem",
      confidence: "high",
      status: "approved",
      display_order: 1,
      notes: "Added 2026-05-05 - same as 2024 Big Horn",
    },
    {
      year: 2020,
      make: "Ram",
      model: "1500",
      trim: "Big Horn",
      package_label: '20" Sport / Night / Off-Road Package',
      package_description: null,
      wheel_diameter: 20,
      rim_width: null,
      tire_size: "275/55R20",
      tire_size_rear: null,
      load_rating: null,
      source: "verified_oem",
      confidence: "high",
      status: "approved",
      display_order: 2,
      notes: "Added 2026-05-05 - same as 2024 Big Horn",
    },
  ];

  console.log("Adding 2020 Ram 1500 Big Horn package choices...\n");

  for (const c of choices) {
    try {
      const result = await pool.query(`
        INSERT INTO oem_package_choices (
          year, make, model, trim, package_label, package_description,
          wheel_diameter, rim_width, tire_size, tire_size_rear, load_rating,
          source, confidence, status, display_order, notes,
          reviewed_at, reviewed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $17)
        ON CONFLICT (year, make, model, trim, wheel_diameter) 
        DO UPDATE SET
          package_label = EXCLUDED.package_label,
          tire_size = EXCLUDED.tire_size,
          status = 'approved',
          reviewed_at = NOW(),
          reviewed_by = EXCLUDED.reviewed_by
        RETURNING id, package_label, status
      `, [
        c.year, c.make, c.model, c.trim, c.package_label, c.package_description,
        c.wheel_diameter, c.rim_width, c.tire_size, c.tire_size_rear, c.load_rating,
        c.source, c.confidence, c.status, c.display_order, c.notes, "clawd-bot"
      ]);

      const row = result.rows[0];
      console.log(`✅ ${row.package_label} → ${row.status} (id: ${row.id})`);
    } catch (error: any) {
      console.error(`❌ Failed to insert ${c.package_label}:`, error.message);
    }
  }

  // Verify
  console.log("\nVerifying...");
  const verify = await pool.query(`
    SELECT package_label, wheel_diameter, tire_size, status
    FROM oem_package_choices
    WHERE year = 2020 AND make = 'Ram' AND model = '1500' AND trim = 'Big Horn'
    ORDER BY display_order
  `);

  console.log("\n2020 Ram 1500 Big Horn package choices:");
  for (const row of verify.rows) {
    console.log(`  ${row.wheel_diameter}" - ${row.package_label} (${row.tire_size}) [${row.status}]`);
  }

  await pool.end();
  console.log("\nDone!");
  process.exit(0);
}

addChoices().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
