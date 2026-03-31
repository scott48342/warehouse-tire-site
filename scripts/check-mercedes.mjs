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
  // Check Mercedes makes in DB
  console.log("=== Mercedes makes in vehicle_fitments ===\n");
  
  const { rows: makes } = await pool.query(`
    SELECT DISTINCT make, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE make ILIKE '%mercedes%' OR make ILIKE '%benz%'
    GROUP BY make
  `);
  console.log("Makes found:");
  makes.forEach(r => console.log(`  "${r.make}": ${r.cnt} records`));
  
  // Check S-Class variations
  console.log("\n=== S-Class model variations ===\n");
  
  const { rows: sclass } = await pool.query(`
    SELECT DISTINCT model, year, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE make ILIKE '%mercedes%' AND model ILIKE '%s-class%'
    GROUP BY model, year
    ORDER BY year DESC
    LIMIT 10
  `);
  console.log("S-Class entries:");
  sclass.forEach(r => console.log(`  ${r.year} "${r.model}": ${r.cnt}`));
  
  // Check GLE variations
  console.log("\n=== GLE model variations ===\n");
  
  const { rows: gle } = await pool.query(`
    SELECT DISTINCT model, year, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE make ILIKE '%mercedes%' AND model ILIKE '%gle%'
    GROUP BY model, year
    ORDER BY year DESC
    LIMIT 10
  `);
  console.log("GLE entries:");
  gle.forEach(r => console.log(`  ${r.year} "${r.model}": ${r.cnt}`));
  
  // Check what years are failing
  const failingYears = [1994, 1996, 1999, 2001, 2007, 2012];
  console.log("\n=== Checking failing years ===\n");
  
  for (const year of failingYears) {
    const { rows } = await pool.query(`
      SELECT model, bolt_pattern, oem_tire_sizes
      FROM vehicle_fitments 
      WHERE make ILIKE '%mercedes%' 
        AND (model ILIKE '%s-class%' OR model ILIKE '%gle%')
        AND year = $1
      LIMIT 3
    `, [year]);
    
    console.log(`${year}:`);
    if (rows.length === 0) {
      console.log("  (none found)");
    } else {
      rows.forEach(r => console.log(`  ${r.model}: bolt=${r.bolt_pattern}`));
    }
  }
  
} finally {
  await pool.end();
}
