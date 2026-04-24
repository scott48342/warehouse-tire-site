import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Find the railway_783 record
const r = await pool.query(`
  SELECT id, year, make, model, modification_id, display_trim, raw_trim, oem_wheel_sizes, oem_tire_sizes, source
  FROM vehicle_fitments 
  WHERE modification_id = 'railway_783' OR modification_id LIKE '%railway%'
  LIMIT 10
`);

console.log(`Found ${r.rows.length} railway records:`);
r.rows.forEach(row => {
  console.log(`${row.year} ${row.make} ${row.model} - ${row.display_trim}`);
  console.log(`  mod_id: ${row.modification_id}`);
  console.log(`  source: ${row.source}`);
  console.log(`  wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
  console.log();
});

await pool.end();
