/**
 * Replay the package engine WITH the fixes applied, against the same
 * 3,286 gap vehicles, to estimate recovery. READ-ONLY.
 * Fixes simulated:
 *  1. route year gate 1990 → 1940
 *  2. per-rim OEM overall-diameter baseline
 *  3. offset pre-filter widened to ±5mm (validateFitment parity)
 *  4. diameter fallback to nearest available inventory diameter (OEM-1..OEM+3)
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);

const gz = fs.readFileSync(path.join(ROOT, 'src', 'techfeed', 'wheels_by_sku.json.gz'));
const bySku = JSON.parse(zlib.gunzipSync(gz).toString('utf8')).bySku || {};
const normalizeBp = bp => String(bp || '').toLowerCase().replace(/\s/g, '').replace(/[x-]/g, 'x').trim();
const idx = new Map();
for (const w of Object.values(bySku)) {
  const bpRaw = w.bolt_pattern_metric || w.bolt_pattern_standard || '';
  for (const part of String(bpRaw).trim().split(/[\/,]/)) {
    const k = normalizeBp(part);
    if (!k) continue;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(w);
  }
}

function parseTireSize(size) {
  let mm = size.match(/^[P]?(\d{3})\/(\d{2,3})[A-Z]*R(\d{2})/i);
  if (mm) return { width: +mm[1], aspectRatio: +mm[2], rimDiameter: +mm[3] };
  mm = size.match(/^(\d{2,3})[xX](\d+\.?\d*)R(\d{2})/);
  if (mm) {
    const od = parseFloat(mm[1]), sw = parseFloat(mm[2]), rim = +mm[3];
    return { width: Math.round(sw * 25.4), aspectRatio: Math.round(((od - rim) / 2 / sw) * 100), rimDiameter: rim };
  }
  return null;
}
const overallDiam = (w, ar, rim) => rim + 2 * (w * (ar / 100) / 25.4);
function sellPrice(w) {
  const map = Number(w.map_price) || null;
  const msrp = Number(w.msrp) || null;
  if (msrp && msrp > 0) return Math.min(msrp, msrp * 0.975);
  if (map && map > 0) return map;
  return 0;
}
function parseWheelEntryDiams(raw) {
  try {
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    const out = [];
    for (const e of j) {
      if (typeof e === 'string') { const mm = e.match(/^(\d{2})\s*x/i); if (mm) out.push(+mm[1]); }
      else if (e && Number.isFinite(e.diameter)) out.push(Math.round(e.diameter));
    }
    return [...new Set(out)].sort((a, b) => a - b);
  } catch { return []; }
}

const gapRows = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-results.json')))
  .filter(r => r.category === 'A' && r.package_count === 0);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false }, max: 4 });
const ids = gapRows.map(r => r.id);
const dbRows = [];
for (let i = 0; i < ids.length; i += 1000) {
  const res = await pool.query(
    `SELECT id, year, make, model, bolt_pattern, offset_min_mm::float omin, offset_max_mm::float omax,
            oem_wheel_sizes::text ws, oem_tire_sizes::text ts
     FROM vehicle_fitments WHERE id = ANY($1)`, [ids.slice(i, i + 1000)]);
  dbRows.push(...res.rows);
}
await pool.end();

const CATS = {
  daily_driver: { off: [0] },
  sport_aggressive: { off: [1, 2] },
  premium_look: { off: [2, 3] },
  offroad_lifted: { off: [0, 1, 2] },
};

let recovered = 0, stillFailing = 0;
const stillByReason = {};
for (const v of dbRows) {
  if (v.year < 1940) { stillFailing++; stillByReason['year<1940'] = (stillByReason['year<1940'] || 0) + 1; continue; }
  const tireSizes = (() => { try { const j = JSON.parse(v.ts); return Array.isArray(j) ? j.filter(s => typeof s === 'string') : []; } catch { return []; } })();
  const diams = parseWheelEntryDiams(v.ws);
  const candidates = idx.get(normalizeBp(v.bolt_pattern || '')) || [];
  if (!candidates.length) { stillFailing++; stillByReason['no_candidates'] = (stillByReason['no_candidates'] || 0) + 1; continue; }

  const baseOem = Math.max(...(diams.length ? diams : [17]));
  const offMin = v.omin != null ? v.omin : 20;
  const offMax = v.omax != null ? v.omax : 50;
  const oemFirst = tireSizes.length ? parseTireSize(tireSizes[0]) : null;
  const oemOD = oemFirst ? overallDiam(oemFirst.width, oemFirst.aspectRatio, oemFirst.rimDiameter) : 28;
  // per-rim baselines (fix 2)
  const byRim = {};
  for (const s of tireSizes) {
    const p = parseTireSize(s);
    if (!p) continue;
    const od = overallDiam(p.width, p.aspectRatio, p.rimDiameter);
    if (byRim[p.rimDiameter] == null || od > byRim[p.rimDiameter]) byRim[p.rimDiameter] = od;
  }
  const baseline = rim => {
    if (byRim[rim] != null) return byRim[rim];
    const rims = Object.keys(byRim).map(Number);
    if (rims.length) { const c = rims.reduce((a, b) => Math.abs(b - rim) < Math.abs(a - rim) ? b : a); return byRim[c]; }
    return oemOD;
  };
  const availDiams = [...new Set(candidates.map(w => Number(w.diameter || 0)).filter(d => d > 0))];

  let any = false;
  for (const cfg of Object.values(CATS)) {
    let targetSets = [cfg.off.map(o => baseOem + o)];
    // fix 4: fallback diameters
    targetSets.push(availDiams.filter(d => d >= baseOem - 1 && d <= baseOem + 3 && !targetSets[0].includes(d)));
    for (const targets of targetSets) {
      if (!targets.length) continue;
      for (const w of candidates) {
        const d = Number(w.diameter || 0);
        const off = Number(w.offset || 0);
        const price = sellPrice(w);
        if (!d || !price || price <= 0) continue;
        if (!targets.includes(d)) continue;
        if (off < offMin - 5 || off > offMax + 5) continue; // fix 3
        // tire match (engine logic)
        const matching = tireSizes.find(s => { const p = parseTireSize(s); return p && p.rimDiameter === d; });
        let od;
        if (matching) { const p = parseTireSize(matching); od = overallDiam(p.width, p.aspectRatio, p.rimDiameter); }
        else {
          const ww = Number(w.width) || 8;
          const recW = Math.round(ww * 25.4 + 20);
          const side = (oemOD - d) / 2;
          const ar = Math.round((side * 25.4 * 100) / recW);
          const snapA = [30, 35, 40, 45, 50, 55, 60, 65, 70].reduce((p2, c) => Math.abs(c - ar) < Math.abs(p2 - ar) ? c : p2);
          const snapW = [205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325].reduce((p2, c) => Math.abs(c - recW) < Math.abs(p2 - recW) ? c : p2);
          od = overallDiam(snapW, snapA, d);
        }
        const b = baseline(d); // fix 2
        if (Math.abs((od - b) / b * 100) > 3) continue;
        any = true; break;
      }
      if (any) break;
    }
    if (any) break;
  }
  if (any) recovered++;
  else {
    stillFailing++;
    stillByReason['filters'] = (stillByReason['filters'] || 0) + 1;
  }
}
console.log(`gap vehicles: ${dbRows.length}`);
console.log(`recovered with fixes: ${recovered} (${(100 * recovered / dbRows.length).toFixed(1)}%)`);
console.log(`still failing: ${stillFailing}`, stillByReason);
