import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const r = await pool.query(`SELECT display_trim, oem_tire_sizes FROM vehicle_fitments WHERE year=2022 AND model ILIKE '%f-150 lightning%' LIMIT 3`);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
