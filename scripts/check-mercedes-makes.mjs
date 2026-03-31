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

const failingYears = [1994, 1996, 1999, 2001, 2007, 2012];

try {
  console.log("Checking make values for failing Mercedes years:\n");
  
  for (const year of failingYears) {
    const { rows } = await pool.query(`
      SELECT DISTINCT make 
      FROM vehicle_fitments 
      WHERE year = $1 AND (model ILIKE '%s-class%' OR model ILIKE '%gle%')
    `, [year]);
    
    console.log(`${year}: ${rows.map(r => r.make).join(', ') || '(none)'}`);
  }
  
  // Fix: Update all mercedes-benz to mercedes
  console.log("\n--- Fixing mercedes-benz → mercedes ---\n");
  
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET make = 'mercedes', updated_at = NOW()
    WHERE make = 'mercedes-benz'
    RETURNING id
  `);
  
  console.log(`Updated ${result.rowCount} records from mercedes-benz to mercedes`);
  
} finally {
  await pool.end();
}
