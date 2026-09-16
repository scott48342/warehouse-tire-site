// Stamp bolt-pattern provenance on rows whose Y/M/M bolt pattern WheelPros' vehicle facet AGREED with (Scott approved 2026-09-16 16:39).
// Only rows still unverified (wheel_specs_source null) and whose own bolt_pattern is one WP agreed on. Internal provenance only.
//   node --env-file=.env.local scripts/audit/pass4/32-stamp-wheelpros-agree.mjs [--apply]
import fs from "node:fs";
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const norm = s => String(s || "").toUpperCase().replace(/\s+/g, "").replace(/X/g, "x").replace(/(\d)\.0\b/g, "$1").replace(/120\.7\b/, "120.65");
const x = fs.readFileSync("scripts/audit/pass4/out/wheelpros-xref.jsonl", "utf8").split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)).filter(r => r.result === "agree");
// bolt(s) WP agreed with per Y/M/M: our bolts that appear in WP top-2 with >=30% share
const agreed = x.map(r => ({ year: r.year, make: r.make, model: r.model, bolts: r.ours.filter(o => r.wp.slice(0, 2).some(w => w.bolt === norm(o) && w.share >= 0.3)) })).filter(r => r.bolts.length);
console.log(`${agreed.length} agree Y/M/M`);
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  await c.query(`create temp table wp_agree (year int, make text, model text, bolt text)`);
  const vals = agreed.flatMap(r => r.bolts.map(b => [r.year, r.make, r.model, b]));
  for (let i = 0; i < vals.length; i += 500) {
    const chunk = vals.slice(i, i + 500);
    await c.query(`insert into wp_agree values ${chunk.map((_, j) => `($${j*4+1},$${j*4+2},$${j*4+3},$${j*4+4})`).join(",")}`, chunk.flat());
  }
  const res = await c.query(`update vehicle_fitments v set wheel_specs_source='xref:wheelpros', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
      last_modified_by='audit-pass4-wheelpros-xref', updated_at=now(),
      last_modified_reason=coalesce(last_modified_reason || ' | ','') || 'bolt pattern corroborated by WheelPros vehicle-fitment facet 2026-09-16 (two sources agree; no human review) - Scott approved stamp'
    from wp_agree a where v.year=a.year and v.make=a.make and v.model=a.model and v.bolt_pattern=a.bolt and v.quarantined_at is null and v.wheel_specs_source is null`);
  console.log(`stamped ${res.rowCount} rows -> xref:wheelpros MEDIUM`);
  const after = (await c.query(`select coalesce(wheel_specs_confidence,'unverified') c, count(*)::int n from vehicle_fitments where quarantined_at is null group by 1 order by 2 desc`)).rows;
  console.log("wheel specs after:", after.map(r => `${r.c}=${r.n}`).join(" "));
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
