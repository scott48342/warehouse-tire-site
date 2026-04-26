import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=== FITMENT AUDIT: 2000-2026 ===\n');

  // Total records 2000+
  const total = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year >= 2000
  `);
  
  // Complete records (has wheel AND tire data)
  const complete = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE year >= 2000 
      AND oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes::text != '[]'
      AND oem_wheel_sizes::text != 'null'
      AND oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes::text != '[]'
      AND oem_tire_sizes::text != 'null'
  `);

  // With bolt pattern
  const withBolt = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE year >= 2000 AND bolt_pattern IS NOT NULL
  `);

  // Quality tier breakdown
  const byTier = await pool.query(`
    SELECT quality_tier, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE year >= 2000
    GROUP BY quality_tier
    ORDER BY cnt DESC
  `);

  console.log('SUMMARY:');
  console.log(`  Total records (2000+): ${total.rows[0].cnt}`);
  console.log(`  With wheel+tire data: ${complete.rows[0].cnt} (${(complete.rows[0].cnt / total.rows[0].cnt * 100).toFixed(1)}%)`);
  console.log(`  With bolt pattern: ${withBolt.rows[0].cnt} (${(withBolt.rows[0].cnt / total.rows[0].cnt * 100).toFixed(1)}%)`);
  console.log('\nQuality Tier Breakdown:');
  for (const r of byTier.rows) {
    console.log(`  ${(r.quality_tier || 'NULL').padEnd(12)}: ${r.cnt}`);
  }

  // Find MISSING records (no wheel OR no tire data)
  const missing = await pool.query(`
    SELECT year, make, model, display_trim, 
      CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]', 'null') THEN 'NO_WHEELS' ELSE 'OK' END as wheels,
      CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text IN ('[]', 'null') THEN 'NO_TIRES' ELSE 'OK' END as tires,
      bolt_pattern,
      quality_tier
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (
        oem_wheel_sizes IS NULL 
        OR oem_wheel_sizes::text IN ('[]', 'null')
        OR oem_tire_sizes IS NULL 
        OR oem_tire_sizes::text IN ('[]', 'null')
      )
    ORDER BY make, model, year, display_trim
  `);

  if (missing.rows.length === 0) {
    console.log('\n✅ 100% COVERAGE - All 2000+ records have wheel and tire data!');
  } else {
    console.log(`\n❌ MISSING DATA: ${missing.rows.length} records\n`);
    
    // Group by make
    const byMake: Record<string, any[]> = {};
    for (const r of missing.rows) {
      if (!byMake[r.make]) byMake[r.make] = [];
      byMake[r.make].push(r);
    }

    console.log('--- MISSING BY MAKE ---');
    const sortedMakes = Object.entries(byMake).sort((a, b) => b[1].length - a[1].length);
    for (const [make, records] of sortedMakes) {
      console.log(`\n${make}: ${records.length} records`);
      // Group by model
      const byModel: Record<string, any[]> = {};
      for (const r of records) {
        if (!byModel[r.model]) byModel[r.model] = [];
        byModel[r.model].push(r);
      }
      for (const [model, recs] of Object.entries(byModel).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${model}: ${recs.length}`);
        // Show first 3 examples
        for (const r of recs.slice(0, 3)) {
          console.log(`    - ${r.year} ${r.display_trim} [${r.wheels}/${r.tires}]`);
        }
        if (recs.length > 3) console.log(`    ... and ${recs.length - 3} more`);
      }
    }
  }

  // Check for records with wheel data but missing tire data or vice versa
  const partial = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (
        (oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text NOT IN ('[]', 'null') AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text IN ('[]', 'null')))
        OR
        (oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text NOT IN ('[]', 'null') AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]', 'null')))
      )
  `);
  
  if (parseInt(partial.rows[0].cnt) > 0) {
    console.log(`\n⚠️  PARTIAL DATA: ${partial.rows[0].cnt} records have wheels OR tires but not both`);
  }

  // Spot check: verify data quality on a sample
  console.log('\n--- SPOT CHECK: Sample Records ---');
  const sample = await pool.query(`
    SELECT year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes, bolt_pattern
    FROM vehicle_fitments 
    WHERE year >= 2020 
      AND quality_tier = 'complete'
    ORDER BY RANDOM()
    LIMIT 10
  `);
  
  for (const r of sample.rows) {
    const wheels = JSON.parse(r.oem_wheel_sizes || '[]');
    const tires = JSON.parse(r.oem_tire_sizes || '[]');
    const wheelStr = wheels.map((w: any) => `${w.diameter}"`).join('/') || 'NONE';
    const tireStr = tires.join(', ') || 'NONE';
    console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim}`);
    console.log(`    Wheels: ${wheelStr} | Tires: ${tireStr} | Bolt: ${r.bolt_pattern || 'NONE'}`);
  }

  await pool.end();
}

main();
