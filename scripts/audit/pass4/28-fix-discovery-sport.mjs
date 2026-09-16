// Discovery Sport = 5x108 (Scott 2026-09-16). Quarantine the duplicate 5x120 rows; stamp 5x108 rows. Discovery 94-98 stays 5x165.1 (Scott confirmed).
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  // years where both a 5x108 and a 5x120 row exist -> quarantine the 5x120 dup; years with only a 5x120 row -> fix in place
  const dup = await c.query(`update vehicle_fitments v set quarantined_at=now(), last_modified_by='audit-pass4-wheelpros-xref', updated_at=now(),
      last_modified_reason='duplicate Discovery Sport row with wrong bolt 5x120; Discovery Sport is 5x108 (Scott 2026-09-16)',
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='land rover' and model='discovery-sport' and bolt_pattern='5x120' and quarantined_at is null
      and exists (select 1 from vehicle_fitments o where o.make=v.make and o.model=v.model and o.year=v.year and o.bolt_pattern='5x108' and o.quarantined_at is null) returning year`);
  console.log(`quarantined 5x120 dups: ${dup.rowCount} (${dup.rows.map(r => r.year).sort().join(",")})`);
  const fix = await c.query(`update vehicle_fitments v set bolt_pattern='5x108', center_bore_mm=63.4, wheel_specs_source='scott', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
      last_modified_by='audit-pass4-wheelpros-xref', last_modified_reason='Discovery Sport is 5x108 (Scott 2026-09-16)', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='land rover' and model='discovery-sport' and bolt_pattern is distinct from '5x108' and quarantined_at is null returning year`);
  console.log(`fixed remaining -> 5x108: ${fix.rowCount} (${fix.rows.map(r => r.year).sort().join(",")})`);
  const stamp = await c.query(`update vehicle_fitments set wheel_specs_source='scott', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now()
    where make='land rover' and model in ('discovery-sport','discovery') and bolt_pattern in ('5x108','5x165.1') and quarantined_at is null and wheel_specs_source is null`);
  console.log(`stamped Scott-confirmed rows (Sport 5x108 + Discovery I 5x165.1): ${stamp.rowCount}`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
