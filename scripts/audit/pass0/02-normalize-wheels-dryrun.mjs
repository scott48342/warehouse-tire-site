// Pass 0 — propose ONE canonical shape for oem_wheel_sizes / oem_tire_sizes and dry-run the conversion of every active row.
//
//   node --env-file=.env.local scripts/audit/pass0/02-normalize-wheels-dryrun.mjs            # DRY RUN (default): writes nothing to vehicle_fitments
//   node --env-file=.env.local scripts/audit/pass0/02-normalize-wheels-dryrun.mjs --apply    # PARENT ONLY — rewrites oem_wheel_sizes/oem_tire_sizes on convertible rows
//
// CANONICAL SHAPES
//   oem_wheel_sizes : [{ axle:'square'|'front'|'rear', diameter:number, width:number|null, offset:number|null, tireSize:string|null, isStock:boolean }]
//   oem_tire_sizes  : ["245/40R19", ...]   (unique, flat; staggered front/rear lives on wheels[].tireSize)
//   Deviation from the brief: isStock is KEPT. /api/wheels/fitment-search picks the stock spec via `isStock !== false`, and 640
//   double-encoded rows carry plus-size options with isStock:false that would otherwise be promoted to OE.
//   Deviation #2: axle 'square' (per brief) instead of the 'both' the readers emit today. Readers that compare `axle === "both"`
//   (fitment-search route.ts:275, vehicleFitment.ts:563, public-fitment-service.ts:219, geometryValidator.ts:206) need a one-line
//   alias `axle === "both" || axle === "square"` BEFORE --apply runs. Listed in pass0-structural.md.
//
// --apply semantics (parent runs it): single transaction; only rows whose conversion has NO blocking issue; snapshots the original
// row into audit_original_data (first time only); stamps last_modified_by/reason; skips rows already in canonical form.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, ACTIVE, normalizeWheels, normalizeTires, parseTireSize, attachStaggeredTires, shapeOfWheels } from "./_lib.mjs";

const APPLY = process.argv.includes("--apply");
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
fs.mkdirSync(OUT_DIR, { recursive: true });
const WHO = "audit-pass0-normalize";
const WHY = "Pass 0 canonical oem_wheel_sizes/oem_tire_sizes normalization (scripts/audit/pass0/02-normalize-wheels-dryrun.mjs)";
const BLOCKING = new Set(["string_unparseable", "size_unparseable", "unknown_object_shape", "bad_diameter", "bad_element", "not_array_after_unwrap"]);

const p = pool();
const c = await p.connect();
const q = async (s, a = []) => (await c.query(s, a)).rows;

// A row is already canonical if it is an array of objects with exactly the canonical keys, axle in the canonical set, and tires a flat array of strings.
function isCanonical(wheels, tires) {
  if (!Array.isArray(wheels) || !Array.isArray(tires)) return false;
  if (!tires.every((t) => typeof t === "string")) return false;
  const KEYS = ["axle", "diameter", "isStock", "offset", "tireSize", "width"];
  return wheels.every((w) => w && typeof w === "object" && JSON.stringify(Object.keys(w).sort()) === JSON.stringify(KEYS) && ["square", "front", "rear"].includes(w.axle) && typeof w.diameter === "number");
}

function convertRow(r) {
  const w = normalizeWheels(r.oem_wheel_sizes);
  const t = normalizeTires(r.oem_tire_sizes);
  let entries = attachStaggeredTires(w.entries, t.staggeredObj);
  // tires that carry an axle suffix ("245/40R19 front") → attach to matching wheel, strip suffix from the flat list
  const tires = [];
  for (const s of t.tires) {
    const pt = parseTireSize(s);
    const clean = pt.norm ?? s;
    if (pt.axle) {
      entries = entries.map((e) => (e.axle === pt.axle && e.diameter === pt.rim && !e.tireSize ? { ...e, tireSize: clean } : e));
    }
    if (!tires.includes(clean)) tires.push(clean);
  }
  // single flat tire per diameter → attach to square wheel of that diameter (cheap, lossless)
  const byRim = new Map();
  for (const s of tires) { const rim = parseTireSize(s).rim; if (rim != null) byRim.set(rim, [...(byRim.get(rim) || []), s]); }
  entries = entries.map((e) => (e.tireSize || e.axle !== "square" ? e : byRim.get(e.diameter)?.length === 1 ? { ...e, tireSize: byRim.get(e.diameter)[0] } : e));
  const blocking = w.issues.filter((i) => BLOCKING.has(i));
  const tireBlocking = t.tires.length > 0 && tires.length === 0;
  return { shape: w.shape + (w.innerShape ? `→${w.innerShape}` : ""), tireShape: t.shape, entries, tires, issues: w.issues, unparsed: w.unparsed, dropped: w.dropped,
    convertible: blocking.length === 0 && !tireBlocking && (entries.length > 0 || w.shape === "empty" || w.shape === "null"), blocking: [...blocking, ...(tireBlocking ? ["tires_unconvertible"] : [])] };
}

try {
  const rows = await q(`SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes FROM vehicle_fitments WHERE ${ACTIVE} ORDER BY make, model, year`);
  const perShape = new Map();
  const examples = new Map();
  const failures = [];
  const plan = [];
  let alreadyCanonical = 0, tireShapeCounts = {};
  for (const r of rows) {
    if (isCanonical(r.oem_wheel_sizes, r.oem_tire_sizes)) { alreadyCanonical++; }
    const cv = convertRow(r);
    tireShapeCounts[cv.tireShape] = (tireShapeCounts[cv.tireShape] || 0) + 1;
    const s = perShape.get(cv.shape) || { shape: cv.shape, rows: 0, convertible: 0, blocked: 0, entries_out: 0, dropped_keys: 0 };
    s.rows++; cv.convertible ? s.convertible++ : s.blocked++; s.entries_out += cv.entries.length; s.dropped_keys += cv.dropped.length;
    perShape.set(cv.shape, s);
    const ex = examples.get(cv.shape) || [];
    if (ex.length < 3 && cv.convertible) ex.push({ id: r.id, vehicle: `${r.year} ${r.make} ${r.model} ${r.display_trim ?? ""}`.trim(), before: { wheels: r.oem_wheel_sizes, tires: r.oem_tire_sizes }, after: { wheels: cv.entries, tires: cv.tires } });
    examples.set(cv.shape, ex);
    if (!cv.convertible) failures.push({ id: r.id, vehicle: `${r.year} ${r.make} ${r.model} ${r.display_trim ?? ""}`.trim(), shape: cv.shape, blocking: cv.blocking, raw: r.oem_wheel_sizes, tires: r.oem_tire_sizes });
    else if (!isCanonical(r.oem_wheel_sizes, r.oem_tire_sizes)) plan.push({ id: r.id, wheels: cv.entries, tires: cv.tires });
  }

  const shapeRows = [...perShape.values()].sort((a, b) => b.rows - a.rows);
  console.log(`\n=== ${APPLY ? "APPLY" : "DRY RUN"} — canonical wheel/tire normalization over ${rows.length} active rows ===`);
  console.log(`already canonical: ${alreadyCanonical} | would rewrite: ${plan.length} | cannot convert: ${failures.length}`);
  console.log("\n--- per-shape conversion counts (shape = raw shape; 'not-array:string→X' = double-encoded, X after decode) ---");
  const w = ["shape", "rows", "convertible", "blocked", "entries_out", "dropped_keys"];
  const pad = w.map((k) => Math.max(k.length, ...shapeRows.map((s) => String(s[k]).length)));
  console.log(w.map((k, i) => k.padEnd(pad[i])).join(" | "));
  for (const s of shapeRows) console.log(w.map((k, i) => String(s[k]).padEnd(pad[i])).join(" | "));
  console.log("\n--- tire shape counts ---");
  console.log(Object.entries(tireShapeCounts).map(([k, v]) => `${k}: ${v}`).join(" | "));

  console.log("\n--- 3 before/after examples per shape ---");
  for (const s of shapeRows) {
    console.log(`\n## ${s.shape}`);
    for (const e of examples.get(s.shape) || []) {
      console.log(`  ${e.vehicle}  [${e.id}]`);
      console.log(`    before wheels: ${JSON.stringify(e.before.wheels)}`);
      console.log(`    before tires : ${JSON.stringify(e.before.tires)}`);
      console.log(`    after  wheels: ${JSON.stringify(e.after.wheels)}`);
      console.log(`    after  tires : ${JSON.stringify(e.after.tires)}`);
    }
  }
  console.log(`\n--- rows that CANNOT be converted (${failures.length}) ---`);
  const byBlock = {};
  for (const f of failures) for (const b of f.blocking) byBlock[b] = (byBlock[b] || 0) + 1;
  console.log(Object.entries(byBlock).map(([k, v]) => `${k}: ${v}`).join(" | "));
  for (const f of failures.slice(0, 25)) console.log(`  ${f.vehicle} [${f.id}] ${f.shape} ${f.blocking.join(",")} raw=${JSON.stringify(f.raw).slice(0, 160)}`);
  if (failures.length > 25) console.log(`  … ${failures.length - 25} more in out/normalize-failures.json`);

  fs.writeFileSync(path.join(OUT_DIR, "normalize-dryrun.json"), JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, alreadyCanonical, wouldRewrite: plan.length, cannotConvert: failures.length, perShape: shapeRows, tireShapeCounts, examples: Object.fromEntries(examples), byBlock }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "normalize-failures.json"), JSON.stringify(failures, null, 2));
  console.log(`\nwrote out/normalize-dryrun.json, out/normalize-failures.json`);

  if (APPLY) {
    console.log(`\nAPPLYING to ${plan.length} rows (single transaction)…`);
    await c.query("BEGIN");
    let n = 0;
    for (const row of plan) {
      await c.query(`UPDATE vehicle_fitments SET oem_wheel_sizes = $2::jsonb, oem_tire_sizes = $3::jsonb,
          last_modified_by = $4, last_modified_reason = $5, updated_at = now(),
          audit_original_data = COALESCE(audit_original_data, to_jsonb(vehicle_fitments) - 'audit_original_data')
        WHERE id = $1 AND ${ACTIVE}`, [row.id, JSON.stringify(row.wheels), JSON.stringify(row.tires), WHO, WHY]);
      n++;
    }
    await c.query("COMMIT");
    console.log(`COMMITTED ${n} rows.`);
  } else {
    console.log("\nDRY RUN — nothing written to vehicle_fitments. Parent re-runs with --apply after reviewing pass0-structural.md.");
  }
} catch (e) {
  try { await c.query("ROLLBACK"); } catch {}
  console.error("FAILED:", e);
  process.exitCode = 1;
} finally {
  c.release();
  await p.end();
}
