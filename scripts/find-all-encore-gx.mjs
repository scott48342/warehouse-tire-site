import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Find ALL Encore GX records in all years
const r = await pool.query(`
  SELECT id, year, modification_id, display_trim, raw_trim, source, quality_tier
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%gx%'
  ORDER BY year, display_trim
`);

console.log(`Found ${r.rows.length} Encore GX records:\n`);
r.rows.forEach(row => {
  console.log(`${row.year}: ${row.display_trim} (${row.modification_id}) - source: ${row.source}`);
});

await pool.end();
