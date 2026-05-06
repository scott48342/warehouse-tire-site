import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check what 22" OEM tire sizes exist for GM trucks
  const result = await pool.query(`
    SELECT DISTINCT year, model, display_trim,
           oem_wheel_sizes::text as wheel_sizes,
           oem_tire_sizes::text as tire_sizes
    FROM vehicle_fitments 
    WHERE make IN ('Chevrolet', 'GMC') 
      AND (model LIKE '%Silverado%' OR model LIKE '%Sierra%')
      AND oem_tire_sizes::text LIKE '%R22%'
    ORDER BY year DESC, model, display_trim
    LIMIT 50
  `);
  
  console.log('GM trucks with factory 22" tire sizes:\n');
  
  // Collect unique tire sizes
  const allSizes = new Set<string>();
  
  result.rows.forEach(r => {
    console.log(`${r.year} ${r.model} ${r.display_trim || ''}`);
    console.log(`  Tires: ${r.tire_sizes}`);
    console.log(`  Wheels: ${r.wheel_sizes}\n`);
    
    // Parse tire sizes
    try {
      const sizes = JSON.parse(r.tire_sizes);
      sizes.forEach((s: string) => {
        if (s.includes('R22')) allSizes.add(s);
      });
    } catch {}
  });
  
  console.log('\n=== Unique OEM 22" tire sizes for GM trucks ===');
  console.log([...allSizes].sort());
  
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
