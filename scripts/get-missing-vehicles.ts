/**
 * Get vehicles with missing tire sizes or wheel specs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

// Load .env.local
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

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

async function main() {
  console.log("=== VEHICLES MISSING TIRE SIZES BY MAKE ===\n");
  
  // oem_tire_sizes is a JSONB array - empty array or NULL means missing
  // Use text cast to handle edge cases
  const byMake = await db.execute<{ make: string; count: string }>(sql`
    SELECT make, COUNT(*)::text as count
    FROM vehicle_fitments
    WHERE oem_tire_sizes::text = '[]' 
       OR oem_tire_sizes IS NULL
    GROUP BY make
    ORDER BY COUNT(*) DESC
  `);

  for (const row of byMake.rows) {
    console.log(`${row.make}: ${row.count}`);
  }
  
  console.log("\n=== TOP 50 VEHICLES MISSING TIRE SIZES ===\n");
  
  const byVehicle = await db.execute<{ make: string; model: string; count: string }>(sql`
    SELECT make, model, COUNT(*)::text as count
    FROM vehicle_fitments
    WHERE oem_tire_sizes::text = '[]' 
       OR oem_tire_sizes IS NULL
    GROUP BY make, model
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `);

  for (const row of byVehicle.rows) {
    console.log(`${row.make} ${row.model}: ${row.count}`);
  }
  
  console.log("\n=== PERFORMANCE VEHICLES MISSING TIRE DATA ===\n");
  
  // Focus on performance vehicles - Mustang, Camaro, Challenger, Charger, Corvette
  const perfVehicles = await db.execute<{ make: string; model: string; display_trim: string; years: string }>(sql`
    SELECT make, model, display_trim, 
           MIN(year)::text || '-' || MAX(year)::text as years
    FROM vehicle_fitments
    WHERE (oem_tire_sizes::text = '[]' OR oem_tire_sizes IS NULL)
      AND (
        model ILIKE '%Mustang%' OR
        model ILIKE '%Camaro%' OR
        model ILIKE '%Challenger%' OR
        model ILIKE '%Charger%' OR
        model ILIKE '%Corvette%' OR
        model ILIKE '%M3%' OR
        model ILIKE '%M4%' OR
        model ILIKE '%M5%' OR
        model ILIKE '%911%' OR
        model ILIKE '%GT-R%' OR
        model ILIKE '%WRX%' OR
        model ILIKE '%Type R%'
      )
    GROUP BY make, model, display_trim
    ORDER BY make, model, display_trim
  `);

  for (const row of perfVehicles.rows) {
    console.log(`${row.make} ${row.model} ${row.display_trim} (${row.years})`);
  }

  // Get total count
  const totalMissing = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text as count
    FROM vehicle_fitments
    WHERE oem_tire_sizes::text = '[]' 
       OR oem_tire_sizes IS NULL
  `);
  
  console.log(`\n=== TOTAL MISSING TIRE SIZES: ${totalMissing.rows[0].count} ===`);

  await pool.end();
}

main().catch(console.error);
