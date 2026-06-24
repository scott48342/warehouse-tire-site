/**
 * Ranking Analysis Script (v2 vs v3)
 * Simulates scoring for 7 test vehicles and compares supplier distribution
 *
 * Run: node scripts/ranking-analysis.cjs
 */

"use strict";

const pg     = require("pg");
const path   = require("path");
const fs     = require("fs");
const zlib   = require("zlib");

// ─── Load .env.local ─────────────────────────────────────────────────────────
const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
let POSTGRES_URL = "";
for (const line of envContent.split("\n")) {
  const m = line.match(/^POSTGRES_URL="([^"]+)"/);
  if (m) { POSTGRES_URL = m[1]; break; }
}

// ─── Load techfeed (WheelPros) from gzip JSON ────────────────────────────────
function loadTechfeed() {
  const fpath = path.join(process.cwd(), "src/techfeed/wheels_by_sku.json.gz");
  const buf  = fs.readFileSync(fpath);
  const json = zlib.gunzipSync(buf).toString("utf8");
  return JSON.parse(json);
}

function normalizeBP(raw) {
  if (!raw) return "";
  // Normalise "6X135", "6x135", "6-135" all → "6X135.0" (uppercase X, one decimal)
  return raw.replace(/^(\d+)[xX\-](\d+(?:\.\d+)?)$/, (_, lug, pcd) =>
    `${lug}X${parseFloat(pcd).toFixed(1)}`
  ).trim().toUpperCase();
}

function buildBPIndex(bySku) {
  const idx = new Map();
  for (const w of Object.values(bySku)) {
    const bpRaw = w.bolt_pattern_metric || w.bolt_pattern_standard || "";
    // Multi-fit wheels have patterns like "6X135/6X139.7" — index under both
    const parts = bpRaw.split(/[\/,]/).map(normalizeBP).filter(Boolean);
    for (const k of parts) {
      const arr = idx.get(k) || [];
      arr.push(w);
      idx.set(k, arr);
    }
  }
  return idx;
}

// ─── Test vehicles ────────────────────────────────────────────────────────────
const TEST_VEHICLES = [
  { label: "2024 Ford F-150",     bp: "6x135",   oemMin: 17, oemMax: 22, minOff: -44, maxOff: 44 },
  { label: "2024 Silverado 1500", bp: "6x139.7",  oemMin: 17, oemMax: 22, minOff: -44, maxOff: 44 },
  { label: "2024 Ram 1500",       bp: "5x139.7",  oemMin: 17, oemMax: 20, minOff: -44, maxOff: 44 },
  { label: "2024 Jeep Wrangler",  bp: "5x127",    oemMin: 17, oemMax: 20, minOff: -44, maxOff: 44 },
  { label: "2024 Toyota Tacoma",  bp: "6x139.7",  oemMin: 16, oemMax: 18, minOff: -44, maxOff: 44 },
  { label: "2024 BMW 3 Series",   bp: "5x112",    oemMin: 17, oemMax: 19, minOff:  30, maxOff: 55 },
  { label: "2024 Corvette",       bp: "5x120",    oemMin: 18, oemMax: 20, minOff:  30, maxOff: 65 },
];

// ─── Constants ────────────────────────────────────────────────────────────────
const TIER_1_BRANDS_V2 = new Set(["FM","FT","MO","XD","KM","RC","AR"]);
const TIER_1_W1_BRANDS = new Set(["MAYHEM","TOUREN","IONALLOY","CALIOFF-ROAD","RIDLER","DIRTYLIFE","KRAZE","AMERICANTRUXX","TUFFSTUFF","MAZZI","DL"]);
const TIER_2_BRANDS_V2 = new Set(["HE","VF","PR","LE","DC","NC","UC","OC","AC","TU"]);
const PREMIUM_FINISHES = ["BLACK","MATTE BLACK","GLOSS BLACK","MACHINED","MILLED","BRONZE","GUNMETAL"];
const FITMENT_CLASS_SCORES = { surefit: 100, specfit: 80, extended: 55 };
const SW3 = { availability: 0.25, fitmentClass: 0.20, fitmentQuality: 0.15,
               visualQuality: 0.15, priceRange: 0.10, customerValue: 0.10, finishBoost: 0.05 };

// ─── Scoring helpers ──────────────────────────────────────────────────────────
function avail(stock) {
  if (stock >= 8) return { label: "in_stock",          score: 100 };
  if (stock >= 4) return { label: "limited",           score: 75  };
  return           { label: "check_availability", score: 50  };
}

function fqScore(dia, off, env) {
  const isOemD = dia >= env.oemMin && dia <= env.oemMax;
  const isOemO = off >= env.minOff && off <= env.maxOff;
  let s = 50;
  if (dia > 0) {
    if (isOemD) { s = 100; }
    else { const d = dia < env.oemMin ? env.oemMin - dia : dia - env.oemMax; s = d<=1?80:d<=2?65:d<=4?50:35; }
  }
  if (isOemO) s = Math.min(100, s + 5);
  return s;
}

function imgScore(imgs) {
  const n = Array.isArray(imgs) ? imgs.filter(Boolean).length
          : typeof imgs === "string" ? imgs.split(",").filter(Boolean).length
          : 0;
  return n >= 3 ? 100 : n >= 1 ? 75 : 35;
}

function priceScore(p) { return p < 300 ? 80 : p <= 600 ? 100 : 85; }

function finishBoost(c) {
  const s = ((c.abbreviated_finish_desc||"")+" "+(c.product_desc||"")).toUpperCase();
  return PREMIUM_FINISHES.some(f => s.includes(f)) ? 10 : 0;
}

function deriveFitmentClass(c, env) {
  const dia = Number(c.diameter) || 0;
  const off = Number(c.offset)   || 0;
  if (!c.bolt_pattern_metric) return "excluded";
  const isOemD = dia >= env.oemMin && dia <= env.oemMax;
  const isOemO = off >= env.minOff && off <= env.maxOff;
  const missing = !c.centerbore;
  if (!isOemD) { const d = dia < env.oemMin ? env.oemMin-dia : dia-env.oemMax; return d>2?"extended":"specfit"; }
  return (!isOemO || missing) ? "specfit" : "surefit";
}

function scoreV2(c, stock, env) {
  const av = avail(stock);
  const bc = (c.brand_cd || "").toUpperCase();
  const bs = TIER_1_BRANDS_V2.has(bc)||TIER_1_W1_BRANDS.has(bc) ? 100 : TIER_2_BRANDS_V2.has(bc) ? 75 : 50;
  const fq = fqScore(Number(c.diameter)||0, Number(c.offset)||0, env);
  const vq = imgScore(c.images);
  const pr = priceScore(parseFloat(c.msrp)||0);
  const fb = finishBoost(c);
  return { score: Math.round((av.score*0.25+bs*0.20+fq*0.20+vq*0.15+pr*0.15+fb*0.05)*10)/10, avail: av.label, bs, fq };
}

function scoreV3(c, stock, env) {
  const av = avail(stock);
  const fc = deriveFitmentClass(c, env);
  const fcs = FITMENT_CLASS_SCORES[fc] || 50;
  const fq = fqScore(Number(c.diameter)||0, Number(c.offset)||0, env);
  const vq = imgScore(c.images);
  const pr = priceScore(parseFloat(c.msrp)||0);
  let cv = 0;
  if (c._freeShipping) cv += 50;
  if (stock >= 20) cv += 25; else if (stock >= 8) cv += 10;
  cv = Math.min(100, cv);
  const fb = finishBoost(c);
  const score = av.score*SW3.availability + fcs*SW3.fitmentClass + fq*SW3.fitmentQuality +
                vq*SW3.visualQuality + pr*SW3.priceRange + cv*SW3.customerValue + fb*SW3.finishBoost;
  return { score: Math.round(score*10)/10, avail: av.label, fc, fcs, fq, cv };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Load WheelPros techfeed
  console.log("Loading WheelPros techfeed...");
  const techfeed = loadTechfeed();
  const bpIndex = buildBPIndex(techfeed.bySku || {});
  console.log(`Techfeed loaded: ${Object.keys(techfeed.bySku || {}).length} SKUs\n`);

  // Connect to DB for Wheel-1
  const dbClient = new pg.Client({ connectionString: POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  await dbClient.connect();
  console.log("Connected to DB for Wheel-1 data.\n");

  const allResults = [];

  for (const veh of TEST_VEHICLES) {
    console.log(`\n${"═".repeat(80)}`);
    console.log(`  ${veh.label}  (bolt pattern: ${veh.bp})`);
    console.log(`${"═".repeat(80)}`);

    // WheelPros from techfeed
    const bpKey = normalizeBP(veh.bp);
    const wpRows = (bpIndex.get(bpKey) || []).map(w => ({
      ...w,
      _supplier: "wheelpros",
      _freeShipping: false,
      _stock: 12, // approximate: assume mid-stock for WP (no SFTP here)
    }));

    // Wheel-1 from DB
    let w1Rows = [];
    try {
      const r = await dbClient.query(
        `SELECT sku,
                UPPER(REGEXP_REPLACE(brand,'\\s+','','g')) AS brand_cd,
                brand AS brand_desc, brand AS brand_name,
                COALESCE(description,'') AS product_desc,
                COALESCE(finish,'') AS abbreviated_finish_desc,
                diameter::text AS diameter, wheel_width::text AS width,
                COALESCE(offset_mm::text,'0') AS offset,
                hub::text AS centerbore,
                pcd1 AS bolt_pattern_metric, pcd1 AS bolt_pattern_standard,
                COALESCE(msrp::text,'0') AS msrp,
                COALESCE(map_price::text,'0') AS map_price,
                COALESCE(inventory_qty,20) AS inv_qty,
        (
          (CASE WHEN image1 IS NOT NULL AND image1 != '' THEN 1 ELSE 0 END) +
          (CASE WHEN image2 IS NOT NULL AND image2 != '' THEN 1 ELSE 0 END) +
          (CASE WHEN image3 IS NOT NULL AND image3 != '' THEN 1 ELSE 0 END) +
          (CASE WHEN image4 IS NOT NULL AND image4 != '' THEN 1 ELSE 0 END) +
          (CASE WHEN image1_source IS NOT NULL AND image1_source != '' THEN 1 ELSE 0 END)
        ) AS image_count
         FROM wheel1_products
         WHERE (pcd1=$1 OR pcd2=$1) AND is_discontinued=FALSE LIMIT 600`,
        [veh.bp]
      );
      w1Rows = r.rows.map(row => ({
        sku: row.sku,
        brand_cd: row.brand_cd,
        brand_desc: row.brand_desc,
        product_desc: row.product_desc,
        abbreviated_finish_desc: row.abbreviated_finish_desc,
        diameter: row.diameter,
        width: row.width,
        offset: row.offset,
        centerbore: row.centerbore,
        bolt_pattern_metric: row.bolt_pattern_metric,
        msrp: row.msrp,
        images: null, // simplified
        _supplier: "wheel1",
        _freeShipping: true,
        _stock: Number(row.inv_qty) || 20,
        // Build images array from image count (1-4 images)
        images: Array(Math.min(4, Math.max(0, Number(row.image_count) || 0))).fill("url"),
      }));
    } catch (e) { console.error("  Wheel-1 error:", e.message.split("\n")[0]); }

    const all = [...wpRows, ...w1Rows];
    if (all.length === 0) { console.log("  No candidates found."); continue; }

    const env = { oemMin: veh.oemMin, oemMax: veh.oemMax, minOff: veh.minOff, maxOff: veh.maxOff };

    const scored = all
      .filter(c => Number(c.diameter) >= 14 && Number(c.diameter) <= 30)
      .map(c => {
        const stock = c._stock || 0;
        const v2 = scoreV2(c, stock, env);
        const v3 = scoreV3(c, stock, env);
        const price = parseFloat(c.msrp) || 0;
        return {
          sku:      c.sku,
          brand:    (c.brand_desc || c.brand_cd || "").substring(0, 20),
          price:    price > 0 ? `$${Math.round(price)}` : "N/A",
          supplier: c._supplier,
          dia:      c.diameter,
          fc:       v3.fc,
          v2Score:  v2.score,
          v3Score:  v3.score,
          v2Bs:     v2.bs,
          v3FcS:    v3.fcs,
          avail:    v2.avail,
        };
      });

    const byV2 = [...scored].sort((a, b) => b.v2Score - a.v2Score);
    const byV3 = [...scored].sort((a, b) => b.v3Score - a.v3Score);
    const v2Rank = new Map(byV2.map((c, i) => [c.sku, i + 1]));

    console.log(`\n  Candidates: ${scored.length} total  (WheelPros: ${wpRows.filter(c=>Number(c.diameter)>=14&&Number(c.diameter)<=30).length}, Wheel-1: ${w1Rows.filter(c=>Number(c.diameter)>=14&&Number(c.diameter)<=30).length})`);
    console.log(`\n  TOP 20 by v3 rank  (▲=moved up, ▼=moved down vs v2):`);
    console.log(`  ${"-".repeat(112)}`);
    console.log(`  ${"Pos".padEnd(4)} ${"v2#".padEnd(5)} ${"Supplier".padEnd(12)} ${"Brand".padEnd(21)} ${"Price".padEnd(7)} ${"Dia".padEnd(4)} ${"FitClass".padEnd(10)} ${"v2Score".padEnd(9)} ${"v3Score".padEnd(9)} Move`);
    console.log(`  ${"-".repeat(112)}`);

    byV3.slice(0, 20).forEach((c, i) => {
      const v2r = v2Rank.get(c.sku) || 999;
      const move = v2r - (i + 1);
      const mv = move > 0 ? `▲${move}` : move < 0 ? `▼${Math.abs(move)}` : "=";
      const sup = c.supplier === "wheel1" ? "⭐Wheel-1" : "WheelPros";
      console.log(
        `  ${("#"+(i+1)).padEnd(4)} ${("#"+v2r).padEnd(5)} ${sup.padEnd(12)} ${c.brand.padEnd(21)} ` +
        `${c.price.padEnd(7)} ${(c.dia+'"').padEnd(4)} ${c.fc.padEnd(10)} ` +
        `${c.v2Score.toString().padEnd(9)} ${c.v3Score.toString().padEnd(9)} ${mv}`
      );
    });

    // Distribution
    const n20 = Math.min(20, scored.length);
    const n50 = Math.min(50, scored.length);
    const cnt = (arr, n) => ({
      wp: arr.slice(0,n).filter(c=>c.supplier!=="wheel1").length,
      w1: arr.slice(0,n).filter(c=>c.supplier==="wheel1").length,
    });
    const s20v2 = cnt(byV2,n20), s20v3 = cnt(byV3,n20);
    const s50v2 = cnt(byV2,n50), s50v3 = cnt(byV3,n50);
    const pct = (n,t) => `${n}/${t} (${(n/t*100).toFixed(0)}%)`;

    console.log(`\n  SUPPLIER DISTRIBUTION`);
    console.log(`  ${"─".repeat(70)}`);
    console.log(`  Slice   WheelPros v2     Wheel-1 v2     WheelPros v3     Wheel-1 v3`);
    console.log(`  Top 20  ${pct(s20v2.wp,n20).padEnd(17)} ${pct(s20v2.w1,n20).padEnd(17)} ${pct(s20v3.wp,n20).padEnd(17)} ${pct(s20v3.w1,n20)}`);
    console.log(`  Top 50  ${pct(s50v2.wp,n50).padEnd(17)} ${pct(s50v2.w1,n50).padEnd(17)} ${pct(s50v3.wp,n50).padEnd(17)} ${pct(s50v3.w1,n50)}`);

    allResults.push({ vehicle: veh.label, n20, n50, s20v2, s20v3, s50v2, s50v3 });
  }

  // Grand summary
  console.log(`\n\n${"═".repeat(90)}`);
  console.log(`  GLOBAL SUPPLIER DISTRIBUTION — top-50 per vehicle`);
  console.log(`${"═".repeat(90)}`);
  console.log(`  ${"Vehicle".padEnd(25)}  ${"W1 top-50 v2".padEnd(16)} ${"W1 top-50 v3".padEnd(16)} Lift`);
  console.log(`  ${"─".repeat(90)}`);
  let tw1v2=0,tw1v3=0,tn50=0;
  for (const r of allResults) {
    const lift = r.s50v3.w1 - r.s50v2.w1;
    const pct = (n,t) => `${n}/${t} (${(n/t*100).toFixed(0)}%)`;
    console.log(`  ${r.vehicle.padEnd(25)}  ${pct(r.s50v2.w1,r.n50).padEnd(16)} ${pct(r.s50v3.w1,r.n50).padEnd(16)} ${lift>0?"+"+lift:lift}`);
    tw1v2 += r.s50v2.w1; tw1v3 += r.s50v3.w1; tn50 += r.n50;
  }
  if (allResults.length > 1) {
    const pct = (n,t) => `${(n/t*100).toFixed(0)}%`;
    const avgLift = ((tw1v3 - tw1v2) / allResults.length).toFixed(1);
    console.log(`  ${"─".repeat(90)}`);
    console.log(`  ${"AGGREGATE".padEnd(25)}  avg ${pct(tw1v2,tn50).padEnd(14)} avg ${pct(tw1v3,tn50).padEnd(14)} avg lift: +${avgLift} slots`);
  }

  await dbClient.end();
}

main().catch(err => { console.error(err); process.exit(1); });
