import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check brand_desc
const { rows } = await pool.query(`
  SELECT brand_desc, COUNT(*) as cnt
  FROM wp_wheels 
  GROUP BY brand_desc
  ORDER BY cnt DESC
`);

console.log('Brands in wp_wheels:');
rows.forEach(r => console.log(`  ${r.brand_desc}: ${r.cnt}`));

// Sample KMC wheels
const { rows: kmc } = await pool.query(`
  SELECT sku, style, display_style_no, product_desc
  FROM wp_wheels 
  WHERE brand_desc ILIKE '%kmc%'
  LIMIT 10
`);

console.log('\nKMC sample:');
kmc.forEach(r => console.log(`  ${r.sku} | ${r.style} | ${r.display_style_no}`));

await pool.end();
