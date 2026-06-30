/**
 * Correct Porsche classic offsets using actual embedded DB data
 * 928: front ET60, rear ET43 → OEM range 43-60
 * 944: front ET52-65, rear ET52-60 → OEM range 52-65
 * 968: front ET55, rear ET52-55 → OEM range 52-55
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

// PERF formula: min = max(oemMin-10, -20), max = min(oemMax+15, 55)
const fixes = [
  {
    model: '928', yearFrom: 1990, yearTo: 1995,
    oemMin: 43, oemMax: 60, // rear ET43, front ET60
    offsetMin: Math.max(43 - 10, -20), // 33
    offsetMax: Math.min(60 + 15, 55),  // 55
    source: 'Embedded DB data: front ET60, rear ET43',
  },
  {
    model: '944', yearFrom: 1990, yearTo: 1991,
    oemMin: 52, oemMax: 65, // base front ET52.3, rear ET52.3; Turbo front ET65, rear ET60
    offsetMin: Math.max(52 - 10, -20), // 42
    offsetMax: Math.min(65 + 15, 55),  // 55
    source: 'Embedded DB data: front ET52-65, rear ET52-60',
  },
  {
    model: '968', yearFrom: 1992, yearTo: 1995,
    oemMin: 52, oemMax: 55, // rear ET52, front ET55
    offsetMin: Math.max(52 - 10, -20), // 42
    offsetMax: Math.min(55 + 15, 55),  // 55
    source: 'Embedded DB data: front ET55, rear ET52',
  },
];

let totalUpdated = 0;
for (const fix of fixes) {
  const res = await pool.query(`
    UPDATE vehicle_fitments
    SET offset_min_mm = $1, offset_max_mm = $2,
        updated_at = NOW()
    WHERE make = 'Porsche' AND model = $3
      AND year BETWEEN $4 AND $5
  `, [fix.offsetMin, fix.offsetMax, fix.model, fix.yearFrom, fix.yearTo]);
  
  totalUpdated += res.rowCount;
  process.stdout.write(`✅ Porsche ${fix.model}: OEM range ${fix.oemMin}-${fix.oemMax} → [${fix.offsetMin}, ${fix.offsetMax}] — ${res.rowCount} rows\n`);
}
process.stdout.write(`Total rows corrected: ${totalUpdated}\n`);

// Update research JSON to reflect corrections
const researchPath = resolve(__dirname, 'offset-research-european.json');
const data = JSON.parse(readFileSync(researchPath, 'utf8'));

for (const fix of fixes) {
  const existing = data.updated.find(u => u.model === fix.model && u.make === 'Porsche');
  if (existing) {
    existing.oem_range_corrected = `${fix.oemMin}–${fix.oemMax}`;
    existing.aftermarket_range = `${fix.offsetMin}–${fix.offsetMax}`;
    existing.source = fix.source;
    existing.records = fix.yearTo - fix.yearFrom + 1;
  }
}
data.summary.total_db_rows_updated = (data.summary.total_db_rows_updated || 0) + totalUpdated;
writeFileSync(researchPath, JSON.stringify(data, null, 2));
process.stdout.write('Research JSON updated.\n');

await pool.end();
