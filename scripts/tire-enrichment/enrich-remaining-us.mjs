import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Tire sizes from web search results
const vehicleSizes = {
  // Audi (US models)
  "audi a5": ["245/45R17", "245/40R18", "255/35R19"],
  "audi a7": ["245/45R18", "255/40R19", "255/35R20"],
  "audi s5": ["245/40R18", "255/35R19"],
  "audi rs5": ["255/35R19", "275/30R20"],
  "audi q5": ["235/65R17", "235/55R19", "255/45R20"],
  "audi q7": ["235/65R18", "255/55R19", "285/45R20"],
  "audi q8": ["255/55R20", "285/45R21", "285/40R22"],
  "audi e-tron": ["255/55R19", "265/45R21", "255/50R20"],
  
  // BMW (US models)
  "bmw 3-series": ["225/45R18", "225/40R19", "255/35R19"],
  "bmw 4-series": ["225/45R18", "255/35R19", "255/30R20"],
  "bmw 5-series": ["225/55R17", "245/45R18", "245/40R19", "275/35R20"],
  "bmw x3": ["225/60R18", "245/50R19", "245/45R20"],
  "bmw x5": ["255/55R18", "275/45R20", "275/40R21", "315/35R21"],
  
  // Mercedes (US models)
  "mercedes c-class": ["225/50R17", "225/45R18", "245/40R18", "225/40R19"],
  "mercedes e-class": ["225/55R17", "245/45R18", "245/40R19", "275/35R19"],
  "mercedes glc": ["235/60R18", "235/55R19", "255/45R20"],
  "mercedes gle": ["255/55R18", "275/50R20", "275/45R21"],
  
  // Lexus
  "lexus is": ["225/45R17", "225/40R18", "235/40R19", "265/35R19"],
  "lexus es": ["215/55R17", "235/45R18", "235/40R19"],
  "lexus rx": ["235/65R18", "235/55R20"],
  "lexus nx": ["225/65R17", "225/60R18", "235/50R20"],
  "lexus lx": ["275/50R22", "305/50R22"],
  
  // Porsche
  "porsche 911": ["235/40R19", "295/35R20", "245/35R20", "305/30R21"],
  "porsche cayenne": ["255/55R18", "275/45R20", "285/40R21", "315/35R21"],
  "porsche macan": ["235/55R19", "255/45R20", "265/40R21"],
  "porsche taycan": ["225/55R19", "275/45R19", "245/45R20", "285/40R20"],
  
  // Infiniti
  "infiniti q50": ["225/55R17", "245/40R19", "265/35R19"],
  "infiniti q60": ["225/50R18", "245/40R19", "265/35R19"],
  "infiniti qx50": ["235/55R19", "255/45R20"],
  "infiniti qx60": ["235/65R18", "255/55R20"],
  "infiniti qx80": ["265/60R18", "275/50R22"],
  
  // Genesis
  "genesis g70": ["225/45R18", "225/40R19", "255/35R19"],
  "genesis g80": ["245/45R18", "245/40R19", "275/35R19"],
  "genesis g90": ["245/50R18", "275/35R20", "275/40R19"],
  "genesis gv70": ["235/55R19", "255/45R20"],
  "genesis gv80": ["255/55R19", "275/45R21", "275/40R22"],
  
  // Volvo
  "volvo s60": ["225/50R17", "235/45R18", "235/40R19"],
  "volvo s90": ["245/45R18", "245/40R19", "255/35R20"],
  "volvo xc40": ["235/55R18", "235/50R19", "235/45R20"],
  "volvo xc60": ["235/60R18", "235/55R19", "255/45R20"],
  "volvo xc90": ["235/60R19", "275/45R20", "275/40R21"],
  
  // Jaguar/Land Rover
  "jaguar f-pace": ["255/55R18", "255/50R19", "265/45R20", "265/40R21"],
  "jaguar f-type": ["245/45R18", "275/40R18", "265/35R20", "305/30R20"],
  "land rover range-rover": ["255/60R18", "275/50R20", "275/45R21", "285/40R22"],
  "land rover range-rover-sport": ["255/55R19", "275/45R21", "275/40R22"],
  "land rover defender": ["255/65R19", "275/55R20", "275/50R22"],
  
  // Alfa Romeo/Maserati
  "alfa-romeo giulia": ["225/50R17", "225/45R18", "225/40R19", "255/35R19"],
  "alfa-romeo stelvio": ["235/60R18", "255/45R20"],
  "maserati ghibli": ["235/50R18", "245/45R19", "285/35R20"],
  "maserati levante": ["265/50R19", "265/45R20", "295/35R21"],
};

let updated = 0;

for (const [vehicle, sizes] of Object.entries(vehicleSizes)) {
  const [make, model] = vehicle.split(" ");
  
  const result = await pool.query(
    "UPDATE vehicle_fitments SET oem_tire_sizes = $3::jsonb " +
    "WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2) " +
    "AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')",
    [make, model, JSON.stringify(sizes)]
  );
  
  if (result.rowCount > 0) {
    console.log(vehicle + ": " + result.rowCount + " records");
    updated += result.rowCount;
  }
}

console.log("\nTotal updated: " + updated);

// Final count
const missing = await pool.query(
  "SELECT COUNT(*) as cnt FROM vehicle_fitments " +
  "WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'"
);
const total = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments");

console.log("Total: " + total.rows[0].cnt);
console.log("Missing: " + missing.rows[0].cnt);
console.log("Coverage: " + ((1 - missing.rows[0].cnt / total.rows[0].cnt) * 100).toFixed(1) + "%");

await pool.end();
