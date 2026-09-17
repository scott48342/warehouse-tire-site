// Backfill lug torque / OE tire pressure / OE load index (migration 0049) onto live tireguide-pro rows
// from the parsed Tire Guide Pro JSONs in out/<year>/<make>/<model>.json.
//
//   node --env-file=.env.local scripts/audit/pass3/tireguide/backfill-service-specs.mjs [--apply] [--only 2021/chevrolet/silverado-1500,...]
//
// Row <-> print mapping: live rows were inserted by reconcile-tg.mjs with raw_trim = TG option names joined by " | "
// (staggered trims as "X Front | X Rear"), so each row maps to an exact set of TG options.
//
// PARSER-SHIFT REPAIR: tg-parse.py (before 2026-09-17) pooled every 2-3 digit integer on a size line and took the last
// three as [load_index, torque, wheelbase]. Prints that list two wheelbases put the longer one between the weights, and a
// decimal wheelbase (e.g. 147.5) fell into _unparsed, so those rows came out shifted: load_index=<2nd wheelbase>,
// torque=<load index>, wheelbase=<torque>. The shift is deterministic (decimal in _unparsed AND three ints parsed) and is
// undone here. The 24 PDFs still on disk are re-parsed with the fixed parser and used to VALIDATE the repair.
//
// Values per row: torque = mode across the row's sizes; front psi = mode of inflation_front over non-"Rear" options;
// rear psi = mode of inflation_rear over non-"Front" options; load index = LI of the rank-1 size on the row's primary
// OE tire (oem_tire_sizes[0]), else rank-1 first size. Anything outside sanity ranges (LI 60-140, torque 60-200,
// psi 20-90) is dropped and reported rather than stored.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import pg from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const PDF_DIR = "F:/clawd/tire-guide-pdfs";
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > -1 ? process.argv[i + 1].split(",") : []; })();
// Y/M/M that have no print of their own but are spec-identical to another print year (Scott, 2026-09-17: Mach-E "2024 to current is all the same")
const MIRROR = { "2025/ford/mustang-mach-e": "2024/ford/mustang-mach-e", "2026/ford/mustang-mach-e": "2024/ford/mustang-mach-e" };

const SANE = { li: [60, 140], tq: [60, 200], psi: [20, 90] };
const inRange = (v, [lo, hi]) => Number.isInteger(v) && v >= lo && v <= hi;
const mode = (arr) => { const m = new Map(); for (const v of arr) if (v != null) m.set(v, (m.get(v) || 0) + 1); let best = null, n = 0; for (const [v, c] of m) if (c > n) { best = v; n = c; } return { value: best, distinct: m.size }; };

/** Undo the pre-2026-09-17 column shift on one parsed size line. Returns { li, tq, wb, repaired } */
function repairSize(s) {
  let li = s.load_index ?? null, tq = s.torque_ftlb ?? null, wb = s.wheelbase_in ?? null, repaired = false, front = null;
  const dec = (s._unparsed || []).map(u => String(u).trim()).find(u => /^\d{2,3}\.\d{1,2}$/.test(u));
  // tire size unrecognised by the old parser (e.g. run-flat "P255/45RF20"): the front psi was swept into the int pool as the
  // first value -> [psi, LI, torque] + decimal wheelbase. Recover the psi, then fall through to the normal shift repair.
  if (s.tire_size == null && s.inflation_front == null && dec != null && li != null && tq != null && wb != null && inRange(li, SANE.psi) && li < SANE.li[0]) {
    front = li;
  }
  if (dec != null) {
    if (li != null && tq != null && wb != null) { li = tq; tq = wb; wb = Number(dec); repaired = true; }   // shifted by the 2nd wheelbase
    else if (wb == null) { wb = Number(dec); }                                                          // just a decimal wheelbase
  }
  // two ints only, first one too big to be a load index: it was the 2nd wheelbase and the line had no torque ([wb2, LI])
  if (s.wheelbase_in == null && li != null && li > SANE.li[1] && tq != null && tq <= SANE.li[1]) { li = tq; tq = null; repaired = true; }
  return { li, tq, wb, repaired, front };
}

function loadJsons() {
  const files = [];
  for (const y of fs.readdirSync(OUT).filter(d => /^\d{4}$/.test(d)))
    for (const mk of fs.readdirSync(path.join(OUT, y)))
      for (const f of fs.readdirSync(path.join(OUT, y, mk))) if (f.endsWith(".json")) files.push(path.join(OUT, y, mk, f));
  const byKey = new Map();
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
    if (!j.our) continue;
    byKey.set(`${j.our.year}/${j.our.make}/${j.our.model}`, { j, file: path.relative(HERE, f).replace(/\\/g, "/") });
  }
  return byKey;
}

/** Validate the repair heuristic against fresh parses of the PDFs still on disk. */
function validateAgainstPdfs(byKey) {
  const report = { pdfs: 0, matchedJson: 0, sizes: 0, agree: 0, disagree: [] };
  if (!fs.existsSync(PDF_DIR)) return report;
  const hdrIndex = new Map();
  for (const [k, { j }] of byKey) hdrIndex.set(`${j.header.year}|${j.header.make_model_raw}`, k);
  for (const pdf of fs.readdirSync(PDF_DIR).filter(f => f.endsWith(".pdf"))) {
    report.pdfs++;
    let fresh;
    try { fresh = JSON.parse(execFileSync("python", [path.join(HERE, "tg-parse.py"), path.join(PDF_DIR, pdf)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { continue; }
    const k = hdrIndex.get(`${fresh.header.year}|${fresh.header.make_model_raw}`);
    if (!k) continue;
    report.matchedJson++;
    const old = byKey.get(k).j;
    for (const fo of fresh.options) {
      const oo = old.options.find(o => o.option === fo.option); if (!oo) continue;
      for (const fs_ of fo.sizes) {
        const os = oo.sizes.find(s => s.tire_size === fs_.tire_size && s.rim_size === fs_.rim_size); if (!os) continue;
        report.sizes++;
        const r = repairSize(os);
        if (r.li === (fs_.load_index ?? null) && r.tq === (fs_.torque_ftlb ?? null)) report.agree++;
        else report.disagree.push(`${k} ${fo.option} ${fs_.tire_size}: repaired li=${r.li} tq=${r.tq} vs fresh li=${fs_.load_index} tq=${fs_.torque_ftlb}`);
      }
    }
  }
  return report;
}

function specsForRow(j, row) {
  const names = String(row.raw_trim || "").split(" | ").map(s => s.trim()).filter(Boolean);
  const opts = j.options.filter(o => names.includes(o.option));
  if (!opts.length) return { missing: "no TG options match raw_trim" };
  const sizes = [], front = [], rear = [], tq = [];
  let repaired = 0;
  for (const o of opts) {
    const isRear = /\sRear$/i.test(o.option), isFront = /\sFront$/i.test(o.option);
    for (const s of o.sizes) {
      const r = repairSize(s); if (r.repaired) repaired++;
      sizes.push({ o: o.option, rank: Number(s.rank) || 99, tire: s.tire_size, li: r.li, isRear, isFront });
      if (inRange(r.tq, SANE.tq)) tq.push(r.tq);
      const fpsi = s.inflation_front ?? r.front;
      if (!isRear && inRange(fpsi, SANE.psi)) front.push(fpsi);
      if (!isFront && inRange(s.inflation_rear, SANE.psi)) rear.push(s.inflation_rear);
    }
  }
  const primary = Array.isArray(row.oem_tire_sizes) ? row.oem_tire_sizes[0] : null;
  const norm = t => String(t || "").toUpperCase().replace(/^(P|LT|T)/, "").replace(/\s/g, "");
  const cand = sizes.filter(s => !s.isRear).sort((a, b) => a.rank - b.rank);
  const liSrc = cand.find(s => primary && norm(s.tire) === norm(primary)) || cand[0] || sizes[0];
  const li = liSrc && inRange(liSrc.li, SANE.li) ? liSrc.li : null;
  const T = mode(tq), F = mode(front), R = mode(rear);
  const notes = [];
  // torque is a safety spec: when the TG trims merged into this row disagree, store nothing rather than a majority vote
  if (T.distinct > 1) { notes.push(`torque varies ${[...new Set(tq)].join("/")} across merged trims -> stored NULL`); T.value = null; }
  if (liSrc && liSrc.li != null && li == null) notes.push(`LI ${liSrc.li} out of range -> dropped`);
  return { torque: T.value, front: F.value, rear: R.value, li, repaired, nSizes: sizes.length, notes };
}

// ---------------------------------------------------------------- main
const byKey = loadJsons();
console.log(`parsed JSONs with .our: ${byKey.size}`);
const val = validateAgainstPdfs(byKey);
console.log(`repair validation vs ${val.pdfs} PDFs on disk: ${val.matchedJson} matched JSONs, ${val.sizes} size lines, ${val.agree} agree, ${val.disagree.length} disagree`);
for (const d of val.disagree) console.log("  DISAGREE " + d);

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
const q = async (s, a = []) => (await c.query(s, a)).rows;
const rows = await q(`select id, year, make, model, display_trim, raw_trim, oem_tire_sizes, lug_torque_ftlb, tire_pressure_front_psi, tire_pressure_rear_psi, oem_load_index
  from vehicle_fitments where wheel_specs_source = 'tireguide-pro' and quarantined_at is null order by year, make, model, display_trim`);
console.log(`live tireguide-pro rows: ${rows.length}`);

const plan = { updated: [], noJson: new Set(), noMatch: [], repairedSizes: 0, notes: [], fields: { torque: 0, front: 0, rear: 0, li: 0 } };
await c.query("BEGIN");
for (const r of rows) {
  const key = `${r.year}/${r.make}/${r.model}`;
  if (ONLY.length && !ONLY.includes(key)) continue;
  const src = byKey.get(MIRROR[key] || key);
  if (!src) { plan.noJson.add(key); continue; }
  const s = specsForRow(src.j, r);
  if (s.missing) { plan.noMatch.push(`${key} "${r.display_trim}" (${s.missing})`); continue; }
  plan.repairedSizes += s.repaired;
  for (const n of s.notes) plan.notes.push(`${key} "${r.display_trim}": ${n}`);
  const set = { lug_torque_ftlb: s.torque, tire_pressure_front_psi: s.front, tire_pressure_rear_psi: s.rear, oem_load_index: s.li };
  if (Object.values(set).every(v => v == null)) { plan.noMatch.push(`${key} "${r.display_trim}" (no usable values)`); continue; }
  if (s.torque != null) plan.fields.torque++; if (s.front != null) plan.fields.front++; if (s.rear != null) plan.fields.rear++; if (s.li != null) plan.fields.li++;
  await q(`update vehicle_fitments set lug_torque_ftlb = $2, tire_pressure_front_psi = $3, tire_pressure_rear_psi = $4, oem_load_index = $5, updated_at = now() where id = $1`,
    [r.id, s.torque, s.front, s.rear, s.li]);
  plan.updated.push({ key, trim: r.display_trim, ...set, from: MIRROR[key] ? `mirror of ${MIRROR[key]}` : src.file });
}
if (APPLY) await c.query("COMMIT"); else await c.query("ROLLBACK");

console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${plan.updated.length}/${rows.length} rows updated; torque=${plan.fields.torque} front=${plan.fields.front} rear=${plan.fields.rear} loadIndex=${plan.fields.li}; parser-shift repaired on ${plan.repairedSizes} size lines`);
if (plan.noJson.size) console.log(`no JSON for ${plan.noJson.size} Y/M/M: ${[...plan.noJson].join(", ")}`);
if (plan.noMatch.length) { console.log(`no match / no values (${plan.noMatch.length}):`); for (const x of plan.noMatch) console.log("  " + x); }
if (plan.notes.length) { console.log(`notes (${plan.notes.length}):`); for (const x of plan.notes) console.log("  " + x); }
console.log("\nsample:");
for (const u of plan.updated.filter((_, i) => i % Math.max(1, Math.floor(plan.updated.length / 15)) === 0).slice(0, 16))
  console.log(`  ${u.key} "${u.trim}": torque ${u.lug_torque_ftlb} ft-lb, ${u.tire_pressure_front_psi}/${u.tire_pressure_rear_psi} psi, LI ${u.oem_load_index}  [${u.from}]`);
fs.writeFileSync(path.join(HERE, "out", `backfill-service-specs-${APPLY ? "applied" : "dryrun"}.json`), JSON.stringify({ ranAt: new Date().toISOString(), apply: APPLY, validation: val, ...plan, noJson: [...plan.noJson] }, null, 1));
c.release(); await pool.end();
