import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const good = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE year >= 2000 
      AND submodel IS NOT NULL 
      AND submodel != ''
      AND LOWER(submodel) != 'base'
  `);
  console.log('Records with proper trim:', good.rows[0].count);
  
  const bad = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (submodel IS NULL OR submodel = '' OR LOWER(submodel) = 'base')
  `);
  console.log('Records with Base/empty:', bad.rows[0].count);
  
  const noWheels = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (submodel IS NULL OR submodel = '' OR LOWER(submodel) = 'base')
      AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]')
  `);
  console.log('Bad records WITHOUT wheel data:', noWheels.rows[0].count);
  
  await pool.end();
}
check();
