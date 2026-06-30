import fs from "node:fs";

const families = JSON.parse(fs.readFileSync("scripts/_gate-families.json", "utf8"));

// Collect unique tire sizes that appear as a gated-diameter option,
// and map size -> set of affected diameters / families.
const sizeToFamilies = new Map();
for (const f of families) {
  for (const [dia, sizes] of Object.entries(f.sizesByDiameter)) {
    for (const s of sizes) {
      if (!sizeToFamilies.has(s)) sizeToFamilies.set(s, []);
      sizeToFamilies.get(s).push({ year: f.year, make: f.make, model: f.model, diameter: +dia });
    }
  }
}

const uniqueSizes = [...sizeToFamilies.keys()].sort();
console.log(`Unique OEM tire sizes across all gated diameters: ${uniqueSizes.length}`);

// How many families would be impacted if a given size has zero products?
// (count families where that size is the ONLY size for its diameter -> diameter becomes dead)
let soloSizeDiameters = 0;
const perFamilySoloDia = [];
for (const f of families) {
  for (const [dia, sizes] of Object.entries(f.sizesByDiameter)) {
    if (sizes.length === 1) {
      soloSizeDiameters++;
      perFamilySoloDia.push({ year: f.year, make: f.make, model: f.model, diameter: +dia, size: sizes[0] });
    }
  }
}
console.log(`Gated diameters backed by a SINGLE tire size (most at-risk of dead diameter if that size has 0 products): ${soloSizeDiameters}`);

fs.writeFileSync("scripts/_gate-unique-sizes.json", JSON.stringify(uniqueSizes, null, 2));
fs.writeFileSync("scripts/_gate-solo-diameters.json", JSON.stringify(perFamilySoloDia, null, 2));
fs.writeFileSync(
  "scripts/_gate-size-to-families.json",
  JSON.stringify(Object.fromEntries([...sizeToFamilies.entries()].map(([k, v]) => [k, v.length])), null, 2)
);
console.log("Wrote scripts/_gate-unique-sizes.json, _gate-solo-diameters.json, _gate-size-to-families.json");
