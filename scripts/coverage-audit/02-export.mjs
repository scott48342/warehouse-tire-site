/**
 * Coverage audit step 1: export all certified records with parsed
 * search inputs, build equivalence classes, write plan files.
 * READ-ONLY against DB.
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false }, max: 4 });

const res = await pool.query(`
  SELECT id, year, make, model, display_trim, raw_trim, modification_id,
         bolt_pattern, center_bore_mm::float AS center_bore,
         oem_wheel_sizes::text AS ws_raw, oem_tire_sizes::text AS ts_raw
  FROM vehicle_fitments
  WHERE certification_status = 'certified'
  ORDER BY make, model, year`);
console.log('rows:', res.rows.length);
await pool.end();

function parseTireSizes(raw) {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    return [...new Set(j.filter(s => typeof s === 'string' && s.trim()))].sort();
  } catch { return []; }
}
function parseWheelDiameters(raw) {
  // handles: ["15x6"] strings, {diameter,width,...} objects
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    const d = new Set();
    for (const e of j) {
      if (typeof e === 'string') {
        const mm = e.match(/^(\d{2})\s*x/i);
        if (mm) d.add(parseInt(mm[1]));
      } else if (e && typeof e === 'object' && Number.isFinite(e.diameter)) {
        d.add(Math.round(e.diameter));
      }
    }
    return [...d].sort((a, b) => a - b);
  } catch { return []; }
}
// Modern tire size → usable for product search (vintage like F70-14 won't match suppliers)
const MODERN = /^\d{3}\/\d{2,3}Z?R\d{2}/i;

const vehicles = [];
for (const r of res.rows) {
  const tireSizes = parseTireSizes(r.ts_raw);
  const wheelDiams = parseWheelDiameters(r.ws_raw);
  vehicles.push({
    id: r.id, year: r.year, make: r.make, model: r.model,
    trim: r.display_trim || r.raw_trim || '',
    modificationId: r.modification_id || '',
    boltPattern: (r.bolt_pattern || '').trim(),
    centerBore: r.center_bore,
    tireSizes, wheelDiams,
    modernTireSizes: tireSizes.filter(s => MODERN.test(s)),
  });
}

// Equivalence classes
const tireSizeSet = new Set();
const wheelClasses = new Map();   // bolt|diams -> {key, rep, memberCount}
const fullClasses = new Map();    // bolt|bore|diams|tires -> {key, rep, members[]}
for (const v of vehicles) {
  for (const s of v.modernTireSizes) tireSizeSet.add(s);
  const wKey = `${v.boltPattern}|${v.wheelDiams.join(',')}`;
  if (!wheelClasses.has(wKey)) wheelClasses.set(wKey, { key: wKey, rep: v, n: 0 });
  wheelClasses.get(wKey).n++;
  const fKey = `${v.boltPattern}|${v.centerBore}|${v.wheelDiams.join(',')}|${v.tireSizes.join(',')}`;
  if (!fullClasses.has(fKey)) fullClasses.set(fKey, { key: fKey, rep: v, n: 0 });
  fullClasses.get(fKey).n++;
  v.wheelClass = wKey;
  v.fullClass = fKey;
}

console.log('vehicles:', vehicles.length);
console.log('distinct modern tire sizes:', tireSizeSet.size);
console.log('wheel classes (bolt|diams):', wheelClasses.size);
console.log('full classes:', fullClasses.size);
console.log('vehicles with NO modern tire size:', vehicles.filter(v => v.modernTireSizes.length === 0).length);
console.log('vehicles with NO wheel diameters:', vehicles.filter(v => v.wheelDiams.length === 0).length);
console.log('vehicles missing bolt pattern:', vehicles.filter(v => !v.boltPattern).length);

fs.writeFileSync(path.join(OUT, 'vehicles.json'), JSON.stringify(vehicles));
fs.writeFileSync(path.join(OUT, 'plan-tire-sizes.json'), JSON.stringify([...tireSizeSet].sort()));
fs.writeFileSync(path.join(OUT, 'plan-wheel-classes.json'), JSON.stringify([...wheelClasses.values()].map(c => ({ key: c.key, n: c.n, rep: { year: c.rep.year, make: c.rep.make, model: c.rep.model, trim: c.rep.trim, modificationId: c.rep.modificationId } }))));
fs.writeFileSync(path.join(OUT, 'plan-full-classes.json'), JSON.stringify([...fullClasses.values()].map(c => ({ key: c.key, n: c.n, rep: { year: c.rep.year, make: c.rep.make, model: c.rep.model, trim: c.rep.trim, modificationId: c.rep.modificationId } }))));
console.log('plans written.');
