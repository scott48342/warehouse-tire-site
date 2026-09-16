// Chevrolet Express / GMC Savana � Scott 2026-09-16: 1500 = 6x139.7 (all years), 2500/3500 = 8x165.1 (all years).
// Reverts batch C's 5x127 on Express 1500 1996-99 + Savana 1500 2000 (WheelPros said 5x127; Scott overrides).
//   node --env-file=.env.local scripts/audit/pass4/27-fix-express-savana.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const RULES = [
  { models: ["express-1500", "savana-1500"], bolt: "6x139.7", cb: 78.1, why: "Express/Savana 1500 = 6x139.7 all years (Scott 2026-09-16, overrides WheelPros 5x127 on 1996-2000)" },
  { models: ["express-2500", "express-3500", "savana-2500", "savana-3500", "express", "savana"], bolt: "8x165.1", cb: 116.7, why: "Express/Savana 2500/3500 = 8x165.1 all years (Scott 2026-09-16)" },
];
try {
  await c.query("BEGIN");
  const before = (await c.query(`select make, model, bolt_pattern, min(year) y1, max(year) y2, count(*)::int n from vehicle_fitments where (model like 'express%' or model like 'savana%') and quarantined_at is null group by 1,2,3 order by 1,2,3`)).rows;
  console.log("before:", before.map(x => `${x.make} ${x.model} ${x.bolt_pattern} ${x.y1}-${x.y2} (${x.n})`).join("; "));
  for (const r of RULES) {
    const res = await c.query(`update vehicle_fitments v set bolt_pattern=$1, center_bore_mm=$2, wheel_specs_source='scott', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
        last_modified_by='audit-pass4-wheelpros-xref', last_modified_reason=$3, updated_at=now(),
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
      where model = any($4::text[]) and make in ('chevrolet','gmc') and quarantined_at is null and bolt_pattern is distinct from $1`, [r.bolt, r.cb, r.why, r.models]);
    console.log(`${r.models.join("/")} -> ${r.bolt}: ${res.rowCount} rows`);
  }
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
