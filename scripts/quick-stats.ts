import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

async function main() {
  const stats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_records,
      SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_tires,
      SUM(CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_wheels,
      SUM(CASE WHEN quality_tier = 'complete' THEN 1 ELSE 0 END) as complete_tier
    FROM vehicle_fitments
  `);
  console.log("=== FITMENT DATABASE STATS (After Updates) ===");
  console.log("Total records:", (stats.rows[0] as any).total_records);
  console.log("Missing tire sizes:", (stats.rows[0] as any).missing_tires);
  console.log("Missing wheel specs:", (stats.rows[0] as any).missing_wheels);
  console.log("Complete tier:", (stats.rows[0] as any).complete_tier);
  await pool.end();
}
main();
