/**
 * Audit fitment database for incomplete records
 * Find vehicles missing: trim differentiation, tire sizes, wheel specs
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  console.log("Auditing vehicle fitments...\n");

  // Find vehicles with only 1 trim (and it's "base" or similar)
  const singleTrimVehicles = await db.execute(sql`
    SELECT year, make, model, 
           array_agg(modification_id) as trims,
           array_agg(display_trim) as trim_names,
           COUNT(*) as trim_count
    FROM vehicle_fitments
    GROUP BY year, make, model
    HAVING COUNT(*) = 1
    ORDER BY make, model, year DESC
    LIMIT 100
  `);

  console.log("=== VEHICLES WITH ONLY 1 TRIM (likely missing trim differentiation) ===");
  console.log(`Found ${singleTrimVehicles.rows.length} vehicles with single trim\n`);
  
  // Group by make/model for cleaner output
  const byMakeModel: Record<string, any[]> = {};
  for (const row of singleTrimVehicles.rows as any[]) {
    const key = `${row.make} ${row.model}`;
    if (!byMakeModel[key]) byMakeModel[key] = [];
    byMakeModel[key].push(row);
  }
  
  // Show first 20 unique make/models
  const uniqueVehicles = Object.entries(byMakeModel).slice(0, 30);
  for (const [vehicle, rows] of uniqueVehicles) {
    const years = rows.map((r: any) => r.year).sort().reverse();
    const yearRange = years.length > 3 
      ? `${years[years.length-1]}-${years[0]} (${years.length} years)` 
      : years.join(", ");
    console.log(`  ${vehicle}: ${yearRange}`);
  }

  // Find vehicles missing tire sizes
  console.log("\n\n=== VEHICLES MISSING OEM TIRE SIZES ===");
  const missingTires = await db.execute(sql`
    SELECT DISTINCT year, make, model, modification_id, display_trim,
           oem_tire_sizes, oem_wheel_sizes, quality_tier
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL 
       OR oem_tire_sizes::text = '[]'
       OR oem_tire_sizes::text = 'null'
    ORDER BY make, model, year DESC
    LIMIT 50
  `);

  console.log(`Found ${missingTires.rows.length} records missing tire sizes\n`);
  
  const missingTiresByVehicle: Record<string, any[]> = {};
  for (const row of missingTires.rows as any[]) {
    const key = `${row.make} ${row.model}`;
    if (!missingTiresByVehicle[key]) missingTiresByVehicle[key] = [];
    missingTiresByVehicle[key].push(row);
  }
  
  for (const [vehicle, rows] of Object.entries(missingTiresByVehicle).slice(0, 20)) {
    const years = [...new Set(rows.map((r: any) => r.year))].sort().reverse();
    const trims = [...new Set(rows.map((r: any) => r.display_trim))];
    console.log(`  ${vehicle}:`);
    console.log(`    Years: ${years.slice(0, 5).join(", ")}${years.length > 5 ? '...' : ''}`);
    console.log(`    Trims: ${trims.join(", ")}`);
  }

  // Find vehicles missing wheel specs
  console.log("\n\n=== VEHICLES MISSING WHEEL SPECS ===");
  const missingWheels = await db.execute(sql`
    SELECT DISTINCT year, make, model, modification_id, display_trim,
           oem_wheel_sizes, quality_tier
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NULL 
       OR oem_wheel_sizes::text = '[]'
       OR oem_wheel_sizes::text = 'null'
    ORDER BY make, model, year DESC
    LIMIT 50
  `);

  console.log(`Found ${missingWheels.rows.length} records missing wheel specs\n`);

  // Summary stats
  console.log("\n\n=== SUMMARY ===");
  const totalStats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT (year || make || model)) as unique_vehicles,
      SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_tires,
      SUM(CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_wheels,
      SUM(CASE WHEN quality_tier = 'complete' THEN 1 ELSE 0 END) as complete_tier,
      SUM(CASE WHEN quality_tier = 'partial' THEN 1 ELSE 0 END) as partial_tier,
      SUM(CASE WHEN quality_tier = 'unknown' OR quality_tier IS NULL THEN 1 ELSE 0 END) as unknown_tier
    FROM vehicle_fitments
  `);

  const stats = totalStats.rows[0] as any;
  console.log(`Total fitment records: ${stats.total_records}`);
  console.log(`Unique vehicles: ${stats.unique_vehicles}`);
  console.log(`Missing tire sizes: ${stats.missing_tires}`);
  console.log(`Missing wheel specs: ${stats.missing_wheels}`);
  console.log(`Quality tiers: complete=${stats.complete_tier}, partial=${stats.partial_tier}, unknown=${stats.unknown_tier}`);

  // Export problem vehicles for fixing
  console.log("\n\n=== PRIORITY VEHICLES TO FIX (popular makes, missing data) ===");
  const priorityVehicles = await db.execute(sql`
    WITH vehicle_stats AS (
      SELECT 
        make, model,
        MIN(year) as min_year,
        MAX(year) as max_year,
        COUNT(*) as trim_count,
        COUNT(DISTINCT year) as year_count,
        bool_and(oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]') as all_missing_tires,
        bool_and(oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]') as all_missing_wheels
      FROM vehicle_fitments
      WHERE make IN ('Ford', 'Chevrolet', 'Toyota', 'Honda', 'Ram', 'GMC', 'Jeep', 'Dodge', 'Nissan', 'BMW', 'Mercedes-Benz', 'Audi', 'Chrysler', 'Buick', 'Cadillac', 'Hyundai', 'Kia', 'Subaru', 'Volkswagen', 'Mazda')
      GROUP BY make, model
    )
    SELECT make, model, min_year, max_year, trim_count, year_count,
           all_missing_tires, all_missing_wheels
    FROM vehicle_stats
    WHERE (trim_count = year_count AND trim_count > 1)  -- Only 1 trim per year
       OR all_missing_tires 
       OR all_missing_wheels
    ORDER BY 
      CASE make 
        WHEN 'Ford' THEN 1 
        WHEN 'Chevrolet' THEN 2 
        WHEN 'Toyota' THEN 3 
        WHEN 'Honda' THEN 4 
        WHEN 'Ram' THEN 5 
        ELSE 10 
      END,
      model
    LIMIT 50
  `);

  for (const row of priorityVehicles.rows as any[]) {
    const issues: string[] = [];
    if (row.trim_count === row.year_count) issues.push("single-trim");
    if (row.all_missing_tires) issues.push("no-tires");
    if (row.all_missing_wheels) issues.push("no-wheels");
    console.log(`  ${row.make} ${row.model} (${row.min_year}-${row.max_year}): ${issues.join(", ")}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
