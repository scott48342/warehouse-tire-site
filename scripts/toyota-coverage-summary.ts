import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Total Toyota records
  const total = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = 'toyota'
  `);
  
  // Complete with all data
  const complete = await pool.query(`
    SELECT COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND quality_tier = 'complete'
      AND oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes != '[]'::jsonb
      AND oem_tire_sizes IS NOT NULL
      AND oem_tire_sizes != '[]'::jsonb
  `);
  
  // With bolt pattern
  const withBolt = await pool.query(`
    SELECT COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota' 
      AND bolt_pattern IS NOT NULL
  `);
  
  console.log('Toyota Fitment Coverage Summary');
  console.log('================================');
  console.log(`Total Records: ${total.rows[0].cnt}`);
  console.log(`Complete (wheels + tires): ${complete.rows[0].cnt}`);
  console.log(`With Bolt Pattern: ${withBolt.rows[0].cnt}`);
  console.log(`Coverage: ${(parseInt(complete.rows[0].cnt) / parseInt(total.rows[0].cnt) * 100).toFixed(1)}%`);
  
  // Model breakdown
  console.log('\n\nModel Breakdown (normalized):');
  console.log('==============================');
  
  const breakdown = await pool.query(`
    SELECT 
      LOWER(REPLACE(model, ' ', '-')) as normalized_model,
      COUNT(*) as cnt,
      COUNT(*) FILTER (WHERE oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb) as with_wheels,
      MIN(year) as min_year,
      MAX(year) as max_year
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'toyota'
    GROUP BY LOWER(REPLACE(model, ' ', '-'))
    ORDER BY cnt DESC
  `);
  
  for (const row of breakdown.rows) {
    const coverage = (parseInt(row.with_wheels) / parseInt(row.cnt) * 100).toFixed(0);
    console.log(`  ${row.normalized_model}: ${row.cnt} records (${row.min_year}-${row.max_year}) - ${coverage}% complete`);
  }
  
  await pool.end();
}

main().catch(console.error);
