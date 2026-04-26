import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const chevy = await pool.query(`
    SELECT quality_tier, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' 
    GROUP BY quality_tier 
    ORDER BY cnt DESC
  `);
  console.log('=== CHEVROLET FINAL STATE ===');
  chevy.rows.forEach((r: any) => console.log(r.quality_tier + ': ' + r.cnt));
  
  const gmc = await pool.query(`
    SELECT quality_tier, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'gmc' 
    GROUP BY quality_tier 
    ORDER BY cnt DESC
  `);
  console.log('\n=== GMC FINAL STATE ===');
  gmc.rows.forEach((r: any) => console.log(r.quality_tier + ': ' + r.cnt));
  
  await pool.end();
}
main().catch(console.error);
