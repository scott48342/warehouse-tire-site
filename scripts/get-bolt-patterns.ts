/**
 * Get bolt patterns from existing records
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Get bolt patterns from prior years
  const sc = await pool.query(`SELECT DISTINCT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE LOWER(model) = 'santa cruz' AND bolt_pattern IS NOT NULL LIMIT 1`);
  console.log('Santa Cruz bolt:', sc.rows[0] || 'NOT FOUND');
  
  const sf = await pool.query(`SELECT DISTINCT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE LOWER(model) = 'santa fe' AND bolt_pattern IS NOT NULL LIMIT 1`);
  console.log('Santa Fe bolt:', sf.rows[0] || 'NOT FOUND');
  
  const cv = await pool.query(`SELECT DISTINCT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE LOWER(model) = 'carnival' AND bolt_pattern IS NOT NULL LIMIT 1`);
  console.log('Carnival bolt:', cv.rows[0] || 'NOT FOUND');
  
  const k5 = await pool.query(`SELECT DISTINCT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE LOWER(model) = 'k5' AND bolt_pattern IS NOT NULL LIMIT 1`);
  console.log('K5 bolt:', k5.rows[0] || 'NOT FOUND');
  
  await pool.end();
}

main().catch(console.error);
