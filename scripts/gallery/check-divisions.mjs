import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check all divisions in wp_wheels
const { rows } = await pool.query(`
  SELECT division, COUNT(*) as cnt
  FROM wp_wheels 
  GROUP BY division
  ORDER BY cnt DESC
`);

console.log('Divisions in wp_wheels:');
rows.forEach(r => console.log(`  ${r.division}: ${r.cnt}`));

// Check if there's a brand or brand_desc column
const { rows: cols } = await pool.query(`
  SELECT column_name FROM information_schema.columns WHERE table_name = 'wp_wheels'
`);
console.log('\nColumns:', cols.map(c => c.column_name).join(', '));

await pool.end();
