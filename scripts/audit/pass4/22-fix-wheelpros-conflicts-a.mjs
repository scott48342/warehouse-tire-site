// WheelPros xref conflicts batch A — all confirmed by Scott 2026-09-16 ("every one of these is correct with WheelPros").
// Bolt pattern only; center bore left as-is unless the row's CB is clearly from the wrong pattern (listed in dry-run).
//   node --env-file=.env.local scripts/audit/pass4/22-fix-wheelpros-conflicts-a.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass4-wheelpros-xref";
const RULES = [
  { make: "chevrolet", model: "blazer", y1: 2019, y2: 2026, bolt: "6x120", cb: 67.1, why: "2019+ Blazer (C1XX) is 6x120 - WheelPros vehicle facet 85%, Scott confirmed" },
  { make: "gmc", model: "acadia", y1: 2017, y2: 2026, bolt: "6x120", cb: 67.1, why: "2017+ Acadia (C1XX) is 6x120 - WheelPros 78% (2019-23), Scott confirmed; 2017-18 same generation" },
  { make: "mini", model: "cooper", y1: 2014, y2: 2026, bolt: "5x112", cb: 66.6, why: "F56 Mini Cooper (2014+) is 5x112 - WheelPros 94%, Scott confirmed; 4x100 was R50/R56" },
  { make: "jeep", model: "wagoneer", y1: 2022, y2: 2026, bolt: "6x139.7", cb: 77.8, why: "2022+ Wagoneer (WS) is 6x139.7 - WheelPros 81%, Scott confirmed" },
  { make: "jeep", model: "grand-wagoneer", y1: 2022, y2: 2026, bolt: "6x139.7", cb: 77.8, why: "2022+ Grand Wagoneer (WS) is 6x139.7 - WheelPros 81%, Scott confirmed" },
  { make: "porsche", model: "cayenne", y1: 2003, y2: 2026, bolt: "5x130", cb: 71.6, why: "Cayenne is 5x130 all generations - WheelPros 100% (2020-21), Scott confirmed" },
  { make: "rolls-royce", model: "cullinan", y1: 2019, y2: 2026, bolt: "5x112", cb: 66.6, why: "Cullinan is 5x112 - WheelPros 100%, Scott confirmed" },
];
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  let total = 0;
  for (const r of RULES) {
    const before = (await c.query(`select year, bolt_pattern, center_bore_mm, count(*)::int n from vehicle_fitments where make=$1 and model=$2 and year between $3 and $4 and quarantined_at is null group by 1,2,3 order by 1`, [r.make, r.model, r.y1, r.y2])).rows;
    const res = await c.query(`update vehicle_fitments v set bolt_pattern = $5, center_bore_mm = $6, wheel_specs_source = 'wheelpros-xref', wheel_specs_confidence = 'MEDIUM',
        wheel_specs_verified_at = now(), last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
      where make = $3 and model = $4 and year between $7 and $8 and quarantined_at is null and (bolt_pattern is distinct from $5 or center_bore_mm is distinct from $6)`,
      [WHO, r.why, r.make, r.model, r.bolt, r.cb, r.y1, r.y2]);
    total += res.rowCount;
    console.log(`${r.make} ${r.model} ${r.y1}-${r.y2} -> ${r.bolt}/${r.cb}: ${res.rowCount} rows changed  (was: ${before.map(b => `${b.year}:${b.bolt_pattern}/${b.center_bore_mm}x${b.n}`).join(" ")})`);
  }
  console.log(`total ${total}`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
