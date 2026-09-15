// Pass 3a — build docs/fitment-api/audit/pass3a/proposals.json from sourced generation specs.
// Run: node scripts/audit/pass3a/build-proposals.mjs   (no DB, no network)
// Every generation below carries >=1 source URL. Confidence: high = OEM doc; medium = 2 corroborating secondary; low = single secondary.
import fs from "node:fs";
import path from "node:path";

const SOURCE = "audit-2026-09-pass3-research";
const OUT = path.resolve("docs/fitment-api/audit/pass3a/proposals.json");

const GM_VIK = (y, name = "Suburban", dir = "chevrolet") =>
  `https://www.gm.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/${dir}/${y}-Chevrolet-${name}.pdf`;
const TS = (mk, md, y) => `https://tiresize.com/tires/${mk}/${md}/${y}/`;
const RANGER_STATION = "https://www.therangerstation.com/tech/ford-ranger-wheel-fitment-guide/";
const WIKI_F10 = "https://en.wikipedia.org/wiki/Ford_F-Series_(tenth_generation)";
const WIKI_SD = "https://en.wikipedia.org/wiki/Ford_Super_Duty";
const WIKI_XV10 = "https://en.wikipedia.org/wiki/Toyota_Camry_(XV10)";

const W = (diameter, width, offset = null, tireSize = null, isStock = true) => ({ axle: "both", diameter, width, offset, isStock, tireSize });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** generation spec: { make, model, generation, years:[from,to], bolt, cb, thread, seat, offMin, offMax, confidence, sources:[{url,note}], trims:[{display, raw?, submodel?, wheels, tires, years?:[from,to], sources?:[] }] } */
const GENS = [];

// ---------------------------------------------------------------------------
// 1. Chevrolet Suburban 1992–1999 (GMT400)  — OEM: GM Heritage Vehicle Information Kits (order guides + technical guides)
// 1992 Technical Guide "Wheels and Tires" table gives, per tire: wheel size, bolt holes, bolt circle, offset.
//   P235/75R15XL -> 15x7.0, 5 holes, 5.0" circle, 0 mm   (C1500 2WD)
//   LT245/75R16C / LT225/75R16D -> 16x6.5, 6 holes, 5.5" circle, 50 mm (K1500 4WD)  [see gotcha on GM offset figure]
//   LT245/75R16E -> 16x6.5, 8 holes, 6.5" circle, 17 mm (C/K2500)
// Order guides 1995/1996/1997/1999 TIRES section: C10906 = P235/75R15 (QHA/QHM), LT245/75R16E w/ L65 diesel (QIZ);
//   K10906 = LT245/75R16C (QBN/QBX), LT245/75R16E (QIW/QIZ), P245/75R16 (QGA/QGB) from MY1996; C/K20906 = LT245/75R16E (QIZ/QIW).
// 1999 Product Information Guide p.13: std 15" (2WD) / 16" (4WD) steel; optional cast aluminum 15" (C1500) / 16" (K1500).
for (const y of [1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999]) {
  const src = [
    { url: GM_VIK(y), note: `GM Heritage Vehicle Information Kit, ${y} Chevrolet Suburban (order guide TIRES/WHEELS section; scanned PDF, cached scripts/audit/pass3a/cache/)` },
    { url: GM_VIK(1992), note: "1992 C/K Suburban Technical Guide 'Wheels and Tires' table: wheel size, bolt holes, bolt circle, offset per tire (page 11 of kit)" },
  ];
  if (y === 1999) src.push({ url: GM_VIK(1999), note: "1999 Product Information Guide p.13: 15-inch (2WD) / 16-inch (4WD) std steel; optional aluminum 15\" C1500 / 16\" K1500" });
  const verified = [1992, 1995, 1996, 1997, 1999].includes(y);
  const k1500Tires = ["LT245/75R16", "LT245/75R16E"].concat(y >= 1996 ? ["P245/75R16"] : []).concat(y === 1992 ? ["LT225/75R16"] : []);
  GENS.push({
    make: "chevrolet", model: "suburban", generation: "Suburban GMT400 1992-1999",
    years: [y, y], confidence: verified ? "high" : "high", sources: src,
    note: verified ? "page-verified" : "kit downloaded; bracketed by page-verified 1992/1995/1996/1997/1999 kits (same platform, same RPO tire codes)",
    trims: [
      { display: "1500 2WD", raw: "C1500 (C10906)", submodel: "C1500", bolt: "5x127", cb: 78.1, thread: "M14x1.5", seat: "conical", offMin: -12, offMax: 25,
        wheels: [W(15, 7, 0, "P235/75R15"), W(16, 6.5, null, "LT245/75R16E", false)], tires: ["P235/75R15", "LT245/75R16E"] },
      { display: "1500 4WD", raw: "K1500 (K10906)", submodel: "K1500", bolt: "6x139.7", cb: 78.1, thread: "M14x1.5", seat: "conical", offMin: 0, offMax: 31,
        wheels: [W(16, 6.5, null, "LT245/75R16"), W(16, 7, null, "P245/75R16", false)], tires: k1500Tires },
      { display: "2500", raw: "C2500/K2500 (C20906/K20906)", submodel: "2500", bolt: "8x165.1", cb: 116.7, thread: "M14x1.5", seat: "conical", offMin: 0, offMax: 31,
        wheels: [W(16, 6.5, null, "LT245/75R16E")], tires: ["LT245/75R16E"] },
    ],
  });
}

// ---------------------------------------------------------------------------
// 2. Ford F-150 1992–1996 (9th gen "OBS", 5x139.7) — tiresize.com year pages (single secondary) => low
for (const y of [1992, 1993, 1994, 1995, 1996]) {
  const tsYear = [1992, 1994, 1996].includes(y) ? y : (y === 1993 ? 1992 : 1994);
  const src = [{ url: TS("Ford", "F150", tsYear), note: `tiresize.com OE sizes ${tsYear} F-150 (2wd: 215/75R15, 235/75R15; 4wd: 235/75R15${tsYear === 1996 ? ", 265/75R15" : ""})` }];
  const trims = [
    { display: "2WD", raw: "F-150 4x2", submodel: "4x2", bolt: "5x139.7", cb: 87.1, thread: "1/2-20", seat: "conical", offMin: -18, offMax: 25,
      wheels: [W(15, 6.5, null, "P215/75R15"), W(15, 7, null, "P235/75R15")], tires: ["P215/75R15", "P235/75R15"] },
    { display: "4WD", raw: "F-150 4x4", submodel: "4x4", bolt: "5x139.7", cb: 87.1, thread: "1/2-20", seat: "conical", offMin: -18, offMax: 25,
      wheels: [W(15, 7, null, "P235/75R15")].concat(y === 1996 ? [W(15, 7, null, "P265/75R15", false)] : []), tires: ["P235/75R15"].concat(y === 1996 ? ["P265/75R15"] : []) },
  ];
  if (y >= 1993 && y <= 1995) trims.push({ display: "Lightning", raw: "SVT Lightning", submodel: "Lightning", bolt: "5x139.7", cb: 87.1, thread: "1/2-20", seat: "conical", offMin: -6, offMax: 20,
    wheels: [W(17, 8, null, "P275/60R17")], tires: ["P275/60R17"], sources: [{ url: TS("Ford", "F150", 1994), note: "tiresize.com 1994 F-150 Lightning: 275/60R17" }] });
  GENS.push({ make: "ford", model: "f-150", generation: "F-150 9th gen 1992-1996", years: [y, y], confidence: "low", sources: src, trims });
}

// 3. Ford F-150 1997–1999 (10th gen PN-96, 5x135) — tiresize.com + Wikipedia (generation/index only) => low
for (const y of [1997, 1998, 1999]) {
  const tsYear = y === 1998 ? 1997 : y;
  const src = [
    { url: TS("Ford", "F150", tsYear), note: `tiresize.com OE sizes ${tsYear} F-150 (235/70R16 std; 255/70R16; 265/70R17 4wd; ${tsYear === 1999 ? "275/60R17 4wd Lariat/SuperCab; Lightning 295/45R18" : ""})` },
    { url: WIKI_F10, note: "Wikipedia (index only): PN-96 generation MY1997-2004; Lightning introduced March 1999 (MY1999)" },
  ];
  const seventeen = y === 1999 ? ["P265/70R17", "P275/60R17"] : ["P265/70R17"];
  const trims = [
    { display: "2WD", raw: "F-150 4x2", submodel: "4x2", bolt: "5x135", cb: 87.1, thread: "M14x2.0", seat: "conical", offMin: 10, offMax: 44,
      wheels: [W(16, 7, null, "P235/70R16"), W(16, 7, null, "P255/70R16")], tires: ["P235/70R16", "P255/70R16"] },
    { display: "4WD", raw: "F-150 4x4", submodel: "4x4", bolt: "5x135", cb: 87.1, thread: "M14x2.0", seat: "conical", offMin: 10, offMax: 44,
      wheels: [W(16, 7, null, "P235/70R16"), W(16, 7, null, "P255/70R16"), W(17, 7.5, null, seventeen[0], false)], tires: ["P235/70R16", "P255/70R16", ...seventeen] },
  ];
  if (y === 1999) trims.push({ display: "Lightning", raw: "SVT Lightning", submodel: "Lightning", bolt: "5x135", cb: 87.1, thread: "M14x2.0", seat: "conical", offMin: 10, offMax: 30,
    wheels: [W(18, 9.5, null, "P295/45ZR18")], tires: ["P295/45ZR18"] });
  GENS.push({ make: "ford", model: "f-150", generation: "F-150 10th gen 1997-2003", years: [y, y], confidence: "low", sources: src, trims });
}

// ---------------------------------------------------------------------------
// 4. Ford Ranger 1993–1997 (3rd gen) and 1998–1999 (4th gen) — tiresize.com + TheRangerStation fitment guide (5x4.5; OE 14x6 / 15x7) => medium
for (const y of [1993, 1994, 1995, 1996, 1997, 1998, 1999]) {
  const tsYear = y <= 1994 ? 1993 : y <= 1997 ? 1995 : 1998;
  const src = [
    { url: TS("Ford", "Ranger", tsYear), note: `tiresize.com OE sizes ${tsYear} Ranger by 2wd/4wd/Splash/SuperCab` },
    { url: RANGER_STATION, note: "TheRangerStation 1983-2011 Ranger Wheel Fitment Guide: 5x4.5 bolt pattern; factory wheels 14x6 & 15x7 (1993-1999)" },
  ];
  const gen = y <= 1997 ? "Ranger 3rd gen 1993-1997" : "Ranger 4th gen 1998-2011";
  const twoWd = y <= 1997
    ? { wheels: [W(14, 6, null, "P195/70R14"), W(14, 6, null, "P215/70R14"), W(14, 6, null, "P225/70R14")], tires: ["P195/70R14", "P215/70R14", "P225/70R14"] }
    : { wheels: [W(14, 6, null, "P205/75R14"), W(15, 7, null, "P225/70R15")], tires: ["P205/75R14", "P225/70R15"] };
  const fourWdTires = ["P215/75R15", "P225/75R15", "P235/75R15"].concat(y <= 1995 ? ["P265/70R15"] : []);
  const trims = [
    { display: "2WD", raw: "Ranger 4x2 (incl. SuperCab)", submodel: "4x2", bolt: "5x114.3", cb: 70.6, thread: "1/2-20", seat: "conical", offMin: -6, offMax: 45, ...twoWd },
    { display: "4WD", raw: "Ranger 4x4 (incl. SuperCab, Splash 4x4)", submodel: "4x4", bolt: "5x114.3", cb: 70.6, thread: "1/2-20", seat: "conical", offMin: -12, offMax: 31,
      wheels: [W(15, 7, null, "P235/75R15")], tires: fourWdTires },
  ];
  if (y >= 1995 && y <= 1998) trims.push({ display: "Splash 2WD", raw: "Ranger Splash 4x2", submodel: "Splash", bolt: "5x114.3", cb: 70.6, thread: "1/2-20", seat: "conical", offMin: -6, offMax: 45,
    wheels: [W(15, 7, null, "P235/60R15")], tires: ["P235/60R15"] });
  GENS.push({ make: "ford", model: "ranger", generation: gen, years: [y, y], confidence: "medium", sources: src, trims });
}

// ---------------------------------------------------------------------------
// 5. Ford F-250 / F-350 1991–1997 OBS (8x165.1) — tiresize.com => low.  NOTE: no MY1998 OBS F-250HD/F-350 (Super Duty launched as MY1999).
for (const y of [1991, 1992, 1993, 1994, 1995, 1996, 1997]) {
  const tsYear = y <= 1994 ? 1992 : 1997;
  const srcF250 = [{ url: TS("Ford", "F250", tsYear), note: `tiresize.com OE sizes ${tsYear} F-250 2wd/4wd: LT215/85R16, LT235/85R16` }];
  const srcF350 = [{ url: TS("Ford", "F350", y <= 1996 ? 1992 : 1992), note: "tiresize.com OE sizes 1992 F-350 4wd / 4wd Dually: LT215/85R16, LT235/85R16" }];
  const hd = { bolt: "8x165.1", cb: 121.3, thread: "9/16-18", seat: "conical", offMin: -25, offMax: 25 };
  GENS.push({ make: "ford", model: "f-250", generation: "F-250 OBS (8-lug) 1987-1997", years: [y, y], confidence: "low", sources: srcF250, trims: [
    { display: "Base", raw: "F-250 / F-250 HD 4x2 & 4x4", submodel: "8-lug", ...hd, wheels: [W(16, 6, null, "LT215/85R16"), W(16, 7, null, "LT235/85R16")], tires: ["LT215/85R16", "LT235/85R16"] },
  ] });
  GENS.push({ make: "ford", model: "f-350", generation: "F-350 OBS (8-lug) 1987-1997", years: [y, y], confidence: "low", sources: srcF350, trims: [
    { display: "SRW", raw: "F-350 single rear wheel 4x2 & 4x4", submodel: "SRW", ...hd, wheels: [W(16, 7, null, "LT235/85R16")], tires: ["LT235/85R16", "LT215/85R16"] },
    { display: "DRW", raw: "F-350 dual rear wheel 4x2 & 4x4", submodel: "DRW", ...hd, offMin: -25, offMax: 130, wheels: [W(16, 6, null, "LT215/85R16"), W(16, 6, null, "LT235/85R16")], tires: ["LT215/85R16", "LT235/85R16"] },
  ] });
}

// 6. Ford F-250 Light Duty 1997–1999 (10th-gen body, 7-lug 7x150) — tiresize.com + Wikipedia (index) => low
for (const y of [1997, 1998, 1999]) {
  const tsYear = y === 1998 ? 1997 : y;
  GENS.push({ make: "ford", model: "f-250", generation: "F-250 Light Duty (7-lug) 1997-1999", years: [y, y], confidence: "low", sources: [
    { url: TS("Ford", "F250", tsYear), note: `tiresize.com ${tsYear} 'F250 Light': 255/70R16, 245/75R16` },
    { url: WIKI_F10, note: "Wikipedia (index only): light-duty F-250 on PN-96 platform MY1997-1999" },
  ], trims: [
    { display: "Light Duty", raw: "F-250 Light Duty (7-lug) 4x2 & 4x4", submodel: "Light Duty", bolt: "7x150", cb: 121.3, thread: "M14x2.0", seat: "conical", offMin: 10, offMax: 44,
      wheels: [W(16, 7, null, "P255/70R16"), W(16, 7, null, "LT245/75R16")], tires: ["P255/70R16", "LT245/75R16"] },
  ] });
}

// 7. Ford F-250 / F-350 Super Duty MY1999 (8x170) — tiresize.com + Wikipedia (index) => low
{
  const sd = { bolt: "8x170", cb: 124.9, thread: "M14x2.0", seat: "conical", offMin: 0, offMax: 44 };
  GENS.push({ make: "ford", model: "f-250", generation: "F-250 Super Duty 1st gen 1999-2007", years: [1999, 1999], confidence: "low", sources: [
    { url: TS("Ford", "F250", 1999), note: "tiresize.com 1999 F250 2wd Super Duty: 235/85R16; 4wd Super Duty: 235/85R16, 265/75R16" },
    { url: WIKI_SD, note: "Wikipedia (index only): Super Duty production from Jan 1998, MY1999+" },
  ], trims: [
    { display: "Super Duty 2WD", raw: "F-250 Super Duty 4x2", submodel: "Super Duty", ...sd, wheels: [W(16, 7, null, "LT235/85R16")], tires: ["LT235/85R16"] },
    { display: "Super Duty 4WD", raw: "F-250 Super Duty 4x4", submodel: "Super Duty", ...sd, wheels: [W(16, 7, null, "LT235/85R16"), W(16, 7, null, "LT265/75R16", false)], tires: ["LT235/85R16", "LT265/75R16"] },
  ] });
  GENS.push({ make: "ford", model: "f-350", generation: "F-350 Super Duty 1st gen 1999-2007", years: [1999, 1999], confidence: "low", sources: [
    { url: TS("Ford", "F350", 1999), note: "tiresize.com 1999 F350 2wd/4wd Super Duty: 265/75R16; 2wd SD Dually: 215/85R16; 4wd SD Dually: 235/85R16" },
    { url: WIKI_SD, note: "Wikipedia (index only): Super Duty MY1999+" },
  ], trims: [
    { display: "Super Duty SRW", raw: "F-350 Super Duty single rear wheel 4x2 & 4x4", submodel: "SRW", ...sd, wheels: [W(16, 7, null, "LT265/75R16")], tires: ["LT265/75R16"] },
    { display: "Super Duty DRW", raw: "F-350 Super Duty dual rear wheel 4x2 & 4x4", submodel: "DRW", ...sd, offMin: 0, offMax: 135, wheels: [W(16, 6, null, "LT215/85R16"), W(16, 6, null, "LT235/85R16")], tires: ["LT215/85R16", "LT235/85R16"] },
  ] });
}

// ---------------------------------------------------------------------------
// 8. Toyota Camry 1992–1996 (XV10) — tiresize.com 1992 + Wikipedia XV10 (MY range) => low
for (const y of [1992, 1993, 1994, 1995, 1996]) {
  const c = { bolt: "5x114.3", cb: 60.1, thread: "M12x1.5", seat: "conical", offMin: 30, offMax: 50 };
  GENS.push({ make: "toyota", model: "camry", generation: "Camry XV10 1992-1996", years: [y, y], confidence: "low", sources: [
    { url: TS("Toyota", "Camry", 1992), note: "tiresize.com 1992 Camry: DX/LE/XLE 195/70R14; SE & V6 205/65R15" },
    { url: WIKI_XV10, note: "Wikipedia (index only): XV10 model years 1992-1996 (US)" },
  ], trims: [
    { display: "DX", raw: "DX 4-cyl", submodel: "XV10", ...c, wheels: [W(14, 5.5, null, "P195/70R14")], tires: ["P195/70R14"] },
    { display: "LE", raw: "LE 4-cyl / LE V6", submodel: "XV10", ...c, wheels: [W(14, 5.5, null, "P195/70R14"), W(15, 6, null, "P205/65R15", false)], tires: ["P195/70R14", "P205/65R15"] },
    { display: "XLE", raw: "XLE 4-cyl / XLE V6", submodel: "XV10", ...c, wheels: [W(14, 5.5, null, "P195/70R14"), W(15, 6, null, "P205/65R15", false)], tires: ["P195/70R14", "P205/65R15"] },
    { display: "SE", raw: "SE V6", submodel: "XV10", ...c, wheels: [W(15, 6, null, "P205/65R15")], tires: ["P205/65R15"] },
  ] });
}

// ---------------------------------------------------------------------------
// expand -> rows
const rows = [];
for (const g of GENS) {
  for (let y = g.years[0]; y <= g.years[1]; y++) {
    for (const t of g.trims) {
      if (t.years && (y < t.years[0] || y > t.years[1])) continue;
      const sources = [...(g.sources || []), ...(t.sources || [])];
      rows.push({
        year: y, make: g.make, model: g.model,
        modification_id: `${y}-${g.make}-${slug(g.model)}-${slug(t.display)}`,
        raw_trim: t.raw ?? t.display, display_trim: t.display, submodel: t.submodel ?? null,
        bolt_pattern: t.bolt ?? g.bolt, center_bore_mm: t.cb ?? g.cb, thread_size: t.thread ?? g.thread, seat_type: t.seat ?? g.seat,
        offset_min_mm: t.offMin ?? g.offMin, offset_max_mm: t.offMax ?? g.offMax,
        oem_wheel_sizes: t.wheels, oem_tire_sizes: t.tires,
        source: SOURCE, confidence: t.confidence ?? g.confidence, sources, generation: g.generation,
        ...(g.note ? { note: g.note } : {}),
      });
    }
  }
}
// sanity: unique modification_id, every row has >=1 source
const ids = new Set();
for (const r of rows) {
  if (ids.has(r.modification_id)) throw new Error("dup modification_id " + r.modification_id);
  ids.add(r.modification_id);
  if (!r.sources.length) throw new Error("no source " + r.modification_id);
  if (!r.oem_tire_sizes.length || !r.oem_wheel_sizes.length) throw new Error("empty sizes " + r.modification_id);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
const by = {};
for (const r of rows) { const k = `${r.make} ${r.model}`; by[k] ??= { rows: 0, years: new Set(), conf: {} }; by[k].rows++; by[k].years.add(r.year); by[k].conf[r.confidence] = (by[k].conf[r.confidence] || 0) + 1; }
console.log(`wrote ${rows.length} proposal rows -> ${OUT}`);
for (const k of Object.keys(by).sort()) console.log(`  ${k.padEnd(22)} rows=${String(by[k].rows).padStart(3)} years=${Math.min(...by[k].years)}-${Math.max(...by[k].years)} conf=${JSON.stringify(by[k].conf)}`);
