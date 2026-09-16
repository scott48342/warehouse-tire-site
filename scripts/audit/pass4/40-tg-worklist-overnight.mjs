// Overnight Tire Guide worklist (2026-09-16): Y/M/M where wheel specs are STILL unverified after the WheelPros xref, plus the xref 'weak'
// vehicles. Prioritized: newer years first (TG covers 1990+ well and customers search recent vehicles), then by nameplate row-count.
// Excludes 2025+ (TG covers, but our USAF tire data there is fresh; do those in a later pass) and pre-1990 (TG coverage thins).
// Output: scripts/audit/pass3/tireguide/worklist-overnight.json  (shape tg-loop.ps1 expects: year, make, model, reason, weight)
import fs from "node:fs";
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const rows = (await p.query(`select year, make, model, count(*)::int rows, array_agg(distinct bolt_pattern) bolts from vehicle_fitments
  where quarantined_at is null and wheel_specs_source is null and year between 1990 and 2024 group by 1,2,3`)).rows;
await p.end();
const x = fs.readFileSync("scripts/audit/pass4/out/wheelpros-xref.jsonl", "utf8").split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const weak = new Set(x.filter(r => r.result === "weak").map(r => `${r.year}|${r.make}|${r.model}`));
const nf = new Set(x.filter(r => r.result === "notfound").map(r => `${r.year}|${r.make}|${r.model}`));
const byNameplate = {}; for (const r of rows) byNameplate[`${r.make}|${r.model}`] = (byNameplate[`${r.make}|${r.model}`] || 0) + r.rows;
const items = rows.map(r => {
  const k = `${r.year}|${r.make}|${r.model}`;
  const reason = weak.has(k) ? "wp-weak" : nf.has(k) ? "wp-notfound" : "unverified";
  // priority: recent years dominate; weak (WP had partial data disagreeing) slightly ahead of notfound
  const prio = (r.year - 1990) * 10 + (reason === "wp-weak" ? 5 : 0) + Math.min(byNameplate[`${r.make}|${r.model}`], 4);
  return { year: r.year, make: r.make, model: r.model, prio, reason, weight: byNameplate[`${r.make}|${r.model}`], rows: r.rows, our_bolt: r.bolts.join("/") };
}).sort((a, b) => b.prio - a.prio || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
fs.writeFileSync("scripts/audit/pass3/tireguide/worklist-overnight.json", JSON.stringify(items, null, 1));
const byReason = {}; for (const i of items) byReason[i.reason] = (byReason[i.reason] || 0) + 1;
console.log(`worklist-overnight.json: ${items.length} Y/M/M (${JSON.stringify(byReason)}), covering ${items.reduce((s, i) => s + i.rows, 0)} rows`);
console.log("first 12:", items.slice(0, 12).map(i => `${i.year} ${i.make} ${i.model} [${i.reason}]`).join("; "));
const yrs = {}; for (const i of items) yrs[Math.floor(i.year / 5) * 5] = (yrs[Math.floor(i.year / 5) * 5] || 0) + 1;
console.log("by 5yr:", JSON.stringify(yrs));
