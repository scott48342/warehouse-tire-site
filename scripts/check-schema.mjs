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

const result = await pool.query(`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments'
  ORDER BY ordinal_position
`);

console.log('Columns in vehicle_fitments:');
for (const row of result.rows) {
  console.log(`  ${row.column_name}`);
}

await pool.end();
