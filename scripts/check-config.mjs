import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check for any config tables
const tables = await pool.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE '%config%'
`);
console.log('Config tables:', tables.rows);

// Check tireweb_config
const tireweb = await pool.query(`SELECT key FROM tireweb_config`);
console.log('TireWeb config keys:', tireweb.rows.map(r => r.key));

await pool.end();
