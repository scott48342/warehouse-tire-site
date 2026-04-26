import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const remaining = await pool.query(`
    SELECT id, year, make, model, display_trim, quality_tier, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE (LOWER(make) = 'chevrolet' OR LOWER(make) = 'gmc')
      AND quality_tier IN ('unknown', 'partial')
    ORDER BY make, model, year
  `);
  
  console.log('=== REMAINING CHEVY/GMC RECORDS ===');
  remaining.rows.forEach((r: any) => {
    console.log(`${r.year} ${r.make} ${r.model} ${r.display_trim}: ${r.quality_tier}`);
    console.log(`  wheels: ${JSON.stringify(r.oem_wheel_sizes)?.slice(0,80)}`);
    console.log(`  tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  });
  
  await pool.end();
}
main().catch(console.error);
