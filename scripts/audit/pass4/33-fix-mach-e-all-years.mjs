// Ford Mustang Mach-E 2021-2026 from Scott's Tire Guide Pro prints (F:\clawd\tire-guide-pdfs\20XX ford mach e.pdf, 2026-09-17).
// Scott: all years 5x108 / CB 63.4 / offset +53 / M14x1.5 / 150 ft-lb / 39 psi; "2024 to current is all the same" => 2025, 2026 mirror the 2024 print.
// Quarantines every other live Mach-E row (manual_* 'Base' 5x114.3 rows, 2023 'Extended Range'), fixes 2024 TG rows' offset 45 -> 53.
//   node --env-file=.env.local scripts/audit/pass4/33-fix-mach-e-all-years.mjs [--apply]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-tg-reconcile", SRC = "tireguide-pro";
const PDFDIR = "F:/clawd/tire-guide-pdfs", PARSER = "scripts/audit/pass3/tireguide/tg-parse.py";
const OFFSET = 53, CB = 63.4, BOLT = "5x108", THREAD = "M14x1.5";
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const parse = y => JSON.parse(execFileSync("python", [PARSER, `${PDFDIR}/${y} ford mach e.pdf`], { encoding: "utf8" }));
const prints = { 2021: parse(2021), 2022: parse(2022), 2023: parse(2023), 2024: parse(2024) };
const plan = {};
for (const y of [2021, 2022, 2023, 2024, 2025, 2026]) {
  const src = prints[Math.min(y, 2024)];
  plan[y] = src.options.map(o => {
    const s = o.sizes[0];                       // rank-1 = base fitment; all sizes on these prints share rim/tire per option
    const [d, w] = s.rim_size.split("x").map(Number);
    return { trim: o.option, rim: s.rim_size, d, w, tire: s.tire_size, psiF: s.inflation_front, psiR: s.inflation_rear, torque: s.torque_ftlb, li: s.load_index, bolt: s.bolt_circle };
  });
}
for (const [y, rows] of Object.entries(plan)) console.log(`${y}${y >= 2025 ? " (mirror 2024)" : ""}: ` + rows.map(r => `${r.trim} ${r.rim} ${r.tire}`).join(" | "));
if (Object.values(plan).flat().some(r => r.bolt !== BOLT)) throw new Error("print bolt != 5x108");
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  let ins = 0, upd = 0;
  for (const [ys, rows] of Object.entries(plan)) {
    const y = +ys, ids = rows.map(r => `${y}-ford-mustang-mach-e-${slug(r.trim)}`);
    const q = await c.query(`update vehicle_fitments v set quarantined_at=now(), last_modified_by=$1, updated_at=now(),
        last_modified_reason='replaced by Tire Guide Pro print ${y} ford mach e.pdf (Scott 2026-09-17${y >= 2025 ? ", 2024 print applies 2024-current per Scott" : ""})',
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
      where make='ford' and model='mustang-mach-e' and year=$2 and quarantined_at is null and modification_id <> all($3::text[])`, [WHO, y, ids]);
    for (const r of rows) {
      const id = `${y}-ford-mustang-mach-e-${slug(r.trim)}`;
      const wheels = JSON.stringify([{ axle: "both", width: r.w, offset: OFFSET, isStock: true, diameter: r.d, tireSize: r.tire }]);
      const reason = `Tire Guide Pro print ${Math.min(y, 2024)} ford mach e.pdf (Scott 2026-09-17): ${r.trim} ${r.rim} ${r.tire} ${r.bolt}; offset +${OFFSET}, CB ${CB}, ${THREAD}, ${r.torque} ft-lb, ${r.psiF}/${r.psiR} psi, LI ${r.li}`;
      const old = await c.query(`update vehicle_fitments v set quarantined_at=now(), last_modified_by=$1, updated_at=now(),
          last_modified_reason='superseded by re-reconcile 2026-09-17 from Scott print (offset 45->53)', modification_id = modification_id || '~q-tg-2026-09-17',
          audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
        where modification_id=$2`, [WHO, id]);
      upd += old.rowCount;
      const res = await c.query(`insert into vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, thread_size, seat_type,
          offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, tire_sizes_source, tire_sizes_confidence, wheel_specs_source, wheel_specs_confidence, wheel_specs_verified_at,
          source, quality_tier, is_locked, confidence_tag, last_modified_by, last_modified_reason)
        values ($1,'ford','mustang-mach-e',$2,$3,$3,$3,$4,$5,$6,'conical',$7,$7,$8::jsonb,$9::jsonb,$10,'HIGH',$10,'HIGH',now(),$10,'complete',true,'HIGH',$11,$12)
        returning id`,
        [y, id, r.trim, BOLT, CB, THREAD, OFFSET, wheels, JSON.stringify([r.tire]), SRC, WHO, reason]);
      ins += res.rowCount;
    }
    console.log(`${y}: quarantined ${q.rowCount}, trims ${rows.length}`);
  }
  await c.query(`update catalog_models set years = (select array_agg(distinct y order by y desc) from unnest(years || array[2021,2022,2023,2024,2025,2026]) y), updated_at=now() where make_slug='ford' and slug='mustang-mach-e'`);
  console.log(`inserted ${ins}, superseded old ids ${upd}`);
  const live = (await c.query(`select year, count(*)::int n, min(bolt_pattern) b, min(offset_min_mm) o from vehicle_fitments where make='ford' and model='mustang-mach-e' and quarantined_at is null group by 1 order by 1`)).rows;
  console.log("live after:", live.map(r => `${r.year}:${r.n} ${r.b} +${r.o}`).join("  "));
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
