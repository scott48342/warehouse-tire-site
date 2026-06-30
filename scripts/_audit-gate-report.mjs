import fs from "node:fs";

const families = JSON.parse(fs.readFileSync("scripts/_gate-families.json", "utf8"));
const products = JSON.parse(fs.readFileSync("scripts/_gate-size-products.json", "utf8"));

const zeroSizes = new Set(
  Object.entries(products).filter(([, v]) => v.ok && v.total === 0).map(([s]) => s)
);
const sizeTotal = (s) => (products[s]?.ok ? products[s].total : null);

// For each gated family, for each displayed diameter:
//  - deadDiameter: ALL sizes for that diameter have 0 products  -> diameter button leads to NOTHING
//  - partialDiameter: SOME (not all) sizes have 0 products
const deadDiameters = [];     // {year,make,model,diameter,sizes}
const partialDiameters = [];  // {year,make,model,diameter,deadSizes,liveSizes}

for (const f of families) {
  for (const [diaStr, sizes] of Object.entries(f.sizesByDiameter)) {
    const dia = +diaStr;
    const dead = sizes.filter((s) => zeroSizes.has(s));
    const live = sizes.filter((s) => !zeroSizes.has(s));
    if (dead.length === 0) continue;
    if (live.length === 0) {
      deadDiameters.push({ year: f.year, make: f.make, model: f.model, diameter: dia, sizes });
    } else {
      partialDiameters.push({ year: f.year, make: f.make, model: f.model, diameter: dia, deadSizes: dead, liveSizes: live });
    }
  }
}

// Affected vehicles (distinct YMM) that have at least one DEAD diameter
const deadVehicles = new Set(deadDiameters.map((d) => `${d.year}|${d.make}|${d.model}`));

console.log("================ GATE ZERO-PRODUCT AUDIT ================\n");
console.log(`Gated YMM families (>=2 OEM diameters): ${families.length}`);
console.log(`Unique OEM sizes tested: ${Object.keys(products).length}`);
console.log(`Zero-product sizes: ${zeroSizes.size}\n`);

console.log(`DEAD diameters (every size for that diameter has 0 products): ${deadDiameters.length}`);
console.log(`  -> distinct vehicles (YMM) with >=1 dead diameter: ${deadVehicles.size}`);
console.log(`PARTIAL diameters (some sizes dead, >=1 size still has products): ${partialDiameters.length}\n`);

// Group dead diameters by make/model (collapse years) for readability
const byModel = new Map();
for (const d of deadDiameters) {
  const k = `${d.make} ${d.model}`;
  if (!byModel.has(k)) byModel.set(k, { diameters: new Set(), years: new Set(), sizes: new Set() });
  const e = byModel.get(k);
  e.diameters.add(d.diameter);
  e.years.add(d.year);
  for (const s of d.sizes) e.sizes.add(s);
}
const modelRows = [...byModel.entries()]
  .map(([k, e]) => ({
    model: k,
    diameters: [...e.diameters].sort((a, b) => a - b),
    yearCount: e.years.size,
    years: `${Math.min(...e.years)}-${Math.max(...e.years)}`,
    sizes: [...e.sizes].sort(),
  }))
  .sort((a, b) => b.yearCount - a.yearCount || a.model.localeCompare(b.model));

console.log("---- DEAD diameters grouped by make/model ----");
for (const r of modelRows) {
  console.log(`${r.model}  [${r.diameters.map((d) => d + '"').join(", ")} dead]  (${r.yearCount} model-years ${r.years})  sizes: ${r.sizes.join(", ")}`);
}

fs.writeFileSync("scripts/_gate-dead-diameters.json", JSON.stringify(deadDiameters, null, 2));
fs.writeFileSync("scripts/_gate-partial-diameters.json", JSON.stringify(partialDiameters, null, 2));
fs.writeFileSync("scripts/_gate-zero-product-sizes.json", JSON.stringify([...zeroSizes].map((s) => ({ size: s })), null, 2));

console.log("\nDetailed JSON written:");
console.log("  scripts/_gate-dead-diameters.json    (per-vehicle dead diameter list)");
console.log("  scripts/_gate-partial-diameters.json (per-vehicle partial diameter list)");
console.log("  scripts/_gate-zero-product-sizes.json");
