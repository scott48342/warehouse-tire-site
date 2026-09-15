import fs from "node:fs";
import path from "node:path";
import { OUT_DIR } from "./00-lib.mjs";
const csv = (n) => { const t = fs.readFileSync(path.join(OUT_DIR, n), "utf8").split(/\r?\n/).filter(Boolean); const h = t[0].split(","); const parse = (l) => { const o = []; let c = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"') { if (l[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else if (ch === '"') q = true; else if (ch === ",") { o.push(c); c = ""; } else c += ch; } o.push(c); return o; }; return t.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [h[i], v]))); };
const ph = csv("phantom-candidates-ymm.csv");
console.log("## errors (all)");
for (const r of ph.filter((r) => r.severity === "error")) console.log(`${r.year} | ${r.make_slug} | ${r.model} | ${r.n_rows} | ${r.reason}`);
console.log("\n## warn by model (rows)");
const agg = new Map();
for (const r of ph.filter((r) => r.severity === "warn")) { const k = `${r.make_slug}|${r.model}`; if (!agg.has(k)) agg.set(k, { k, rows: 0, years: [], gov: r.gov_years_for_model }); agg.get(k).rows += +r.n_rows; agg.get(k).years.push(+r.year); }
for (const a of [...agg.values()].sort((x, y) => y.rows - x.rows).slice(0, 45)) console.log(`${a.k} | rows ${a.rows} | our phantom yrs ${a.years.sort().join(",")} | gov yrs ${a.gov}`);
console.log("\n## info by model (2025+)");
const agg2 = new Map();
for (const r of ph.filter((r) => r.severity === "info")) { const k = `${r.make_slug}|${r.model}`; if (!agg2.has(k)) agg2.set(k, { k, rows: 0, years: [] }); agg2.get(k).rows += +r.n_rows; agg2.get(k).years.push(+r.year); }
console.log([...agg2.values()].sort((x, y) => y.rows - x.rows).map((a) => `${a.k}(${a.rows}:${a.years.sort().join("/")})`).join("; "));
console.log("\n## phantom rows by make");
const rows = csv("phantom-candidates-rows.csv");
const bm = {};
for (const r of rows) { bm[r.make] = bm[r.make] ?? { error: 0, warn: 0, info: 0 }; bm[r.make][r.severity]++; }
console.log(Object.entries(bm).sort((a, b) => (b[1].error + b[1].warn) - (a[1].error + a[1].warn)).map(([m, c]) => `${m} e${c.error}/w${c.warn}/i${c.info}`).join("; "));
console.log("\n## phantom rows by source");
const bs = {};
for (const r of rows) if (r.severity !== "info") bs[r.source] = (bs[r.source] ?? 0) + 1;
console.log(Object.entries(bs).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s}(${c})`).join("; "));
console.log("\n## top 45 missing (nhtsa)");
for (const g of csv("missing-ymm-nhtsa.csv").slice(0, 45)) console.log(`${g.make} | ${g.nhtsa_model} | ${g.vehicle_type} | epa-confirmed: ${g.years_missing_epa_confirmed} (${g.n_epa_confirmed}) | nhtsa-only: ${g.years_missing_nhtsa_only} | entirely_missing=${g.entirely_missing} | score ${g.priority_score}`);
console.log("\n## missing epa-only top 25");
for (const g of csv("missing-ymm-epa-only.csv").slice(0, 25)) console.log(`${g.make} | ${g.epa_base_model} | ${g.vclass} | ${g.years_missing}`);
console.log("\n## top 45 trim gaps");
for (const g of csv("trim-gaps.csv").slice(0, 45)) console.log(`${g.make} | ${g.our_model} | "${g.epa_trim}" | x${g.n_years} ${g.years} | e.g. ${g.epa_model_example} | ours: ${g.our_trims_example.slice(0, 60)}`);
console.log("\n## slug findings (issues only)");
for (const s of csv("make-slug-findings.csv").filter((s) => s.issues)) console.log(`${s.make_slug} -> ${s.canonical} | ${s.n_rows} rows | ${s.years} | ${s.issues}`);
console.log("\n## coverage by make (sorted by gov coverage)");
for (const c of csv("coverage-by-make.csv").filter((c) => +c.our_rows > 0).sort((a, b) => parseFloat(a.gov_coverage_pct) - parseFloat(b.gov_coverage_pct))) console.log(`${c.make} | gov ${c.gov_covered}/${c.gov_ymm} ${c.gov_coverage_pct} | ours ${c.our_rows} rows matched ${c.our_rows_matched_pct} (none ${c.our_none})`);
console.log("\n## coverage by decade");
for (const c of csv("coverage-by-decade.csv")) console.log(JSON.stringify(c));
