/**
 * Package gap tracer — replicates src/lib/packages/engine.ts filter chain
 * locally against the techfeed gz feed and DB fitment rows, capturing the
 * exact rejection stage for every package-gap vehicle. READ-ONLY.
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

// ---- load techfeed wheels + build bolt index (mirrors wheels.ts) ----
const gz = fs.readFileSync(path.join(ROOT, 'src', 'techfeed', 'wheels_by_sku.json.gz'));
const bySku = JSON.parse(zlib.gunzipSync(gz).toString('utf8')).bySku || {};
const normalizeBp = bp => String(bp || '').toLowerCase().replace(/\s/g, '').replace(/[x-]/g, 'x').trim();
const idx = new Map();
const allTechfeedBps = new Map();
for (const w of Object.values(bySku)) {
  const bpRaw = w.bolt_pattern_metric || w.bolt_pattern_standard || '';
  for (const part of String(bpRaw).trim().split(/[\/,]/)) {
    const k = normalizeBp(part);
    if (!k) continue;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(w);
    allTechfeedBps.set(k, (allTechfeedBps.get(k) || 0) + 1);
  }
}
console.log('techfeed SKUs:', Object.keys(bySku).length, '| bolt keys:', idx.size);

// ---- pricing (mirrors calculateWheelSellPrice 35% model approximately) ----
// engine: calculateWheelSellPrice({map, msrp}) — read actual implementation
const pricingSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'pricing', 'pricingService.ts'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'pricing-src-snippet.txt'), pricingSrc.slice(0, 3000));
function sellPrice(w) {
  const map = Number(w.map_price) || null;
  const msrp = Number(w.msrp) || null;
  // Approximation of pricingService: cost=msrp*0.75 → cost*1.30 (≈ msrp*0.975), MAP passthrough if no msrp
  if (msrp && msrp > 0) return Math.min(msrp, msrp * 0.975);
  if (map && map > 0) return map;
  return 0;
}

// ---- engine helpers (mirrored) ----
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

// ---- fetch gap vehicles' DB rows ----
const gapRows = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-results.json')))
  .filter(r => r.category === 'A' && r.package_count === 0);
console.log('gap vehicles:', gapRows.length);

const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false }, max: 4 });
const ids = gapRows.map(r => r.id);
const dbRows = [];
for (let i = 0; i < ids.length; i += 1000) {
  const res = await pool.query(
    `SELECT id, year, make, model, display_trim, bolt_pattern, center_bore_mm::float bore,
            offset_min_mm::float omin, offset_max_mm::float omax,
            oem_wheel_sizes::text ws, oem_tire_sizes::text ts
     FROM vehicle_fitments WHERE id = ANY($1)`, [ids.slice(i, i + 1000)]);
  dbRows.push(...res.rows);
}
await pool.end();
console.log('db rows fetched:', dbRows.length);

// ---- replay engine per vehicle ----
const CATS = {
  daily_driver: { off: [0] },
  sport_aggressive: { off: [1, 2] },
  premium_look: { off: [2, 3] },
  offroad_lifted: { off: [0, 1, 2] },
};

const MODERN = /^[P]?\d{3}\/\d{2,3}[A-Z]*R\d{2}/i;
const results = [];
for (const v of dbRows) {
  const reasonsPerCat = {};
  const tireSizes = (() => { try { const j = JSON.parse(v.ts); return Array.isArray(j) ? j.filter(s => typeof s === 'string') : []; } catch { return []; } })();
  const diams = parseWheelEntryDiams(v.ws);
  const bpKey = normalizeBp(v.bolt_pattern || '');
  const candidates = idx.get(bpKey) || [];

  // route-level gate
  if (v.year < 1990) { results.push({ id: v.id, year: v.year, make: v.make, model: v.model, stage: 'route_year_gate', detail: 'API rejects year<1990' }); continue; }
  if (!candidates.length) {
    results.push({ id: v.id, year: v.year, make: v.make, model: v.model, stage: 'no_techfeed_candidates', detail: `bolt '${v.bolt_pattern}' key '${bpKey}' not in techfeed index` });
    continue;
  }

  const baseOem = Math.max(...(diams.length ? diams : [17]));
  const offMin = v.omin != null ? v.omin : 20;
  const offMax = v.omax != null ? v.omax : 50;
  const offsetDefaulted = v.omin == null || v.omax == null;
  const oemFirst = tireSizes.length ? parseTireSize(tireSizes[0]) : null;
  const oemOD = oemFirst ? overallDiam(oemFirst.width, oemFirst.aspectRatio, oemFirst.rimDiameter) : 28;

  let anyPackage = false;
  for (const [cat, cfg] of Object.entries(CATS)) {
    const targets = cfg.off.map(o => baseOem + o);
    let cDiam = 0, cOffset = 0, cPrice = 0;
    let best = null;
    for (const w of candidates) {
      const d = Number(w.diameter || 0);
      const off = Number(w.offset || 0);
      const price = sellPrice(w);
      if (!d || !price || price <= 0) { cPrice++; continue; }
      if (!targets.includes(d)) { cDiam++; continue; }
      if (off < offMin || off > offMax) { cOffset++; continue; }
      best = w; break; // existence is enough for trace
    }
    if (!best) {
      reasonsPerCat[cat] = cDiam >= cOffset && cDiam >= cPrice ? `diameter_filter(targets=${targets.join(',')})` : (cOffset >= cPrice ? `offset_filter(${offMin}..${offMax}${offsetDefaulted ? ' DEFAULTED' : ''})` : 'price_missing');
      continue;
    }
    // tire match
    const wd = Number(best.diameter);
    const matching = tireSizes.find(s => { const p = parseTireSize(s); return p && p.rimDiameter === wd; });
    let od;
    if (matching) { const p = parseTireSize(matching); od = overallDiam(p.width, p.aspectRatio, p.rimDiameter); }
    else {
      const ww = Number(best.width) || 8;
      const recW = Math.round(ww * 25.4 + 20);
      const side = (oemOD - wd) / 2;
      const ar = Math.round((side * 25.4 * 100) / recW);
      const snapA = [30, 35, 40, 45, 50, 55, 60, 65, 70].reduce((p2, c) => Math.abs(c - ar) < Math.abs(p2 - ar) ? c : p2);
      const snapW = [205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325].reduce((p2, c) => Math.abs(c - recW) < Math.abs(p2 - recW) ? c : p2);
      od = overallDiam(snapW, snapA, wd);
    }
    const change = Math.abs((od - oemOD) / oemOD * 100);
    const offOk = Number(best.offset || 0) >= offMin - 5 && Number(best.offset || 0) <= offMax + 5;
    if (change > 3) { reasonsPerCat[cat] = `validate_diameter(${change.toFixed(1)}% vs OEM ${oemOD.toFixed(1)}in)`; continue; }
    if (!offOk) { reasonsPerCat[cat] = 'validate_offset'; continue; }
    anyPackage = true;
  }
  if (!anyPackage) {
    // dominant per-vehicle reason = most common cat reason
    const rs = Object.values(reasonsPerCat);
    const dom = rs.sort((a, b) => rs.filter(x => x === b).length - rs.filter(x => x === a).length)[0] || 'unknown';
    results.push({ id: v.id, year: v.year, make: v.make, model: v.model, bolt: v.bolt_pattern, diams: diams.join('|'), omin: v.omin, omax: v.omax, stage: dom.split('(')[0], detail: dom, perCat: reasonsPerCat });
  } else {
    results.push({ id: v.id, year: v.year, make: v.make, model: v.model, stage: 'SHOULD_WORK', detail: 'local replay produces a package — prod failure may be availability/timeout/other' });
  }
}

const byStage = {};
for (const r of results) byStage[r.stage] = (byStage[r.stage] || 0) + 1;
console.log('\n=== Rejection stages (per vehicle) ===');
for (const [s, n] of Object.entries(byStage).sort((a, b) => b[1] - a[1])) console.log(`  ${s}: ${n}`);

fs.writeFileSync(path.join(__dirname, 'package-gap-trace.json'), JSON.stringify(results));
console.log('\nwrote package-gap-trace.json');

// Bolt key cross-check: gap bolts missing from techfeed
const missingBolts = {};
for (const r of results.filter(r => r.stage === 'no_techfeed_candidates')) {
  missingBolts[r.detail] = (missingBolts[r.detail] || 0) + 1;
}
const top = Object.entries(missingBolts).sort((a, b) => b[1] - a[1]).slice(0, 15);
if (top.length) { console.log('\n=== Missing bolt keys ==='); for (const [k, n] of top) console.log(`  ${n}× ${k}`); }
