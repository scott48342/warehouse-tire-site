/**
 * Mercedes Coverage Test
 * Run with: node --env-file=.env.local scripts/mercedes-coverage.mjs
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
  console.log("═══════════════════════════════════════════════════════════");
  console.log("MERCEDES COVERAGE ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  // Get all Mercedes models in DB
  const mercedesModels = await db.execute(sql`
    SELECT DISTINCT model, MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as trim_count
    FROM vehicle_fitments 
    WHERE certification_status = 'certified'
      AND (make ILIKE '%Mercedes%' OR make ILIKE '%Benz%')
    GROUP BY model
    ORDER BY model
  `);
  
  console.log(`Total distinct Mercedes models in DB: ${mercedesModels.rows.length}\n`);
  console.log("Models in DB:");
  console.log("─────────────────────────────────────────────────────────────");
  for (const m of mercedesModels.rows) {
    console.log(`  ${m.model.padEnd(25)} | Years: ${m.min_year}-${m.max_year} | Trims: ${m.trim_count}`);
  }
  
  // Check specific failing models
  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("CHECKING FAILING MODELS FROM COVERAGE REPORT");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  const failingCombos = [
    { year: 1987, model: "e-class" },
    { year: 1991, model: "s-class" },
    { year: 2010, model: "e-class-coupe" },
    { year: 2004, model: "m-class" },
    { year: 2010, model: "cls-class" },
    { year: 2021, model: "A-Class AMG" },
    { year: 2010, model: "e-class-amg" },
    { year: 2003, model: "s-class-amg" },
    { year: 2022, model: "gla-class" },
    { year: 2022, model: "c-class-amg" },
    { year: 1989, model: "s-class" },
    { year: 2015, model: "amg-gt" },
    { year: 2022, model: "cla-class" },
    { year: 2022, model: "cls-class-amg" },
    { year: 2016, model: "amg-gt" },
  ];
  
  for (const fc of failingCombos) {
    // Try exact model match
    const exact = await db.execute(sql`
      SELECT year, make, model, display_trim
      FROM vehicle_fitments 
      WHERE certification_status = 'certified'
        AND year = ${fc.year}
        AND (make ILIKE '%Mercedes%' OR make ILIKE '%Benz%')
        AND model ILIKE ${`%${fc.model.replace(/-/g, '%')}%`}
      LIMIT 3
    `);
    
    if (exact.rows.length > 0) {
      console.log(`✓ ${fc.year} ${fc.model} → FOUND as: ${exact.rows[0].model}`);
    } else {
      // Check what models exist for that year
      const yearModels = await db.execute(sql`
        SELECT DISTINCT model 
        FROM vehicle_fitments 
        WHERE certification_status = 'certified'
          AND year = ${fc.year}
          AND (make ILIKE '%Mercedes%' OR make ILIKE '%Benz%')
        ORDER BY model
      `);
      
      if (yearModels.rows.length === 0) {
        console.log(`✗ ${fc.year} ${fc.model} → NO MERCEDES DATA for year ${fc.year}`);
      } else {
        console.log(`✗ ${fc.year} ${fc.model} → Not found. Models available for ${fc.year}:`);
        console.log(`    ${yearModels.rows.map(r => r.model).join(", ")}`);
      }
    }
  }
  
  console.log("\n═══════════════════════════════════════════════════════════\n");
  
  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
