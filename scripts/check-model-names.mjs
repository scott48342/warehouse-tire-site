import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const r = await pool.query(`
  SELECT DISTINCT model 
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%'
`);

console.log("Buick Encore model names:");
r.rows.forEach(row => console.log(`  "${row.model}"`));

await pool.end();
