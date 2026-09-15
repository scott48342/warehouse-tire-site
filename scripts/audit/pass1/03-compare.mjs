// Pass 1 / step 3: compare active vehicle_fitments Y/M/M (1990–2026) against audit_pass1_nhtsa_models + audit_pass1_epa_vehicles.
// Read-only on vehicle_fitments. Writes audit_pass1_matches + CSVs under docs/fitment-api/audit/pass1/. Deterministic (no network).
import fs from "node:fs";
import path from "node:path";
import {
  pool, ALIASES, compact, normMake, ourKeySets, govKeySets, makeActiveInYear, isHeavyOrCommercial, isJunkGovModel,
  writeCsv, pct, YEAR_MIN, YEAR_MAX, CACHE_DIR, OUT_DIR,
} from "./00-lib.mjs";

const PHANTOM_MIN_YEAR = 1995;
const TRIM_MIN_YEAR = 2000;
const db = pool();

// ---------------------------------------------------------------- load
const ours = (await db.query(`
  select id, year, make, model, raw_trim, display_trim, submodel, source
  from vehicle_fitments where quarantined_at is null and year between $1 and $2`, [YEAR_MIN, YEAR_MAX])).rows;
const nhtsa = (await db.query(`select year, make_norm, model_raw, model_norm, vehicle_type from audit_pass1_nhtsa_models`)).rows;
const epa = (await db.query(`select year, make_norm, model_raw, model_norm, base_model, base_norm, trim_text, vclass, epa_id from audit_pass1_epa_vehicles where year between $1 and $2`, [YEAR_MIN, YEAR_MAX])).rows;
console.log(`ours ${ours.length} rows | nhtsa ${nhtsa.length} | epa ${epa.length}`);

// cross-make brand aliases (year-conditional): our make -> other gov make to also search
function altMakes(makeKey, year) {
  const out = [];
  if (makeKey === "ram" && year <= 2012) out.push("dodge"); // EPA files 2011–12 as Dodge "Ram 1500 Pickup"; NHTSA RAM lists only generic "Ram"
  if (makeKey === "dodge" && year >= 2011) out.push("ram");
  if (makeKey === "geo") out.push("chevrolet");
  if (makeKey === "chevrolet" && year <= 1997) out.push("geo");
  if (makeKey === "datsun") out.push("nissan");
  if (makeKey === "scion") out.push("toyota"); // NHTSA files Scion models under TOYOTA ("Scion xB")
  if (makeKey === "toyota" && year <= 2016) out.push("scion");
  if (makeKey === "hummer" && year >= 2022) out.push("gmc");
  if (makeKey === "mercedesbenz") out.push("maybach");
  if (makeKey === "plymouth") out.push("chrysler", "dodge");
  if (makeKey === "eagle") out.push("chrysler", "dodge");
  return out;
}

// ---------------------------------------------------------------- gov index
// govIdx[make][year] = [{src, raw, type, exact:Set, family:Set}]
const govIdx = new Map();
const govAll = new Map(); // make -> { exact:Map(key->Set(years)), family:Map(key->Set(years)) }
function addGov(src, make, year, raw, base, type) {
  const ks = govKeySets(make, raw, base);
  if (!govIdx.has(make)) govIdx.set(make, new Map());
  const byY = govIdx.get(make);
  if (!byY.has(year)) byY.set(year, []);
  byY.get(year).push({ src, raw, type, exact: ks.exact, family: ks.family });
  if (!govAll.has(make)) govAll.set(make, { exact: new Map(), family: new Map() });
  const g = govAll.get(make);
  for (const k of ks.exact) { if (!g.exact.has(k)) g.exact.set(k, new Set()); g.exact.get(k).add(year); }
  for (const k of ks.family) { if (!g.family.has(k)) g.family.set(k, new Set()); g.family.get(k).add(year); }
}
for (const r of nhtsa) addGov("nhtsa", r.make_norm, r.year, r.model_raw, null, r.vehicle_type);
// EPA: dedupe per (year, make, model_raw) for the model index
const epaSeen = new Set();
for (const r of epa) {
  const k = `${r.year}|${r.make_norm}|${r.model_raw}`;
  if (epaSeen.has(k)) continue;
  epaSeen.add(k);
  addGov("epa", r.make_norm, r.year, r.model_raw, r.base_model, r.vclass);
}

const inter = (a, b) => { for (const x of a) if (b.has(x)) return x; return null; };
/** match one of our key sets against one gov entry → 'exact' | 'family' | null */
function matchEntry(ourKs, g) {
  if (inter(ourKs.exact, g.exact)) return "exact";
  if (inter(ourKs.family, g.family) || inter(ourKs.exact, g.family) || inter(ourKs.family, g.exact)) return "family";
  return null;
}
/** best match for (make, year) across gov entries of a source */
function bestMatch(ourKs, make, year, src) {
  const list = govIdx.get(make)?.get(year) ?? [];
  let best = null;
  for (const g of list) {
    if (g.src !== src) continue;
    const lv = matchEntry(ourKs, g);
    if (!lv) continue;
    if (lv === "exact") return { level: "exact", raw: g.raw, type: g.type };
    if (!best) best = { level: "family", raw: g.raw, type: g.type };
  }
  return best;
}
/** years (any source) where our model key set matches something under make */
function yearsElsewhere(ourKs, make) {
  const g = govAll.get(make);
  if (!g) return new Set();
  const ys = new Set();
  for (const k of ourKs.exact) for (const y of g.exact.get(k) ?? []) ys.add(y);
  for (const k of ourKs.family) { for (const y of g.family.get(k) ?? []) ys.add(y); for (const y of g.exact.get(k) ?? []) ys.add(y); }
  for (const k of ourKs.exact) for (const y of g.family.get(k) ?? []) ys.add(y);
  return ys;
}
const fmtYears = (set) => {
  const ys = [...set].sort((a, b) => a - b);
  if (!ys.length) return "";
  const parts = []; let s = ys[0], p = ys[0];
  for (let i = 1; i <= ys.length; i++) { const y = ys[i]; if (y === p + 1) { p = y; continue; } parts.push(s === p ? `${s}` : `${s}-${p}`); s = p = y; }
  return parts.join(" ");
};

// ---------------------------------------------------------------- our Y/M/M groups
const groups = new Map(); // key -> {year, makeRaw, make, model, rows:[], trims:Set}
for (const r of ours) {
  const make = normMake(r.make);
  const k = `${r.year}|${make}|${r.model}`;
  if (!groups.has(k)) groups.set(k, { year: r.year, makeRaw: r.make, make, model: r.model, rows: [], trims: new Set() });
  const g = groups.get(k);
  g.rows.push(r);
  for (const t of [r.display_trim, r.raw_trim, r.submodel]) if (t) g.trims.add(String(t));
}
console.log(`our Y/M/M groups: ${groups.size}`);

const matches = [];
const phantomRows = [];
const phantomYmm = [];
const ourMatchedByYear = new Map(); // make -> year -> [ourKs] for reverse (gap) lookup
for (const g of groups.values()) {
  const ks = ourKeySets(g.make, g.model);
  if (!ourMatchedByYear.has(g.make)) ourMatchedByYear.set(g.make, new Map());
  const m = ourMatchedByYear.get(g.make);
  if (!m.has(g.year)) m.set(g.year, []);
  m.get(g.year).push(ks);
  for (const am of altMakes(g.make, g.year)) { // register under alt make too so gap check credits us
    if (!ourMatchedByYear.has(am)) ourMatchedByYear.set(am, new Map());
    const mm = ourMatchedByYear.get(am);
    if (!mm.has(g.year)) mm.set(g.year, []);
    mm.get(g.year).push(ks);
  }

  let n = bestMatch(ks, g.make, g.year, "nhtsa");
  let e = bestMatch(ks, g.make, g.year, "epa");
  let crossMake = null;
  if (!n && !e) {
    for (const am of altMakes(g.make, g.year)) {
      const n2 = bestMatch(ks, am, g.year, "nhtsa"), e2 = bestMatch(ks, am, g.year, "epa");
      if (n2 || e2) { n = n2; e = e2; crossMake = am; break; }
    }
  }
  const level = crossMake ? "crossmake" : n?.level === "exact" || e?.level === "exact" ? "exact" : n || e ? "family" : "none";
  const makeActive = makeActiveInYear(g.make, g.year);
  const elsewhere = yearsElsewhere(ks, g.make);
  for (const am of altMakes(g.make, g.year)) for (const y of yearsElsewhere(ks, am)) elsewhere.add(y);
  const rec = {
    year: g.year, make_slug: g.makeRaw, make: g.make, model: g.model, n_rows: g.rows.length, match_level: level,
    nhtsa_match: n?.raw ?? "", nhtsa_type: n?.type ?? "", epa_match: e?.raw ?? "", cross_make: crossMake ?? "",
    gov_years_for_model: fmtYears(elsewhere), make_active_in_year: makeActive,
  };
  matches.push(rec);
  if (level === "none" && g.year >= PHANTOM_MIN_YEAR) {
    let severity, reason;
    if (!makeActive) { severity = "error"; reason = `make ${g.make} not sold in US in ${g.year}`; }
    else if (elsewhere.size === 0) { severity = "error"; reason = "model never appears in NHTSA or EPA for this make (any year 1990–2026)"; }
    else if (g.year >= 2025) { severity = "info"; reason = `no ${g.year} listing yet (gov sources lag for MY2025+); model exists ${fmtYears(elsewhere)}`; }
    else {
      const ys = [...elsewhere];
      const near = ys.some((y) => Math.abs(y - g.year) <= 1);
      severity = "warn";
      reason = `model exists other years (${fmtYears(elsewhere)})${near ? " — adjacent model year, likely boundary" : ""}`;
    }
    phantomYmm.push({ ...rec, severity, reason, trims: [...g.trims].slice(0, 6).join(" | ") });
    for (const r of g.rows) phantomRows.push({ id: r.id, year: r.year, make: r.make, model: r.model, display_trim: r.display_trim, raw_trim: r.raw_trim, submodel: r.submodel, source: r.source, severity, reason, gov_years_for_model: rec.gov_years_for_model });
  }
}

// ---------------------------------------------------------------- gap list (NHTSA universe, light-duty)
const gapAgg = new Map(); // make|model_norm -> {make, model_raw, type, years:Set, missing:Set}
const govUniverse = []; // deduped NHTSA (year, make, model_norm) light-duty for coverage
const nhtsaSeen = new Set();
for (const r of nhtsa) {
  if (isJunkGovModel(r.model_raw) || isHeavyOrCommercial(r.model_raw)) continue;
  const uk = `${r.year}|${r.make_norm}|${r.model_norm}`;
  if (nhtsaSeen.has(uk)) continue;
  nhtsaSeen.add(uk);
  const gks = govKeySets(r.make_norm, r.model_raw, null);
  const oursHere = ourMatchedByYear.get(r.make_norm)?.get(r.year) ?? [];
  let lv = null;
  for (const oks of oursHere) { const l = matchEntry(oks, { exact: gks.exact, family: gks.family }); if (l === "exact") { lv = "exact"; break; } if (l) lv = "family"; }
  govUniverse.push({ year: r.year, make: r.make_norm, model_norm: r.model_norm, type: r.vehicle_type, covered: !!lv, level: lv });
  const ak = `${r.make_norm}|${r.model_norm}`;
  if (!gapAgg.has(ak)) gapAgg.set(ak, { make: r.make_norm, model_raw: r.model_raw, model_norm: r.model_norm, type: r.vehicle_type, years: new Set(), missing: new Set() });
  const a = gapAgg.get(ak);
  a.years.add(r.year);
  if (!lv) a.missing.add(r.year);
}
// EPA corroboration per make|model: the set of years EPA lists a matching model (per-year, family-level)
function epaYearsFor(make, modelRaw) {
  const ks = govKeySets(make, modelRaw, null);
  const ys = new Set();
  for (const [y, list] of govIdx.get(make) ?? []) for (const e of list) if (e.src === "epa" && matchEntry(ks, e)) { ys.add(y); break; }
  return ys;
}
const TYPE_PRI = { Truck: 0, MPV: 1, "Passenger Car": 2 };
const gaps = [];
for (const a of gapAgg.values()) {
  if (a.missing.size === 0) continue;
  const epaYears = epaYearsFor(a.make, a.model_raw);
  const confirmed = new Set([...a.missing].filter((y) => epaYears.has(y)));
  const corroborated = epaYears.size > 0;
  const entirelyMissing = a.missing.size === a.years.size;
  // filter VIN-pattern noise: single-year NHTSA-only models with no EPA corroboration
  if (a.years.size < 2 && !corroborated) continue;
  const recent = Math.max(...a.missing);
  // NHTSA's per-year model list is VIN-pattern based and over-includes years; EPA-confirmed years are the reliable core.
  // HD trucks (>8,500 GVWR) never appear in EPA → keep them via the Truck-type bonus.
  const isHdTruck = /\b(2500|3500|hd|super duty)\b/i.test(a.model_raw);
  const score = confirmed.size * 4 + (a.missing.size - confirmed.size) * 1 + (corroborated || isHdTruck ? 10 : 0) + (TYPE_PRI[a.type] === 0 ? 8 : TYPE_PRI[a.type] === 1 ? 6 : 0) + (recent >= 2015 ? 6 : recent >= 2005 ? 3 : 0) + (entirelyMissing ? 4 : 0);
  gaps.push({ make: a.make, nhtsa_model: a.model_raw, vehicle_type: a.type, years_missing_epa_confirmed: fmtYears(confirmed), n_epa_confirmed: confirmed.size, years_missing_nhtsa_only: fmtYears(new Set([...a.missing].filter((y) => !epaYears.has(y)))), n_years_missing: a.missing.size, n_years_listed: a.years.size, entirely_missing: entirelyMissing, epa_corroborated_any_year: corroborated, most_recent_missing: recent, priority_score: score });
}
gaps.sort((x, y) => y.priority_score - x.priority_score || x.make.localeCompare(y.make) || x.nhtsa_model.localeCompare(y.nhtsa_model));

// EPA-only models (never in NHTSA under that make) that we also lack — appended with source flag
const epaOnly = new Map();
for (const r of epa) {
  const bm = r.base_norm ?? r.model_norm;
  const key = `${r.make_norm}|${bm}`;
  const oursHere = ourMatchedByYear.get(r.make_norm)?.get(r.year) ?? [];
  const gks = govKeySets(r.make_norm, r.model_raw, r.base_model);
  const covered = oursHere.some((oks) => matchEntry(oks, gks));
  const nh = (govIdx.get(r.make_norm)?.get(r.year) ?? []).some((g) => g.src === "nhtsa" && matchEntry(gks, g));
  if (!epaOnly.has(key)) epaOnly.set(key, { make: r.make_norm, model: r.base_model ?? r.model_raw, vclass: r.vclass, years: new Set(), missing: new Set(), nhtsaYears: 0 });
  const a = epaOnly.get(key);
  a.years.add(r.year);
  if (nh) a.nhtsaYears++;
  if (!covered && !nh) a.missing.add(r.year);
}
const epaGaps = [...epaOnly.values()].filter((a) => a.missing.size >= 2 && a.nhtsaYears === 0 && !/roush|saleen|shelby/i.test(a.model))
  .map((a) => ({ make: a.make, epa_base_model: a.model, vclass: a.vclass, years_missing: fmtYears(a.missing), n_years_missing: a.missing.size }))
  .sort((x, y) => y.n_years_missing - x.n_years_missing);

// ---------------------------------------------------------------- trim gaps (EPA, 2000+)
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9. ]+/g, " ").replace(/\s+/g, " ").trim();
const trimGapAgg = new Map();
let trimChecks = 0, trimMatched = 0;
const groupsByMY = new Map(); // make|year -> [{g, ks}]
for (const g of groups.values()) {
  const k = `${g.make}|${g.year}`;
  if (!groupsByMY.has(k)) groupsByMY.set(k, []);
  groupsByMY.get(k).push({ g, ks: ourKeySets(g.make, g.model) });
}
for (const r of epa) {
  if (r.year < TRIM_MIN_YEAR || !r.trim_text) continue;
  // which of our groups (same make/year) match this EPA model?
  const gks = govKeySets(r.make_norm, r.model_raw, r.base_model);
  const cands = [];
  for (const { g, ks } of groupsByMY.get(`${r.make_norm}|${r.year}`) ?? []) {
    if (matchEntry(ks, gks)) cands.push(g);
  }
  if (!cands.length) continue; // Y/M/M gap, not a trim gap
  trimChecks++;
  const toks = r.trim_text.split(" ").filter((t) => t && !/^\d\.\dl?$/.test(t) && !/^v\d$/.test(t) && !/^(new|1500|2500|3500|150|250|350|c1500|k1500|c2500|k2500|door|truck|vehicle|cc|w|ffv|cng)$/.test(t) && !/^\d(dr|door)$/.test(t));
  if (!toks.length) continue;
  const hay = cands.map((g) => norm([...g.trims, g.model.replace(/-/g, " ")].join(" | "))).join(" | ");
  const hit = toks.every((t) => (t.length >= 3 ? hay.includes(t) : new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay)));
  if (hit) { trimMatched++; continue; }
  const model = cands[0].model;
  const k = `${r.make_norm}|${model}|${r.trim_text}`;
  if (!trimGapAgg.has(k)) trimGapAgg.set(k, { make: r.make_norm, our_model: model, epa_trim: r.trim_text, epa_model_example: r.model_raw, years: new Set(), our_trims_example: [...cands[0].trims].slice(0, 5).join(" | ") });
  trimGapAgg.get(k).years.add(r.year);
}
const trimGaps = [...trimGapAgg.values()].map((a) => ({ make: a.make, our_model: a.our_model, epa_trim: a.epa_trim, n_years: a.years.size, years: fmtYears(a.years), epa_model_example: a.epa_model_example, our_trims_example: a.our_trims_example }))
  .sort((x, y) => y.n_years - x.n_years || x.make.localeCompare(y.make) || x.our_model.localeCompare(y.our_model));

// ---------------------------------------------------------------- coverage
const decade = (y) => `${Math.floor(y / 10) * 10}s`;
function coverageBy(keyFn) {
  const acc = new Map();
  const get = (k) => { if (!acc.has(k)) acc.set(k, { key: k, gov_ymm: 0, gov_covered: 0, our_rows: 0, our_exact: 0, our_family: 0, our_crossmake: 0, our_none: 0 }); return acc.get(k); };
  for (const u of govUniverse) { const a = get(keyFn(u)); a.gov_ymm++; if (u.covered) a.gov_covered++; }
  for (const m of matches) { const a = get(keyFn(m)); a.our_rows += m.n_rows; a[`our_${m.match_level}`] += m.n_rows; }
  return [...acc.values()].sort((x, y) => String(x.key).localeCompare(String(y.key))).map((a) => ({
    ...a, gov_coverage_pct: pct(a.gov_covered, a.gov_ymm), our_rows_matched_pct: pct(a.our_exact + a.our_family + a.our_crossmake, a.our_rows), our_rows_exact_pct: pct(a.our_exact, a.our_rows),
  }));
}
const covDecade = coverageBy((x) => decade(x.year)).map((r) => ({ decade: r.key, ...r, key: undefined }));
const covMake = coverageBy((x) => x.make).map((r) => ({ make: r.key, ...r, key: undefined }));
const covTotal = coverageBy(() => "all")[0];

// ---------------------------------------------------------------- make-slug findings
const slugRows = (await db.query(`select make, count(*)::int n, min(year) y0, max(year) y1 from vehicle_fitments where quarantined_at is null group by 1 order by 1`)).rows;
const nhtsaMakes = new Set(nhtsa.map((r) => r.make_norm));
const epaMakes = new Set(epa.map((r) => r.make_norm));
const canonCount = new Map();
for (const r of slugRows) { const c = normMake(r.make); canonCount.set(c, (canonCount.get(c) ?? 0) + 1); }
const slugFindings = slugRows.map((r) => {
  const c = normMake(r.make);
  const issues = [];
  if (compact(r.make) !== c && !ALIASES.make[r.make]) issues.push("non-canonical slug");
  if (/\s(vans|minivans)$/.test(r.make)) issues.push("body-style suffix in make");
  if (r.make === "mercedes") issues.push("duplicate of mercedes-benz");
  if (canonCount.get(c) > 1) issues.push(`${canonCount.get(c)} slugs map to ${c}`);
  if (!nhtsaMakes.has(c)) issues.push("no NHTSA data 1990+ (pre-1990 make or window)");
  if (!epaMakes.has(c)) issues.push("no EPA data 1990+");
  return { make_slug: r.make, canonical: c, n_rows: r.n, years: `${r.y0}-${r.y1}`, issues: issues.join("; ") };
});
const crossMakeCounts = {};
for (const m of matches) if (m.cross_make) crossMakeCounts[`${m.make}→${m.cross_make}`] = (crossMakeCounts[`${m.make}→${m.cross_make}`] ?? 0) + m.n_rows;

// ---------------------------------------------------------------- our unmatched model summary (alias tuning + parent review)
const modelSum = new Map();
for (const m of matches) {
  const k = `${m.make}|${m.model}`;
  if (!modelSum.has(k)) modelSum.set(k, { make: m.make, model: m.model, years: new Set(), rows: 0, none: 0, exact: 0, family: 0, crossmake: 0, noneYears: new Set() });
  const a = modelSum.get(k);
  a.years.add(m.year); a.rows += m.n_rows; a[m.match_level]++;
  if (m.match_level === "none") a.noneYears.add(m.year);
}
const modelSummary = [...modelSum.values()].map((a) => ({ make: a.make, model: a.model, years: fmtYears(a.years), n_rows: a.rows, ymm_exact: a.exact, ymm_family: a.family, ymm_crossmake: a.crossmake, ymm_none: a.none, none_years: fmtYears(a.noneYears) }))
  .sort((x, y) => y.ymm_none - x.ymm_none || x.make.localeCompare(y.make));

// ---------------------------------------------------------------- write outputs
phantomRows.sort((a, b) => (a.severity > b.severity ? 1 : a.severity < b.severity ? -1 : 0) || a.make.localeCompare(b.make) || a.model.localeCompare(b.model) || a.year - b.year);
phantomYmm.sort((a, b) => (a.severity > b.severity ? 1 : a.severity < b.severity ? -1 : 0) || b.n_rows - a.n_rows);
writeCsv("phantom-candidates-rows.csv", phantomRows, ["id", "year", "make", "model", "display_trim", "raw_trim", "submodel", "source", "severity", "reason", "gov_years_for_model"]);
writeCsv("phantom-candidates-ymm.csv", phantomYmm, ["severity", "year", "make_slug", "model", "n_rows", "reason", "gov_years_for_model", "trims"]);
writeCsv("missing-ymm-nhtsa.csv", gaps);
writeCsv("missing-ymm-nhtsa-by-make.csv", [...gaps].sort((x, y) => x.make.localeCompare(y.make) || y.priority_score - x.priority_score));
writeCsv("missing-ymm-epa-only.csv", epaGaps);
writeCsv("trim-gaps.csv", trimGaps);
writeCsv("coverage-by-decade.csv", covDecade, ["decade", "gov_ymm", "gov_covered", "gov_coverage_pct", "our_rows", "our_exact", "our_family", "our_crossmake", "our_none", "our_rows_matched_pct", "our_rows_exact_pct"]);
writeCsv("coverage-by-make.csv", covMake, ["make", "gov_ymm", "gov_covered", "gov_coverage_pct", "our_rows", "our_exact", "our_family", "our_crossmake", "our_none", "our_rows_matched_pct", "our_rows_exact_pct"]);
writeCsv("make-slug-findings.csv", slugFindings);
writeCsv("our-model-match-summary.csv", modelSummary);
writeCsv("ymm-matches.csv", matches);

// DB table for the parent
await db.query(`drop table if exists audit_pass1_matches`);
await db.query(`create table audit_pass1_matches (year int, make_slug text, make_norm text, model text, n_rows int, match_level text, nhtsa_match text, nhtsa_type text, epa_match text, cross_make text, gov_years_for_model text, make_active_in_year boolean)`);
for (let i = 0; i < matches.length; i += 500) {
  const chunk = matches.slice(i, i + 500);
  const vals = [], params = [];
  chunk.forEach((m, k) => { const o = k * 12; vals.push(`(${Array.from({ length: 12 }, (_, j) => `$${o + j + 1}`).join(",")})`); params.push(m.year, m.make_slug, m.make, m.model, m.n_rows, m.match_level, m.nhtsa_match, m.nhtsa_type, m.epa_match, m.cross_make, m.gov_years_for_model, m.make_active_in_year); });
  await db.query(`insert into audit_pass1_matches values ${vals.join(",")}`, params);
}

// ---------------------------------------------------------------- summary
const cnt = (arr) => ({ error: arr.filter((r) => r.severity === "error").length, warn: arr.filter((r) => r.severity === "warn").length, info: arr.filter((r) => r.severity === "info").length });
const sev = cnt(phantomRows), sevYmm = cnt(phantomYmm);
const summary = {
  ours_rows: ours.length, our_ymm: groups.size, nhtsa_rows: nhtsa.length, epa_rows: epa.length, gov_universe_ymm: govUniverse.length,
  phantom_rows: sev, phantom_ymm: sevYmm, missing_models_nhtsa: gaps.length, missing_ymm_nhtsa: gaps.reduce((s, g) => s + g.n_years_missing, 0),
  missing_models_epa_only: epaGaps.length, trim_gaps: trimGaps.length, trim_checks: trimChecks, trim_matched: trimMatched,
  cross_make_rows: crossMakeCounts, coverage_total: covTotal, coverage_decade: covDecade.map((r) => ({ decade: r.decade, gov: r.gov_coverage_pct, ours: r.our_rows_matched_pct, exact: r.our_rows_exact_pct })),
};
fs.writeFileSync(path.join(CACHE_DIR, "_03-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log("\nTop phantom Y/M/M (error):", phantomYmm.filter((r) => r.severity === "error").slice(0, 25).map((r) => `${r.year} ${r.make_slug} ${r.model} (${r.n_rows})`).join("; "));
console.log("\nTop missing:", gaps.slice(0, 30).map((g) => `${g.make} ${g.nhtsa_model} [epa:${g.years_missing_epa_confirmed} | nhtsa-only:${g.years_missing_nhtsa_only}]`).join("; "));
console.log("\nTop trim gaps:", trimGaps.slice(0, 30).map((g) => `${g.make} ${g.our_model} "${g.epa_trim}" x${g.n_years}`).join("; "));
console.log("\nOur models with most unmatched years:", modelSummary.slice(0, 40).map((m) => `${m.make}/${m.model} none=${m.ymm_none}/${m.ymm_none + m.ymm_exact + m.ymm_family + m.ymm_crossmake} [${m.none_years}]`).join("; "));
await db.end();
