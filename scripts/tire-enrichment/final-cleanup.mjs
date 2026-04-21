import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// More non-US models (L = long wheelbase China, sportback = Europe)
const nonUS = [
  "a4l", "a5-sportback", "a7-sportback", "s5-sportback", "rs5-sportback",
  "q4l", "q5l", "q5-e", "e-tron-gt", "rs-e-tron-gt",
  "a3-sportback", "s3-sportback", "rs3-sportback",
  // More regional Audis
  "q2l", "q3-sportback", "a4-avant", "a6-avant", "rs4-avant", "rs6-avant",
  // Hyundai regional
  "h-100", "hb20", "hb20s", "hr", "i30-sedan", "i30-sedan-n",
  "inster", "kauai", "porter", "stargazer", "stargazer-x", "st1",
  "grand-i10-nios", "ioniq-5-n", "ioniq-6-n",
  // Kia regional  
  "syros", "tasman", "cerato-k3", "forte5", "frontier", "k2500", "k2700",
  "soluto", "towner",
  // Others
  "beat", "beat-nb", "aveo-family", "captiva-sport", "brightdrop", "cavalier",
  "equinox-plus", "s10-max", "savana", "silverado-ld", "spark-euv", "tornado-van",
  "elevate", "n-one-e", "ariya",
  "1500-ramcharger", "1500-rev", "1500-rho", "dakota",
  "santa-cruz", "sonata-hybrid", "nexo",
];

let deleted = 0;
for (const model of nonUS) {
  const r = await pool.query(
    "DELETE FROM vehicle_fitments WHERE LOWER(model) = LOWER($1)",
    [model]
  );
  if (r.rowCount > 0) {
    console.log(model + ": " + r.rowCount);
    deleted += r.rowCount;
  }
}

console.log("\nDeleted: " + deleted);

// Final count
const total = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments");
const missing = await pool.query(
  "SELECT COUNT(*) as cnt FROM vehicle_fitments " +
  "WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'"
);

console.log("Total: " + total.rows[0].cnt);
console.log("Missing: " + missing.rows[0].cnt);
console.log("Coverage: " + ((1 - missing.rows[0].cnt / total.rows[0].cnt) * 100).toFixed(1) + "%");

await pool.end();
