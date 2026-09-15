// Pass 2 / step 3: render docs/fitment-api/audit/pass2-tires.md from summary.json (written by 02-compare).
//   node scripts/audit/pass2/03-doc.mjs
import fs from "node:fs";
import path from "node:path";
import { OUT_DIR, readJson, pct } from "./lib.mjs";

const S = readJson(path.join(OUT_DIR, "summary.json"));
if (!S) throw new Error("summary.json missing — run 02-compare first");
const prog = readJson(path.resolve(OUT_DIR, "../../../../scripts/audit/pass2/cache/_progress.json"), {});
const ROW_STATUSES = ["match", "partial", "mismatch", "our_empty", "usaf_missing_ymm", "not_fetched"];
const YMM_STATUSES = ["exact", "ours_subset", "overlap", "disjoint", "our_empty", "usaf_missing_ymm", "not_fetched"];
const tbl = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const n = (x) => (x ?? 0).toLocaleString("en-US");
const statusRow = (label, m, total) => [label, n(total), ...ROW_STATUSES.map((s) => `${n(m[s])} (${pct(m[s] ?? 0, total)})`)];
const sumRow = (m) => Object.values(m).reduce((a, b) => a + b, 0);

const byDecade = Object.entries(S.byDecade).sort();
const bySource = Object.entries(S.bySource).map(([k, m]) => ({ k, m, total: sumRow(m), verified: sumRow(m) ? (m.match ?? 0) / sumRow(m) : 0, bad: ((m.mismatch ?? 0) + (m.partial ?? 0)) })).sort((a, b) => b.total - a.total);
const comparable = (S.byStatus.match ?? 0) + (S.byStatus.partial ?? 0) + (S.byStatus.mismatch ?? 0);
const worstSources = bySource.filter((s) => s.total >= 100).map((s) => ({ ...s, badPct: (s.bad) / Math.max(1, (s.m.match ?? 0) + s.bad) })).sort((a, b) => b.badPct - a.badPct);

const md = `# Pass 2 — OE Tire Sizes vs. US AutoForce (GetVehicleOptions)

Generated ${S.generated} · rows compared **${n(S.rows)}** (active \`vehicle_fitments\`, 1990–2026) · distinct Y/M/M **${n(S.ymm)}** · USAF HTTP calls made ${n(prog.http_calls)} (cached call log: \`scripts/audit/pass2/cache/_calls.jsonl\`).

## Method
- Source: US AutoForce SOAP \`GetVehicleOptions(year, make, model)\` via our prod admin route \`/api/admin/usaf-vehicle?action=options\` (creds live only on Vercel). **USAF exposes no make/model list** — the WSDL (\`scripts/audit/pass2/_wsdl.xml\`) has only \`GetVehicleOptions\`; the route's \`action=makes|models\` return SOAP 500 because those operations do not exist. USAF returns OE sizes per **Y/M/M only, no trims**, so each of our rows is compared against the union of USAF sizes for its Y/M/M, and each Y/M/M's USAF sizes are compared against the union of all our active trims.
- Name matching (\`lib.mjs\`): ranked candidates per Y/M/M, stop at first hit for model-level names — learned names for the same make+model (other years) → slug transforms (\`f-150\`→\`F-150\`, \`silverado-2500hd\`→\`Silverado 2500 HD\`, \`es-350\`→\`ES350\`) → overrides learned from probes → aliases.json equivalents → GM series toggles (\`Suburban\`↔\`Suburban 1500\`). When nothing hits, or for family slugs (\`bmw 3-series\`, \`mercedes c-class\`, \`lexus es\`), **all** trim-derived variants are tried and unioned: \`<Model> <Trim>\` (USAF splits 2005–2010 Dodge Rams as \`Ram 1500 Laramie/SLT/ST/Sport/TRX4/SRT-10\`) and make-specific variant names (\`AMG C 43 4MATIC\`→\`C43 AMG\`, \`ES 350\`→\`ES350\`, \`330i xDrive\`). USAF names are case-insensitive; spacing/hyphens matter. Every call (positive and negative) is cached; 01 is resumable.
- Normalization (both sides, \`normTire\`): uppercase, strip spaces; drop \`P\`/\`LT\`/\`T\` prefixes, \`Z\`/speed letters before \`R\`, \`RF\` run-flat, \`C\` commercial, \`/C../E\` load range, trailing load index/speed; flotation \`33x12.50R20LT/C\`→\`33X12.50R20\`. Vintage alpha/bias sizes (\`F70-14\`, \`8.00-15\`) are unparseable → excluded from comparison (${n(S.unparseableRows)} rows carry at least one unparseable string).
- Row status: **match** = all our sizes ∈ USAF · **partial** = some of ours ∉ USAF · **mismatch** = none of ours ∈ USAF · **our_empty** = no parseable size on our row · **usaf_missing_ymm** = no USAF model name matched (could be USAF gap, a naming miss, or a phantom Y/M/M). Trim-level status (\`trim_status\`) is additionally recorded when the USAF model name embeds our trim (e.g. \`Ram 1500 Laramie\`) — ${n(sumRow(S.trimLevel))} rows.
- Nothing in \`vehicle_fitments\` was modified. Results: tables \`audit_pass2_usaf_sizes\`, \`audit_pass2_unmatched\`, \`audit_pass2_results\` (per row), \`audit_pass2_ymm\` (per Y/M/M); CSVs in \`docs/fitment-api/audit/pass2/\`.

## USAF coverage of our Y/M/M
${tbl(["Y/M/M", "count", "share"], [["total active Y/M/M 1990–2026", n(S.ymmCoverage.total), "100%"], ["matched a USAF model (≥1 size)", n(S.ymmCoverage.matched), pct(S.ymmCoverage.matched, S.ymmCoverage.total)], ["no USAF match (usaf_missing_ymm)", n(S.ymmCoverage.unmatched), pct(S.ymmCoverage.unmatched, S.ymmCoverage.total)], ["not fetched", n(S.ymmCoverage.not_fetched), pct(S.ymmCoverage.not_fetched, S.ymmCoverage.total)]])}

Per-Y/M/M size agreement (union of our trims vs USAF):
${tbl(["Y/M/M status", "count", "share"], YMM_STATUSES.filter((s) => S.ymmByStatus[s]).map((s) => [s, n(S.ymmByStatus[s]), pct(S.ymmByStatus[s], S.ymm)]))}

\`exact\` = same set · \`ours_subset\` = we list fewer sizes than USAF (missing OE sizes) · \`overlap\` = both extra and missing · \`disjoint\` = nothing in common.

By decade (Y/M/M):
${tbl(["decade", ...YMM_STATUSES], Object.entries(S.ymmByDecade).sort().map(([d, m]) => [d, ...YMM_STATUSES.map((s) => n(m[s]))]))}

## Row status counts
Overall (${n(S.rows)} rows; ${n(comparable)} comparable = match+partial+mismatch):
${tbl(["scope", "rows", ...ROW_STATUSES], [statusRow("all", S.byStatus, S.rows)])}

By decade:
${tbl(["decade", "rows", ...ROW_STATUSES], byDecade.map(([d, m]) => statusRow(d, m, sumRow(m))))}

By \`source\` family (bracket suffixes like \`[expanded]\` folded in; sorted by rows):
${tbl(["source family", "rows", "match", "partial", "mismatch", "our_empty", "usaf_missing", "match % of comparable"], bySource.map((s) => [s.k, n(s.total), n(s.m.match), n(s.m.partial), n(s.m.mismatch), n(s.m.our_empty), n(s.m.usaf_missing_ymm), pct(s.m.match ?? 0, (s.m.match ?? 0) + s.bad)]))}

Worst source families by (partial+mismatch) share of comparable rows (≥100 rows):
${tbl(["source family", "comparable", "partial+mismatch", "share"], worstSources.slice(0, 10).map((s) => [s.k, n((s.m.match ?? 0) + s.bad), n(s.bad), pct(s.bad, (s.m.match ?? 0) + s.bad)]))}

## Top 30 models by mismatched/partial rows
${tbl(["make", "model", "rows", "match", "partial", "mismatch", "bad %"], S.topMismatch.slice(0, 30).map((m) => [m.make, m.model, n(m.rows), n(m.match), n(m.partial), n(m.mismatch), `${m.bad_pct}%`]))}

Full list: \`pass2/models-mismatch-ranked.csv\`; row detail: \`pass2/rows-mismatch.csv\`, \`pass2/rows-partial.csv\`.

## Missing OE sizes (USAF size present in none of our trims for that Y/M/M)
**${n(S.missingOeSizesTotal)}** missing (Y/M/M, size) pairs across **${n(S.ymmWithMissingOe)}** Y/M/M — evidence of missing trims/packages (or of USAF listing optional/dealer sizes; verify against OEM before adding). Top 30 models:
${tbl(["make", "model", "Y/M/M affected", "missing sizes", "years", "sample sizes"], S.topMissing.slice(0, 30).map((m) => [m.make, m.model, n(m.ymm_with_missing), n(m.missing_sizes_total), m.years, m.sample]))}

Full list: \`pass2/ymm-missing-oe-sizes.csv\`, \`pass2/models-missing-oe-ranked.csv\`.

## Y/M/M with no USAF match (${n(S.ymmCoverage.unmatched)} Y/M/M, ${n(S.unmatchedModelsTotal)} make+model)
\`other_years_matched = true\` means the same make+model DID match USAF in other years → the unmatched year is a **phantom-year candidate** (USAF has no such vehicle that year) rather than a naming problem. \`false\` → naming miss or model absent from USAF entirely (check \`tried\` in \`ymm-usaf-unmatched.csv\`). Top 40 by rows:
${tbl(["make", "model", "Y/M/M", "rows", "years", "other years matched"], S.unmatchedModels.slice(0, 40).map((m) => [m.make, m.model, n(m.ymm), n(m.rows), m.years, m.other_years_matched ? "yes" : "no"]))}

Full list: \`pass2/models-usaf-unmatched-ranked.csv\`, \`pass2/ymm-usaf-unmatched.csv\`.

## Notable findings observed while matching names
- **USAF model years are precise** (no 2014 BMW M4, 2005 M6, 2013 i8, 2002 Z4, 2013–14 Colorado, 2020+ LaCrosse, 2001 Escalade, 2012–18 Ranger, 2011–19 Fiesta only …). Most \`usaf_missing_ymm\` with \`other_years_matched=yes\` are therefore phantom model years in our table, not naming misses.
- **\`ram | 1500/2500/3500\` rows for 1994–2010** (346 rows) are Dodge-era trucks stored under make \`ram\` (Ram became a make in 2011). Pass 2 matched them via cross-make lookup (\`Dodge | Ram 1500 …\`) so their sizes are compared, but the make slug itself needs a Pass 0/1 fix.
- **Chrysler Voyager 1990–1999** rows exist under Chrysler (Plymouth-era) — USAF has Chrysler Voyager 2000+ only.
- USAF splits **2005–2010 Dodge Rams by trim** (\`Ram 1500 Laramie/SLT/ST/Sport/TRX4/SRT-10\`) and **Audi by drivetrain/body** (\`A4 Quattro\`, \`A5 Sportback\`, \`RS6 Avant\`); GM 1990s trucks are \`C1500/K1500/K1500 Suburban\`; Land Rover Discovery 2005–2016 is \`LR3/LR4\`.
- Confirmed **USAF catalog gaps** (all name variants fail, all years): Ford F-450 Super Duty, Chrysler Pacifica 2017+, Hummer H1 (only via make \`AM General\`), most exotics pre-2015.
- Family slugs (\`bmw 3-series\`, \`mercedes c-class\`, \`lexus es\`) whose rows carry only \`Base\` trims were matched via year-gated variant tables in \`lib.mjs\` (\`BMW_VARIANTS\`, \`LEXUS_VARIANTS\`, \`MB_VARIANTS\`) — their \`missing_oe\` lists are the strongest evidence of missing variant trims.

## Prioritized parent-apply list (flags only — nothing applied)
1. **Row-level \`mismatch\` (${n(S.byStatus.mismatch)} rows, \`rows-mismatch.csv\`)** — none of our sizes exist for that Y/M/M per USAF. Highest-confidence wrong data. Suggested: set \`certification_status='flagged'\` with reason \`pass2:mismatch\`; where \`rim_overlap=false\` (no shared rim diameter) also consider quarantine pending OEM check. Where \`trim_status='mismatch'\` (USAF has a trim-level name) the row is wrong at trim level, not just model level.
2. **Row-level \`partial\` (${n(S.byStatus.partial)} rows, \`rows-partial.csv\`)** — row lists extra sizes USAF does not have for the Y/M/M (\`ours_not_in_usaf\`). Typical cause: "Base" rows that union every size of the generation. Suggested: flag; drop \`ours_not_in_usaf\` sizes after OEM check.
3. **Missing OE sizes (${n(S.ymmWithMissingOe)} Y/M/M, \`ymm-missing-oe-sizes.csv\`)** — USAF lists sizes we don't carry anywhere for the Y/M/M → probable missing trim/package (feeds Pass 1 trim-gap list). Suggested: add trims from OEM/EPA lists, not blindly from USAF.
4. **Unmatched Y/M/M with \`other_years_matched=yes\` (\`models-usaf-unmatched-ranked.csv\`)** — phantom-year candidates; cross-check with Pass 1 NHTSA result before quarantining.
5. **Unmatched make+model with \`other_years_matched=no\`** — add to \`MODEL_OVERRIDES\` in \`lib.mjs\` if it is a naming miss and re-run 01 (cache makes it cheap); otherwise USAF simply lacks the model (exotics, pre-1995, EVs newer than USAF's catalog).
6. **\`match\` rows (${n(S.byStatus.match)})** — eligible for \`tire_verified\` in the final certification script (source reference: \`usaf:GetVehicleOptions\`, models in \`audit_pass2_results.usaf_models\`). Note this verifies sizes at Y/M/M granularity only; a row can be \`match\` while assigned to the wrong trim.

## Re-run
\`\`\`
node --env-file=.env.local scripts/audit/pass2/01-fetch-usaf.mjs            # resumable; add --load-only to just (re)load audit_pass2_usaf_sizes/unmatched from cache
node --env-file=.env.local scripts/audit/pass2/02-compare.mjs               # offline, deterministic
node scripts/audit/pass2/03-doc.mjs                                         # this document
\`\`\`
`;
const out = path.resolve(OUT_DIR, "../pass2-tires.md");
fs.writeFileSync(out, md);
console.log(`wrote ${out} (${md.length} chars)`);
