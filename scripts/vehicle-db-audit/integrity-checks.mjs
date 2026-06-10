/**
 * Vehicle Fitment Database Integrity Checks
 * 
 * Use these checks:
 * 1. Before committing imports (pre-import validation)
 * 2. As part of pre-deploy CI pipeline
 * 3. As periodic health checks
 * 
 * Run: node scripts/vehicle-db-audit/integrity-checks.mjs [--fail-on-warn]
 */

import pg from 'pg';

const VALID_MAKES = new Set([
  'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick',
  'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford',
  'Genesis', 'GMC', 'Honda', 'Hummer', 'Hyundai', 'Infiniti', 'Isuzu',
  'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln',
  'Lotus', 'Lucid', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mercury',
  'MINI', 'Mitsubishi', 'Nissan', 'Oldsmobile', 'Plymouth', 'Pontiac', 'Porsche',
  'Ram', 'Rivian', 'Rolls-Royce', 'Saab', 'Saturn', 'Scion', 'Subaru', 'Suzuki',
  'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
]);

const PHANTOM_MAKES = ['Toyota Minivans', 'Nissan Vans'];

export async function runIntegrityChecks(client, options = {}) {
  const { failOnWarn = false, verbose = true } = options;
  const results = [];
  let hasErrors = false;
  let hasWarnings = false;

  const log = verbose ? console.log : () => {};

  // Check 1: No lowercase makes
  log('\n🔍 Check 1: No lowercase makes...');
  const lowercaseMakes = await client.query(`
    SELECT make, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE LOWER(make) = make AND make ~ '[a-z]'
    GROUP BY make
  `);
  if (lowercaseMakes.rowCount > 0) {
    hasErrors = true;
    results.push({
      check: 'no_lowercase_makes',
      status: 'FAIL',
      message: `Found ${lowercaseMakes.rowCount} lowercase makes`,
      details: lowercaseMakes.rows
    });
    log(`  ❌ FAIL: Found ${lowercaseMakes.rowCount} lowercase makes`);
    lowercaseMakes.rows.forEach(r => log(`     - ${r.make}: ${r.count} records`));
  } else {
    results.push({ check: 'no_lowercase_makes', status: 'PASS' });
    log('  ✅ PASS');
  }

  // Check 2: No phantom makes
  log('\n🔍 Check 2: No phantom makes...');
  const phantomMakes = await client.query(`
    SELECT make, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE make = ANY($1) OR make LIKE '%Minivan%' OR make LIKE '%Vans%'
    GROUP BY make
  `, [PHANTOM_MAKES]);
  if (phantomMakes.rowCount > 0) {
    hasErrors = true;
    results.push({
      check: 'no_phantom_makes',
      status: 'FAIL',
      message: `Found ${phantomMakes.rowCount} phantom makes`,
      details: phantomMakes.rows
    });
    log(`  ❌ FAIL: Found phantom makes`);
    phantomMakes.rows.forEach(r => log(`     - ${r.make}: ${r.count} records`));
  } else {
    results.push({ check: 'no_phantom_makes', status: 'PASS' });
    log('  ✅ PASS');
  }

  // Check 3: No case-duplicate makes
  log('\n🔍 Check 3: No case-duplicate makes...');
  const caseDupes = await client.query(`
    WITH make_lower AS (
      SELECT LOWER(make) as lower_make, COUNT(DISTINCT make)::int as variants
      FROM vehicle_fitments
      GROUP BY LOWER(make)
      HAVING COUNT(DISTINCT make) > 1
    )
    SELECT ml.lower_make, array_agg(DISTINCT vf.make) as variants
    FROM make_lower ml
    JOIN vehicle_fitments vf ON LOWER(vf.make) = ml.lower_make
    GROUP BY ml.lower_make
  `);
  if (caseDupes.rowCount > 0) {
    hasErrors = true;
    results.push({
      check: 'no_case_duplicate_makes',
      status: 'FAIL',
      message: `Found ${caseDupes.rowCount} makes with case variations`,
      details: caseDupes.rows
    });
    log(`  ❌ FAIL: Found case-duplicate makes`);
    caseDupes.rows.forEach(r => log(`     - ${r.lower_make}: ${r.variants.join(', ')}`));
  } else {
    results.push({ check: 'no_case_duplicate_makes', status: 'PASS' });
    log('  ✅ PASS');
  }

  // Check 4: No duplicate YMMT
  log('\n🔍 Check 4: No duplicate YMMT combinations...');
  const dupeYMMT = await client.query(`
    SELECT COUNT(*)::int as dupe_count
    FROM (
      SELECT year, make, model, display_trim
      FROM vehicle_fitments
      GROUP BY year, make, model, display_trim
      HAVING COUNT(*) > 1
    ) d
  `);
  if (dupeYMMT.rows[0].dupe_count > 0) {
    hasWarnings = true;
    results.push({
      check: 'no_duplicate_ymmt',
      status: 'WARN',
      message: `Found ${dupeYMMT.rows[0].dupe_count} duplicate YMMT combinations`,
      details: { count: dupeYMMT.rows[0].dupe_count }
    });
    log(`  ⚠️  WARN: Found ${dupeYMMT.rows[0].dupe_count} duplicate YMMT combinations`);
  } else {
    results.push({ check: 'no_duplicate_ymmt', status: 'PASS' });
    log('  ✅ PASS');
  }

  // Check 5: No year count spikes (>1.5x neighbors)
  log('\n🔍 Check 5: No abnormal year count spikes...');
  const yearSpikes = await client.query(`
    WITH yc AS (
      SELECT year, COUNT(*)::int as c 
      FROM vehicle_fitments 
      WHERE year >= 2000
      GROUP BY year
    ),
    with_neighbors AS (
      SELECT 
        y1.year,
        y1.c as count,
        (
          SELECT AVG(c) 
          FROM yc y2 
          WHERE y2.year BETWEEN y1.year - 1 AND y1.year + 1 
            AND y2.year != y1.year
        ) as neighbor_avg
      FROM yc y1
    )
    SELECT year, count, neighbor_avg::int,
           ROUND((count::decimal / NULLIF(neighbor_avg, 0) * 100))::int as pct_of_neighbors
    FROM with_neighbors
    WHERE count > COALESCE(neighbor_avg, 0) * 1.5
      AND neighbor_avg IS NOT NULL
    ORDER BY year
  `);
  if (yearSpikes.rowCount > 0) {
    hasWarnings = true;
    results.push({
      check: 'no_year_spikes',
      status: 'WARN',
      message: `Found ${yearSpikes.rowCount} years with abnormal record counts`,
      details: yearSpikes.rows
    });
    log(`  ⚠️  WARN: Found year spikes`);
    yearSpikes.rows.forEach(r => 
      log(`     - ${r.year}: ${r.count} records (${r.pct_of_neighbors}% of neighbor avg ${r.neighbor_avg})`)
    );
  } else {
    results.push({ check: 'no_year_spikes', status: 'PASS' });
    log('  ✅ PASS');
  }

  // Check 6: Minimal missing wheel fields
  log('\n🔍 Check 6: Minimal missing wheel fields...');
  const missingFields = await client.query(`
    SELECT COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE (bolt_pattern IS NULL OR center_bore_mm IS NULL)
      AND quality_tier != 'quarantined'
  `);
  const missingCount = missingFields.rows[0].count;
  const MISSING_THRESHOLD = 100;
  if (missingCount > MISSING_THRESHOLD) {
    hasWarnings = true;
    results.push({
      check: 'minimal_missing_wheel_fields',
      status: 'WARN',
      message: `${missingCount} records missing bolt_pattern or center_bore_mm (threshold: ${MISSING_THRESHOLD})`,
      details: { count: missingCount, threshold: MISSING_THRESHOLD }
    });
    log(`  ⚠️  WARN: ${missingCount} records missing wheel fields (threshold: ${MISSING_THRESHOLD})`);
  } else {
    results.push({ check: 'minimal_missing_wheel_fields', status: 'PASS' });
    log(`  ✅ PASS (${missingCount} missing, threshold: ${MISSING_THRESHOLD})`);
  }

  // Summary
  log('\n' + '='.repeat(50));
  const passCount = results.filter(r => r.status === 'PASS').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  log(`\n📊 INTEGRITY CHECK SUMMARY`);
  log(`   ✅ Passed: ${passCount}`);
  log(`   ⚠️  Warnings: ${warnCount}`);
  log(`   ❌ Failed: ${failCount}`);

  const exitCode = hasErrors ? 1 : (failOnWarn && hasWarnings ? 1 : 0);
  log(`\n   Exit code: ${exitCode}`);
  
  return { results, hasErrors, hasWarnings, exitCode };
}

// CLI entry point
if (process.argv[1].endsWith('integrity-checks.mjs')) {
  const failOnWarn = process.argv.includes('--fail-on-warn');
  
  const client = new pg.Client({
    connectionString: process.env.POSTGRES_URL
  });

  client.connect()
    .then(() => runIntegrityChecks(client, { failOnWarn }))
    .then(({ exitCode }) => {
      client.end();
      process.exit(exitCode);
    })
    .catch(err => {
      console.error('Integrity checks failed:', err);
      client.end();
      process.exit(1);
    });
}
