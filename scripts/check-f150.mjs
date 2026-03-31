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
    SELECT year, display_trim, bolt_pattern, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE year = 2004 AND make ILIKE 'ford' AND model ILIKE 'f-150'
    LIMIT 5
  `);
  
  console.log("2004 Ford F-150 fitments:");
  if (rows.length === 0) {
    console.log("  (none found)");
  } else {
    for (const row of rows) {
      console.log(`  ${row.display_trim}: bolt=${row.bolt_pattern}, sizes=${JSON.stringify(row.oem_tire_sizes)}`);
    }
  }
  
} finally {
  await pool.end();
}
