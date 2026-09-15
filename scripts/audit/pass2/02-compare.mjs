// Pass 2 / step 2: compare every active vehicle_fitments row's oem_tire_sizes (1990-2026) against the USAF sizes
// fetched by 01 (read from cache/, not from the network). Deterministic; re-runnable; never mutates vehicle_fitments.
//
//   node --env-file=.env.local scripts/audit/pass2/02-compare.mjs
//
// Row statuses:  match (ours ⊆ USAF) | partial (overlap, but some of ours not in USAF) | mismatch (no overlap)
//                usaf_missing_ymm (no USAF model matched for the Y/M/M) | our_empty (no parseable sizes on our row)
// Y/M/M level:   USAF sizes present in NONE of our trims for that Y/M/M = missing OE size (missing trim/package evidence)
// Outputs: audit_pass2_results, audit_pass2_ymm tables; CSVs + summary.json under docs/fitment-api/audit/pass2/
import fs from "node:fs";
import path from "node:path";
import { pool, CACHE_DIR, OUT_DIR, YEAR_MIN, YEAR_MAX, normTire, ourTireList, readJson, writeCsv, writeJson } from "./lib.mjs";

const p = pool();
const q = async (s, a) => (await p.query(s, a)).rows;

function readAllResults() {
  const map = new Map();
  for (const y of fs.readdirSync(CACHE_DIR)) {
    if (!/^\d{4}$/.test(y)) continue;
    for (const mk of fs.readdirSync(path.join(CACHE_DIR, y))) for (const f of fs.readdirSync(path.join(CACHE_DIR, y, mk))) {
      const r = readJson(path.join(CACHE_DIR, y, mk, f));
      if (r) map.set(`${r.year}|${r.make}|${r.model}`, r);
    }
  }
  return map;
}
const srcFamily = (s) => String(s ?? "").replace(/\s*\[.*$/, "").trim() || "(null)";
const decade = (y) => `${Math.floor(y / 10) * 10}s`;
const rim = (n) => n?.match(/R(\d{2}(?:\.5)?)$/)?.[1] ?? null;
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

async function main() {
  const usaf = readAllResults();
  const rows = await q(`select id, year, make, model, display_trim, raw_trim, source, quality_tier, certification_status, oem_tire_sizes from vehicle_fitments where quarantined_at is null and year between $1 and $2 order by make, model, year, id`, [YEAR_MIN, YEAR_MAX]);

  // ---- per-row ----
  const results = [];
  const ymmAgg = new Map(); // key -> {rows, ourUnion:Set, usaf:Set, status}
  for (const r of rows) {
    const key = `${r.year}|${String(r.make).toLowerCase()}|${String(r.model).toLowerCase()}`;
    const u = usaf.get(key);
    const oursRaw = ourTireList(r.oem_tire_sizes);
    const oursNorm = [...new Set(oursRaw.map(normTire).filter(Boolean))];
    const unparseable = oursRaw.filter((s) => !normTire(s));
    const usafNorm = u?.status === "matched" ? u.usaf_norm : [];
    // trim-level attribution when USAF model name = "<Model> <Trim>" (e.g. "Ram 1500 Laramie") or a BMW/MB variant equal to our trim
    let usafTrim = null;
    if (u?.status === "matched" && u.matched.length > 1) {
      const t = norm(r.display_trim || r.raw_trim || "");
      if (t && t !== "base") {
        const hit = u.matched.find((m) => norm(m.model_usaf) === t || norm(m.model_usaf).endsWith(t));
        if (hit) usafTrim = { name: hit.model_usaf, norm: [...new Set(hit.sizes.map(normTire).filter(Boolean))] };
      }
    }
    let status;
    if (!u || u.status !== "matched") status = u ? "usaf_missing_ymm" : "not_fetched";
    else if (!oursNorm.length) status = "our_empty";
    else {
      const inU = oursNorm.filter((s) => usafNorm.includes(s));
      status = inU.length === oursNorm.length ? "match" : inU.length ? "partial" : "mismatch";
    }
    const oursNotIn = status === "match" || !usafNorm.length ? [] : oursNorm.filter((s) => !usafNorm.includes(s));
    const usafNotIn = usafNorm.length ? usafNorm.filter((s) => !oursNorm.includes(s)) : [];
    const rimOverlap = oursNorm.some((s) => usafNorm.some((t) => rim(s) === rim(t)));
    let trimStatus = null;
    if (usafTrim && oursNorm.length) { const inT = oursNorm.filter((s) => usafTrim.norm.includes(s)); trimStatus = inT.length === oursNorm.length ? "match" : inT.length ? "partial" : "mismatch"; }
    results.push({ fitment_id: r.id, year: r.year, make: r.make, model: r.model, display_trim: r.display_trim, source: r.source, source_family: srcFamily(r.source), status, ours_raw: oursRaw, ours_norm: oursNorm, ours_unparseable: unparseable, usaf_norm: usafNorm, usaf_models: u?.matched?.map((m) => m.model_usaf) ?? [], ours_not_in_usaf: oursNotIn, usaf_not_in_ours: usafNotIn, rim_overlap: rimOverlap, usaf_trim_model: usafTrim?.name ?? null, trim_status: trimStatus });
    const a = ymmAgg.get(key) ?? { year: r.year, make: r.make, model: r.model, rows: 0, ourUnion: new Set(), usaf: new Set(usafNorm), usafModels: u?.matched?.map((m) => m.model_usaf) ?? [], matched: u?.status === "matched", fetched: !!u, trims: new Set(), statuses: {} };
    a.rows++; for (const s of oursNorm) a.ourUnion.add(s); a.trims.add(r.display_trim || r.raw_trim || ""); a.statuses[status] = (a.statuses[status] ?? 0) + 1;
    ymmAgg.set(key, a);
  }
  // ---- per-Y/M/M ----
  const ymm = [];
  for (const a of ymmAgg.values()) {
    const ourUnion = [...a.ourUnion], usafArr = [...a.usaf];
    const missing = a.matched ? usafArr.filter((s) => !a.ourUnion.has(s)) : [];
    const extra = a.matched ? ourUnion.filter((s) => !a.usaf.has(s)) : [];
    const status = !a.fetched ? "not_fetched" : !a.matched ? "usaf_missing_ymm" : !ourUnion.length ? "our_empty" : !extra.length && !missing.length ? "exact" : !extra.length ? "ours_subset" : extra.length === ourUnion.length ? "disjoint" : "overlap";
    ymm.push({ year: a.year, make: a.make, model: a.model, n_rows: a.rows, n_trims: a.trims.size, status, our_union: ourUnion, usaf: usafArr, usaf_models: a.usafModels, missing_oe: missing, ours_not_in_usaf: extra, row_statuses: a.statuses });
  }

  // ---- DB tables ----
  await q(`create table if not exists audit_pass2_results (fitment_id text primary key, year int, make text, model text, display_trim text, source text, source_family text, status text, ours_raw jsonb, ours_norm jsonb, ours_unparseable jsonb, usaf_norm jsonb, usaf_models jsonb, ours_not_in_usaf jsonb, usaf_not_in_ours jsonb, rim_overlap boolean, usaf_trim_model text, trim_status text)`);
  await q(`create table if not exists audit_pass2_ymm (year int, make text, model text, n_rows int, n_trims int, status text, our_union jsonb, usaf jsonb, usaf_models jsonb, missing_oe jsonb, ours_not_in_usaf jsonb, row_statuses jsonb)`);
  await q(`truncate audit_pass2_results`); await q(`truncate audit_pass2_ymm`);
  const cols = ["fitment_id", "year", "make", "model", "display_trim", "source", "source_family", "status", "ours_raw", "ours_norm", "ours_unparseable", "usaf_norm", "usaf_models", "ours_not_in_usaf", "usaf_not_in_ours", "rim_overlap", "usaf_trim_model", "trim_status"];
  const jsonCols = new Set(["ours_raw", "ours_norm", "ours_unparseable", "usaf_norm", "usaf_models", "ours_not_in_usaf", "usaf_not_in_ours"]);
  for (let i = 0; i < results.length; i += 400) {
    const chunk = results.slice(i, i + 400);
    const vals = chunk.map((r, ri) => `(${cols.map((c, ci) => `$${ri * cols.length + ci + 1}${jsonCols.has(c) ? "::jsonb" : ""}`).join(",")})`).join(",");
    await q(`insert into audit_pass2_results (${cols.join(",")}) values ${vals}`, chunk.flatMap((r) => cols.map((c) => (jsonCols.has(c) ? JSON.stringify(r[c]) : r[c]))));
  }
  const ycols = ["year", "make", "model", "n_rows", "n_trims", "status", "our_union", "usaf", "usaf_models", "missing_oe", "ours_not_in_usaf", "row_statuses"];
  const yjson = new Set(["our_union", "usaf", "usaf_models", "missing_oe", "ours_not_in_usaf", "row_statuses"]);
  for (let i = 0; i < ymm.length; i += 400) {
    const chunk = ymm.slice(i, i + 400);
    const vals = chunk.map((r, ri) => `(${ycols.map((c, ci) => `$${ri * ycols.length + ci + 1}${yjson.has(c) ? "::jsonb" : ""}`).join(",")})`).join(",");
    await q(`insert into audit_pass2_ymm (${ycols.join(",")}) values ${vals}`, chunk.flatMap((r) => ycols.map((c) => (yjson.has(c) ? JSON.stringify(r[c]) : r[c]))));
  }

  // ---- summary ----
  const count = (arr, f) => { const m = {}; for (const x of arr) { const k = f(x); m[k] = (m[k] ?? 0) + 1; } return m; };
  const byStatus = count(results, (r) => r.status);
  const byDecade = {};
  for (const r of results) ((byDecade[decade(r.year)] ??= {})[r.status] = ((byDecade[decade(r.year)] ??= {})[r.status] ?? 0) + 1);
  const bySource = {};
  for (const r of results) ((bySource[r.source_family] ??= {})[r.status] = ((bySource[r.source_family] ??= {})[r.status] ?? 0) + 1);
  const ymmByStatus = count(ymm, (y) => y.status);
  const ymmCoverage = { total: ymm.length, matched: ymm.filter((y) => y.status !== "usaf_missing_ymm" && y.status !== "not_fetched").length, unmatched: ymm.filter((y) => y.status === "usaf_missing_ymm").length, not_fetched: ymm.filter((y) => y.status === "not_fetched").length };
  const ymmByDecade = {};
  for (const y of ymm) ((ymmByDecade[decade(y.year)] ??= {})[y.status] = ((ymmByDecade[decade(y.year)] ??= {})[y.status] ?? 0) + 1);
  // models ranked by mismatch+partial rows
  const modelAgg = {};
  for (const r of results) { const k = `${r.make} ${r.model}`; const m = (modelAgg[k] ??= { make: r.make, model: r.model, rows: 0, match: 0, partial: 0, mismatch: 0, our_empty: 0, usaf_missing_ymm: 0 }); m.rows++; m[r.status] = (m[r.status] ?? 0) + 1; }
  const topMismatch = Object.values(modelAgg).map((m) => ({ ...m, bad: m.mismatch + m.partial, bad_pct: m.rows ? +((100 * (m.mismatch + m.partial)) / m.rows).toFixed(1) : 0 })).filter((m) => m.bad > 0).sort((a, b) => b.bad - a.bad || b.bad_pct - a.bad_pct);
  const topMissing = {};
  for (const y of ymm) if (y.missing_oe.length) { const k = `${y.make} ${y.model}`; const m = (topMissing[k] ??= { make: y.make, model: y.model, ymm_with_missing: 0, missing_sizes_total: 0, years: [], sample: new Set() }); m.ymm_with_missing++; m.missing_sizes_total += y.missing_oe.length; m.years.push(y.year); for (const s of y.missing_oe) m.sample.add(s); }
  const topMissingArr = Object.values(topMissing).map((m) => ({ ...m, years: `${Math.min(...m.years)}-${Math.max(...m.years)}`, sample: [...m.sample].slice(0, 6).join(" ") })).sort((a, b) => b.missing_sizes_total - a.missing_sizes_total);
  const unmatchedYmm = ymm.filter((y) => y.status === "usaf_missing_ymm");
  const unmatchedModels = {};
  for (const y of unmatchedYmm) { const k = `${y.make} ${y.model}`; const m = (unmatchedModels[k] ??= { make: y.make, model: y.model, ymm: 0, rows: 0, years: [] }); m.ymm++; m.rows += y.n_rows; m.years.push(y.year); }
  const matchedKeys = new Set(ymm.filter((y) => y.status !== "usaf_missing_ymm" && y.status !== "not_fetched").map((y) => `${y.make} ${y.model}`));
  const unmatchedArr = Object.values(unmatchedModels).map((m) => ({ ...m, years: `${Math.min(...m.years)}-${Math.max(...m.years)}`, other_years_matched: matchedKeys.has(`${m.make} ${m.model}`) })).sort((a, b) => b.rows - a.rows);

  const summary = { generated: new Date().toISOString(), rows: results.length, ymm: ymm.length, byStatus, byDecade, bySource, ymmByStatus, ymmCoverage, ymmByDecade, topMismatch: topMismatch.slice(0, 60), topMissing: topMissingArr.slice(0, 60), unmatchedModels: unmatchedArr.slice(0, 200), unmatchedModelsTotal: unmatchedArr.length, missingOeSizesTotal: ymm.reduce((s, y) => s + y.missing_oe.length, 0), ymmWithMissingOe: ymm.filter((y) => y.missing_oe.length).length, trimLevel: count(results.filter((r) => r.trim_status), (r) => r.trim_status), unparseableRows: results.filter((r) => r.ours_unparseable.length).length };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeJson(path.join(OUT_DIR, "summary.json"), summary);
  // ---- CSVs ----
  const flat = (r) => ({ ...r, ours_raw: r.ours_raw.join(" "), ours_norm: r.ours_norm.join(" "), ours_unparseable: r.ours_unparseable.join(" "), usaf_norm: r.usaf_norm.join(" "), usaf_models: r.usaf_models.join(" | "), ours_not_in_usaf: r.ours_not_in_usaf.join(" "), usaf_not_in_ours: r.usaf_not_in_ours.join(" ") });
  const rcols = ["fitment_id", "year", "make", "model", "display_trim", "source", "status", "rim_overlap", "ours_raw", "ours_norm", "usaf_norm", "ours_not_in_usaf", "usaf_not_in_ours", "usaf_models", "usaf_trim_model", "trim_status", "ours_unparseable"];
  const n1 = writeCsv("rows-all.csv", results.map(flat), rcols);
  const n2 = writeCsv("rows-mismatch.csv", results.filter((r) => r.status === "mismatch").map(flat), rcols);
  const n3 = writeCsv("rows-partial.csv", results.filter((r) => r.status === "partial").map(flat), rcols);
  const n4 = writeCsv("rows-our-empty.csv", results.filter((r) => r.status === "our_empty").map(flat), rcols);
  const yflat = (y) => ({ ...y, our_union: y.our_union.join(" "), usaf: y.usaf.join(" "), usaf_models: y.usaf_models.join(" | "), missing_oe: y.missing_oe.join(" "), ours_not_in_usaf: y.ours_not_in_usaf.join(" "), row_statuses: JSON.stringify(y.row_statuses) });
  const ycsv = ["year", "make", "model", "n_rows", "n_trims", "status", "our_union", "usaf", "missing_oe", "ours_not_in_usaf", "usaf_models", "row_statuses"];
  const n5 = writeCsv("ymm-all.csv", ymm.map(yflat), ycsv);
  const n6 = writeCsv("ymm-missing-oe-sizes.csv", ymm.filter((y) => y.missing_oe.length).map(yflat), ycsv);
  const n7 = writeCsv("ymm-usaf-unmatched.csv", unmatchedYmm.map((y) => ({ year: y.year, make: y.make, model: y.model, n_rows: y.n_rows, our_union: y.our_union.join(" "), tried: (usaf.get(`${y.year}|${y.make}|${y.model}`)?.tried ?? []).map((t) => t.name).join(" | "), other_years_matched: matchedKeys.has(`${y.make} ${y.model}`) })), ["year", "make", "model", "n_rows", "our_union", "tried", "other_years_matched"]);
  const n8 = writeCsv("models-mismatch-ranked.csv", topMismatch, ["make", "model", "rows", "match", "partial", "mismatch", "our_empty", "usaf_missing_ymm", "bad", "bad_pct"]);
  const n9 = writeCsv("models-missing-oe-ranked.csv", topMissingArr, ["make", "model", "ymm_with_missing", "missing_sizes_total", "years", "sample"]);
  const n10 = writeCsv("models-usaf-unmatched-ranked.csv", unmatchedArr, ["make", "model", "ymm", "rows", "years", "other_years_matched"]);
  console.log(`rows ${results.length} | ymm ${ymm.length} | status ${JSON.stringify(byStatus)} | ymm ${JSON.stringify(ymmCoverage)} | missingOE sizes ${summary.missingOeSizesTotal} in ${summary.ymmWithMissingOe} ymm`);
  console.log(`csv: all ${n1}, mismatch ${n2}, partial ${n3}, our_empty ${n4}, ymm ${n5}, ymm-missing ${n6}, ymm-unmatched ${n7}, models-mismatch ${n8}, models-missing ${n9}, models-unmatched ${n10}`);
  await p.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
