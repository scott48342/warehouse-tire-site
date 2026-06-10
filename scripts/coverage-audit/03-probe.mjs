/**
 * Coverage audit step 2: probe product availability per equivalence class.
 * READ-ONLY: GET requests against production APIs + SQL SELECTs only.
 *
 * - Tire availability per distinct modern tire size (595)
 * - Wheel availability per wheel class rep (532)
 * - Package availability per wheel class rep where wheels > 0
 * - Checkpoints to probe-state.json (resumable)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.AUDIT_BASE_URL || 'https://shop.warehousetiredirect.com';
const STATE_FILE = path.join(__dirname, 'probe-state.json');
const LOG = path.join(__dirname, 'probe-progress.log');

const tireSizes = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan-tire-sizes.json')));
const wheelClasses = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan-wheel-classes.json')));

let state = { tires: {}, wheels: {}, packages: {} };
if (fs.existsSync(STATE_FILE)) state = JSON.parse(fs.readFileSync(STATE_FILE));
let dirty = 0;
function save(force) {
  if (++dirty >= 10 || force) { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); dirty = 0; }
}
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, timeoutMs = 60000) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429) { await sleep(15000 * attempt); continue; }
      if (!res.ok) return { __status: res.status };
      return await res.json();
    } catch (e) {
      if (attempt === 3) return { __error: String(e.message || e).slice(0, 120) };
      await sleep(5000 * attempt);
    }
  }
}

// ---- Phase T: tire availability per size ----
log(`Phase T: ${tireSizes.length} tire sizes (done: ${Object.keys(state.tires).length})`);
for (const size of tireSizes) {
  if (state.tires[size] !== undefined) continue;
  const j = await getJson(`${BASE}/api/tires/search?size=${encodeURIComponent(size)}&pageSize=1`);
  let count = -1, err = null;
  if (j.__error || j.__status) err = j.__error || `http_${j.__status}`;
  else count = Number(j.totalCount ?? j.total ?? (Array.isArray(j.results) ? j.results.length : 0)) || (Array.isArray(j.results) ? j.results.length : 0);
  state.tires[size] = err ? { count: -1, err } : { count };
  save();
  const done = Object.keys(state.tires).length;
  if (done % 25 === 0) log(`  tires ${done}/${tireSizes.length}`);
  await sleep(1200);
}
save(true);
log(`Phase T complete. sizes with results: ${Object.values(state.tires).filter(t => t.count > 0).length}/${tireSizes.length}`);

// ---- Phase W: wheel availability per wheel class ----
log(`Phase W: ${wheelClasses.length} wheel classes (done: ${Object.keys(state.wheels).length})`);
for (const wc of wheelClasses) {
  if (state.wheels[wc.key] !== undefined) continue;
  const r = wc.rep;
  const u = `${BASE}/api/wheels/fitment-search?year=${r.year}&make=${encodeURIComponent(r.make)}&model=${encodeURIComponent(r.model)}&trim=${encodeURIComponent(r.modificationId || r.trim)}&pageSize=1`;
  const j = await getJson(u, 90000);
  let count = -1, err = null;
  if (j.__error || j.__status) err = j.__error || `http_${j.__status}`;
  else count = Number(j.totalCount ?? 0);
  state.wheels[wc.key] = err ? { count: -1, err, rep: r } : { count, rep: r };
  save();
  const done = Object.keys(state.wheels).length;
  if (done % 25 === 0) log(`  wheels ${done}/${wheelClasses.length}`);
  await sleep(900);
}
save(true);
log(`Phase W complete. classes with wheels: ${Object.values(state.wheels).filter(w => w.count > 0).length}/${wheelClasses.length}`);

// ---- Phase P: packages per wheel class rep (only where wheels could exist) ----
const pkgTargets = wheelClasses.filter(wc => (state.wheels[wc.key]?.count ?? 0) !== 0);
log(`Phase P: ${pkgTargets.length} package probes (done: ${Object.keys(state.packages).length})`);
for (const wc of pkgTargets) {
  if (state.packages[wc.key] !== undefined) continue;
  const r = wc.rep;
  const u = `${BASE}/api/packages/recommended?year=${r.year}&make=${encodeURIComponent(r.make)}&model=${encodeURIComponent(r.model)}&trim=${encodeURIComponent(r.modificationId || r.trim)}`;
  const j = await getJson(u, 90000);
  let count = -1, err = null;
  if (j.__error || j.__status) err = j.__error || `http_${j.__status}`;
  else count = Array.isArray(j.packages) ? j.packages.length : 0;
  state.packages[wc.key] = err ? { count: -1, err } : { count };
  save();
  const done = Object.keys(state.packages).length;
  if (done % 25 === 0) log(`  packages ${done}/${pkgTargets.length}`);
  await sleep(1200);
}
save(true);
log(`Phase P complete. classes with packages: ${Object.values(state.packages).filter(p => p.count > 0).length}/${pkgTargets.length}`);
log('PROBE DONE');
