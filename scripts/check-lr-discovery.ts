import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT id, year, model, display_trim, oem_wheel_sizes::text as wheels, oem_tire_sizes::text as tires
    FROM vehicle_fitments
    WHERE make = 'Land Rover' 
      AND model ILIKE '%discovery%'
      AND year BETWEEN 2005 AND 2011
    ORDER BY year DESC
    LIMIT 30
  `);
  console.log('Discovery 2005-2011 records:', res.rowCount);
  res.rows.forEach(r => {
    const hasWheels = r.wheels && r.wheels !== 'null' && r.wheels !== '[]';
    console.log(`${r.year} ${r.model} [${r.display_trim}] - wheels: ${hasWheels ? 'YES' : 'MISSING'} (${r.wheels?.substring(0,60)})`);
  });
  await pool.end();
}
main();
