import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Crossfire OEM staggered specs:
// Front: 18x7.5 ET35 with 225/40R18
// Rear: 19x9 ET39 with 255/35R19
const oemWheelSizes = [
  { diameter: 18, width: 7.5, offset: 35, position: 'front' },
  { diameter: 19, width: 9, offset: 39, position: 'rear' }
];

const result = await pool.query(`
  UPDATE vehicle_fitments 
  SET 
    oem_wheel_sizes = $1,
    updated_at = NOW()
  WHERE LOWER(make) = 'chrysler' 
  AND LOWER(model) LIKE '%crossfire%'
  RETURNING year, make, model, oem_wheel_sizes, oem_tire_sizes
`, [JSON.stringify(oemWheelSizes)]);

console.log(`Updated ${result.rowCount} Crossfire records with staggered wheel specs:`);
console.log(JSON.stringify(result.rows, null, 2));

await pool.end();
