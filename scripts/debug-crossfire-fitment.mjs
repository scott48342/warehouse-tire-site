import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const { rows } = await pool.query(`
  SELECT year, make, model, oem_wheel_sizes, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'chrysler' 
  AND LOWER(model) = 'crossfire'
  AND year = 2005
`);

console.log("DB record for 2005 Crossfire:");
console.log(JSON.stringify(rows[0], null, 2));

if (rows[0]?.oem_wheel_sizes) {
  console.log("\nWheel sizes parsed:");
  for (const ws of rows[0].oem_wheel_sizes) {
    console.log(`  - diameter: ${ws.diameter}, width: ${ws.width}, position: ${ws.position}, axle: ${ws.axle}`);
  }
}

await pool.end();
