// (1) Rename GMC 'jimmy' (1983-99, S-series) -> slug 's15-jimmy', display "S15 Jimmy". (2) Reconcile 1986 S15 Jimmy to TG print (tire-guide-pdfs/scott-1986-gmc-s15-jimmy.pdf).
// (3) Create 'jimmy-full-size' ("Jimmy Full Size") 1986 from TG print (scott-1986-gmc-jimmy-full-size.pdf); offset/CB borrowed from 1986 Chevrolet K5 Blazer twin.
// (4) Dodge Dart 1964-72 center bore 71.37 (Scott). Naming per Scott 2026-09-16: "s15 jimmy and jimmy full size so customer can a specific distinction".
//   node --env-file=.env.local scripts/audit/pass4/31-jimmy-split-and-dart-bore.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "clawd", SRC = "tireguide-pro";
const W = (d, w, off) => ({ axle: "both", width: w, offset: off, isStock: true, diameter: d, tireSize: null });
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const q = async (s, a) => (await c.query(s, a)).rows;
try {
  await c.query("BEGIN");
  // 1. rename slug + display for all S-series Jimmy rows (incl. quarantined, so history stays coherent)
  const rn = await q(`update vehicle_fitments v set model='s15-jimmy', modification_id = replace(modification_id, '-gmc-jimmy-', '-gmc-s15-jimmy-'),
      last_modified_by=$1, last_modified_reason=coalesce(last_modified_reason || ' | ','') || 'model slug jimmy -> s15-jimmy (S-series; full-size Jimmy added separately) - Scott 2026-09-16', updated_at=now(),
      audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
    where make='gmc' and model='jimmy' returning year`, [WHO]);
  console.log(`renamed jimmy -> s15-jimmy: ${rn.length} rows (${Math.min(...rn.map(r => r.year))}-${Math.max(...rn.map(r => r.year))})`);
  // catalog_models drives the model picker: rename S-series entry, add full-size entry
  const cm = await q(`update catalog_models set slug='s15-jimmy', name='S15 Jimmy', updated_at=now() where make_slug='gmc' and slug='jimmy' returning years`, []);
  console.log(`catalog_models jimmy -> s15-jimmy: ${cm.length}`);
  await q(`insert into catalog_models (make_slug, slug, name, years) select 'gmc', 'jimmy-full-size', 'Jimmy Full Size', array[1986] where not exists (select 1 from catalog_models where make_slug='gmc' and slug='jimmy-full-size')`, []);
  // 2. 1986 S15 Jimmy per TG: Base/Gypsy/Sierra Classic 15x6-15x7 P195/75R15|P205/75R15; w/Z71 P235/75R15 15x6-15x7. Keep single row (options are appearance pkgs), stock 15x6 + 15x7, keep existing CB 70.3 / offset 15.
  const s15 = await q(`update vehicle_fitments v set oem_wheel_sizes=$2::jsonb, oem_tire_sizes='["195/75R15","205/75R15","235/75R15"]'::jsonb, bolt_pattern='5x120.65',
      wheel_specs_source=$3, wheel_specs_confidence='HIGH', wheel_specs_verified_at=now(), tire_sizes_source=$3, tire_sizes_confidence='HIGH', confidence_tag='HIGH',
      last_modified_by=$1, last_modified_reason='Tire Guide Pro print 2026-09-16 (scott-1986-gmc-s15-jimmy.pdf): Base/Gypsy/Sierra Classic 15x6-15x7 P195|P205/75R15; Z71 P235/75R15; 5-120.7mm (=5x120.65)', updated_at=now()
    where make='gmc' and model='s15-jimmy' and year=1986 and quarantined_at is null returning display_trim`, [WHO, JSON.stringify([W(15, 6, 15), W(15, 7, 15)]), SRC]);
  console.log(`1986 s15-jimmy reconciled: ${s15.length}`);
  // 3. 1986 Jimmy Full Size per TG. Offset/CB from 1986 Chevrolet Blazer (K5 twin): CB 78.1, offset -17.
  const K5 = (await q(`select center_bore_mm cb, offset_min_mm off from vehicle_fitments where make='chevrolet' and model='blazer' and year=1986 and quarantined_at is null limit 1`))[0];
  const trims = [
    { t: "Base", w: [W(15, 6, +K5.off), W(15, 7, +K5.off), W(15, 8, +K5.off)], s: ["215/75R15", "235/75R15", "31x10.50R15"] },
    { t: "Silverado", w: [W(15, 6, +K5.off), W(15, 8, +K5.off)], s: ["215/75R15", "235/75R15", "31x10.50R15"] },
  ];
  let ins = 0;
  for (const tr of trims) {
    const slug = tr.t.toLowerCase();
    ins += (await q(`insert into vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm,
        oem_wheel_sizes, oem_tire_sizes, tire_sizes_source, tire_sizes_confidence, wheel_specs_source, wheel_specs_confidence, wheel_specs_verified_at, source, quality_tier, is_locked, confidence_tag, last_modified_by, last_modified_reason)
      select 1986, 'gmc', 'jimmy-full-size', $1::text, $2::text, $2::text, $2::text, '6x139.7', $3::numeric, '1/2-20', 'conical', $4::numeric, $4::numeric, $5::jsonb, $6::jsonb, $7::text, 'HIGH', $7::text, 'HIGH', now(), $7::text, 'complete', true, 'HIGH', $8::text,
        'Tire Guide Pro print 2026-09-16 (scott-1986-gmc-jimmy-full-size.pdf): ' || $2::text || ' 6-139.7mm; CB/offset borrowed from 1986 Chevrolet K5 Blazer twin'
      where not exists (select 1 from vehicle_fitments where modification_id=$1::text) returning id`,
      [`1986-gmc-jimmy-full-size-${slug}`, tr.t, K5.cb, K5.off, JSON.stringify(tr.w), JSON.stringify(tr.s), SRC, WHO])).length;
  }
  console.log(`1986 jimmy-full-size inserted: ${ins} (CB ${K5.cb}, offset ${K5.off} from K5 Blazer)`);
  // 4. Dart bore
  const d = await q(`update vehicle_fitments set center_bore_mm=71.37, last_modified_reason=last_modified_reason || '; CB 71.37 (Scott 2026-09-16)', updated_at=now() where make='dodge' and model='dart' and year between 1964 and 1972 and quarantined_at is null returning year`);
  console.log(`dart 64-72 CB -> 71.37: ${d.length}`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
