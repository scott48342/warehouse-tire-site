// Ford Maverick — reconcile to Tire Guide Pro prints supplied by Scott 2026-09-16 (tire-guide-pdfs/scott-2024-ford-maverick.pdf + the 2025 print).
// TG 2024: Lariat 225/60R18 18x7 | 225/65R17 17x7 | 235/65R17 17x7; XL 225/65R17 17x7; XLT 225/60R18 18x7 | 225/65R17 17x7 | 235/65R17 17x7. 5-108, torque 148.
// TG 2025: Lariat 19x7.5 225/55R19; Lobo 19x7.5 225/55R19; Tremor 17x7 235/65R17; XL 17x7 225/65R17; XLT 17x7 225/65R17; XLT w/Black Appearance 19x7.5 225/55R19.
//   node --env-file=.env.local scripts/apply-maverick-tireguide.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "clawd";
const SRC = "tireguide-pro";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const q = async (s, a = []) => (await c.query(s, a)).rows;
const STAMP = `last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
  audit_original_data = COALESCE(vehicle_fitments.audit_original_data, to_jsonb(vehicle_fitments) - 'audit_original_data')`;
const log = [];
try {
  await c.query("BEGIN");
  // 1. add 2025 + 2026 "XLT Black Appearance" (19x7.5, 225/55R19) — TG 2025 lists it as its own option
  let ins = 0;
  for (const y of [2025, 2026]) {
    const r = await q(`INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm,
        thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, tire_sizes_source, tire_sizes_confidence,
        wheel_specs_source, wheel_specs_confidence, wheel_specs_verified_at, source, quality_tier, is_locked, confidence_tag, last_modified_by, last_modified_reason)
      SELECT $1::int, 'ford', 'maverick', $2::text, 'XLT Black Appearance', 'XLT Black Appearance', 'XLT Black Appearance', '5x108', 63.4, 'M14x1.5', 'conical', 37.5, 37.5,
        '[{"axle":"both","width":7.5,"offset":37.5,"isStock":true,"diameter":19,"tireSize":null}]'::jsonb, '["225/55R19"]'::jsonb, $3, 'HIGH', $3, 'HIGH', now(), $3, 'complete', true, 'HIGH', $4, $5
      WHERE NOT EXISTS (SELECT 1 FROM vehicle_fitments WHERE modification_id = $2::text) RETURNING id`,
      [y, `${y}-ford-maverick-xlt-black-appearance`, SRC, WHO, `Tire Guide Pro ${y === 2025 ? "2025" : "2025 (carried to 2026)"} print: XLT w/Black Appearance Pkg = 19x7.5 225/55R19`]);
    ins += r.length;
  }
  log.push(`inserted ${ins} XLT Black Appearance rows (2025, 2026)`);
  // 2. upgrade 2024 + 2025 live Maverick rows to Tire Guide provenance (sizes/bolt confirmed by the prints; 2022-23 and 2026 stay MEDIUM until printed)
  const up = await q(`UPDATE vehicle_fitments SET wheel_specs_source = $3, wheel_specs_confidence = 'HIGH', wheel_specs_verified_at = now(),
      tire_sizes_confidence = 'HIGH', confidence_tag = 'HIGH', ${STAMP}
    WHERE make='ford' AND model='maverick' AND year IN (2024, 2025) AND quarantined_at IS NULL AND wheel_specs_source IS DISTINCT FROM $3 RETURNING year, display_trim`,
    [WHO, "Tire Guide Pro print 2026-09-16 confirms wheel size, tire size, 5x108 for this year (trim option labels are ours; sizes match TG options)", SRC]);
  log.push(`upgraded ${up.length} rows to ${SRC}/HIGH: ${up.map(r => r.year + " " + r.display_trim).join(", ")}`);
  const chk = await q(`SELECT year, display_trim, wheel_specs_source src, wheel_specs_confidence conf, oem_wheel_sizes, oem_tire_sizes FROM vehicle_fitments
    WHERE make='ford' AND model='maverick' AND year >= 2022 AND quarantined_at IS NULL ORDER BY year, display_trim`);
  for (const x of chk) log.push(`  ${x.year} ${x.display_trim.padEnd(26)} ${String(x.src).padEnd(28)} ${String(x.conf).padEnd(6)} ${x.oem_wheel_sizes.map(w => w.diameter + "x" + w.width).join("/")} ${x.oem_tire_sizes.join("/")}`);
  console.log(log.join("\n"));
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN - rolled back"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }

