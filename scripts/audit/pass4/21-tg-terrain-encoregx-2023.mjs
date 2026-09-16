// Reconcile 2023 GMC Terrain + 2023 Buick Encore GX to Scott's Tire Guide Pro prints (tire-guide-pdfs/scott-2023-gmc-terrain.pdf, scott-2023-buick-encore-gx.pdf)
// and quarantine phantom Chevrolet Trax 2013-2014 (Trax not sold in US until MY2015 - Scott).
//   node --env-file=.env.local scripts/audit/pass4/21-tg-terrain-encoregx-2023.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "clawd", SRC = "tireguide-pro";
const W = (d, w) => ({ axle: "both", width: w, offset: null, isStock: true, diameter: d, tireSize: null });
const SETS = [
  { make: "gmc", model: "terrain", bolt: "5x115", cb: 70.3, th: "M14x1.5", pdf: "scott-2023-gmc-terrain.pdf", trims: [
    { t: "AT4", w: [W(17, 7)], s: ["225/65R17"] }, { t: "Denali", w: [W(19, 7.5)], s: ["235/50R19"] }, { t: "SLE", w: [W(17, 7)], s: ["225/65R17"] },
    { t: "SLE Elevation Edition", w: [W(19, 7.5)], s: ["235/50R19"] }, { t: "SLT", w: [W(18, 7), W(19, 7.5)], s: ["225/60R18", "235/50R19"] }, { t: "SLT Elevation Edition", w: [W(19, 7.5)], s: ["235/50R19"] } ] },
  { make: "buick", model: "encore-gx", bolt: "5x115", cb: 70.3, th: "M12x1.5", pdf: "scott-2023-buick-encore-gx.pdf", trims: [
    { t: "Essence", w: [W(18, 7.5)], s: ["225/55R18"] }, { t: "Preferred", w: [W(18, 7.5)], s: ["225/55R18"] }, { t: "Select", w: [W(18, 7.5)], s: ["225/55R18"] }, { t: "ST", w: [W(18, 7.5)], s: ["225/55R18"] } ] },
];
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const q = async (s, a) => (await c.query(s, a)).rows;
try {
  await c.query("BEGIN");
  for (const S of SETS) {
    const old = await q(`update vehicle_fitments v set quarantined_at = now(), last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
      where make = $3 and model = $4 and year = 2023 and quarantined_at is null returning display_trim`, [WHO, `replaced by Tire Guide Pro 2023 trim rows (${S.pdf}); old row carried sizes from other trims`, S.make, S.model]);
    let ins = 0;
    for (const tr of S.trims) {
      const slug = tr.t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const r = await q(`insert into vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, thread_size, seat_type,
          oem_wheel_sizes, oem_tire_sizes, tire_sizes_source, tire_sizes_confidence, wheel_specs_source, wheel_specs_confidence, wheel_specs_verified_at, source, quality_tier, is_locked, confidence_tag, last_modified_by, last_modified_reason)
        select 2023, $1::text, $2::text, $3::text, $4::text, $4::text, $4::text, $5::text, $6::numeric, $7::text, 'conical', $8::jsonb, $9::jsonb, $10::text, 'HIGH', $10::text, 'HIGH', now(), $10::text, 'complete', true, 'HIGH', $11::text, $12::text
        where not exists (select 1 from vehicle_fitments where modification_id = $3::text) returning id`,
        [S.make, S.model, `2023-${S.make}-${S.model}-${slug}`, tr.t, S.bolt, S.cb, S.th, JSON.stringify(tr.w), JSON.stringify(tr.s), SRC, WHO, `Tire Guide Pro print 2026-09-16 (${S.pdf}): ${tr.t} = ${tr.w.map(x => x.diameter + "x" + x.width).join("/")} ${tr.s.join("/")} ${S.bolt}`]);
      ins += r.length;
    }
    console.log(`2023 ${S.make} ${S.model}: quarantined ${old.length} (${old.map(o => o.display_trim).join(", ")}), inserted ${ins} TG trim rows`);
  }
  const tx = await q(`update vehicle_fitments v set quarantined_at = now(), last_modified_by = $1, last_modified_reason = 'phantom model-year: Chevrolet Trax not sold in US until MY2015 (Scott, 2026-09-16)', updated_at = now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make = 'chevrolet' and model = 'trax' and year in (2013, 2014) and quarantined_at is null returning year`, [WHO]);
  console.log(`trax 2013-14 quarantined: ${tx.length}`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
