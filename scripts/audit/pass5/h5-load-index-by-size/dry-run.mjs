#!/usr/bin/env node
// H5 Option A - per-size OE load index: SOURCE DIFF (dry run by default).
//
//   node --env-file=.env.local scripts/audit/pass5/h5-load-index-by-size/dry-run.mjs
//   node --env-file=.env.local scripts/audit/pass5/h5-load-index-by-size/dry-run.mjs --apply --approved-by scott
//
// READ-ONLY unless --apply AND --approved-by scott are both given (and migration 0051 has been applied).
// Never call US AutoForce from here: it reads ONLY the SOAP responses cached by pass 4 on 2026-09-17
// (scripts/audit/pass4/usaf-load-index/cache/_options.jsonl, kept in the MAIN checkout) plus the pass-2
// name map. Rows whose Y/M/M is not in the cache are reported as `no_cache` for a later, separately
// approved fetch.
//
// Output (scripts/audit/pass5/h5-load-index-by-size/out/):
//   proposal.jsonl   one line per row that would receive a per-size map
//   summary.json     counts by category + the headline safety numbers
//   diff.csv         human-readable: ymm | trim | stored scalar | proposed map | max | rear>stored? | source
//
// Apply semantics (when authorised): sets oem_load_index_by_size, oem_speed_rating_by_size,
// load_index_by_size_source, load_index_by_size_verified_at=now(). DOES NOT touch oem_load_index /
// load_index_source (Scott decides the scalar re-stamp separately - option A recommends max(by_size)).
// Snapshots the pre-apply scalar fields to audit_h5_load_index_by_size_original first.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const APPLY = args.includes("--apply");
const APPROVED = arg("--approved-by", "") === "scott";
const LIMIT = Number(arg("--limit", 0));
const MAIN = arg("--main", "F:\\clawd\\warehouse-tire-site"); // read-only: cached USAF payloads live here
const OPTIONS_FILE = arg("--cache", path.join(MAIN, "scripts", "audit", "pass4", "usaf-load-index", "cache", "_options.jsonl"));
const PASS2_CACHE = arg("--names", path.join(MAIN, "scripts", "audit", "pass2", "cache"));
const OUT_DIR = path.join(HERE, "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

if (APPLY && !APPROVED) { console.error("Refusing: --apply requires --approved-by scott"); process.exit(2); }

// --------------------------------------------------------------- helpers (copied from pass2/lib.mjs, kept local)
function normTire(raw) {
  if (raw == null) return null;
  const s = String(raw).toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  let m = s.match(/^(\d{2}(?:\.\d)?)X(\d{1,2}(?:\.\d{1,2})?)(?:Z?R|-)?(\d{2}(?:\.5)?)(?:LT)?(?:\/[A-H])?$/);
  if (m) return `${m[1]}X${Number(m[2]).toFixed(2)}R${m[3]}`;
  m = s.match(/^(?:P|LT|T|ST)?(\d{3})\/(\d{2,3})(?:[A-Z]{1,2})?R(?:F)?(\d{2}(?:\.5)?)(?:LT|C)?(?:\/[A-H])?(?:\d{2,3}(?:\/\d{2,3})?[A-Z]?)?(?:XL|RF|SL)?$/);
  if (m) return `${m[1]}/${m[2]}R${m[3]}`;
  return null;
}
function ourTireList(v) {
  if (v == null) return [];
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith("[") || t.startsWith("{")) { try { return ourTireList(JSON.parse(t)); } catch { /* fallthrough */ } }
    return t.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap((x) => (typeof x === "string" ? [x] : x && typeof x === "object" ? ourTireList(x) : [])).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "object") return [...ourTireList(v.front), ...ourTireList(v.rear)];
  return [];
}
const axleSplit = (v) => {
  // Returns {front:[], rear:[]} when the record stores an explicit split, else null.
  let o = v;
  if (typeof o === "string" && o.trim().startsWith("{")) { try { o = JSON.parse(o); } catch { return null; } }
  if (o && typeof o === "object" && !Array.isArray(o) && (o.front || o.rear)) return { front: ourTireList(o.front), rear: ourTireList(o.rear) };
  return null;
};
const rimOf = (s) => { const m = String(s).match(/R(\d{2}(?:\.5)?)$/); return m ? Number(m[1]) : null; };
const optKey = (y, mk, md) => `${y}|${String(mk).toLowerCase()}|${String(md).toLowerCase()}`;

// --------------------------------------------------------------- caches (read-only)
if (!fs.existsSync(OPTIONS_FILE)) { console.error(`USAF options cache not found: ${OPTIONS_FILE}`); process.exit(2); }
const optCache = new Map();
for (const line of fs.readFileSync(OPTIONS_FILE, "utf8").split(/\r?\n/)) {
  if (!line) continue;
  try { const r = JSON.parse(line); optCache.set(optKey(r.year, r.make, r.model), r); } catch { /* skip */ }
}
const names = new Map(); // our "year|make|model" -> [{make_usaf, model_usaf}]
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith(".json") || e.name.startsWith("_")) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j.status === "matched" && Array.isArray(j.matched) && j.matched.length) names.set(`${j.year}|${j.make}|${j.model}`, j.matched.map((m) => ({ make_usaf: m.make_usaf, model_usaf: m.model_usaf })));
    } catch { /* skip */ }
  }
})(PASS2_CACHE);
console.log(`cached USAF payloads: ${optCache.size} | pass2 matched Y/M/M: ${names.size} | mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

// --------------------------------------------------------------- DB (read-only unless APPLY)
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, a) => (await pool.query(s, a)).rows;

const rows = await q(`select id, year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes, oem_load_index, oem_speed_rating, load_index_source
                      from vehicle_fitments where quarantined_at is null order by year, make, model, display_trim ${LIMIT ? `limit ${LIMIT}` : ""}`);
console.log(`live rows: ${rows.length}`);

const R = { proposal: [], no_ymm: 0, no_cache: 0, no_size: 0, partial: [], none_match: 0, li_zero: 0, tg_rows_kept_scalar: 0 };
const safety = { rows_with_map: 0, multi_size_rows: 0, scalar_is_first: 0, scalar_below_max: 0, staggered_rows: 0, staggered_rear_gt_stored: 0, staggered_examples: [] };

for (const row of rows) {
  const key = `${row.year}|${String(row.make).toLowerCase()}|${String(row.model).toLowerCase()}`;
  const nm = names.get(key);
  if (!nm) { R.no_ymm++; continue; }
  const opts = [];
  let anyCached = false;
  for (const m of nm) { const rec = optCache.get(optKey(row.year, m.make_usaf, m.model_usaf)); if (rec) { anyCached = true; if (rec.ok) opts.push(...rec.opts); } }
  if (!anyCached) { R.no_cache++; continue; }
  const oursRaw = ourTireList(row.oem_tire_sizes);
  const ours = oursRaw.map(normTire).filter(Boolean);
  if (!ours.length) { R.no_size++; continue; }

  // Per-size map from USAF: size -> {li, sp, src}
  const bySize = {}; const spBySize = {}; let anyMax = false;
  const missing = [];
  for (const size of [...new Set(ours)]) {
    const hit = opts.filter((o) => normTire(o.size) === size);
    const lis = [...new Set(hit.map((o) => Number(o.li)).filter((n) => n >= 60 && n <= 140))];
    if (!hit.length) { missing.push(size); continue; }
    if (!lis.length) { R.li_zero++; missing.push(size); continue; } // USAF reports LI 0 for vintage VR sizes
    const li = Math.max(...lis); if (lis.length > 1) anyMax = true;
    const sps = [...new Set(hit.filter((o) => Number(o.li) === li).map((o) => o.sp).filter(Boolean))];
    bySize[size] = li; if (sps.length === 1) spBySize[size] = sps[0];
  }
  const covered = Object.keys(bySize).length;
  if (covered === 0) { R.none_match++; continue; }
  if (missing.length) R.partial.push({ id: row.id, ymm: `${row.year} ${row.make} ${row.model} [${row.display_trim}]`, missing });

  const max = Math.max(...Object.values(bySize));
  // Axle split: explicit {front, rear} tire object, else axle-tagged oem_wheel_sizes mapped to tire sizes by rim diameter
  // (this is how the resolver/tires-search decide oemStaggered today - see src/lib/fitment/oeStagger.ts).
  let split = axleSplit(row.oem_tire_sizes);
  if (!split) {
    let ws = row.oem_wheel_sizes; if (typeof ws === "string") { try { ws = JSON.parse(ws); } catch { ws = null; } }
    if (Array.isArray(ws)) {
      const fd = new Set(ws.filter((w) => w && w.axle === "front" && Number(w.diameter) > 0).map((w) => Number(w.diameter)));
      const rd = new Set(ws.filter((w) => w && w.axle === "rear" && Number(w.diameter) > 0).map((w) => Number(w.diameter)));
      if (fd.size && rd.size && [...rd].some((d) => !fd.has(d))) {
        split = { front: ours.filter((s) => fd.has(rimOf(s))), rear: ours.filter((s) => rd.has(rimOf(s))), via: "wheel_axle_tags" };
      }
    }
  }
  const stored = row.oem_load_index;
  const entry = {
    id: row.id, ymm: `${row.year} ${row.make} ${row.model} [${row.display_trim}]`, trim: row.display_trim,
    sizes: ours, by_size: bySize, sp_by_size: spBySize, max_li: max, stored_li: stored, stored_source: row.load_index_source,
    source: anyMax ? "usaf-max" : "usaf", coverage: `${covered}/${new Set(ours).size}`, complete: missing.length === 0,
    staggered: split ? { front: split.front.map(normTire).filter(Boolean), rear: split.rear.map(normTire).filter(Boolean), via: split.via || "tire_object" } : null,
  };
  // Safety numbers for Scott's decision
  safety.rows_with_map++;
  if (new Set(ours).size > 1) safety.multi_size_rows++;
  if (stored != null && bySize[ours[0]] === stored) safety.scalar_is_first++;
  if (stored != null && stored < max) safety.scalar_below_max++;
  if (split && split.front.length && split.rear.length) {
    safety.staggered_rows++;
    const rearMax = Math.max(...split.rear.map(normTire).map((s) => bySize[s] ?? -1));
    if (stored != null && rearMax > stored) { safety.staggered_rear_gt_stored++; if (safety.staggered_examples.length < 12) safety.staggered_examples.push({ ymm: entry.ymm, stored, rear_li: rearMax, by_size: bySize }); }
  }
  if (row.load_index_source === "tireguide-pro" || row.load_index_source === "tireguide-print") R.tg_rows_kept_scalar++;
  R.proposal.push(entry);
}

// --------------------------------------------------------------- outputs
fs.writeFileSync(path.join(OUT_DIR, "proposal.jsonl"), R.proposal.map((p) => JSON.stringify(p)).join("\n") + "\n");
const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(OUT_DIR, "diff.csv"), [
  ["id", "ymm", "trim", "stored_li", "stored_source", "proposed_by_size", "max_li", "coverage", "staggered", "rear_gt_stored", "source"].join(","),
  ...R.proposal.map((p) => {
    const rearGt = p.staggered && p.stored_li != null ? Math.max(...p.staggered.rear.map((s) => p.by_size[s] ?? -1)) > p.stored_li : "";
    return [p.id, p.ymm, p.trim, p.stored_li, p.stored_source, JSON.stringify(p.by_size), p.max_li, p.coverage, p.staggered ? "yes" : "", rearGt, p.source].map(csvEsc).join(",");
  }),
].join("\n"));
const summary = {
  generated_at: new Date().toISOString(), mode: APPLY ? "apply" : "dry-run",
  live_rows: rows.length, proposals: R.proposal.length, complete_maps: R.proposal.filter((p) => p.complete).length, partial_maps: R.partial.length,
  skipped: { no_pass2_match: R.no_ymm, no_cached_payload: R.no_cache, no_oe_size: R.no_size, no_size_matched_at_usaf: R.none_match, li_zero_sizes: R.li_zero },
  tireguide_rows_scalar_kept: R.tg_rows_kept_scalar,
  safety,
  note: "DRY RUN writes nothing. --apply requires --approved-by scott and migration 0051. oem_load_index (scalar) is never changed by this script.",
};
fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, safety: { ...safety, staggered_examples: safety.staggered_examples.slice(0, 4) } }, null, 2));

// --------------------------------------------------------------- apply (guarded)
if (APPLY) {
  const cols = await q(`select 1 from information_schema.columns where table_name='vehicle_fitments' and column_name='oem_load_index_by_size'`);
  if (!cols.length) { console.error("Refusing: migration 0051 not applied (oem_load_index_by_size missing)"); await pool.end(); process.exit(2); }
  await pool.query(`create table if not exists audit_h5_load_index_by_size_original as
                    select id, oem_load_index, load_index_source, load_index_verified_at, now() as captured_at from vehicle_fitments where false`);
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const p of R.proposal) {
      await client.query(`insert into audit_h5_load_index_by_size_original (id, oem_load_index, load_index_source, load_index_verified_at, captured_at)
                          select id, oem_load_index, load_index_source, load_index_verified_at, now() from vehicle_fitments where id=$1`, [p.id]);
      await client.query(`update vehicle_fitments set oem_load_index_by_size=$2::jsonb, oem_speed_rating_by_size=$3::jsonb,
                          load_index_by_size_source=$4, load_index_by_size_verified_at=now() where id=$1`,
        [p.id, JSON.stringify(p.by_size), JSON.stringify(p.sp_by_size), p.source]);
    }
    await client.query("commit");
    console.log(`APPLIED ${R.proposal.length} rows`);
  } catch (e) { await client.query("rollback"); console.error("apply failed, rolled back:", e.message); process.exitCode = 1; } finally { client.release(); }
}
await pool.end();
