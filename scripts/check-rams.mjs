import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const db = drizzle(pool);

const rams = await db.execute(sql`
  SELECT DISTINCT model FROM vehicle_fitments 
  WHERE year = 2023 AND make ILIKE '%Ram%' 
  AND certification_status = 'certified'
  ORDER BY model
`);
console.log('2023 Ram models in DB:');
rams.rows.forEach(r => console.log('  -', r.model));
await pool.end();
