#!/usr/bin/env npx tsx

import * as dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    SPOT CHECK: INHERITED RECORDS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Jeep Wrangler JK
  const wrangler = await pool.query(`
    SELECT year, make, model, bolt_pattern, center_bore_mm, thread_size, source
    FROM vehicle_fitments
    WHERE model LIKE '%wrangler%'
    ORDER BY year
  `);
  console.log('\n📍 JEEP WRANGLER (JK Gen: 2007-2017)');
  for (const r of wrangler.rows) {
    console.log(`  ${r.year} | ${r.bolt_pattern} | CB: ${r.center_bore_mm} | ${r.source}`);
  }

  // RAM 1500
  const ram = await pool.query(`
    SELECT year, make, model, bolt_pattern, center_bore_mm, thread_size, source
    FROM vehicle_fitments
    WHERE model = '1500' AND make = 'ram'
    ORDER BY year
  `);
  console.log('\n📍 RAM 1500');
  for (const r of ram.rows) {
    console.log(`  ${r.year} | ${r.bolt_pattern} | CB: ${r.center_bore_mm} | ${r.source}`);
  }
  
  // Chevy Suburban (from Tahoe sibling)
  const suburban = await pool.query(`
    SELECT year, make, model, bolt_pattern, center_bore_mm, thread_size, source
    FROM vehicle_fitments
    WHERE model LIKE '%suburban%'
    ORDER BY year
  `);
  console.log('\n📍 CHEVROLET SUBURBAN (from Tahoe sibling)');
  for (const r of suburban.rows) {
    console.log(`  ${r.year} | ${r.bolt_pattern} | CB: ${r.center_bore_mm} | ${r.source}`);
  }

  // GMC Sierra 1500 (from Silverado sibling)
  const sierra = await pool.query(`
    SELECT year, make, model, bolt_pattern, center_bore_mm, thread_size, source
    FROM vehicle_fitments
    WHERE model LIKE '%sierra-1500%'
    ORDER BY year
  `);
  console.log('\n📍 GMC SIERRA 1500 (from Silverado sibling)');
  for (const r of sierra.rows) {
    console.log(`  ${r.year} | ${r.bolt_pattern} | CB: ${r.center_bore_mm} | ${r.source}`);
  }

  // Coverage summary
  const coverage = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN source LIKE 'inherited%' THEN 1 END) as inherited,
      COUNT(CASE WHEN source NOT LIKE 'inherited%' THEN 1 END) as direct
    FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL
  `);
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    FINAL COVERAGE STATS');
  console.log('═══════════════════════════════════════════════════════════════');
  const c = coverage.rows[0];
  console.log(`Total records with bolt pattern: ${c.total}`);
  console.log(`  Direct/Manual: ${c.direct}`);
  console.log(`  Inherited: ${c.inherited}`);

  // By source type
  const bySource = await pool.query(`
    SELECT 
      CASE 
        WHEN source LIKE 'inherited_from%SAME_GENERATION' THEN 'inherited_SAME_GENERATION'
        WHEN source LIKE 'inherited_from%SIBLING_PLATFORM' THEN 'inherited_SIBLING_PLATFORM'
        WHEN source LIKE 'inherited_from%ADJACENT_YEAR' THEN 'inherited_ADJACENT_YEAR'
        WHEN source LIKE 'inherited%' THEN 'inherited_other'
        ELSE source
      END as source_type,
      COUNT(*) as count
    FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL
    GROUP BY 1
    ORDER BY count DESC
  `);
  console.log('\nBy Source Type:');
  for (const r of bySource.rows) {
    console.log(`  ${r.source_type}: ${r.count}`);
  }
}

main().catch(console.error).finally(() => {
  pool.end();
  process.exit();
});
