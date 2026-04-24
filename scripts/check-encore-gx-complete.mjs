import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const r = await pool.query(`
  SELECT display_trim, bolt_pattern, center_bore_mm, thread_size, seat_type, 
         offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes
  FROM vehicle_fitments 
  WHERE year = 2022 AND LOWER(make) = 'buick' AND LOWER(model) = 'encore gx'
    AND modification_id = 'buick-encore-gx-preferred-ff350f80'
`);

console.log("Preferred trim complete data:");
const row = r.rows[0];
console.log("  bolt_pattern:", row.bolt_pattern);
console.log("  center_bore_mm:", row.center_bore_mm);
console.log("  thread_size:", row.thread_size);
console.log("  seat_type:", row.seat_type);
console.log("  offset_min_mm:", row.offset_min_mm);
console.log("  offset_max_mm:", row.offset_max_mm);
console.log("  oem_wheel_sizes:", JSON.stringify(row.oem_wheel_sizes));
console.log("  oem_tire_sizes:", JSON.stringify(row.oem_tire_sizes));

await pool.end();
