import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=== FINAL AUDIT: 2000-2026 ===\n');

  const total = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year >= 2000`);
  
  const complete = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE year >= 2000 
      AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text NOT IN ('[]', 'null')
      AND oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text NOT IN ('[]', 'null')
  `);

  const withBolt = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE year >= 2000 AND bolt_pattern IS NOT NULL
  `);

  const missing = await pool.query(`
    SELECT year, make, model, display_trim
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (
        oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]', 'null')
        OR oem_tire_sizes IS NULL OR oem_tire_sizes::text IN ('[]', 'null')
      )
    ORDER BY year DESC, make, model
  `);

  const pct = (complete.rows[0].cnt / total.rows[0].cnt * 100).toFixed(2);
  
  console.log('┌─────────────────────────────────────┐');
  console.log('│         COVERAGE SUMMARY            │');
  console.log('├─────────────────────────────────────┤');
  console.log(`│  Total Records (2000+):  ${total.rows[0].cnt.toString().padStart(8)} │`);
  console.log(`│  With Wheel+Tire Data:   ${complete.rows[0].cnt.toString().padStart(8)} │`);
  console.log(`│  With Bolt Pattern:      ${withBolt.rows[0].cnt.toString().padStart(8)} │`);
  console.log(`│  Coverage:               ${pct.padStart(7)}% │`);
  console.log('└─────────────────────────────────────┘');

  if (missing.rows.length === 0) {
    console.log('\n✅ 100% COVERAGE CONFIRMED');
    console.log('   All records from 2000-2026 have wheel AND tire specs.');
  } else {
    console.log(`\n❌ ${missing.rows.length} RECORDS STILL MISSING:\n`);
    for (const r of missing.rows.slice(0, 20)) {
      console.log(`   ${r.year} ${r.make} ${r.model} [${r.display_trim}]`);
    }
    if (missing.rows.length > 20) {
      console.log(`   ... and ${missing.rows.length - 20} more`);
    }
  }

  // Year-by-year breakdown for 2020+
  console.log('\n--- YEAR-BY-YEAR (2020-2026) ---');
  const byYear = await pool.query(`
    SELECT year, 
      COUNT(*) as total,
      SUM(CASE WHEN oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text NOT IN ('[]', 'null')
                AND oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text NOT IN ('[]', 'null') THEN 1 ELSE 0 END) as complete
    FROM vehicle_fitments 
    WHERE year >= 2020
    GROUP BY year
    ORDER BY year
  `);
  
  for (const r of byYear.rows) {
    const pct = (r.complete / r.total * 100).toFixed(1);
    const bar = pct === '100.0' ? '████████████████████' : '█'.repeat(Math.floor(parseFloat(pct) / 5)) + '░'.repeat(20 - Math.floor(parseFloat(pct) / 5));
    console.log(`  ${r.year}: ${r.complete}/${r.total} ${bar} ${pct}%`);
  }

  await pool.end();
}

main();
