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
  // Check exact make values in DB
  const { rows } = await pool.query(`
    SELECT DISTINCT make FROM vehicle_fitments 
    WHERE make ILIKE 'ford' OR make ILIKE 'toyota' OR make ILIKE 'chrysler'
  `);
  console.log("Distinct make values in DB:");
  rows.forEach(r => console.log(`  "${r.make}"`));
  
  // Check case-sensitive query (what Drizzle eq() does)
  console.log("\nCase-sensitive query (make = 'ford'):");
  const { rows: r1 } = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'ford'`);
  console.log(`  Results: ${r1[0].cnt}`);
  
  console.log("\nCase-sensitive query (make = 'Ford'):");
  const { rows: r2 } = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'Ford'`);
  console.log(`  Results: ${r2[0].cnt}`);
  
} finally {
  await pool.end();
}
