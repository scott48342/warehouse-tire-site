import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const r = await pool.query(`
  SELECT id, make, model, display_trim, modification_id, source
  FROM vehicle_fitments 
  WHERE year = 2022 AND LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%gx%'
`);

console.log(`2022 Buick Encore GX records (${r.rows.length}):`);
r.rows.forEach(row => {
  console.log(`  make="${row.make}" model="${row.model}" trim="${row.display_trim}"`);
  console.log(`    mod_id=${row.modification_id}, source=${row.source}`);
});

await pool.end();
