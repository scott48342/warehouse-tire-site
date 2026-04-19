import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Fix remaining "light bar" (with space) entries
const result = await pool.query(`
  UPDATE accessories 
  SET sub_type = 'light_bar', category = 'lighting' 
  WHERE sub_type = 'light bar' 
  RETURNING sku, title
`);

console.log(`Fixed ${result.rowCount} products with "light bar" (space) -> "light_bar"`);
result.rows.forEach(r => console.log(`  - ${r.sku}: ${r.title}`));

// Verify no more spaces
const check = await pool.query(`SELECT COUNT(*) as count FROM accessories WHERE sub_type = 'light bar'`);
console.log(`\nRemaining with space: ${check.rows[0].count}`);

await pool.end();
