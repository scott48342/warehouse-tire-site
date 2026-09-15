// Pass 3 â€” fix generation-boundary bolt-pattern errors surfaced by the roadkill cross-reference (tight-range disagreements).
// Each fix = one nameplate + year range where OUR rows carry a neighbouring generation's bolt pattern.
// Evidence per fix: roadkill xref (tight range) agrees with the corrected value + platform/generation knowledge.
// Confidence MEDIUM; the Tire Guide Pro pass re-verifies these Y/M/M to HIGH.
//   node --env-file=.env.local scripts/audit/pass3/roadkill/04-fix-bolt-nameplates.mjs          # dry run
//   node --env-file=.env.local scripts/audit/pass3/roadkill/04-fix-bolt-nameplates.mjs --apply
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const WHO = "audit-pass3-bolt-fix";
const SRC = "audit-pass3-bolt-fix";

// set: bolt (required), cb (optional), th (optional). where: extra SQL on alias v (optional).
const FIXES = [
  { mk: "honda", md: "pilot", y1: 2003, y2: 2008, set: { bolt: "5x114.3", cb: 64.1, th: "M12x1.5" }, note: "1st-gen Pilot (YF1) 2003-08 = 5x114.3; 5x120 begins 2009 (YF3/YF4)" },
  { mk: "nissan", md: "xterra", y1: 2000, y2: 2004, set: { bolt: "6x139.7", cb: 100.0, th: "M12x1.25" }, note: "1st-gen Xterra (WD22, Frontier D22 platform) = 6x139.7; 6x114.3 begins 2005 (N50)" },
  { mk: "scion", md: "tc", y1: 2005, y2: 2010, set: { bolt: "5x100", cb: 54.1, th: "M12x1.5" }, note: "1st-gen tC (ANT10, Avensis platform) = 5x100; 5x114.3 begins 2011 (AGT20)" },
  { mk: "subaru", md: "impreza", y1: 2000, y2: 2016, set: { bolt: "5x100", cb: 56.1, th: "M12x1.25" }, note: "Impreza GD/GE/GH/GJ/GP 2000-16 = 5x100; 5x114.3 begins 2017 (GK/GT)" },
  { mk: "subaru", md: "wrx", y1: 2005, y2: 2014, where: "v.display_trim ILIKE '%STI%'", set: { bolt: "5x114.3", cb: 56.1, th: "M12x1.25" }, note: "WRX STI 2005+ = 5x114.3 (Brembo hubs); 2004 STI was 5x100" },
  { mk: "subaru", md: "wrx", y1: 2002, y2: 2014, where: "v.display_trim NOT ILIKE '%STI%'", set: { bolt: "5x100", cb: 56.1, th: "M12x1.25" }, note: "non-STI WRX 2002-14 = 5x100; 5x114.3 begins 2015 (VA)" },
  { mk: "acura", md: "tl", y1: 2004, y2: 2008, set: { bolt: "5x114.3", cb: 64.1, th: "M12x1.5" }, note: "3rd-gen TL (UA6/UA7) incl. Type-S = 5x114.3; 5x120 begins 2009 (UA8/UA9)" },
  { mk: "toyota", md: "corolla", y1: 1998, y2: 2002, set: { bolt: "4x100", cb: 54.1, th: "M12x1.5" }, note: "8th-gen Corolla (E110) = 4x100; 5x100 begins 2003 (E120/E130)" },
  { mk: "toyota", md: "sequoia", y1: 2001, y2: 2007, set: { bolt: "6x139.7", cb: 106.1, th: "M12x1.5" }, note: "1st-gen Sequoia (Tundra platform) = 6x139.7; 5x150 begins 2008" },
  { mk: "nissan", md: "altima", y1: 2000, y2: 2001, set: { bolt: "4x114.3", cb: 66.1, th: "M12x1.25" }, note: "2nd-gen Altima (L30) 1998-2001 = 4x114.3; 5x114.3 begins 2002 (L31)" },
  { mk: "toyota", md: "rav4", y1: 1996, y2: 2000, set: { bolt: "5x114.3", cb: 60.1, th: "M12x1.5" }, note: "1st-gen RAV4 (XA10) = 5x114.3 (never 5x100)" },
  { mk: "chrysler", md: "pt-cruiser", y1: 2001, y2: 2010, set: { bolt: "5x100", cb: 57.1, th: "M12x1.5" }, note: "PT Cruiser (Neon PL platform) = 5x100 all years" },
  { mk: "volkswagen", md: "beetle", y1: 2000, y2: 2010, set: { bolt: "5x100", cb: 57.1, th: "M14x1.5" }, note: "New Beetle (A4/PQ34 platform) 1998-2010 = 5x100; 5x112 begins 2012 (A5)" },
  { mk: "lincoln", md: "ls", y1: 2000, y2: 2006, set: { bolt: "5x108", cb: 63.4, th: "M12x1.5" }, note: "Lincoln LS (DEW98, shares Jaguar S-Type) = 5x108" },
  { mk: "ford", md: "e-350-econoline", y1: 2009, y2: 2014, set: { bolt: "8x170", cb: 124.9, th: "M14x2.0" }, note: "2008+ E-Series refresh moved to Super Duty 8x170 hubs; roadkill tight range 2009-14 (2008 left for TG)" },
  { mk: "lexus", md: "lx", y1: 1996, y2: 1997, set: { bolt: "6x139.7", th: "M14x1.5" }, note: "LX 450 = Land Cruiser 80-series = 6x139.7; 5x150 begins 1998 (LX 470)" },
  { mk: "acura", md: "rl", y1: 2000, y2: 2004, set: { bolt: "5x114.3", cb: 64.1, th: "M12x1.5" }, note: "1st-gen RL (KA9) 1996-2004 = 5x114.3; 5x120 begins 2005 (KB1)" },
  { mk: "buick", md: "enclave", y1: 2008, y2: 2010, set: { bolt: "6x132", cb: 77.8, th: "M14x1.5" }, note: "Lambda platform (Enclave/Acadia/Traverse) = 6x132 / 77.8" },
  { mk: "kia", md: "sedona", y1: 2006, y2: 2012, set: { bolt: "5x114.3", cb: 67.1, th: "M12x1.5" }, note: "2nd-gen Sedona (VQ) = 5x114.3; 6x139.7/92.3 is the Sorento BL pattern (import mix-up)" },
  { mk: "honda", md: "accord", y1: 1990, y2: 1993, set: { bolt: "4x114.3", cb: 64.1, th: "M12x1.5" }, note: "4th-gen Accord (CB) = 4x114.3; 5x114.3 begins with V6 1995 / all 1998+" },
  { mk: "dodge", md: "caravan", y1: 1991, y2: 1995, set: { bolt: "5x100", cb: 57.1, th: "M12x1.5" }, note: "AS-body minivans 1991-95 = 5x100 (matches our Grand Caravan/Voyager rows); 5x114.3 begins 1996 (NS)" },
  { mk: "cadillac", md: "cts", y1: 2003, y2: 2007, set: { bolt: "5x115", cb: 70.3, th: "M12x1.5" }, note: "1st-gen CTS (Sigma I) = 5x115 / 70.3; 5x120 begins 2008 (Sigma II)" },
  { mk: "kia", md: "optima", y1: 2001, y2: 2005, set: { bolt: "4x114.3", cb: 67.1, th: "M12x1.5" }, note: "1st-gen Optima (MS) 2001-06 = 4x114.3; 5x114.3 begins 2006.5 (MG). MY2006 left as-is (split year)" },
  { mk: "jaguar", md: "xj", y1: 2000, y2: 2003, set: { bolt: "5x120.65", th: "M12x1.5" }, note: "X308 XJ8 = 5x120.65 (5x4.75in), not 5x120; 5x108 begins 2004 (X350)" },
  { mk: "saturn", md: "ion", y1: 2003, y2: 2007, set: { bolt: "5x110", cb: 65.1, th: "M12x1.5" }, note: "Ion (Delta platform, shares Cobalt) = 5x110 / 65.1; 5x115 is the L-Series/Vue pattern" },
  { mk: "toyota", md: "prius", y1: 2003, y2: 2003, set: { bolt: "4x100", cb: 54.1, th: "M12x1.5" }, note: "MY2003 is still 1st-gen Prius (NHW11) = 4x100; 5x100 begins 2004 (NHW20)" },
  { mk: "toyota", md: "prius", y1: 2004, y2: 2015, set: { bolt: "5x100", cb: 54.1, th: "M12x1.5" }, note: "2nd/3rd-gen Prius (NHW20/ZVW30) = 5x100 (some rows carried 5x114.3)" },
  { mk: "dodge", md: "durango", y1: 2004, y2: 2009, set: { bolt: "5x139.7", cb: 77.8, th: "M14x1.5" }, note: "2nd-gen Durango (HB, Ram 1500 platform) = 5x139.7 / 77.8; 5x127 begins 2011 (WD, Grand Cherokee platform)" },
  { mk: "mercury", md: "cougar", y1: 1989, y2: 1997, set: { bolt: "5x108", cb: 70.5 }, note: "MN12 Cougar (Thunderbird twin) = 5x108" },
  { mk: "mercury", md: "cougar", y1: 1999, y2: 2002, set: { bolt: "4x108", cb: 63.4 }, note: "8th-gen Cougar (Contour/Mondeo CDW27 platform) = 4x108" },
];

// Duplicate rows carrying an impossible pattern for the nameplate (a correct row for the same Y/M/M/trim already exists).
const QUARANTINE = [
  { mk: "ford", md: "f-450-super-duty", y1: 2000, y2: 2014, where: "v.bolt_pattern = '5x114.3'", note: "5x114.3 (passenger-car pattern) duplicate 'Base' rows on a Super Duty; 8x170 row exists for same year" },
  { mk: "chrysler", md: "pt-cruiser", y1: 2001, y2: 2010, where: "v.bolt_pattern = '5x115' AND v.source = 'catalog-gap-fill'", note: "duplicate 'Base' row with 5x115/71.5 (never a PT Cruiser pattern); 5x100 verified-research row exists" },
  { mk: "honda", md: "pilot", y1: 2003, y2: 2008, where: "v.display_trim IN ('Elite','TrailSport','Touring') AND v.source LIKE 'cache-import%'", note: "phantom trims on 1st-gen Pilot (Touring 2009+, Elite 2016+, TrailSport 2022+) carrying 2nd-gen 5x120" },
  { mk: "acura", md: "tl", y1: 2000, y2: 2008, where: "v.display_trim IN ('SH-AWD','Advance','Technology') AND v.source LIKE 'cache-import%'", note: "phantom trims on 2nd/3rd-gen TL (SH-AWD/Tech/Advance are 2009+ UA8 packages) carrying 4th-gen 5x120" },
];

const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const c = await p.connect();
const q = async (s, a = []) => (await c.query(s, a)).rows;
const STAMP = `last_modified_by = $1, last_modified_reason = $2, updated_at = now(),
  audit_original_data = COALESCE(v.audit_original_data, to_jsonb(v) - 'audit_original_data')`;
let totalFix = 0, totalQ = 0;
try {
  await c.query("BEGIN");
  for (const qq of QUARANTINE) {
    const where = `v.make = $3 AND v.model = $4 AND v.year BETWEEN $5 AND $6 AND v.quarantined_at IS NULL AND ${qq.where}`;
    const pre = await q(`SELECT v.year, v.bolt_pattern, v.display_trim, v.source FROM vehicle_fitments v WHERE ${where} AND $1::text IS NOT NULL AND $2::text IS NOT NULL`, [WHO, "", qq.mk, qq.md, qq.y1, qq.y2]);
    console.log(`QUARANTINE ${qq.mk} ${qq.md} ${qq.y1}-${qq.y2} [${qq.where}]: ${pre.length} rows  e.g. ${pre.slice(0, 3).map(r => `${r.year} ${r.display_trim} ${r.bolt_pattern} [${r.source}]`).join(" | ")}`);
    totalQ += pre.length;
    if (!APPLY || !pre.length) continue;
    const r = await q(`UPDATE vehicle_fitments v SET quarantined_at = now(), ${STAMP} WHERE ${where} RETURNING v.id`, [WHO, `quarantine: ${qq.note}`, qq.mk, qq.md, qq.y1, qq.y2]);
    console.log(`   quarantined ${r.length}`);
  }
  console.log("");
  for (const f of FIXES) {
    // params: $1 who, $2 reason, $3 make, $4 model, $5 y1, $6 y2, $7 bolt, [$8 cb], [$9|$8 th]
    const params = [WHO, null, f.mk, f.md, f.y1, f.y2, f.set.bolt];
    const sets = [`bolt_pattern = $7`];
    const diff = [`v.bolt_pattern IS DISTINCT FROM $7`];
    let i = 8;
    if (f.set.cb != null) { sets.push(`center_bore_mm = $${i}`); diff.push(`v.center_bore_mm IS DISTINCT FROM $${i}::numeric`); params.push(f.set.cb); i++; }
    if (f.set.th) { sets.push(`thread_size = $${i}`); diff.push(`v.thread_size IS DISTINCT FROM $${i}`); params.push(f.set.th); i++; }
    sets.push(`wheel_specs_verified_at = now(), wheel_specs_source = '${SRC}', wheel_specs_confidence = 'MEDIUM'`);
    params[1] = `bolt fix: ${f.note}. prior values in audit_original_data. roadkill xref agrees (tight range); pending Tire Guide Pro verification`;
    const where = `v.make = $3 AND v.model = $4 AND v.year BETWEEN $5 AND $6 AND v.quarantined_at IS NULL ${f.where ? "AND " + f.where : ""} AND (${diff.join(" OR ")})`;
    const pre = await q(`SELECT v.year, v.bolt_pattern, v.center_bore_mm, v.thread_size, v.display_trim, v.source FROM vehicle_fitments v WHERE ${where} AND $1::text IS NOT NULL AND $2::text IS NOT NULL`, params);
    const bolts = {}; for (const r of pre) bolts[`${r.bolt_pattern}/${r.center_bore_mm}/${r.thread_size}`] = (bolts[`${r.bolt_pattern}/${r.center_bore_mm}/${r.thread_size}`] || 0) + 1;
    console.log(`${f.mk} ${f.md} ${f.y1}-${f.y2}${f.where ? " [" + f.where + "]" : ""} -> ${f.set.bolt}${f.set.cb != null ? " / " + f.set.cb : ""}${f.set.th ? " / " + f.set.th : ""}: ${pre.length} rows change  from ${JSON.stringify(bolts)}`);
    totalFix += pre.length;
    if (!APPLY || !pre.length) continue;
    const r = await q(`UPDATE vehicle_fitments v SET ${sets.join(", ")}, ${STAMP} WHERE ${where} RETURNING v.id`, params);
    console.log(`   applied ${r.length}`);
  }
  console.log(`\nTOTAL: ${totalFix} rows fixed, ${totalQ} rows quarantined`);
  if (APPLY) { await c.query("COMMIT"); console.log("COMMITTED"); } else { await c.query("ROLLBACK"); console.log("DRY RUN - nothing written. Re-run with --apply."); }
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { c.release(); await p.end(); }

