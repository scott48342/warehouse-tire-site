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
  const { rows } = await pool.query(`
    SELECT DISTINCT make, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE make ILIKE '%mercedes%'
    GROUP BY make
  `);
  
  console.log("Mercedes makes now:");
  rows.forEach(r => console.log(`  ${r.make}: ${r.cnt}`));
  
} finally {
  await pool.end();
}
