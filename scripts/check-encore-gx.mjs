import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const result = await pool.query(`
  SELECT display_trim, modification_id, oem_wheel_sizes, oem_tire_sizes, source
  FROM vehicle_fitments 
  WHERE year = 2022 AND LOWER(make) = 'buick' AND LOWER(model) = 'encore gx'
  ORDER BY display_trim
`);

console.log("2022 Buick Encore GX fitments:\n");
result.rows.forEach(row => {
  console.log(`${row.display_trim} (${row.modification_id}):`);
  console.log(`  Wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
  console.log(`  Tires: ${JSON.stringify(row.oem_tire_sizes)}`);
  console.log(`  Source: ${row.source}`);
  console.log();
});

await pool.end();
