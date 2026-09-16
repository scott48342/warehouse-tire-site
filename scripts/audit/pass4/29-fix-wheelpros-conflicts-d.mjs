// WheelPros xref conflicts batch D (pre-1990) — Scott 2026-09-16 15:15: "everything else wheel pros is right on". Jimmy left as-is (our rows = S-15, 5x120.65 correct).
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass4-wheelpros-xref";
const R = [
  ["chevrolet","caprice",1968,1990,"5x120.65",70.3,"GM B-body 5x4.75 (WheelPros 92%)"],
  ["chevrolet","impala",1968,1985,"5x120.65",70.3,"GM B-body 5x4.75 (WheelPros 92%); 5x120 was notation error"],
  ["buick","lesabre",1980,1985,"5x120.65",70.3,"GM B-body 5x4.75 (WheelPros 92%)"],
  ["cadillac","seville",1985,1985,"5x120.65",70.3,"WheelPros 92%"],
  ["cadillac","eldorado",1980,1983,"5x120.65",70.3,"WheelPros 96%"],
  ["cadillac","deville",1980,1984,"5x127",78.1,"RWD C-body DeVille 5x5 (WheelPros 68%); 1985+ FWD 5x115 rows unchanged"],
  ["dodge","caravan",1986,1989,"5x100",57.1,"gen1 minivan K-car pattern (WheelPros 81%)"],
  ["dodge","dakota",1987,1989,"5x114.3",71.5,"gen1 Dakota 5x4.5 (WheelPros 86%)"],
  ["ford","bronco-ii",1984,1989,"5x114.3",70.5,"Ranger-based 5x4.5 (WheelPros 81%)"],
  ["mazda","626",1988,1989,"5x114.3",67.1,"GD 626 (WheelPros 82%)"],
  ["dodge","dart",1973,1976,"5x114.3",71.5,"1973-76 Dart 5x4.5 (WheelPros 93%); 5x110 is not a classic Mopar pattern"],
  ["mazda","b2000",1980,1986,"6x139.7",108,"WheelPros 81%; Scott confirmed"],
  ["mazda","b2200",1987,1989,"6x139.7",108,"WheelPros 84%; Scott confirmed"],
  ["chevrolet","c20",1975,1976,"5x127",78.1,"WheelPros 69%; Scott confirmed (only flagged years touched)"],
];
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
try {
  await c.query("BEGIN"); let t = 0;
  for (const [mk, md, y1, y2, bolt, cb, why] of R) {
    const res = await c.query(`update vehicle_fitments v set bolt_pattern=$1, center_bore_mm=$2, wheel_specs_source='wheelpros-xref', wheel_specs_confidence='MEDIUM', wheel_specs_verified_at=now(),
        last_modified_by=$3, last_modified_reason=$4, updated_at=now(), audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')
      where make=$5 and model=$6 and year between $7 and $8 and quarantined_at is null and bolt_pattern is distinct from $1 returning (audit_original_data->>'bolt_pattern') was`,
      [bolt, cb, WHO, `${why} - Scott confirmed 2026-09-16`, mk, md, y1, y2]);
    t += res.rowCount; console.log(`${mk} ${md} ${y1}-${y2} -> ${bolt}: ${res.rowCount} rows (was ${[...new Set(res.rows.map(x => x.was))].join("/")})`);
  }
  console.log(`total ${t}`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN"); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }
