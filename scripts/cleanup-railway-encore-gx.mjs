import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Delete the old railway_783 record for 2022 Encore GX
const r = await pool.query(`
  DELETE FROM vehicle_fitments 
  WHERE modification_id = 'railway_783'
  RETURNING year, make, model, display_trim, modification_id
`);

console.log(`Deleted ${r.rows.length} record(s):`);
r.rows.forEach(row => {
  console.log(`  ${row.year} ${row.make} ${row.model} - ${row.display_trim} (${row.modification_id})`);
});

await pool.end();
