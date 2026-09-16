// Pass 4 / step 1: quarantine phantom model-years found by Pass 1 (NHTSA + EPA existence check).
// Input: docs/fitment-api/audit/pass1/phantom-candidates-rows.csv (severity error|warn|info). Quarantines error + warn only; info (2025-26 gov lag) untouched.
//   node --env-file=.env.local scripts/audit/pass4/01-quarantine-phantom-years.mjs [--apply] [--skip "make|model,make|model"]
import fs from "node:fs";
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const skipArg = process.argv[process.argv.indexOf("--skip") + 1];
const SKIP = new Set(process.argv.includes("--skip") ? skipArg.split(",").map(s => s.trim().toLowerCase()) : []);
const WHO = "audit-pass4-phantom-year";
const csv = fs.readFileSync("docs/fitment-api/audit/pass1/phantom-candidates-rows.csv", "utf8").split(/\r?\n/).filter(Boolean);
const h = csv[0].split(",");
const parse = l => { const c = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { c.push(cur); cur = ""; } else cur += ch; } c.push(cur); return Object.fromEntries(h.map((k, i) => [k, c[i]])); };
const rows = csv.slice(1).map(parse).filter(r => (r.severity === "error" || r.severity === "warn") && !SKIP.has(`${r.make}|${r.model}`.toLowerCase()));
const byModel = {};
for (const r of rows) { const k = `${r.make} ${r.model}`; byModel[k] ??= { n: 0, years: new Set(), sev: r.severity, gov: r.gov_years_for_model, reason: r.reason }; byModel[k].n++; byModel[k].years.add(+r.year); }
console.log(`candidates: ${rows.length} rows across ${Object.keys(byModel).length} make/model (error ${rows.filter(r => r.severity === "error").length}, warn ${rows.filter(r => r.severity === "warn").length})`);
for (const [k, v] of Object.entries(byModel).sort((a, b) => b[1].n - a[1].n)) { const ys = [...v.years].sort(); console.log(`  ${v.sev.padEnd(5)} ${k.padEnd(30)} ours ${ys[0]}-${ys[ys.length - 1]} (${ys.length}y, ${v.n} rows)  gov: ${v.gov || "none"}`); }
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  const live = (await c.query(`select id from vehicle_fitments where id = any($1::uuid[]) and quarantined_at is null`, [rows.map(r => r.id)])).rows.length;
  console.log(`\n${live} of ${rows.length} candidate rows are still live`);
  if (APPLY) {
    let n = 0;
    for (const r of rows) {
      const res = await c.query(`update vehicle_fitments v set quarantined_at = now(), last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data') where id = $3 and quarantined_at is null`,
        [WHO, `phantom model-year (Pass 1 NHTSA/EPA existence check, severity ${r.severity}): ${r.reason}; gov years for model: ${r.gov_years_for_model || "none"}`, r.id]);
      n += res.rowCount;
    }
    await c.query("COMMIT"); console.log(`COMMITTED: quarantined ${n} rows`);
  } else { await c.query("ROLLBACK"); console.log("DRY RUN - nothing written"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
