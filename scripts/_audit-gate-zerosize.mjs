import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Mirror src/lib/tires/wheelDiameterFilter.ts extractRimDiameter
function extractRimDiameter(tireSize) {
  if (!tireSize) return null;
  const s = String(tireSize).toUpperCase().trim();
  const metric = s.match(/R(\d{2}(?:\.\d)?)/);
  if (metric) return Math.floor(parseFloat(metric[1]));
  const flot = s.match(/X[\d.]+R(\d{2})/);
  if (flot) return parseInt(flot[1], 10);
  return null;
}

const c = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await c.connect();

// Pull every fitment row's OEM tire sizes, grouped per year/make/model FAMILY
// (the gate aggregates OEM sizes by make/model/diameter family, so we union per YMM).
const rows = await c.query(`
  SELECT year, make, model, oem_tire_sizes
  FROM vehicle_fitments
  WHERE oem_tire_sizes IS NOT NULL
`);

// family key = year|make|model (the gate page resolves per selected YMM)
const families = new Map();
for (const r of rows.rows) {
  let sizes = r.oem_tire_sizes;
  if (typeof sizes === "string") {
    try { sizes = JSON.parse(sizes); } catch { sizes = []; }
  }
  if (!Array.isArray(sizes)) continue;
  const key = `${r.year}|${r.make}|${r.model}`;
  if (!families.has(key)) families.set(key, new Set());
  const set = families.get(key);
  for (const s of sizes) if (s) set.add(String(s).trim());
}

let gatedCount = 0;
const zeroSizeDiameters = []; // displayed diameter with no tire size (cannot happen by construction, but check)
const familiesGated = [];

for (const [key, sizeSet] of families) {
  const sizes = [...sizeSet];
  // diameter -> [sizes]
  const byDia = new Map();
  for (const s of sizes) {
    const d = extractRimDiameter(s);
    if (d == null) continue;
    if (!byDia.has(d)) byDia.set(d, []);
    byDia.get(d).push(s);
  }
  const diameters = [...byDia.keys()].sort((a, b) => a - b);
  if (diameters.length <= 1) continue; // not gated
  gatedCount++;
  const [year, make, model] = key.split("|");
  familiesGated.push({ year: +year, make, model, diameters, byDia });

  for (const d of diameters) {
    const list = byDia.get(d) || [];
    if (list.length === 0) {
      zeroSizeDiameters.push({ year: +year, make, model, diameter: d });
    }
  }
}

console.log("=== GATE POPULATION (WheelSizeGateSelector triggers) ===");
console.log(`Total YMM families with >=2 OEM wheel diameters (gated): ${gatedCount}`);
console.log(`Displayed diameters with ZERO tire sizes: ${zeroSizeDiameters.length}`);
if (zeroSizeDiameters.length) {
  console.log(JSON.stringify(zeroSizeDiameters.slice(0, 50), null, 2));
}

// Save full gated list for the product-gap phase
const fs = await import("node:fs");
fs.writeFileSync(
  "scripts/_gate-families.json",
  JSON.stringify(
    familiesGated.map((f) => ({
      year: f.year, make: f.make, model: f.model,
      diameters: f.diameters,
      sizesByDiameter: Object.fromEntries([...f.byDia.entries()]),
    })),
    null, 2
  )
);
console.log(`\nWrote ${familiesGated.length} gated families -> scripts/_gate-families.json`);

// Distribution of diameter counts
const dist = {};
for (const f of familiesGated) {
  const n = f.diameters.length;
  dist[n] = (dist[n] || 0) + 1;
}
console.log("\nDiameter-count distribution among gated families:");
console.log(JSON.stringify(dist, null, 2));

await c.end();
