/**
 * Fitment Database Coverage Analysis Script
 * 
 * Run with: npx tsx scripts/check-fitment-coverage.ts
 */

import pg from "pg";

const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("\n═══════════════════════════════════════════════════════════════════════════════");
    console.log("FITMENT DATABASE COVERAGE ANALYSIS");
    console.log("═══════════════════════════════════════════════════════════════════════════════\n");

    // 1. Check Cadillac DeVille specifically
    console.log("🔍 Checking Cadillac DeVille...\n");
    
    const { rows: devilleRows } = await pool.query(`
      SELECT year, make, model, modification_id, display_trim, bolt_pattern
      FROM vehicle_fitments
      WHERE make ILIKE '%cadillac%' AND model ILIKE '%deville%'
      ORDER BY year DESC
    `);
    
    if (devilleRows.length === 0) {
      console.log("  ❌ No DeVille data in vehicle_fitments table\n");
    } else {
      console.log(`  ✅ Found ${devilleRows.length} DeVille records:`);
      for (const r of devilleRows.slice(0, 10)) {
        console.log(`     ${r.year} ${r.make} ${r.model} - ${r.display_trim || 'No trim'} (${r.bolt_pattern || 'No BP'})`);
      }
      console.log("");
    }

    // Check catalog_models for DeVille
    const { rows: catalogDeville } = await pool.query(`
      SELECT make_slug, slug, name, years
      FROM catalog_models
      WHERE slug ILIKE '%deville%' OR name ILIKE '%deville%'
    `);
    
    if (catalogDeville.length === 0) {
      console.log("  ❌ DeVille not in catalog_models table\n");
    } else {
      console.log("  📋 DeVille in catalog:");
      for (const r of catalogDeville) {
        console.log(`     ${r.make_slug} / ${r.name} - years: ${r.years?.join(", ") || "none"}`);
      }
      console.log("");
    }

    // 2. Get overall coverage stats
    console.log("📊 OVERALL DATABASE STATS\n");
    
    const { rows: overallStats } = await pool.query(`
      SELECT 
        COUNT(DISTINCT (year, make, model)) as unique_vehicles,
        COUNT(*) as total_fitments,
        COUNT(DISTINCT make) as unique_makes,
        MIN(year) as min_year,
        MAX(year) as max_year
      FROM vehicle_fitments
    `);
    
    const stats = overallStats[0];
    console.log(`  Unique vehicles (Y/M/M): ${stats.unique_vehicles}`);
    console.log(`  Total fitment records:   ${stats.total_fitments}`);
    console.log(`  Unique makes:            ${stats.unique_makes}`);
    console.log(`  Year range:              ${stats.min_year} - ${stats.max_year}`);
    console.log("");

    // 3. Makes with most data
    console.log("📈 TOP 20 MAKES BY COVERAGE\n");
    
    const { rows: makeStats } = await pool.query(`
      SELECT 
        make,
        COUNT(DISTINCT model) as models,
        COUNT(DISTINCT (year, make, model)) as vehicles,
        COUNT(*) as fitments
      FROM vehicle_fitments
      GROUP BY make
      ORDER BY vehicles DESC
      LIMIT 20
    `);
    
    for (const r of makeStats) {
      console.log(`  ${r.make.padEnd(20)} ${r.vehicles} vehicles, ${r.models} models, ${r.fitments} fitments`);
    }
    console.log("");

    // 4. Makes with NO or very few vehicles
    console.log("⚠️  MAKES WITH LOW COVERAGE (< 10 vehicles)\n");
    
    const { rows: lowCoverage } = await pool.query(`
      SELECT 
        make,
        COUNT(DISTINCT model) as models,
        COUNT(DISTINCT (year, make, model)) as vehicles
      FROM vehicle_fitments
      GROUP BY make
      HAVING COUNT(DISTINCT (year, make, model)) < 10
      ORDER BY vehicles ASC
    `);
    
    if (lowCoverage.length === 0) {
      console.log("  All makes have 10+ vehicles\n");
    } else {
      for (const r of lowCoverage) {
        console.log(`  ${r.make.padEnd(20)} ${r.vehicles} vehicles, ${r.models} models`);
      }
      console.log("");
    }

    // 5. Check if Cadillac models are in catalog
    console.log("🚗 CADILLAC MODELS IN CATALOG\n");
    
    const { rows: cadillacCatalog } = await pool.query(`
      SELECT slug, name, array_length(years, 1) as year_count
      FROM catalog_models
      WHERE make_slug = 'cadillac'
      ORDER BY name
    `);
    
    if (cadillacCatalog.length === 0) {
      console.log("  ❌ No Cadillac models in catalog\n");
    } else {
      for (const r of cadillacCatalog) {
        // Check if this model has fitment data
        const { rows: hasFitment } = await pool.query(`
          SELECT COUNT(*) as cnt FROM vehicle_fitments 
          WHERE make ILIKE 'cadillac' AND model ILIKE $1
        `, [r.slug.replace(/-/g, '%')]);
        
        const status = parseInt(hasFitment[0].cnt) > 0 ? "✅" : "❌";
        console.log(`  ${status} ${r.name.padEnd(25)} ${r.year_count || 0} years in catalog`);
      }
      console.log("");
    }

    // 6. Vehicles in catalog but NOT in fitment DB
    console.log("📋 VEHICLES IN CATALOG WITHOUT FITMENT DATA (sample)\n");
    
    const { rows: missingFitment } = await pool.query(`
      WITH catalog_expanded AS (
        SELECT 
          cm.make_slug,
          cm.slug as model_slug,
          cm.name as model_name,
          unnest(cm.years) as year
        FROM catalog_models cm
      )
      SELECT DISTINCT
        ce.make_slug,
        ce.model_name,
        COUNT(DISTINCT ce.year) as missing_years
      FROM catalog_expanded ce
      LEFT JOIN vehicle_fitments vf ON 
        vf.year = ce.year 
        AND LOWER(vf.make) = ce.make_slug
        AND (LOWER(vf.model) = ce.model_slug OR LOWER(vf.model) LIKE '%' || ce.model_slug || '%')
      WHERE vf.id IS NULL
      GROUP BY ce.make_slug, ce.model_name
      HAVING COUNT(DISTINCT ce.year) > 3
      ORDER BY missing_years DESC
      LIMIT 30
    `);
    
    for (const r of missingFitment) {
      console.log(`  ${r.make_slug.padEnd(15)} ${r.model_name.padEnd(25)} ${r.missing_years} years missing`);
    }
    console.log("");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
