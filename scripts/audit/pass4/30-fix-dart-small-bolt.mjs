// Dodge Dart 1964-1972 = 5x4in = 5x101.6 (Scott 2026-09-16). 1973-76 already 5x114.3 (batch D). 2013-16 Dart (PF) is 5x110 - correct, untouched.
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  const r = await c.query(`update vehicle_fitments v set bolt_pattern='5x101.6', center_bore_mm=null, wheel_specs_source='scott', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
      last_modified_by='audit-pass4-wheelpros-xref', last_modified_reason='1964-72 Dart small-bolt Mopar 5x4in = 5x101.6 (Scott 2026-09-16); 5x110 was wrong', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='dodge' and model='dart' and year between 1964 and 1972 and quarantined_at is null and bolt_pattern is distinct from '5x101.6' returning year`);
  console.log(`dart 1964-72 -> 5x101.6: ${r.rowCount} rows`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
