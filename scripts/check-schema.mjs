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
  // Get table names
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%fitment%' OR table_name LIKE '%vehicle%'
  `);
  console.log("Fitment/vehicle tables:", tables.map(t => t.table_name));
  
  // Check vehicle_fitments columns
  const { rows: cols } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments'
  `);
  console.log("\nvehicle_fitments columns:");
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  
} finally {
  await pool.end();
}
