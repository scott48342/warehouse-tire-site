import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function fix() {
  console.log('Fixing model name from "300c" to "300"...');
  
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET model = '300'
    WHERE modification_id = 'chrysler-300c-awd-35b75a9f'
  `);
  console.log('Updated', result.rowCount, 'rows');
  
  // Verify
  const check = await pool.query(`
    SELECT modification_id, make, model, year, display_trim, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE modification_id = 'chrysler-300c-awd-35b75a9f'
  `);
  console.log('Verified:', check.rows[0]);
  
  await pool.end();
  process.exit(0);
}

fix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
