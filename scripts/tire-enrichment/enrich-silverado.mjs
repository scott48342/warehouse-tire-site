import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Silverado 1500 tire sizes from web search
const silveradoSizes = [
  "255/70R17", "265/70R17", "265/65R18", "275/65R18", 
  "275/60R20", "275/50R22"
];

const result = await pool.query(
  "UPDATE vehicle_fitments SET oem_tire_sizes = $1::jsonb " +
  "WHERE LOWER(model) = 'silverado' " +
  "AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')",
  [JSON.stringify(silveradoSizes)]
);

console.log("Updated Silverado records: " + result.rowCount);
console.log("Tire sizes: " + silveradoSizes.join(", "));

await pool.end();
