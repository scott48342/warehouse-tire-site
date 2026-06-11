/** Ecosystem audit DB checks — READ-ONLY */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false } });
const out = {};

async function q(c, k, sql) { out[k] = (await c.query(sql)).rows; }

async function main() {
  const c = await pool.connect();
  try {
    // 1. Certification status by year (CRITICAL: safeResolver only serves 'certified')
    await q(c, 'certByYear', `
      SELECT year, COALESCE(certification_status,'(null)') AS cert, COUNT(*)::int AS n
      FROM vehicle_fitments WHERE year IN (2016,2017,2018,2019,2020,2024)
      GROUP BY 1,2 ORDER BY year, n DESC`);

    // 2. Overall certification distribution
    await q(c, 'certOverall', `
      SELECT COALESCE(certification_status,'(null)') AS cert, COUNT(*)::int AS n
      FROM vehicle_fitments GROUP BY 1 ORDER BY n DESC`);

    // 3. Make storage conventions: lowercase slugs vs proper case
    await q(c, 'makeFormats', `
      SELECT make, COUNT(*)::int AS n, MIN(year) AS min_y, MAX(year) AS max_y,
        COUNT(*) FILTER (WHERE certification_status='certified')::int AS certified
      FROM vehicle_fitments
      WHERE LOWER(make) IN ('mercedes','mercedes-benz','ram','land rover','land-rover','smart','mini','alfa romeo','alfa-romeo')
      GROUP BY make ORDER BY make`);

    // 4. 2018 makes vs rest-of-DB makes: storage mismatch check
    await q(c, 'makes2018VsRest', `
      WITH y18 AS (SELECT DISTINCT make FROM vehicle_fitments WHERE year=2018),
           rest AS (SELECT DISTINCT make FROM vehicle_fitments WHERE year<>2018)
      SELECT y18.make AS make_2018_only
      FROM y18 WHERE NOT EXISTS (SELECT 1 FROM rest WHERE rest.make = y18.make)
      ORDER BY 1`);

    // 5. Test-matrix vehicles: cert status + data presence
    await q(c, 'testVehicles', `
      SELECT year, make, model, COUNT(*)::int AS recs,
        COUNT(*) FILTER (WHERE certification_status='certified')::int AS certified,
        COUNT(*) FILTER (WHERE bolt_pattern IS NOT NULL)::int AS has_bolt,
        COUNT(*) FILTER (WHERE center_bore_mm IS NOT NULL)::int AS has_bore
      FROM vehicle_fitments
      WHERE (year, LOWER(make), LOWER(model)) IN (
        (2024,'toyota','camry'),(2024,'ford','f-150'),(2020,'chevrolet','silverado 1500'),
        (2018,'honda','accord'),(2018,'jeep','wrangler'),(2018,'volkswagen','golf r'),
        (2018,'acura','nsx'),(2018,'porsche','718 cayman'),(2018,'chevrolet','corvette'),
        (2018,'alfa romeo','giulia'),(2018,'bmw','i3'))
      GROUP BY 1,2,3 ORDER BY year, make`);

    // 6. quality tier × certification cross-tab
    await q(c, 'tierXcert', `
      SELECT COALESCE(quality_tier,'(null)') AS tier, COALESCE(certification_status,'(null)') AS cert, COUNT(*)::int AS n
      FROM vehicle_fitments GROUP BY 1,2 ORDER BY n DESC LIMIT 15`);

    // 7. Sources serving certified data
    await q(c, 'certBySource', `
      SELECT COALESCE(source,'(null)') AS source,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE certification_status='certified')::int AS certified
      FROM vehicle_fitments GROUP BY 1 ORDER BY total DESC LIMIT 20`);

    fs.writeFileSync(path.join(__dirname, 'ecosystem-audit-db.json'), JSON.stringify(out, null, 2));
    for (const [k, v] of Object.entries(out)) {
      console.log(`\n=== ${k} ===`);
      console.log(JSON.stringify(v, null, 1));
    }
  } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
