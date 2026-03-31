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

const vehicles = [
  { year: 2021, make: 'Ford', model: 'Mustang' },
  { year: 2022, make: 'Toyota', model: 'Sienna' },
];

try {
  console.log("Full fitment records for failed vehicles:\n");
  
  for (const v of vehicles) {
    const { rows } = await pool.query(`
      SELECT 
        id, year, make, model, display_trim, 
        bolt_pattern, center_bore_mm,
        oem_wheel_sizes, oem_tire_sizes, source
      FROM vehicle_fitments 
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
      LIMIT 2
    `, [v.year, v.make, v.model]);
    
    console.log(`=== ${v.year} ${v.make} ${v.model} ===`);
    for (const row of rows) {
      console.log(`\nTrim: ${row.display_trim || '(base)'}`);
      console.log(`  Bolt: ${row.bolt_pattern}, CB: ${row.center_bore_mm}`);
      console.log(`  Source: ${row.source}`);
      console.log(`  oem_tire_sizes type: ${typeof row.oem_tire_sizes}`);
      console.log(`  oem_tire_sizes: ${JSON.stringify(row.oem_tire_sizes, null, 2)}`);
      console.log(`  oem_wheel_sizes type: ${typeof row.oem_wheel_sizes}`);
      console.log(`  oem_wheel_sizes: ${JSON.stringify(row.oem_wheel_sizes, null, 2)?.substring(0, 500)}`);
    }
    console.log('');
  }
  
} finally {
  await pool.end();
}
