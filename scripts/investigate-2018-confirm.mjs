/** Confirm the deprecated-staggered-split ↔ merged-staggered relationship. READ-ONLY. */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false } });

async function main() {
  const c = await pool.connect();
  try {
    // Does every merged-staggered record correspond to a Front+Rear pair in deprecated-staggered-split?
    const r1 = await c.query(`
      WITH merged AS (
        SELECT id, make, model,
               LOWER(make||'|'||model) AS ymm,
               LOWER(COALESCE(display_trim,'')) AS trim
        FROM vehicle_fitments
        WHERE year=2018 AND source='merged-staggered'
      ), dep AS (
        SELECT LOWER(make||'|'||model) AS ymm,
               LOWER(COALESCE(display_trim,'')) AS trim
        FROM vehicle_fitments
        WHERE year=2018 AND source='deprecated-staggered-split'
      )
      SELECT
        (SELECT COUNT(*) FROM merged)::int AS merged_total,
        (SELECT COUNT(*) FROM merged mg WHERE EXISTS (
          SELECT 1 FROM dep d WHERE d.ymm = mg.ymm
            AND d.trim LIKE '%' || mg.trim || '%'
        ))::int AS merged_with_dep_match
    `);
    console.log('mergedVsDeprecated:', JSON.stringify(r1.rows[0]));

    // Sample merged-staggered records to see their shape
    const r2 = await c.query(`
      SELECT make, model, display_trim, oem_wheel_sizes, oem_tire_sizes, quality_tier
      FROM vehicle_fitments
      WHERE year=2018 AND source='merged-staggered'
      ORDER BY make, model LIMIT 8
    `);
    console.log('mergedSamples:', JSON.stringify(r2.rows, null, 1));

    // Are there YMMTs where BOTH the deprecated split rows AND a merged row exist (search-visible duplicates)?
    const r3 = await c.query(`
      SELECT COUNT(DISTINCT LOWER(d.make||'|'||d.model))::int AS models_with_both
      FROM vehicle_fitments d
      JOIN vehicle_fitments mg
        ON LOWER(d.make)=LOWER(mg.make) AND LOWER(d.model)=LOWER(mg.model)
       AND mg.year=2018 AND mg.source='merged-staggered'
      WHERE d.year=2018 AND d.source='deprecated-staggered-split'
    `);
    console.log('modelsWithBoth:', JSON.stringify(r3.rows[0]));
  } finally {
    c.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
