import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const modelName = process.argv[2] || 'KM553';

// Find wheels matching this model
const { rows } = await pool.query(`
  SELECT DISTINCT sku, style, display_style_no, brand_desc, product_desc
  FROM wp_wheels 
  WHERE style ILIKE $1 
     OR display_style_no = $2
     OR sku ILIKE $3
  LIMIT 10
`, [`%${modelName}%`, modelName.replace(/\D/g, ''), `%${modelName}%`]);

console.log(`Searching for: ${modelName}`);
console.log(`Found ${rows.length} matches:\n`);
rows.forEach(r => {
  console.log(`  SKU: ${r.sku}`);
  console.log(`  Style: ${r.style}`);
  console.log(`  Brand: ${r.brand_desc}`);
  console.log(`  Desc: ${r.product_desc?.slice(0, 60)}`);
  console.log('');
});

await pool.end();
