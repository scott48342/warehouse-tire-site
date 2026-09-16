// WheelPros xref conflicts batch C — Scott confirmed WheelPros correct (2026-09-16 14:40).
//   node --env-file=.env.local scripts/audit/pass4/26-fix-wheelpros-conflicts-c.mjs [--apply]
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass4-wheelpros-xref";
const RULES = [
  // Silverado 2500/3500 (non-HD slug) 2007-2017 were ALL 5x120 (a 1500 pattern). GM HD rule: 1999-2010 8x165.1/116.7, 2011+ SRW 8x180/124.1.
  { make: "chevrolet", model: "silverado-2500", y1: 2007, y2: 2010, bolt: "8x165.1", cb: 116.7, why: "GM HD 2007-2010 = 8x165.1 (WheelPros 100% on 2009; Scott confirmed); rows carried 1500 pattern 5x120" },
  { make: "chevrolet", model: "silverado-2500", y1: 2011, y2: 2017, bolt: "8x180", cb: 124.1, why: "GM HD 2011+ SRW = 8x180; rows carried 1500 pattern 5x120 (DRW 8x210 not split here)" },
  { make: "chevrolet", model: "silverado-3500", y1: 2007, y2: 2010, bolt: "8x165.1", cb: 116.7, why: "GM HD 2007-2010 = 8x165.1 (WheelPros 100% on 2009; Scott confirmed); rows carried 1500 pattern 5x120" },
  { make: "chevrolet", model: "silverado-3500", y1: 2011, y2: 2017, bolt: "8x180", cb: 124.1, why: "GM HD 2011+ SRW = 8x180; rows carried 1500 pattern 5x120 (DRW 8x210 not split here)" },
  { make: "volkswagen", model: "touareg", y1: 2004, y2: 2006, bolt: "5x130", cb: 71.6, why: "Touareg is 5x130 (WheelPros 100%; Scott confirmed); 2007+ rows already 5x130" },
  { make: "isuzu", model: "axiom", y1: 2002, y2: 2004, bolt: "6x139.7", cb: 108, why: "Axiom (Rodeo platform) is 6x139.7 (WheelPros 78%; Scott confirmed)" },
  { make: "mitsubishi", model: "montero", y1: 2000, y2: 2000, bolt: "6x139.7", cb: 108, why: "Montero is 6x139.7 (WheelPros 100%; Scott confirmed); other years already correct" },
  { make: "ford", model: "mustang", y1: 1994, y2: 1999, bolt: "5x114.3", cb: 70.5, why: "SN95 Mustang (1994+) is 5x114.3 (WheelPros 88%; Scott confirmed); 4x108 was Fox body 1979-93" },
  { make: "chevrolet", model: "c1500", y1: 1988, y2: 1999, bolt: "5x127", cb: 78.1, why: "C1500 = 2WD = 5x127 (WheelPros 65%; Scott confirmed); K1500 rows keep 6x139.7" },
  { make: "chevrolet", model: "express-1500", y1: 1996, y2: 1999, bolt: "5x127", cb: 78.1, why: "1996-99 Express 1500 (2WD only) = 5x127 (WheelPros 78%; Scott confirmed)" },
  { make: "gmc", model: "savana-1500", y1: 2000, y2: 2000, bolt: "5x127", cb: 78.1, why: "2000 Savana 1500 2WD = 5x127 (WheelPros 76%; Scott confirmed)" },
];
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN");
  let total = 0;
  for (const r of RULES) {
    const res = await c.query(`update vehicle_fitments v set bolt_pattern = $5, center_bore_mm = $6, wheel_specs_source = 'wheelpros-xref', wheel_specs_confidence = 'MEDIUM',
        wheel_specs_verified_at = now(), last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
        audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
      where make = $3 and model = $4 and year between $7 and $8 and quarantined_at is null and (bolt_pattern is distinct from $5 or center_bore_mm is distinct from $6)
      returning (audit_original_data->>'bolt_pattern') was`, [WHO, r.why, r.make, r.model, r.bolt, r.cb, r.y1, r.y2]);
    total += res.rowCount;
    console.log(`${r.make} ${r.model} ${r.y1}-${r.y2} -> ${r.bolt}: ${res.rowCount} rows (was ${[...new Set(res.rows.map(x => x.was))].join("/")})`);
  }
  console.log(`total ${total}`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
