import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Update remaining Chevy/GMC records that have wheel data but aren't marked complete
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET quality_tier = 'complete', 
        source = COALESCE(source, 'chevy-gmc-cleanup'),
        updated_at = NOW()
    WHERE (LOWER(make) = 'chevrolet' OR LOWER(make) = 'gmc')
      AND quality_tier IN ('unknown', 'partial')
      AND oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes::text != '[]'
    RETURNING id, year, make, model
  `);
  
  console.log('Updated ' + result.rowCount + ' records to complete');
  result.rows.forEach((r: any) => console.log('  ' + r.year + ' ' + r.make + ' ' + r.model));
  await pool.end();
}
main().catch(console.error);
