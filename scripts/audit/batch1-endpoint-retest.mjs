// Batch 1 endpoint retest against the isolated read-only dev server (R6).
// Usage: node scripts/audit/batch1-endpoint-retest.mjs [baseUrl]
// Records every response body under docs/fitment-api/audit/retest/ and prints PASS/FAIL per assertion.
// Never calls /api/fitment/validate* (DDL). Read-only GETs only.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://localhost:3002";
const OUT = resolve("docs/fitment-api/audit/retest");
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

async function get(label, path) {
  const url = BASE + path;
  const t0 = Date.now();
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  writeFileSync(resolve(OUT, `${label}.json`), JSON.stringify({ url, status: res.status, ms: Date.now() - t0, body: json ?? text }, null, 2));
  console.log(`\n== ${label}  ${res.status}  ${Date.now() - t0}ms  ${url}`);
  return { status: res.status, json, text };
}

// 1. F5: "Mustang" must not resolve to Mach-E
{
  const r = await get("01-vehicles-search-mustang", "/api/vehicles/search?year=2024&make=Ford&model=Mustang");
  const body = JSON.stringify(r.json ?? r.text);
  check("vehicles/search Mustang: 200", r.status === 200, String(r.status));
  check("vehicles/search Mustang: no Mach-E leakage", !/mach-?e/i.test(body), /mach-?e/i.test(body) ? "Mach-E present" : "clean");
  check("vehicles/search Mustang: no 5x108 (Mach-E) bolt", !/5x108/.test(body));
  const f = r.json?.fitment ?? r.json?.profile ?? r.json;
  const tr = f?.trimRequired ?? r.json?.trimRequired;
  check("vehicles/search Mustang: exposes trimRequired/certifiable flags", tr !== undefined || r.json?.certifiable !== undefined, `trimRequired=${tr} certifiable=${f?.certifiable ?? r.json?.certifiable}`);
}

// 2. F5/F7: check-fitment on Mustang with a 5x108 Mach-E-fitting SKU must not say fits:true
{
  const r = await get("02-check-fitment-mustang-D68117906545", "/api/wheels/check-fitment?sku=D68117906545&year=2024&make=Ford&model=Mustang");
  check("check-fitment Mustang D68117906545: 200", r.status === 200, String(r.status));
  check("check-fitment Mustang D68117906545: fits !== true", r.json?.fits !== true, `fits=${r.json?.fits} reason=${r.json?.reason}`);
}

// 3. F7: 2024 BMW M4 no trim -> trim_required
let m4Sku = null;
{
  const r = await get("03-vehicles-search-m4", "/api/vehicles/search?year=2024&make=BMW&model=M4");
  check("vehicles/search M4: 200", r.status === 200, String(r.status));
  const f = r.json?.fitment ?? r.json?.profile ?? r.json;
  const certifiable = f?.certifiable ?? r.json?.certifiable;
  const trimRequired = f?.trimRequired ?? r.json?.trimRequired;
  check("vehicles/search M4 (no trim): certifiable:false", certifiable === false, `certifiable=${certifiable} trimRequired=${trimRequired}`);
}
{
  const r = await get("04-fitment-search-m4-notrim", "/api/wheels/fitment-search?year=2024&make=BMW&model=M4&pageSize=50");
  check("fitment-search M4 (no trim): 200", r.status === 200, String(r.status));
  const items = r.json?.results ?? [];
  const fit = r.json?.fitment ?? {};
  check("fitment-search M4 (no trim): fitment.certificationBlock = trim_required", fit.certificationBlock === "trim_required", `block=${fit.certificationBlock} trimRequired=${fit.trimRequired} certifiable=${fit.certifiable} resolution=${fit.trimAmbiguity?.resolution} conflicting=${(fit.trimAmbiguity?.conflictingFields ?? []).join(",")}`);
  check("fitment-search M4 (no trim): showGuaranteedFit false", fit.showGuaranteedFit === false, String(fit.showGuaranteedFit));
  const claims = items.filter(i => ["surefit", "specfit"].includes(i?.fitmentValidation?.fitmentClass));
  check("fitment-search M4 (no trim): zero surefit/specfit items", items.length > 0 && claims.length === 0, `items=${items.length} claims=${claims.length}`);
  const certified = items.filter(i => i?.fitmentValidation?.certified === true);
  check("fitment-search M4 (no trim): zero certified:true items", certified.length === 0, `certified=${certified.length}`);
  m4Sku = items.find(i => /5x120/i.test(String(i?.techfeed?.boltPattern ?? i?.properties?.bolt_pattern_metric ?? "")))?.sku ?? items[0]?.sku ?? null;
  console.log(`   M4 sample sku for check-fitment: ${m4Sku}`);
}
if (m4Sku) {
  const r = await get("05-check-fitment-m4-notrim", `/api/wheels/check-fitment?year=2024&make=BMW&model=M4&sku=${encodeURIComponent(m4Sku)}`);
  check("check-fitment M4 (no trim): 200", r.status === 200, String(r.status));
  check("check-fitment M4 (no trim): fits !== true", r.json?.fits !== true, `fits=${r.json?.fits} reason=${r.json?.reason} boltPatternCompatible=${r.json?.boltPatternCompatible}`);
  check("check-fitment M4 (no trim): reason mentions trim", /trim_required/.test(String(r.json?.reason)), String(r.json?.reason));
}

// 4. F3/R4: 2020 Raptor 17" tires -> load index gating, no OE labels, unverified never certifies
{
  const t = await get("06-trims-f150-2020", "/api/vehicles/trims?year=2020&make=Ford&model=F-150");
  const trims = t.json?.trims ?? t.json?.items ?? t.json ?? [];
  const raptor = (Array.isArray(trims) ? trims : []).find(x => /raptor/i.test(JSON.stringify(x)));
  const modId = raptor?.modificationId ?? raptor?.id ?? raptor?.value ?? "ford-f-150-raptor-d926fbf9";
  console.log(`   Raptor modification id: ${modId}`);
  const r = await get("07-tires-search-raptor-17", `/api/tires/search?year=2020&make=Ford&model=F-150&modification=${encodeURIComponent(modId)}&wheelDiameter=17&limit=60`);
  check("tires/search Raptor 17: 200", r.status === 200, String(r.status));
  const tires = r.json?.tires ?? r.json?.results ?? r.json?.items ?? [];
  check("tires/search Raptor 17: results returned", tires.length > 0, `n=${tires.length}`);
  const badge = tires.filter(x => x?.fitBadgeAllowed === true);
  check("tires/search Raptor 17: fitBadgeAllowed never true (unverified source)", badge.length === 0, `badge=${badge.length}`);
  const src = new Set(tires.map(x => x?.requiredLoadIndexSource).filter(Boolean));
  check("tires/search Raptor 17: requiredLoadIndexSource = vehicle_record_unverified only", [...src].every(s => s === "vehicle_record_unverified"), [...src].join(",") || "(none)");
  const below = tires.filter(x => x?.loadIndexOk === false);
  const belowEligible = below.filter(x => x?.packageEligible !== false);
  check("tires/search Raptor 17: below-required tires are packageEligible:false", belowEligible.length === 0, `below=${below.length} stillEligible=${belowEligible.length} required=${tires[0]?.requiredLoadIndex}`);
  const body = JSON.stringify(r.json);
  check("tires/search Raptor 17: no 'OE load'/'OEM load'/'factory load' labels", !/\b(OE|OEM|factory)\s+(load|minimum)/i.test(body));
}

// 5. Package builder: no certified package containing a below-required tire
{
  const r = await get("08-packages-recommended-raptor", "/api/packages/recommended?year=2020&make=Ford&model=F-150&modification=ford-f-150-raptor-d926fbf9");
  check("packages/recommended Raptor: 200/204-ish", r.status < 500, String(r.status));
  const pk = r.json?.packages ?? r.json?.results ?? [];
  const bad = pk.filter(p => p?.tire?.loadIndexOk === false || p?.tires?.some?.(t => t?.loadIndexOk === false));
  check("packages/recommended Raptor: no package with below-required tire", bad.length === 0, `packages=${pk.length} bad=${bad.length}`);
}

const fails = results.filter(r => !r.pass);
writeFileSync(resolve(OUT, "SUMMARY.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), pass: results.length - fails.length, fail: fails.length, results }, null, 2));
console.log(`\n${results.length - fails.length}/${results.length} assertions passed. Bodies in ${OUT}`);
process.exit(fails.length ? 1 : 0);
