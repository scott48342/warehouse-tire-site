/** Simulate resolver make-matching behavior — READ-ONLY */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false } });

// Mirror of makeAliases.canonicalMake behavior
const MAKE_TO_CANONICAL = {
  'mercedes-benz': 'mercedes', 'mercedes benz': 'mercedes', 'mercedes': 'mercedes',
  'land rover': 'land-rover', 'land-rover': 'land-rover',
  'alfa romeo': 'alfa-romeo', 'alfa-romeo': 'alfa-romeo',
  'aston martin': 'aston-martin', 'rolls-royce': 'rolls-royce', 'rolls royce': 'rolls-royce',
  'ram': 'ram', 'chevy': 'chevrolet', 'chevrolet': 'chevrolet', 'vw': 'volkswagen',
};
function canonicalMake(make) {
  const n = make.trim().toLowerCase();
  if (MAKE_TO_CANONICAL[n]) return MAKE_TO_CANONICAL[n];
  return n.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
}

const TESTS = [
  'Mercedes-Benz', 'Mercedes', 'Land Rover', 'Alfa Romeo', 'Aston Martin',
  'RAM', 'Ram', 'MINI', 'Toyota', 'Ford', 'BMW', 'smart', 'Rolls-Royce'
];

async function main() {
  const c = await pool.connect();
  try {
    console.log('Simulating safeResolver: ILIKE(make, canonicalMake(input)) — no wildcards = case-insensitive EXACT match\n');
    const rows = [];
    for (const input of TESTS) {
      const canon = canonicalMake(input);
      // safeResolver: ilike(make, canon)
      const exact = (await c.query(
        `SELECT COUNT(*)::int AS n FROM vehicle_fitments WHERE make ILIKE $1 AND certification_status='certified'`,
        [canon])).rows[0].n;
      // total certified records for any case/space variant of this brand
      const fuzzy = (await c.query(
        `SELECT COUNT(*)::int AS n FROM vehicle_fitments
         WHERE LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g')) = $1 AND certification_status='certified'`,
        [canon.toLowerCase()])).rows[0].n;
      rows.push({ input, canonical: canon, reachable_via_resolver: exact, total_brand_records: fuzzy, unreachable: fuzzy - exact });
    }
    console.table(rows);
    fs.writeFileSync(path.join(__dirname, 'ecosystem-audit-resolver-test.json'), JSON.stringify(rows, null, 2));
  } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e); process.exit(1); });
