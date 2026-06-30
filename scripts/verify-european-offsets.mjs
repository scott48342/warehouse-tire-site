import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[k] = v;
}

const pool = new pg.Pool({ connectionString: env.POSTGRES_URL });

// How many still have null offsets for European brands?
const { rows: nullRows } = await pool.query(`
  SELECT make, COUNT(*) cnt
  FROM vehicle_fitments
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('mercedes-benz','mercedes','mercedes-benz vans','bmw','audi','porsche',
                        'volkswagen','jaguar','land rover','maserati','alfa romeo','ferrari',
                        'aston martin','lotus','mclaren','rolls-royce','fiat','volvo','saab','smart')
  GROUP BY make ORDER BY cnt DESC
`);

process.stdout.write('=== REMAINING NULL OFFSETS (European) ===\n');
if (nullRows.length === 0) {
  process.stdout.write('✅ NONE! All European records now have offset values.\n');
} else {
  let total = 0;
  for (const r of nullRows) {
    process.stdout.write(`  ${r.make}: ${r.cnt} records still null\n`);
    total += parseInt(r.cnt);
  }
  process.stdout.write(`Total: ${total} records\n`);
}

// How many were updated (have non-null offsets)?
const { rows: updatedRows } = await pool.query(`
  SELECT make, COUNT(*) cnt
  FROM vehicle_fitments
  WHERE offset_min_mm IS NOT NULL AND offset_max_mm IS NOT NULL
    AND LOWER(make) IN ('mercedes-benz','mercedes','mercedes-benz vans','bmw','audi','porsche',
                        'volkswagen','jaguar','land rover','maserati','alfa romeo','ferrari',
                        'aston martin','lotus','mclaren','rolls-royce','fiat','volvo','saab','smart')
  GROUP BY make ORDER BY cnt DESC
`);

process.stdout.write('\n=== EUROPEAN RECORDS WITH VALID OFFSETS ===\n');
let grandTotal = 0;
for (const r of updatedRows) {
  process.stdout.write(`  ${r.make}: ${r.cnt} records\n`);
  grandTotal += parseInt(r.cnt);
}
process.stdout.write(`Grand Total: ${grandTotal} records with offsets\n`);

// Also check lowercase variants
const { rows: lowerRows } = await pool.query(`
  SELECT make, COUNT(*) cnt
  FROM vehicle_fitments
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND make IN ('audi','bmw','porsche','volkswagen','land rover')
  GROUP BY make ORDER BY cnt DESC
`);

process.stdout.write('\n=== LOWERCASE MAKES - REMAINING NULLS ===\n');
if (lowerRows.length === 0) {
  process.stdout.write('✅ NONE\n');
} else {
  for (const r of lowerRows) {
    process.stdout.write(`  ${r.make}: ${r.cnt}\n`);
  }
}

await pool.end();
