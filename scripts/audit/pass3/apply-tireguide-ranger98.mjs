// Correct 1998 Ford Ranger rows against Tire Guide Pro (Scott's print, 2026-09-15) — first Tire-Guide-sourced fix.
//   node --env-file=.env.local scripts/audit/pass3/apply-tireguide-ranger98.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const WHO = "clawd", SRC = "tire-guide-pro", WHY = "audit-2026-09 pass3: Tire Guide Pro print (1998 Ford Trucks Ranger) via Tire Power front counter";
const STAMP = `last_modified_by=$1, last_modified_reason=$2, source=$3, certification_status='certified', certified_at=now(), certified_by_script_version='audit-2026-09', confidence_tag='HIGH', quality_tier='complete', updated_at=now(), audit_original_data=COALESCE(audit_original_data, to_jsonb(vehicle_fitments)-'audit_original_data')`;
const W = (arr) => JSON.stringify(arr.map(([d, w, t]) => ({ axle: "both", diameter: d, width: w, offset: null, isStock: true, tireSize: t })));
try {
  await c.query("BEGIN");
  // 2WD (XL/XLT/EV 4x2): 14x5.5 P205/75R14 | P215/75R14 ; 70-Series option 14x6 P225/70R14. No 15" on 2WD.
  let r = await c.query(`UPDATE vehicle_fitments SET oem_wheel_sizes=$4::jsonb, oem_tire_sizes=$5::jsonb, ${STAMP}
    WHERE make='ford' AND model='ranger' AND year=1998 AND display_trim='2WD' AND quarantined_at IS NULL RETURNING id`,
    [WHO, WHY, SRC, W([[14, 5.5, "P205/75R14"], [14, 5.5, "P215/75R14"], [14, 6, "P225/70R14"]]), JSON.stringify(["P205/75R14", "P215/75R14", "P225/70R14"])]);
  console.log("2WD updated:", r.rowCount);
  // 4WD (XL/XLT 4x4): 15x6 P215/75R15
  r = await c.query(`UPDATE vehicle_fitments SET oem_wheel_sizes=$4::jsonb, oem_tire_sizes=$5::jsonb, ${STAMP}
    WHERE make='ford' AND model='ranger' AND year=1998 AND display_trim='4WD' AND quarantined_at IS NULL RETURNING id`,
    [WHO, WHY, SRC, W([[15, 6, "P215/75R15"]]), JSON.stringify(["P215/75R15"])]);
  console.log("4WD updated:", r.rowCount);
  // Splash 2WD: 15x7 P235/60R15 (already right) — certify
  r = await c.query(`UPDATE vehicle_fitments SET oem_wheel_sizes=$4::jsonb, oem_tire_sizes=$5::jsonb, ${STAMP}
    WHERE make='ford' AND model='ranger' AND year=1998 AND display_trim='Splash 2WD' AND quarantined_at IS NULL RETURNING id`,
    [WHO, WHY, SRC, W([[15, 7, "P235/60R15"]]), JSON.stringify(["P235/60R15"])]);
  console.log("Splash 2WD certified:", r.rowCount);
  // Splash 4WD: missing → insert (clone Splash 2WD row's constants)
  r = await c.query(`INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier, certification_status, certified_at, certified_by_script_version, confidence_tag, is_locked, last_modified_by, last_modified_reason)
    SELECT 1998, 'ford', 'ranger', '1998-ford-ranger-splash-4wd', 'splash-4wd', 'Splash 4WD', 'Splash 4WD', bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, $4::jsonb, $5::jsonb, $3, 'complete', 'certified', now(), 'audit-2026-09', 'HIGH', true, $1, $2
    FROM vehicle_fitments WHERE make='ford' AND model='ranger' AND year=1998 AND display_trim='Splash 2WD' AND quarantined_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM vehicle_fitments x WHERE x.make='ford' AND x.model='ranger' AND x.year=1998 AND x.display_trim='Splash 4WD') RETURNING id`,
    [WHO, WHY, SRC, W([[15, 7, "P235/75R15"]]), JSON.stringify(["P235/75R15"])]);
  console.log("Splash 4WD inserted:", r.rowCount);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("dry run — rolled back"); }
} catch (e) { await c.query("ROLLBACK"); console.error("FAILED", e.message); process.exitCode = 1; } finally { c.release(); await p.end(); }
