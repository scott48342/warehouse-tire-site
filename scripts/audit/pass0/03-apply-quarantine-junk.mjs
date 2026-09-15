// Pass 0 apply step 2+3: quarantine 670 junk trim rows (deprecated-staggered-split + tgp "X Front X") and 40 "[object Object]" wheel rows.
//   node --env-file=.env.local scripts/audit/pass0/03-apply-quarantine-junk.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const WHO = "clawd", WHY = "audit-2026-09 pass0: ";
const STAMP = `last_modified_by = $1, last_modified_reason = $2, updated_at = now(), audit_original_data = COALESCE(audit_original_data, to_jsonb(vehicle_fitments) - 'audit_original_data')`;
try {
  await c.query("BEGIN");
  const a = await c.query(`UPDATE vehicle_fitments SET quarantined_at = now(), ${STAMP} WHERE quarantined_at IS NULL AND id IN (SELECT fitment_id FROM audit_pass0_flags WHERE check_name='junk_trim_name' AND severity='error') RETURNING id, year, make, model, display_trim`, [WHO, WHY + "junk staggered-split trim rows (X Front X / X Rear X)"]);
  const b = await c.query(`UPDATE vehicle_fitments SET quarantined_at = now(), ${STAMP} WHERE quarantined_at IS NULL AND id IN (SELECT fitment_id FROM audit_pass0_flags WHERE check_name='wheel_object_stringified') RETURNING id, year, make, model, display_trim`, [WHO, WHY + "oem_wheel_sizes is literal '[object Object]' (unrecoverable; re-research in pass3)"]);
  console.log(`junk trims quarantined: ${a.rowCount}`); console.log(`[object Object] rows quarantined: ${b.rowCount}`);
  console.log("sample:", a.rows.slice(0, 5).map(r => `${r.year} ${r.make} ${r.model} "${r.display_trim}"`).join(" | "));
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("dry run — rolled back; add --apply"); }
} catch (e) { await c.query("ROLLBACK"); console.error("FAILED", e.message); process.exitCode = 1; } finally { c.release(); await p.end(); }
