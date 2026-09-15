// Certify bolt_pattern on rows where the roadkill cross-reference agrees on a TIGHT year range and our source family
// is trustworthy (its own tight-range bolt disagreement share < 10%). Stamp-only: no fitment values change.
//   node --env-file=.env.local scripts/audit/pass3/roadkill/03-apply-bolt.mjs [--apply] [--threshold 0.10]
import pg from "pg";
import fs from "node:fs";
const APPLY = process.argv.includes("--apply");
const TH = (() => { const i = process.argv.indexOf("--threshold"); return i > -1 ? +process.argv[i + 1] : 0.10; })();
const readCsv = f => { const [h, ...rows] = fs.readFileSync(f, "utf8").split("\n").filter(Boolean); const cols = h.split(","); return rows.map(l => { const vals = [...l.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"')); return Object.fromEntries(cols.map((c, i) => [c, vals[i]])); }); };
const agree = readCsv("docs/fitment-api/audit/pass3/roadkill-agree.csv").filter(r => r.range === "tight" && r.bolt === "agree");
const dis = readCsv("docs/fitment-api/audit/pass3/roadkill-disagree.csv").filter(r => r.range === "tight" && r.bolt === "disagree");
const fam = s => (s || "").split(" ")[0];
const stats = {};
for (const r of agree) (stats[fam(r.source)] ||= { a: 0, d: 0 }).a++;
for (const r of dis) (stats[fam(r.source)] ||= { a: 0, d: 0 }).d++;
const table = Object.entries(stats).map(([f, s]) => ({ family: f, agree: s.a, disagree: s.d, share: +(s.d / (s.a + s.d)).toFixed(3), keep: s.d / (s.a + s.d) < TH })).sort((a, b) => b.share - a.share);
console.table(table);
const keepFam = new Set(table.filter(t => t.keep).map(t => t.family));
const rows = agree.filter(r => keepFam.has(fam(r.source)));
console.log(`tight bolt agreements: ${agree.length}; in trusted families (<${TH * 100}% disagreement): ${rows.length} rows across ${new Set(rows.map(r => `${r.year}|${r.make}|${r.model}`)).size} Y/M/M`);
console.log("excluded families:", table.filter(t => !t.keep).map(t => `${t.family} (${(t.share * 100).toFixed(0)}%)`).join(", "));
if (!APPLY) { console.log("DRY RUN — nothing written. Re-run with --apply."); process.exit(0); }
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const ids = rows.map(r => r.id);
const r = await p.query(`
  update vehicle_fitments set
    wheel_specs_verified_at = now(),
    wheel_specs_source = 'roadkill-xref',
    wheel_specs_confidence = 'MEDIUM',
    updated_at = now(),
    last_modified_by = 'audit-pass3-roadkill',
    last_modified_reason = 'bolt pattern confirmed by independent cross-reference (tight year range)'
  where id = any($1::uuid[]) and quarantined_at is null and wheel_specs_verified_at is null`, [ids]);
console.log(`✓ stamped ${r.rowCount} rows (bolt pattern confirmed; values unchanged)`);
await p.end();
