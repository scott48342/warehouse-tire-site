// Pass 1 / step 1: NHTSA vPIC models per make × year (1990–2026) × vehicle type (car / MPV / truck).
// Every HTTP response is cached in ./cache; re-runs are offline. Writes table audit_pass1_nhtsa_models (dropped + rebuilt).
// Does NOT touch vehicle_fitments.
import fs from "node:fs";
import path from "node:path";
import { pool, cachedJson, compact, normMake, normGovMake, nhtsaMakeName, makeActiveInYear, stripNoise, YEAR_MIN, YEAR_MAX, EXTRA_MAKES, CACHE_DIR } from "./00-lib.mjs";

const TYPES = [
  ["car", "Passenger Car"],
  ["multipurpose passenger vehicle", "MPV"],
  ["truck", "Truck"],
];
const BASE = "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear";

const db = pool();
const makesRes = await db.query(`select distinct make from vehicle_fitments where quarantined_at is null and year >= $1`, [YEAR_MIN]);
const makeKeys = new Set(makesRes.rows.map((r) => normMake(r.make)));
for (const m of EXTRA_MAKES) makeKeys.add(m);
const makes = [...makeKeys].sort();
console.log(`makes to query: ${makes.length}\n  ${makes.join(", ")}`);

// job list
const jobs = [];
for (const mk of makes) {
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    if (!makeActiveInYear(mk, y)) continue;
    for (const [t] of TYPES) jobs.push({ mk, y, t });
  }
}
console.log(`jobs: ${jobs.length} (cached already: ${fs.readdirSync(CACHE_DIR).filter((f) => f.startsWith("nhtsa_")).length})`);

const rows = [];
const seenMakeNames = new Map(); // makeKey -> Map(Make_Name -> count) for diagnostics
const unresolved = new Map(); // makeKey -> years with zero exact-make results across all 3 types
let done = 0, failed = 0;
const t0 = Date.now();

async function runJob({ mk, y, t }) {
  const wanted = nhtsaMakeName(mk);
  const url = `${BASE}/make/${encodeURIComponent(wanted.toLowerCase())}/modelyear/${y}/vehicletype/${encodeURIComponent(t)}?format=json`;
  const key = `nhtsa_${mk}_${y}_${t.split(" ")[0]}`;
  let json;
  try {
    json = await cachedJson(key, url);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${mk} ${y} ${t}: ${e.message}`);
    return;
  }
  const results = json?.Results ?? [];
  let hit = 0;
  for (const r of results) {
    const mn = String(r.Make_Name ?? "");
    const ok = compact(mn) === compact(wanted) || normGovMake(mn) === mk;
    if (!seenMakeNames.has(mk)) seenMakeNames.set(mk, new Map());
    seenMakeNames.get(mk).set(mn, (seenMakeNames.get(mk).get(mn) ?? 0) + 1);
    if (!ok) continue;
    hit++;
    const raw = String(r.Model_Name ?? "").trim();
    rows.push({
      year: y,
      make_norm: mk,
      make_raw: mn,
      model_raw: raw,
      model_norm: compact(stripNoise(raw)) || compact(raw),
      vehicle_type: TYPES.find(([tt]) => tt === t)[1],
      model_id: r.Model_ID ?? null,
    });
  }
  if (hit === 0 && results.length > 0) {
    if (!unresolved.has(mk)) unresolved.set(mk, new Set());
    unresolved.get(mk).add(y);
  }
}

// simple worker pool (cachedJson also caps concurrency at 4)
let idx = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    await runJob(j);
    done++;
    if (done % 250 === 0) console.log(`  ${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}s, rows ${rows.length}, failed ${failed})`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
console.log(`fetch done: ${done} jobs, ${failed} failed, ${rows.length} model rows in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// diagnostics: makes where our chosen NHTSA name never matched
for (const [mk, years] of unresolved) {
  const names = [...(seenMakeNames.get(mk) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n}(${c})`);
  const matched = rows.some((r) => r.make_norm === mk);
  if (!matched) console.log(`  UNRESOLVED make ${mk} (wanted "${nhtsaMakeName(mk)}"): saw ${names.join(", ")}`);
}
const byMake = {};
for (const r of rows) byMake[r.make_norm] = (byMake[r.make_norm] ?? 0) + 1;
console.log("rows by make:", JSON.stringify(byMake));

// load table
await db.query(`drop table if exists audit_pass1_nhtsa_models`);
await db.query(`create table audit_pass1_nhtsa_models (
  year int not null, make_norm text not null, make_raw text, model_raw text not null, model_norm text not null,
  vehicle_type text not null, model_id int, fetched_at timestamptz default now())`);
const dedup = new Map();
for (const r of rows) dedup.set(`${r.year}|${r.make_norm}|${r.model_raw}|${r.vehicle_type}`, r);
const uniq = [...dedup.values()];
const B = 500;
for (let i = 0; i < uniq.length; i += B) {
  const chunk = uniq.slice(i, i + B);
  const vals = [], params = [];
  chunk.forEach((r, k) => {
    const o = k * 7;
    vals.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7})`);
    params.push(r.year, r.make_norm, r.make_raw, r.model_raw, r.model_norm, r.vehicle_type, r.model_id);
  });
  await db.query(`insert into audit_pass1_nhtsa_models (year, make_norm, make_raw, model_raw, model_norm, vehicle_type, model_id) values ${vals.join(",")}`, params);
}
await db.query(`create index on audit_pass1_nhtsa_models (make_norm, year)`);
const n = (await db.query(`select count(*)::int c, count(distinct (make_norm, model_norm))::int mm from audit_pass1_nhtsa_models`)).rows[0];
console.log(`audit_pass1_nhtsa_models: ${n.c} rows, ${n.mm} distinct make+model`);
fs.writeFileSync(path.join(CACHE_DIR, "_nhtsa_summary.json"), JSON.stringify({ jobs: jobs.length, failed, rows: uniq.length, byMake, unresolved: [...unresolved.keys()] }, null, 2));
await db.end();
