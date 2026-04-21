/**
 * Enrich common US-market vehicles with known tire sizes
 */

import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Known tire sizes for common US vehicles
const KNOWN_SIZES = {
  // Acura
  "acura cl": ["205/65R15", "215/50R17", "225/50R17"],
  "acura cl-type-s": ["225/50R17"],
  "acura ilx": ["205/55R16", "215/45R17"],
  "acura integra-type-r": ["195/55R15", "215/45R16"],
  "acura integra-type-s": ["245/35R19", "265/35R19"],
  "acura nsx": ["215/45R17", "245/40R17", "245/40R19", "265/35R19", "305/30R19", "305/35R20"],
  "acura rdx": ["235/60R18", "235/55R19"],
  "acura rl": ["225/55R17", "245/45R18", "245/50R17"],
  "acura rsx": ["195/65R15", "205/55R16"],
  "acura rsx-type-s": ["205/55R16", "215/45R17"],
  "acura tl": ["215/55R16", "225/50R17", "235/45R18"],
  "acura tl-type-s": ["235/45R17", "245/45R17"],
  "acura tlx": ["225/50R17", "245/40R19", "245/35R20"],
  "acura tsx": ["215/55R17", "225/45R18"],
  "acura zdx": ["255/50R19"],
  
  // Popular Hondas
  "honda del-sol": ["185/60R14", "195/55R15"],
  "honda element": ["215/70R16", "225/65R17"],
  "honda fit": ["175/65R15", "185/55R16"],
  "honda prelude": ["195/60R15", "205/50R16", "215/45R17"],
  "honda s2000": ["205/55R16", "215/45R17", "225/45R17", "245/40R18"],
  
  // Performance vehicles
  "ford mustang-mach-1": ["255/40R19", "295/35R19"],
  "ford mustang-shelby-gt350": ["255/40R19", "295/35R19"],
  "ford mustang-shelby-gt500": ["265/40R19", "305/30R20"],
  "ford gt": ["235/35R20", "325/30R20"],
  "chevrolet corvette-z06": ["245/30R19", "285/30R19", "275/30R19", "335/25R20"],
  "chevrolet corvette-zr1": ["285/30R19", "335/25R20"],
  "chevrolet camaro-z28": ["285/30R19", "305/30R19"],
  "chevrolet camaro-zl1": ["285/30R20", "305/30R20"],
  "dodge viper": ["275/35R18", "345/30R19"],
  
  // Trucks
  "ford f-450-super-duty": ["225/70R19.5", "265/70R17"],
  "chevrolet silverado-2500-hd": ["245/75R17", "265/70R18", "275/65R20"],
  "chevrolet silverado-3500-hd": ["245/75R17", "265/70R18", "275/65R20"],
  "ram 1500-trx": ["325/65R18"],
  "ram 2500": ["245/70R17", "275/70R18"],
  "ram 3500": ["245/70R17", "275/70R18"],
  
  // SUVs
  "ford bronco": ["255/70R16", "255/75R17", "265/70R17", "285/70R17", "315/70R17"],
  "jeep grand-cherokee-srt": ["295/45R20"],
  "jeep grand-cherokee-trackhawk": ["295/45R20"],
  "jeep wrangler-unlimited": ["225/75R16", "245/75R17", "255/70R18", "285/70R17"],
  
  // Classics still registered
  "chevrolet camaro-ss": ["245/45R20", "275/40R20", "285/30R20"],
  "dodge challenger-srt": ["245/45R20", "275/40R20"],
  "dodge charger-srt": ["245/45R20", "275/40R20"],
  
  // Electric vehicles
  "ford mustang-mach-e": ["225/60R18", "225/55R19", "245/45R20"],
  "chevrolet bolt-ev": ["205/55R17", "215/50R17"],
  "chevrolet bolt-euv": ["215/50R17"],
  "tesla model-3": ["235/45R18", "235/40R19", "235/35R20"],
  "tesla model-y": ["255/45R19", "255/40R20", "255/35R21"],
  "tesla model-s": ["245/45R19", "265/35R21"],
  "tesla model-x": ["255/45R20", "265/35R22"],
  "rivian r1t": ["275/65R20", "275/55R22"],
  "rivian r1s": ["275/65R20", "275/55R22"],
};

async function main() {
  console.log("Enriching common US vehicles with known tire sizes\n");
  
  let updated = 0;
  let notFound = 0;
  
  for (const [vehicle, sizes] of Object.entries(KNOWN_SIZES)) {
    const [make, model] = vehicle.split(" ");
    
    const result = await pool.query(
      "UPDATE vehicle_fitments SET oem_tire_sizes = $3::jsonb " +
      "WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2) " +
      "AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')",
      [make, model, JSON.stringify(sizes)]
    );
    
    if (result.rowCount > 0) {
      console.log(vehicle + ": " + result.rowCount + " records → " + sizes.join(", "));
      updated += result.rowCount;
    } else {
      notFound++;
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("Updated: " + updated + " records");
  console.log("Not found/already filled: " + notFound);
  
  // Final count
  const remaining = await pool.query(
    "SELECT COUNT(*) as cnt FROM vehicle_fitments " +
    "WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'"
  );
  console.log("Still missing: " + remaining.rows[0].cnt);
  
  await pool.end();
}

main().catch(console.error);
