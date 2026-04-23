import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log("=== SPOT CHECK: Verifying imported data against research ===\n");

// Check 1: Tri-Five hub bore should be 82.55mm
const trifive = await client.query("SELECT year, model, bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1957 AND make = 'Chevrolet' AND model = 'Bel Air'");
console.log("1957 Bel Air:");
console.log("  Expected: 5x120.65, hub 82.55mm");
console.log("  Got:", trifive.rows[0]?.bolt_pattern, ", hub", trifive.rows[0]?.center_bore_mm + "mm");
console.log("  Match:", trifive.rows[0]?.bolt_pattern === "5x120.65" && trifive.rows[0]?.center_bore_mm == 82.55 ? "✅" : "❌");

// Check 2: C10 bolt pattern change - 1970 should be 6-lug, 1972 should be 5-lug
const c10_70 = await client.query("SELECT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1970 AND make = 'Chevrolet' AND model = 'C10'");
const c10_72 = await client.query("SELECT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1972 AND make = 'Chevrolet' AND model = 'C10'");
console.log("\nC10 bolt pattern change in 1971:");
console.log("  1970 Expected: 6x139.7, hub 108.1mm");
console.log("  1970 Got:", c10_70.rows[0]?.bolt_pattern, ", hub", c10_70.rows[0]?.center_bore_mm + "mm");
console.log("  1972 Expected: 5x127, hub 78.1mm");
console.log("  1972 Got:", c10_72.rows[0]?.bolt_pattern, ", hub", c10_72.rows[0]?.center_bore_mm + "mm");

// Check 3: Early Bronco hub bore should be 87.1mm
const bronco = await client.query("SELECT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1970 AND make = 'Ford' AND model = 'Bronco'");
console.log("\n1970 Bronco:");
console.log("  Expected: 5x139.7, hub 87.1mm");
console.log("  Got:", bronco.rows[0]?.bolt_pattern, ", hub", bronco.rows[0]?.center_bore_mm + "mm");

// Check 4: 1967 Eldorado FWD should have different hub bore than 1966
const eldo66 = await client.query("SELECT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1966 AND make = 'Cadillac' AND model = 'Eldorado'");
const eldo67 = await client.query("SELECT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1967 AND make = 'Cadillac' AND model = 'Eldorado'");
console.log("\nEldorado FWD conversion (1967):");
console.log("  1966 (RWD) Expected: 5x127, hub 108mm");
console.log("  1966 Got:", eldo66.rows[0]?.bolt_pattern, ", hub", eldo66.rows[0]?.center_bore_mm + "mm");
console.log("  1967 (FWD) Expected: 5x127, hub 78.1mm");
console.log("  1967 Got:", eldo67.rows[0]?.bolt_pattern, ", hub", eldo67.rows[0]?.center_bore_mm + "mm");

// Check 5: Thunderbird should all be 5x114.3
const tbird = await client.query("SELECT DISTINCT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Thunderbird' AND year BETWEEN 1955 AND 1966");
console.log("\nThunderbird (1955-1966):");
console.log("  Expected: All 5x114.3, hub 70.5mm");
console.log("  Got patterns:", tbird.rows.map(r => r.bolt_pattern + " / " + r.center_bore_mm + "mm").join(", "));

// Check 6: Scout hub bore should be 106.7mm (different from Bronco)
const scout = await client.query("SELECT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE year = 1970 AND make = 'International' AND model = 'Scout'");
console.log("\n1970 Scout:");
console.log("  Expected: 5x139.7, hub 106.7mm");
console.log("  Got:", scout.rows[0]?.bolt_pattern, ", hub", scout.rows[0]?.center_bore_mm + "mm");

// Check 7: Sample some tire sizes
const tires = await client.query("SELECT year, make, model, oem_tire_sizes FROM vehicle_fitments WHERE year = 1957 AND make = 'Chevrolet' AND model = 'Bel Air'");
console.log("\n1957 Bel Air tire sizes:");
console.log("  Expected: 205/75R14 (modern equiv of 7.50-14)");
console.log("  Got:", tires.rows[0]?.oem_tire_sizes);

await client.end();
