/**
 * Vehicle Data Audit - Understanding the data sources
 * Run with: npx tsx scripts/vehicle-data-audit.ts
 */

import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error("Missing DATABASE_URL or POSTGRES_URL");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  try {
    console.log("═══════════════════════════════════════════════════════════════════════════════");
    console.log("                    VEHICLE DATA AUDIT");
    console.log("═══════════════════════════════════════════════════════════════════════════════\n");

    // 1. catalog_makes
    console.log("1. CATALOG_MAKES (cached from Wheel-Size API)");
    console.log("───────────────────────────────────────────────────────────────────────────────");
    const { rows: makesCount } = await pool.query(`SELECT COUNT(*) as count FROM catalog_makes`);
    console.log(`Total makes: ${makesCount[0].count}`);
    
    const { rows: sampleMakes } = await pool.query(`SELECT slug, name FROM catalog_makes ORDER BY name LIMIT 10`);
    console.log("Sample:", sampleMakes.map(m => m.name).join(", "));
    console.log();

    // 2. catalog_models
    console.log("2. CATALOG_MODELS (cached from Wheel-Size API)");
    console.log("───────────────────────────────────────────────────────────────────────────────");
    const { rows: modelsCount } = await pool.query(`SELECT COUNT(*) as count FROM catalog_models`);
    const { rows: makesWithModels } = await pool.query(`SELECT COUNT(DISTINCT make_slug) as count FROM catalog_models`);
    const { rows: yearsRange } = await pool.query(`
      SELECT 
        MIN(year_val) as min_year,
        MAX(year_val) as max_year
      FROM catalog_models, unnest(years) as year_val
    `);
    console.log(`Total models: ${modelsCount[0].count}`);
    console.log(`Makes with models cached: ${makesWithModels[0].count}`);
    console.log(`Year range: ${yearsRange[0]?.min_year || 'N/A'} - ${yearsRange[0]?.max_year || 'N/A'}`);
    
    const { rows: modelsByMake } = await pool.query(`
      SELECT make_slug, COUNT(*) as count 
      FROM catalog_models 
      GROUP BY make_slug 
      ORDER BY count DESC 
      LIMIT 10
    `);
    console.log("\nTop makes by model count:");
    modelsByMake.forEach(m => console.log(`  ${m.make_slug}: ${m.count} models`));
    console.log();

    // 3. vehicle_fitments (full fitment data)
    console.log("3. VEHICLE_FITMENTS (imported with full fitment data)");
    console.log("───────────────────────────────────────────────────────────────────────────────");
    const { rows: fitmentCount } = await pool.query(`SELECT COUNT(*) as count FROM vehicle_fitments`);
    const { rows: fitmentYears } = await pool.query(`SELECT COUNT(DISTINCT year) as count FROM vehicle_fitments`);
    const { rows: fitmentMakes } = await pool.query(`SELECT COUNT(DISTINCT make) as count FROM vehicle_fitments`);
    const { rows: fitmentModels } = await pool.query(`SELECT COUNT(DISTINCT model) as count FROM vehicle_fitments`);
    const { rows: fitmentTrims } = await pool.query(`SELECT COUNT(DISTINCT modification_id) as count FROM vehicle_fitments`);
    
    console.log(`Total fitment records: ${fitmentCount[0].count}`);
    console.log(`Unique years: ${fitmentYears[0].count}`);
    console.log(`Unique makes: ${fitmentMakes[0].count}`);
    console.log(`Unique models: ${fitmentModels[0].count}`);
    console.log(`Unique modification_ids: ${fitmentTrims[0].count}`);
    
    const { rows: fitmentByMake } = await pool.query(`
      SELECT make, COUNT(*) as count 
      FROM vehicle_fitments 
      GROUP BY make 
      ORDER BY count DESC
    `);
    console.log("\nFitment records by make:");
    fitmentByMake.forEach(m => console.log(`  ${m.make}: ${m.count}`));
    console.log();

    // 4. modification_aliases
    console.log("4. MODIFICATION_ALIASES (mapping user selections to canonical IDs)");
    console.log("───────────────────────────────────────────────────────────────────────────────");
    try {
      const { rows: aliasCount } = await pool.query(`SELECT COUNT(*) as count FROM modification_aliases`);
      console.log(`Total aliases: ${aliasCount[0].count}`);
    } catch {
      console.log("Table not created yet (0 aliases)");
    }
    console.log();

    // 5. Summary
    console.log("═══════════════════════════════════════════════════════════════════════════════");
    console.log("                    SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════════════════════\n");
    
    console.log("DATA SOURCE ARCHITECTURE:");
    console.log("┌─────────────────────────────────────────────────────────────────────────────┐");
    console.log("│ UI STEP          │ SOURCE                     │ RECORDS                   │");
    console.log("├─────────────────────────────────────────────────────────────────────────────┤");
    console.log(`│ Select Make      │ Static list (hardcoded)    │ ~44 makes                  │`);
    console.log(`│ Select Model     │ catalog_models (DB cache)  │ ${modelsCount[0].count.toString().padEnd(5)} models              │`);
    console.log(`│ Select Year      │ catalog_models.years[]     │ (per model)                │`);
    console.log(`│ Select Trim      │ Wheel-Size API (LIVE)      │ (per Y/M/M, not cached)    │`);
    console.log(`│ Fitment Lookup   │ vehicle_fitments           │ ${fitmentCount[0].count.toString().padEnd(5)} records (LIMITED!)   │`);
    console.log("└─────────────────────────────────────────────────────────────────────────────┘");
    
    console.log("\n⚠️  KEY FINDING:");
    console.log(`   The vehicle_fitments table (${fitmentCount[0].count} records) is NOT the YMM/trim lookup source.`);
    console.log("   It only contains vehicles that have been IMPORTED with full wheel fitment data.");
    console.log("   The UI uses Wheel-Size API for full vehicle lookup coverage.");
    console.log("\n   When a user selects a vehicle NOT in vehicle_fitments:");
    console.log("   → The fitment profile is fetched from Wheel-Size API on-demand");
    console.log("   → Then optionally imported to vehicle_fitments for caching");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
