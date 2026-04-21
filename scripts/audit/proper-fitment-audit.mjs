import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("PROPER FITMENT AUDIT - Checking ACTUAL data completeness");
console.log("═══════════════════════════════════════════════════════════════════════════\n");

// Get all records with detailed analysis
const { rows } = await pool.query(`
  SELECT 
    year, make, model, modification_id, display_trim, source,
    bolt_pattern,
    center_bore_mm,
    oem_wheel_sizes,
    oem_tire_sizes
  FROM vehicle_fitments
  WHERE year >= 2000
  ORDER BY year DESC, make, model
`);

let total = 0;
let hasBoltPattern = 0;
let hasCenterBore = 0;
let hasWheelSizes = 0;        // Has actual wheel specs (diameter + width)
let hasWheelSizesWithOffset = 0;
let hasTireSizes = 0;
let hasStaggeredWheels = 0;   // Has front/rear position data
let complete = 0;             // Has bolt pattern + wheel sizes + tire sizes

const bySource = {};
const missingWheelsByMake = {};
const staggeredMissingWheels = []; // Vehicles with different tire diameters but no wheel specs

for (const row of rows) {
  total++;
  
  const boltPattern = row.bolt_pattern?.trim();
  const centerBore = row.center_bore_mm;
  const wheelSizes = Array.isArray(row.oem_wheel_sizes) ? row.oem_wheel_sizes : [];
  const tireSizes = Array.isArray(row.oem_tire_sizes) ? row.oem_tire_sizes : [];
  
  // Check wheel sizes - must have diameter AND width
  const validWheelSizes = wheelSizes.filter(ws => 
    ws && typeof ws === 'object' && 
    ws.diameter && ws.width &&
    ws.diameter >= 13 && ws.diameter <= 30 &&
    ws.width >= 4 && ws.width <= 14
  );
  
  const hasValidWheels = validWheelSizes.length > 0;
  const hasOffset = validWheelSizes.some(ws => ws.offset != null);
  const hasPositionData = validWheelSizes.some(ws => 
    ws.position === 'front' || ws.position === 'rear' ||
    ws.axle === 'front' || ws.axle === 'rear'
  );
  
  // Check tire sizes
  const validTireSizes = tireSizes.filter(ts => 
    typeof ts === 'string' && /^\d{3}\/\d{2}R\d{2}/.test(ts)
  );
  const hasValidTires = validTireSizes.length > 0;
  
  // Check for staggered from tire sizes (different rim diameters)
  const tireDiameters = new Set();
  for (const ts of validTireSizes) {
    const match = ts.match(/R(\d+)/);
    if (match) tireDiameters.add(parseInt(match[1]));
  }
  const likelyStaggered = tireDiameters.size > 1;
  
  // Count stats
  if (boltPattern) hasBoltPattern++;
  if (centerBore) hasCenterBore++;
  if (hasValidWheels) hasWheelSizes++;
  if (hasValidWheels && hasOffset) hasWheelSizesWithOffset++;
  if (hasValidTires) hasTireSizes++;
  if (hasPositionData) hasStaggeredWheels++;
  if (boltPattern && hasValidWheels && hasValidTires) complete++;
  
  // Track by source
  if (!bySource[row.source]) {
    bySource[row.source] = { total: 0, hasWheels: 0, hasTires: 0, complete: 0 };
  }
  bySource[row.source].total++;
  if (hasValidWheels) bySource[row.source].hasWheels++;
  if (hasValidTires) bySource[row.source].hasTires++;
  if (boltPattern && hasValidWheels && hasValidTires) bySource[row.source].complete++;
  
  // Track missing wheels by make
  if (!hasValidWheels && hasValidTires) {
    const make = row.make.toLowerCase();
    if (!missingWheelsByMake[make]) missingWheelsByMake[make] = 0;
    missingWheelsByMake[make]++;
    
    // Track likely staggered vehicles missing wheel specs
    if (likelyStaggered) {
      staggeredMissingWheels.push({
        year: row.year,
        make: row.make,
        model: row.model,
        tires: validTireSizes.join(', '),
        diameters: [...tireDiameters].join('/'),
      });
    }
  }
}

console.log("OVERALL STATS (2000-2026)");
console.log("─".repeat(50));
console.log(`Total records:                    ${total.toLocaleString()}`);
console.log(`Has bolt pattern:                 ${hasBoltPattern.toLocaleString()} (${(hasBoltPattern/total*100).toFixed(1)}%)`);
console.log(`Has center bore:                  ${hasCenterBore.toLocaleString()} (${(hasCenterBore/total*100).toFixed(1)}%)`);
console.log(`Has ACTUAL wheel sizes:           ${hasWheelSizes.toLocaleString()} (${(hasWheelSizes/total*100).toFixed(1)}%)`);
console.log(`  - with offset data:             ${hasWheelSizesWithOffset.toLocaleString()} (${(hasWheelSizesWithOffset/total*100).toFixed(1)}%)`);
console.log(`  - with front/rear position:     ${hasStaggeredWheels.toLocaleString()} (${(hasStaggeredWheels/total*100).toFixed(1)}%)`);
console.log(`Has tire sizes:                   ${hasTireSizes.toLocaleString()} (${(hasTireSizes/total*100).toFixed(1)}%)`);
console.log(`TRULY COMPLETE (bolt+wheels+tires): ${complete.toLocaleString()} (${(complete/total*100).toFixed(1)}%)`);

console.log("\n\nBY SOURCE - Sorted by missing wheel data");
console.log("─".repeat(80));
const sourceList = Object.entries(bySource)
  .map(([source, stats]) => ({
    source,
    ...stats,
    missingWheels: stats.total - stats.hasWheels,
    pctComplete: (stats.complete / stats.total * 100).toFixed(1)
  }))
  .sort((a, b) => b.missingWheels - a.missingWheels);

console.log("Source".padEnd(35) + "Total".padStart(7) + "Wheels".padStart(8) + "Missing".padStart(9) + "Complete%".padStart(10));
for (const s of sourceList.slice(0, 20)) {
  console.log(
    s.source.substring(0, 34).padEnd(35) + 
    s.total.toString().padStart(7) + 
    s.hasWheels.toString().padStart(8) + 
    s.missingWheels.toString().padStart(9) +
    (s.pctComplete + '%').padStart(10)
  );
}

console.log("\n\nMAKES WITH MISSING WHEEL DATA (has tires but no wheels)");
console.log("─".repeat(50));
const makeList = Object.entries(missingWheelsByMake)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);
for (const [make, count] of makeList) {
  console.log(`${make.padEnd(20)} ${count} vehicles`);
}

console.log("\n\nLIKELY STAGGERED VEHICLES MISSING WHEEL SPECS");
console.log("(Different tire rim diameters detected, but no wheel size data)");
console.log("─".repeat(70));
const uniqueStaggered = [];
const seen = new Set();
for (const v of staggeredMissingWheels) {
  const key = `${v.year}-${v.make}-${v.model}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueStaggered.push(v);
  }
}
console.log(`Found ${uniqueStaggered.length} likely staggered vehicles without wheel specs:\n`);
for (const v of uniqueStaggered.slice(0, 30)) {
  console.log(`${v.year} ${v.make} ${v.model}`);
  console.log(`   Tires: ${v.tires} (R${v.diameters})`);
}
if (uniqueStaggered.length > 30) {
  console.log(`\n... and ${uniqueStaggered.length - 30} more`);
}

await pool.end();
