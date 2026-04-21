import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const result = await pool.query(`
  SELECT year, oem_tire_sizes::text as tires 
  FROM vehicle_fitments 
  WHERE LOWER(model) = 'silverado' 
  ORDER BY year
`);

console.log("Silverado tire sizes by year:");
result.rows.forEach(r => {
  console.log(`  ${r.year}: ${r.tires || "[]"}`);
});

await pool.end();
