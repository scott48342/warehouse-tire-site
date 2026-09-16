// (a) Ford E-150: 8x165.1 (Scott: "definitely") - check/fix all years where rows aren't 8x165.1 (E-150 was 5x139.7 pre-2008? dry-run shows what's there; only 2008+ forced).
// (b) Chevrolet Spark: 2011-2012 phantom (US launch MY2013) -> quarantine; 2013+ -> 4x100 / 56.6.
//   node --env-file=.env.local scripts/audit/pass4/24-fix-e150-spark.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass4-wheelpros-xref";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const show = async (mk, md) => (await c.query(`select year, bolt_pattern, count(*)::int n from vehicle_fitments where make=$1 and model=$2 and quarantined_at is null group by 1,2 order by 1`, [mk, md])).rows.map(x => `${x.year}:${x.bolt_pattern}x${x.n}`).join(" ");
try {
  await c.query("BEGIN");
  console.log("e-150 before:", await show("ford", "e-150"));
  const a = await c.query(`update vehicle_fitments v set bolt_pattern='8x165.1', center_bore_mm=121.3, wheel_specs_source='wheelpros-xref', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
      last_modified_by=$1, last_modified_reason='2008+ E-150 is 8x165.1 (WheelPros 100% 2011-14; Scott: definitely)', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='ford' and model='e-150' and year >= 2008 and quarantined_at is null and (bolt_pattern is distinct from '8x165.1')`, [WHO]);
  console.log(`e-150 2008+ -> 8x165.1: ${a.rowCount} rows`);
  console.log("spark before:", await show("chevrolet", "spark"));
  const q = await c.query(`update vehicle_fitments v set quarantined_at=now(), last_modified_by=$1, last_modified_reason='phantom model-year: Chevrolet Spark not sold in US until MY2013 (Scott 2026-09-16)', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='chevrolet' and model='spark' and year < 2013 and quarantined_at is null`, [WHO]);
  console.log(`spark <2013 quarantined: ${q.rowCount}`);
  const b = await c.query(`update vehicle_fitments v set bolt_pattern='4x100', center_bore_mm=56.6, wheel_specs_source='wheelpros-xref', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
      last_modified_by=$1, last_modified_reason='Spark is 4x100 (WheelPros 61%; Scott confirmed)', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='chevrolet' and model='spark' and year >= 2013 and quarantined_at is null and (bolt_pattern is distinct from '4x100')`, [WHO]);
  console.log(`spark 2013+ -> 4x100: ${b.rowCount} rows`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
