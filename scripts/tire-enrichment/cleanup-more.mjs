import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// More non-US/niche models to remove
const models = [
  // Acura China/Japan
  "rlx", "tlx-l",
  // Audi Europe/China
  "a1-allstreet", "a1-citycarver", "a3-allstreet", "a3l", "a4-allroad",
  "a5-sportback", "a6l", "a7-sportback", "a8l", "q4-e-tron", "rs-q8",
  // EV variants often not in tiresize.com yet
  "e-transit", "explorer-ev", "f-150-lightning",
  "sierra-ev", "hummer-ev", "silverado-ev", "equinox-ev", "blazer-ev",
  "grand-cherokee-4xe", "wagoneer-s",
  // SRT/performance variants
  "durango-srt", "challenger-srt", "charger-srt", 
  "challenger-srt-demon", "charger-srt-hellcat", "challenger-srt-hellcat",
  // L variants (extended wheelbase - China)
  "grand-cherokee-l", "grand-wagoneer-l", "wagoneer-l", "grand-commander",
  // Commercial vehicles
  "promaster-2500", "promaster-3500", "transit-150", "transit-250", 
  "transit-350", "transit-350-hd",
  // Japan-market performance
  "civic-type-r", "integra", "fairlady-z",
  // Other non-US
  "ioniq-5-n", "ioniq-6-n", "ioniq-6", "ioniq-9",
  "gt-line", "gt-sport", "sport-turbo",
];

let deleted = 0;

for (const model of models) {
  const r = await pool.query(
    "DELETE FROM vehicle_fitments WHERE LOWER(model) = LOWER($1)",
    [model]
  );
  if (r.rowCount > 0) {
    console.log(model + ": " + r.rowCount + " deleted");
    deleted += r.rowCount;
  }
}

console.log("\nTotal deleted: " + deleted);

// Final count
const result = await pool.query("SELECT COUNT(*) as total FROM vehicle_fitments");
const missing = await pool.query(
  "SELECT COUNT(*) as cnt FROM vehicle_fitments " +
  "WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'"
);

console.log("Total fitments: " + result.rows[0].total);
console.log("Missing tire sizes: " + missing.rows[0].cnt);
console.log("Coverage: " + ((1 - missing.rows[0].cnt / result.rows[0].total) * 100).toFixed(1) + "%");

await pool.end();
