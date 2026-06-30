/**
 * Ranking Analysis Script (v2 vs v3)
 * Simulates scoring for 7 test vehicles and compares supplier distribution
 *
 * Run: node scripts/ranking-analysis.mjs
 */

import pg from "pg";
import path from "path";
import fs from "fs";

// ─── Load .env.local manually ─────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}
// Use the direct (non-pooler) URL which supports SSL reliably
let POSTGRES_URL = envVars["POSTGRES_URL"] || envVars["DATABASE_URL"];
// Some Neon pooler URLs need tlsmode=require via NODE_TLS option
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ─── Test vehicles ────────────────────────────────────────────────────────────
const TEST_VEHICLES = [
  { label: "2024 Ford F-150",      bp: "6x135",   oemMin: 17, oemMax: 22, minOff: -44, maxOff: 44 },
  { label: "2024 Silverado 1500",  bp: "6x139.7",  oemMin: 17, oemMax: 22, minOff: -44, maxOff: 44 },
  { label: "2024 Ram 1500",        bp: "5x139.7",  oemMin: 17, oemMax: 20, minOff: -44, maxOff: 44 },
  { label: "2024 Jeep Wrangler",   bp: "5x127",    oemMin: 17, oemMax: 20, minOff: -44, maxOff: 44 },
  { label: "2024 Toyota Tacoma",   bp: "6x139.7",  oemMin: 16, oemMax: 18, minOff: -44, maxOff: 44 },
  { label: "2024 BMW 3 Series",    bp: "5x112",    oemMin: 17, oemMax: 19, minOff:  30, maxOff: 55 },
  { label: "2024 Corvette",        bp: "5x120",    oemMin: 18, oemMax: 20, minOff:  30, maxOff: 65 },
];

// ─── v2 scoring (old) ─────────────────────────────────────────────────────────
const TIER_1_BRANDS_V2  = new Set(["FM", "FT", "MO", "XD", "KM", "RC", "AR"]);
const TIER_1_W1_BRANDS  = new Set(["MAYHEM","TOUREN","IONALLOY","CALIOFF-ROAD","RIDLER","DIRTYLIFE","KRAZE","AMERICANTRUXX","TUFFSTUFF","MAZZI","DL"]);
const TIER_2_BRANDS_V2  = new Set(["HE","VF","PR","LE","DC","NC","UC","OC","AC","TU"]);
const PREMIUM_FINISHES  = ["BLACK","MATTE BLACK","GLOSS BLACK","MACHINED","MILLED","BRONZE","GUNMETAL"];

function scoreV2(c, invQty, envelope) {
  const stock = invQty;
  const minQty = 4;

  let availLabel = "check_availability";
  if (stock >= minQty * 2) availLabel = "in_stock";
  else if (stock >= minQty) availLabel = "limited";

  const availScore = availLabel === "in_stock" ? 100 : availLabel === "limited" ? 75 : 50;

  const bc = (c.brand_cd || "").toUpperCase();
  let brandScore = 50;
  if (TIER_1_BRANDS_V2.has(bc) || TIER_1_W1_BRANDS.has(bc)) brandScore = 100;
  else if (TIER_2_BRANDS_V2.has(bc)) brandScore = 75;

  const dia = Number(c.diameter) || 0;
  const off = Number(c.offset)   || 0;
  const isOemD = dia >= envelope.oemMin && dia <= envelope.oemMax;
  const isOemO = off >= envelope.minOff && off <= envelope.maxOff;

  let fqScore = 50;
  if (dia > 0) {
    if (isOemD) { fqScore = 100; }
    else {
      const dist = dia < envelope.oemMin ? envelope.oemMin - dia : dia - envelope.oemMax;
      if (dist <= 1) fqScore = 80;
      else if (dist <= 2) fqScore = 65;
      else if (dist <= 4) fqScore = 50;
      else fqScore = 35;
    }
  }
  if (isOemO) fqScore = Math.min(100, fqScore + 5);

  const imgs = c.images ? c.images.split(",").filter(Boolean) : [];
  const vqScore = imgs.length >= 3 ? 100 : imgs.length >= 1 ? 75 : 35;

  const price = parseFloat(c.msrp) || 0;
  const priceScore = price < 300 ? 80 : price <= 600 ? 100 : 85;

  const finishStr = ((c.abbreviated_finish_desc || "") + " " + (c.product_desc || "")).toUpperCase();
  const fBoost = PREMIUM_FINISHES.some(f => finishStr.includes(f)) ? 10 : 0;

  const score = availScore*0.25 + brandScore*0.20 + fqScore*0.20 +
                vqScore*0.15   + priceScore*0.15  + fBoost*0.05;

  return { score: Math.round(score*10)/10, availLabel, brandScore, fqScore, availScore };
}

// ─── v3 scoring (new) ─────────────────────────────────────────────────────────
const FITMENT_CLASS_SCORES = { surefit: 100, specfit: 80, extended: 55 };
const SCORE_WEIGHTS_V3 = {
  availability: 0.25, fitmentClass: 0.20, fitmentQuality: 0.15,
  visualQuality: 0.15, priceRange: 0.10, customerValue: 0.10, finishBoost: 0.05,
};

function deriveFitmentClass(c, envelope) {
  const dia = Number(c.diameter) || 0;
  const off = Number(c.offset)   || 0;
  if (!c.bolt_pattern_metric && !c.pcd1) return "excluded";
  const isOemD = dia >= envelope.oemMin && dia <= envelope.oemMax;
  const isOemO = off >= envelope.minOff && off <= envelope.maxOff;
  const hasMissingData = !c.hub_size;
  if (!isOemD) {
    const dist = dia < envelope.oemMin ? envelope.oemMin - dia : dia - envelope.oemMax;
    if (dist > 2) return "extended";
    return "specfit";
  }
  if (!isOemO || hasMissingData) return "specfit";
  return "surefit";
}

function scoreV3(c, invQty, envelope) {
  const stock = invQty;
  const minQty = 4;

  let availLabel = "check_availability";
  if (stock >= minQty * 2) availLabel = "in_stock";
  else if (stock >= minQty) availLabel = "limited";

  const availScore = availLabel === "in_stock" ? 100 : availLabel === "limited" ? 75 : 50;

  const fc = deriveFitmentClass(c, envelope);
  const fcScore = FITMENT_CLASS_SCORES[fc] ?? 50;

  const dia = Number(c.diameter) || 0;
  const off = Number(c.offset)   || 0;
  const isOemD = dia >= envelope.oemMin && dia <= envelope.oemMax;
  const isOemO = off >= envelope.minOff && off <= envelope.maxOff;

  let fqScore = 50;
  if (dia > 0) {
    if (isOemD) { fqScore = 100; }
    else {
      const dist = dia < envelope.oemMin ? envelope.oemMin - dia : dia - envelope.oemMax;
      if (dist <= 1) fqScore = 80;
      else if (dist <= 2) fqScore = 65;
      else if (dist <= 4) fqScore = 50;
      else fqScore = 35;
    }
  }
  if (isOemO) fqScore = Math.min(100, fqScore + 5);

  const imgs = c.images ? c.images.split(",").filter(Boolean) : [];
  const vqScore = imgs.length >= 3 ? 100 : imgs.length >= 1 ? 75 : 35;

  const price = parseFloat(c.msrp) || 0;
  const priceScore = price < 300 ? 80 : price <= 600 ? 100 : 85;

  let cvScore = 0;
  if (c.supplier === "wheel1") cvScore += 50;
  if (stock >= 20) cvScore += 25;
  else if (stock >= 8) cvScore += 10;
  cvScore = Math.min(100, cvScore);

  const finishStr = ((c.abbreviated_finish_desc || "") + " " + (c.product_desc || "")).toUpperCase();
  const fBoost = PREMIUM_FINISHES.some(f => finishStr.includes(f)) ? 10 : 0;

  const score =
    availScore * SCORE_WEIGHTS_V3.availability   +
    fcScore    * SCORE_WEIGHTS_V3.fitmentClass   +
    fqScore    * SCORE_WEIGHTS_V3.fitmentQuality +
    vqScore    * SCORE_WEIGHTS_V3.visualQuality  +
    priceScore * SCORE_WEIGHTS_V3.priceRange     +
    cvScore    * SCORE_WEIGHTS_V3.customerValue  +
    fBoost     * SCORE_WEIGHTS_V3.finishBoost;

  return { score: Math.round(score*10)/10, availLabel, fcScore, fc, fqScore, availScore };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { Pool } = pg;
  // Neon requires SSL but not cert verification in dev
  const pool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  // Warm up connection
  try { await pool.query('SELECT 1'); } catch(e) { console.error('Pool connect failed:', e.message); process.exit(1); }

  const allResults = [];

  for (const vehicle of TEST_VEHICLES) {
    console.log(`\n${"═".repeat(80)}`);
    console.log(`  ${vehicle.label}  (bolt pattern: ${vehicle.bp})`);
    console.log(`${"═".repeat(80)}`);

    let wpRows = [], w1Rows = [];

    // WheelPros query
    try {
      const res = await pool.query(
        `SELECT sku,
                COALESCE(brand_cd, '') AS brand_cd,
                COALESCE(brand_desc, brand_cd, '') AS brand_desc,
                COALESCE(product_desc, '') AS product_desc,
                abbreviated_finish_desc, fancy_finish_desc,
                diameter::text, width::text, offset::text,
                centerbore::text AS hub_size,
                bolt_pattern_metric, bolt_pattern_standard,
                COALESCE(msrp::text, '0') AS msrp,
                COALESCE(map_price::text, '0') AS map_price,
                COALESCE(array_to_string(
                  ARRAY[image_url_1, image_url_2, image_url_3]::text[], ','
                ), '') AS images,
                'wheelpros' AS supplier
         FROM wp_wheels
         WHERE bolt_pattern_metric = $1 AND is_active = TRUE
         LIMIT 500`,
        [vehicle.bp]
      );
      wpRows = res.rows;
    } catch (e) {
      console.error("  WheelPros query error:", e.message.split("\n")[0]);
    }

    // Wheel-1 query
    try {
      const res = await pool.query(
        `SELECT sku,
                UPPER(REGEXP_REPLACE(brand, '\\s+', '', 'g')) AS brand_cd,
                brand AS brand_desc,
                COALESCE(description, '') AS product_desc,
                finish AS abbreviated_finish_desc,
                finish AS fancy_finish_desc,
                diameter::text, wheel_width::text AS width,
                COALESCE(offset_mm::text, '0') AS offset,
                hub::text AS hub_size,
                pcd1 AS bolt_pattern_metric, pcd1 AS bolt_pattern_standard,
                COALESCE(msrp::text, '0') AS msrp,
                COALESCE(map_price::text, '0') AS map_price,
                COALESCE(array_to_string(
                  ARRAY[image1, image2, image3, image4]::text[], ','
                ), '') AS images,
                COALESCE(inventory_qty, 20) AS inv_qty,
                'wheel1' AS supplier
         FROM wheel1_products
         WHERE (pcd1 = $1 OR pcd2 = $1) AND is_discontinued = FALSE
         LIMIT 500`,
        [vehicle.bp]
      );
      w1Rows = res.rows;
    } catch (e) {
      console.error("  Wheel-1 query error:", e.message.split("\n")[0]);
    }

    const all = [...wpRows, ...w1Rows];

    if (all.length === 0) {
      console.log("  No candidates found.");
      continue;
    }

    const envelope = { oemMin: vehicle.oemMin, oemMax: vehicle.oemMax, minOff: vehicle.minOff, maxOff: vehicle.maxOff };

    // Score all candidates
    const scored = all
      .filter(c => c.diameter && Number(c.diameter) >= 14 && Number(c.diameter) <= 30)
      .map(c => {
        const invQty = c.supplier === "wheel1"
          ? (c.inv_qty ? Number(c.inv_qty) : 20)
          : 12; // assume mid-stock for WheelPros (SFTP data not available here)
        const v2 = scoreV2(c, invQty, envelope);
        const v3 = scoreV3(c, invQty, envelope);
        const price = parseFloat(c.msrp) || 0;
        return {
          sku:     c.sku,
          brand:   (c.brand_desc || c.brand_cd || "").substring(0, 20),
          price:   price > 0 ? `$${price.toFixed(0)}` : "N/A",
          supplier:c.supplier,
          dia:     c.diameter,
          fc:      v3.fc,
          v2Score: v2.score,
          v3Score: v3.score,
          v2Brand: v2.brandScore,
          v3Fc:    v3.fcScore,
          avail:   v2.availLabel,
        };
      });

    const byV2 = [...scored].sort((a, b) => b.v2Score - a.v2Score);
    const byV3 = [...scored].sort((a, b) => b.v3Score - a.v3Score);

    // Top 20 comparison
    const v2Rank = new Map(byV2.map((c, i) => [c.sku, i + 1]));
    console.log(`\n  Candidates: ${scored.length} total  (WheelPros: ${wpRows.length}, Wheel-1: ${w1Rows.length})`);
    console.log(`\n  TOP 20 by v3 rank (showing v2 rank for comparison):`);
    console.log(`  ${"-".repeat(110)}`);
    console.log(`  ${"Pos".padEnd(4)} ${"v2#".padEnd(5)} ${"Supplier".padEnd(12)} ${"Brand".padEnd(21)} ${"Price".padEnd(7)} ${"Dia".padEnd(4)} ${"FitClass".padEnd(10)} ${"v2Scr".padEnd(8)} ${"v3Scr".padEnd(8)} ${"Move"}`);
    console.log(`  ${"-".repeat(110)}`);

    byV3.slice(0, 20).forEach((c, i) => {
      const v2r = v2Rank.get(c.sku) || 999;
      const move = v2r - (i+1);
      const moveStr = move > 0 ? `▲${move}` : move < 0 ? `▼${Math.abs(move)}` : "=";
      const suppStr = c.supplier === "wheel1" ? "⭐Wheel-1" : "WheelPros";
      console.log(
        `  ${("#"+(i+1)).padEnd(4)} ${("#"+v2r).padEnd(5)} ${suppStr.padEnd(12)} ${c.brand.padEnd(21)} ${c.price.padEnd(7)} ${(c.dia+'"').padEnd(4)} ${c.fc.padEnd(10)} ${c.v2Score.toString().padEnd(8)} ${c.v3Score.toString().padEnd(8)} ${moveStr}`
      );
    });

    // Supplier distribution
    const sup50v2 = { wp: byV2.slice(0,50).filter(c=>c.supplier!=="wheel1").length, w1: byV2.slice(0,50).filter(c=>c.supplier==="wheel1").length };
    const sup50v3 = { wp: byV3.slice(0,50).filter(c=>c.supplier!=="wheel1").length, w1: byV3.slice(0,50).filter(c=>c.supplier==="wheel1").length };
    const sup20v2 = { wp: byV2.slice(0,20).filter(c=>c.supplier!=="wheel1").length, w1: byV2.slice(0,20).filter(c=>c.supplier==="wheel1").length };
    const sup20v3 = { wp: byV3.slice(0,20).filter(c=>c.supplier!=="wheel1").length, w1: byV3.slice(0,20).filter(c=>c.supplier==="wheel1").length };
    const n50 = Math.min(50, scored.length), n20 = Math.min(20, scored.length);

    console.log(`\n  SUPPLIER DISTRIBUTION`);
    console.log(`  ${"─".repeat(60)}`);
    console.log(`  Position   WheelPros v2    Wheel-1 v2    WheelPros v3    Wheel-1 v3`);
    console.log(`  Top 20     ${sup20v2.wp}/${n20} (${(sup20v2.wp/n20*100).toFixed(0)}%)   ${sup20v2.w1}/${n20} (${(sup20v2.w1/n20*100).toFixed(0)}%)    ${sup20v3.wp}/${n20} (${(sup20v3.wp/n20*100).toFixed(0)}%)    ${sup20v3.w1}/${n20} (${(sup20v3.w1/n20*100).toFixed(0)}%)`);
    console.log(`  Top 50     ${sup50v2.wp}/${n50} (${(sup50v2.wp/n50*100).toFixed(0)}%)   ${sup50v2.w1}/${n50} (${(sup50v2.w1/n50*100).toFixed(0)}%)    ${sup50v3.wp}/${n50} (${(sup50v3.wp/n50*100).toFixed(0)}%)    ${sup50v3.w1}/${n50} (${(sup50v3.w1/n50*100).toFixed(0)}%)`);

    allResults.push({ vehicle: vehicle.label, n20, n50, sup20v2, sup20v3, sup50v2, sup50v3 });
  }

  // ── Grand summary ─────────────────────────────────────────────────────────
  console.log(`\n\n${"═".repeat(90)}`);
  console.log(`  OVERALL SUPPLIER DISTRIBUTION SUMMARY (top 50 across all test vehicles)`);
  console.log(`${"═".repeat(90)}`);
  console.log(`  ${"Vehicle".padEnd(25)} ${"W1 in top-50 v2".padEnd(18)} ${"W1 in top-50 v3".padEnd(18)} ${"Lift"}`);
  console.log(`  ${"─".repeat(90)}`);
  let totalW1v2 = 0, totalW1v3 = 0, totalN50 = 0;
  for (const r of allResults) {
    const lift = r.sup50v3.w1 - r.sup50v2.w1;
    const liftStr = lift > 0 ? `+${lift}` : lift.toString();
    console.log(`  ${r.vehicle.padEnd(25)} ${r.sup50v2.w1}/${r.n50} (${(r.sup50v2.w1/r.n50*100).toFixed(0)}%)            ${r.sup50v3.w1}/${r.n50} (${(r.sup50v3.w1/r.n50*100).toFixed(0)}%)           ${liftStr}`);
    totalW1v2 += r.sup50v2.w1; totalW1v3 += r.sup50v3.w1; totalN50 += r.n50;
  }
  if (allResults.length > 1) {
    const avgLift = ((totalW1v3 - totalW1v2) / allResults.length).toFixed(1);
    console.log(`  ${"─".repeat(90)}`);
    console.log(`  ${"AVERAGE".padEnd(25)} ${(totalW1v2/totalN50*100).toFixed(0)}%                       ${(totalW1v3/totalN50*100).toFixed(0)}%                      avg lift: +${avgLift} positions`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
