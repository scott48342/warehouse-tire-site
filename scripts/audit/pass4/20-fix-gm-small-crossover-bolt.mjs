// GM small-crossover bolt fixes confirmed by Scott (shop experience) + WheelPros vehicle-facet agreement, 2026-09-16.
//   Chevrolet Trailblazer 2021-2026 -> 5x115 / 70.3 (was 5x105; 2026 row had 5x100)
//   GMC Terrain 2019-2026          -> 5x115 / 70.3 (was 5x112; 2018 row and Equinox sibling already 5x115)
//   Buick Encore GX 2020-2026      -> 5x115 / 70.3 (Trailblazer sibling; rows were a 5x115/5x120 mix)
//   Chevrolet Trax 2026            -> 5x115 / 70.3 (2024-25 rows already 5x115; 2026 row had 5x120)
//   node --env-file=.env.local scripts/audit/pass4/20-fix-gm-small-crossover-bolt.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass4-gm-crossover";
const RULES = [
  { make: "chevrolet", model: "trailblazer", y1: 2021, y2: 2026, why: "2021+ Trailblazer is 5x115 (Scott, shop; WheelPros vehicle facet 72% 5x115)" },
  { make: "gmc", model: "terrain", y1: 2019, y2: 2026, why: "2018+ Terrain is 5x115 (Scott, shop; WheelPros 72%; our 2018 row + Equinox sibling already 5x115)" },
  { make: "buick", model: "encore-gx", y1: 2020, y2: 2026, why: "Encore GX shares VSS-F platform with 2021+ Trailblazer = 5x115 (Scott confirmed Trailblazer)" },
  { make: "chevrolet", model: "trax", y1: 2026, y2: 2026, why: "2024+ Trax is 5x115 (our 2024-25 rows); 2026 row was an outlier 5x120" },
];
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  let total = 0;
  for (const r of RULES) {
    const res = await c.query(`update vehicle_fitments v set bolt_pattern = '5x115', center_bore_mm = 70.3, wheel_specs_source = 'scott+wheelpros-xref', wheel_specs_confidence = 'MEDIUM',
        wheel_specs_verified_at = now(), last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
      where make = $3 and model = $4 and year between $5 and $6 and quarantined_at is null and (bolt_pattern is distinct from '5x115' or center_bore_mm is distinct from 70.3)
      returning year, display_trim, (audit_original_data->>'bolt_pattern') was`, [WHO, r.why, r.make, r.model, r.y1, r.y2]);
    total += res.rowCount;
    console.log(`${r.make} ${r.model} ${r.y1}-${r.y2}: ${res.rowCount} rows -> 5x115/70.3  (were: ${[...new Set(res.rows.map(x => x.was))].join("/")})`);
  }
  console.log(`total ${total}`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
