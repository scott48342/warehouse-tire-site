/**
 * Fix the 3 skipped classic Porsche models (928, 944, 968)
 * These have nested front/rear offsets in oem_wheel_sizes
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  env[key] = val;
}

const pool = new pg.Pool({ connectionString: env.POSTGRES_URL });

// First, check what's actually in the DB for these models
const { rows } = await pool.query(`
  SELECT DISTINCT model, year, oem_wheel_sizes::text AS wheels
  FROM vehicle_fitments
  WHERE make = 'Porsche' AND model IN ('928', '944', '968')
    AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
  ORDER BY model, year
`);

process.stdout.write('=== Porsche Classic Wheel Data ===\n');
for (const r of rows) {
  process.stdout.write(`${r.model} ${r.year}: ${r.wheels}\n`);
}

// These classic Porsches are staggered with nested front/rear objects
// Known OEM specs (verified):
// 928 (S4/GTS 1990-1995): front ET21.6, rear ET43  → 5x130
// 944 (1990-1991): front ET23.3, rear ET52.3        → 5x130  
// 968 (1992-1995): front ET52, rear ET52            → 5x130

const fixes = [
  {
    model: '928',
    yearFrom: 1990, yearTo: 1995,
    oemFront: 22, oemRear: 43,
    // PERF: min = max(min_oem - 10, -20), max = min(max_oem + 15, 55)
    offsetMin: Math.max(22 - 10, -20), // = 12
    offsetMax: Math.min(43 + 15, 55),  // = 55
    thread: 'M14x1.5',
    source: 'Porsche 928 OEM: front ET22, rear ET43 (5x130 staggered)',
  },
  {
    model: '944',
    yearFrom: 1990, yearTo: 1991,
    oemFront: 23, oemRear: 52,
    offsetMin: Math.max(23 - 10, -20), // = 13
    offsetMax: Math.min(52 + 15, 55),  // = 55
    thread: 'M14x1.5',
    source: 'Porsche 944 OEM: front ET23, rear ET52 (5x130 staggered)',
  },
  {
    model: '968',
    yearFrom: 1992, yearTo: 1995,
    oemFront: 52, oemRear: 52,
    offsetMin: Math.max(52 - 10, -20), // = 42
    offsetMax: Math.min(52 + 15, 55),  // = 55
    thread: 'M14x1.5',
    source: 'Porsche 968 OEM: ET52 both axles (5x130)',
  },
];

let totalUpdated = 0;
for (const fix of fixes) {
  const res = await pool.query(`
    UPDATE vehicle_fitments
    SET offset_min_mm = $1, offset_max_mm = $2,
        thread_size = COALESCE(thread_size, $3),
        updated_at = NOW()
    WHERE make = 'Porsche' AND model = $4
      AND year BETWEEN $5 AND $6
      AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
  `, [fix.offsetMin, fix.offsetMax, fix.thread, fix.model, fix.yearFrom, fix.yearTo]);
  
  totalUpdated += res.rowCount;
  process.stdout.write(`✅ Porsche ${fix.model} ${fix.yearFrom}-${fix.yearTo}: [${fix.offsetMin}, ${fix.offsetMax}] — ${res.rowCount} rows\n`);
  process.stdout.write(`   Source: ${fix.source}\n`);
}

process.stdout.write(`\nTotal rows updated: ${totalUpdated}\n`);

// Update the main research JSON
const researchPath = resolve(__dirname, 'offset-research-european.json');
const researchData = JSON.parse(readFileSync(researchPath, 'utf8'));
for (const fix of fixes) {
  researchData.updated.push({
    make: 'Porsche',
    model: fix.model,
    years: `${fix.yearFrom}-${fix.yearTo}`,
    source: fix.source,
    oem_offset: `${fix.oemFront}F/${fix.oemRear}R`,
    aftermarket_range: `${fix.offsetMin}–${fix.offsetMax}`,
    category: 'perf',
    records: totalUpdated,
  });
}
// Remove from skipped
researchData.skipped = researchData.skipped.filter(
  s => !['928','944','968'].includes(s.model)
);
researchData.summary.groups_updated = researchData.updated.length;
researchData.summary.groups_skipped = researchData.skipped.length;
researchData.summary.total_db_rows_updated += totalUpdated;

writeFileSync(researchPath, JSON.stringify(researchData, null, 2));
process.stdout.write('Updated offset-research-european.json\n');
await pool.end();
