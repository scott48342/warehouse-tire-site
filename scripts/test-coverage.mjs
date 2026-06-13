/**
 * Quick coverage test script
 * Run with: node --env-file=.env.local scripts/test-coverage.mjs
 */

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

async function main() {
  console.log("Testing DB connection...");
  
  // Get total certified records
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE certification_status = 'certified'
  `);
  const total = totalResult.rows[0].count;
  
  // Get distinct YMM combinations
  const distinct = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT DISTINCT year, make, model FROM vehicle_fitments
      WHERE certification_status = 'certified'
    ) t
  `);
  
  // Get sample vehicles
  const samples = await db.execute(sql`
    SELECT DISTINCT year, make, model 
    FROM vehicle_fitments 
    WHERE certification_status = 'certified'
    ORDER BY make, model, year
    LIMIT 20
  `);
  
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("FITMENT DATABASE STATS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total certified fitment records: ${total}`);
  console.log(`Distinct YMM combinations: ${distinct.rows[0].count}`);
  console.log("\nSample vehicles:");
  samples.rows.forEach(v => {
    console.log(`  ${v.year} ${v.make} ${v.model}`);
  });
  console.log("═══════════════════════════════════════════════════════════\n");
  
  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
