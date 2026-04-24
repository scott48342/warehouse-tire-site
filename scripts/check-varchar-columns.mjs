import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const result = await pool.query(`
  SELECT column_name, data_type, character_maximum_length 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments' 
  AND character_maximum_length IS NOT NULL
  ORDER BY character_maximum_length
`);

console.log("VARCHAR columns in vehicle_fitments:");
result.rows.forEach(r => {
  console.log(`  ${r.column_name}: varchar(${r.character_maximum_length})`);
});

await pool.end();
