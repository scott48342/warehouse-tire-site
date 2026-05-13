import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

const result = await pool.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND (table_name LIKE '%wheel%' OR table_name LIKE '%techfeed%' OR table_name LIKE '%wp_%')
  ORDER BY table_name
`);

console.log('Wheel-related tables:');
for (const row of result.rows) {
  console.log(`  ${row.table_name}`);
}

await pool.end();
