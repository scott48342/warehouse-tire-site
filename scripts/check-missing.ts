import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const makes = ['Honda', 'Acura', 'Mazda'];
  
  for (const make of makes) {
    const result = await pool.query(`
      SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments 
      WHERE make = $1 AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes = '[]' OR oem_wheel_sizes = 'null')
      ORDER BY model, year, display_trim
    `, [make]);
    
    console.log(`\n=== ${make} (${result.rows.length} missing) ===`);
    result.rows.forEach(r => console.log(`${r.id}|${r.year}|${r.model}|${r.display_trim}`));
  }
  
  await pool.end();
}

check();
