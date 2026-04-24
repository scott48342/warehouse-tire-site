import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Check all years
const years = await pool.query(`
  SELECT DISTINCT year FROM vehicle_fitments 
  WHERE LOWER(make) = 'buick' AND LOWER(model) = 'encore gx' 
  ORDER BY year
`);
console.log("Years with data:", years.rows.map(x => x.year).join(', ') || "NONE");

// Check 2022 specifically  
const r2022 = await pool.query(`
  SELECT display_trim, oem_wheel_sizes, oem_tire_sizes, source
  FROM vehicle_fitments 
  WHERE year = 2022 AND LOWER(make) = 'buick' AND LOWER(model) = 'encore gx'
`);
console.log("\n2022 records:", r2022.rows.length);
r2022.rows.forEach(row => {
  console.log(`  ${row.display_trim}: wheels=${JSON.stringify(row.oem_wheel_sizes)}, tires=${JSON.stringify(row.oem_tire_sizes)}`);
});

// Check 2024
const r2024 = await pool.query(`
  SELECT display_trim, oem_wheel_sizes, oem_tire_sizes, source
  FROM vehicle_fitments 
  WHERE year = 2024 AND LOWER(make) = 'buick' AND LOWER(model) = 'encore gx'
`);
console.log("\n2024 records:", r2024.rows.length);
r2024.rows.forEach(row => {
  console.log(`  ${row.display_trim}: wheels=${JSON.stringify(row.oem_wheel_sizes)}, tires=${JSON.stringify(row.oem_tire_sizes)}`);
});

await pool.end();
