import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Models that still need processing (not complete)
  const res = await pool.query(`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND (quality_tier IS NULL OR quality_tier != 'complete')
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  
  console.log('Toyota Models Needing Processing:');
  console.log('==================================');
  let total = 0;
  for (const row of res.rows) {
    console.log(`  ${row.model}: ${row.cnt}`);
    total += parseInt(row.cnt);
  }
  console.log(`\nTotal: ${total} records`);
  
  // Also show completed models
  const completed = await pool.query(`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND quality_tier = 'complete'
    GROUP BY model 
    ORDER BY cnt DESC
  `);
  
  console.log('\n\nCompleted Toyota Models:');
  console.log('========================');
  let totalComplete = 0;
  for (const row of completed.rows) {
    console.log(`  ${row.model}: ${row.cnt}`);
    totalComplete += parseInt(row.cnt);
  }
  console.log(`\nTotal Complete: ${totalComplete} records`);
  
  await pool.end();
}

main().catch(console.error);
