// Pass 2 / step 1: fetch USAF OE tire sizes for every distinct active (year, make, model) 1990-2026.
// USAF's SOAP API has NO GetVehicleMakes/GetVehicleModels (checked WSDL 2026-09-15) -> we cannot list their
// model names; instead we try ranked name candidates (learned names, slug transforms, "<Model> <Trim>", trim-derived
// variants for family slugs like bmw 3-series / mercedes c-class) and cache every call (positive + negative).
//
// Usage:  node --env-file=.env.local scripts/audit/pass2/01-fetch-usaf.mjs [--limit N] [--make ford] [--load-only] [--gap 300] [--conc 2]
// Resumable: per-Y/M/M result at cache/{year}/{make}/{model}.json; call log cache/_calls.jsonl; progress cache/_progress.json
import fs from "node:fs";
import path from "node:path";
import { pool, CACHE_DIR, YEAR_MIN, YEAR_MAX, usafMake, makeKey, slugCandidates, trimVariantCandidates, modelTrimCandidates, familyVariants, isFamilySlug, usafOptions, loadCalls, callStats, normTire, writeJson, readJson, EXTRA_TRIMS } from "./lib.mjs";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(arg("--limit", 0));
const ONLY_MAKE = arg("--make", null);
const ONLY_MODEL = arg("--model", null);
const LOAD_ONLY = args.includes("--load-only");
const NO_LOAD = args.includes("--no-load");
const RETRY_UNMATCHED = args.includes("--retry-unmatched"); // delete cached *unmatched* Y/M/M results first (calls stay cached)
const RETRY_FILTER = arg("--retry-filter", null); // regex on "make:model": delete those cached Y/M/M results (any status) first
const GAP = Number(arg("--gap", 300));
const CONC = Number(arg("--conc", 2));
const MAX_TRIMS = 15;
const MAX_TRIM_CALLS = 30;
// makes where USAF splits one model into several names with possibly different sizes (A5 Quattro / A5 Sportback): try all A-candidates, union
const MULTI_VARIANT_MAKES = new Set(["audi"]);
// make:model slugs that map to several USAF names in the same year (C1500 + K1500; K1500 Suburban + C1500 Suburban): try all overrides, union
const MULTI_VARIANT_MODELS = /^(chevrolet|gmc):(c\/k-|ck-|suburban|sierra|silverado|yukon-xl)|^mercedes(-benz)?:amg-gt|^ford:(econoline|transit$|club-wagon)|^dodge:ram-van$|^ram:promaster$|^ram:(1500|2500|3500)$/;

const LEARNED_FILE = path.join(CACHE_DIR, "_learned.json");
const PROGRESS_FILE = path.join(CACHE_DIR, "_progress.json");
const resultFile = (y, mk, md) => path.join(CACHE_DIR, String(y), mk.replace(/[^a-z0-9-]/g, "_"), `${md.replace(/[^a-z0-9-]/g, "_")}.json`);
const safeSlug = (s) => String(s).toLowerCase().trim();

const p = pool();
const q = async (s, a) => (await p.query(s, a)).rows;

async function loadYmm() {
  const rows = await q(
    `select year, make, model,
            array_agg(distinct display_trim) filter (where display_trim is not null and display_trim <> '') dt,
            array_agg(distinct raw_trim) filter (where raw_trim is not null and raw_trim <> '') rt,
            count(*)::int n
       from vehicle_fitments
      where quarantined_at is null and year between $1 and $2 ${ONLY_MAKE ? "and make = $3" : ""} ${ONLY_MODEL ? "and model = $4" : ""}
      group by 1,2,3 order by make, model, year desc`,
    ONLY_MODEL ? [YEAR_MIN, YEAR_MAX, ONLY_MAKE, ONLY_MODEL] : ONLY_MAKE ? [YEAR_MIN, YEAR_MAX, ONLY_MAKE] : [YEAR_MIN, YEAR_MAX],
  );
  return rows.map((r) => ({ year: r.year, make: safeSlug(r.make), model: safeSlug(r.model), trims: [...new Set([...(r.dt ?? []), ...(r.rt ?? [])])].filter((t) => !t.includes(",")).slice(0, MAX_TRIMS), n: r.n }));
}

const learned = readJson(LEARNED_FILE, {});
const TRIM_KINDS = new Set(["model-trim", "trim-mb", "trim-bmw", "trim-lex", "trim-raw", "learned-trim"]);
function learn(key, name, kind) {
  const arr = (learned[key] ??= []);
  const i = arr.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());
  if (i >= 0) arr[i].hits++; else arr.push({ name, hits: 1, kind: TRIM_KINDS.has(kind) ? "learned-trim" : "learned" });
  arr.sort((a, b) => b.hits - a.hits);
}
let learnedDirty = 0;
function saveLearned() { writeJson(LEARNED_FILE, learned); learnedDirty = 0; }

async function processYmm(v) {
  const file = resultFile(v.year, v.make, v.model);
  if (fs.existsSync(file)) return readJson(file);
  const makeUsaf = usafMake(v.make);
  const key = `${v.make}:${v.model}`;
  const family = isFamilySlug(v.make, v.model);
  const multi = MULTI_VARIANT_MAKES.has(makeKey(v.make)) || MULTI_VARIANT_MODELS.test(key);
  const tried = [];
  const matched = [];
  const seen = new Set();
  const tryName = async (name, kind) => {
    const k = name.toLowerCase();
    if (seen.has(k)) return null;
    seen.add(k);
    // "SRT|Viper" = query under a different USAF make
    let mk = makeUsaf, md = name;
    if (name.includes("|")) [mk, md] = name.split("|").map((s) => s.trim());
    const r = await usafOptions(v.year, mk, md, { gapMs: GAP });
    tried.push({ name, kind, ok: !!r.ok, err: r.err });
    if (r.ok) { matched.push({ make_usaf: mk, model_usaf: md, kind, sizes: r.sizes }); learn(key, name, kind); learnedDirty++; }
    return r;
  };

  // A) learned model-level names first, then slug transforms; stop at first success (non-family)
  const learnedModel = (learned[key] ?? []).filter((x) => x.kind !== "learned-trim").map((x) => x.name);
  const learnedTrim = (learned[key] ?? []).filter((x) => x.kind === "learned-trim").slice(0, 12).map((x) => x.name);
  if (!family) {
    for (const n of learnedModel) { const r = await tryName(n, "learned"); if (r?.ok && !multi) break; }
    if (!matched.length || multi) {
      let calls = 0;
      for (const c of slugCandidates(v.make, v.model)) { if (multi && calls >= 8) break; const r = await tryName(c.name, c.kind); if (r) calls++; if (r?.ok && !multi) break; }
    }
  }
  // B/C) trim-derived names: family slugs always; others only when A failed. Try ALL (union of variants, no short-circuit).
  if (family || !matched.length) {
    let calls = 0;
    const cands = [];
    for (const n of learnedTrim) cands.push({ name: n, kind: "learned-trim" });
    if (family) {
      for (const n of learnedModel) cands.push({ name: n, kind: "learned" });
      for (const c of slugCandidates(v.make, v.model)) cands.push(c); // overrides only for family slugs
      for (const c of familyVariants(v.make, v.model, v.year)) cands.push(c); // year-gated known variants (BMW series)
      for (const t of v.trims) for (const c of trimVariantCandidates(v.make, v.model, t)) cands.push(c);
    } else {
      const base = slugCandidates(v.make, v.model)[0]?.name ?? v.model;
      const trims = [...v.trims, ...(EXTRA_TRIMS[key] ?? [])];
      for (const t of trims) for (const c of modelTrimCandidates(base, t)) cands.push(c);
      for (const c of familyVariants(v.make, v.model, v.year)) cands.push(c); // e.g. mercedes-benz "gle" -> GLE350/GLE450...
      for (const t of v.trims) for (const c of trimVariantCandidates(v.make, v.model, t)) if (c.kind !== "trim-raw") cands.push(c);
    }
    for (const c of cands) { if (calls >= MAX_TRIM_CALLS) break; const r = await tryName(c.name, c.kind); if (r) calls++; }
  }
  const sizes = [...new Set(matched.flatMap((m) => m.sizes))];
  const out = { year: v.year, make: v.make, model: v.model, make_usaf: makeUsaf, family, n_rows: v.n, trims: v.trims, status: matched.length ? "matched" : "unmatched", matched, tried, usaf_sizes: sizes, usaf_norm: [...new Set(sizes.map(normTire).filter(Boolean))], at: new Date().toISOString() };
  writeJson(file, out);
  return out;
}

async function loadDb(all) {
  await q(`create table if not exists audit_pass2_usaf_sizes (year int, make_slug text, model_slug text, make_usaf text, model_usaf text, tire_size_raw text, tire_size_norm text, match_kind text)`);
  await q(`create table if not exists audit_pass2_unmatched (year int, make_slug text, model_slug text, usaf_models_seen jsonb, n_rows int, neighbor_matched boolean)`);
  await q(`truncate audit_pass2_usaf_sizes`); await q(`truncate audit_pass2_unmatched`);
  const matchedKeys = new Set(all.filter((r) => r.status === "matched").map((r) => `${r.make}:${r.model}`));
  const sizeRows = [], unRows = [];
  for (const r of all) {
    if (r.status === "matched") for (const m of r.matched) for (const s of m.sizes) sizeRows.push([r.year, r.make, r.model, m.make_usaf, m.model_usaf, s, normTire(s), m.kind]);
    else unRows.push([r.year, r.make, r.model, JSON.stringify(r.tried.map((t) => t.name)), r.n_rows, matchedKeys.has(`${r.make}:${r.model}`)]);
  }
  const batch = async (table, cols, rows) => {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const vals = chunk.map((r, ri) => `(${r.map((_, ci) => `$${ri * r.length + ci + 1}`).join(",")})`).join(",");
      await q(`insert into ${table} (${cols}) values ${vals}`, chunk.flat());
    }
  };
  await batch("audit_pass2_usaf_sizes", "year, make_slug, model_slug, make_usaf, model_usaf, tire_size_raw, tire_size_norm, match_kind", sizeRows);
  await batch("audit_pass2_unmatched", "year, make_slug, model_slug, usaf_models_seen, n_rows, neighbor_matched", unRows);
  return { sizeRows: sizeRows.length, unRows: unRows.length };
}

function readAllResults() {
  const out = [];
  if (!fs.existsSync(CACHE_DIR)) return out;
  for (const y of fs.readdirSync(CACHE_DIR)) {
    if (!/^\d{4}$/.test(y)) continue;
    for (const mk of fs.readdirSync(path.join(CACHE_DIR, y))) for (const f of fs.readdirSync(path.join(CACHE_DIR, y, mk))) { const r = readJson(path.join(CACHE_DIR, y, mk, f)); if (r) out.push(r); }
  }
  return out;
}

async function main() {
  loadCalls();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!LOAD_ONLY) {
    let list = await loadYmm();
    if (LIMIT) list = list.slice(0, LIMIT);
    if (RETRY_UNMATCHED) {
      let n = 0;
      for (const v of list) { const f = resultFile(v.year, v.make, v.model); const r = fs.existsSync(f) ? readJson(f) : null; if (r && r.status !== "matched") { fs.unlinkSync(f); n++; } }
      console.log(`retry-unmatched: removed ${n} unmatched result files`);
    }
    if (RETRY_FILTER) {
      const rx = new RegExp(RETRY_FILTER); let n = 0;
      for (const v of list) { if (!rx.test(`${v.make}:${v.model}`)) continue; const f = resultFile(v.year, v.make, v.model); if (fs.existsSync(f)) { fs.unlinkSync(f); n++; } }
      console.log(`retry-filter ${RETRY_FILTER}: removed ${n} result files`);
    }
    const total = list.length;
    const t0 = Date.now();
    let done = 0, matched = 0, unmatched = 0, skipped = 0;
    const started = list.filter((v) => fs.existsSync(resultFile(v.year, v.make, v.model))).length;
    const progress = (cur) => {
      const el = (Date.now() - t0) / 1000, rate = (done - started) / Math.max(el, 1);
      writeJson(PROGRESS_FILE, { done, total, pct: +((100 * done) / total).toFixed(1), matched, unmatched, resumed_from: started, http_calls: lib.HTTP_CALLS, http_errors: lib.HTTP_ERRORS, calls_cached: callStats().total, elapsed_s: Math.round(el), eta_min: rate > 0 ? Math.round((total - done) / rate / 60) : null, current: cur, updatedAt: new Date().toISOString() });
    };
    let idx = 0;
    const worker = async () => {
      while (idx < list.length) {
        const v = list[idx++];
        const pre = fs.existsSync(resultFile(v.year, v.make, v.model));
        const r = await processYmm(v);
        done++; if (pre) skipped++;
        if (r.status === "matched") matched++; else unmatched++;
        if (done % 20 === 0 || done === total) { progress(`${v.year} ${v.make} ${v.model}`); if (learnedDirty) saveLearned(); }
      }
    };
    await Promise.all(Array.from({ length: CONC }, worker));
    progress("finished"); saveLearned();
    console.log(`fetch done: ${done}/${total} ymm, matched ${matched}, unmatched ${unmatched}, skipped(cached) ${skipped}, http_calls ${lib.HTTP_CALLS}, http_errors ${lib.HTTP_ERRORS}`);
  }
  if (!NO_LOAD) {
    const all = readAllResults().filter((r) => !ONLY_MAKE || r.make === ONLY_MAKE);
    const st = await loadDb(all);
    console.log(`db load: ${all.length} ymm results -> audit_pass2_usaf_sizes ${st.sizeRows} rows, audit_pass2_unmatched ${st.unRows} rows`);
  }
  await p.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
