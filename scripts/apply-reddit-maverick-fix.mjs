// Ford Maverick 2022-2026 fitment fix — r/tires correction by sniper_matt (2026-09-16), cross-checked against the USAF tire-size list
// (2022-24: 225/65R17, 235/65R17, 225/60R18; 2025+: 225/65R17, 235/65R17, 225/55R19 — no 18" size).
//   node --env-file=.env.local scripts/apply-reddit-maverick-fix.mjs           # dry run
//   node --env-file=.env.local scripts/apply-reddit-maverick-fix.mjs --apply
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "clawd";
const WHY = "r/tires Maverick correction 2026-09-16 (sniper_matt; reddit.com/r/tires/comments/1wgf0mq) cross-checked vs USAF OE tire sizes";
const SRC = "reddit-correction-2026-09-16";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const q = async (s, a = []) => (await c.query(s, a)).rows;
const STAMP = `last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
  audit_original_data = COALESCE(vehicle_fitments.audit_original_data, to_jsonb(vehicle_fitments) - 'audit_original_data')`;
const W = (d, w, off = 37.5, stock = true) => ({ axle: "both", width: w, offset: off, isStock: stock, diameter: d, tireSize: null });
const COMMON = { bolt: "5x108", cb: 63.4, th: "M14x1.5", seat: "conical" };
// display_trim -> { wheels, tires }
const GEN1 = [ // 2022-2024
  { trim: "XL / XLT", wheels: [W(17, 7)], tires: ["225/65R17"], note: "17x7 (XL steel / XLT alloy)" },
  { trim: "XLT Black Appearance", wheels: [W(18, 7)], tires: ["225/60R18"], note: "18in black appearance pkg" },
  { trim: "XLT / Lariat FX4, Tremor", wheels: [W(17, 7)], tires: ["235/65R17"], note: "FX4 and Tremor packages" },
  { trim: "Lariat", wheels: [W(18, 7)], tires: ["225/60R18"], note: "Lariat 18s" },
];
const GEN2 = [ // 2025-2026 refresh
  { trim: "XL / XLT", wheels: [W(17, 7)], tires: ["225/65R17"], note: "17x7" },
  { trim: "XLT / Lariat FX4, Tremor", wheels: [W(17, 7)], tires: ["235/65R17"], note: "FX4 and Tremor packages" },
  { trim: "Lariat / Lobo", wheels: [W(19, 7.5)], tires: ["225/55R19"], note: "19x7.5 on Lariat and Lobo" },
];
const log = [];
try {
  await c.query("BEGIN");
  // 1. quarantine the existing single-trim rows (2022 '2.0 EcoBoost', 2025/2026 'Base') — replaced by trim rows below
  let r = await q(`UPDATE vehicle_fitments SET quarantined_at = now(), ${STAMP}
    WHERE make = 'ford' AND model = 'maverick' AND year BETWEEN 2021 AND 2026 AND quarantined_at IS NULL RETURNING id, year, display_trim`,
    [WHO, WHY + " - single catch-all row replaced by trim rows (2022 listed a 19x7.5 that no 2022-24 had; 2025 had M12 thread, +52 offset, 17x7.5/18x7.5 wheels - all wrong; 2021 is a phantom year, Maverick launched as MY2022)"]);
  log.push(`quarantined ${r.length} catch-all rows: ${r.map(x => x.year + " " + x.display_trim).join(", ")}`);
  // 2. insert trim rows
  let ins = 0;
  for (const [years, set] of [[[2022, 2023, 2024], GEN1], [[2025, 2026], GEN2]]) {
    for (const y of years) for (const t of set) {
      const slug = t.trim.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const rr = await q(`INSERT INTO vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm,
          thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, tire_sizes_source, tire_sizes_confidence,
          wheel_specs_source, wheel_specs_confidence, wheel_specs_verified_at, source, quality_tier, is_locked, confidence_tag, last_modified_by, last_modified_reason)
        VALUES ($1, 'ford', 'maverick', $2, $3, $3, $3, $4, $5, $6, $7, 37.5, 37.5, $8::jsonb, $9::jsonb, 'usaf+reddit', 'MEDIUM', $10, 'MEDIUM', now(), $10, 'complete', true, 'MEDIUM', $11, $12)
        RETURNING id`,
        [y, `${y}-ford-maverick-${slug}`, t.trim, COMMON.bolt, COMMON.cb, COMMON.th, COMMON.seat, JSON.stringify(t.wheels), JSON.stringify(t.tires), SRC, WHO, `${WHY} - ${t.note}`]);
      ins += rr.length;
    }
  }
  log.push(`inserted ${ins} trim rows (2022-24: 4 trims x 3 yrs; 2025-26: 3 trims x 2 yrs)`);
  const chk = await q(`SELECT year, display_trim, thread_size, offset_min_mm, oem_wheel_sizes, oem_tire_sizes FROM vehicle_fitments
    WHERE make='ford' AND model='maverick' AND quarantined_at IS NULL ORDER BY year, display_trim`);
  for (const x of chk) log.push(`  ${x.year} ${x.display_trim.padEnd(26)} ${x.thread_size} +${x.offset_min_mm} ${x.oem_wheel_sizes.map(w => w.diameter + "x" + w.width).join("/")} ${x.oem_tire_sizes.join("/")}`);
  console.log(log.join("\n"));
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN - rolled back"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
