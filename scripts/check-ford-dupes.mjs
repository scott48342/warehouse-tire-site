import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  // Check for duplicate Ford models in vehicle_fitments
  console.log("=== Duplicate Ford models in vehicle_fitments ===\n");
  
  const { rows } = await pool.query(`
    SELECT year, make, model, COUNT(*) as cnt, 
           array_agg(DISTINCT display_trim) as trims,
           array_agg(DISTINCT source) as sources
    FROM vehicle_fitments 
    WHERE make ILIKE 'ford' AND model ILIKE 'f-250'
    GROUP BY year, make, model
    ORDER BY year DESC
    LIMIT 10
  `);
  
  console.log("F-250 entries:");
  rows.forEach(r => console.log(`  ${r.year}: ${r.cnt} records, sources: ${r.sources}`));
  
  // Check the vehicles catalog table
  console.log("\n=== Checking vehicles catalog ===\n");
  
  const { rows: catRows } = await pool.query(`
    SELECT model, COUNT(*) as cnt
    FROM vehicles
    WHERE make ILIKE 'ford' AND model ILIKE '%f-250%'
    GROUP BY model
  `);
  
  console.log("F-250 in vehicles catalog:");
  catRows.forEach(r => console.log(`  "${r.model}": ${r.cnt} records`));
  
  // Check for model variations
  const { rows: variations } = await pool.query(`
    SELECT DISTINCT model 
    FROM vehicle_fitments 
    WHERE make ILIKE 'ford' AND (model ILIKE 'f-250%' OR model ILIKE 'f-350%')
  `);
  
  console.log("\nF-250/F-350 model variations:");
  variations.forEach(r => console.log(`  "${r.model}"`));
  
} finally {
  await pool.end();
}
