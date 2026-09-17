// Pass 4 / USAF load index: fill oem_load_index + oem_speed_rating DB-wide from US AutoForce GetVehicleOptions.
//
// Reuses the Pass 2 name resolution (scripts/audit/pass2/cache/{year}/{make}/{model}.json -> matched[].model_usaf) so we
// call USAF with the exact model names that already matched on 2026-09-15, and re-fetch the FULL option rows
// (TireSize, LoadIndex, SpeedRate, RimSize + the currently-empty FrontInf/RearInf/WBC/TRQ1) straight from SOAP.
//
// Rules (Scott approved 2026-09-17 09:59 "run to get the data they do have for us"):
//  - primary OE size = first entry of oem_tire_sizes; match it (normTire) against USAF options for the Y/M/M
//  - fill only when all matching USAF rows agree on ONE load index; speed rating stored only when unique
//  - never overwrite tireguide-pro values; log disagreements instead
//  - provenance: load_index_source='usaf', load_index_verified_at=now()
//  - rollback: update vehicle_fitments set oem_load_index=null, oem_speed_rating=null, load_index_source=null,
//              load_index_verified_at=null where load_index_source='usaf'
//
// Usage: node --env-file=.env.local scripts/audit/pass4/usaf-load-index/run.mjs [--fetch-only] [--apply] [--conc 3] [--gap 150] [--limit N]
// Resumable: every SOAP call cached in cache/_options.jsonl (positive + negative).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { normTire, ourTireList } from "../../pass2/lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PASS2_CACHE = path.join(HERE, "..", "..", "pass2", "cache");
const CACHE_DIR = path.join(HERE, "cache");
const OPTIONS_FILE = path.join(CACHE_DIR, "_options.jsonl");
const OUT_DIR = path.join(HERE, "out");
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const APPLY = args.includes("--apply");
const FETCH_ONLY = args.includes("--fetch-only");
const CONC = Number(arg("--conc", 3));
const GAP = Number(arg("--gap", 150));
const LIMIT = Number(arg("--limit", 0));

// ---------------------------------------------------------------- USAF SOAP
const user = process.env.USAUTOFORCE_USERNAME, pass = process.env["USAUTOFORCE_" + "PASSWORD"];
if (!user || !pass) throw new Error("USAUTOFORCE_USERNAME/PASSWORD missing - run with --env-file=.env.local");
const URL_ = user.toLowerCase().includes("test") ? "https://servicesstage.usautoforce.com/integrationservice.asmx" : "https://services.usautoforce.com/integrationservice.asmx";
const NS = "https://services.usautoforce.com";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const optCache = new Map();
const optKey = (y, mk, md) => `${y}|${mk.toLowerCase()}|${md.toLowerCase()}`;
if (fs.existsSync(OPTIONS_FILE)) for (const line of fs.readFileSync(OPTIONS_FILE, "utf8").split(/\r?\n/)) { if (!line) continue; try { const r = JSON.parse(line); optCache.set(optKey(r.year, r.make, r.model), r); } catch { /* skip */ } }

let httpCalls = 0, httpErrors = 0;
async function fetchOptions(year, make, model) {
  const k = optKey(year, make, model);
  if (optCache.has(k)) return optCache.get(k);
  const env = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><Authentication xmlns="${NS}"><User>${esc(user)}</User><Password>${esc(pass)}</Password></Authentication></soap:Header><soap:Body><GetVehicleOptions xmlns="${NS}"><year>${year}</year><make>${esc(make)}</make><model>${esc(model)}</model></GetVehicleOptions></soap:Body></soap:Envelope>`;
  let rec;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      httpCalls++;
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `${NS}/GetVehicleOptions` }, body: env, signal: ctrl.signal });
      clearTimeout(to);
      const text = await r.text();
      if (r.status >= 500 || r.status === 429) { httpErrors++; rec = { year, make, model, ok: false, err: `http ${r.status}`, opts: [], at: Date.now() }; await sleep(1500 * (attempt + 1)); continue; }
      const opts = [];
      for (const m of text.matchAll(/<VehicleOption>([\s\S]*?)<\/VehicleOption>/g)) {
        const g = (t) => { const x = m[1].match(new RegExp(`<${t}>([^<]*)</${t}>`)); return x ? x[1].trim() : ""; };
        opts.push({ size: g("TireSize"), li: g("LoadIndex"), sp: g("SpeedRate"), fi: g("FrontInf"), ri: g("RearInf"), rim: g("RimSize"), wbc: g("WBC"), trq: g("TRQ1") });
      }
      const errMsg = (text.match(/<errorMessage>([^<]*)<\/errorMessage>/) || [])[1] || "";
      rec = { year, make, model, ok: opts.length > 0, msg: errMsg.slice(0, 80), opts, at: Date.now() };
      break;
    } catch (e) { httpErrors++; rec = { year, make, model, ok: false, err: String(e).slice(0, 100), opts: [], at: Date.now() }; await sleep(1500 * (attempt + 1)); }
  }
  if (rec && !rec.err) { optCache.set(k, rec); fs.appendFileSync(OPTIONS_FILE, JSON.stringify(rec) + "\n"); }
  await sleep(GAP);
  return rec ?? { year, make, model, ok: false, opts: [] };
}

// ---------------------------------------------------------------- Pass 2 name map
function loadPass2() {
  const map = new Map(); // "year|make|model" (our slugs) -> [{make_usaf, model_usaf}]
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".json") && !e.name.startsWith("_")) { try { const j = JSON.parse(fs.readFileSync(p, "utf8")); if (j.status === "matched" && Array.isArray(j.matched) && j.matched.length) map.set(`${j.year}|${j.make}|${j.model}`, j.matched.map((m) => ({ make_usaf: m.make_usaf, model_usaf: m.model_usaf }))); } catch { /* skip */ } } } };
  walk(PASS2_CACHE);
  return map;
}

// ---------------------------------------------------------------- main
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, a) => (await pool.query(s, a)).rows;

const names = loadPass2();
console.log(`pass2 matched Y/M/M: ${names.size}`);

const targets = new Map();
for (const [key, arr] of names) { const year = Number(key.split("|")[0]); for (const m of arr) targets.set(optKey(year, m.make_usaf, m.model_usaf), { year, make: m.make_usaf, model: m.model_usaf }); }
let todo = [...targets.values()].filter((t) => !optCache.has(optKey(t.year, t.make, t.model)));
if (LIMIT) todo = todo.slice(0, LIMIT);
console.log(`USAF targets: ${targets.size} | already cached: ${[...targets.keys()].filter((k) => optCache.has(k)).length} | to fetch: ${todo.length} (conc ${CONC}, gap ${GAP}ms)`);

let done = 0; const t0 = Date.now();
async function worker() { for (;;) { const t = todo.shift(); if (!t) return; await fetchOptions(t.year, t.make, t.model); done++; if (done % 250 === 0) console.log(`  fetched ${done} | http ${httpCalls} err ${httpErrors} | ${((Date.now() - t0) / 60000).toFixed(1)} min`); } }
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`fetch complete: ${done} new | http ${httpCalls} err ${httpErrors} | ${((Date.now() - t0) / 60000).toFixed(1)} min`);

const census = { rows: 0, li: 0, sp: 0, inf: 0, wbc: 0, trq: 0 };
for (const r of optCache.values()) for (const o of r.opts) { census.rows++; if (o.li) census.li++; if (o.sp) census.sp++; if (o.fi || o.ri) census.inf++; if (o.wbc) census.wbc++; if (o.trq) census.trq++; }
console.log("USAF option census:", JSON.stringify(census));
if (FETCH_ONLY) { await pool.end(); process.exit(0); }

// ---------------------------------------------------------------- reconcile
const rows = await q(`select id, year, make, model, display_trim, oem_tire_sizes, oem_load_index, oem_speed_rating, load_index_source
  from vehicle_fitments where quarantined_at is null order by year, make, model, display_trim`);
console.log(`live rows: ${rows.length}`);

const R = { fill: [], no_li_at_usaf: 0, already_usaf_same: 0, tg_agree: 0, tg_disagree: [], no_ymm: 0, no_size: 0, no_primary_match: 0, li_conflict: [], tg_kept: 0 };
for (const row of rows) {
  const key = `${row.year}|${String(row.make).toLowerCase()}|${String(row.model).toLowerCase()}`;
  const nm = names.get(key);
  if (!nm) { R.no_ymm++; continue; }
  const opts = [];
  for (const m of nm) { const rec = optCache.get(optKey(row.year, m.make_usaf, m.model_usaf)); if (rec?.ok) opts.push(...rec.opts); }
  if (!opts.length) { R.no_ymm++; continue; }
  const ours = ourTireList(row.oem_tire_sizes).map(normTire).filter(Boolean);
  if (!ours.length) { R.no_size++; continue; }
  const primary = ours[0];
  const hit = opts.filter((o) => normTire(o.size) === primary);
  if (!hit.length) { R.no_primary_match++; continue; }
  const lis = [...new Set(hit.map((o) => Number(o.li)).filter((n) => n >= 60 && n <= 140))];
  const sps = [...new Set(hit.map((o) => o.sp).filter(Boolean))];
  if (lis.length === 0) { R.no_li_at_usaf++; continue; } // USAF reports LoadIndex=0 for vintage VR-style sizes
  if (lis.length !== 1) { R.li_conflict.push({ id: row.id, ymm: `${row.year} ${row.make} ${row.model} [${row.display_trim}]`, primary, lis }); continue; }
  const li = lis[0], sp = sps.length === 1 ? sps[0] : null;
  if (row.load_index_source === "tireguide-pro") {
    if (row.oem_load_index === li) R.tg_agree++; else R.tg_disagree.push({ id: row.id, ymm: `${row.year} ${row.make} ${row.model} [${row.display_trim}]`, primary, tg: row.oem_load_index, usaf: li });
    R.tg_kept++;
    continue;
  }
  if (row.load_index_source === "usaf" && row.oem_load_index === li && (row.oem_speed_rating ?? null) === sp) { R.already_usaf_same++; continue; }
  R.fill.push({ id: row.id, ymm: `${row.year} ${row.make} ${row.model} [${row.display_trim}]`, primary, li, sp, prev: row.oem_load_index });
}

const summary = { live_rows: rows.length, fill: R.fill.length, already_usaf_same: R.already_usaf_same, tg_kept: R.tg_kept, tg_agree: R.tg_agree, tg_disagree: R.tg_disagree.length, no_ymm_at_usaf: R.no_ymm, no_oe_size_on_row: R.no_size, primary_size_not_at_usaf: R.no_primary_match, no_li_at_usaf: R.no_li_at_usaf, li_conflict: R.li_conflict.length, speed_filled: R.fill.filter((f) => f.sp).length, census };
console.log("summary:", JSON.stringify(summary, null, 1));
console.log("--- tireguide vs usaf disagreements ---"); for (const d of R.tg_disagree) console.log(`  ${d.ymm} ${d.primary} tg=${d.tg} usaf=${d.usaf}`);
console.log(`--- li conflicts (first 15 of ${R.li_conflict.length}) ---`); for (const d of R.li_conflict.slice(0, 15)) console.log(`  ${d.ymm} ${d.primary} lis=${d.lis.join("/")}`);
fs.writeFileSync(path.join(OUT_DIR, "reconcile.json"), JSON.stringify({ summary, fill: R.fill, tg_disagree: R.tg_disagree, li_conflict: R.li_conflict }, null, 1));

if (!APPLY) { console.log("\nDRY RUN - nothing written. Re-run with --apply."); await pool.end(); process.exit(0); }

// ---------------------------------------------------------------- apply
console.log(`applying ${R.fill.length} rows ...`);
const client = await pool.connect();
try {
  await client.query("begin");
  const B = 500;
  for (let i = 0; i < R.fill.length; i += B) {
    const chunk = R.fill.slice(i, i + B);
    await client.query(
      `update vehicle_fitments v set oem_load_index = d.li, oem_speed_rating = d.sp, load_index_source = 'usaf', load_index_verified_at = now(), updated_at = now()
         from jsonb_to_recordset($1::jsonb) as d(id uuid, li int, sp text) where v.id = d.id and coalesce(v.load_index_source,'') <> 'tireguide-pro'`,
      [JSON.stringify(chunk.map((f) => ({ id: f.id, li: f.li, sp: f.sp })))],
    );
  }
  await client.query("commit");
} catch (e) { await client.query("rollback"); throw e; } finally { client.release(); }
const after = await q(`select load_index_source, count(*)::int n, count(oem_speed_rating)::int sp from vehicle_fitments where quarantined_at is null group by 1 order by 1`);
console.table(after);
await pool.end();
