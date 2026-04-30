import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const tables = await pool.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name
`);

console.log('=== TABLES ===');
tables.rows.forEach(r => console.log(r.table_name));

// Check for tire-related tables
const tireTables = tables.rows.filter(r => 
  r.table_name.includes('tire') || r.table_name.includes('wheel')
);
console.log('\n=== TIRE/WHEEL RELATED ===');
tireTables.forEach(r => console.log(r.table_name));

await pool.end();
