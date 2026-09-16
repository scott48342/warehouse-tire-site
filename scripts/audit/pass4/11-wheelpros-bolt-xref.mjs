// Pass 4 / step 2: INTERNAL cross-check of our bolt patterns against WheelPros vehicle-filtered wheel search facets.
// Read-only on our DB; never writes WheelPros values anywhere public. Resumable (appends to out/wheelpros-xref.jsonl, skips done).
//   node --env-file=.env.local scripts/audit/pass4/11-wheelpros-bolt-xref.mjs [--limit N] [--only "make|model"]
// Then: node scripts/audit/pass4/12-wheelpros-xref-report.mjs
import fs from "node:fs";
import pg from "pg";
const OUT = "scripts/audit/pass4/out"; fs.mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/wheelpros-xref.jsonl`;
const LIMIT = process.argv.includes("--limit") ? +process.argv[process.argv.indexOf("--limit") + 1] : Infinity;
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].toLowerCase() : null;
const done = new Set(fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split(/\r?\n/).filter(Boolean).map(l => { const j = JSON.parse(l); return `${j.year}|${j.make}|${j.model}`; }) : []);
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const items = (await p.query(`select year, make, model, array_agg(distinct bolt_pattern) bolts, count(*)::int rows from vehicle_fitments
  where quarantined_at is null and wheel_specs_source is null and bolt_pattern is not null and year <= 2024 group by 1,2,3 order by 1 desc, 2, 3`)).rows
  .filter(i => !done.has(`${i.year}|${i.make}|${i.model}`) && (!ONLY || `${i.make}|${i.model}`.toLowerCase() === ONLY)).slice(0, LIMIT);
await p.end();
console.log(`${items.length} Y/M/M to query (${done.size} already done)`);
let token = null, tokenAt = 0;
async function getToken() {
  if (token && Date.now() - tokenAt < 50 * 60 * 1000) return token;
  const r = await fetch("https://api.wheelpros.com/auth/v1/authorize", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ userName: process.env.WHEELPROS_USERNAME, password: process.env.WHEELPROS_PASSWORD }) });
  if (!r.ok) throw new Error(`auth ${r.status}`);
  token = (await r.json()).accessToken; tokenAt = Date.now(); return token;
}
const title = s => s.split(/[-\s]+/).map(w => /^\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const MAKE = { "mercedes-benz": "Mercedes-Benz", mercedes: "Mercedes-Benz", "rolls-royce": "Rolls-Royce", "alfa-romeo": "Alfa Romeo", "aston-martin": "Aston Martin", "land-rover": "Land Rover", bmw: "BMW", gmc: "GMC", ram: "RAM", mini: "MINI", "am-general": "AM General" };
function modelVariants(slug) {
  const v = new Set();
  v.add(title(slug));                                   // silverado-2500hd -> Silverado 2500HD
  v.add(slug.split("-").map(w => /^\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join("-")); // f-150 -> F-150
  v.add(title(slug).replace(/(\d)HD\b/i, "$1 HD").replace(/(\d)hd\b/i, "$1 HD")); // Silverado 2500 HD
  v.add(title(slug).replace(/\s?HD\b/i, ""));           // Silverado 2500
  v.add(slug.toUpperCase());                            // CTS, RX, etc.
  v.add(title(slug).replace(/-/g, " "));
  return [...v].slice(0, 4);
}
const norm = s => String(s || "").toUpperCase().replace(/\s+/g, "").replace(/X/g, "x").replace(/(\d)\.0\b/g, "$1").replace(/120\.7\b/, "120.65");
let i = 0, agree = 0, conflict = 0, weak = 0, nf = 0;
for (const it of items) {
  i++;
  const rec = { year: it.year, make: it.make, model: it.model, ours: it.bolts, rows: it.rows, ts: new Date().toISOString() };
  const makeName = MAKE[it.make] || title(it.make);
  let facets = null, usedModel = null, status = null;
  for (const mv of modelVariants(it.model)) {
    const u = new URL("https://api.wheelpros.com/products/v1/search/wheel");
    u.searchParams.set("vehicleYear", String(it.year)); u.searchParams.set("vehicleMake", makeName); u.searchParams.set("vehicleModel", mv); u.searchParams.set("pageSize", "1");
    let r;
    try { r = await fetch(u, { headers: { Authorization: `Bearer ${await getToken()}`, Accept: "application/json" } }); } catch (e) { rec.error = String(e.message); break; }
    status = r.status;
    if (r.status === 401) { token = null; continue; }
    if (r.status === 429) { await new Promise(res => setTimeout(res, 15000)); continue; }
    if (r.status !== 200) { await new Promise(res => setTimeout(res, 250)); continue; }
    const j = await r.json(); facets = j.facets || {}; usedModel = mv; rec.total = j.totalCount; break;
  }
  if (!facets) { rec.result = "notfound"; rec.http = status; nf++; }
  else {
    const buckets = (facets.bolt_pattern_metric?.buckets || []).filter(b => b.value && b.value !== "BLANK" && b.value !== "0X0");
    const tally = {};
    for (const b of buckets) for (const part of b.value.split("/")) tally[norm(part)] = (tally[norm(part)] || 0) + b.count;
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ bolt: k, n, share: total ? +(n / total).toFixed(2) : 0 }));
    rec.wpModel = usedModel; rec.wp = ranked.slice(0, 4);
    const ours = it.bolts.map(norm);
    const top = ranked[0];
    if (!top || total < 20) { rec.result = "weak"; weak++; }
    else if (ours.some(o => ranked.slice(0, 2).some(r => r.bolt === o && r.share >= 0.3))) { rec.result = "agree"; agree++; }
    else if (top.share >= 0.6 && top.n >= 50 && !ours.some(o => tally[o])) { rec.result = "conflict"; conflict++; }
    else { rec.result = "weak"; weak++; }
  }
  fs.appendFileSync(LOG, JSON.stringify(rec) + "\n");
  if (i % 100 === 0 || i === items.length) console.log(`${i}/${items.length}  agree=${agree} conflict=${conflict} weak=${weak} notfound=${nf}  (${it.year} ${it.make} ${it.model})`);
  await new Promise(res => setTimeout(res, 350));
}
console.log("done");


