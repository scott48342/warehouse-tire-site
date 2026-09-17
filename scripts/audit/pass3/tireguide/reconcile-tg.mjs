// Reconcile Tire Guide Pro scrape results (out/<year>/<make>/<model>.json) into vehicle_fitments as per-trim rows.
// Generalizes scripts/audit/pass4/21-tg-terrain-encoregx-2023.mjs + scripts/apply-maverick-tireguide.mjs.
//
//   node --env-file=.env.local scripts/audit/pass3/tireguide/reconcile-tg.mjs            # dry run (default) - prints plan, rolls back
//   node --env-file=.env.local scripts/audit/pass3/tireguide/reconcile-tg.mjs --apply    # commit, one pg transaction per Y/M/M
//   node --env-file=.env.local scripts/audit/pass3/tireguide/reconcile-tg.mjs --verify   # post-apply integrity checks only
//   optional: --only=2024/ford/f-150 (repeatable, comma-separated)   --quiet (totals only)
//
// Rules (Scott, 2026-09-16): Tire Guide Pro = authoritative OE source (HIGH). Old live rows for each reconciled Y/M/M are
// QUARANTINED (never deleted) with last_modified_by='audit-tg-reconcile'. TG has no offset / center bore -> carried from the
// old rows (closest trim, else Y/M/M mode, else adjacent years of the same model); a Y/M/M with no carry source is SKIPPED.
// Bolt = TG bolt_circle (normalized to our NxM.M form, 120.7 -> 120.65); disagreement with ours is logged, TG wins.
// Options with identical spec sets are merged into one row (display_trim joined by ' / '). "X Front"/"X Rear" options are
// merged into one staggered trim X with axle-specific oem_wheel_sizes entries.
//
// ROLLBACK:
//   update vehicle_fitments set quarantined_at = now() where last_modified_by = 'audit-tg-reconcile' and wheel_specs_source = 'tireguide-pro' and quarantined_at is null;
//   update vehicle_fitments set quarantined_at = null, modification_id = regexp_replace(modification_id, '~q-tg-2026-09-16$', '')
//     where last_modified_by = 'audit-tg-reconcile' and last_modified_reason like 'replaced by Tire Guide Pro%';
//   (the second statement also restores modification_ids that were suffixed to free the id for the TG row)
import pg from "pg";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const VERIFY_ONLY = process.argv.includes("--verify");
const QUIET = process.argv.includes("--quiet");
const ONLY = process.argv.filter(a => a.startsWith("--only=")).flatMap(a => a.slice(7).split(",")).map(s => s.trim()).filter(Boolean);
const WHO = "audit-tg-reconcile";
const SRC = "tireguide-pro";
const RUN_DATE = "2026-09-16";
const ID_SUFFIX = `~q-tg-${RUN_DATE}`;
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(HERE, "out");
const PLAN_JSON = path.join(HERE, `reconcile-plan-${RUN_DATE}.json`);
const REPORT_MD = path.resolve(HERE, "../../../../docs/fitment-api/audit/pass3", `tireguide-reconcile-${RUN_DATE}.md`);

// ---------------------------------------------------------------- helpers
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const modeOf = (arr, key = x => x) => {
  const m = new Map();
  for (const a of arr) { if (a == null) continue; const k = key(a); m.set(k, (m.get(k) || { n: 0, v: a })); m.get(k).n++; }
  let best = null; for (const { n, v } of m.values()) if (!best || n > best.n) best = { n, v };
  return best?.v ?? null;
};
const num = v => (v == null || v === "" ? null : Number(v));

/** TG bolt_circle -> our notation (e.g. "5-120.7" / "5x120.7mm" -> "5x120.65"). null when empty/unparseable. */
function normBolt(raw) {
  if (!raw) return null;
  const m = String(raw).replace(/mm/gi, "").match(/(\d+)\s*[x×\-]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  let d = m[2];
  if (d === "120.7") d = "120.65";
  if (/\.0+$/.test(d)) d = d.replace(/\.0+$/, "");
  return `${m[1]}x${d}`;
}

/** TG tire_size -> oem_tire_sizes convention (no P/LT/HL prefix, no load-range suffix, ZR->R, no trailing C). */
function normTire(raw) {
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  s = s.replace(/\/[CDEF]$/, "");                // load range "/E"
  s = s.replace(/^(P|LT|HL)(?=\d)/, "");          // P / LT / HL prefix
  s = s.replace(/ZR|RF/, "R");                    // 245/35ZR19 -> 245/35R19; 255/45RF20 (run-flat) -> 255/45R20
  s = s.replace(/^(\d+X\d+(?:\.\d+)?R\d+)LT$/, "$1"); // 37X12.50R17LT -> 37X12.50R17
  s = s.replace(/^(\d+\/\d+R\d+)C$/, "$1");       // 235/65R16C -> 235/65R16
  return s.replace(/X/, "x");                     // flotation uses lowercase x in our DB (37x12.50R17)
}
const TIRE_RE = /^(?:HL|P|LT|XL)?\d{2,3}(?:\/\d{2}Z?RF?\d{2}(?:\.\d)?[A-Z]?(?:\/[CDEF])?|x\d+(?:\.\d+)?R\d{2}(?:LT)?(?:\/[CDEF])?)$/i;
const RIM_RE = /^\d{2}x\d+(?:\.\d+)?(?:-\d{2}x\d+(?:\.\d+)?)?$/i;
/** tg-parse.py occasionally leaves the tire (e.g. "HL275/35R23") and rim in _unparsed; salvage them. */
function salvage(s) {
  const un = Array.isArray(s._unparsed) ? s._unparsed.map(x => String(x).trim()) : [];
  const tire = s.tire_size || un.find(x => TIRE_RE.test(x)) || null;
  const rim = s.rim_size || un.find(x => RIM_RE.test(x)) || null;
  return { tire, rim, salvaged: (!s.tire_size && tire) || (!s.rim_size && rim) ? true : false };
}
const rimDiaFromTire = t => { const m = String(t).match(/R(\d{2})/i); return m ? Number(m[1]) : null; };

/** rim_size "18x7.5" | "18x7.5-18x8.5" -> [{diameter, width}] */
function parseRims(raw) {
  if (!raw) return [];
  const out = [];
  for (const part of String(raw).split(/\s*-\s*/)) {
    const m = part.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
    if (m) out.push({ diameter: Number(m[1]), width: Number(m[2]) });
  }
  return out;
}

const SYN = [[/\b4x2\b|\brwd\b|\b2wd\b/g, " 2wd "], [/\b4x4\b|\bawd\b|\b4wd\b/g, " 4wd "], [/\(drw\)|dual rear wheel|\bdrw\b/g, " drw "], [/\bpkg\.?|\bpackage\b/g, " pkg "], [/\bw\//g, " "]];
function tokens(s) {
  let t = String(s || "").toLowerCase();
  for (const [re, rep] of SYN) t = t.replace(re, rep);
  return new Set(t.split(/[^a-z0-9]+/).filter(x => x && x !== "base"));
}
function bestTrimMatch(names, oldRows) {
  // tier 1: exact display_trim match (case-insensitive) with any of the TG option names
  const lc = new Set(names.map(n => n.toLowerCase().trim()));
  const exact = oldRows.find(r => lc.has(String(r.display_trim).toLowerCase().trim()));
  if (exact) return exact;
  const want = new Set(); for (const n of names) for (const t of tokens(n)) want.add(t);
  // tier 2: token overlap on display_trim only; tier 3: include raw_trim/submodel
  for (const wide of [false, true]) {
    let best = null;
    for (const r of oldRows) {
      const have = tokens(r.display_trim + (wide ? " " + (r.raw_trim || "") + " " + (r.submodel || "") : ""));
      let inter = 0; for (const t of want) if (have.has(t)) inter++;
      if (!inter) continue;
      const score = inter / (want.size + have.size - inter);
      if (!best || inter > best.inter || (inter === best.inter && score > best.score)) best = { inter, score, row: r };
    }
    if (best) return best.row;
  }
  return null;
}

/** Compare TG header model with our catalog name / slug. Accepts benign suffixes only (Sportback / Quattro / Super Duty / body-class words). */
function modelMatches(tgRaw, ourMake, ourModelSlug, catName) {
  const n = s => String(s).toLowerCase().replace(/\b(trucks|vans|minivans|sportback|quattro|super duty)\b/g, " ").replace(/[^a-z0-9]+/g, "");
  let tg = String(tgRaw).toLowerCase();
  tg = tg.replace(new RegExp("^" + ourMake.toLowerCase().replace(/[^a-z0-9]+/g, "\\W*") + "\\b"), " ");
  const t = n(tg);
  const cands = [n(ourModelSlug), catName ? n(catName) : null].filter(Boolean);
  return cands.some(c => c === t);
}

// ---------------------------------------------------------------- load inputs
function loadFiles() {
  const files = [];
  for (const y of fs.readdirSync(OUT).filter(d => /^\d{4}$/.test(d)))
    for (const mk of fs.readdirSync(path.join(OUT, y)))
      for (const f of fs.readdirSync(path.join(OUT, y, mk))) if (f.endsWith(".json")) files.push(path.join(OUT, y, mk, f));
  return files.map(f => ({ file: path.relative(HERE, f).replace(/\\/g, "/"), j: JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "")) }))
    .filter(x => !ONLY.length || ONLY.includes(`${x.j.our.year}/${x.j.our.make}/${x.j.our.model}`))
    .sort((a, b) => a.j.our.year - b.j.our.year || a.j.our.make.localeCompare(b.j.our.make) || a.j.our.model.localeCompare(b.j.our.model));
}

/** Build per-trim specs from TG options. Returns { trims:[{names, bolt, bolts, wheels, tires, staggered}], bolts:Set, boltMissing:int } */
function buildTrims(j) {
  const groups = new Map(); // base trim -> { names:Set, entries:[{axle, rank, rim, tire, bolt}] }
  for (const o of j.options) {
    const m = String(o.option).match(/^(.*?)\s+(Front|Rear)$/i);
    const base = (m ? m[1] : o.option).trim();
    const axle = m ? m[2].toLowerCase() : "both";
    if (!groups.has(base)) groups.set(base, { names: new Set(), entries: [] });
    const g = groups.get(base); g.names.add(o.option);
    for (const s of o.sizes) {
      const sv = salvage(s);
      if (!sv.tire && !sv.rim) continue; // nothing usable on this line
      g.entries.push({ axle, rank: Number(s.rank) || 99, rim: sv.rim, tire: sv.tire, bolt: normBolt(s.bolt_circle), tpms: s.tpms, salvaged: sv.salvaged });
    }
  }
  const fileBolt = modeOf([...groups.values()].flatMap(g => g.entries.map(e => e.bolt)).filter(Boolean));
  const trims = [];
  let boltMissing = 0;
  for (const [base, g] of groups) {
    g.entries.sort((a, b) => a.rank - b.rank || (a.axle === "front" ? -1 : a.axle === "rear" ? 1 : 0));
    const bolts = [...new Set(g.entries.map(e => e.bolt).filter(Boolean))];
    let bolt = bolts[0] ?? null, boltNote = null;
    if (bolts.length > 1) boltNote = `TG lists multiple bolt circles for this trim: ${bolts.join(",")} (kept ${bolt})`;
    if (!bolt && fileBolt) { bolt = fileBolt; boltNote = `bolt missing on TG print for this trim; used file-level TG bolt ${fileBolt}`; }
    if (!bolt) { boltMissing++; boltNote = "bolt missing on TG print"; }
    const wheels = [], tires = [], seenW = new Set(), notes = [];
    if (g.entries.some(e => e.salvaged)) notes.push("tire/rim salvaged from _unparsed");
    for (const e of g.entries) {
      let rims = parseRims(e.rim);
      if (!rims.length && e.tire) { const d = rimDiaFromTire(e.tire); if (d) { rims = [{ diameter: d, width: null }]; if (!notes.includes("rim width missing on TG print (diameter from tire)")) notes.push("rim width missing on TG print (diameter from tire)"); } }
      if (e.tire) { const tn = normTire(e.tire); if (!tires.includes(tn)) tires.push(tn); }
      for (const r of rims) {
        const k = `${e.axle}|${r.diameter}|${r.width}`; // one entry per distinct rim (Terrain/Maverick convention); tireSize = first TG tire on that rim
        if (seenW.has(k)) continue; seenW.add(k);
        wheels.push({ axle: e.axle, width: r.width, offset: null, isStock: true, diameter: r.diameter, tireSize: e.tire || null });
      }
    }
    if (!wheels.length || !tires.length) { boltMissing += 0; notes.push("UNUSABLE: no wheel or tire size parsed"); }
    const staggered = wheels.some(w => w.axle !== "both");
    if (notes.length) boltNote = [boltNote, ...notes].filter(Boolean).join("; ");
    trims.push({ base, names: [...g.names], bolt, boltNote, wheels, tires, staggered, unusable: !wheels.length || !tires.length, key: JSON.stringify([bolt, wheels.map(w => [w.axle, w.diameter, w.width]), tires]) });
  }
  // merge identical spec sets
  const merged = new Map();
  for (const t of trims) {
    if (!merged.has(t.key)) merged.set(t.key, { ...t, bases: [t.base], names: [...t.names] });
    else { const m = merged.get(t.key); m.bases.push(t.base); m.names.push(...t.names); }
  }
  const out = [...merged.values()].map(t => ({ ...t, display: t.bases.join(" / ") }));
  return { trims: out, bolts: new Set(out.map(t => t.bolt).filter(Boolean)), boltMissing };
}

// ---------------------------------------------------------------- main
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
const q = async (s, a = []) => (await c.query(s, a)).rows;
const log = (...a) => { if (!QUIET) console.log(...a); };

const STAMP_Q = `quarantined_at = now(), last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
  audit_original_data = coalesce(v.audit_original_data, to_jsonb(v) - 'audit_original_data')`;

async function verify(ymms) {
  const rep = { ok: true, lines: [] };
  const ins = await q(`select count(*)::int n from vehicle_fitments where last_modified_by = $1 and wheel_specs_source = $2 and quarantined_at is null`, [WHO, SRC]);
  const quar = await q(`select count(*)::int n from vehicle_fitments where last_modified_by = $1 and quarantined_at is not null`, [WHO]);
  rep.lines.push(`live TG rows by ${WHO}: ${ins[0].n}; quarantined by ${WHO}: ${quar[0].n}`);
  const bad = await q(`select year, make, model, display_trim from vehicle_fitments where last_modified_by = $1 and quarantined_at is null
    and (offset_min_mm is null or offset_max_mm is null or center_bore_mm is null or bolt_pattern is null
         or exists (select 1 from jsonb_array_elements(oem_wheel_sizes) w where (w->>'offset') is null))`, [WHO]);
  if (bad.length) { rep.ok = false; rep.lines.push(`FAIL ${bad.length} live TG rows with null offset/CB/bolt/wheel-offset: ` + bad.map(b => `${b.year} ${b.make} ${b.model} ${b.display_trim}`).join("; ")); }
  else rep.lines.push("PASS no live TG row with null offset / center bore / bolt / per-wheel offset");
  const dup = await q(`select year, make, model, modification_id, count(*) n from vehicle_fitments where quarantined_at is null group by 1,2,3,4 having count(*) > 1`);
  if (dup.length) { rep.ok = false; rep.lines.push(`FAIL duplicate live modification_id: ` + dup.map(d => `${d.year}/${d.make}/${d.model}/${d.modification_id}`).join("; ")); }
  else rep.lines.push("PASS no duplicate live (year, make, model, modification_id)");
  for (const y of ymms) {
    const r = await q(`select count(*)::int n, count(*) filter (where wheel_specs_source = $4)::int tg from vehicle_fitments where year = $1 and make = $2 and model = $3 and quarantined_at is null`, [y.year, y.make, y.model, SRC]);
    if (r[0].n === 0 || r[0].n !== r[0].tg) { rep.ok = false; rep.lines.push(`FAIL ${y.year} ${y.make} ${y.model}: live=${r[0].n} tg=${r[0].tg}`); }
  }
  if (ymms.length) rep.lines.push(`checked ${ymms.length} reconciled Y/M/M: every live row is tireguide-pro and at least one exists${rep.ok ? " (PASS)" : ""}`);
  return rep;
}

try {
  if (VERIFY_ONLY) {
    const plan = fs.existsSync(PLAN_JSON) ? JSON.parse(fs.readFileSync(PLAN_JSON, "utf8")) : { reconciled: [] };
    const rep = await verify(plan.reconciled.map(r => ({ year: r.year, make: r.make, model: r.model })));
    console.log(rep.lines.join("\n")); process.exitCode = rep.ok ? 0 : 1;
  } else {
    const files = loadFiles();
    const cat = new Map((await q(`select make_slug, slug, name, years from catalog_models`)).map(r => [`${r.make_slug}/${r.slug}`, r]));
    const already = new Set((await q(`select distinct year || '/' || make || '/' || model k from vehicle_fitments where quarantined_at is null group by year, make, model
      having bool_and(wheel_specs_source is not distinct from $1)`, [SRC])).map(r => r.k));
    const plan = { runDate: RUN_DATE, applied: APPLY, reconciled: [], skipped: { empty: [], alreadyTireguide: [], noCatalog: [], modelMismatch: [], noOffset: [], noCenterBore: [] }, notes: [], boltConflicts: [], totals: { ymm: 0, inserted: 0, quarantined: 0, idSuffixed: 0 } };

    for (const { file, j } of files) {
      const { year, make, model } = j.our;
      const tag = `${year} ${make} ${model}`;
      const key = `${year}/${make}/${model}`;
      if (!(j.n_options > 0) || !j.options?.length) { plan.skipped.empty.push(tag); continue; }
      const catRow = cat.get(`${make}/${model}`);
      if (!catRow) { plan.skipped.noCatalog.push(tag); log(`SKIP no catalog_models entry: ${tag}`); continue; }
      if (!modelMatches(j.header.make_model_raw, make, model, catRow.name)) { plan.skipped.modelMismatch.push(`${tag} (TG print = "${j.header.make_model_raw}")`); log(`SKIP model mismatch: ${tag} <- TG "${j.header.make_model_raw}"`); continue; }
      if (already.has(key)) { plan.skipped.alreadyTireguide.push(tag); log(`SKIP already tireguide-pro: ${tag}`); continue; }
      if (Array.isArray(catRow.years) && !catRow.years.includes(year)) plan.notes.push(`${tag}: year ${year} missing from catalog_models.years (picker may not list it)`);

      const old = await q(`select id, modification_id, display_trim, raw_trim, submodel, bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, wheel_specs_source
        from vehicle_fitments where year = $1 and make = $2 and model = $3 and quarantined_at is null order by display_trim`, [year, make, model]);
      const adj = old.length ? [] : [];
      // carry pool: same Y/M/M rows with offsets; else adjacent years (closest first)
      let pool = old.filter(r => r.offset_min_mm != null && r.offset_max_mm != null), carryLevel = "same-year";
      if (!pool.length) {
        const near = await q(`select year, display_trim, raw_trim, submodel, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes from vehicle_fitments
          where make = $1 and model = $2 and quarantined_at is null and offset_min_mm is not null and offset_max_mm is not null and abs(year - $3) between 1 and 6 order by abs(year - $3), year desc`, [make, model, year]);
        if (near.length) { const y0 = near[0].year; pool = near.filter(r => r.year === y0); carryLevel = `adjacent-year ${y0}`; adj.push(y0); }
      }
      if (!pool.length) { plan.skipped.noOffset.push(`${tag} (${old.length} live rows, none with offset; no adjacent-year source)`); log(`SKIP no offset source: ${tag}`); continue; }
      const cbPool = old.filter(r => r.center_bore_mm != null).length ? old.filter(r => r.center_bore_mm != null) : pool.filter(r => r.center_bore_mm != null);
      let cbFallback = modeOf(cbPool.map(r => num(r.center_bore_mm)));
      if (cbFallback == null) {
        const nearCb = await q(`select center_bore_mm from vehicle_fitments where make = $1 and model = $2 and quarantined_at is null and center_bore_mm is not null and abs(year - $3) <= 6 order by abs(year - $3) limit 20`, [make, model, year]);
        cbFallback = modeOf(nearCb.map(r => num(r.center_bore_mm)));
      }
      if (cbFallback == null) { plan.skipped.noCenterBore.push(tag); log(`SKIP no center bore source: ${tag}`); continue; }
      const modeOff = modeOf(pool.map(r => [num(r.offset_min_mm), num(r.offset_max_mm)]), x => x.join("|"));
      const threadFallback = modeOf([...old, ...pool].map(r => r.thread_size).filter(Boolean));
      const seatRaw = modeOf([...old, ...pool].map(r => r.seat_type).filter(Boolean));
      const seatFallback = seatRaw ? (/ball/i.test(seatRaw) ? "ball" : /bolt/i.test(seatRaw) ? "Lug bolts" : "conical") : "conical";

      const built = buildTrims(j);
      const oldBolts = new Set(old.map(r => r.bolt_pattern).filter(Boolean));
      const tgBolts = built.bolts;
      if (!tgBolts.size) plan.notes.push(`${tag}: TG print has no bolt circle; carried our bolt ${[...oldBolts].join("/") || "(none)"}`);
      const conflict = [...tgBolts].some(b => !oldBolts.has(b)) || [...oldBolts].some(b => !tgBolts.has(b) && tgBolts.size);
      if (conflict) plan.boltConflicts.push({ ymm: tag, ours: [...oldBolts].sort().join(", ") || "(none)", tg: [...tgBolts].sort().join(", ") });

      // resolve carried values per trim
      const rows = [];
      const usedIds = new Set();
      for (const t of built.trims) {
        if (t.unusable) { plan.notes.push(`${tag}: trim "${t.display}" skipped - ${t.boltNote}`); continue; }
        const m = bestTrimMatch(t.bases, pool) || null;
        const src = m || null;
        const omin = src ? num(src.offset_min_mm) : modeOff[0], omax = src ? num(src.offset_max_mm) : modeOff[1];
        const mid = Math.round((omin + omax) / 2);
        const cb = (m && m.center_bore_mm != null) ? num(m.center_bore_mm) : cbFallback;
        const thread = (m && m.thread_size) || threadFallback;
        const seat = (m && m.seat_type) ? (/ball/i.test(m.seat_type) ? "ball" : /bolt/i.test(m.seat_type) ? "Lug bolts" : "conical") : seatFallback;
        let bolt = t.bolt;
        let boltNote = t.boltNote;
        if (!bolt) { bolt = (m && m.bolt_pattern) || modeOf(old.map(r => r.bolt_pattern).filter(Boolean)); boltNote = `bolt carried from our rows (${bolt}) - TG print had none`; }
        // per-axle offsets from a matched staggered old row when available
        const axleOff = {};
        if (m && Array.isArray(m.oem_wheel_sizes)) for (const w of m.oem_wheel_sizes) if (w && w.offset != null && (w.axle === "front" || w.axle === "rear")) axleOff[w.axle] = Number(w.offset);
        const wheels = t.wheels.map(w => ({ ...w, offset: axleOff[w.axle] ?? mid }));
        let id = `${year}-${slug(make)}-${slug(model)}-${slug(t.display)}`.slice(0, 200);
        let n = 2; const base = id; while (usedIds.has(id)) id = `${base}-${n++}`;
        usedIds.add(id);
        const carry = m ? `trim-match "${m.display_trim}"${m.year ? ` (${m.year})` : ""}` : `${carryLevel} mode`;
        rows.push({ id, display: t.display, raw: t.names.join(" | "), bolt, boltNote, cb, thread, seat, omin, omax, wheels, tires: t.tires, staggered: t.staggered, carry, reason: `Tire Guide Pro print ${year} "${j.header.make_model_raw}" (${file}): ${t.display} = ${wheels.map(w => (w.axle === "both" ? "" : w.axle[0].toUpperCase() + ":") + w.diameter + "x" + w.width).join("/")} ${t.tires.join("/")} ${bolt}; offset/CB carried from ${carry}` });
      }
      if (!rows.length) { plan.skipped.empty.push(`${tag} (no parseable options)`); continue; }

      // ---- print plan for this Y/M/M
      log(`\n=== ${tag}  [${file}]  TG="${j.header.make_model_raw}"  carry=${carryLevel}`);
      log(`  OLD live ${old.length}: bolt=${[...oldBolts].join("/") || "-"} off=${Math.min(...pool.map(r => num(r.offset_min_mm)))}..${Math.max(...pool.map(r => num(r.offset_max_mm)))} cb=${[...new Set(old.map(r => r.center_bore_mm))].join("/")} src=${[...new Set(old.map(r => r.wheel_specs_source || "-"))].join("/")}`);
      log(`      trims: ${old.map(r => r.display_trim).join("; ")}`);
      if (conflict) log(`  !! BOLT CONFLICT ours=${[...oldBolts].join(",")} tg=${[...tgBolts].join(",")} -> TG wins`);
      log(`  NEW ${rows.length} TG trims:`);
      for (const r of rows) log(`    - ${r.display}${r.staggered ? " [staggered]" : ""}: ${r.wheels.map(w => (w.axle === "both" ? "" : w.axle[0].toUpperCase() + ":") + w.diameter + "x" + w.width + "@" + w.offset).join(" ")} | ${r.tires.join(" ")} | ${r.bolt} cb=${r.cb} off=${r.omin}..${r.omax} ${r.thread || ""} | ${r.carry}${r.boltNote ? " | " + r.boltNote : ""}  id=${r.id}`);

      // ---- transaction
      await c.query("BEGIN");
      const quar = await q(`update vehicle_fitments v set ${STAMP_Q} where year = $3 and make = $4 and model = $5 and quarantined_at is null returning id`,
        [WHO, `replaced by Tire Guide Pro ${year} "${j.header.make_model_raw}" per-trim rows (${file}); ${RUN_DATE}`, year, make, model]);
      const ids = rows.map(r => r.id);
      const ren = await q(`update vehicle_fitments set modification_id = modification_id || $5 where year = $1 and make = $2 and model = $3 and modification_id = any($4::text[]) and quarantined_at is not null returning id`,
        [year, make, model, ids, ID_SUFFIX]);
      let ins = 0;
      for (const r of rows) {
        const res = await q(`insert into vehicle_fitments (year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, tire_sizes_source, tire_sizes_confidence, tire_sizes_verified_at,
            wheel_specs_source, wheel_specs_confidence, wheel_specs_verified_at, source, quality_tier, certification_status, is_locked, confidence_tag, last_modified_by, last_modified_reason)
          values ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, 'HIGH', now(), $15, 'HIGH', now(), $15, 'complete', 'certified', true, 'HIGH', $16, $17) returning id`,
          [year, make, model, r.id, r.raw.slice(0, 255), r.display.slice(0, 255), r.bolt, r.cb, r.thread, r.seat, r.omin, r.omax, JSON.stringify(r.wheels), JSON.stringify(r.tires), SRC, WHO, r.reason]);
        ins += res.length;
      }
      if (APPLY) await c.query("COMMIT"); else await c.query("ROLLBACK");
      log(`  -> quarantined ${quar.length}, id-suffixed ${ren.length}, inserted ${ins} ${APPLY ? "COMMITTED" : "(dry run, rolled back)"}`);
      plan.reconciled.push({ year, make, model, file, tg: j.header.make_model_raw, carryLevel, oldRows: old.length, oldTrims: old.map(r => r.display_trim), oldBolt: [...oldBolts], quarantined: quar.length, idSuffixed: ren.length, inserted: ins, rows: rows.map(r => ({ id: r.id, display: r.display, bolt: r.bolt, cb: r.cb, offset: [r.omin, r.omax], wheels: r.wheels.map(w => `${w.axle === "both" ? "" : w.axle[0] + ":"}${w.diameter}x${w.width}@${w.offset}`), tires: r.tires, carry: r.carry, boltNote: r.boltNote || null })) });
      plan.totals.ymm++; plan.totals.inserted += ins; plan.totals.quarantined += quar.length; plan.totals.idSuffixed += ren.length;
    }

    // ---- summary
    const S = plan.skipped;
    console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${plan.totals.ymm} Y/M/M reconciled, ${plan.totals.inserted} rows inserted, ${plan.totals.quarantined} quarantined, ${plan.totals.idSuffixed} old ids suffixed`);
    console.log(`skipped: empty=${S.empty.length} alreadyTG=${S.alreadyTireguide.length} noCatalog=${S.noCatalog.length} modelMismatch=${S.modelMismatch.length} noOffset=${S.noOffset.length} noCB=${S.noCenterBore.length}`);
    for (const k of Object.keys(S)) if (S[k].length) console.log(`  ${k}: ${S[k].join("; ")}`);
    console.log(`bolt conflicts (${plan.boltConflicts.length}): ${plan.boltConflicts.map(b => `${b.ymm} ours=${b.ours} -> TG=${b.tg}`).join("; ") || "none"}`);
    if (plan.notes.length) console.log(`notes:\n  ${plan.notes.join("\n  ")}`);
    fs.writeFileSync(APPLY ? PLAN_JSON : PLAN_JSON.replace(/\.json$/, ".dryrun.json"), JSON.stringify(plan, null, 1));
    if (APPLY) {
      plan.verify = await verify(plan.reconciled);
      console.log("\nVERIFY:\n" + plan.verify.lines.join("\n"));
      fs.writeFileSync(PLAN_JSON, JSON.stringify(plan, null, 1));
      writeReport(plan);
      console.log(`report written: ${REPORT_MD}`);
    }
  }
} catch (e) { try { await c.query("ROLLBACK"); } catch {} console.error("ROLLED BACK:", e); process.exitCode = 1; }
finally { c.release(); await pool.end(); }

function writeReport(plan) {
  const S = plan.skipped;
  const li = arr => arr.length ? arr.map(x => `- ${x}`).join("\n") : "- (none)";
  const md = `# Tire Guide Pro reconcile — ${plan.runDate}

Script: \`scripts/audit/pass3/tireguide/reconcile-tg.mjs\` (plan: \`reconcile-plan-${plan.runDate}.json\`). Source: Tire Guide Pro prints scraped to
\`scripts/audit/pass3/tireguide/out/<year>/<make>/<model>.json\` (${plan.reconciled.length + Object.values(S).reduce((a, b) => a + b.length, 0)} files). Tire Guide Pro is the authoritative OE source (HIGH).

## Totals
| metric | count |
|---|---|
| Y/M/M reconciled | ${plan.totals.ymm} |
| rows inserted (wheel_specs_source=tireguide-pro, HIGH, last_modified_by=${WHO}) | ${plan.totals.inserted} |
| old live rows quarantined (last_modified_by=${WHO}) | ${plan.totals.quarantined} |
| quarantined rows whose modification_id got the \`${ID_SUFFIX}\` suffix (to free the clean id for the TG row) | ${plan.totals.idSuffixed} |

## Skipped
- empties / no parseable options (${S.empty.length}): ${S.empty.join("; ") || "none"}
- already tireguide-pro (${S.alreadyTireguide.length}): ${S.alreadyTireguide.join("; ") || "none"}
- no catalog_models entry (${S.noCatalog.length}): ${S.noCatalog.join("; ") || "none"}
- TG print model ≠ our model (picker overshoot; ${S.modelMismatch.length}): ${S.modelMismatch.join("; ") || "none"}
- no offset source (${S.noOffset.length}): ${S.noOffset.join("; ") || "none"}
- no center-bore source (${S.noCenterBore.length}): ${S.noCenterBore.join("; ") || "none"}

## Bolt pattern conflicts (TG wins)
${plan.boltConflicts.length ? "| Y/M/M | ours | Tire Guide Pro |\n|---|---|---|\n" + plan.boltConflicts.map(b => `| ${b.ymm} | ${b.ours} | ${b.tg} |`).join("\n") : "- (none)"}

## Notes
${li(plan.notes)}

## Reconciled Y/M/M
${plan.reconciled.map(r => `### ${r.year} ${r.make} ${r.model} — TG "${r.tg}"
old: ${r.oldRows} rows (${r.oldBolt.join("/") || "-"}) [${r.oldTrims.join("; ")}] → quarantined ${r.quarantined}, inserted ${r.inserted}; offset/CB carry: ${r.carryLevel}
${r.rows.map(x => `- **${x.display}** — ${x.wheels.join(" ")} | ${x.tires.join(" ")} | ${x.bolt} cb=${x.cb} off=${x.offset[0]}..${x.offset[1]} | ${x.carry}${x.boltNote ? " | " + x.boltNote : ""} | \`${x.id}\``).join("\n")}`).join("\n\n")}

## Verification (DB)
${li(plan.verify?.lines || [])}

## Live verification (storefront)
_(filled in after apply — see below)_

## Rollback
\`\`\`sql
-- 1. pull the TG rows
update vehicle_fitments set quarantined_at = now(), last_modified_reason = last_modified_reason || ' [ROLLED BACK]'
 where last_modified_by = '${WHO}' and wheel_specs_source = '${SRC}' and quarantined_at is null;
-- 2. restore the old rows (and their original modification_id where it was suffixed)
update vehicle_fitments set quarantined_at = null, modification_id = regexp_replace(modification_id, '${ID_SUFFIX.replace("~", "\\~")}$', '')
 where last_modified_by = '${WHO}' and last_modified_reason like 'replaced by Tire Guide Pro%';
-- 3. any row suffixed that had been quarantined by an earlier pass (not stamped by us):
update vehicle_fitments set modification_id = regexp_replace(modification_id, '${ID_SUFFIX.replace("~", "\\~")}$', '') where modification_id like '%${ID_SUFFIX}';
\`\`\`
Original field values of every quarantined row are preserved in \`audit_original_data\` (COALESCE — first snapshot wins).
`;
  fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
  fs.writeFileSync(REPORT_MD, md);
}
