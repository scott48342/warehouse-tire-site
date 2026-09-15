// Compare roadkill bolt-pattern cross-reference vs vehicle_fitments (bolt_pattern, center_bore_mm, thread_size). READ-ONLY.
//   node --env-file=.env.local scripts/audit/pass3/roadkill/02-compare.mjs
// Output: docs/fitment-api/audit/pass3-roadkill.md + docs/fitment-api/audit/pass3/roadkill-{disagree,missing,agree}.csv
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const RK = JSON.parse(fs.readFileSync("scripts/audit/pass3/roadkill/out/roadkill.json", "utf8"));
const DOC = "docs/fitment-api/audit/pass3-roadkill.md", CSVD = "docs/fitment-api/audit/pass3";
fs.mkdirSync(CSVD, { recursive: true });

// ---- normalization ----
const IN2MM = { "3.75": "95.25", "4": "101.6", "4.25": "107.95", "4.5": "114.3", "4.75": "120.7", "5": "127", "5.12": "130", "5.3": "135", "5.5": "139.7", "6.5": "165.1", "6.69": "170", "7.25": "184.15", "8.75": "222.25", "11.25": "285.75" };
function normBolt(s) {
  if (!s) return null;
  const m = String(s).toUpperCase().replace(/\s+/g, "").match(/^(\d+)[X×](\d+(?:\.\d+)?)(?:MM)?$/);
  if (!m) return null;
  let d = m[2];
  if (+d < 20 && IN2MM[d]) d = IN2MM[d];
  d = String(+d);                       // 114.30 → 114.3
  if (d === "120.65" || d === "120.7") d = "120.7";
  if (d === "165.1" || d === "165.1") d = "165.1";
  return `${m[1]}x${d}`;
}
const normBore = s => { if (s == null) return null; const n = parseFloat(String(s).replace(/[^\d.]/g, "")); return isNaN(n) ? null : Math.round(n * 10) / 10; };
function normStud(s) {
  if (!s) return null;
  const t = String(s).toUpperCase().replace(/\s+/g, "");
  let m = t.match(/^M?(\d{2})X(\d(?:\.\d+)?)/); if (m) return `M${m[1]}x${m[2]}`;
  m = t.match(/^(\d+\/\d+)(?:"|IN)?(?:-|X)?(\d{2})?/); if (m) return m[2] ? `${m[1]}-${m[2]}` : m[1];
  return t;
}
const slug = s => String(s).toLowerCase().replace(/&amp;/g, "&").replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// roadkill model → our model slug candidates (expand comma lists, strip engine/displacement suffixes, family rules)
function ourModelCandidates(make, model) {
  const out = new Set();
  const parts = model.split(/\s*,\s*|\s*\/\s*/).map(x => x.trim()).filter(Boolean);
  for (let raw of parts) {
    let m = raw.replace(/\b\d\.\d[LTI]?\b/g, "").replace(/\b(TURBO|DIESEL|HYBRID|AWD|4WD|2WD|FWD|RWD|4X4|4X2|SRW|DRW)\b/gi, "").trim();
    m = m.replace(/\s+/g, " ");
    const s = slug(m);
    if (s) out.add(s);
    // BMW numeric → N-series family
    if (/^bmw$/i.test(make) && /^\d{3}[A-Z]{0,2}$/i.test(m)) out.add(`${m[0]}-series`);
    if (/^bmw$/i.test(make) && /^X\d$/i.test(m)) out.add(m.toLowerCase());
    // Mercedes letters+digits → X-class
    if (/^mercedes/i.test(make)) { const mm = m.match(/^([A-Z]{1,3})\s?\d{2,3}/i); if (mm) out.add(`${mm[1].toLowerCase()}-class`); }
    // F150 → f-150, F250 → f-250 (+ super-duty), E350 → e-350
    const fm = m.match(/^([FE])[- ]?(\d{3})$/i); if (fm) { out.add(`${fm[1].toLowerCase()}-${fm[2]}`); if (+fm[2] >= 250) out.add(`${fm[1].toLowerCase()}-${fm[2]}-super-duty`); }
    const sv = m.match(/^(SILVERADO|SIERRA)\s?(\d{4})\s?(HD)?$/i); if (sv) { out.add(`${sv[1].toLowerCase()}-${sv[2]}`); out.add(`${sv[1].toLowerCase()}-${sv[2]}${sv[3] ? "hd" : ""}`); }
    const ram = m.match(/^(?:RAM\s?)?(\d{4})$/i); if (ram && /^(dodge|ram)$/i.test(make)) { out.add(`ram-${ram[1]}`); out.add(ram[1]); }
    const ck = m.match(/^([CK])\s?(\d{4})$/i); if (ck) { out.add(`c-k-${ck[2]}`); out.add(`c/k-${ck[2]}`); out.add(`${ck[1].toLowerCase()}${ck[2]}`); }
  }
  return [...out];
}
const makeSlug = mk => { const s = slug(mk); return ({ "mercedes-benz": "mercedes-benz", "mercedes": "mercedes-benz", "land-rover": "land-rover", "rolls-royce": "rolls-royce", "alfa-romeo": "alfa-romeo", "aston-martin": "aston-martin", "chevy": "chevrolet", "vw": "volkswagen" })[s] || s; };

// ---- load ours ----
const ours = (await p.query(`select id, year, make, model, display_trim, bolt_pattern, center_bore_mm, thread_size, source, wheel_specs_verified_at from vehicle_fitments where quarantined_at is null and year between 1990 and 2027`)).rows;
const byMM = new Map();
for (const r of ours) { const k = `${r.make}|${r.model}`; if (!byMM.has(k)) byMM.set(k, []); byMM.get(k).push(r); }
const ourModelsByMake = new Map();
for (const k of byMM.keys()) { const [mk, md] = k.split("|"); if (!ourModelsByMake.has(mk)) ourModelsByMake.set(mk, new Set()); ourModelsByMake.get(mk).add(md); }

// ---- match roadkill rows to our rows ----
const cars = RK.filter(r => r.yearFrom && !/^(yamaha|suzuki|honda atv|polaris|kawasaki|can-am|arctic cat|john deere|kubota|bombardier|cub cadet|ezgo|club car|kymco|cfmoto|hisun|linhai|husqvarna|massimo|textron|tracker|odes|coleman|bennche)$/i.test(r.make));
const res = []; const unmatchedRk = []; const rkKeyed = new Map();
for (const rk of cars) {
  const mk = makeSlug(rk.make);
  const have = ourModelsByMake.get(mk);
  if (!have) { unmatchedRk.push({ ...rk, reason: "make-not-in-db" }); continue; }
  const cands = ourModelCandidates(rk.make, rk.model);
  const hit = cands.filter(c => have.has(c));
  // also prefix match (rk 'ACCORD' vs ours 'accord', rk 'F150' handled above)
  if (!hit.length) for (const c of cands) for (const om of have) if (om === c || om.startsWith(c + "-") || c.startsWith(om + "-")) hit.push(om);
  if (!hit.length) { unmatchedRk.push({ ...rk, reason: "model-not-matched", cands: cands.join("|") }); continue; }
  for (const om of new Set(hit)) {
    for (const row of byMM.get(`${mk}|${om}`) || []) {
      if (row.year < rk.yearFrom || row.year > rk.yearTo) continue;
      const k = row.id; if (!rkKeyed.has(k)) rkKeyed.set(k, []); rkKeyed.get(k).push(rk);
    }
  }
}
const cmp = (a, b) => (a == null || b == null) ? (a == null && b == null ? "both-missing" : a == null ? "ours-missing" : "rk-missing") : (a === b ? "agree" : "disagree");
for (const row of ours) {
  const rksAll = rkKeyed.get(row.id); if (!rksAll) continue;
  const tight = rksAll.filter(r => !/>\s*$/.test(r.years) || row.year <= r.yearFrom + 8);
  const rks = tight.length ? tight : rksAll;
  const rangeKind = tight.length ? "tight" : "open";
  const rkBolts = [...new Set(rks.map(r => normBolt(r.bolt)).filter(Boolean))];
  const rkBores = [...new Set(rks.map(r => normBore(r.bore)).filter(v => v != null))];
  const rkStuds = [...new Set(rks.map(r => normStud(r.stud)).filter(Boolean))];
  const ob = normBolt(row.bolt_pattern), obore = normBore(row.center_bore_mm), ost = normStud(row.thread_size);
  const boltS = ob ? (rkBolts.includes(ob) ? "agree" : rkBolts.length ? "disagree" : "rk-missing") : (rkBolts.length ? "ours-missing" : "both-missing");
  const boreS = obore != null ? (rkBores.some(b => Math.abs(b - obore) <= 0.2) ? "agree" : rkBores.length ? "disagree" : "rk-missing") : (rkBores.length ? "ours-missing" : "both-missing");
  const studS = ost ? (rkStuds.includes(ost) ? "agree" : rkStuds.length ? "disagree" : "rk-missing") : (rkStuds.length ? "ours-missing" : "both-missing");
  res.push({ id: row.id, year: row.year, make: row.make, model: row.model, trim: row.display_trim, source: row.source, range: rangeKind,
    our_bolt: ob, rk_bolt: rkBolts.join("|"), bolt: boltS, our_bore: obore, rk_bore: rkBores.join("|"), bore: boreS, our_stud: ost, rk_stud: rkStuds.join("|"), stud: studS,
    rk_ref: [...new Set(rks.map(r => `${r.make} ${r.model} ${r.years}`))].join(" ; ") });
}

// ---- report ----
const count = (arr, f) => arr.reduce((m, x) => (m[f(x)] = (m[f(x)] || 0) + 1, m), {});
const tally = k => count(res, x => x[k]);
const coveredYmm = new Set(res.map(r => `${r.year}|${r.make}|${r.model}`)).size;
const allYmm = new Set(ours.map(r => `${r.year}|${r.make}|${r.model}`)).size;
const disAll = res.filter(r => r.bolt === "disagree" || r.bore === "disagree");
const dis = disAll.filter(r => r.range === "tight");
const disOpen = disAll.length - dis.length;
const topDis = Object.entries(count(dis, r => `${r.make} ${r.model}`)).sort((a, b) => b[1] - a[1]).slice(0, 30);
const bySrc = Object.entries(count(res.filter(r => r.range === "tight" && r.bolt !== "both-missing" && r.bolt !== "rk-missing"), r => `${(r.source || "").split(" ")[0]}|${r.bolt}`)).reduce((m, [k, n]) => { const [s, st] = k.split("|"); (m[s] ||= {})[st] = n; return m; }, {});
const csv = (rows, file) => { if (!rows.length) return; const cols = Object.keys(rows[0]); fs.writeFileSync(path.join(CSVD, file), [cols.join(","), ...rows.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n")); };
csv(dis, "roadkill-disagree.csv");
csv(res.filter(r => r.bolt === "ours-missing" || r.bore === "ours-missing" || r.stud === "ours-missing"), "roadkill-fill-candidates.csv");
csv(res.filter(r => r.bolt === "agree"), "roadkill-agree.csv");
csv(unmatchedRk, "roadkill-unmatched-rk.csv");
const md = `# Pass 3 — Bolt pattern / center bore / stud cross-check (roadkill cross-reference)

_Internal cross-check source. Never cite publicly. Read-only comparison; no DB writes._

- Roadkill rows: ${RK.length} (cars/trucks with year ranges: ${cars.length}); unmatched to our DB: ${unmatchedRk.length} (make-not-in-db ${unmatchedRk.filter(u => u.reason === "make-not-in-db").length}, model-not-matched ${unmatchedRk.filter(u => u.reason === "model-not-matched").length})
- Our rows compared: ${res.length} of ${ours.length} (Y/M/M coverage ${coveredYmm} / ${allYmm} = ${(100 * coveredYmm / allYmm).toFixed(1)}%)
- Rows matched only via an OPEN-ENDED roadkill range (e.g. "1993 >") more than 8 years past its start: ${res.filter(r => r.range === "open").length} → their bolt/bore is a different generation; excluded from actionable disagreements (${disOpen} such disagreements dropped)
- **Actionable (tight-range) bolt/bore disagreements: ${dis.length} rows** → pass3/roadkill-disagree.csv

## Bolt pattern (tight-range rows only: ${res.filter(r => r.range === "tight").length})
${Object.entries(count(res.filter(r => r.range === "tight"), x => x.bolt)).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Center bore (tight-range rows only)
${Object.entries(count(res.filter(r => r.range === "tight"), x => x.bore)).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Stud / thread (tight-range rows only)
${Object.entries(count(res.filter(r => r.range === "tight"), x => x.stud)).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Bolt agreement by our source family
| source | agree | disagree | ours-missing |
|---|---|---|---|
${Object.entries(bySrc).sort((a, b) => ((b[1].disagree || 0) / ((b[1].agree || 0) + (b[1].disagree || 0) + 1)) - ((a[1].disagree || 0) / ((a[1].agree || 0) + (a[1].disagree || 0) + 1))).map(([s, o]) => `| ${s} | ${o.agree || 0} | ${o.disagree || 0} | ${o["ours-missing"] || 0} |`).join("\n")}

## Top 30 models with bolt/bore disagreements
| make model | rows |
|---|---|
${topDis.map(([k, n]) => `| ${k} | ${n} |`).join("\n")}

## Disagreement samples
${dis.slice(0, 25).map(r => `- ${r.year} ${r.make} ${r.model} [${r.trim}] bolt ours=${r.our_bolt} rk=${r.rk_bolt} (${r.bolt}); bore ours=${r.our_bore} rk=${r.rk_bore} (${r.bore}) — ${r.rk_ref}`).join("\n")}

Files: pass3/roadkill-disagree.csv, roadkill-fill-candidates.csv, roadkill-agree.csv, roadkill-unmatched-rk.csv
`;
fs.writeFileSync(DOC, md);
console.log(md.split("\n").slice(0, 40).join("\n"));
await p.end();
