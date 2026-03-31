import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  // Check model values for Ford
  const { rows } = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments WHERE make = 'ford'
  `);
  console.log("Ford models in DB:");
  rows.forEach(r => console.log(`  "${r.model}"`));
  
  // Check if there's a case mismatch for Mustang
  console.log("\nMustang variants:");
  const { rows: r2 } = await pool.query(`
    SELECT model, COUNT(*) as cnt FROM vehicle_fitments 
    WHERE make = 'ford' AND model ILIKE 'mustang'
    GROUP BY model
  `);
  r2.forEach(r => console.log(`  "${r.model}": ${r.cnt} records`));
  
  // Test exact query that listLocalFitments uses
  console.log("\nExact match (make='ford', model='mustang'):");
  const { rows: r3 } = await pool.query(`
    SELECT year, model, bolt_pattern FROM vehicle_fitments 
    WHERE make = 'ford' AND model = 'mustang' AND bolt_pattern IS NOT NULL
    LIMIT 5
  `);
  r3.forEach(r => console.log(`  ${r.year} ${r.model}: ${r.bolt_pattern}`));
  
} finally {
  await pool.end();
}
