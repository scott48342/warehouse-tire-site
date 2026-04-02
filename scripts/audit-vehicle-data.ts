/**
 * Vehicle Data Audit Script
 * READ-ONLY audit of existing database tables for YMM system assessment
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const db = drizzle(pool);

async function runAudit() {
  console.log("=".repeat(80));
  console.log("VEHICLE DATA AUDIT - " + new Date().toISOString());
  console.log("=".repeat(80));

  // ============================================================================
  // 1. INVENTORY TABLES
  // ============================================================================
  console.log("\n## 1. INVENTORY TABLES\n");

  const tables = [
    { name: "catalog_makes", purpose: "Vehicle makes (internal data)" },
    { name: "catalog_models", purpose: "Models with valid years array" },
    { name: "vehicle_fitments", purpose: "Normalized fitment data (bolt pattern, hub bore, tire sizes)" },
    { name: "fitment_source_records", purpose: "Raw API responses stored for debugging" },
    { name: "fitment_overrides", purpose: "Manual corrections to fitment data" },
    { name: "modification_aliases", purpose: "Maps requested trims to canonical IDs" },
    { name: "catalog_sync_log", purpose: "Tracks when catalog data was synced" },
  ];

  for (const t of tables) {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${t.name}`));
      const count = (result as any).rows?.[0]?.count || 0;
      console.log(`| ${t.name.padEnd(25)} | ${String(count).padStart(8)} rows | ${t.purpose}`);
    } catch (e: any) {
      console.log(`| ${t.name.padEnd(25)} | ERROR: ${e.message?.slice(0, 50)}`);
    }
  }

  // ============================================================================
  // 2. DATA COVERAGE
  // ============================================================================
  console.log("\n## 2. DATA COVERAGE\n");

  // Catalog makes
  const makesResult = await db.execute(sql`SELECT COUNT(*) as count FROM catalog_makes`);
  const makesCount = (makesResult as any).rows?.[0]?.count || 0;
  console.log(`Total distinct makes (catalog_makes): ${makesCount}`);

  // Catalog models
  const modelsResult = await db.execute(sql`SELECT COUNT(*) as count FROM catalog_models`);
  const modelsCount = (modelsResult as any).rows?.[0]?.count || 0;
  console.log(`Total distinct models (catalog_models): ${modelsCount}`);

  // Year ranges in catalog_models
  try {
    const yearsRangeResult = await db.execute(sql`
      SELECT 
        MIN(year_val) as min_year, 
        MAX(year_val) as max_year 
      FROM catalog_models, LATERAL unnest(years) as year_val
    `);
    const minYear = (yearsRangeResult as any).rows?.[0]?.min_year || "N/A";
    const maxYear = (yearsRangeResult as any).rows?.[0]?.max_year || "N/A";
    console.log(`Year range (catalog_models): ${minYear} - ${maxYear}`);

    // Distinct YMM combinations
    const ymmResult = await db.execute(sql`
      SELECT COUNT(DISTINCT (make_slug, slug, year_val)) as count 
      FROM catalog_models, LATERAL unnest(years) as year_val
    `);
    const ymmCount = (ymmResult as any).rows?.[0]?.count || 0;
    console.log(`Total distinct Year+Make+Model combinations: ${ymmCount}`);
  } catch (e) {
    console.log(`Year data: Error - ${(e as any).message?.slice(0, 100)}`);
  }

  // vehicle_fitments stats
  console.log("\n### vehicle_fitments table stats:");
  try {
    const fitmentMakesResult = await db.execute(sql`SELECT COUNT(DISTINCT make) as count FROM vehicle_fitments`);
    const fitmentModelsResult = await db.execute(sql`SELECT COUNT(DISTINCT (make, model)) as count FROM vehicle_fitments`);
    const fitmentTrimsResult = await db.execute(sql`SELECT COUNT(DISTINCT (year, make, model, modification_id)) as count FROM vehicle_fitments`);
    const fitmentYearRange = await db.execute(sql`SELECT MIN(year) as min_year, MAX(year) as max_year FROM vehicle_fitments`);

    console.log(`  Distinct makes: ${(fitmentMakesResult as any).rows?.[0]?.count || 0}`);
    console.log(`  Distinct make+model: ${(fitmentModelsResult as any).rows?.[0]?.count || 0}`);
    console.log(`  Distinct YMM+trim: ${(fitmentTrimsResult as any).rows?.[0]?.count || 0}`);
    console.log(`  Year range: ${(fitmentYearRange as any).rows?.[0]?.min_year || "N/A"} - ${(fitmentYearRange as any).rows?.[0]?.max_year || "N/A"}`);
  } catch (e) {
    console.log(`  Error: ${(e as any).message?.slice(0, 100)}`);
  }

  // Top 20 makes
  console.log("\n### Top 20 Makes (by model count in catalog_models):");
  try {
    const topMakes = await db.execute(sql`
      SELECT make_slug, COUNT(*) as model_count 
      FROM catalog_models 
      GROUP BY make_slug 
      ORDER BY model_count DESC 
      LIMIT 20
    `);
    for (const row of (topMakes as any).rows || []) {
      console.log(`  ${row.make_slug}: ${row.model_count} models`);
    }
  } catch (e) {
    console.log(`  Error: ${(e as any).message?.slice(0, 100)}`);
  }

  // Top 20 models (by year coverage)
  console.log("\n### Top 20 Models (by year coverage):");
  try {
    const topModels = await db.execute(sql`
      SELECT make_slug, name, array_length(years, 1) as year_count
      FROM catalog_models 
      WHERE years IS NOT NULL AND array_length(years, 1) > 0
      ORDER BY array_length(years, 1) DESC 
      LIMIT 20
    `);
    for (const row of (topModels as any).rows || []) {
      console.log(`  ${row.make_slug} ${row.name}: ${row.year_count} years`);
    }
  } catch (e) {
    console.log(`  Error: ${(e as any).message?.slice(0, 100)}`);
  }

  // ============================================================================
  // 3. FITMENT DATA AVAILABILITY
  // ============================================================================
  console.log("\n## 3. FITMENT DATA AVAILABILITY\n");

  try {
    const fitmentStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(bolt_pattern) as has_bolt_pattern,
        COUNT(center_bore_mm) as has_hub_bore,
        COUNT(CASE WHEN jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_oem_tire_sizes,
        COUNT(CASE WHEN jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_oem_wheel_sizes,
        COUNT(offset_min_mm) as has_offset_range,
        COUNT(thread_size) as has_thread_size,
        COUNT(seat_type) as has_seat_type
      FROM vehicle_fitments
    `);
    
    const stats = (fitmentStats as any).rows?.[0];
    const total = parseInt(stats?.total || "0");
    
    console.log("| Field              | Has Data | % Coverage |");
    console.log("|--------------------|----------|------------|");
    console.log(`| Bolt Pattern       | ${String(stats?.has_bolt_pattern || 0).padStart(8)} | ${total > 0 ? ((stats?.has_bolt_pattern / total) * 100).toFixed(1) : 0}% |`);
    console.log(`| Hub Bore (mm)      | ${String(stats?.has_hub_bore || 0).padStart(8)} | ${total > 0 ? ((stats?.has_hub_bore / total) * 100).toFixed(1) : 0}% |`);
    console.log(`| OEM Tire Sizes     | ${String(stats?.has_oem_tire_sizes || 0).padStart(8)} | ${total > 0 ? ((stats?.has_oem_tire_sizes / total) * 100).toFixed(1) : 0}% |`);
    console.log(`| OEM Wheel Sizes    | ${String(stats?.has_oem_wheel_sizes || 0).padStart(8)} | ${total > 0 ? ((stats?.has_oem_wheel_sizes / total) * 100).toFixed(1) : 0}% |`);
    console.log(`| Offset Range       | ${String(stats?.has_offset_range || 0).padStart(8)} | ${total > 0 ? ((stats?.has_offset_range / total) * 100).toFixed(1) : 0}% |`);
    console.log(`| Thread Size        | ${String(stats?.has_thread_size || 0).padStart(8)} | ${total > 0 ? ((stats?.has_thread_size / total) * 100).toFixed(1) : 0}% |`);
    console.log(`| Seat Type          | ${String(stats?.has_seat_type || 0).padStart(8)} | ${total > 0 ? ((stats?.has_seat_type / total) * 100).toFixed(1) : 0}% |`);
  } catch (e) {
    console.log(`Error: ${(e as any).message?.slice(0, 100)}`);
  }

  // ============================================================================
  // 4. DATA QUALITY ISSUES
  // ============================================================================
  console.log("\n## 4. DATA QUALITY ISSUES\n");

  // Duplicate models check
  try {
    const dupModels = await db.execute(sql`
      SELECT make_slug, slug, COUNT(*) as count 
      FROM catalog_models 
      GROUP BY make_slug, slug 
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    console.log(`Duplicate models (same make+slug): ${(dupModels as any).rows?.length || 0}`);
    for (const row of (dupModels as any).rows || []) {
      console.log(`  - ${row.make_slug} ${row.slug}: ${row.count} duplicates`);
    }
  } catch (e) {
    console.log(`Duplicate check error: ${(e as any).message?.slice(0, 100)}`);
  }

  // Vehicles with no fitment data (check if common vehicles are missing)
  try {
    const commonVehiclesCheck = await db.execute(sql`
      SELECT cm.make_slug, cm.name as model_name, array_length(cm.years, 1) as year_count,
             COUNT(vf.id) as fitment_records
      FROM catalog_models cm
      LEFT JOIN vehicle_fitments vf ON LOWER(vf.make) = cm.make_slug AND LOWER(vf.model) = cm.slug
      WHERE cm.make_slug IN ('ford', 'chevrolet', 'toyota', 'honda', 'ram', 'gmc', 'jeep')
      GROUP BY cm.make_slug, cm.name, cm.years
      HAVING COUNT(vf.id) = 0
      ORDER BY array_length(cm.years, 1) DESC NULLS LAST
      LIMIT 15
    `);
    
    console.log(`\nCommon vehicles with NO fitment data:`);
    for (const row of (commonVehiclesCheck as any).rows || []) {
      console.log(`  - ${row.make_slug} ${row.model_name} (${row.year_count || 0} years in catalog, 0 fitment records)`);
    }
  } catch (e) {
    console.log(`Common vehicles check error: ${(e as any).message?.slice(0, 100)}`);
  }

  // Fitments with missing critical data
  try {
    const incompleteFitments = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM vehicle_fitments 
      WHERE bolt_pattern IS NULL OR center_bore_mm IS NULL
    `);
    console.log(`\nFitment records missing bolt pattern OR hub bore: ${(incompleteFitments as any).rows?.[0]?.count || 0}`);
  } catch (e) {
    console.log(`Incomplete fitments check error: ${(e as any).message?.slice(0, 100)}`);
  }

  // ============================================================================
  // 5. SAMPLE OUTPUT
  // ============================================================================
  console.log("\n## 5. SAMPLE VEHICLES FROM DATABASE\n");

  try {
    const samples = await db.execute(sql`
      SELECT 
        year, make, model, display_trim,
        bolt_pattern, center_bore_mm, 
        oem_tire_sizes, oem_wheel_sizes,
        offset_min_mm, offset_max_mm,
        thread_size, seat_type
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      ORDER BY year DESC, make, model
      LIMIT 10
    `);

    if ((samples as any).rows?.length === 0) {
      console.log("No vehicle fitment records with bolt pattern found.");
    } else {
      for (const row of (samples as any).rows || []) {
        console.log(`\n### ${row.year} ${row.make} ${row.model} ${row.display_trim || ""}`);
        console.log(`  Bolt Pattern: ${row.bolt_pattern || "N/A"}`);
        console.log(`  Hub Bore: ${row.center_bore_mm ? row.center_bore_mm + "mm" : "N/A"}`);
        console.log(`  Offset Range: ${row.offset_min_mm && row.offset_max_mm ? `${row.offset_min_mm} - ${row.offset_max_mm}mm` : "N/A"}`);
        console.log(`  Thread: ${row.thread_size || "N/A"}, Seat: ${row.seat_type || "N/A"}`);
        const tireSizes = row.oem_tire_sizes || [];
        console.log(`  OEM Tire Sizes: ${Array.isArray(tireSizes) && tireSizes.length > 0 ? tireSizes.slice(0, 3).join(", ") : "N/A"}`);
      }
    }
  } catch (e) {
    console.log(`Sample query error: ${(e as any).message?.slice(0, 100)}`);
  }

  // ============================================================================
  // 6. REUSABILITY ASSESSMENT
  // ============================================================================
  console.log("\n## 6. REUSABILITY ASSESSMENT\n");

  // Calculate coverage of common US makes
  const usMakes = ["ford", "chevrolet", "toyota", "honda", "ram", "gmc", "jeep", "dodge", "nissan", "hyundai", "kia", "subaru", "mazda", "volkswagen", "bmw", "mercedes-benz", "audi", "lexus", "acura", "buick", "cadillac", "chrysler", "lincoln"];
  
  try {
    const usCoverage = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT make_slug) as makes_covered,
        COUNT(*) as total_models
      FROM catalog_models 
      WHERE make_slug = ANY(${usMakes})
    `);
    
    const usResult = (usCoverage as any).rows?.[0];
    console.log(`Common US makes in catalog: ${usResult?.makes_covered || 0} / ${usMakes.length}`);
    console.log(`Models for those makes: ${usResult?.total_models || 0}`);

    // Fitment coverage for US makes
    const usFitmentCoverage = await db.execute(sql`
      SELECT COUNT(DISTINCT (year, make, model)) as ymm_with_fitment
      FROM vehicle_fitments 
      WHERE LOWER(make) = ANY(${usMakes})
    `);
    console.log(`YMM combinations with fitment data (US makes): ${(usFitmentCoverage as any).rows?.[0]?.ymm_with_fitment || 0}`);
  } catch (e) {
    console.log(`US coverage check error: ${(e as any).message?.slice(0, 100)}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("AUDIT COMPLETE");
  console.log("=".repeat(80));

  await pool.end();
}

runAudit().catch(console.error);
