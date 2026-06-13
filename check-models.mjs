import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
const result = await pool.query(`
  SELECT DISTINCT model, COUNT(*) as cnt FROM vehicle_fitments 
  WHERE make ILIKE '%Chevrolet%' AND model ILIKE '%2500%' 
  GROUP BY model
`);
console.log(JSON.stringify(result.rows, null, 2));
await pool.end();
