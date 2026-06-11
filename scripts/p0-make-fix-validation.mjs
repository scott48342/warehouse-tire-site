/**
 * P0 make fix — before/after reachability measurement (READ-ONLY)
 *
 * BEFORE = old comparison: make ILIKE canonicalMake(input)   (exact, case-insensitive)
 * AFTER  = new comparison: LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g')) IN (candidates)
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false } });

// Mirror canonicalMake (makeAliases.ts)
const MAKE_TO_CANONICAL = {
  'mercedes-benz': 'mercedes', 'mercedes benz': 'mercedes', 'mercedes': 'mercedes', 'mb': 'mercedes',
  'land rover': 'land-rover', 'land-rover': 'land-rover', 'landrover': 'land-rover',
  'alfa romeo': 'alfa-romeo', 'alfa-romeo': 'alfa-romeo',
  'aston martin': 'aston-martin', 'aston-martin': 'aston-martin',
  'rolls-royce': 'rolls-royce', 'rolls royce': 'rolls-royce',
  'ram': 'ram', 'chevy': 'chevrolet', 'chevrolet': 'chevrolet', 'vw': 'volkswagen',
};
const CANONICAL_TO_DISPLAY = {
  'mercedes': 'Mercedes-Benz', 'land-rover': 'Land Rover', 'alfa-romeo': 'Alfa Romeo',
  'aston-martin': 'Aston Martin', 'rolls-royce': 'Rolls-Royce', 'chevrolet': 'Chevrolet',
  'volkswagen': 'Volkswagen', 'ram': 'Ram',
};
const slug = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function canonicalMake(make) {
  const n = make.trim().toLowerCase();
  return MAKE_TO_CANONICAL[n] || slug(n);
}
function displayMake(make) {
  const c = canonicalMake(make);
  return CANONICAL_TO_DISPLAY[c] || c.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
// Mirror getMakeSlugCandidates (makeMatch.ts)
function candidates(input) {
  const set = new Set();
  const i = slug(input); if (i) set.add(i);
  const c = canonicalMake(input); if (c) set.add(c);
  const d = slug(displayMake(input)); if (d) set.add(d);
  return [...set];
}

const TESTS = [
  'Mercedes-Benz', 'Mercedes', 'Land Rover', 'Alfa Romeo', 'Aston Martin',
  'Rolls-Royce', 'Toyota', 'Ford', 'Chevrolet', 'Chevy', 'Jeep', 'RAM', 'MINI', 'BMW'
];

async function main() {
  const c = await pool.connect();
  try {
    const rows = [];
    for (const input of TESTS) {
      const canon = canonicalMake(input);
      const cands = candidates(input);
      const before = (await c.query(
        `SELECT COUNT(*)::int n FROM vehicle_fitments WHERE make ILIKE $1 AND certification_status='certified'`,
        [canon])).rows[0].n;
      const after = (await c.query(
        `SELECT COUNT(*)::int n FROM vehicle_fitments
         WHERE LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g')) = ANY($1::text[])
           AND certification_status='certified'`,
        [cands])).rows[0].n;
      rows.push({ input, canonical: canon, candidates: cands.join('|'), before_reachable: before, after_reachable: after, recovered: after - before });
    }
    console.table(rows);
    const totalRecovered = rows.filter(r => !['Mercedes','Chevy'].includes(r.input)) // avoid double counting same brand
      .reduce((s, r) => s + Math.max(0, r.recovered), 0);
    console.log(`\nTotal recovered (deduped inputs): ${totalRecovered}`);
    fs.writeFileSync(path.join(__dirname, 'p0-make-fix-validation.json'), JSON.stringify(rows, null, 2));
  } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
