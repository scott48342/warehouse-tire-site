import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check wp_wheels structure for KMC
const { rows } = await pool.query(`
  SELECT DISTINCT division, style, display_style_no, sku
  FROM wp_wheels 
  WHERE division ILIKE '%kmc%'
  LIMIT 15
`);

console.log('KMC wheels in wp_wheels:');
rows.forEach(r => console.log(`  ${r.division} | ${r.style} | ${r.display_style_no} | ${r.sku}`));

// Check what "KM235" might look like
const { rows: km235 } = await pool.query(`
  SELECT DISTINCT style, display_style_no, sku
  FROM wp_wheels 
  WHERE style ILIKE '%235%' OR display_style_no ILIKE '%235%' OR sku ILIKE '%235%'
  LIMIT 10
`);

console.log('\nAnything with "235":');
km235.forEach(r => console.log(`  ${r.style} | ${r.display_style_no} | ${r.sku}`));

await pool.end();
