import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check all makes/models that have 22" OEM data
  const result22 = await pool.query(`
    SELECT DISTINCT make, 
           SUBSTRING(model FROM '^[^0-9]+') as model_base,
           array_agg(DISTINCT year ORDER BY year DESC) as years
    FROM vehicle_fitments 
    WHERE jsonb_typeof(oem_wheel_sizes) = 'array'
      AND EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(oem_wheel_sizes) as wheel
        WHERE (wheel->>'diameter')::numeric = 22
      )
    GROUP BY make, SUBSTRING(model FROM '^[^0-9]+')
    ORDER BY make, model_base
  `);
  
  console.log('=== Vehicles with OEM 22" wheel data (will auto-suggest sizes) ===\n');
  result22.rows.forEach(r => {
    console.log(`${r.make} ${r.model_base}: ${r.years.slice(0, 5).join(', ')}${r.years.length > 5 ? '...' : ''}`);
  });
  console.log(`\nTotal: ${result22.rows.length} vehicle families with 22" OEM data`);

  // Check 20" coverage
  const result20 = await pool.query(`
    SELECT DISTINCT make, 
           SUBSTRING(model FROM '^[^0-9]+') as model_base
    FROM vehicle_fitments 
    WHERE jsonb_typeof(oem_wheel_sizes) = 'array'
      AND EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(oem_wheel_sizes) as wheel
        WHERE (wheel->>'diameter')::numeric = 20
      )
    GROUP BY make, SUBSTRING(model FROM '^[^0-9]+')
    ORDER BY make, model_base
  `);
  
  console.log(`\n=== 20" OEM coverage: ${result20.rows.length} vehicle families ===`);

  // Check 24" coverage
  const result24 = await pool.query(`
    SELECT DISTINCT make, 
           SUBSTRING(model FROM '^[^0-9]+') as model_base
    FROM vehicle_fitments 
    WHERE jsonb_typeof(oem_wheel_sizes) = 'array'
      AND EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(oem_wheel_sizes) as wheel
        WHERE (wheel->>'diameter')::numeric = 24
      )
    GROUP BY make, SUBSTRING(model FROM '^[^0-9]+')
    ORDER BY make, model_base
  `);
  
  console.log(`\n=== 24" OEM coverage: ${result24.rows.length} vehicle families ===`);
  if (result24.rows.length > 0) {
    result24.rows.forEach(r => console.log(`  ${r.make} ${r.model_base}`));
  }

  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
