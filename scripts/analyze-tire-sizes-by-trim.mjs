/**
 * Analyze tire size variance by trim
 */
import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function analyze() {
  const client = await pool.connect();
  
  try {
    console.log('=== TIRE SIZE BY TRIM ANALYSIS ===\n');
    
    // Check Honda Accord - popular vehicle with multiple trims
    console.log('--- 2024 Honda Accord ---');
    const accord = await client.query(`
      SELECT display_trim, oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE year = 2024 AND LOWER(make) = 'honda' AND LOWER(model) = 'accord'
        AND display_trim NOT LIKE '%,%'
      ORDER BY display_trim
    `);
    for (const r of accord.rows) {
      console.log(`  ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)}`);
    }
    
    // Check Ford F-150
    console.log('\n--- 2024 Ford F-150 ---');
    const f150 = await client.query(`
      SELECT display_trim, oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE year = 2024 AND LOWER(make) = 'ford' AND LOWER(model) = 'f-150'
        AND display_trim NOT LIKE '%,%'
      ORDER BY display_trim
    `);
    for (const r of f150.rows) {
      console.log(`  ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)?.slice(0, 80)}`);
    }
    
    // Check vehicles where different trims have DIFFERENT tire sizes
    console.log('\n--- VEHICLES WITH TRIM-SPECIFIC TIRE SIZES ---');
    const trimTireDiff = await client.query(`
      WITH trim_tires AS (
        SELECT year, make, model, display_trim, oem_tire_sizes::text as tires
        FROM vehicle_fitments
        WHERE display_trim NOT LIKE '%,%'
          AND oem_tire_sizes IS NOT NULL 
          AND oem_tire_sizes != '[]'::jsonb
          AND year >= 2022
      ),
      vehicle_variance AS (
        SELECT year, make, model,
               COUNT(DISTINCT tires) as unique_tire_configs,
               array_agg(DISTINCT display_trim) as trims
        FROM trim_tires
        GROUP BY year, make, model
      )
      SELECT year, make, model, unique_tire_configs, trims
      FROM vehicle_variance
      WHERE unique_tire_configs > 1
      ORDER BY unique_tire_configs DESC
      LIMIT 30
    `);
    
    console.log(`Found ${trimTireDiff.rows.length} vehicles with different tire configs per trim`);
    for (const v of trimTireDiff.rows.slice(0, 15)) {
      console.log(`  ${v.year} ${v.make} ${v.model}: ${v.unique_tire_configs} configs, trims: ${v.trims?.slice(0,5).join(', ')}`);
    }
    
    // Check how many Base-only vehicles actually have tire data
    console.log('\n--- BASE-ONLY VEHICLES WITH TIRE DATA ---');
    const baseWithTires = await client.query(`
      WITH vehicle_trims AS (
        SELECT year, make, model, 
               array_agg(DISTINCT display_trim) FILTER (WHERE display_trim NOT LIKE '%,%') as individual_trims,
               bool_or(oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb) as has_tires
        FROM vehicle_fitments
        GROUP BY year, make, model
      )
      SELECT 
        COUNT(*) FILTER (WHERE array_length(individual_trims, 1) = 1 AND individual_trims[1] IN ('Base', 'Standard') AND has_tires) as base_with_tires,
        COUNT(*) FILTER (WHERE array_length(individual_trims, 1) = 1 AND individual_trims[1] IN ('Base', 'Standard') AND NOT has_tires) as base_no_tires,
        COUNT(*) FILTER (WHERE array_length(individual_trims, 1) > 1 AND has_tires) as multi_trim_with_tires
      FROM vehicle_trims
    `);
    console.log(baseWithTires.rows[0]);
    
    // Sample of the tire data we have
    console.log('\n--- SAMPLE TIRE DATA VARIETY ---');
    const sampleTires = await client.query(`
      SELECT year, make, model, display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE oem_tire_sizes IS NOT NULL 
        AND oem_tire_sizes != '[]'::jsonb
        AND display_trim NOT LIKE '%,%'
        AND year >= 2023
      ORDER BY RANDOM()
      LIMIT 15
    `);
    for (const r of sampleTires.rows) {
      console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)?.slice(0, 60)}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

analyze().catch(console.error);
