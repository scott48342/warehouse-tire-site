/**
 * 2018 Vehicle Fitments Investigation — READ-ONLY
 * Tasks 1-7 from fable-2018-investigation.md
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const envMatch = envContent.match(/POSTGRES_URL="([^"]+)"/);
if (!envMatch) throw new Error('POSTGRES_URL not found');

const pool = new pg.Pool({ connectionString: envMatch[1], ssl: { rejectUnauthorized: false } });

const out = {};

async function q(client, label, sql, params = []) {
  const res = await client.query(sql, params);
  out[label] = res.rows;
  return res.rows;
}

async function main() {
  const client = await pool.connect();
  try {
    // ── Task 1: quality tier distribution for 2018
    await q(client, 'qualityTiers2018', `
      SELECT COALESCE(NULLIF(quality_tier,''),'(empty/null)') AS quality_tier, COUNT(*)::int AS n
      FROM vehicle_fitments WHERE year = 2018 GROUP BY 1 ORDER BY n DESC`);

    // Compare with neighbor years
    await q(client, 'qualityTiersNeighbors', `
      SELECT year, COALESCE(NULLIF(quality_tier,''),'(empty/null)') AS quality_tier, COUNT(*)::int AS n
      FROM vehicle_fitments WHERE year IN (2016,2017,2018,2019,2020) GROUP BY 1,2 ORDER BY year, n DESC`);

    // ── Task 2: source distribution
    await q(client, 'sources2018', `
      SELECT COALESCE(NULLIF(source,''),'(empty/null)') AS source, COUNT(*)::int AS n
      FROM vehicle_fitments WHERE year = 2018 GROUP BY 1 ORDER BY n DESC`);

    await q(client, 'sources2018ByDate', `
      SELECT COALESCE(NULLIF(source,''),'(empty/null)') AS source,
             DATE(created_at) AS created_date, COUNT(*)::int AS n
      FROM vehicle_fitments WHERE year = 2018 GROUP BY 1,2 ORDER BY n DESC LIMIT 30`);

    // created_at distribution for 2018
    await q(client, 'createdDates2018', `
      SELECT DATE(created_at) AS created_date, COUNT(*)::int AS n
      FROM vehicle_fitments WHERE year = 2018 GROUP BY 1 ORDER BY n DESC LIMIT 20`);

    // ── Task 3: make distribution
    await q(client, 'makes2018', `
      SELECT make, COUNT(*)::int AS n
      FROM vehicle_fitments WHERE year = 2018 GROUP BY make ORDER BY n DESC`);

    // ── Task 4: rogue import validation
    // May 7 records overall (all years)
    await q(client, 'may7AllYears', `
      SELECT year, COUNT(*)::int AS n
      FROM vehicle_fitments
      WHERE created_at >= '2026-05-07' AND created_at < '2026-05-08'
      GROUP BY year ORDER BY year`);

    await q(client, 'may7Sources', `
      SELECT COALESCE(NULLIF(source,''),'(empty/null)') AS source, COUNT(*)::int AS n
      FROM vehicle_fitments
      WHERE created_at >= '2026-05-07' AND created_at < '2026-05-08'
      GROUP BY 1 ORDER BY n DESC`);

    // Do May7 2018 records overlap YMM(T) with non-May7 2018 records?
    await q(client, 'may7VsRest2018Overlap', `
      WITH may7 AS (
        SELECT id, LOWER(make||'|'||model) AS ymm, LOWER(make||'|'||model||'|'||COALESCE(display_trim,'')) AS ymmt
        FROM vehicle_fitments WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'
      ), rest AS (
        SELECT LOWER(make||'|'||model) AS ymm, LOWER(make||'|'||model||'|'||COALESCE(display_trim,'')) AS ymmt
        FROM vehicle_fitments WHERE year=2018 AND (created_at < '2026-05-07' OR created_at >= '2026-05-08')
      )
      SELECT
        (SELECT COUNT(*) FROM may7)::int AS may7_total,
        (SELECT COUNT(*) FROM may7 WHERE ymm IN (SELECT ymm FROM rest))::int AS ymm_overlap,
        (SELECT COUNT(*) FROM may7 WHERE ymmt IN (SELECT ymmt FROM rest))::int AS ymmt_overlap`);

    // How many distinct models did May7 add that didn't exist for 2018 before?
    await q(client, 'may7NewModels', `
      WITH may7 AS (
        SELECT DISTINCT LOWER(make||'|'||model) AS ymm
        FROM vehicle_fitments WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'
      ), rest AS (
        SELECT DISTINCT LOWER(make||'|'||model) AS ymm
        FROM vehicle_fitments WHERE year=2018 AND (created_at < '2026-05-07' OR created_at >= '2026-05-08')
      )
      SELECT
        (SELECT COUNT(*) FROM may7)::int AS may7_models,
        (SELECT COUNT(*) FROM rest)::int AS rest_models,
        (SELECT COUNT(*) FROM may7 WHERE ymm NOT IN (SELECT ymm FROM rest))::int AS new_models`);

    // Field completeness of May7 2018 records
    await q(client, 'may7Completeness', `
      SELECT
        COUNT(*)::int AS total,
        COUNT(bolt_pattern)::int AS has_bolt,
        COUNT(center_bore_mm)::int AS has_bore,
        SUM(CASE WHEN oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text NOT IN ('[]','null','') THEN 1 ELSE 0 END)::int AS has_wheels,
        SUM(CASE WHEN oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text NOT IN ('[]','null','') THEN 1 ELSE 0 END)::int AS has_tires
      FROM vehicle_fitments
      WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'`);

    // ── Task 5: random sample of unknown-tier 2018 May7 records for manual validation
    await q(client, 'validationSample', `
      SELECT id, year, make, model, display_trim, bolt_pattern, center_bore_mm,
             thread_size, oem_wheel_sizes, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'
        AND (quality_tier IS NULL OR quality_tier='' OR LOWER(quality_tier)='unknown')
        AND make NOT ILIKE '%minivans%' AND make NOT ILIKE '%vans%'
      ORDER BY md5(id::text) LIMIT 25`);

    // ── Task 6: parsing bug — trims containing Front/Rear patterns
    await q(client, 'frontRearTrims', `
      SELECT COUNT(*)::int AS n
      FROM vehicle_fitments
      WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'
        AND (display_trim ~* '\\mfront\\M' OR display_trim ~* '\\mrear\\M')`);

    await q(client, 'frontRearTrimSamples', `
      SELECT id, make, model, display_trim, raw_trim, submodel, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments
      WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'
        AND (display_trim ~* '\\mfront\\M' OR display_trim ~* '\\mrear\\M')
      ORDER BY make, model, display_trim LIMIT 30`);

    // duplicated-token trims like "Base Front Base"
    await q(client, 'frontRearAcrossYears', `
      SELECT year, COUNT(*)::int AS n
      FROM vehicle_fitments
      WHERE (display_trim ~* '\\mfront\\M' OR display_trim ~* '\\mrear\\M')
      GROUP BY year ORDER BY year`);

    // ── Task 7: missing wheel fields
    await q(client, 'missingFields', `
      SELECT id, make, model, display_trim, bolt_pattern, center_bore_mm,
             oem_wheel_sizes, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'
        AND (bolt_pattern IS NULL OR center_bore_mm IS NULL
             OR oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]','null',''))
      ORDER BY make, model`);

    await q(client, 'missingFieldsByMake', `
      SELECT make, COUNT(*)::int AS n
      FROM vehicle_fitments
      WHERE year=2018 AND created_at >= '2026-05-07' AND created_at < '2026-05-08'
        AND (bolt_pattern IS NULL OR center_bore_mm IS NULL
             OR oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]','null',''))
      GROUP BY make ORDER BY n DESC`);

    const outPath = path.join(__dirname, 'investigate-2018-output.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('Written: ' + outPath);

    // Print compact summary to console
    for (const [k, v] of Object.entries(out)) {
      console.log(`\n=== ${k} (${Array.isArray(v) ? v.length : 1} rows) ===`);
      console.log(JSON.stringify(v.slice ? v.slice(0, 15) : v, null, 1));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
