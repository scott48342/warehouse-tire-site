import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Sample gallery assets without SKU
const { rows: samples } = await pool.query(`
  SELECT DISTINCT wheel_brand, wheel_model 
  FROM gallery_assets 
  WHERE wheel_sku IS NULL AND wheel_brand = 'KMC'
  LIMIT 10
`);

console.log('Gallery assets without SKU:');
for (const s of samples) {
  // Try to find matching SKU in wp_wheels
  const { rows: matches } = await pool.query(`
    SELECT DISTINCT sku, style, display_style_no 
    FROM wp_wheels 
    WHERE LOWER(division) = 'kmc' 
      AND (LOWER(style) LIKE $1 OR LOWER(display_style_no) LIKE $1)
    LIMIT 3
  `, [`%${s.wheel_model.toLowerCase()}%`]);
  
  console.log(`\n${s.wheel_brand} ${s.wheel_model}:`);
  if (matches.length > 0) {
    matches.forEach(m => console.log(`  → ${m.sku} (${m.style} / ${m.display_style_no})`));
  } else {
    console.log('  → No match found');
  }
}

await pool.end();
