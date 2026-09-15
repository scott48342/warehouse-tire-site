// Build the Tire Guide work list: distinct active (year, make, model) + Pass 1 gap Y/M/M, ordered by Pass 2 severity.
//   node --env-file=.env.local scripts/audit/pass3/tireguide/tg-worklist.mjs [--from 1990] [--to 2027] [--out worklist.json]
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const FROM = +arg("--from", 1990), TO = +arg("--to", 2027);
const OUT = arg("--out", path.join("scripts", "audit", "pass3", "tireguide", "worklist.json"));
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Pass 2 status per Y/M/M â†’ priority: 0 mismatch, 1 partial/overlap, 2 usaf_missing/unknown, 3 match (confirm), 4 gap-fill (not in DB)
const ours = (await p.query(`
  select f.year, f.make, f.model, count(*)::int rows,
         count(*) filter (where r.status='mismatch')::int mism,
         count(*) filter (where r.status='partial')::int part,
         count(*) filter (where r.status='match')::int mat,
         count(*) filter (where r.status='usaf_missing_ymm')::int um
  from vehicle_fitments f left join audit_pass2_results r on r.fitment_id::uuid = f.id
  where f.quarantined_at is null and f.year between $1 and $2
  group by 1,2,3`, [FROM, TO])).rows;
const items = ours.map(r => ({
  year: r.year, make: r.make, model: r.model, rows: r.rows,
  prio: r.mism > 0 ? 0 : r.part > 0 ? 1 : r.mat === 0 ? 2 : 3,
  p2: { mismatch: r.mism, partial: r.part, match: r.mat, usaf_missing: r.um },
}));
// Pass 1 gap list (NHTSA Y/M/M we have zero rows for)
const gapCsv = path.join("docs", "fitment-api", "audit", "pass1", "missing-ymm-nhtsa.csv");
let gaps = 0;
if (fs.existsSync(gapCsv)) {
  const lines = fs.readFileSync(gapCsv, "utf8").split(/\r?\n/).filter(Boolean);
  const hdr = lines[0].split(",").map(s => s.trim().toLowerCase());
  const yi = hdr.indexOf("year"), mi = hdr.findIndex(h => h.startsWith("make")), mo = hdr.findIndex(h => h.startsWith("model"));
  const have = new Set(items.map(i => `${i.year}|${i.make}|${i.model}`));
  for (const l of lines.slice(1)) {
    const c = l.split(",");
    const y = +c[yi], mk = (c[mi] || "").trim().toLowerCase(), md = (c[mo] || "").trim().toLowerCase();
    if (!y || y < FROM || y > TO || !mk || !md) continue;
    const k = `${y}|${mk}|${md}`;
    if (have.has(k)) continue;
    have.add(k); gaps++;
    items.push({ year: y, make: mk, model: md, rows: 0, prio: 4, p2: null, gap: true });
  }
}
items.sort((a, b) => a.prio - b.prio || b.year - a.year || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(items, null, 0));
const by = items.reduce((m, i) => (m[i.prio] = (m[i.prio] || 0) + 1, m), {});
console.log(`worklist: ${items.length} Y/M/M (${FROM}-${TO}); by prio: mismatch=${by[0] || 0} partial=${by[1] || 0} unverified=${by[2] || 0} confirm=${by[3] || 0} gaps=${by[4] || 0} â†’ ${OUT}`);
await p.end();

