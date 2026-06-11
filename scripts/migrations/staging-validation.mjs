/**
 * 2018 Migration — STAGING VALIDATION HARNESS
 *
 * Runs the entire migration inside a single transaction and ROLLS BACK.
 * NO permanent changes are made to the database.
 *
 * Phases:
 *   1. Baseline metrics (read-only, pre-transaction)
 *   2. BEGIN
 *   3. Install integrity views (inside txn → rolled back)
 *   4. Execute migration body (BEGIN stripped; COMMIT already commented out)
 *   5. Post-migration validation checks (inside txn)
 *   6. Business-impact vehicle lookups (inside txn)
 *   7. ROLLBACK
 *   8. Post-rollback verification (DB unchanged)
 *
 * Output: staging-validation-output.json + console summary
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
if (!m) throw new Error('POSTGRES_URL not found');

const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false } });
const out = { startedAt: new Date().toISOString(), notices: [], phases: {} };

const BASELINE_QUERIES = {
  total_all: `SELECT COUNT(*)::int AS n FROM vehicle_fitments`,
  total_2018: `SELECT COUNT(*)::int AS n FROM vehicle_fitments WHERE year=2018`,
  deprecated_2018: `SELECT COUNT(*)::int AS n FROM vehicle_fitments WHERE year=2018 AND source='deprecated-staggered-split'`,
  merged_2018: `SELECT COUNT(*)::int AS n FROM vehicle_fitments WHERE year=2018 AND source='merged-staggered'`,
  deprecated_with_replacement: `
    WITH dep AS (
      SELECT d.id, d.make, d.model,
        TRIM(CASE
          WHEN d.display_trim ~* '\\mFront\\M' THEN SPLIT_PART(d.display_trim,' Front ',1)
          WHEN d.display_trim ~* '\\mRear\\M'  THEN SPLIT_PART(d.display_trim,' Rear ',1)
          ELSE d.display_trim END) AS base_trim
      FROM vehicle_fitments d
      WHERE d.source='deprecated-staggered-split' AND d.year=2018)
    SELECT COUNT(*)::int AS n FROM dep
    WHERE EXISTS (
      SELECT 1 FROM vehicle_fitments mg
      WHERE mg.source='merged-staggered' AND mg.year=2018
        AND LOWER(mg.make)=LOWER(dep.make) AND LOWER(mg.model)=LOWER(dep.model)
        AND LOWER(COALESCE(mg.display_trim,''))=LOWER(dep.base_trim))`,
  malformed_makes: `
    SELECT COUNT(*)::int AS n FROM vehicle_fitments
    WHERE make ~* '\\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$'`,
  casing_variants: `
    WITH canon AS (
      SELECT LOWER(make) AS ml, (ARRAY_AGG(make ORDER BY cnt DESC, make))[1] AS canonical
      FROM (SELECT make, COUNT(*) cnt FROM vehicle_fitments GROUP BY make) t
      GROUP BY LOWER(make) HAVING COUNT(*) > 1)
    SELECT COUNT(*)::int AS n FROM vehicle_fitments vf
    JOIN canon c ON LOWER(vf.make)=c.ml WHERE vf.make <> c.canonical`,
  missing_wheel_fields: `
    SELECT COUNT(*)::int AS n FROM vehicle_fitments
    WHERE bolt_pattern IS NULL OR center_bore_mm IS NULL
       OR oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]','null','')
       OR oem_tire_sizes IS NULL OR oem_tire_sizes::text IN ('[]','null','','{}')`
};

const TEST_VEHICLES = [
  { label: 'Common', year: 2024, make: 'Toyota', model: 'Camry' },
  { label: 'Common', year: 2024, make: 'Ford', model: 'F-150' },
  { label: 'Common', year: 2020, make: 'Chevrolet', model: 'Silverado 1500' },
  { label: 'Common', year: 2018, make: 'Honda', model: 'Accord' },
  { label: 'Common', year: 2018, make: 'Jeep', model: 'Wrangler' },
  { label: 'Common', year: 2018, make: 'Volkswagen', model: 'Golf R' },
  { label: 'Premium/Staggered', year: 2018, make: 'Acura', model: 'NSX' },
  { label: 'Premium/Staggered', year: 2018, make: 'Porsche', model: '718 Cayman' },
  { label: 'Premium/Staggered', year: 2018, make: 'Alfa Romeo', model: 'Giulia' },
  { label: 'Premium/Staggered', year: 2018, make: 'BMW', model: 'i3' },
  { label: 'Premium/Staggered', year: 2018, make: 'Chevrolet', model: 'Corvette' }
];

async function runBaseline(client, label) {
  const res = {};
  for (const [k, sql] of Object.entries(BASELINE_QUERIES)) {
    res[k] = (await client.query(sql)).rows[0].n;
  }
  out.phases[label] = res;
  return res;
}

async function vehicleChecks(client, label) {
  const results = [];
  for (const v of TEST_VEHICLES) {
    const rows = (await client.query(`
      SELECT id, display_trim, bolt_pattern, center_bore_mm, source,
             (oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text NOT IN ('[]','null','')) AS has_wheels,
             (oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text NOT IN ('[]','null','','{}')) AS has_tires
      FROM vehicle_fitments
      WHERE year=$1 AND LOWER(make)=LOWER($2) AND LOWER(model)=LOWER($3)
      ORDER BY display_trim`, [v.year, v.make, v.model])).rows;

    results.push({
      ...v,
      found: rows.length,
      trims: rows.map(r => r.display_trim),
      allHaveBolt: rows.length > 0 && rows.every(r => !!r.bolt_pattern),
      allHaveBore: rows.length > 0 && rows.every(r => r.center_bore_mm !== null),
      allHaveWheels: rows.length > 0 && rows.every(r => r.has_wheels),
      allHaveTires: rows.length > 0 && rows.every(r => r.has_tires),
      frontRearTrimLeak: rows.some(r => /\b(Front|Rear)\b/i.test(r.display_trim || '')),
      sources: [...new Set(rows.map(r => r.source))]
    });
  }
  out.phases[label] = results;
  return results;
}

async function main() {
  const client = await pool.connect();
  client.on('notice', n => {
    out.notices.push(n.message);
    console.log('NOTICE:', n.message);
  });

  try {
    // ── Phase 1: Baseline (read-only, outside transaction)
    console.log('\n══ PHASE 1: Baseline metrics ══');
    const before = await runBaseline(client, 'baseline_before');
    console.log(JSON.stringify(before, null, 1));

    // ── Phase 2: BEGIN staging transaction
    console.log('\n══ PHASE 2: BEGIN (staging transaction) ══');
    await client.query('BEGIN');

    // ── Phase 3: Integrity views (inside txn → rolled back later)
    console.log('\n══ PHASE 3: Install integrity views ══');
    let viewsSql = fs.readFileSync(path.join(__dirname, '2018-integrity-checks.sql'), 'utf-8');
    await client.query(viewsSql);
    const summaryPre = (await client.query('SELECT * FROM vw_integrity_summary')).rows;
    out.phases.integrity_before_migration = summaryPre;
    console.log('Integrity summary (pre-migration):', JSON.stringify(summaryPre));

    // ── Phase 4: Migration body (strip its BEGIN; COMMIT is already commented)
    console.log('\n══ PHASE 4: Execute migration (DRY RUN inside txn) ══');
    let migSql = fs.readFileSync(path.join(__dirname, '2018-cleanup-migration.sql'), 'utf-8');
    migSql = migSql.replace(/^BEGIN;\s*$/m, '-- BEGIN; (managed by harness)');
    const migRes = await client.query(migSql);
    // Last result set = the final summary SELECT
    const resultSets = Array.isArray(migRes) ? migRes : [migRes];
    const finalSummary = resultSets[resultSets.length - 1].rows;
    out.phases.migration_summary = finalSummary;
    console.log('Migration summary:', JSON.stringify(finalSummary));

    // ── Phase 5: Post-migration validation (inside same txn)
    console.log('\n══ PHASE 5: Validation checks ══');
    const checks = {};

    checks.check1_replaceable_deprecated_remaining = (await client.query(`
      SELECT COUNT(*)::int AS n FROM vehicle_fitments d
      WHERE d.source='deprecated-staggered-split' AND d.year=2018
        AND EXISTS (
          SELECT 1 FROM vehicle_fitments mg
          WHERE mg.source='merged-staggered' AND mg.year=2018
            AND LOWER(mg.make)=LOWER(d.make) AND LOWER(mg.model)=LOWER(d.model)
            AND LOWER(COALESCE(mg.display_trim,'')) =
                LOWER(TRIM(CASE
                  WHEN d.display_trim ~* '\\mFront\\M' THEN SPLIT_PART(d.display_trim,' Front ',1)
                  WHEN d.display_trim ~* '\\mRear\\M'  THEN SPLIT_PART(d.display_trim,' Rear ',1)
                  ELSE d.display_trim END)))`)).rows[0].n;

    checks.check1b_orphaned_deprecated_kept = (await client.query(`
      SELECT COUNT(*)::int AS n FROM vehicle_fitments
      WHERE source='deprecated-staggered-split' AND year=2018`)).rows[0].n;

    checks.check2_category_makes_remaining = (await client.query(`
      SELECT COUNT(*)::int AS n FROM vehicle_fitments
      WHERE make ~* '\\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$'`)).rows[0].n;

    checks.check3_case_variant_groups = (await client.query(`
      SELECT COUNT(*)::int AS n FROM (
        SELECT LOWER(make) FROM vehicle_fitments
        GROUP BY LOWER(make) HAVING COUNT(DISTINCT make) > 1) t`)).rows[0].n;

    checks.check4_ymmt_dupes_from_renames = (await client.query(`
      SELECT COUNT(*)::int AS n FROM (
        SELECT a.id FROM vehicle_fitments a
        JOIN vf_migration_2018_make_changes mc ON mc.id = a.id
        JOIN vehicle_fitments b
          ON b.id <> a.id AND b.year = a.year
         AND LOWER(b.make)=LOWER(a.make) AND LOWER(b.model)=LOWER(a.model)
         AND LOWER(COALESCE(b.display_trim,''))=LOWER(COALESCE(a.display_trim,''))
        ) t`)).rows[0].n;

    checks.check5_backup_rows = (await client.query(
      `SELECT COUNT(*)::int AS n FROM vf_migration_2018_deleted`)).rows[0].n;
    checks.check5_backup_still_in_table = (await client.query(`
      SELECT COUNT(*)::int AS n FROM vf_migration_2018_deleted b
      WHERE EXISTS (SELECT 1 FROM vehicle_fitments vf WHERE vf.id=b.id)`)).rows[0].n;

    checks.check6_integrity_summary = (await client.query(
      'SELECT * FROM vw_integrity_summary')).rows;

    checks.check7_year_counts = (await client.query(`
      SELECT year, COUNT(*)::int AS n FROM vehicle_fitments
      WHERE year BETWEEN 2016 AND 2020 GROUP BY year ORDER BY year`)).rows;

    out.phases.validation = checks;
    console.log(JSON.stringify(checks, null, 1));

    // ── Phase 5b: After-metrics (inside txn)
    const after = await runBaseline(client, 'metrics_after_migration');
    console.log('\nAfter-metrics:', JSON.stringify(after, null, 1));

    // ── Phase 6: Business impact vehicle checks (inside txn)
    console.log('\n══ PHASE 6: Business-impact vehicle lookups (post-migration state) ══');
    const vech = await vehicleChecks(client, 'vehicles_after_migration');
    for (const v of vech) {
      console.log(`${v.year} ${v.make} ${v.model}: ${v.found} trims | bolt:${v.allHaveBolt} bore:${v.allHaveBore} wheels:${v.allHaveWheels} tires:${v.allHaveTires} FRleak:${v.frontRearTrimLeak}`);
    }

    // ── Phase 7: ROLLBACK
    console.log('\n══ PHASE 7: ROLLBACK ══');
    await client.query('ROLLBACK');
    console.log('Transaction rolled back — no changes persisted.');

    // ── Phase 8: Post-rollback verification
    console.log('\n══ PHASE 8: Post-rollback verification ══');
    const postRollback = await runBaseline(client, 'baseline_after_rollback');
    const unchanged = JSON.stringify(before) === JSON.stringify(postRollback);
    out.phases.rollback_verified_unchanged = unchanged;
    console.log('DB unchanged after rollback:', unchanged);
    if (!unchanged) {
      console.error('⚠️ MISMATCH:', JSON.stringify({ before, postRollback }, null, 1));
    }

    // Backup tables from the txn should not exist (created inside txn)
    const backupTablesExist = (await client.query(`
      SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_name IN ('vf_migration_2018_deleted','vf_migration_2018_make_changes')`)).rows[0].n;
    out.phases.backup_tables_after_rollback = backupTablesExist;
    console.log('Backup tables remaining after rollback (expect 0):', backupTablesExist);

    const viewsExist = (await client.query(`
      SELECT COUNT(*)::int AS n FROM information_schema.views
      WHERE table_name LIKE 'vw_integrity_%'`)).rows[0].n;
    out.phases.integrity_views_after_rollback = viewsExist;
    console.log('Integrity views remaining after rollback (expect 0):', viewsExist);

    out.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(__dirname, 'staging-validation-output.json'), JSON.stringify(out, null, 2));
    console.log('\nFull output: scripts/migrations/staging-validation-output.json');
  } catch (e) {
    console.error('ERROR — rolling back:', e.message);
    try { await client.query('ROLLBACK'); } catch {}
    out.error = e.message;
    fs.writeFileSync(path.join(__dirname, 'staging-validation-output.json'), JSON.stringify(out, null, 2));
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
