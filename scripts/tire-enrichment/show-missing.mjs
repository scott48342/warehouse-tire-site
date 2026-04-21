import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Find US-market vehicles still missing tire sizes
// Exclude known non-US model patterns
const result = await pool.query(`
  SELECT year, make, model, display_trim 
  FROM vehicle_fitments 
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')
    AND year >= 2015
    AND LOWER(make) IN ('ford', 'chevrolet', 'toyota', 'honda', 'ram', 'jeep', 'dodge', 'gmc', 'nissan')
    AND LOWER(model) NOT LIKE '%hybrid%'
    AND LOWER(model) NOT LIKE '%-ev%'
    AND LOWER(model) NOT LIKE '%ramcharger%'
    AND LOWER(model) NOT LIKE '%rev%'
    AND LOWER(model) NOT LIKE '%rho%'
    AND LOWER(model) NOT LIKE '%max%'
    AND LOWER(model) NOT LIKE '%plus%'
    AND LOWER(model) NOT LIKE '%-ld%'
    AND LOWER(model) NOT LIKE '%euv%'
    AND LOWER(model) NOT LIKE '%van%'
    AND LOWER(model) NOT LIKE '%savana%'
  ORDER BY make, model, year DESC
  LIMIT 30
`);

console.log("US-market vehicles missing tire sizes:\n");
result.rows.forEach(r => {
  console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim || ""}`);
});

await pool.end();
