/**
 * Analyze how often different trims of the same vehicle have different bolt patterns
 * This tells us if we NEED trim-level data or if generation-level is sufficient
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
    console.log('=== TRIM FITMENT VARIANCE ANALYSIS ===\n');
    
    // Find vehicles where different trims have DIFFERENT bolt patterns
    const multiPatternVehicles = await client.query(`
      WITH trim_patterns AS (
        SELECT year, make, model,
               array_agg(DISTINCT bolt_pattern) as patterns,
               array_agg(DISTINCT display_trim) FILTER (WHERE display_trim NOT LIKE '%,%') as trims,
               COUNT(DISTINCT bolt_pattern) as pattern_count
        FROM vehicle_fitments
        WHERE bolt_pattern IS NOT NULL AND bolt_pattern != ''
        GROUP BY year, make, model
      )
      SELECT year, make, model, patterns, trims, pattern_count
      FROM trim_patterns
      WHERE pattern_count > 1
      ORDER BY pattern_count DESC, year DESC
      LIMIT 50
    `);
    
    console.log(`Vehicles with MULTIPLE bolt patterns: ${multiPatternVehicles.rows.length}`);
    console.log('\nExamples (different trims need different fitment):');
    for (const v of multiPatternVehicles.rows.slice(0, 20)) {
      console.log(`  ${v.year} ${v.make} ${v.model}: ${v.patterns.join(', ')} (${v.trims?.length || 0} trims)`);
    }
    
    // Count vehicles with single vs multiple patterns
    const patternStats = await client.query(`
      WITH trim_patterns AS (
        SELECT year, make, model,
               COUNT(DISTINCT bolt_pattern) as pattern_count
        FROM vehicle_fitments
        WHERE bolt_pattern IS NOT NULL AND bolt_pattern != ''
        GROUP BY year, make, model
      )
      SELECT 
        COUNT(*) FILTER (WHERE pattern_count = 1) as single_pattern,
        COUNT(*) FILTER (WHERE pattern_count > 1) as multi_pattern,
        COUNT(*) as total
      FROM trim_patterns
    `);
    
    const stats = patternStats.rows[0];
    console.log(`\n--- SUMMARY ---`);
    console.log(`Vehicles with single bolt pattern: ${stats.single_pattern} (${(100 * stats.single_pattern / stats.total).toFixed(1)}%)`);
    console.log(`Vehicles with multiple bolt patterns: ${stats.multi_pattern} (${(100 * stats.multi_pattern / stats.total).toFixed(1)}%)`);
    console.log(`Total vehicles: ${stats.total}`);
    
    // Check Buick specifically
    console.log('\n--- BUICK ANALYSIS ---');
    const buickPatterns = await client.query(`
      SELECT year, model, bolt_pattern, array_agg(DISTINCT display_trim) as trims
      FROM vehicle_fitments
      WHERE LOWER(make) = 'buick' AND bolt_pattern IS NOT NULL
        AND display_trim NOT LIKE '%,%'
      GROUP BY year, model, bolt_pattern
      ORDER BY model, year DESC, bolt_pattern
    `);
    
    for (const b of buickPatterns.rows.slice(0, 25)) {
      console.log(`  ${b.year} Buick ${b.model} [${b.bolt_pattern}]: ${b.trims.join(', ')}`);
    }
    
    // For multi-pattern vehicles, which ones are popular US models?
    console.log('\n--- POPULAR US VEHICLES WITH MULTIPLE BOLT PATTERNS ---');
    const popularMulti = await client.query(`
      WITH trim_patterns AS (
        SELECT year, make, model,
               array_agg(DISTINCT bolt_pattern) as patterns,
               COUNT(DISTINCT bolt_pattern) as pattern_count
        FROM vehicle_fitments
        WHERE bolt_pattern IS NOT NULL AND bolt_pattern != ''
          AND make IN ('Ford', 'Chevrolet', 'Toyota', 'Honda', 'RAM', 'Jeep', 'Dodge', 'GMC', 'Buick', 'Nissan', 'Hyundai', 'Kia')
          AND year >= 2020
        GROUP BY year, make, model
      )
      SELECT year, make, model, patterns
      FROM trim_patterns
      WHERE pattern_count > 1
      ORDER BY make, model, year DESC
    `);
    
    for (const v of popularMulti.rows) {
      console.log(`  ${v.year} ${v.make} ${v.model}: ${v.patterns.join(', ')}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

analyze().catch(console.error);
