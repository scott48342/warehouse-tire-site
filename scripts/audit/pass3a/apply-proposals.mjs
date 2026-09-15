// Pass 3a — apply gap-fill proposals to vehicle_fitments.
//   node --env-file=.env.local scripts/audit/pass3a/apply-proposals.mjs            # DRY RUN (default): counts + dup check, no writes
//   node --env-file=.env.local scripts/audit/pass3a/apply-proposals.mjs --apply    # insert (parent only)
//   optional filters: --make=ford --model=f-150 --min-confidence=medium
// Rules: INSERT only (never UPDATE/DELETE existing rows). Skips any proposal whose (year, make, model, display_trim) already has an
// active row, or whose modification_id already exists. certification_status='certified' ONLY for confidence=high, else 'unverified'.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1];
const F_MAKE = arg("make"), F_MODEL = arg("model"), MIN_CONF = arg("min-confidence");
const RANK = { low: 0, medium: 1, high: 2 };
const FILE = path.resolve("docs/fitment-api/audit/pass3a/proposals.json");
const SCRIPT_VERSION = "audit-2026-09";

let rows = JSON.parse(fs.readFileSync(FILE, "utf8"));
if (F_MAKE) rows = rows.filter((r) => r.make === F_MAKE);
if (F_MODEL) rows = rows.filter((r) => r.model === F_MODEL);
if (MIN_CONF) rows = rows.filter((r) => RANK[r.confidence] >= RANK[MIN_CONF]);

const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, v) => (await p.query(s, v)).rows;

// existing active rows for the (make, model) pairs in scope
const pairs = [...new Set(rows.map((r) => `${r.make}|${r.model}`))].map((s) => s.split("|"));
const existing = new Map(); // key year|make|model|display_trim(lower) -> id
const existingIds = new Set();
for (const [mk, md] of pairs) {
  const ex = await q(`select id, year, display_trim, modification_id from vehicle_fitments where make=$1 and model=$2 and quarantined_at is null`, [mk, md]);
  for (const e of ex) { existing.set(`${e.year}|${mk}|${md}|${String(e.display_trim).toLowerCase()}`, e.id); existingIds.add(e.modification_id); }
}

const plan = { insert: [], dupTrim: [], dupId: [] };
for (const r of rows) {
  const k = `${r.year}|${r.make}|${r.model}|${r.display_trim.toLowerCase()}`;
  if (existing.has(k)) plan.dupTrim.push(r);
  else if (existingIds.has(r.modification_id)) plan.dupId.push(r);
  else plan.insert.push(r);
}

// summary
const summarize = (list) => {
  const by = {};
  for (const r of list) { const k = `${r.make} ${r.model}`; by[k] ??= { n: 0, years: new Set(), conf: {} }; by[k].n++; by[k].years.add(r.year); by[k].conf[r.confidence] = (by[k].conf[r.confidence] || 0) + 1; }
  return Object.keys(by).sort().map((k) => `    ${k.padEnd(22)} rows=${String(by[k].n).padStart(3)}  years=${[...by[k].years].sort().join(",")}  conf=${JSON.stringify(by[k].conf)}`).join("\n");
};
console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${rows.length} proposals from ${path.relative(process.cwd(), FILE)}`);
console.log(`  to insert: ${plan.insert.length}\n${summarize(plan.insert)}`);
if (plan.dupTrim.length) console.log(`  SKIP (active row already has year+make+model+display_trim): ${plan.dupTrim.length}\n${summarize(plan.dupTrim)}`);
if (plan.dupId.length) console.log(`  SKIP (modification_id exists): ${plan.dupId.length}\n${summarize(plan.dupId)}`);
const certified = plan.insert.filter((r) => r.confidence === "high").length;
console.log(`  certification: ${certified} certified (high) / ${plan.insert.length - certified} unverified (medium/low)`);

// per-year breakdown for the insert set
const perYear = {};
for (const r of plan.insert) { const k = `${r.make} ${r.model}`; perYear[k] ??= {}; perYear[k][r.year] = (perYear[k][r.year] || 0) + 1; }
for (const k of Object.keys(perYear).sort()) console.log(`    ${k}: ` + Object.entries(perYear[k]).map(([y, n]) => `${y}×${n}`).join(" "));

if (!APPLY) { console.log("\n(dry run — pass --apply to insert)"); await p.end(); process.exit(0); }

// ensure audit table exists (parent-owned record of what pass3a inserted)
await q(`create table if not exists audit_pass3a_inserts (id uuid primary key, modification_id text, year int, make text, model text, display_trim text, confidence text, generation text, sources jsonb, inserted_at timestamptz default now())`);

let n = 0;
await q("BEGIN");
try {
for (const r of plan.insert) {
  const reason = `audit-2026-09 pass3a gap-fill: ${r.generation} ${r.sources[0]?.url ?? ""}`.slice(0, 1000);
  const cert = r.confidence === "high" ? "certified" : "unverified";
  const confTag = r.confidence === "high" ? "HIGH" : r.confidence === "medium" ? "MEDIUM" : "LOW";
  const ins = await q(
    `INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm,
       thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier, certification_status,
       certified_at, certified_by_script_version, confidence_tag, is_locked, last_modified_by, last_modified_reason, last_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,'complete',$17::text,
       CASE WHEN $17::text='certified' THEN now() ELSE NULL END, $18, $19, true, 'clawd', $20, now())
     RETURNING id`,
    [r.year, r.make, r.model, r.modification_id, r.raw_trim, r.display_trim, r.submodel, r.bolt_pattern, r.center_bore_mm,
     r.thread_size, r.seat_type, r.offset_min_mm, r.offset_max_mm, JSON.stringify(r.oem_wheel_sizes), JSON.stringify(r.oem_tire_sizes),
     r.source, cert, SCRIPT_VERSION, confTag, reason]);
  await q(`insert into audit_pass3a_inserts (id, modification_id, year, make, model, display_trim, confidence, generation, sources) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [ins[0].id, r.modification_id, r.year, r.make, r.model, r.display_trim, r.confidence, r.generation, JSON.stringify(r.sources)]);
  n++;
}
await q("COMMIT");
} catch (e) {
  await q("ROLLBACK");
  console.error(`FAILED at row ${n + 1} — rolled back, 0 rows inserted:`, e.message);
  await p.end();
  process.exit(1);
}
console.log(`\ninserted ${n} rows (logged in audit_pass3a_inserts) — COMMITTED`);
await p.end();
