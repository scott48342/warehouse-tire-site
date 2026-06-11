/**
 * 2018 Cleanup — Review Queue Generator (READ-ONLY)
 *
 * Produces CSVs of records needing human review, grouped by issue type:
 *   - missing_center_bore.csv
 *   - missing_bolt_pattern.csv
 *   - missing_wheel_sizes.csv
 *   - missing_tire_sizes.csv
 *   - review-queue-summary.json
 *
 * Output: scripts/migrations/review-queue/
 * Usage:  node scripts/migrations/generate-review-queue.mjs
 *
 * Performs NO writes to the database.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envMatch = envContent.match(/POSTGRES_URL="([^"]+)"/);
if (!envMatch) throw new Error('POSTGRES_URL not found in .env.local');

const pool = new pg.Pool({
  connectionString: envMatch[1],
  ssl: { rejectUnauthorized: false }
});

const COLUMNS = [
  'id', 'year', 'make', 'model', 'display_trim', 'raw_trim',
  'bolt_pattern', 'center_bore_mm', 'thread_size',
  'offset_min_mm', 'offset_max_mm', 'oem_wheel_sizes', 'oem_tire_sizes',
  'source', 'quality_tier', 'created_at'
];

const QUEUES = {
  missing_center_bore: `
    SELECT ${COLUMNS.join(', ')}
    FROM vehicle_fitments
    WHERE center_bore_mm IS NULL
    ORDER BY make, model, year`,
  missing_bolt_pattern: `
    SELECT ${COLUMNS.join(', ')}
    FROM vehicle_fitments
    WHERE bolt_pattern IS NULL OR bolt_pattern = ''
    ORDER BY make, model, year`,
  missing_wheel_sizes: `
    SELECT ${COLUMNS.join(', ')}
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]','null','')
    ORDER BY make, model, year`,
  missing_tire_sizes: `
    SELECT ${COLUMNS.join(', ')}
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text IN ('[]','null','','{}')
    ORDER BY make, model, year`
};

function toCSV(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      let v = row[h];
      if (v === null || v === undefined) return '';
      if (v instanceof Date) v = v.toISOString();
      if (typeof v === 'object') v = JSON.stringify(v);
      v = String(v);
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(','));
  }
  return lines.join('\n');
}

async function main() {
  const outDir = path.join(__dirname, 'review-queue');
  fs.mkdirSync(outDir, { recursive: true });

  const client = await pool.connect();
  const summary = { generatedAt: new Date().toISOString(), queues: {} };

  try {
    for (const [name, sql] of Object.entries(QUEUES)) {
      const res = await client.query(sql);
      const csvPath = path.join(outDir, `${name}.csv`);

      if (res.rows.length > 0) {
        fs.writeFileSync(csvPath, toCSV(res.rows));
        console.log(`✓ ${name}.csv — ${res.rows.length} rows`);
      } else {
        if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
        console.log(`✓ ${name} — clean (0 rows, no CSV written)`);
      }

      // Per-make breakdown for the summary
      const byMake = {};
      for (const r of res.rows) byMake[r.make] = (byMake[r.make] || 0) + 1;
      summary.queues[name] = { count: res.rows.length, byMake };
    }

    fs.writeFileSync(
      path.join(outDir, 'review-queue-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    console.log(`\nSummary: ${path.join(outDir, 'review-queue-summary.json')}`);

    const total = Object.values(summary.queues).reduce((s, q) => s + q.count, 0);
    console.log(`Total review items (rows may appear in multiple queues): ${total}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
