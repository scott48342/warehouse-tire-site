import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const { rows } = await pool.query(`
  SELECT DISTINCT display_trim FROM vehicle_fitments 
  WHERE year = 2024 AND make = 'Lincoln' AND model = 'Navigator'
`);
console.log('Navigator 2024 trims in DB:');
rows.forEach(r => console.log(' -', r.display_trim));

const { rows: rows2 } = await pool.query(`
  SELECT DISTINCT year FROM vehicle_fitments 
  WHERE make = 'Lincoln' AND model = 'Navigator' 
  ORDER BY year DESC LIMIT 10
`);
console.log('\nNavigator years in DB:');
rows2.forEach(r => console.log(' -', r.year));

await pool.end();
