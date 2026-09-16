// Ford E-150 pre-2008 -> 5x139.7 (Scott: "prior year E-150s are actually 5x139.7"; 1980s rows already 5x139.7; 5x135 on 2000-07 was F-150 bleed-over)
//   node --env-file=.env.local scripts/audit/pass4/25-fix-e150-pre2008.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  const r = await c.query(`update vehicle_fitments v set bolt_pattern='5x139.7', center_bore_mm=87.1, wheel_specs_source='scott', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
      last_modified_by='audit-pass4-wheelpros-xref', last_modified_reason='pre-2008 E-150 is 5x139.7 (Scott 2026-09-16); 5x135 was F-150 bleed-over', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='ford' and model='e-150' and year < 2008 and quarantined_at is null and bolt_pattern is distinct from '5x139.7' returning year`);
  console.log(`e-150 <2008 -> 5x139.7: ${r.rowCount} rows (${[...new Set(r.rows.map(x => x.year))].sort().join(",")})`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
