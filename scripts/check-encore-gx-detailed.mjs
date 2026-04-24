import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Check ALL records for 2022 Encore GX
const all = await pool.query(`
  SELECT id, modification_id, display_trim, raw_trim, oem_wheel_sizes, oem_tire_sizes, source, quality_tier
  FROM vehicle_fitments 
  WHERE year = 2022 AND LOWER(make) = 'buick' AND LOWER(model) = 'encore gx'
  ORDER BY source, display_trim
`);

console.log(`Found ${all.rows.length} records for 2022 Buick Encore GX:\n`);
all.rows.forEach(row => {
  console.log(`ID: ${row.id}`);
  console.log(`  modification_id: ${row.modification_id}`);
  console.log(`  display_trim: ${row.display_trim}`);
  console.log(`  raw_trim: ${row.raw_trim}`);
  console.log(`  source: ${row.source}`);
  console.log(`  quality_tier: ${row.quality_tier}`);
  console.log(`  wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
  console.log(`  tires: ${JSON.stringify(row.oem_tire_sizes)}`);
  console.log();
});

await pool.end();
