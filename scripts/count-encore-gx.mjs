import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const r = await pool.query(`
  SELECT COUNT(*) as total, 
         SUM(CASE WHEN bolt_pattern IS NULL OR bolt_pattern = '' THEN 1 ELSE 0 END) as no_bolt
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%gx%'
`);
console.log("Encore GX:", r.rows[0].total, "total,", r.rows[0].no_bolt, "without bolt pattern");

// Check specific years
const years = await pool.query(`
  SELECT year, COUNT(*) as cnt, bolt_pattern
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%gx%'
  GROUP BY year, bolt_pattern
  ORDER BY year
`);
console.log("\nBy year:");
years.rows.forEach(r => console.log(`  ${r.year}: ${r.cnt} records, bolt=${r.bolt_pattern || 'NULL'}`));

await pool.end();
