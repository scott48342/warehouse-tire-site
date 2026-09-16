// Pass 4 / step 2b: quarantine phantom-trim rows from 02-scan output. Safety: never leave a (year,make,model) with zero live rows.
//   node --env-file=.env.local scripts/audit/pass4/03-quarantine-phantom-trims.mjs [--apply]
import fs from "node:fs";
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass4-phantom-trim";
const csv = fs.readFileSync("docs/fitment-api/audit/pass4/phantom-trim-candidates.csv", "utf8").split(/\r?\n/).filter(Boolean);
const h = csv[0].split(",").map(s => s.replace(/"/g, ""));
const parse = l => { const c = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { c.push(cur); cur = ""; } else cur += ch; } c.push(cur); return Object.fromEntries(h.map((k, i) => [k, c[i]])); };
const cand = csv.slice(1).map(parse);
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  // live counts per Y/M/M, and how many of those are candidates
  const ids = cand.map(r => r.id);
  const live = (await c.query(`select year, make, model, count(*)::int n, count(*) filter (where id = any($1::uuid[]))::int cand from vehicle_fitments
    where quarantined_at is null group by 1,2,3 having count(*) filter (where id = any($1::uuid[])) > 0`, [ids])).rows;
  const wouldEmpty = live.filter(r => r.n === r.cand);
  const skipKeys = new Set(wouldEmpty.map(r => `${r.year}|${r.make}|${r.model}`));
  const go = cand.filter(r => !skipKeys.has(`${r.year}|${r.make}|${r.model}`));
  console.log(`candidates ${cand.length}; would-empty Y/M/M skipped: ${wouldEmpty.length} (${cand.length - go.length} rows) -> quarantining ${go.length}`);
  for (const r of wouldEmpty.slice(0, 40)) console.log(`  SKIP (only rows for vehicle): ${r.year} ${r.make} ${r.model} (${r.n} rows)`);
  if (APPLY) {
    let n = 0;
    for (const r of go) {
      const res = await c.query(`update vehicle_fitments v set quarantined_at = now(), last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data') where id = $3 and quarantined_at is null`,
        [WHO, `phantom trim: '${r.display_trim}' on ${r.year} ${r.make} ${r.model} - ${r.rule} (Pass 4 trim-introduction scan)`, r.id]);
      n += res.rowCount;
    }
    await c.query("COMMIT"); console.log(`COMMITTED: quarantined ${n} rows`);
  } else { await c.query("ROLLBACK"); console.log("DRY RUN - nothing written"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
