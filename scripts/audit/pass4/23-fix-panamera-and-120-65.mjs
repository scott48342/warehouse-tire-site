// (a) Porsche Panamera all years -> 5x130 / 71.6 (Scott; 5x112 rows were Macan-contaminated like Cayenne)
// (b) Normalize bolt notation 5x120.7 -> 5x120.65 everywhere ("120.7 isn't really a size" - Scott). Also 6x139.7/5x139.7 stay (those ARE real).
//   node --env-file=.env.local scripts/audit/pass4/23-fix-panamera-and-120-65.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass4-wheelpros-xref";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  const pb = (await c.query(`select year, bolt_pattern, count(*)::int n from vehicle_fitments where make='porsche' and model='panamera' and quarantined_at is null group by 1,2 order by 1`)).rows;
  console.log("panamera before:", pb.map(x => `${x.year}:${x.bolt_pattern}x${x.n}`).join(" "));
  const a = await c.query(`update vehicle_fitments v set bolt_pattern='5x130', center_bore_mm=71.6, wheel_specs_source='wheelpros-xref', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
      last_modified_by=$1, last_modified_reason='Panamera is 5x130 all generations - WheelPros 100% (2017), Scott confirmed; 5x112 rows were Macan-contaminated', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='porsche' and model='panamera' and quarantined_at is null and (bolt_pattern is distinct from '5x130' or center_bore_mm is distinct from 71.6)`, [WHO]);
  console.log(`panamera -> 5x130/71.6: ${a.rowCount} rows`);
  const nb = (await c.query(`select make, model, min(year) y1, max(year) y2, count(*)::int n from vehicle_fitments where bolt_pattern in ('5x120.7','6x120.7') and quarantined_at is null group by 1,2 order by 5 desc`)).rows;
  console.log(`120.7 notation on ${nb.reduce((s, x) => s + x.n, 0)} live rows:`, nb.map(x => `${x.make} ${x.model} ${x.y1}-${x.y2} (${x.n})`).join("; "));
  const b = await c.query(`update vehicle_fitments v set bolt_pattern = replace(bolt_pattern, '120.7', '120.65'), last_modified_by=$1,
      last_modified_reason = coalesce(last_modified_reason || ' | ', '') || 'bolt notation 120.7 -> 120.65 (4.75in; 120.7 is not a real size - Scott 2026-09-16)', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where bolt_pattern in ('5x120.7','6x120.7') and quarantined_at is null`, [WHO]);
  console.log(`normalized: ${b.rowCount} rows`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
